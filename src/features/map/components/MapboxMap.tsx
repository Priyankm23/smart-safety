import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, Platform, Alert, Dimensions, View } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { useApp } from "../../../context/AppContext";

// Import path deviation context
import { usePathDeviation } from "../../../context/PathDeviationContext";

// Import sub-components
import MapHeader from "./MapboxMap/MapHeader";
import ErrorMessage from "./MapboxMap/ErrorMessage";
import MapContainer from "./MapboxMap/MapContainer";
import LocationInfo from "./MapboxMap/LocationInfo";
import MapActionButtons from "./MapboxMap/MapActionButtons";
import StyleSelector from "./MapboxMap/StyleSelector";

// Import new UI overlay components
import {
  TopLocationCard,
  WarningBanner,
  RightActionButtons,
  MapBottomSheet,
  LegendBottomSheet,
} from "./MapboxMap/ui";

// Import types, constants and utilities
import { WebViewMessage } from "./MapboxMap/types";
import { reverseGeocode } from "./MapboxMap/geoUtils";
import {
  GeoFence,
  filterFencesByDistance,
  haversineKm,
} from "../../../utils/geofenceLogic";
import touristSocketService from "../../../services/touristSocketService";

const NEARBY_FENCE_RADIUS_KM = 15;
const LOCATION_REFILTER_THRESHOLD_KM = 5;

