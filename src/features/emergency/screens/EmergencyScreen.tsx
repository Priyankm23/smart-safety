import React, { useEffect, useState } from "react";
import IncidentReportModal from "../../report/components/IncidentReportModal";
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  StatusBar,
  Text,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { GeoFence, haversineKm } from "../../../utils/geofenceLogic";
import { useApp } from "../../../context/AppContext";
import { useLocation } from "../../../context/LocationContext";
import { usePathDeviation } from "../../../context/PathDeviationContext";
import { reverseGeocode } from "../../map/components/MapboxMap/geoUtils";
import { loadFences } from "../../map/services/geofenceService";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Route,
  RouteCoordinate,
  RoutingProfile,
  fetchDirectionsForWaypoints,
} from "../../map/services/mapboxDirectionsService";

// Import map components
import MapContainer from "../../map/components/MapboxMap/MapContainer";
import { WebViewMessage } from "../../map/components/MapboxMap/types";

// Import overlay UI components
import {
  TopLocationCard,
  WarningBanner,
  RightActionButtons,
  MapBottomSheet,
  StyleBottomSheet,
  DirectionsBottomSheet,
  LegendBottomSheet,
} from "../../map/components/MapboxMap/ui";
import DirectionsTopPanel from "../../map/components/MapboxMap/ui/DirectionsTopPanel";
import NavigationView from "../../../components/NavigationView";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// Configuration for auto-refresh
const REFRESH_INTERVAL_MS = 60000; // 60 seconds

