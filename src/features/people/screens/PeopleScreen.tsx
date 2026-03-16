import React, { useState, useEffect } from "react"
import { View, StyleSheet, TouchableOpacity, StatusBar, RefreshControl, Alert } from "react-native"
import { Text } from "react-native-paper"
import PeopleList from "../components/PeopleList"
import { useApp } from "../../../context/AppContext"
import { Users, CheckCircle, XCircle, Mail, Plus } from "lucide-react-native"
import { getAllMembers, sendWelcomeEmailsToAll } from "../../../utils/api"
import PeopleSkeleton from "../components/PeopleSkeleton"

export type FilterType = "all" | "active" | "offline"

export default function PeopleScreen({ navigation }: any) {
  const { state } = useApp()
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [people, setPeople] = useState<any[]>([])
  const [sendingEmails, setSendingEmails] = useState(false)

  const fetchPeople = async () => {
    if (!state.token) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await getAllMembers(state.token);
      
      if (response?.members) {
        setPeople(response.members);
      } else {
        setPeople([]);
      }
    } catch (err: any) {      // On error, reset people to an empty list
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSendWelcomeEmails = async () => {
    if (people.length === 0) {
      Alert.alert("No Members", "You need to add members before sending welcome emails.")
      return
    }

    Alert.alert(
      "Send Welcome Emails",
      `Send welcome emails with login codes to all ${people.length} member${people.length === 1 ? '' : 's'}?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Send",
          onPress: async () => {
            try {
              setSendingEmails(true)
              const response = await sendWelcomeEmailsToAll(state.token)
              
              if (response.success) {
                Alert.alert(
                  "Success",
                  response.message || `Welcome emails sent to ${response.data?.emailsSent || 0} members!`,
                  [{ text: "OK" }]
                )
              } else {
                Alert.alert("Error", response.message || "Failed to send emails")
              }
            } catch (err: any) {
              // Differentiate between informational messages and actual errors
              const errorMsg = err.message || "Failed to send welcome emails. Please try again."
              const isInfoMessage = errorMsg.toLowerCase().includes("already received")
              
              Alert.alert(
                isInfoMessage ? "Information" : "Email Sending Failed",
                errorMsg,
                [{ text: "OK" }]
              )
            } finally {
              setSendingEmails(false)
            }
          }
        }
      ]
    )
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPeople()
    setRefreshing(false)
  }

  useEffect(() => {
    fetchPeople();
  }, [state.token]);

  // Refetch when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPeople();
    });

    return unsubscribe;
  }, [navigation, state.token]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "offline", label: "Offline" },
  ]

  const renderFilterIcon = (filterKey: FilterType, isActive: boolean) => {
    const color = isActive ? "#FFFFFF" : "#64748B"
    switch (filterKey) {
      case "all":
        return <Users size={16} color={color} />
      case "active":
        return <CheckCircle size={16} color={color} />
      case "offline":
        return <XCircle size={16} color={color} />
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />

      {/* Header Section */}
      <View style={styles.headerSection}>
        {/* Title Row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>People</Text>
            <Text style={styles.subtitle}>
              {people.length} {people.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
          
          {/* Send Email Button */}
          {people.length > 0 && (
            <TouchableOpacity
              onPress={handleSendWelcomeEmails}
              disabled={sendingEmails}
              style={[styles.emailButton, sendingEmails && styles.emailButtonDisabled]}
              activeOpacity={0.7}
            >
              {sendingEmails ? <Mail size={18} color="#FFFFFF" /> : <Mail size={18} color="#FFFFFF" />}
              <Text style={styles.emailButtonText}>
                {sendingEmails ? 'Sending...' : 'Send Welcome'}
              </Text>
            </TouchableOpacity>
          )}
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
              {renderFilterIcon(filter.key, activeFilter === filter.key)}
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

      {/* People List */}
      <View style={styles.listContainer}>
        {loading ? (
          <PeopleSkeleton />
        ) : (
          <PeopleList 
            people={people} 
            filter={activeFilter} 
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEditPress={(person) => {
              navigation.navigate('EditPerson', { person })
            }}
          />
        )}
      </View>

      {/* Floating Action Button - Add Person */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddPerson')}
        activeOpacity={0.9}
      >
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F5",
  },
  headerSection: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FAF8F5",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emailButtonDisabled: {
    opacity: 0.6,
  },
  emailButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
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
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
})
