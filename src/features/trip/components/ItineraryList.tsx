import { useState, forwardRef, useImperativeHandle } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  TextInput as RNTextInput,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Button,
  IconButton,
  Modal,
  Portal,
  TextInput,
  Text,
  useTheme,
  Switch,
} from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../../../context/AppContext";
import { t } from "../../../context/translations";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { FilterType } from "../screens/ItineraryScreen";
import ItinerarySkeleton from "./ItinerarySkeleton";
import EditGroupItineraryModal from "./EditGroupItineraryModal";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 40;

// Placeholder destination images
const destinationImages: { [key: string]: string } = {
  default: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
  mountain:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
  city: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800",
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
  santorini:
    "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800",
};

const getImageForDestination = (title: string): string => {
  const lowerTitle = title.toLowerCase();
  for (const [key, url] of Object.entries(destinationImages)) {
    if (lowerTitle.includes(key)) return url;
  }
  // Rotate through images based on title hash
  const hash = title
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageKeys = Object.keys(destinationImages);
  return destinationImages[imageKeys[hash % imageKeys.length]];
};

// Helper function to format time from 24hr (HH:MM) to 12hr (h:MM AM/PM)
const formatTime = (time: string): string => {
  if (!time || typeof time !== 'string') return 'TBD';
  
  // Handle HH:MM format
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert 0 to 12
    return `${hours}:${minutes} ${ampm}`;
  }
  
  return time;
};

