import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Text, List } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

export default function HelpCenterScreen() {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Emergency Banner */}
                <LinearGradient
                    colors={['#dc2626', '#ef4444']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emergencyBanner}
                >
                    <View style={styles.emergencyContent}>
                        <View style={styles.emergencyIconContainer}>
                            <Text style={styles.sosText}>SOS</Text>
                        </View>
                        <View style={styles.emergencyTextContainer}>
                            <Text style={styles.emergencyTitle}>Emergency</Text>
                            <Text style={styles.emergencySubtitle}>Instant connection</Text>
                        </View>
                        <TouchableOpacity style={styles.callButton} activeOpacity={0.9}>
                            <Ionicons name="call-outline" size={18} color="#dc2626" />
                            <Text style={styles.callButtonText}>Call 112</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Contact Support */}
                <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>Contact Support</Text>
                    <View style={styles.onlineBadge}>
                        <Text style={styles.onlineText}>Online</Text>
                    </View>
                </View>

                <View style={styles.supportCardsRow}>
                    <TouchableOpacity style={styles.supportCard} activeOpacity={0.7}>
                        <View style={styles.supportHeader}>
                            <View style={[styles.supportIconCircle, { backgroundColor: '#eff6ff' }]}>
                                <MaterialCommunityIcons name="headset" size={24} color="#3b82f6" />
                            </View>
                            <View style={styles.waitTimeBadge}>
                                <Text style={styles.waitTimeText}>Wait: &lt; 2m</Text>
                            </View>
                        </View>
                        <Text style={styles.supportTitle}>Live Chat</Text>
                        <Text style={styles.supportSubtitle}>Available 24/7 for urgent issues</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.supportCard} activeOpacity={0.7}>
                        <View style={styles.supportHeader}>
                            <View style={[styles.supportIconCircle, { backgroundColor: '#f3e8ff' }]}>
                                <Ionicons name="mail-outline" size={24} color="#a855f7" />
                            </View>
                        </View>
                        <Text style={styles.supportTitle}>Email Support</Text>
                        <Text style={styles.supportSubtitle}>Best for non-urgent inquiries</Text>
                    </TouchableOpacity>
                </View>

                {/* FAQ Categories */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>FAQ Categories</Text>

                <View style={styles.faqContainer}>
                    <List.AccordionGroup>
                        {/* Getting Started */}
                        <View style={styles.accordionCard}>
                            <List.Accordion
                                title="Getting Started"
                                id="1"
                                left={props => <Ionicons name="rocket-outline" size={22} color="#3b82f6" style={{ marginLeft: 16 }} />}
                                style={styles.accordionHeader}
                                titleStyle={styles.accordionTitle}
                                theme={{ colors: { background: 'transparent' } }}
                            >
                                <View style={styles.accordionContent}>
                                    <Text style={styles.accordionText}>
                                        To start your journey, ensure location services are enabled. You can create a safety profile in the settings tab.
                                    </Text>
                                    <TouchableOpacity style={styles.readMoreLink} activeOpacity={0.7}>
                                        <Text style={styles.readMoreText}>Read full article</Text>
                                        <Ionicons name="arrow-forward" size={14} color="#3b82f6" />
                                    </TouchableOpacity>
                                </View>
                            </List.Accordion>
                        </View>

                        <View style={styles.accordionSpacer} />

                        {/* Safety Features */}
                        <View style={styles.accordionCard}>
                            <List.Accordion
                                title="Safety Features"
                                id="2"
                                left={props => <Ionicons name="shield-outline" size={22} color="#3b82f6" style={{ marginLeft: 16 }} />}
                                style={styles.accordionHeader}
                                titleStyle={styles.accordionTitle}
                                theme={{ colors: { background: 'transparent' } }}
                            >
                                <View style={styles.accordionContent}>
                                    <Text style={styles.accordionText}>We monitor your location for safety and allow you to quickly alert trusted contacts.</Text>
                                </View>
                            </List.Accordion>
                        </View>

                        <View style={styles.accordionSpacer} />

                        {/* Privacy & Security */}
                        <View style={styles.accordionCard}>
                            <List.Accordion
                                title="Privacy & Security"
                                id="3"
                                left={props => <Ionicons name="lock-closed-outline" size={22} color="#3b82f6" style={{ marginLeft: 16 }} />}
                                style={styles.accordionHeader}
                                titleStyle={styles.accordionTitle}
                                theme={{ colors: { background: 'transparent' } }}
                            >
                                <View style={styles.accordionContent}>
                                    <Text style={styles.accordionText}>Your data is encrypted end-to-end and only shared during active emergencies.</Text>
                                </View>
                            </List.Accordion>
                        </View>
                    </List.AccordionGroup>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    emergencyBanner: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    emergencyContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    emergencyIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    sosText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emergencyTextContainer: {
        flex: 1,
        marginLeft: 16,
    },
    emergencyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    emergencySubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
    },
    callButton: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    callButtonText: {
        color: '#dc2626',
        fontWeight: 'bold',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    onlineBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    onlineText: {
        color: '#16a34a',
        fontSize: 12,
        fontWeight: '600',
    },
    supportCardsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    supportCard: {
        backgroundColor: '#fff',
        flex: 1,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    supportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    supportIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    waitTimeBadge: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    waitTimeText: {
        fontSize: 10,
        color: '#6b7280',
        fontWeight: '600',
    },
    supportTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 4,
    },
    supportSubtitle: {
        fontSize: 11,
        color: '#9ca3af',
        lineHeight: 14,
    },
    faqContainer: {
        marginTop: 8,
    },
    accordionCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    accordionHeader: {
        backgroundColor: '#fff',
        paddingVertical: 4,
    },
    accordionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginLeft: 12,
    },
    accordionContent: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 8,
    },
    accordionText: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 22,
        marginBottom: 16,
    },
    readMoreLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    readMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3b82f6',
    },
    accordionSpacer: {
        height: 0,
    },
});
