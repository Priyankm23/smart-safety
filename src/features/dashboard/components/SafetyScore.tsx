import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import {
  computeSafetyScore,
  SafetyScoreResult,
} from "../../../utils/safetyLogic";
import { useApp } from "../../../context/AppContext";
import { useLocation } from "../../../context/LocationContext";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import touristSocket, {
  SafetyScoreData,
} from "../../../services/touristSocketService";

export default function SafetyScore() {
  const { state, setComputedSafetyScore } = useApp();
  const { currentLocation, setCurrentLocation } = useLocation();
  const [combinedResult, setCombinedResult] =
    useState<SafetyScoreResult | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedError, setCombinedError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isUsingSocketData, setIsUsingSocketData] = useState(false);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission denied");
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
      return location;
    } catch (error: any) {
      setCombinedError(`Location error: ${error.message}`);
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  // Listen for socket-based safety score updates
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 30; // Increased retries to 30s
    let cleanupFunction: (() => void) | null = null;

    // Try to set up listener with retries until socket is initialized
    const setupListener = () => {
      // Check if socket is initialized (meaning connect() has been called)
      // We don't need to wait for full connection (handshake), just for the socket object to exist
      // This allows us to catch events that might come immediately after connection
      if (!touristSocket.isInitialized()) {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(setupListener, 500);
        } else {
          console.warn(
            "Failed to set up listener after",
            maxRetries,
            "attempts",
          );
        }
        return;
      }

      // Set up socket listener for backend safety score updates
      // Store the cleanup function
      cleanupFunction = touristSocket.onSafetyScoreUpdate(
        (data: SafetyScoreData) => {
          if (!mounted) return;

          // Format nearest threat info
          let threatInfo = "No immediate threats detected";
          if (data.nearestThreat && typeof data.nearestThreat === "object") {
            const threat = data.nearestThreat;
            const distanceKm = (threat.distance / 1000).toFixed(2);
            threatInfo = `${threat.name} (${threat.severity}) - ${distanceKm}km away`;
          } else if (typeof data.nearestThreat === "string") {
            threatInfo = data.nearestThreat;
          }

          // Always use socket data and update state immediately
          setIsUsingSocketData(true);
          setLastUpdateTime(new Date(data.timestamp));

          // Convert socket data to our component format
          const result: SafetyScoreResult = {
            score: data.safetyScore,
            nearestThreat: threatInfo,
            weatherCondition: data.description || "",
            geofenceScore: data.geofenceScore || data.safetyScore,
            weatherScore: data.weatherScore || data.safetyScore,
          };

          // Force immediate update
          setCombinedResult(result);
          setCombinedLoading(false);
          setCombinedError(null);
          setComputedSafetyScore(data.safetyScore);
        },
      );
    };

    // Start trying to set up listener
    setupListener();

    return () => {
      mounted = false;
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, []); // Run only once on mount

  // Fallback: Fetch safety score manually if not using socket data
  // COMMENTED OUT as per requirement to only show backend socket data
  /*
  useEffect(() => {
    let mounted = true;
    const loc = currentLocation;

    // Only fetch manually if we haven't received socket data yet
    if (isUsingSocketData) {
      return;
    }

    const fetchSafetyScore = async () => {
      if (!loc || !loc.coords) {
        const newLocation = await getCurrentLocation();
        if (!newLocation || !mounted) return;
        await performSafetyScoreFetch(newLocation, mounted);
      } else {
        await performSafetyScoreFetch(loc, mounted);
      }
    };

    const performSafetyScoreFetch = async (
      location: Location.LocationObject,
      isMounted: boolean,
    ) => {
      setCombinedLoading(true);
      setCombinedError(null);
      try {
        const result = await computeSafetyScore({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (isMounted) {
          setCombinedResult(result);
          if (
            typeof result?.score === "number" &&
            result.score !== state.computedSafetyScore
          ) {
            setComputedSafetyScore(result.score);
          }
        }
      } catch (error: any) {
        if (isMounted)
          setCombinedError(error?.message || "Failed to fetch safety score");
      } finally {
        if (isMounted) setCombinedLoading(false);
      }
    };

    fetchSafetyScore();
    return () => {
      mounted = false;
    };
  }, [currentLocation, isUsingSocketData]);
  */

  const displayScore = combinedResult?.score ?? 0;
  const isLoading = locationLoading || combinedLoading;

  // Badge and color based on score
  const getScoreInfo = (score: number) => {
    if (score >= 80)
      return { label: "EXCELLENT", color: "#4CAF7A", bgColor: "#D1F0E4" };
    if (score >= 60)
      return { label: "GOOD", color: "#5B8BD4", bgColor: "#D4EBFC" };
    if (score >= 40)
      return { label: "MODERATE", color: "#E0A54B", bgColor: "#FCECD4" };
    return { label: "LOW", color: "#D66A6A", bgColor: "#FADED9" };
  };

  const scoreInfo = getScoreInfo(displayScore);

  const getDescription = (score: number) => {
    if (combinedResult?.weatherCondition) {
      return combinedResult.weatherCondition;
    }
    if (score >= 80)
      return "Very Safe Area • Low crime rate reported recently.";
    if (score >= 60) return "Generally Safe • Some caution advised.";
    if (score >= 40) return "Moderate Risk • Stay alert and aware.";
    return "High Risk Area • Exercise extreme caution.";
  };

  const formatLastUpdate = () => {
    if (!lastUpdateTime) return "";
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdateTime.getTime()) / 1000);

    if (diff < 60) return "Updated just now";
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
    return `Updated ${lastUpdateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="shield-check"
                size={24}
                color="#3B82F6"
              />
            </View>
            <Text style={styles.title}>Safety Score</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: scoreInfo.bgColor }]}>
            <Text style={[styles.badgeText, { color: scoreInfo.color }]}>
              {scoreInfo.label}
            </Text>
          </View>
        </View>

        {/* Score Display */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreNumber}>
            {isLoading ? "--" : displayScore}
          </Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>
          {isLoading
            ? "Calculating safety score..."
            : getDescription(displayScore)}
        </Text>

        {/* Last Update Timestamp */}
        {lastUpdateTime && (
          <Text style={styles.lastUpdate}>{formatLastUpdate()}</Text>
        )}

        {/* Nearest Threat Info */}
        {combinedResult?.nearestThreat && !isLoading && (
          <View style={styles.threatInfo}>
            <MaterialCommunityIcons
              name="information"
              size={14}
              color="#6B7280"
            />
            <Text style={styles.threatText}>
              {combinedResult.nearestThreat}
            </Text>
          </View>
        )}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: isLoading ? "0%" : `${displayScore}%`,
                  backgroundColor: scoreInfo.color,
                },
              ]}
            />
          </View>
        </View>

        {combinedError && <Text style={styles.errorText}>{combinedError}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EBF5FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 52,
  },
  scoreMax: {
    fontSize: 20,
    fontWeight: "500",
    color: "#9CA3AF",
    marginLeft: 4,
  },
  description: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 18,
    lineHeight: 22,
  },
  progressContainer: {
    width: "100%",
  },
  progressTrack: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 8,
  },
  lastUpdate: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    fontWeight: "500",
  },
  threatInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 16, // Added spacing between address/threat info and progress bar
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  threatText: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
    lineHeight: 16,
  },
});
