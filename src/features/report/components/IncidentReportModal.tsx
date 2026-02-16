import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { reportIncident, IncidentType } from "../../../utils/incidentApi";
import { useApp } from "../../../context/AppContext";
import touristSocketService from "../../../services/touristSocketService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface IncidentReportModalProps {
  visible: boolean;
  onClose: () => void;
  onIncidentSubmitted?: () => void;
  latitude: number;
  longitude: number;
}

const INCIDENT_TYPES: {
  value: IncidentType;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    value: "theft",
    label: "Theft",
    icon: "bag-personal-off",
    color: "#8B5CF6",
  },
  {
    value: "assault",
    label: "Assault",
    icon: "account-alert",
    color: "#EF4444",
  },
  {
    value: "accident",
    label: "Accident",
    icon: "car-emergency",
    color: "#F59E0B",
  },
  { value: "riot", label: "Riot", icon: "account-group", color: "#DC2626" },
  {
    value: "natural_disaster",
    label: "Disaster",
    icon: "weather-hurricane",
    color: "#0EA5E9",
  },
  { value: "other", label: "Other", icon: "alert-circle", color: "#6B7280" },
];

export default function IncidentReportModal({
  visible,
  onClose,
  onIncidentSubmitted,
  latitude,
  longitude,
}: IncidentReportModalProps) {
  const { state } = useApp();
  const [title, setTitle] = useState("");
  const [selectedType, setSelectedType] = useState<IncidentType | undefined>(
    undefined,
  );
  const [severity, setSeverity] = useState(0.5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setSelectedType(undefined);
    setSeverity(0.5);
  };

  const handleSubmit = async () => {
    if (!latitude || !longitude) {
      Alert.alert(
        "Location Error",
        "Unable to get your current location. Please try again.",
      );
      return;
    }

    if (!state.token) {
      Alert.alert(
        "Authentication Error",
        "You must be logged in to report an incident.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await reportIncident(state.token, {
        title: title.trim() || undefined,
        type: selectedType,
        latitude,
        longitude,
        severity,
      });

      // Request immediate safety score recalculation after incident report
      console.log(
        "[IncidentReport] Requesting safety score update after incident report",
      );
      if (latitude && longitude) {
        touristSocketService.updateLocation({ lat: latitude, lng: longitude });
      }
      touristSocketService.requestSafetyScoreUpdate();

      Alert.alert(
        "Incident Reported",
        response.message || "Your report has been submitted successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              onClose();
              // Trigger immediate refresh in parent
              if (onIncidentSubmitted) {
                onIncidentSubmitted();
              }
            },
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to submit report. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const getSeverityLabel = (val: number) => {
    if (val < 0.33) return "Low";
    if (val < 0.66) return "Medium";
    return "High";
  };

  const getSeverityColor = (val: number) => {
    if (val < 0.33) return "#22C55E";
    if (val < 0.66) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons
                name="alert-octagon"
                size={24}
                color="#EF4444"
              />
            </View>
            <Text style={styles.headerTitle}>Report Incident</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleCancel}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Title Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Title (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Brief description of the incident..."
                placeholderTextColor="#9CA3AF"
                maxLength={100}
              />
            </View>

            {/* Incident Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Incident Type (Optional)</Text>
              <View style={styles.typeGrid}>
                {INCIDENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeBtn,
                      selectedType === type.value && {
                        borderColor: type.color,
                        backgroundColor: `${type.color}15`,
                      },
                    ]}
                    onPress={() =>
                      setSelectedType(
                        selectedType === type.value ? undefined : type.value,
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={24}
                      color={
                        selectedType === type.value ? type.color : "#6B7280"
                      }
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        selectedType === type.value && {
                          color: type.color,
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Severity Slider */}
            <View style={styles.section}>
              <View style={styles.severityHeader}>
                <Text style={styles.label}>Severity Level</Text>
                <Text
                  style={[
                    styles.severityValue,
                    { color: getSeverityColor(severity) },
                  ]}
                >
                  {getSeverityLabel(severity)}
                </Text>
              </View>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={severity}
                  onValueChange={setSeverity}
                  minimumTrackTintColor={getSeverityColor(severity)}
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor={getSeverityColor(severity)}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>Low</Text>
                  <Text style={styles.sliderLabel}>Medium</Text>
                  <Text style={styles.sliderLabel}>High</Text>
                </View>
              </View>
            </View>

            {/* Location Info */}
            <View style={styles.locationInfo}>
              <MaterialCommunityIcons
                name="map-marker"
                size={18}
                color="#3B82F6"
              />
              <Text style={styles.locationText}>
                Location: {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                isSubmitting && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="white" />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111827",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  typeBtn: {
    width: "48%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    gap: 8,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  severityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  severityValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  sliderContainer: {
    marginTop: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#FCA5A5",
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
});
