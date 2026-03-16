import { View, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from "react-native"
import { Text, useTheme, FAB } from "react-native-paper"
import ItineraryList from "../components/ItineraryList"
import { t } from "../../../context/translations"
import { useApp } from "../../../context/AppContext"
import { useRef, useState, useEffect } from "react"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { getGroupDashboard } from "../../../utils/api"

export type FilterType = "current" | "upcoming" | "completed"

import CreateGroupItineraryModal from "../components/CreateGroupItineraryModal"
import EditGroupItineraryModal from "../components/EditGroupItineraryModal"

export default function ItineraryScreen({ navigation }: any) {
  const { state, updateTripsFromBackend } = useApp()
  const theme = useTheme()
  const itineraryListRef = useRef<{ openNew: () => void } | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>("current")
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [groupData, setGroupData] = useState<any>(null);

  const isTourAdmin = state.user?.role === 'tour-admin';

  // Fetch trips for solo users
  useEffect(() => {
    if (state.token) {
      setLoadingTrips(true);
      updateTripsFromBackend()
        .catch((err) => {
          console.error("Failed to fetch trips:", err);
        })
        .finally(() => {
          setLoadingTrips(false);
        });
      
      // Fetch group data for tour-admins
      if (isTourAdmin) {
        getGroupDashboard(state.token)
          .then((data) => {
            if (data?.data) {
              setGroupData(data.data);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch group data:", err);
          });
      }
    }
  }, [state.token]);

  const handleCreateGroupItinerary = () => {
    setShowCreateModal(true);
  }

  const handleGroupCreated = () => {
    setShowCreateModal(false);
  }

  const handleEditItinerary = () => {
    if (groupData) {
      const startDate = groupData.startDate || new Date().toISOString()
      const endDate = groupData.endDate || new Date().toISOString()
      const start = new Date(startDate)
      const end = new Date(endDate)
      const tripDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 7

      navigation.navigate('BuildItinerary', {
        tripDuration,
        startDate,
        returnDate: endDate,
        touristId: state.user?.touristId || 'unknown',
        initialItinerary: groupData.itinerary || [],
      })
    }
  }

  const filters: { key: FilterType; label: string; icon: string }[] = [
    { key: "current", label: "Current", icon: "calendar-today" },
    { key: "upcoming", label: "Upcoming", icon: "clock-outline" },
    { key: "completed", label: "Completed", icon: "check-circle-outline" },
  ]

  // Always render Solo/Itinerary View
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header Section */}
      <View style={styles.headerSection}>
        {/* Title Row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>My Trips</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={[
                styles.filterPill,
                activeFilter === filter.key && styles.filterPillActive,
              ]}
            >
              <MaterialCommunityIcons
                name={filter.icon as any}
                size={16}
                color={activeFilter === filter.key ? "#FFFFFF" : "#64748B"}
              />
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Trip List */}
      <View style={styles.listContainer}>
        <ItineraryList ref={itineraryListRef} filter={activeFilter} loading={loadingTrips} />
      </View>

      {/* Floating Action Button - Edit Itinerary for Tour Admins */}
      {/* Commented out - Use Edit Trip button in cards instead */}
      {/* {isTourAdmin && groupData && (
        <FAB
          icon="pencil"
          style={styles.fab}
          onPress={handleEditItinerary}
          label="Edit Itinerary"
        />
      )} */}

      {/* Floating Action Button - Create Group Itinerary */}
      {/* Commented out - Users should use navigation flow instead */}
      {/* <TouchableOpacity style={styles.fab} onPress={handleCreateGroupItinerary}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity> */}

      {/* Edit Itinerary Button */}
      {/* Purple Edit Button Removed - Use Edit Trip button in cards instead */}
      {/* {state.user?.role === 'tour-admin' && state.trips.length > 0 && (
        <TouchableOpacity 
          style={styles.fabEdit} 
          onPress={() => setShowEditModal(true)}
        >
          <MaterialCommunityIcons name="pencil" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )} */}

      {/* Create Group Itinerary Modal */}
      <CreateGroupItineraryModal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        onSuccess={handleGroupCreated}
      />

      {/* Edit Group Itinerary Modal */}
      <EditGroupItineraryModal
        visible={showEditModal}
        onDismiss={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          // Refresh trips after updating
          if (state.token) {
            updateTripsFromBackend();
          }
        }}
        initialItinerary={state.trips.map((trip) => ({
          dayNumber: 1,
          date: trip.date,
          nodes: [
            {
              type: "visit" as const,
              name: trip.title,
              scheduledTime: "10:00",
              location: {
                type: "Point" as const,
                coordinates: [0, 0] as [number, number],
              },
            },
          ],
        }))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerSection: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#F8FAFC",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
    letterSpacing: -0.5,
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 6,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  filterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  listContainer: {
    flex: 1,
  },
 fab: {
    position: "absolute",
    right: 20,
    bottom: 110,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  fabEdit: {
    position: "absolute",
    right: 20,
    bottom: 180,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },})
