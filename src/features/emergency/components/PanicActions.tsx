import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import {
  Snackbar,
  Text,
  IconButton,
  Button,
  Card,
  Divider,
} from "react-native-paper";
import { useApp } from "../../../context/AppContext";
import { useLocation } from "../../../context/LocationContext";
import { t } from "../../../context/translations";
import { triggerSOS } from "../../../utils/api";
import { queueSOS } from "../../../utils/offlineQueue";
import { sendSMS } from "../../../utils/sms";
import { queueSMS } from "../../../utils/smsQueue";
<<<<<<< Updated upstream
import {
  Heart,
  Shield,
  Truck,
  Flame,
  Megaphone,
  ChevronRight,
  Wifi,
} from "lucide-react-native";
=======
import { MaterialCommunityIcons } from "@expo/vector-icons";
import touristSocketService from "../../../services/touristSocketService";
>>>>>>> Stashed changes

interface PanicActionsProps {
  onSOSTriggered?: () => void;
}

// Category Data Structure
const SOS_CATEGORIES = [
  {
    id: "medical",
    label: "Medical",
    color: "#3B82F6",
    icon: "medical-bag",
    subcategories: [
      "Injury",
      "Unconscious",
      "Severe Pain",
      "Allergic Reaction",
      "Heart Issue",
      "Other",
    ],
  },
  {
    id: "security",
    label: "Security",
    color: "#F59E0B",
    icon: "shield-alert",
    subcategories: [
      "Harassment",
      "Theft",
      "Being Followed",
      "Violence",
      "Suspicious Activity",
      "Other",
    ],
  },
  {
    id: "accident",
    label: "Accident",
    color: "#EF4444",
    icon: "car-emergency",
    subcategories: ["Car Crash", "Bike Accident", "Pedestrian", "Other"],
  },
  {
    id: "fire",
    label: "Fire",
    color: "#ea580c",
    icon: "fire-alert",
    subcategories: [
      "Building Fire",
      "Vehicle Fire",
      "Electrical",
      "Forest Fire",
    ],
  },
];

