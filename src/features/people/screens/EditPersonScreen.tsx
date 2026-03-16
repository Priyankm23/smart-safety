import React, { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Keyboard, Alert } from 'react-native';
import { Text, Menu } from 'react-native-paper';
import { ArrowLeft, User, Calendar, Mail, Phone, Droplet, ChevronDown, Activity, AlertCircle, Stethoscope } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function EditPersonScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { state } = useApp();
    const person = (route.params as any)?.person;

    // Personal Info
    const [fullName, setFullName] = useState(person?.name || '');
    const [dob, setDob] = useState(person?.dob || '');
    const [nationality, setNationality] = useState(person?.nationality || '');
    const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(person?.gender || 'Male');

    // Contact Info
    const [email, setEmail] = useState(person?.email || '');
    const [phone, setPhone] = useState(person?.phone || '');
    const [govId, setGovId] = useState(person?.govId || '');

    // Emergency Info
    const [bloodGroup, setBloodGroup] = useState(person?.bloodGroup || 'O+');
    const [bloodMenuVisible, setBloodMenuVisible] = useState(false);
    const isBloodMenuDismissed = useRef(false);
    const [medicalConditions, setMedicalConditions] = useState(person?.medicalConditions || '');
    const [allergies, setAllergies] = useState(person?.allergies || '');

    // Emergency Contact
    const [emergencyContactName, setEmergencyContactName] = useState(person?.emergencyContact?.name || '');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState(person?.emergencyContact?.phone || '');

    const openBloodMenu = () => {
        if (isBloodMenuDismissed.current) {
            isBloodMenuDismissed.current = false;
            return;
        }
        Keyboard.dismiss();
        setBloodMenuVisible(true);
    };

    const closeBloodMenu = () => {
        isBloodMenuDismissed.current = true;
        setBloodMenuVisible(false);
        setTimeout(() => {
            isBloodMenuDismissed.current = false;
        }, 200);
    };

    const handleSave = () => {
        // TODO: Implement API call to update person data
        Alert.alert(
            'Success',
            'Person information updated successfully',
            [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack()
                }
            ]
        );
    };

    const GenderButton = ({ value, label }: { value: 'Male' | 'Female' | 'Other'; label: string }) => (
        <TouchableOpacity
            style={[styles.genderButton, gender === value && styles.genderButtonActive]}
            onPress={() => setGender(value)}
            activeOpacity={0.7}
        >
            <Text style={[styles.genderText, gender === value && styles.genderTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <ArrowLeft size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Person</Text>
                <TouchableOpacity 
                    onPress={handleSave}
                    style={styles.saveButton}
                >
                    <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Personal Information */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <User size={20} color="#3b82f6" />
                        <Text style={styles.sectionTitle}>Personal Information</Text>
                    </View>

                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput
                        style={styles.input}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Enter full name"
                    />

                    <View style={styles.row}>
                        <View style={styles.halfField}>
                            <Text style={styles.label}>Date of Birth</Text>
                            <View style={styles.inputWithIcon}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                    value={dob}
                                    onChangeText={setDob}
                                    placeholder="MM/DD/YYYY"
                                />
                                <Calendar size={18} color="#9ca3af" style={styles.inputIcon} />
                            </View>
                        </View>
                        <View style={styles.halfField}>
                            <Text style={styles.label}>Nationality</Text>
                            <TextInput
                                style={styles.input}
                                value={nationality}
                                onChangeText={setNationality}
                                placeholder="Country"
                            />
                        </View>
                    </View>

                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.genderRow}>
                        <GenderButton value="Male" label="Male" />
                        <GenderButton value="Female" label="Female" />
                        <GenderButton value="Other" label="Other" />
                    </View>
                </View>

                {/* Contact Information */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Mail size={20} color="#3b82f6" />
                        <Text style={styles.sectionTitle}>Contact Information</Text>
                    </View>

                    <Text style={styles.label}>Email Address *</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="email@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+91 98765 43210"
                        keyboardType="phone-pad"
                    />

                    <Text style={styles.label}>Government ID</Text>
                    <TextInput
                        style={styles.input}
                        value={govId}
                        onChangeText={setGovId}
                        placeholder="Aadhaar / Passport Number"
                    />
                </View>

                {/* Emergency Contact */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Phone size={20} color="#3b82f6" />
                        <Text style={styles.sectionTitle}>Emergency Contact</Text>
                    </View>

                    <Text style={styles.label}>Contact Name</Text>
                    <TextInput
                        style={styles.input}
                        value={emergencyContactName}
                        onChangeText={setEmergencyContactName}
                        placeholder="Full name"
                    />

                    <Text style={styles.label}>Contact Phone</Text>
                    <TextInput
                        style={styles.input}
                        value={emergencyContactPhone}
                        onChangeText={setEmergencyContactPhone}
                        placeholder="+91 98765 43210"
                        keyboardType="phone-pad"
                    />
                </View>

                {/* Medical Information */}
                <View style={styles.emergencySection}>
                    <View style={styles.emergencyHeader}>
                        <View style={styles.emergencyIconContainer}>
                            <Stethoscope size={22} color="#fff" />
                        </View>
                        <Text style={styles.emergencyTitle}>Medical Information</Text>
                    </View>

                    <View style={styles.emergencyContent}>
                        <View style={styles.emergencyRow}>
                            <View style={styles.emergencyField}>
                                <Text style={styles.emergencyLabel}>Blood Group</Text>
                                <Menu
                                    visible={bloodMenuVisible}
                                    onDismiss={closeBloodMenu}
                                    anchor={
                                        <View collapsable={false}>
                                            <TouchableOpacity
                                                style={styles.emergencyDropdown}
                                                onPress={openBloodMenu}
                                                activeOpacity={0.7}
                                            >
                                                <Droplet size={18} color="#ef4444" />
                                                <Text style={styles.emergencyDropdownText}>{bloodGroup}</Text>
                                                <ChevronDown size={16} color="#6b7280" />
                                            </TouchableOpacity>
                                        </View>
                                    }
                                    contentStyle={styles.menuContent}
                                >
                                    {BLOOD_GROUPS.map((group) => (
                                        <Menu.Item
                                            key={group}
                                            onPress={() => {
                                                setBloodMenuVisible(false);
                                                setTimeout(() => setBloodGroup(group), 100);
                                            }}
                                            title={group}
                                        />
                                    ))}
                                </Menu>
                            </View>
                        </View>

                        <View style={styles.emergencyField}>
                            <Text style={styles.emergencyLabel}>Medical Conditions</Text>
                            <View style={styles.emergencyInputRow}>
                                <Activity size={18} color="#f97316" />
                                <TextInput
                                    style={styles.emergencyInput}
                                    value={medicalConditions}
                                    onChangeText={setMedicalConditions}
                                    placeholder="None"
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>
                        </View>

                        <View style={[styles.emergencyField, { marginBottom: 0 }]}>
                            <Text style={styles.emergencyLabel}>Allergies</Text>
                            <View style={styles.emergencyInputRow}>
                                <AlertCircle size={18} color="#eab308" />
                                <TextInput
                                    style={styles.emergencyInput}
                                    value={allergies}
                                    onChangeText={setAllergies}
                                    placeholder="None"
                                    placeholderTextColor="#9ca3af"
                                />
                            </View>
                        </View>
                    </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    emergencySection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    emergencyHeader: {
        backgroundColor: '#eff6ff',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#dbeafe',
    },
    emergencyIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emergencyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    emergencyContent: {
        padding: 20,
    },
    emergencyRow: {
        marginBottom: 16,
    },
    emergencyField: {
        marginBottom: 16,
    },
    emergencyLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emergencyDropdown: {
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    emergencyDropdownText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        flex: 1,
    },
    emergencyInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 14,
        paddingVertical: 4,
        gap: 10,
    },
    emergencyInput: {
        flex: 1,
        fontSize: 14,
        color: '#1f2937',
        paddingVertical: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1f2937',
        marginBottom: 16,
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    inputIcon: {
        position: 'absolute',
        right: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfField: {
        flex: 1,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    genderButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    genderButtonActive: {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    genderText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    genderTextActive: {
        color: '#3b82f6',
    },
    menuContent: {
        backgroundColor: '#fff',
        borderRadius: 10,
    },
});