// Helper function to calculate current day index based on trip start date
const getCurrentDayIndex = (tripStartDate: string, totalDays: number): number => {
  const tripStart = new Date(tripStartDate);
  const today = new Date();
  
  // Reset time to midnight for accurate day comparison
  tripStart.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  // Calculate days difference
  const daysDiff = Math.floor((today.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // Clamp between 0 and last day index (0-based)
  return Math.max(0, Math.min(daysDiff, totalDays - 1));
};

interface ItineraryListProps {
  filter?: FilterType;
  loading?: boolean;
}

type TripItem = {
  id: string;
  title: string;
  date: string;
  notes?: string;
  dayWiseItinerary?: Array<{
    dayNumber: number;
    date: string;
    nodes: Array<{
      type: string;
      name: string;
      locationName: string;
      lat: number;
      lng: number;
      scheduledTime: string;
      activityDetails?: string;
    }>;
  }>;
};

const ItineraryList = forwardRef<{ openNew: () => void }, ItineraryListProps>(
  ({ filter = "current", loading = false }, ref) => {
    const { state, addTrip, updateTrip, removeTrip, updateTripsFromBackend } = useApp();
    const navigation = useNavigation();
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    const [isExtending, setIsExtending] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");
    const [notifyAuthorities, setNotifyAuthorities] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<"start" | "end">("start");
    const [saving, setSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [showDayWiseEditModal, setShowDayWiseEditModal] = useState(false);
    const [editingItinerary, setEditingItinerary] = useState<any[]>([]);
    const [expandedTripId, setExpandedTripId] = useState<string | null>(null); // Track which trip's itinerary is expanded

    // Check if user is a group member (read-only access)
    const isGroupMember = state.user?.role === 'group-member';

      useImperativeHandle(ref, () => ({
      openNew: () => {
        setEditingId(null);
        setIsExtending(false);
        setTitle("");
        setDate("");
        setEndDate("");
        setNotes("");
        setNotifyAuthorities(false);
        setVisible(true);
      },
    }));

      const openEdit = (trip: TripItem) => {
        if (state.user?.role === 'tour-admin') {
          const itinerary = Array.isArray(trip.dayWiseItinerary) ? trip.dayWiseItinerary : [];
          const range = getTripDateRange(trip);
          const start = range.startDate || new Date(itinerary[0]?.date || trip.date || new Date().toISOString());
          const end = range.endDate || new Date(itinerary[itinerary.length - 1]?.date || start);
          const dayMs = 1000 * 60 * 60 * 24;
          const diffDays = Math.ceil((end.getTime() - start.getTime()) / dayMs);
          const tripDuration = itinerary.length > 0 ? itinerary.length : Math.max(1, diffDays || 0);

          (navigation as any).navigate('BuildItinerary', {
            tripDuration,
            startDate: start.toISOString(),
            returnDate: end.toISOString(),
            touristId: state.user?.touristId || 'unknown',
            initialItinerary: itinerary,
          });
          return;
        }

        setEditingId(trip.id);
        
        // If trip has day-wise itinerary, use the detailed modal
        if (trip.dayWiseItinerary && trip.dayWiseItinerary.length > 0) {
          setEditingItinerary(trip.dayWiseItinerary);
          setShowDayWiseEditModal(true);
        } else {
          // Otherwise use simple modal
          setIsExtending(false);
          setTitle(trip.title);
          // Format the date if it's an ISO string
          try {
            const dateObj = new Date(trip.date);
            setDate(dateObj.toISOString().split('T')[0]); // Store as YYYY-MM-DD
          } catch (e) {
            setDate(trip.date);
          }
          setEndDate("");
          setNotes(trip.notes || "");
          setNotifyAuthorities(false);
          setVisible(true);
        }
      };

      const openExtend = (id: string, ttitle: string, d: string, n?: string) => {
      setEditingId(id);
      setIsExtending(true);
      setTitle(ttitle);
      setDate(d);
      setEndDate("01/28/2025"); // Default mock date
      setNotes(""); // Reason
      setNotifyAuthorities(false);
      setVisible(true);
    };

      const handleDateChange = (event: any, selectedDate?: Date) => {
      setShowDatePicker(false);
      if (selectedDate) {
        if (pickerMode === "start") {
          const formattedDate = selectedDate.toISOString().split("T")[0];
          setDate(formattedDate);
        } else {
          const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
          const dd = String(selectedDate.getDate()).padStart(2, "0");
          const yyyy = selectedDate.getFullYear();
          const displayFormat = `${mm}/${dd}/${yyyy}`;
          setEndDate(displayFormat);
        }
      }
    };

    const openDatePicker = (mode: "start" | "end") => {
      setPickerMode(mode);
      setShowDatePicker(true);
    };

    const save = async () => {
      setSaving(true);
      try {
        if (isExtending) {
          if (editingId) {
            const updatedNotes = notes
              ? `${state.trips.find((t) => t.id === editingId)?.notes || ""}\nExtended Reason: ${notes}`
              : undefined;
            await updateTrip(editingId, { date: endDate, notes: updatedNotes });
          }
        } else {
          if (editingId) {
            await updateTrip(editingId, { title, date, notes });
          } else {
            await addTrip({ title, date, notes });
          }
        }
        setVisible(false);
      } catch (error) {
        console.error("Failed to save trip:", error);
      } finally {
        setSaving(false);
      }
    };

    const formatDate = (dateString: string) => {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return dateString;
      }
    };

    const formatDateRange = (startDate: string, endDate?: string) => {
      const start = formatDate(startDate);
      if (endDate) {
        const end = formatDate(endDate);
        return `${start} - ${end}`;
      }
      return start;
    };

    const getTripDateRange = (trip: { date?: string; dayWiseItinerary?: any[] }) => {
      const startDate = trip.date ? new Date(trip.date) : null;
      const endDate = trip.dayWiseItinerary && trip.dayWiseItinerary.length > 0
        ? new Date(trip.dayWiseItinerary[trip.dayWiseItinerary.length - 1].date)
        : startDate;

      return { startDate, endDate };
    };

    const isUpcoming = (trip: { date?: string; dayWiseItinerary?: any[] }) => {
      const { startDate, endDate } = getTripDateRange(trip);
      if (!startDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = endDate ? new Date(endDate) : start;
      end.setHours(23, 59, 59, 999);

      return today <= end;
    };

    const isCurrent = (trip: { date?: string; dayWiseItinerary?: any[] }) => {
      const { startDate, endDate } = getTripDateRange(trip);
      if (!startDate || !endDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      return today >= start && today <= end;
    };

    const isFuture = (trip: { date?: string; dayWiseItinerary?: any[] }) => {
      const { startDate } = getTripDateRange(trip);
      if (!startDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      return start > today;
    };

    const isPast = (trip: { date?: string; dayWiseItinerary?: any[] }) => {
      const { endDate } = getTripDateRange(trip);
      if (!endDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      return end < today;
    };

    const getStatus = (trip: { date?: string; dayWiseItinerary?: any[] }): "upcoming" | "completed" => {
      return isUpcoming(trip) ? "upcoming" : "completed";
    };

    // Filter trips based on active filter
    const filteredTrips = state.trips.filter((trip) => {
      if (filter === "current") return isCurrent(trip);
      if (filter === "upcoming") return isFuture(trip);
      if (filter === "completed") return isPast(trip);
      return true;
    });

    const renderTripCard = (trip: TripItem) => {
      const status = getStatus(trip);
      const imageUrl = getImageForDestination(trip.title);

      return (
        <View key={trip.id} style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Image with gradient overlay */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.7)"]}
                style={styles.imageGradient}
              />

              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  status === "upcoming"
                    ? styles.upcomingBadge
                    : styles.completedBadge,
                ]}
              >
                <Text style={styles.statusText}>
                  {status === "upcoming" ? "ACTIVE" : "COMPLETED"}
                </Text>
              </View>

              {/* Destination info on image */}
              <View style={styles.imageContent}>
                <Text style={styles.destinationTitle}>{trip.title}</Text>
                <View style={styles.dateRow}>
                  <MaterialCommunityIcons
                    name="calendar-blank"
                    size={16}
                    color="white"
                  />
                  <Text style={styles.dateText}>
                    {formatDateRange(trip.date)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Progress Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>PROGRESS</Text>
                <Text style={styles.daysLeft}>
                  {isUpcoming(trip) ? "Upcoming" : "Completed"}
                </Text>
              </View>
              <Text style={styles.progressText}>
                {trip.notes || "Add trip details"}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: isPast(trip) ? "100%" : "70%" },
                  ]}
                />
              </View>

              {/* View Itinerary Button - Only for group members with multiple days */}
              {isGroupMember && trip.dayWiseItinerary && trip.dayWiseItinerary.length > 1 && (
                <TouchableOpacity
                  style={styles.viewItineraryButton}
                  onPress={() => {
                    // Toggle expanded state
                    setExpandedTripId(expandedTripId === trip.id ? null : trip.id);
                  }}
                >
                  <MaterialCommunityIcons
                    name="calendar-check"
                    size={18}
                    color="#3B82F6"
                  />
                  <Text style={styles.viewItineraryButtonText}>
                    {expandedTripId === trip.id ? 'Show Today Only' : 'Show All Days'}
                  </Text>
                  <MaterialCommunityIcons
                    name={expandedTripId === trip.id ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#3B82F6"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Action Buttons - Only show for non-group-members */}
            {!isGroupMember && (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEdit(trip)}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={18}
                    color="#374151"
                  />
                  <Text style={styles.editButtonText}>Edit Trip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.extendButton}
                  onPress={() => openExtend(trip.id, trip.title, trip.date, trip.notes)}
                >
                  <MaterialCommunityIcons
                    name="calendar-refresh"
                    size={18}
                    color="#3B82F6"
                  />
                  <Text style={styles.extendButtonText}>Extend Stay</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Detailed Itinerary View */}
          {trip.dayWiseItinerary && trip.dayWiseItinerary.length > 0 && (
            <View style={styles.detailsContainer}>
              <View style={styles.planCard}>
                {/* For group members: show current day by default, all days when expanded */}
                {/* For others (admins/solo): always show all days */}
                {isGroupMember ? (
                  <>
                    {expandedTripId === trip.id ? (
                      // Show ALL days when expanded
                      <>
                        <Text style={styles.planTitle}>Complete Day-wise Itinerary</Text>
                        {trip.dayWiseItinerary.map((day, dayIndex) => {
                          const currentDayIdx = getCurrentDayIndex(trip.date, trip.dayWiseItinerary.length);
                          const isToday = dayIndex === currentDayIdx;
                          
                          return (
                            <View key={dayIndex} style={styles.daySection}>
                              {/* Day Header */}
                              <View style={[styles.dayHeader, isToday && styles.todayHeader]}>
                                <MaterialCommunityIcons 
                                  name="calendar-today" 
                                  size={20} 
                                  color={isToday ? "#22C55E" : "#3B82F6"} 
                                />
                                <Text style={[styles.dayTitle, isToday && styles.todayTitle]}>
                                  Day {day.dayNumber}
                                  {isToday && " (Today)"}
                                </Text>
                                <Text style={styles.dayDate}>
                                  {new Date(day.date).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </Text>
                              </View>

                              {/* Day's activities */}
                              {day.nodes.map((node, nodeIndex) => {
                                const isLast = nodeIndex === day.nodes.length - 1;
                                const colors = ['#22C55E', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899'];
                                const dotColor = colors[nodeIndex % colors.length];

                                return (
                                  <View key={nodeIndex} style={styles.timelineItem}>
                                    <View style={styles.timelineLeft}>
                                      <View
                                        style={[styles.timelineDot, { backgroundColor: dotColor }]}
                                      />
                                      {!isLast && <View style={styles.timelineLine} />}
                                    </View>
                                    <View style={styles.timelineContent}>
                                      <Text style={styles.timelineTime}>
                                        {formatTime(node.scheduledTime)}
                                      </Text>
                                      <Text style={styles.timelineTitle}>{node.name}</Text>
                                      <Text style={styles.timelineSubtitle}>
                                        {node.locationName}
                                      </Text>
                                      {node.activityDetails && (
                                        <Text style={styles.timelineDetails}>
                                          {node.activityDetails}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })}
                      </>
                    ) : (
                      // Show ONLY current day by default
                      <>
                        <Text style={styles.planTitle}>Today's Itinerary</Text>
                        {(() => {
                          const currentDayIdx = getCurrentDayIndex(trip.date, trip.dayWiseItinerary.length);
                          const currentDay = trip.dayWiseItinerary[currentDayIdx];
                          
                          if (!currentDay) return null;
                          
                          return (
                            <View style={styles.daySection}>
                              {/* Day Header */}
                              <View style={[styles.dayHeader, styles.todayHeader]}>
                                <MaterialCommunityIcons 
                                  name="calendar-today" 
                                  size={20} 
                                  color="#22C55E" 
                                />
                                <Text style={[styles.dayTitle, styles.todayTitle]}>
                                  Day {currentDay.dayNumber}
                                </Text>
                                <Text style={styles.dayDate}>
                                  {new Date(currentDay.date).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </Text>
                              </View>

                              {/* Day's activities */}
                              {currentDay.nodes.map((node, nodeIndex) => {
                                const isLast = nodeIndex === currentDay.nodes.length - 1;
                                const colors = ['#22C55E', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899'];
                                const dotColor = colors[nodeIndex % colors.length];

                                return (
                                  <View key={nodeIndex} style={styles.timelineItem}>
                                    <View style={styles.timelineLeft}>
                                      <View
                                        style={[styles.timelineDot, { backgroundColor: dotColor }]}
                                      />
                                      {!isLast && <View style={styles.timelineLine} />}
                                    </View>
                                    <View style={styles.timelineContent}>
                                      <Text style={styles.timelineTime}>
                                        {formatTime(node.scheduledTime)}
                                      </Text>
                                      <Text style={styles.timelineTitle}>{node.name}</Text>
                                      <Text style={styles.timelineSubtitle}>
                                        {node.locationName}
                                      </Text>
                                      {node.activityDetails && (
                                        <Text style={styles.timelineDetails}>
                                          {node.activityDetails}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </>
                    )}
                  </>
                ) : (
                  // For non-group members: always show all days
                  <>
                    <Text style={styles.planTitle}>Day-wise Itinerary</Text>
                    {trip.dayWiseItinerary.map((day, dayIndex) => (
                      <View key={dayIndex} style={styles.daySection}>
                        {/* Day Header */}
                        <View style={styles.dayHeader}>
                          <MaterialCommunityIcons 
                            name="calendar-today" 
                            size={20} 
                            color="#3B82F6" 
                          />
                          <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
                          <Text style={styles.dayDate}>
                            {new Date(day.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </Text>
                        </View>

                        {/* Day's activities */}
                        {day.nodes.map((node, nodeIndex) => {
                          const isLast = nodeIndex === day.nodes.length - 1;
                          const colors = ['#22C55E', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899'];
                          const dotColor = colors[nodeIndex % colors.length];

                          return (
                            <View key={nodeIndex} style={styles.timelineItem}>
                              <View style={styles.timelineLeft}>
                                <View
                                  style={[styles.timelineDot, { backgroundColor: dotColor }]}
                                />
                                {!isLast && <View style={styles.timelineLine} />}
                              </View>
                              <View style={styles.timelineContent}>
                                <Text style={styles.timelineTime}>
                                  {formatTime(node.scheduledTime)}
                                </Text>
                                <Text style={styles.timelineTitle}>{node.name}</Text>
                                <Text style={styles.timelineSubtitle}>
                                  {node.locationName}
                                </Text>
                                {node.activityDetails && (
                                  <Text style={styles.timelineDetails}>
                                    {node.activityDetails}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      );
    };

    const showHistorySection = filter === "completed";
    const primaryTrips = showHistorySection ? [] : filteredTrips;

    return (
      <View style={styles.container}>
        {loading ? (
          <ItinerarySkeleton />
        ) : filteredTrips.length === 0 ? (
          <View style={styles.emptyContainer}>
            {/* Premium Illustration Area */}
            <View style={styles.emptyIllustration}>
              <LinearGradient
                colors={["#EEF2FF", "#E0E7FF"]}
                style={styles.emptyIconOuter}
              >
                <View style={styles.emptyIconInner}>
                  <MaterialCommunityIcons
                    name="airplane"
                    size={48}
                    color="#6366F1"
                  />
                </View>
              </LinearGradient>

              {/* Decorative elements */}
              <View style={[styles.emptyDot, styles.emptyDot1]} />
              <View style={[styles.emptyDot, styles.emptyDot2]} />
              <View style={[styles.emptyDot, styles.emptyDot3]} />
            </View>

            {/* Content */}
            <Text style={styles.emptyTitle}>
              {filter === "current" ? "No current trips yet" : `No ${filter} trips yet`}
            </Text>
            <Text style={styles.emptySubtitle}>
              Plan your next adventure and stay safe{"\n"}with real-time safety updates
            </Text>

            {/* Features pill */}
            <View style={styles.emptyFeatures}>
              <View style={styles.emptyFeaturePill}>
                <MaterialCommunityIcons name="shield-check" size={14} color="#22C55E" />
                <Text style={styles.emptyFeatureText}>Safety Alerts</Text>
              </View>
              <View style={styles.emptyFeaturePill}>
                <MaterialCommunityIcons name="calendar-check" size={14} color="#3B82F6" />
                <Text style={styles.emptyFeatureText}>Trip Tracking</Text>
              </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={() => {
                setEditingId(null);
                setTitle("");
                setDate("");
                setNotes("");
                setVisible(true);
              }}
            >
              <LinearGradient
                colors={["#F97316", "#FB923C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyButtonGradient}
              >
                <MaterialCommunityIcons name="plus" size={22} color="white" />
                <Text style={styles.emptyButtonText}>Add Your First Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {primaryTrips.map(renderTripCard)}

            {showHistorySection && filteredTrips.length > 0 && (
              <View style={styles.historySection}>
                {showHistory &&
                  filteredTrips.map((trip) => (
                      <View key={trip.id} style={styles.historyCard}>
                        <Image
                          source={{ uri: getImageForDestination(trip.title) }}
                          style={styles.historyThumb}
                        />
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyTripTitle}>
                            {trip.title}
                          </Text>
                          <Text style={styles.historyTripDate}>
                            {formatDateRange(trip.date)}
                          </Text>
                        </View>
                        <View style={styles.historyBadge}>
                          <Text style={styles.historyBadgeText}>COMPLETED</Text>
                        </View>
                      </View>
                    ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Add/Edit Modal */}
        <Portal>
          <Modal
            visible={visible}
            onDismiss={() => setVisible(false)}
            contentContainerStyle={styles.modalContainer}
          >
            {isExtending ? (
              <>
                <View style={styles.modalHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="calendar-edit"
                      size={24}
                      color="#3B82F6"
                    />
                    <Text style={styles.modalTitle}>Request Extension</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>NEW END DATE</Text>
                <TouchableOpacity onPress={() => openDatePicker("end")}>
                  <TextInput
                    value={endDate}
                    editable={false} // Make it read-only, click handled by TouchableOpacity
                    style={styles.cleanInput}
                    mode="outlined"
                    outlineColor="#E5E7EB"
                    activeOutlineColor="#3B82F6"
                    right={
                      <TextInput.Icon
                        icon="calendar"
                        onPress={() => openDatePicker("end")}
                      />
                    }
                  />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>REASON FOR EXTENSION</Text>
                <TextInput
                  placeholder="e.g., Flight delayed, enjoying the city..."
                  value={notes}
                  onChangeText={setNotes}
                  style={styles.cleanInput}
                  mode="outlined"
                  outlineColor="#E5E7EB"
                  activeOutlineColor="#3B82F6"
                />

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Notify authorities</Text>
                    <Text style={styles.toggleSubLabel}>
                      Update local safety registry
                    </Text>
                  </View>
                  <Switch
                    value={notifyAuthorities}
                    onValueChange={setNotifyAuthorities}
                    color="#3B82F6"
                  />
                </View>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={save}
                  disabled={loading}
                >
                  <Text style={styles.confirmButtonText}>
                    Confirm Extension
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Premium Modal Header */}
                <View style={styles.modalHeaderPremium}>
                  <View style={styles.modalHeaderIcon}>
                    <MaterialCommunityIcons
                      name="airplane-takeoff"
                      size={24}
                      color="#3B82F6"
                    />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>
                      {editingId ? "Edit Trip" : "Plan New Trip"}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      Add your travel details to stay safe
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setVisible(false)}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Input Fields */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Destination</Text>
                  <View style={styles.customInput}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={20}
                      color="#3B82F6"
                    />
                    <RNTextInput
                      placeholder="Where are you going?"
                      placeholderTextColor="#94A3B8"
                      value={title}
                      onChangeText={setTitle}
                      style={styles.customInputText}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Travel Date</Text>
                  <TouchableOpacity
                    style={styles.customInput}
                    onPress={() => openDatePicker("start")}
                  >
                    <MaterialCommunityIcons
                      name="calendar-month"
                      size={20}
                      color="#3B82F6"
                    />
                    <Text style={[
                      styles.customInputText,
                      !date && styles.customInputPlaceholder
                    ]}>
                      {date ? new Date(date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      }) : "Select start date"}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes (Optional)</Text>
                  <View style={[styles.customInput, styles.customInputMultiline]}>
                    <MaterialCommunityIcons
                      name="note-text-outline"
                      size={20}
                      color="#3B82F6"
                      style={{ marginTop: 2 }}
                    />
                    <RNTextInput
                      placeholder="Any special notes for this trip..."
                      placeholderTextColor="#94A3B8"
                      value={notes}
                      onChangeText={setNotes}
                      style={styles.notesInputText}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      (!title.trim() || loading) && styles.saveButtonDisabled,
                    ]}
                    onPress={save}
                    disabled={loading || !title.trim()}
                  >
                    <LinearGradient
                      colors={
                        title.trim() && !loading
                          ? ["#3B82F6", "#2563EB"]
                          : ["#CBD5E1", "#CBD5E1"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveButtonGradient}
                    >
                      <MaterialCommunityIcons
                        name={loading ? "loading" : "check"}
                        size={18}
                        color="white"
                      />
                      <Text style={styles.saveButtonText}>
                        {loading ? "Saving..." : "Save Trip"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Modal>
        </Portal>

        {showDatePicker && (
          <DateTimePicker
            value={new Date()} // Default to today, or parse existing date if valid
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={handleDateChange}
            minimumDate={new Date()} // Optional constraint
          />
        )}

        {/* Day-wise Itinerary Edit Modal */}
        <EditGroupItineraryModal
          visible={showDayWiseEditModal}
          onDismiss={() => {
            setShowDayWiseEditModal(false);
            setEditingItinerary([]);
          }}
          onSuccess={() => {
            setShowDayWiseEditModal(false);
            setEditingItinerary([]);
            // Refresh trips data
            updateTripsFromBackend && updateTripsFromBackend();
          }}
          initialItinerary={editingItinerary}
        />
      </View>
    );
  },
);

export default ItineraryList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cardContainer: {
    marginBottom: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  imageContainer: {
    height: 180,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  statusBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  upcomingBadge: {
    backgroundColor: "#22C55E",
  },
  completedBadge: {
    backgroundColor: "#6B7280",
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  imageContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  imageTopContent: {
    marginBottom: 12,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    color: "white",
    fontSize: 14,
    opacity: 0.9,
  },
  // Progress Section
  progressSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  daysLeft: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  // Card Actions
  cardActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    gap: 8,
  },
  editButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
  extendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    gap: 8,
  },
  extendButtonText: {
    color: "#3B82F6",
    fontSize: 15,
    fontWeight: "600",
  },
  viewItineraryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    gap: 8,
    marginTop: 12,
  },
  viewItineraryButtonText: {
    color: "#3B82F6",
    fontSize: 15,
    fontWeight: "600",
  },
  // Empty state styles
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 110,
  },
  emptyIllustration: {
    position: "relative",
    marginBottom: 32,
  },
  emptyIconOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  emptyDot: {
    position: "absolute",
    borderRadius: 50,
    backgroundColor: "#C7D2FE",
  },
  emptyDot1: {
    width: 12,
    height: 12,
    top: 10,
    right: -5,
  },
  emptyDot2: {
    width: 8,
    height: 8,
    bottom: 20,
    left: -10,
  },
  emptyDot3: {
    width: 6,
    height: 6,
    top: 40,
    left: -15,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyFeatures: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  emptyFeaturePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  emptyFeatureText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  emptyAddButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  emptyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 10,
  },
  emptyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
  modalHeaderPremium: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  customInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  customInputMultiline: {
    alignItems: "flex-start",
    paddingVertical: 14,
  },
  customInputText: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
    padding: 0,
    margin: 0,
  },
  notesInputText: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
    height: 70,
    textAlignVertical: "top",
    padding: 0,
    margin: 0,
  },
  customInputPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  input: {
    marginBottom: 16,
    backgroundColor: "white",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  cancelButtonText: {
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1.2,
    borderRadius: 14,
    overflow: "hidden",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Extend Modal specific styles
  extendInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  cleanInput: {
    marginBottom: 16,
    backgroundColor: "white",
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  toggleSubLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  confirmButton: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // Details Section Styles
  detailsContainer: {
    marginTop: 16,
  },

  planCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 24,
  },
  daySection: {
    marginBottom: 32,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  todayHeader: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1.5,
    borderColor: "#22C55E",
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
  },
  todayTitle: {
    color: "#22C55E",
  },
  dayDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: 16,
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
    marginTop: 6,
    borderWidth: 2,
    borderColor: "white",
    elevation: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    position: "absolute",
    top: 20,
    bottom: -24,
    zIndex: -1,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  timelineSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  timelineDetails: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  timelineTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  tagContainer: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  // History Section Styles
  historySection: {
    marginTop: 24,
    paddingBottom: 24,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6B7280",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  historyThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: "#E5E7EB",
  },
  historyInfo: {
    flex: 1,
  },
  historyTripTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  historyTripDate: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  historyBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6B7280",
  },
});