interface MapboxMapProps {
  showCurrentLocation?: boolean;
  onLocationSelect?: (location: Location.LocationObject) => void;
  onLocationChange?: (location: Location.LocationObject) => void;
  style?: any;
  zoomLevel?: number;
  mapWidth?: number;
  mapHeight?: number;
  geoFences?: GeoFence[];
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export default function MapboxMap({
  showCurrentLocation = true,
  onLocationSelect,
  onLocationChange,
  style,
  zoomLevel = 15,
  mapWidth = Dimensions.get("window").width - 32,
  mapHeight = 300,
  geoFences,
  isFullScreen = false,
  onToggleFullScreen,
}: MapboxMapProps) {
  const { state } = useApp();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [address, setAddress] = useState<string>("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationAvailable, setLocationAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState("streets");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadedGeoFences, setLoadedGeoFences] = useState<GeoFence[]>([]);
  const [allGeoFences, setAllGeoFences] = useState<GeoFence[]>([]);
  const [lastLocationForFilter, setLastLocationForFilter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState<boolean>(false);

  // New state for overlay UI
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  // Legend statistics
  const [dangerZoneCount, setDangerZoneCount] = useState(0);
  const [riskGridCount, setRiskGridCount] = useState(0);
  const [geofenceCount, setGeofenceCount] = useState(0);

  const webViewRef = useRef<WebView>(null);

  // Connect map to path deviation tracking
  const { setMapRef, isTracking } = usePathDeviation();

  // Set map reference for path deviation tracking AFTER map is ready
  useEffect(() => {
    if (mapReady && webViewRef.current) {
      console.log("[MapboxMap] Setting map ref after map is ready");
      setMapRef(webViewRef);
    }
    return () => {
      setMapRef(null);
    };
  }, [setMapRef, mapReady]);

  // Watch user location when map is ready and not in tracking mode (journey)
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationWatch = async () => {
      if (!showCurrentLocation || !locationPermissionGranted || isTracking)
        return;

      try {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (newLocation) => {
            setLocation(newLocation);

            // Notify parent
            if (onLocationChange) {
              onLocationChange(newLocation);
            }

            // Send to WebView
            if (webViewRef.current && mapReady) {
              webViewRef.current.postMessage(
                JSON.stringify({
                  type: "setLocation",
                  location: newLocation.coords,
                }),
              );
            }

            // Re-filter fences if needed
            refilterFencesIfNeeded(
              newLocation.coords.latitude,
              newLocation.coords.longitude,
            );
          },
        );
      } catch (err) {
        console.error("Failed to watch location:", err);
      }
    };

    if (mapReady && locationPermissionGranted && !isTracking) {
      startLocationWatch();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [showCurrentLocation, locationPermissionGranted, mapReady, isTracking]);

  // Subscribe to risk grid updates from backend
  useEffect(() => {
    const unsubscribe = touristSocketService.on(
      "riskGridUpdated",
      (data: any) => {
        console.log("[MapboxMap] Received risk grid update:", data);
        if (webViewRef.current && mapReady) {
          webViewRef.current.postMessage(
            JSON.stringify({
              type: "updateRiskGrid",
              gridData: data,
            }),
          );
        }
      },
    );
    return unsubscribe;
  }, [mapReady]);

  // Request location permissions on mount and load geofences
  useEffect(() => {
    (async () => {
      if (showCurrentLocation) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === "granted";
        setLocationPermissionGranted(granted);

        if (!granted) {
          setError("Location permission denied. Showing all safety zones.");
          loadAllFencesWithoutFiltering();
          return;
        }

        try {
          const locationResult = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = locationResult.coords;
          setLastLocationForFilter({ lat: latitude, lng: longitude });
          await loadAndFilterFences(latitude, longitude);
        } catch (err) {
          console.warn("Failed to get location for filtering:", err);
          loadAllFencesWithoutFiltering();
        }
      } else {
        loadAllFencesWithoutFiltering();
      }
    })();
  }, [showCurrentLocation]);

  const loadAllFencesWithoutFiltering = async () => {
    try {
      const geofenceService = require("../services/geofenceService").default;
      let data = geofenceService.getFences();
      if (!data || data.length === 0) {
        const userId = state.user?.touristId;
        data = await geofenceService.loadFences(undefined, undefined, userId);
      }
      if (!data || data.length === 0) {
        data = require("../../../../assets/geofences-output.json");
      }
      const fencesWithDistance = data.map((f: GeoFence) => ({
        ...f,
        distanceToUser: undefined,
        // Add default visualStyle if missing (for bundled data)
        visualStyle: f.visualStyle || getDefaultVisualStyle(f),
      }));
      setAllGeoFences(fencesWithDistance);
      setLoadedGeoFences(fencesWithDistance);
      console.log(
        "Loaded all geo-fences (no location permission):",
        fencesWithDistance.length,
      );
    } catch (err) {
      console.warn("Failed to load geo-fences:", err);
      setAllGeoFences([]);
      setLoadedGeoFences([]);
    }
  };

  const loadAndFilterFences = async (userLat: number, userLng: number) => {
    try {
      const geofenceService = require("../services/geofenceService").default;
      let data = geofenceService.getFences();
      if (!data || data.length === 0) {
        const userId = state.user?.touristId;
        data = await geofenceService.loadFences(userLat, userLng, userId);
      }
      if (!data || data.length === 0) {
        data = require("../../../../assets/geofences-output.json");
      }
      // Add default visualStyle to bundled data if missing
      const dataWithStyle = data.map((f: GeoFence) => ({
        ...f,
        visualStyle: f.visualStyle || getDefaultVisualStyle(f),
      }));
      setAllGeoFences(dataWithStyle);
      const nearby = filterFencesByDistance(
        dataWithStyle,
        userLat,
        userLng,
        NEARBY_FENCE_RADIUS_KM,
      );
      setLoadedGeoFences(nearby);
      console.log(
        `Loaded ${dataWithStyle.length} total fences, filtered to ${nearby.length} within ${NEARBY_FENCE_RADIUS_KM}km`,
      );
    } catch (err) {
      console.warn("Failed to load/filter geo-fences:", err);
      setAllGeoFences([]);
      setLoadedGeoFences([]);
    }
  };

  // Helper function to add default visualStyle based on fence properties
  const getDefaultVisualStyle = (fence: GeoFence) => {
    const category = (fence.category || "").toLowerCase();
    const riskLevel = (fence.riskLevel || "").toLowerCase();

    // Determine zone type from category
    if (category.includes("danger") || category.includes("hazard")) {
      return {
        zoneType: "danger_zone",
        borderStyle: "solid",
        borderWidth: 3,
        fillOpacity: 0.25,
        fillPattern: "diagonal-stripes",
        iconType: "warning-triangle",
        renderPriority: 1,
      };
    }

    if (category.includes("risk") || category.includes("grid")) {
      return {
        zoneType: "risk_grid",
        borderStyle: "dashed",
        borderWidth: 2,
        fillOpacity: 0.4,
        fillPattern: "dots",
        iconType: "incident-marker",
        renderPriority: 2,
        gridSize: 500,
      };
    }

    // Default to danger zone styling for bundled data
    return {
      zoneType: "danger_zone",
      borderStyle: "solid",
      borderWidth: 2,
      fillOpacity: 0.3,
      fillPattern: "solid",
      iconType: "warning-triangle",
      renderPriority: 1,
    };
  };

  // Re-filter fences when location changes significantly
  const refilterFencesIfNeeded = useCallback(
    (newLat: number, newLng: number) => {
      if (lastLocationForFilter) {
        const distance = haversineKm(
          [newLat, newLng],
          [lastLocationForFilter.lat, lastLocationForFilter.lng],
        );

        if (distance >= LOCATION_REFILTER_THRESHOLD_KM) {
          console.log(
            `User moved ${distance.toFixed(2)}km, re-filtering fences...`,
          );
          setLastLocationForFilter({ lat: newLat, lng: newLng });
          loadAndFilterFences(newLat, newLng);
        }
      } else {
        setLastLocationForFilter({ lat: newLat, lng: newLng });
        loadAndFilterFences(newLat, newLng);
      }
    },
    [lastLocationForFilter],
  );

  // Send geo-fences to the WebView when map is ready or when geoFences prop changes
  useEffect(() => {
    if (!webViewRef.current || !mapReady) return;

    const fencesToSend = geoFences || loadedGeoFences;
    if (!Array.isArray(fencesToSend)) return;

    try {
      console.log(
        `Sending ${fencesToSend.length} geo-fences to Mapbox WebView, including custom fences:`,
        fencesToSend
          .filter((f) => f.id && f.id.startsWith("custom"))
          .map((f) => f.name),
      );
      webViewRef.current.postMessage(
        JSON.stringify({ type: "setGeoFences", fences: fencesToSend }),
      );
    } catch (e) {
      console.warn("Failed to post geo-fences to Mapbox WebView", e);
    }
  }, [mapReady, geoFences, loadedGeoFences]);

  // Calculate legend statistics whenever geofences change
  useEffect(() => {
    const fencesToCount = geoFences || loadedGeoFences;
    if (!Array.isArray(fencesToCount)) return;

    const danger = fencesToCount.filter(
      (f) =>
        f.visualStyle?.zoneType === "danger_zone" ||
        (f.category && f.category.toLowerCase().includes("danger")),
    ).length;

    const risk = fencesToCount.filter(
      (f) =>
        f.visualStyle?.zoneType === "risk_grid" || f.category === "Risk Grid",
    ).length;

    const geofences = fencesToCount.filter(
      (f) =>
        f.visualStyle?.zoneType === "geofence" ||
        f.visualStyle?.zoneType === "itinerary_geofence" ||
        f.category === "Tourist Destination" ||
        f.category === "Itinerary Geofence" ||
        f.metadata?.sourceType === "itinerary",
    ).length;

    setDangerZoneCount(danger);
    setRiskGridCount(risk);
    setGeofenceCount(geofences);
  }, [geoFences, loadedGeoFences]);

  // Handle WebView messages
  const handleWebViewMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case "mapReady":
          console.log("Mapbox map is ready");
          setMapReady(true);
          break;
        case "locationSelected":
          if (onLocationSelect && message.location) {
            onLocationSelect(message.location);
          }
          break;
        case "mapClick":
          // Handle map click - currently we don't create geofences on click
          // but we could implement custom geofence creation functionality here if needed
          console.log("Map clicked at:", message.lat, message.lng);
          break;
        case "error":
          setError(message.message || "Map error occurred");
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (err) {
      console.error("Error parsing WebView message:", err);
    }
  };

