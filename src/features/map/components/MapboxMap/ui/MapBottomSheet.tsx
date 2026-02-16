import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useApp } from "../../../../../context/AppContext";
import { useLocation } from "../../../../../context/LocationContext";
import SafetyScoreCard from "../../../../dashboard/components/SafetyScoreCard";
import {
  fetchNearbyHelp,
  NearbyPOI,
} from "../../../services/mapboxSearchService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.65;

interface MapBottomSheetProps {
  isExpanded: boolean;
  onToggle: () => void;
  onShareLive?: () => void;
  onSOS?: () => void;
}

export default function MapBottomSheet({
  isExpanded,
  onToggle,
  onShareLive,
  onSOS,
}: MapBottomSheetProps) {
  const { state } = useApp();
  const { currentLocation: userLocation } = useLocation();

  // Nearby help from Mapbox API
  const [nearbyHelp, setNearbyHelp] = useState<NearbyPOI[]>([]);
  const [loading, setLoading] = useState(false);

  // Animation - slide up/down
  const translateY = useSharedValue(EXPANDED_HEIGHT);

  useEffect(() => {
    translateY.value = withTiming(isExpanded ? 0 : EXPANDED_HEIGHT, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      height: EXPANDED_HEIGHT,
    };
  });

  // Fetch nearby help when location changes or sheet expands
  useEffect(() => {
    const fetchHelp = async () => {
      if (!userLocation?.coords || !isExpanded) return;

      setLoading(true);
      try {
        const { latitude, longitude } = userLocation.coords;
        const results = await fetchNearbyHelp(latitude, longitude, 3);
        setNearbyHelp(results);
      } catch (error) {
        console.error("[MapBottomSheet] Error fetching help:", error);
        setNearbyHelp([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHelp();
  }, [
    userLocation?.coords?.latitude,
    userLocation?.coords?.longitude,
    isExpanded,
  ]);

  const handleCall = (poi: NearbyPOI) => {
    // Default emergency numbers based on category
    const phone = poi.category === "police" ? "100" : "108";
    Linking.openURL(`tel:${phone}`);
  };

  const handleDirections = (poi: NearbyPOI) => {
    const { lat, lon } = poi.coordinates;
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}`,
      android: `google.navigation:q=${lat},${lon}`,
    });
    if (url) Linking.openURL(url);
  };

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      pointerEvents={isExpanded ? "auto" : "none"}
    >
      {/* Handle */}
      <TouchableOpacity
        style={styles.handleContainer}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.handle} />
      </TouchableOpacity>

      {/* Safety Score Card */}
      <View style={styles.scoreCardWrapper}>
        <SafetyScoreCard />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.shareLiveBtn}
          onPress={onShareLive}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="broadcast" size={18} color="white" />
          <Text style={styles.shareLiveText}>Share Live</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sosBtn}
          onPress={onSOS}
          activeOpacity={0.8}
        >
          <Text style={styles.sosTextBold}>Incidents</Text>
        </TouchableOpacity>
      </View>

      {/* Nearby Help Section */}
      <View style={styles.expandedContent}>
        {/* Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Help</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {/* Help List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Finding nearby help...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.helpList}
            showsVerticalScrollIndicator={false}
          >
            {nearbyHelp.map((item, index) => (
              <View key={item.id || index} style={styles.helpItem}>
                {/* Icon */}
                <View
                  style={[
                    styles.helpIcon,
                    {
                      backgroundColor:
                        item.category === "police" ? "#EEF2FF" : "#FEF2F2",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      item.category === "police"
                        ? "shield-account"
                        : "hospital-box"
                    }
                    size={22}
                    color={item.category === "police" ? "#6366F1" : "#EF4444"}
                  />
                </View>

                {/* Info */}
                <View style={styles.helpInfo}>
                  <Text style={styles.helpName} numberOfLines={1}>
                    {item.name ||
                      (item.category === "police"
                        ? "Police Station"
                        : "Hospital")}
                  </Text>
                  <Text style={styles.helpDetails} numberOfLines={1}>
                    {item.address || "Unknown"} • {item.distance.toFixed(1)} km
                    away
                  </Text>
                </View>

                {/* Call Button */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleCall(item)}
                >
                  <MaterialCommunityIcons
                    name="phone"
                    size={20}
                    color="#22C55E"
                  />
                </TouchableOpacity>

                {/* Directions Button */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.directionsBtn]}
                  onPress={() => handleDirections(item)}
                >
                  <MaterialCommunityIcons
                    name="navigation-variant"
                    size={20}
                    color="#3B82F6"
                  />
                </TouchableOpacity>
              </View>
            ))}

            {nearbyHelp.length === 0 && !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No nearby help found</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 200,
    paddingBottom: 16,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  scoreCardWrapper: {
    paddingHorizontal: 16,
  },
  handle: {
    width: 48,
    height: 5,
    backgroundColor: "#D1D5DB",
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  shareLiveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  shareLiveText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  sosBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  sosTextBold: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  expandedContent: {
    flex: 1,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  helpList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  helpItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  helpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  helpInfo: {
    flex: 1,
  },
  helpName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  helpDetails: {
    fontSize: 13,
    color: "#6B7280",
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  directionsBtn: {
    backgroundColor: "#EFF6FF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
});
