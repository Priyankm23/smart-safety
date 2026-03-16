import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from "react-native"
import { Text } from "react-native-paper"
import { Users, User, Phone, Mail, IdCard, Edit, Droplet, Globe } from "lucide-react-native"
import { FilterType } from "../screens/PeopleScreen"

interface Person {
  touristId: string
  name: string
  email: string
  phone: string
  role?: "solo" | "group-member" | "tour-admin"
  isOnline?: boolean
  dob?: string
  nationality?: string
  gender?: string
  bloodGroup?: string
  medicalConditions?: string
  allergies?: string
  emergencyContact?: { name: string; phone: string }
  govId?: string
}

interface PeopleListProps {
  people: Person[]
  filter: FilterType
  refreshControl?: React.ReactElement<any>
  onEditPress: (person: Person) => void
}

export default function PeopleList({ people, filter, refreshControl, onEditPress }: PeopleListProps) {
  // Filter people based on selected filter
  const filteredPeople = people.filter((person) => {
    if (filter === "all") return true
    if (filter === "active") return person.isOnline === true
    if (filter === "offline") return person.isOnline === false
    return true
  })

  // Empty state
  if (filteredPeople.length === 0) {
    return (
      <ScrollView 
        contentContainerStyle={styles.emptyContainer}
        refreshControl={refreshControl}
      >
        <View style={styles.emptyIconContainer}>
          <Users size={80} color="#CBD5E1" />
        </View>
        <Text style={styles.emptyTitle}>No people found</Text>
        <Text style={styles.emptySubtitle}>
          {filter === "all" 
            ? "Add people to your group to get started"
            : `No ${filter} members at the moment`}
        </Text>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {filteredPeople.map((person) => (
        <View key={person.touristId} style={styles.card}>
          <View style={styles.cardContent}>
            {/* Avatar with status indicator */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <User size={32} color="#3B82F6" />
              </View>
              {person.isOnline !== undefined && (
                <View style={[
                  styles.statusDot,
                  person.isOnline ? styles.statusOnline : styles.statusOffline
                ]} />
              )}
            </View>

            {/* Person Info */}
            <View style={styles.info}>
              <Text style={styles.name}>{person.name}</Text>
              <View style={styles.details}>
                <Phone size={14} color="#64748B" />
                <Text style={styles.detailText}>{person.phone}</Text>
              </View>
              {person.email && (
                <View style={styles.details}>
                  <Mail size={14} color="#64748B" />
                  <Text style={styles.detailText}>{person.email}</Text>
                </View>
              )}
              {person.govId && (
                <View style={styles.details}>
                  <IdCard size={14} color="#64748B" />
                  <Text style={styles.detailText}>{person.govId}</Text>
                </View>
              )}
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEditPress(person)}
              activeOpacity={0.7}
            >
              <Edit size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {/* Additional Info Row */}
          {(person.bloodGroup || person.nationality) && (
            <View style={styles.additionalInfo}>
              {person.bloodGroup && (
                <View style={styles.badge}>
                  <Droplet size={12} color="#EF4444" />
                  <Text style={styles.badgeText}>{person.bloodGroup}</Text>
                </View>
              )}
              {person.nationality && (
                <View style={styles.badge}>
                  <Globe size={12} color="#64748B" />
                  <Text style={styles.badgeText}>{person.nationality}</Text>
                </View>
              )}
              {person.gender && (
                <View style={styles.badge}>
                  <User size={12} color="#64748B" />
                  <Text style={styles.badgeText}>{person.gender}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  statusOnline: {
    backgroundColor: "#22C55E",
  },
  statusOffline: {
    backgroundColor: "#94A3B8",
  },
  info: {
    flex: 1,
    paddingTop: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  additionalInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
})
