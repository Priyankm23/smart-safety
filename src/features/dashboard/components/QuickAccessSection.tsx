import { View, StyleSheet, TouchableOpacity } from "react-native"
import { Text } from "react-native-paper"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { AlertTriangle } from "lucide-react-native"
import { useApp } from "../../../context/AppContext"

interface QuickAccessItem {
    id: string
    title: string
    subtitle: string
    icon: React.ReactNode
    iconBgColor: string
    onPress?: () => void
}

export default function QuickAccessSection() {
    const { state } = useApp()

    // Get real data from state
    const tripInfo = state.user?.itinerary?.[0] || "View Trip"
    const emergencyContactCount = state.user?.emergencyContact ? 1 : 0

    const quickAccessItems: QuickAccessItem[] = [
        {
            id: "trip",
            title: "Trip Info",
            subtitle: tripInfo.length > 15 ? tripInfo.substring(0, 15) + "..." : tripInfo,
            icon: <MaterialCommunityIcons name="map-marker-path" size={22} color="#1e40af" />,
            iconBgColor: "#eff6ff",
        },
        {
            id: "contacts",
            title: "Contacts",
            subtitle: `${emergencyContactCount + 1} Active`,
            icon: <AlertTriangle size={22} color="#dc2626" />,
            iconBgColor: "#fef2f2",
        },
    ]

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Quick Access</Text>

            <View style={styles.grid}>
                {quickAccessItems.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.card}
                        activeOpacity={0.7}
                        onPress={item.onPress}
                    >
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: item.iconBgColor }]}>
                                {item.icon}
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                        </View>

                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    card: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        width: '48%',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#6b7280',
    },
})