  // When the webview map is ready, attempt to get and send current location
  useEffect(() => {
    if (mapReady && showCurrentLocation) {
      // Delay slightly to allow WebView handlers to be ready to receive messages
      const t = setTimeout(() => {
        getCurrentLocation();
      }, 250);
      return () => clearTimeout(t);
    }
    return;
  }, [mapReady, showCurrentLocation]);

  // Get current location
  const getCurrentLocation = async () => {
    if (!showCurrentLocation) return;

    setLoadingLocation(true);
    setError(null);

    try {
      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(locationResult);
      setLocationAvailable(true);

      // Re-filter fences if user moved significantly
      if (locationPermissionGranted) {
        refilterFencesIfNeeded(
          locationResult.coords.latitude,
          locationResult.coords.longitude,
        );
      }

      // Reverse geocode to get address
      setLoadingAddress(true);
      try {
        const addressResult = await reverseGeocode(
          locationResult.coords.latitude,
          locationResult.coords.longitude,
        );
        setAddress(addressResult);
      } catch (geoError) {
        console.error("Reverse geocoding failed:", geoError);
      } finally {
        setLoadingAddress(false);
      }

      // Notify parent component
      if (onLocationChange) {
        onLocationChange(locationResult);
      }

      // Send location to WebView
      if (webViewRef.current) {
        try {
          webViewRef.current.postMessage(
            JSON.stringify({
              type: "setLocation",
              location: locationResult.coords,
            }),
          );
        } catch (postErr) {
          // Fallback for environments where postMessage might not be available
          const message = JSON.stringify({
            type: "setLocation",
            location: locationResult.coords,
          });
          webViewRef.current.injectJavaScript(
            `window.postMessage(${message}, '*');`,
          );
        }
      }
    } catch (err) {
      console.error("Location error:", err);
      setError("Failed to get current location");
      setLocationAvailable(false);
    } finally {
      setLoadingLocation(false);
    }
  };

  // Open location in external map app
  const openExternalMap = () => {
    if (!location) return;

    const url = Platform.select({
      ios: `maps:///?ll=${location.coords.latitude},${location.coords.longitude}`,
      android: `geo:${location.coords.latitude},${location.coords.longitude}?q=${location.coords.latitude},${location.coords.longitude}`,
    });

    if (url) {
      // Note: In a real app, you'd use Linking.openURL(url)
      Alert.alert("External Map", `Would open: ${url}`);
    }
  };