export default function PanicActions({
  onSOSTriggered,
}: PanicActionsProps = {}) {
  const { state } = useApp();
  const { currentLocation, currentAddress } = useLocation();
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({
    visible: false,
    msg: "",
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState(false);

  // False Alarm / Countdown State
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  // Selection State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");

  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Pulse ring animations
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Create staggered pulse animations
    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const p1 = createPulse(pulse1, 0);
    const p2 = createPulse(pulse2, 666);
    const p3 = createPulse(pulse3, 1333);

    p1.start();
    p2.start();
    p3.start();

    return () => {
      p1.stop();
      p2.stop();
      p3.stop();
    };
  }, []);

  // Countdown Logic
  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      countdownTimer.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isCountingDown && countdown === 0) {
      trigger("IMMEDIATE PANIC", true);
      setIsCountingDown(false);
    }

    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, [isCountingDown, countdown]);

  const handleSOSPress = () => {
    // Reset state when opening
    setSelectedCategory(null);
    setSubCategory(null);
    setCustomReason("");
    setModalVisible(true);
    setIsCountingDown(false);
    setCountdown(3);
  };

  const handleClose = () => {
    if (isCountingDown) {
      cancelCountdown();
      return;
    }
    setModalVisible(false);
  };

  const cancelCountdown = () => {
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    setIsCountingDown(false);
    setCountdown(3);
  };

  // Trigger from the IMMEDIATE button (Critical)
  const handleImmediateTrigger = () => {
    // Start countdown instead of immediate trigger
    setIsCountingDown(true);
    setCountdown(3); // 3 seconds to cancel
  };

  // Trigger from category flow
  const handleDetailedTrigger = () => {
    if (!selectedCategory || !subCategory) return;

    let label = `${selectedCategory.toUpperCase()}: ${subCategory}`;
    if (subCategory === "Other" && customReason) {
      label += ` - ${customReason}`;
    }

    trigger(label, false);
  };

  const trigger = async (label: string, isCritical: boolean = false) => {
    setModalVisible(false); // Close modal immediately

    let queuedThisPress = false;
    const currentToken = state.token;

    if (!currentToken) {
      setSnack({
        visible: true,
        msg: "You must be logged in to trigger an alert.",
      });
      return;
    }

    if (state.offline) {
      const sosData = {
        location: {
          coordinates: [
            currentLocation?.coords.longitude || 0,
            currentLocation?.coords.latitude || 0,
          ],
          locationName: currentAddress || "Current Location",
        },
        safetyScore:
          typeof state.computedSafetyScore === "number"
            ? state.computedSafetyScore
            : state.user?.safetyScore || 100,
        sosReason: {
          reason: label,
          weatherInfo: "N/A",
          extra: "queued-offline",
        },
      };
      // ... existing offline logic same as before ...
      try {
        await queueSOS({ token: currentToken, sosData });
        setSnack({ visible: true, msg: "Offline: queued alert " + label });
        queuedThisPress = true;
      } catch (e) {
        setSnack({ visible: true, msg: "Failed to queue alert locally." });
      }
      try {
        const recipients = [
          state.authorityPhone,
          ...state.contacts.map((c) => c.phone),
        ].filter(Boolean);
        if (recipients.length)
          await queueSMS({
            payload: { recipients, message: buildSmsMessage(label) },
          });
      } catch (e) {}
      return;
    }

    if (!currentLocation) {
      setSnack({ visible: true, msg: "Location not available." });
      return;
    }

    setLoading(true);
    try {
      const sosData = {
        location: {
          coordinates: [
            currentLocation.coords.longitude,
            currentLocation.coords.latitude,
          ],
          locationName: currentAddress || "Current Location",
        },
        safetyScore:
          typeof state.computedSafetyScore === "number"
            ? state.computedSafetyScore
            : state.user?.safetyScore || 100,
        sosReason: {
          reason: label,
          weatherInfo: "N/A",
          extra: isCritical ? "CRITICAL" : "N/A",
        },
      };

      console.log("[PanicActions] Triggering SOS:", label);
      await triggerSOS(currentToken, sosData);

      // Request immediate safety score recalculation after SOS trigger
      console.log(
        "[PanicActions] Requesting safety score update after SOS trigger",
      );
      touristSocketService.requestSafetyScoreUpdate();

      try {
        const recipients = [
          state.authorityPhone,
          ...state.contacts.map((c) => c.phone),
        ].filter(Boolean);
        if (recipients.length) {
          const message = buildSmsMessage(label);
          console.log("[PanicActions] Sending SOS SMS", {
            recipientsCount: recipients.length,
            firstRecipient: recipients[0],
          });
          const smsRes = await sendSMS({
            recipients,
            message,
          });
          console.log("[PanicActions] SMS send result", smsRes);
          if (!smsRes.ok) {
            console.log("[PanicActions] SMS send failed, queueing for retry");
            await queueSMS({
              payload: { recipients, message },
            });
            if (
              smsRes.reason === "permission_denied" ||
              smsRes.reason === "permission_never_ask_again"
            ) {
              setSnack({
                visible: true,
                msg: "SMS permission blocked. Enable SMS in App Settings to auto-send SOS messages.",
              });
            } else if (smsRes.reason === "direct_module_unavailable") {
              setSnack({
                visible: true,
                msg: "Android build update required. Reinstall dev build to enable auto SMS.",
              });
            }
          }
        }
      } catch (e) {
        console.warn("[PanicActions] SMS send threw", e);
      }

      setSnack({ visible: true, msg: "Alert sent: " + label });
      if (onSOSTriggered) onSOSTriggered();
    } catch (error: any) {
      // ... existing error handling ...
      try {
        if (!queuedThisPress) {
          const scoreToQueue =
            typeof state.computedSafetyScore === "number"
              ? state.computedSafetyScore
              : state.user?.safetyScore || 100;
          await queueSOS({
            token: currentToken,
            sosData: {
              location: {
                coordinates: [
                  currentLocation?.coords.longitude || 0,
                  currentLocation?.coords.latitude || 0,
                ],
                locationName: currentAddress || "Current Location",
              },
              safetyScore: scoreToQueue,
              sosReason: {
                reason: label,
                weatherInfo: "N/A",
                extra: "retry-on-fail",
              },
            },
          });
        }
        setSnack({
          visible: true,
          msg: "Network issue: alert queued for retry",
        });
      } catch (qe) {
        setSnack({
          visible: true,
          msg: error.message || "Failed to send or queue alert.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const buildSmsMessage = (label: string) => {
    // ... existing SMS builder ...
    const loc = currentLocation;
    const coords =
      loc && loc.coords
        ? `${loc.coords.latitude.toFixed(6)},${loc.coords.longitude.toFixed(6)}`
        : null;
    const name = state.user?.name || "Unknown Tourist";
    const phone = state.user?.phone || "";
    const addr = currentAddress || "";
    const score =
      typeof state.computedSafetyScore === "number"
        ? state.computedSafetyScore
        : typeof state.user?.safetyScore === "number"
          ? state.user!.safetyScore
          : null;
    const mapLink = coords ? `https://maps.google.com/?q=${coords}` : null;

    const parts = [] as string[];
    parts.push(`SOS Alert: ${label}`);
    parts.push(`Name: ${name}`);
    if (phone) parts.push(`Phone: ${phone}`);
    if (addr) parts.push(`Location: ${addr}`);
    if (mapLink) parts.push(`Map: ${mapLink}`);
    return parts.join("\n");
  };

  // Pulse interpolations - more diffused/blurred effect
  const createPulseStyle = (anim: Animated.Value) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.4], // Smaller pulse for compact design
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.35, 0.15, 0],
    }),
  });

  // ---- RENDER HELPERS ----

  const ICON_MAP: { [key: string]: any } = {
    medical: Heart,
    security: Shield,
    accident: Truck,
    fire: Flame,
  };

  const renderCategorySelection = () => (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Emergency Assistance</Text>
      <Text style={styles.modalSubtitle}>
        Select type of emergency to alert authorities
      </Text>

      {/* IMMEDIATE ACTION BUTTON */}
      <TouchableOpacity
        style={styles.immediateButton}
        onPress={handleImmediateTrigger}
        activeOpacity={0.8}
      >
        <View style={styles.immediateIconContainer}>
          <Megaphone size={32} color="#FFFFFF" />
        </View>
        <View style={styles.immediateTextContainer}>
          <Text style={styles.immediateTitle}>SEND IMMEDIATE HELP</Text>
          <Text style={styles.immediateSubtitle}>
            Critical emergency • No details needed
          </Text>
        </View>
        <ChevronRight size={24} color="#FFCDD2" />
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>Or select a reason:</Text>

      <View style={styles.gridContainer}>
        {SOS_CATEGORIES.map((cat) => {
          const IconComp = ICON_MAP[cat.id] || Shield;
          return (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryCard}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <IconComp
                size={28}
                color={cat.color}
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Button mode="text" onPress={handleClose} style={styles.cancelButton}>
        Cancel
      </Button>
    </View>
  );

  const renderSubCategorySelection = () => {
    const category = SOS_CATEGORIES.find((c) => c.id === selectedCategory);
    if (!category) return null;

    return (
      <View style={styles.modalContent}>
        <View style={styles.subHeaderRow}>
          <IconButton
            icon="arrow-left"
            onPress={() => {
              setSelectedCategory(null);
              setSubCategory(null);
            }}
          />
          <Text style={styles.subHeaderTitle}>{category.label} Emergency</Text>
        </View>

        <Text style={styles.questionText}>
          What kind of trouble are you in?
        </Text>

        <View style={styles.chipContainer}>
          {category.subcategories.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={[
                styles.chip,
                subCategory === sub && {
                  backgroundColor: category.color,
                  borderColor: category.color,
                },
              ]}
              onPress={() => setSubCategory(sub)}
            >
              <Text
                style={[
                  styles.chipText,
                  subCategory === sub && { color: "white" },
                ]}
              >
                {sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {subCategory === "Other" && (
          <TextInput
            style={styles.textInput}
            placeholder="Please specify nature of emergency..."
            value={customReason}
            onChangeText={setCustomReason}
            multiline
          />
        )}

        <Button
          mode="contained"
          style={[styles.confirmButton, { backgroundColor: category.color }]}
          disabled={!subCategory}
          onPress={handleDetailedTrigger}
        >
          SEND ALERT
        </Button>
      </View>
    );
  };

  const renderCountdown = () => (
    <View style={styles.modalContent}>
      <View style={styles.countdownContainer}>
        <View style={styles.countdownRing}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
        </View>
        <Text style={styles.sendingText}>SENDING EMERGENCY ALERT...</Text>
        <Text style={styles.cancelHint}>Tap below to cancel</Text>
      </View>

      <Button
        mode="contained"
        style={styles.cancelAlarmButton}
        labelStyle={styles.cancelAlarmText}
        icon="close"
        onPress={cancelCountdown}
      >
        CANCEL ALERT
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Compact SOS Button Widget */}
      <View style={styles.sosCompactWrapper}>
        <Animated.View style={[styles.pulseRing, createPulseStyle(pulse1)]} />
        <Animated.View style={[styles.pulseRing, createPulseStyle(pulse2)]} />

        <TouchableOpacity
          style={styles.sosCompactButton}
          onPress={handleSOSPress}
          activeOpacity={0.8}
        >
          <Wifi size={56} color="white" style={{ marginBottom: 8 }} />
          <Text style={styles.sosCompactText}>SOS</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.instructionText}>Tap for emergency options</Text>

      {/* Full Screen Modal for Options */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {isCountingDown
              ? renderCountdown()
              : selectedCategory
                ? renderSubCategorySelection()
                : renderCategorySelection()}
          </View>
        </View>
      </Modal>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: "" })}
        duration={3000}
      >
        {snack.msg}
      </Snackbar>
    </View>
  );
}

