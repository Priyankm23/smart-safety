import { View, StyleSheet, TouchableOpacity, Linking, Alert, InteractionManager } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "../../../navigation"
import { Text, Switch, Menu, TextInput, Button } from "react-native-paper"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { Vibrate, Languages } from "lucide-react-native"
import { useState, useEffect, useRef } from "react"
import { useApp } from "../../../context/AppContext"
import { getAlertConfig, saveAlertConfig, getAlertState, setGlobalMute } from "../../../utils/alertHelpers"
import { getSOSQueue } from "../../../utils/offlineQueue"

export default function AccountPreferencesSection() {
    const { state, setLanguage, logout, acknowledgeHighRisk } = useApp()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const [sound, setSound] = useState(true)
    const [vibration, setVibration] = useState(true)
    const [languageMenuVisible, setLanguageMenuVisible] = useState(false)
    const isLanguageMenuDismissed = useRef(false)
    const [muteAllAlerts, setMuteAllAlerts] = useState(false)
    const [suppressMinutes, setSuppressMinutes] = useState<string>("15")

    useEffect(() => {
        // Load initial config
        getAlertConfig().then(cfg => {
            setSound(cfg.sound)
            setVibration(cfg.vibration)
        })
        // Load mute state and suppression time
        getAlertState().then(s => {
            if (s) {
                setMuteAllAlerts(s.muted)
                if (s.suppressionUntil && s.suppressionUntil > Date.now()) {
                    const remaining = Math.ceil((s.suppressionUntil - Date.now()) / 60000)
                    setSuppressMinutes(String(Math.max(1, remaining)))
                }
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

    const openLanguageMenu = () => {
        if (isLanguageMenuDismissed.current) {
            isLanguageMenuDismissed.current = false
            return
        }
        if (languageMenuVisible) return
        InteractionManager.runAfterInteractions(() => setLanguageMenuVisible(true))
    }

    const closeLanguageMenu = () => {
        isLanguageMenuDismissed.current = true
        setLanguageMenuVisible(false)
        setTimeout(() => {
            isLanguageMenuDismissed.current = false
        }, 200)
    }

    // Get current language display name
    const getLanguageDisplay = () => {
        switch (state.language) {
            case 'en': return 'English (US)'
            case 'hi': return 'हिंदी'
            default: return 'English (US)'
        }
    }

    return (
        <View style={styles.container}>
            {/* ACCOUNT Section */}
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.card}>
                <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={() => navigation.navigate('PersonalInfo')}>
                    <View style={styles.listItemLeft}>
                        <Ionicons name="person-outline" size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>Personal Info</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={() => navigation.navigate('AppSettings')}>
                    <View style={styles.listItemLeft}>
                        <Ionicons name="settings-outline" size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>App Settings</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
                    <View style={styles.listItemLeft}>
                        <MaterialCommunityIcons name="link-variant" size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>Linked Accounts</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                {/* Debug View SOS Queue - Hidden in production */}
                {__DEV__ && (
                    <>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.listItem}
                            activeOpacity={0.7}
                            onPress={async () => {
                                try {
                                    const q = await getSOSQueue()
                                    console.log('Queued SOS items:', q)
                                    Alert.alert('Queued SOS', `Count: ${q.length}\n\n${JSON.stringify(q, null, 2)}`)
                                } catch (e) {
                                    console.warn('Failed reading SOS queue', e)
                                    Alert.alert('Queued SOS', 'Failed to read queue. See console for details.')
                                }
                            }}
                        >
                            <View style={styles.listItemLeft}>
                                <MaterialCommunityIcons name="message-alert-outline" size={22} color="#f97316" />
                                <Text style={styles.listItemText}>View SOS Queue</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* PREFERENCES Section */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PREFERENCES</Text>
            <View style={styles.card}>
                {/* Mute All High-Risk Alerts */}
                <View style={[styles.listItem, { paddingVertical: 5 }]}>
                    <View style={[styles.listItemLeft, styles.listItemLeftGrow]}>
                        <MaterialCommunityIcons name="bell-off-outline" size={22} color="#ef4444" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listItemText}>Mute All High-Risk Alerts</Text>
                            <Text style={styles.listItemSubtext}>Temporarily silence all safety notifications</Text>
                        </View>
                    </View>
                    <View style={styles.switchContainer}>
                        <Switch
                            value={muteAllAlerts}
                            onValueChange={toggleMuteAll}
                            color="#ef4444"
                        />
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Suppress Alerts */}
                <View style={[styles.listItem, { paddingVertical: 10, flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <View style={[styles.listItemLeft, { marginBottom: 12 }]}>
                        <MaterialCommunityIcons name="timer-outline" size={22} color="#f59e0b" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listItemText}>Suppress Alerts For</Text>
                            <Text style={styles.listItemSubtext}>Pause notifications for a specific duration</Text>
                        </View>
                    </View>
                    <View style={styles.suppressInputRow}>
                        <TextInput
                            style={styles.suppressInput}
                            mode="outlined"
                            keyboardType="numeric"
                            value={suppressMinutes}
                            onChangeText={setSuppressMinutes}
                            label="Minutes"
                            dense
                            outlineColor="#e5e7eb"
                            activeOutlineColor="#1e40af"
                        />
                        <Button
                            mode="contained"
                            onPress={async () => {
                                const m = Math.max(1, parseInt(suppressMinutes || '0', 10) || 0)
                                await acknowledgeHighRisk(m)
                            }}
                            style={styles.acknowledgeButton}
                            buttonColor="#f59e0b"
                            textColor="#fff"
                        >
                            Acknowledge
                        </Button>
                    </View>
                    <Text style={styles.warningText}>
                        Alerts will escalate at 5/15/30+ minutes if not acknowledged.
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* Sound */}
                <View style={[styles.listItem, { paddingVertical: 5 }]}>
                    <View style={styles.listItemLeft}>
                        <Ionicons name="volume-high-outline" size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>Sound</Text>
                    </View>
                    <Switch
                        value={sound}
                        onValueChange={toggleSound}
                        color="#1e40af"
                    />
                </View>

                <View style={styles.divider} />

                {/* Vibration */}
                <View style={[styles.listItem, { paddingVertical: 5 }]}>
                    <View style={styles.listItemLeft}>
                        <Vibrate size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>Vibration</Text>
                    </View>
                    <Switch
                        value={vibration}
                        onValueChange={toggleVibration}
                        color="#1e40af"
                    />
                </View>

                <View style={styles.divider} />

                {/* Language with Dropdown */}
                <Menu
                    visible={languageMenuVisible}
                    onDismiss={closeLanguageMenu}
                    anchor={
                        <View collapsable={false}>
                            <TouchableOpacity
                                style={styles.listItem}
                                activeOpacity={0.7}
                                onPress={openLanguageMenu}
                            >
                                <View style={styles.listItemLeft}>
                                    <Languages size={22} color="#1e40af" />
                                    <Text style={styles.listItemText}>Language</Text>
                                </View>
                                <View style={styles.valueContainer}>
                                    <Text style={styles.valueText}>{getLanguageDisplay()}</Text>
                                    <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    }
                >
                    <Menu.Item
                        onPress={() => {
                            setLanguageMenuVisible(false);
                            setTimeout(() => setLanguage('en'), 200);
                        }}
                        title="English (US)"
                    />
                    <Menu.Item
                        onPress={() => {
                            setLanguageMenuVisible(false);
                            setTimeout(() => setLanguage('hi'), 200);
                        }}
                        title="Hindi (हिंदी)"
                    />
                </Menu>
            </View>

            {/* SUPPORT Section */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>SUPPORT</Text>
            <View style={styles.card}>
                <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={() => navigation.navigate('HelpCenter')}>
                    <View style={styles.listItemLeft}>
                        <Ionicons name="help-circle-outline" size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>Help Center</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={() => navigation.navigate('ReportIssue')}>
                    <View style={styles.listItemLeft}>
                        <Ionicons name="warning-outline" size={22} color="#1e40af" />
                        <Text style={styles.listItemText}>Report an Issue</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>
            </View>

            {/* Footer Actions */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={logout}>
                    <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} activeOpacity={0.7}>
                    <Text style={styles.deleteText}>Delete Account</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e40af',
        letterSpacing: 0.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    listItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    listItemLeftGrow: {
        flex: 1,
    },
    listItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1f2937',
    },
    listItemSubtext: {
        fontSize: 12,
        fontWeight: '400',
        color: '#6b7280',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginLeft: 52,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    valueText: {
        fontSize: 14,
        color: '#6b7280',
    },

    switchContainer: {
        paddingLeft: 12,
        paddingRight: 6,
        justifyContent: 'center',
    },

    dividerFull: {
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    dualToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    dualToggleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    verticalDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#e5e7eb',
        marginHorizontal: 12,
    },
    footer: {
        marginTop: 32,
        paddingBottom: 24,
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
        borderWidth: 1,
        borderColor: '#ef4444',
        backgroundColor: '#fff',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ef4444',
    },
    deleteButton: {
        paddingVertical: 8,
    },
    deleteText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#ef4444',
    },
    suppressInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
    },
    suppressInput: {
        flex: 1,
        maxWidth: 100,
        backgroundColor: '#fff',
    },
    acknowledgeButton: {
        flex: 1,
        borderRadius: 8,
    },
    warningText: {
        fontSize: 12,
        color: '#f59e0b',
        marginTop: 10,
        lineHeight: 16,
    },
})
