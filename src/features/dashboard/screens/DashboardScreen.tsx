import { ScrollView, View, StyleSheet, Alert } from "react-native";
import { Text, Avatar, Card, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useApp } from "../../../context/AppContext";
import { useLocation } from "../../../context/LocationContext";
import { reverseGeocode } from "../../map/components/MapboxMap/geoUtils";
import SafetyScore from "../components/SafetyScore";
import PanicActions from "../../emergency/components/PanicActions";
import Weather from "../components/Weather";
import { useEffect, useState, useRef } from "react";
import { getGroupDashboard } from "../../../utils/api";
import GroupStatusCard from "../../trip/components/GroupStatusCard";
import touristSocket, {
  TouristAlert,
  SafetyScoreAlert,
} from "../../../services/touristSocketService";
import * as Haptics from "expo-haptics";
import {
  configureNotificationHandler,
  scheduleNotification,
} from "../../../utils/notificationsCompat";

// Configure notifications for critical alerts
configureNotificationHandler();

export default function DashboardScreen({ navigation }: any) {
  const { state } = useApp();
  const { currentAddress, setCurrentLocation, setCurrentAddress } =
    useLocation();
  const [groupData, setGroupData] = useState<any>(null);

  const isTourAdmin = state.user?.role === "tour-admin";

  useEffect(() => {
    const fetchGroupData = async () => {
      if (state.user && state.user.role !== "solo" && state.token) {
        try {
          const data = await getGroupDashboard(state.token);
          if (data && data.group) {
            setGroupData(data.group);
          } else if (data && data.groupName) {
            setGroupData(data);
          } else if (data && data.data) {
            setGroupData(data.data);
          }
        } catch (e) {
          console.error("Failed to fetch group dashboard:", e);
        }
      }
    };

    fetchGroupData();
  }, [state.user, state.token]);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setCurrentLocation(location);

        const address = await reverseGeocode(
          location.coords.latitude,
          location.coords.longitude,
        );
        if (address) {
          setCurrentAddress(address);
        }
      } catch (err: any) {
        console.error("Dashboard location error:", err);
      }
    };

    fetchLocation();
  }, []);

  const handleEditItinerary = () => {
    if (groupData) {
      const startDate = groupData.startDate || new Date().toISOString();
      const endDate = groupData.endDate || new Date().toISOString();
      const start = new Date(startDate);
      const end = new Date(endDate);
      const tripDuration =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) ||
        7;

      navigation.navigate("BuildItinerary", {
        tripDuration,
        startDate,
        returnDate: endDate,
        touristId: state.user?.touristId || "unknown",
        initialItinerary: groupData.itinerary || [],
      });
    }
  };

  const getLocationDisplay = () => {
    if (currentAddress) {
      const parts = currentAddress.split(",");
      if (parts.length >= 2) {
        return parts
          .slice(-2)
          .map((s) => s.trim())
          .join(", ");
      }
      return currentAddress;
    }
    return "Getting location...";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getUserName = () => {
    if (state.user?.name) {
      return state.user.name.split(" ")[0];
    }
    return "Explorer";
  };

  const getUserInitials = () => {
    if (state.user?.name) {
      const names = state.user.name.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    return "E";
  };

  const getAvatarColor = () => {
    const colors = [
      "#3B82F6",
      "#EF4444",
      "#10B981",
      "#F59E0B",
      "#8B5CF6",
      "#EC4899",
    ];
    const name = state.user?.name || "Explorer";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // --- Socket Logic ---
  const [alerts, setAlerts] = useState<TouristAlert[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Function to get current location for periodic updates
  const getLocationForUpdates = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        return { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
    } catch (e) {
      console.error("Error getting location:", e);
    }
    return null;
  };

  useEffect(() => {
    let statusInterval: NodeJS.Timeout | null = null;

    const initializeSocket = async () => {
      const touristId = state.user?.touristId || "guest";

      let coords = { lat: 0, lng: 0 };
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      } catch (e) {
        console.error("Error getting location:", e);
      }

      touristSocket.connect(touristId, coords);

      // Start real-time location tracking for safety score updates
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          console.log(
            "📍 Starting real-time location tracking for safety score",
          );
          const sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000, // Check every 5 seconds
              distanceInterval: 100, // Update every 100 meters
            },
            (loc) => {
              console.log("📍 Location changed, sending update to backend");
              // Update global context so map updates immediately
              setCurrentLocation(loc);

              touristSocket.updateLocation({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
              });
            },
          );
          locationSubRef.current = sub;
        }
      } catch (e) {
        console.log("Error starting location watch", e);
        // Fallback to periodic if watch fails
        touristSocket.startPeriodicLocationUpdates(getLocationForUpdates);
      }

      // Check connection status periodically
      statusInterval = setInterval(() => {
        setSocketConnected(touristSocket.getConnectionStatus());
      }, 2000);

      // Listen for authority alerts
      touristSocket.onAuthorityAlert((alertData) => {
        handleIncomingAlert(alertData);
      });

      // Listen for safety score alerts
      touristSocket.onSafetyScoreAlert((alertData) => {
        handleSafetyScoreAlert(alertData);
      });
    };

    if (state.user) {
      initializeSocket();
    }

    return () => {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      if (statusInterval) {
        clearInterval(statusInterval);
      }
      touristSocket.disconnect();
    };
  }, [state.user]);

  const handleIncomingAlert = async (alertData: TouristAlert) => {
    setAlerts((prev) => [alertData, ...prev]);

    // 6 min expiration (persist for 6 minutes)
    setTimeout(
      () => {
        setAlerts((prev) =>
          prev.filter((a) => a.alertId !== alertData.alertId),
        );
      },
      6 * 60 * 1000,
    );

    // Function to send notification
    const sendNotification = async () => {
      await scheduleNotification({
        content: {
          title: `🚨 ${alertData.title}`,
          body: alertData.message,
          data: alertData,
        },
        trigger: null,
      });
    };

    // Schedule notifications: Immediate, 2 min, 4 min
    // 1. Immediate
    await sendNotification();

    // 2. After 2 minutes
    setTimeout(
      () => {
        // Check if alert is still relevant (optional, but good practice)
        sendNotification();
      },
      2 * 60 * 1000,
    );

    // 3. After 4 minutes
    setTimeout(
      () => {
        sendNotification();
      },
      4 * 60 * 1000,
    );
  };

  const handleSafetyScoreAlert = async (alertData: SafetyScoreAlert) => {
    // Haptic feedback for critical changes
    if (
      alertData.changeType === "critical_threshold" ||
      alertData.changeType === "significant_drop"
    ) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    // Show notification
    await scheduleNotification({
      content: {
        title:
          alertData.changeType === "significant_drop"
            ? "⚠️ Safety Score Decreased"
            : "✅ Safety Score Improved",
        body: `${alertData.message}\nScore changed: ${alertData.previousScore} → ${alertData.newScore}`,
        data: alertData,
      },
      trigger: null,
    });

    // Show in-app alert for critical changes
    if (alertData.changeType === "critical_threshold") {
      Alert.alert(
        "⚠️ Safety Alert",
        `Your safety score has dropped significantly to ${alertData.newScore}.\n\n${alertData.message}`,
        [
          { text: "Dismiss", style: "cancel" },
          {
            text: "View Details",
            onPress: () => {},
          },
        ],
      );
    }
  };

  const getAlertPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "#EF4444";
      case "high":
        return "#F97316";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContentFull}>
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.userName}>{getUserName()}</Text>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={14}
                color="#EF4444"
              />
              <Text style={styles.location} numberOfLines={1}>
                {getLocationDisplay()}
              </Text>
            </View>
            <View style={styles.connectionStatus}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: socketConnected ? "#10B981" : "#EF4444" },
                ]}
              />
              <Text style={styles.statusText}>
                {socketConnected ? "Live Alerts Active" : "Connecting..."}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sosSection}>
          <PanicActions />
        </View>

        {groupData && (
          <View style={styles.section}>
            <GroupStatusCard
              groupName={groupData.groupName || groupData.name || "My Group"}
              accessCode={groupData.accessCode || "Unknown"}
              memberCount={groupData.members ? groupData.members.length : 1}
              isTourAdmin={isTourAdmin}
              onEditItinerary={handleEditItinerary}
            />
          </View>
        )}

        <View style={styles.section}>
          <SafetyScore />
        </View>

        <View style={styles.section}>
          <Weather />
        </View>

        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="titleMedium"
              style={{ marginBottom: 10, fontWeight: "bold" }}
            >
              Active Alerts
            </Text>
            {alerts.map((alert) => (
              <Card
                key={alert.alertId}
                style={{
                  marginBottom: 10,
                  borderLeftWidth: 5,
                  borderLeftColor: getAlertPriorityColor(alert.priority),
                }}
              >
                <Card.Content>
                  <Text variant="titleSmall" style={{ fontWeight: "bold" }}>
                    {alert.title}
                  </Text>
                  <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                    {alert.message}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <Text variant="bodySmall" style={{ color: "#666" }}>
                      {alert.authorityName}
                    </Text>
                    <Text variant="bodySmall" style={{ color: "#666" }}>
                      {new Date(alert.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  {alert.actionRequired && (
                    <Text
                      variant="labelMedium"
                      style={{
                        marginTop: 8,
                        color: getAlertPriorityColor(alert.priority),
                        fontWeight: "bold",
                      }}
                    >
                      Action: {alert.actionRequired}
                    </Text>
                  )}
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#FAF8F5",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 110,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  avatar: {
    marginRight: 14,
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerContent: {
    flex: 1,
  },
  headerContentFull: {
    flex: 1,
    marginLeft: 0,
  },
  greetingText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    flex: 1,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  sosSection: {
    alignItems: "center",
  },
  section: {
    width: "100%",
  },
});
