import { View, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Modal } from "react-native"
import { Text, Switch, Button } from "react-native-paper"
import QRCode from "react-native-qrcode-svg"
import { useApp } from "../../../context/AppContext"
import { CheckCircle2, Edit, QrCode, Volume2, Smartphone, BellOff, ChevronRight, Bug, LogOut, X } from "lucide-react-native"
import { useState, useEffect } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "../../../navigation"
import { getAlertConfig, saveAlertConfig, getAlertState, setGlobalMute } from "../../../utils/alertHelpers"
import { getSOSQueue } from "../../../utils/offlineQueue"
import SafetyScoreCard from "../../dashboard/components/SafetyScoreCard"
import { Alert } from "react-native"

export default function SettingsScreen() {
  const { state, logout } = useApp()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [sound, setSound] = useState(true)
  const [vibration, setVibration] = useState(true)
  const [muteAllAlerts, setMuteAllAlerts] = useState(false)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    getAlertConfig().then(cfg => {
      setSound(cfg.sound)
      setVibration(cfg.vibration)
    })
    getAlertState().then(s => {
      if (s) {
        setMuteAllAlerts(s.muted)
      }
    })
  }, [])

  const toggleSound = (v: boolean) => {
    setSound(v)
    saveAlertConfig({ sound: v })
  }

  const toggleVibration = (v: boolean) => {
    setVibration(v)
    saveAlertConfig({ vibration: v })
  }

  const toggleMuteAll = async (v: boolean) => {
    setMuteAllAlerts(v)
    await setGlobalMute(v)
  }

  const menuItems: Array<{
    section: string;
    items: Array<{
      icon: React.ReactNode;
      label: string;
      color: string;
      isToggle: boolean;
      value?: boolean;
      onToggle?: (v: boolean) => void;
      onPress?: () => void;
    }>;
  }> = [
    {
      section: "Preferences",
      items: [
        {
          icon: <Volume2 size={18} color="#8B5CF6" />,
          label: "Sound",
          color: "#8B5CF6",
          isToggle: true,
          value: sound,
          onToggle: toggleSound
        },
        {
          icon: <Smartphone size={18} color="#EC4899" />,
          label: "Vibration",
          color: "#EC4899",
          isToggle: true,
          value: vibration,
          onToggle: toggleVibration
        },
      ]
    },
  ]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{state.user?.name?.charAt(0) || "U"}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <CheckCircle2 size={14} color="#fff" />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{state.user?.name || "User"}</Text>
              <Text style={styles.profileEmail}>{state.user?.email || "user@example.com"}</Text>
            </View>
          </View>

          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('PersonalInfo')}>
              <Edit size={18} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowQR(true)}>
              <QrCode size={18} color="#3B82F6" />
              <Text style={styles.actionButtonText}>My QR</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SafetyScoreCard />


        {/* Menu Sections */}
        {menuItems.map(section => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, itemIndex) => (
                <View key={item.label}>
                  {item.isToggle ? (
                    <View style={styles.menuItem}>
                      <View style={styles.menuItemLeft}>
                        <View style={[styles.menuIcon, { backgroundColor: item.color + "20" }]}>
                          {item.icon}
                        </View>
                        <Text style={styles.menuItemText}>{item.label}</Text>
                      </View>
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        color="#3B82F6"
                      />
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                      <View style={styles.menuItemLeft}>
                        <View style={[styles.menuIcon, { backgroundColor: item.color + "20" }]}>
                          {item.icon}
                        </View>
                        <Text style={styles.menuItemText}>{item.label}</Text>
                      </View>
                      <ChevronRight size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                  {itemIndex < section.items.length - 1 && <View style={styles.menuDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Alert Preferences Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Settings</Text>
          <View style={styles.sectionCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: "#FEE2E220" }]}>
                  <BellOff size={18} color="#EF4444" />
                </View>
                <View>
                  <Text style={styles.menuItemText}>Mute High-Risk Alerts</Text>
                  <Text style={styles.menuItemSubtext}>Temporarily silence notifications</Text>
                </View>
              </View>
              <Switch
                value={muteAllAlerts}
                onValueChange={toggleMuteAll}
                color="#EF4444"
              />
            </View>
          </View>
        </View>

        {/* Debug Options - DEV only */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer</Text>
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  try {
                    const q = await getSOSQueue()
                    Alert.alert('Queued SOS', `Count: ${q.length}`)
                  } catch (e) {
                    Alert.alert('Error', 'Failed to read queue')
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: "#F9731620" }]}>
                    <Bug size={18} color="#F97316" />
                  </View>
                  <Text style={styles.menuItemText}>View SOS Queue</Text>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAccount} activeOpacity={0.7}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={showQR}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQR(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My QR Code</Text>
              <TouchableOpacity onPress={() => setShowQR(false)} style={styles.closeButton}>
                <X size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrContainer}>
              <QRCode
                value={state.user?.touristId || state.user?.phone || "USER_ID"}
                size={200}
              />
            </View>

            <Text style={styles.qrTouristId}>
              {state.user?.touristId || "Tourist ID: Not Available"}
            </Text>
            <Text style={styles.qrDescription}>
              Show this QR code for quick identification at checkpoints
            </Text>

            <Button
              mode="contained"
              onPress={() => setShowQR(false)}
              style={styles.closeButton}
              buttonColor="#3B82F6"
            >
              Close
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 120,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  menuItemSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 64,
  },
  footer: {
    marginTop: 8,
    alignItems: 'center',
    gap: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  deleteAccount: {
    paddingVertical: 8,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  qrContainer: {
    padding: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginBottom: 20,
  },
  qrTouristId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  qrDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  closeButton: {
    width: '100%',
    borderRadius: 12,
  },
})