  // Share current location
  const shareLocation = () => {
    if (!location) return;

    let message = `My current location: ${location.coords.latitude}, ${location.coords.longitude}`;
    if (address) {
      message += `\nAddress: ${address}`;
    }

    // Note: In a real app, you'd use Share.share({ message })
    Alert.alert("Share Location", message);
  };

  // Handle full screen toggle
  const handleToggleFullScreen = () => {
    if (onToggleFullScreen) {
      onToggleFullScreen();
    }
  };

  // Handle style selection
  const handleSelectStyle = (style: string) => {
    setSelectedStyle(style);
    // Send style change to WebView
    if (webViewRef.current) {
      try {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "setStyle",
            style: style,
          }),
        );
      } catch (postErr) {
        const message = JSON.stringify({
          type: "setStyle",
          style: style,
        });
        webViewRef.current.injectJavaScript(
          `window.postMessage(${message}, '*');`,
        );
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        isFullScreen ? styles.containerFullScreen : undefined,
        style,
      ]}
    >
      {isFullScreen ? (
        // Full-screen: render map with overlay UI components
        <View style={styles.fullScreenContainer}>
          <MapContainer
            webViewKey={webViewKey}
            height={Dimensions.get("window").height}
            onWebViewMessage={handleWebViewMessage}
            webViewRef={webViewRef}
            isFullScreen={isFullScreen}
          />

          {/* Overlay UI Components */}
          <TopLocationCard />

          {showWarningBanner && (
            <WarningBanner onDismiss={() => setShowWarningBanner(false)} />
          )}

          <RightActionButtons
            onCompassPress={getCurrentLocation}
            onLayersPress={() => setShowStyleSelector(!showStyleSelector)}
            onSOSPress={() => {
              setShowStyleSelector(false);
              setIsLegendExpanded(false);
              setIsBottomSheetExpanded((prev) => !prev);
            }}
            onLegendPress={() => {
              console.log(
                "[MapboxMap] Legend button pressed, current state:",
                isLegendExpanded,
              );
              // Close other bottom sheets
              setShowStyleSelector(false);
              setIsBottomSheetExpanded(false);
              setIsLegendExpanded((prev) => !prev);
            }}
          />

          {showStyleSelector && (
            <View style={styles.styleSelectorOverlay}>
              <StyleSelector
                selectedStyle={selectedStyle}
                onSelectStyle={(style) => {
                  handleSelectStyle(style);
                  setShowStyleSelector(false);
                }}
              />
            </View>
          )}

          <MapBottomSheet
            isExpanded={isBottomSheetExpanded}
            onToggle={() => {
              setIsLegendExpanded(false);
              setIsBottomSheetExpanded((prev) => !prev);
            }}
            onShareLive={shareLocation}
            onSOS={() => Alert.alert("SOS", "Emergency SOS activated!")}
          />

          <LegendBottomSheet
            isExpanded={isLegendExpanded}
            onToggle={() => {
              setIsBottomSheetExpanded(false);
              setIsLegendExpanded((prev) => !prev);
            }}
            dangerZoneCount={dangerZoneCount}
            riskGridCount={riskGridCount}
            geofenceCount={geofenceCount}
          />
        </View>
      ) : (
        // Normal embedded view
        <>
          <MapHeader
            title="Mapbox Map"
            loading={loadingLocation}
            onRefresh={getCurrentLocation}
          />

          <MapContainer
            webViewKey={webViewKey}
            height={mapHeight}
            onWebViewMessage={handleWebViewMessage}
            webViewRef={webViewRef}
            isFullScreen={isFullScreen}
          />

          {error && (
            <ErrorMessage errorMsg={error} onRetry={getCurrentLocation} />
          )}

          <LocationInfo
            location={location}
            address={address}
            loadingAddress={loadingAddress}
          />

          <MapActionButtons
            locationAvailable={locationAvailable}
            loadingLocation={loadingLocation}
            onGetCurrentLocation={getCurrentLocation}
            onOpenExternalMap={openExternalMap}
            onShareLocation={shareLocation}
            onToggleFullScreen={handleToggleFullScreen}
            isFullScreen={isFullScreen}
          />

          <StyleSelector
            selectedStyle={selectedStyle}
            onSelectStyle={handleSelectStyle}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  containerFullScreen: {
    margin: 0,
    flex: 1,
  },
  fullScreenContainer: {
    flex: 1,
    position: "relative",
  },
  styleSelectorOverlay: {
    position: "absolute",
    right: 70,
    top: "35%",
    zIndex: 95,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardFullScreen: {
    margin: 0,
    borderRadius: 0,
    height: Dimensions.get("window").height,
  },
});
