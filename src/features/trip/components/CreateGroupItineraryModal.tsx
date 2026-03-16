import { useState } from "react";
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

interface CreateGroupItineraryModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export default function CreateGroupItineraryModal({
  visible,
  onDismiss,
  onSuccess,
}: CreateGroupItineraryModalProps) {
  const { state, createGroup } = useApp();
  const theme = useTheme();
  
  const [groupName, setGroupName] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days later
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Itinerary days
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
  }>>([
    {
      dayNumber: 1,
      date: new Date().toISOString(),
      nodes: [
        {
          type: "stay",
          name: "",
          scheduledTime: "12:00",
          location: {
            type: "Point",
            coordinates: [0, 0],
          },
        },
      ],
    },
  ]);

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      // Update first day's date
      if (days.length > 0) {
        const updatedDays = [...days];
        updatedDays[0].date = selectedDate.toISOString();
        setDays(updatedDays);
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
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
      // Renumber days
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

  const handleCreate = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name");
      return;
    }

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
      const result = await createGroup({
        groupName: groupName.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        itinerary: days,
      });

      if (result.ok) {
        // Reset form
        setGroupName("");
        setStartDate(new Date());
        setEndDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        setDays([
          {
            dayNumber: 1,
            date: new Date().toISOString(),
            nodes: [
              {
                type: "stay",
                name: "",
                scheduledTime: "12:00",
                location: {
                  type: "Point",
                  coordinates: [0, 0],
                },
              },
            ],
          },
        ]);
        onSuccess();
        onDismiss();
      } else {
        alert(result.message || "Failed to create group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Failed to create group. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
                name="account-group"
                size={24}
                color="#3B82F6"
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.modalTitle}>Create Group Itinerary</Text>
              <Text style={styles.modalSubtitle}>
                Plan your group trip together
              </Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Group Name */}
          <Text style={styles.label}>GROUP NAME</Text>
          <TextInput
            placeholder="e.g., GCET College Trip"
            value={groupName}
            onChangeText={setGroupName}
            style={styles.input}
            mode="outlined"
            outlineColor="#E5E7EB"
            activeOutlineColor="#3B82F6"
          />

          {/* Start Date */}
          <Text style={styles.label}>START DATE</Text>
          <TouchableOpacity onPress={() => setShowStartPicker(true)}>
            <TextInput
              value={formatDate(startDate)}
              editable={false}
              style={styles.input}
              mode="outlined"
              outlineColor="#E5E7EB"
              activeOutlineColor="#3B82F6"
              right={
                <TextInput.Icon
                  icon="calendar"
                  onPress={() => setShowStartPicker(true)}
                />
              }
            />
          </TouchableOpacity>

          {/* End Date */}
          <Text style={styles.label}>END DATE</Text>
          <TouchableOpacity onPress={() => setShowEndPicker(true)}>
            <TextInput
              value={formatDate(endDate)}
              editable={false}
              style={styles.input}
              mode="outlined"
              outlineColor="#E5E7EB"
              activeOutlineColor="#3B82F6"
              right={
                <TextInput.Icon
                  icon="calendar"
                  onPress={() => setShowEndPicker(true)}
                />
              }
            />
          </TouchableOpacity>

          {/* Itinerary Days */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>DAILY ITINERARY</Text>
            <TouchableOpacity onPress={addDay} style={styles.addDayButton}>
              <MaterialCommunityIcons
                name="plus-circle"
                size={20}
                color="#3B82F6"
              />
              <Text style={styles.addDayText}>Add Day</Text>
            </TouchableOpacity>
          </View>

          {days.map((day, dayIndex) => (
            <View key={dayIndex} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
                <Text style={styles.dayDate}>
                  {new Date(day.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
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
                    activeOutlineColor="#3B82F6"
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
                    activeOutlineColor="#3B82F6"
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
                  color="#3B82F6"
                />
                <Text style={styles.addNodeText}>Add Location</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Create Button */}
          <Button
            mode="contained"
            onPress={handleCreate}
            loading={saving}
            disabled={saving}
            style={styles.createButton}
            contentStyle={styles.createButtonContent}
          >
            Create Group
          </Button>
        </ScrollView>

        {/* Date Pickers */}
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleStartDateChange}
            minimumDate={new Date()}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleEndDateChange}
            minimumDate={startDate}
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
    backgroundColor: "#EFF6FF",
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
  input: {
    backgroundColor: "white",
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
    color: "#3B82F6",
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
    backgroundColor: "#3B82F6",
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
    color: "#3B82F6",
  },
  createButton: {
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: "#3B82F6",
  },
  createButtonContent: {
    paddingVertical: 8,
  },
});