const BUTTON_SIZE = Math.round(Dimensions.get("window").width * 0.55); // 55% of screen width

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 12,
  },
  sosCompactWrapper: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "#EF4444",
  },
  sosCompactButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 4,
    borderColor: "#FFFFFF30",
  },
  sosCompactText: {
    fontSize: 40,
    fontWeight: "900",
    color: "white",
    letterSpacing: 2,
  },
  instructionText: {
    marginTop: 8,
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 500,
    padding: 24,
    paddingBottom: 40,
  },
  modalContent: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },

  // IMMEDIATE BUTTON
  immediateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  immediateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  immediateTextContainer: {
    flex: 1,
  },
  immediateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "white",
    marginBottom: 2,
  },
  immediateSubtitle: {
    fontSize: 12,
    color: "#FFCDD2",
    fontWeight: "500",
  },

  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },

  // GRID
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryCard: {
    width: "48%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    height: 100,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  cancelButton: {
    marginTop: 0,
    marginBottom: -12,
    alignSelf: "center",
  },

  // SUB CATEGORY
  subHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginLeft: -12,
  },
  subHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  questionText: {
    fontSize: 16,
    color: "#4B5563",
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  confirmButton: {
    marginTop: "auto",
    paddingVertical: 6,
    borderRadius: 12,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },

  // COUNTDOWN STYLES
  countdownContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  countdownRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  countdownNumber: {
    fontSize: 48,
    fontWeight: "900",
    color: "#EF4444",
  },
  sendingText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  cancelHint: {
    fontSize: 14,
    color: "#6B7280",
  },
  cancelAlarmButton: {
    marginTop: "auto",
    backgroundColor: "#9CA3AF",
    borderRadius: 12,
    paddingVertical: 8,
  },
  cancelAlarmText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