export default function EmergencyScreen({ navigation }: any) {
  const { state } = useApp();
  const { currentLocation, setCurrentLocation, setCurrentAddress } =
    useLocation();
  const { isTracking, setMapRef } = usePathDeviation();

  // Map state
  const [mapReady, setMapReady] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState("streets");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingGeofences, setLoadingGeofences] = useState(false);

  // UI state
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [isStyleSheetExpanded, setIsStyleSheetExpanded] = useState(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  // Directions Mode State
  const [directionsMode, setDirectionsMode] = useState(false);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [currentProfile, setCurrentProfile] =
    useState<RoutingProfile>("driving");
  const [isDirectionsSheetVisible, setIsDirectionsSheetVisible] =
    useState(false);
  const [itineraryRoute, setItineraryRoute] = useState<Route | null>(null);
  const [itineraryWaypoints, setItineraryWaypoints] = useState<any[]>([]);

  const itineraryRouteKeyRef = React.useRef<string | null>(null);
  const itineraryProfile: RoutingProfile = "driving";

  const currentRoute = allRoutes[selectedRouteIndex] || null;
  const activeTrip = React.useMemo(
    () => selectActiveTrip(state.trips),
    [state.trips],
  );

  // Geofences
  const [geoFences, setGeoFences] = useState<GeoFence[]>([]);
  const [dangerZoneCount, setDangerZoneCount] = useState(0);
  const [riskGridCount, setRiskGridCount] = useState(0);
  const [geofenceCount, setGeofenceCount] = useState(0);

  const webViewRef = React.useRef<WebView>(null);

  // Set map reference for path deviation tracking AFTER map is ready
  useEffect(() => {
    if (mapReady && webViewRef.current) {
      console.log(
        "[EmergencyScreen] Setting map ref for path deviation tracking",
      );
      setMapRef(webViewRef);
    }
    return () => {
      setMapRef(null);
    };
  }, [setMapRef, mapReady]);

  // Load geofences on mount using service (tries server first, then bundled)
  useEffect(() => {
    const loadGeoFencesFromService = async () => {
      setLoadingGeofences(true);
      try {
        const userId = state.user?.touristId;
        const fences = await loadFences(undefined, undefined, userId);
        setGeoFences(fences);
        console.log("Loaded geofences:", fences.length, "for user:", userId);
      } catch (err) {
        console.warn("Failed to load geofences:", err);
        setGeoFences([]);
      } finally {
        setLoadingGeofences(false);
      }
    };
    loadGeoFencesFromService();
  }, []);

  // Request location permissions
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required for the map.",
        );
        return;
      }
    })();
  }, []);

  // Get current location when map is ready
  useEffect(() => {
    if (mapReady) {
      getCurrentLocation();
    }
  }, [mapReady]);

  // Send geofences to WebView when ready
  useEffect(() => {
    if (!webViewRef.current || !mapReady || !geoFences.length) return;

    try {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "setGeoFences",
          fences: geoFences,
        }),
      );
    } catch (e) {
      console.warn("Failed to send geofences to WebView", e);
    }
  }, [mapReady, geoFences]);

  // Update map when routes change
  useEffect(() => {
    if (!webViewRef.current || !mapReady) return;

    if (directionsMode && allRoutes.length > 0) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "setRoute",
          routes: allRoutes,
          selectedIndex: selectedRouteIndex,
          profile: currentProfile,
        }),
      );
      return;
    }

    if (itineraryRoute || itineraryWaypoints.length > 0) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "setRoute",
          routes: itineraryRoute ? [itineraryRoute] : [],
          selectedIndex: 0,
          profile: itineraryProfile,
          waypoints: itineraryWaypoints,
        }),
      );
      return;
    }

    webViewRef.current.postMessage(
      JSON.stringify({
        type: "clearRoute",
      }),
    );
  }, [
    allRoutes,
    selectedRouteIndex,
    currentProfile,
    itineraryRoute,
    itineraryWaypoints,
    itineraryProfile,
    directionsMode,
    mapReady,
  ]);

  function getCurrentDayIndex(
    tripStartDate: string,
    totalDays: number,
  ): number {
    const tripStart = new Date(tripStartDate);
    const today = new Date();

    tripStart.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, Math.min(daysDiff, totalDays - 1));
  }

  function selectActiveTrip(trips: any[]) {
    const tripsWithDays = (trips || []).filter(
      (trip) =>
        Array.isArray(trip?.dayWiseItinerary) &&
        trip.dayWiseItinerary.length > 0,
    );
    if (tripsWithDays.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const trip of tripsWithDays) {
      const totalDays = trip.dayWiseItinerary.length;
      const start = new Date(trip.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + totalDays - 1);

      if (today >= start && today <= end) {
        return trip;
      }
    }

    return tripsWithDays[0];
  }

  const toFiniteNumber = (value: any): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const extractDayCoordinates = (nodes: any[]): RouteCoordinate[] => {
    return (nodes || [])
      .map((node) => {
        const locationCoords = Array.isArray(node?.location?.coordinates)
          ? node.location.coordinates
          : Array.isArray(node?.coordinates)
            ? node.coordinates
            : null;

        const latitude = toFiniteNumber(
          node?.lat ??
            node?.latitude ??
            (locationCoords ? locationCoords[1] : null),
        );

        const longitude = toFiniteNumber(
          node?.lng ??
            node?.longitude ??
            (locationCoords ? locationCoords[0] : null),
        );

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
          return null;

        return { latitude, longitude };
      })
      .filter((coord): coord is RouteCoordinate => !!coord);
  };

  const extractDayWaypoints = (nodes: any[]) => {
    let stopCounter = 1;
    return (nodes || [])
      .map((node) => {
        const locationCoords = Array.isArray(node?.location?.coordinates)
          ? node.location.coordinates
          : Array.isArray(node?.coordinates)
            ? node.coordinates
            : null;

        const latitude = toFiniteNumber(
          node?.lat ??
            node?.latitude ??
            (locationCoords ? locationCoords[1] : null),
        );

        const longitude = toFiniteNumber(
          node?.lng ??
            node?.longitude ??
            (locationCoords ? locationCoords[0] : null),
        );

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
          return null;

        const kind: "start" | "end" | "stop" =
          node?.type === "start"
            ? "start"
            : node?.type === "end"
              ? "end"
              : "stop";

        const label =
          kind === "start"
            ? "Start"
            : kind === "end"
              ? "End"
              : `${stopCounter++}`;

        return {
          latitude,
          longitude,
          label,
          kind,
          name: node?.name || "",
        };
      })
      .filter(Boolean);
  };

  useEffect(() => {
    if (!mapReady || directionsMode) return;

    if (!activeTrip || !Array.isArray(activeTrip.dayWiseItinerary)) {
      setItineraryRoute(null);
      itineraryRouteKeyRef.current = null;
      return;
    }

    const totalDays = activeTrip.dayWiseItinerary.length;
    const dayIndex = getCurrentDayIndex(activeTrip.date, totalDays);
    const day = activeTrip.dayWiseItinerary[dayIndex];
    const coordinates = extractDayCoordinates(day?.nodes);
    const waypoints = extractDayWaypoints(day?.nodes);

    if (coordinates.length === 0 && waypoints.length === 0) {
      setItineraryRoute(null);
      itineraryRouteKeyRef.current = null;
      setItineraryWaypoints([]);
      return;
    }

    const routeKey = `${activeTrip.id}:${dayIndex}:${waypoints
      .map((wp) => `${wp.longitude.toFixed(5)},${wp.latitude.toFixed(5)}`)
      .join("|")}`;

    if (routeKey === itineraryRouteKeyRef.current) return;

    itineraryRouteKeyRef.current = routeKey;

    if (coordinates.length < 2) {
      setItineraryRoute(null);
      setItineraryWaypoints(waypoints);

      if (webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "setRoute",
            routes: [],
            selectedIndex: 0,
            profile: itineraryProfile,
            waypoints,
          }),
        );
      }
      return;
    }

    setItineraryWaypoints(waypoints);
    let cancelled = false;

    const loadRoute = async () => {
      try {
        const response = await fetchDirectionsForWaypoints(
          coordinates,
          itineraryProfile,
          {
            alternatives: false,
            steps: true,
            geometries: "geojson",
            overview: "full",
          },
        );

        if (!cancelled) {
          setItineraryRoute(response.routes?.[0] || null);

          if (webViewRef.current) {
            webViewRef.current.postMessage(
              JSON.stringify({
                type: "setRoute",
                routes: response.routes || [],
                selectedIndex: 0,
                profile: itineraryProfile,
                waypoints,
              }),
            );
          }
        }
      } catch (error) {
        console.warn("[ItineraryRoute] Failed to load route:", error);
        if (!cancelled) {
          setItineraryRoute(null);
          if (webViewRef.current) {
            webViewRef.current.postMessage(
              JSON.stringify({
                type: "setRoute",
                routes: [],
                selectedIndex: 0,
                profile: itineraryProfile,
                waypoints,
              }),
            );
          }
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [mapReady, directionsMode, activeTrip, itineraryProfile]);

  // Calculate legend statistics whenever geofences change
  useEffect(() => {
    if (!Array.isArray(geoFences)) return;

    const danger = geoFences.filter(
      (f) =>
        f.visualStyle?.zoneType === "danger_zone" ||
        (f.category && f.category.toLowerCase().includes("danger")),
    ).length;

    const risk = geoFences.filter(
      (f) =>
        f.visualStyle?.zoneType === "risk_grid" || f.category === "Risk Grid",
    ).length;

    const geofences = geoFences.filter(
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
  }, [geoFences]);

  // Refresh geofences function
  const refreshGeofences = async () => {
    try {
      setIsBackgroundRefreshing(true);
      const userLat = currentLocation?.coords.latitude;
      const userLng = currentLocation?.coords.longitude;
      const userId = state.user?.touristId;

      const fences = await loadFences(userLat, userLng, userId);
      setGeoFences(fences);

      console.log(
        `[Auto-Refresh] Refreshed ${fences.length} geofences for user: ${userId}`,
      );
    } catch (err) {
      console.warn("Failed to refresh geofences:", err);
      // Don't show error to user - fail silently for background refresh
    } finally {
      setIsBackgroundRefreshing(false);
    }
  };

  // Set up auto-refresh polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log("[Auto-Refresh] Timer triggered");
      refreshGeofences();
    }, REFRESH_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => {
      console.log("[Auto-Refresh] Stopping polling");
      clearInterval(intervalId);
    };
  }, [currentLocation]); // Re-create interval if location changes

  const getCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      // Recenter quickly with last known location if available
      if (currentLocation?.coords && webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "setLocation",
            location: currentLocation.coords,
            forceCenter: true,
          }),
        );
      }

      // Check permission first
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location services to use this feature",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Settings",
              onPress: async () => {
                await Location.requestForegroundPermissionsAsync();
              },
            },
          ],
        );
        setLoadingLocation(false);
        return;
      }

      // Try fast last-known location first to reduce delay
      const lastKnown = await Location.getLastKnownPositionAsync();
      const location =
        lastKnown ||
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }));

      setCurrentLocation(location);

      // Reverse geocode
      const address = await reverseGeocode(
        location.coords.latitude,
        location.coords.longitude,
      );
      if (address) {
        setCurrentAddress(address);
      }

      // Send to WebView
      if (webViewRef.current) {
        webViewRef.current.postMessage(
          JSON.stringify({
            type: "setLocation",
            location: location.coords,
            forceCenter: true,
          }),
        );
      }
    } catch (err: any) {
      console.error("Location error:", err);
      Alert.alert(
        "Location Error",
        err.message || "Failed to get current location",
      );
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case "mapReady":
          setMapReady(true);
          break;
        case "mapClick":
          // Handle map click - currently we don't create geofences on click
          // but we could implement custom geofence creation functionality here if needed
          console.log("Map clicked at:", message.lat, message.lng);
          break;
        case "error":
          console.error("Map error:", message.message);
          break;
        case "routeSelected":
          if (directionsMode && message.index !== undefined) {
            setSelectedRouteIndex(message.index);
          }
          break;
      }
    } catch (err) {
      console.error("Error parsing WebView message:", err);
    }
  };

  const handleStyleChange = (style: string) => {
    setSelectedStyle(style);
    setIsStyleSheetExpanded(false);

    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "setStyle",
          style: style,
        }),
      );
    }
  };

  const handleShareLocation = () => {
    if (!currentLocation) {
      Alert.alert("No Location", "Location not available yet");
      return;
    }

    const { latitude, longitude } = currentLocation.coords;
    const message = `My location: https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}`;
    Alert.alert("Share Location", message);
  };

  const handleSOS = () => {
    setShowIncidentModal(true);
  };

  const handleIncidentSubmitted = () => {
    console.log("[Incident] Submitted, refreshing map immediately");
    refreshGeofences();
  };

  const handleDirectionsPress = () => {
    // Enable Directions Mode
    setDirectionsMode(true);

    // Close other sheets
    setIsBottomSheetExpanded(false);
    setIsStyleSheetExpanded(false);
    setIsLegendExpanded(false);
    setShowWarningBanner(false);
  };

  const handleExitDirections = () => {
    setDirectionsMode(false);
    setAllRoutes([]);
    setSelectedRouteIndex(0);
    setShowWarningBanner(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Full-screen Map */}
      <MapContainer
        webViewKey={webViewKey}
        height={SCREEN_HEIGHT}
        onWebViewMessage={handleWebViewMessage}
        webViewRef={webViewRef}
        isFullScreen={true}
      />

      {/* Conditional Top UI - Hide when navigation is active */}
      {!isTracking && directionsMode ? (
        <DirectionsTopPanel
          onBack={handleExitDirections}
          onRoutesCalculated={(routes, profile) => {
            setAllRoutes(routes);
            setSelectedRouteIndex(0);
            setCurrentProfile(profile);
          }}
          onClearRoute={() => {
            setAllRoutes([]);
            setSelectedRouteIndex(0);
          }}
        />
      ) : !isTracking ? (
        <TopLocationCard />
      ) : null}

      {/* Warning Banner (if applicable and not in directions mode) */}
      {showWarningBanner && !directionsMode && (
        <WarningBanner onDismiss={() => setShowWarningBanner(false)} />
      )}

      {/* Background Refresh Indicator */}
      {isBackgroundRefreshing && (
        <View style={styles.refreshIndicator}>
          <View style={styles.refreshContent}>
            <MaterialCommunityIcons name="reload" size={16} color="#3B82F6" />
            <Text style={styles.refreshText}>Updating map...</Text>
          </View>
        </View>
      )}

      {/* Right Side Action Buttons - Hide when navigation is active or directions sheet is visible */}
      {!isTracking && (
        <RightActionButtons
          onCompassPress={getCurrentLocation}
          onDirectionsPress={handleDirectionsPress}
          onLayersPress={() => {
            setIsStyleSheetExpanded((prev) => !prev);
            setIsBottomSheetExpanded(false);
            setIsLegendExpanded(false);
          }}
          onSOSPress={() => {
            setIsStyleSheetExpanded(false);
            setIsLegendExpanded(false);
            setIsBottomSheetExpanded((prev) => !prev);
          }}
          onLegendPress={() => {
            setIsStyleSheetExpanded(false);
            setIsBottomSheetExpanded(false);
            setIsLegendExpanded((prev) => !prev);
          }}
          hideDirectionsButton={directionsMode}
          visible={!isDirectionsSheetVisible}
        />
      )}

      <StyleBottomSheet
        isExpanded={isStyleSheetExpanded}
        onToggle={() => setIsStyleSheetExpanded((prev) => !prev)}
        selectedStyle={selectedStyle}
        onSelectStyle={handleStyleChange}
      />

      {/* Directions Bottom Sheet (Summary) - Only visible when route exists */}
      <DirectionsBottomSheet
        route={currentRoute}
        profile={currentProfile}
        onClearRoute={() => {
          setAllRoutes([]);
          setSelectedRouteIndex(0);
        }}
        onVisibilityChange={setIsDirectionsSheetVisible}
      />

      {/* Navigation View - Shows when tracking is active */}
      <NavigationView
        onLayersPress={() => {
          setIsStyleSheetExpanded((prev) => !prev);
          setIsBottomSheetExpanded(false);
          setIsLegendExpanded(false);
        }}
        onSOSPress={handleSOS}
        onLegendPress={() => {
          setIsStyleSheetExpanded(false);
          setIsBottomSheetExpanded(false);
          setIsLegendExpanded((prev) => !prev);
        }}
      />

      <MapBottomSheet
        isExpanded={isBottomSheetExpanded && !directionsMode}
        onToggle={() => {
          setIsLegendExpanded(false);
          setIsBottomSheetExpanded((prev) => !prev);
        }}
        onShareLive={handleShareLocation}
        onSOS={handleSOS}
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

      {/* Incident Report Modal */}
      <IncidentReportModal
        visible={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        onIncidentSubmitted={handleIncidentSubmitted}
        latitude={currentLocation?.coords?.latitude ?? 0}
        longitude={currentLocation?.coords?.longitude ?? 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  refreshIndicator: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 40,
    alignSelf: "center",
    zIndex: 100,
  },
  refreshContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3B82F6",
  },
});
