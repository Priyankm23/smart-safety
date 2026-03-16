import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import {
  Modal,
  Portal,
  TextInput,
  Text,
  Button,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApp } from "../../../context/AppContext";

interface EditGroupItineraryModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
  initialItinerary?: any[];
}

export default function EditGroupItineraryModal({
  visible,
  onDismiss,
  onSuccess,
  initialItinerary = [],
}: EditGroupItineraryModalProps) {
  const { state, updateGroupItinerary } = useApp();
  const theme = useTheme();
  const userRole = state.user?.role;

  const [days, setDays] = useState<Array<{
    dayNumber: number;
    date: string;
    nodes: Array<{
      type: "visit" | "stay" | "activity";
      name: string;
      scheduledTime: string;
      location: {
        type: "Point";
        coordinates: [number, number];
      };
    }>;
  }>>([]);
  
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDayIndex, setPickerDayIndex] = useState(0);

  // Initialize days from initial itinerary
  useEffect(() => {
    if (visible && initialItinerary.length > 0) {
      setDays(JSON.parse(JSON.stringify(initialItinerary))); // Deep copy
    }
  }, [visible, initialItinerary]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const updatedDays = [...days];
      updatedDays[pickerDayIndex].date = selectedDate.toISOString();
      setDays(updatedDays);
    }
  };

  const addDay = () => {
    const nextDayNumber = days.length + 1;
    const lastDate = new Date(days[days.length - 1].date);
    const nextDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);

    setDays([
      ...days,
      {
        dayNumber: nextDayNumber,
        date: nextDate.toISOString(),
        nodes: [
          {
            type: "visit",
            name: "",
            scheduledTime: "10:00",
            location: {
              type: "Point",
              coordinates: [0, 0],
            },
          },
        ],
      },
    ]);
  };

  const addNodeToDay = (dayIndex: number) => {
    const updatedDays = [...days];
    updatedDays[dayIndex].nodes.push({
      type: "visit",
      name: "",
      scheduledTime: "14:00",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });
    setDays(updatedDays);
  };

  const updateNode = (
    dayIndex: number,
    nodeIndex: number,
    field: "name" | "type" | "scheduledTime",
    value: any
  ) => {
    const updatedDays = [...days];
    updatedDays[dayIndex].nodes[nodeIndex][field] = value;
    setDays(updatedDays);
  };

  const removeDay = (dayIndex: number) => {
    if (days.length > 1) {
      const updatedDays = days.filter((_, index) => index !== dayIndex);
      updatedDays.forEach((day, index) => {
        day.dayNumber = index + 1;
      });
      setDays(updatedDays);
    }
  };

  const removeNode = (dayIndex: number, nodeIndex: number) => {
    const updatedDays = [...days];
    if (updatedDays[dayIndex].nodes.length > 1) {
      updatedDays[dayIndex].nodes = updatedDays[dayIndex].nodes.filter(
        (_, index) => index !== nodeIndex
      );
      setDays(updatedDays);
    }
  };

  const handleUpdate = async () => {
    // Validate that all nodes have names
    for (const day of days) {
      for (const node of day.nodes) {
        if (!node.name.trim()) {
          alert(`Please fill in all location names for Day ${day.dayNumber}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      let result;
      
      if (userRole === 'solo') {
        // Solo users: update via PUT /api/itinerary
        const { updateSoloItinerary } = await import('../../../utils/api');
        const response = await updateSoloItinerary(state.token, days);
        result = { ok: response.success, message: response.message };
      } else {
        // Group users: update via existing group endpoint
        result = await updateGroupItinerary(days);
      }

      if (result.ok) {
        onSuccess();
        onDismiss();
      } else {
        alert(result.message || "Failed to update itinerary");
      }
    } catch (error) {
      console.error("Error updating itinerary:", error);
      alert("Failed to update itinerary. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={24}
                color="#F97316"
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.modalTitle}>Edit Itinerary</Text>
              <Text style={styles.modalSubtitle}>
                Update your group's travel plan
              </Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Itinerary Days */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>ITINERARY</Text>
            <TouchableOpacity onPress={addDay} style={styles.addDayButton}>
              <MaterialCommunityIcons
                name="plus-circle"
                size={20}
                color="#F97316"
              />
              <Text style={styles.addDayText}>Add Day</Text>
            </TouchableOpacity>
          </View>

          {days.map((day, dayIndex) => (
            <View key={dayIndex} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
                <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                {days.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeDay(dayIndex)}
                    style={styles.removeDayButton}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={20}
                      color="#EF4444"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Edit Date Button */}
              <TouchableOpacity
                onPress={() => {
                  setPickerDayIndex(dayIndex);
                  setShowDatePicker(true);
                }}
                style={styles.dateButton}
              >
                <MaterialCommunityIcons
                  name="calendar-edit"
                  size={16}
                  color="#F97316"
                />
                <Text style={styles.dateButtonText}>Change Date</Text>
              </TouchableOpacity>

              {day.nodes.map((node, nodeIndex) => (
                <View key={nodeIndex} style={styles.nodeCard}>
                  <View style={styles.nodeHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        const types: Array<"visit" | "stay" | "activity"> = [
                          "visit",
                          "stay",
                          "activity",
                        ];
                        const currentIndex = types.indexOf(node.type);
                        const nextIndex = (currentIndex + 1) % types.length;
                        updateNode(dayIndex, nodeIndex, "type", types[nextIndex]);
                      }}
                      style={styles.typeButton}
                    >
                      <Text style={styles.typeText}>
                        {node.type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                    {day.nodes.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeNode(dayIndex, nodeIndex)}
                      >
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextInput
                    placeholder="Location name"
                    value={node.name}
                    onChangeText={(text) =>
                      updateNode(dayIndex, nodeIndex, "name", text)
                    }
                    style={styles.nodeInput}
                    mode="outlined"
                    outlineColor="#E5E7EB"
                    activeOutlineColor="#F97316"
                  />

                  <TextInput
                    placeholder="Time (e.g., 10:00)"
                    value={node.scheduledTime}
                    onChangeText={(text) =>
                      updateNode(dayIndex, nodeIndex, "scheduledTime", text)
                    }
                    style={styles.nodeInput}
                    mode="outlined"
                    outlineColor="#E5E7EB"
                    activeOutlineColor="#F97316"
                    left={<TextInput.Icon icon="clock-outline" />}
                  />
                </View>
              ))}

              <TouchableOpacity
                onPress={() => addNodeToDay(dayIndex)}
                style={styles.addNodeButton}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color="#F97316"
                />
                <Text style={styles.addNodeText}>Add Location</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Update Button */}
          <Button
            mode="contained"
            onPress={handleUpdate}
            loading={saving}
            disabled={saving}
            style={styles.updateButton}
            contentStyle={styles.updateButtonContent}
          >
            Update Itinerary
          </Button>
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={new Date(days[pickerDayIndex].date)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
          />
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginVertical: 40,
    borderRadius: 16,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  addDayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F97316",
  },
  dayCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },
  dayDate: {
    fontSize: 14,
    color: "#64748B",
    marginRight: 8,
  },
  removeDayButton: {
    padding: 4,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#F97316",
  },
  nodeCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  nodeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeButton: {
    backgroundColor: "#F97316",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
    letterSpacing: 0.5,
  },
  nodeInput: {
    backgroundColor: "white",
    marginBottom: 8,
  },
  addNodeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  addNodeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#F97316",
  },
  updateButton: {
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: "#F97316",
  },
  updateButtonContent: {
    paddingVertical: 8,
  },
});
