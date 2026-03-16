import React, { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Keyboard, Alert, ActivityIndicator } from 'react-native';
import { Text, Menu, Dialog, Portal, Button } from 'react-native-paper';
import { ArrowLeft, User, Calendar, Mail, Phone, Droplet, ChevronDown, Activity, AlertCircle, Stethoscope } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { SERVER_URL } from '../../../config';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function AddPersonScreen() {
    const navigation = useNavigation();
    const { state } = useApp();
    const [saving, setSaving] = useState(false);

    // Personal Info
    const [fullName, setFullName] = useState('');
    const [dob, setDob] = useState('');
    const [nationality, setNationality] = useState('');
    const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');

    // Contact Info
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [govId, setGovId] = useState('');

    // Emergency Info
    const [bloodGroup, setBloodGroup] = useState('O+');
    const [bloodMenuVisible, setBloodMenuVisible] = useState(false);
    const isBloodMenuDismissed = useRef(false);
    const [medicalConditions, setMedicalConditions] = useState('');
    const [allergies, setAllergies] = useState('');

    // Emergency Contact
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

    // CSV Batch Import
    const [batchImportDialogVisible, setBatchImportDialogVisible] = useState(false);
    const [csvData, setCsvData] = useState('');
    const [importLoading, setImportLoading] = useState(false);

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

    // Pick CSV file from device storage
    const pickCSVFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                return;
            }

            const asset = result.assets[0];
            if (asset.uri) {
                const file = new File(asset.uri);
                const content = await file.text();
                setCsvData(content);
                Alert.alert("Success", `File "${asset.name}" loaded successfully!\n${content.split('\n').length - 1} rows found.`);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to pick or read CSV file");
        }
    };

    // Parse CSV data
    const parseCSV = (csvText: string) => {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error("CSV must have at least a header row and one data row");
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const members: any[] = [];

        const requiredHeaders = ['fullname', 'email', 'phone'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) {
                throw new Error(`Row ${i + 1} has incorrect number of columns`);
            }

            const member: any = {};
            headers.forEach((header, index) => {
                member[header] = values[index];
            });

            if (!member.fullname || !member.email || !member.phone) {
                throw new Error(`Row ${i + 1} is missing required fields`);
            }

            members.push({
                fullName: member.fullname,
                email: member.email,
                phone: member.phone,
                dob: member.dateofbirth || member.dob || undefined,
                nationality: member.nationality || undefined,
                gender: member.gender || 'Male',
                govId: member.govid || undefined,
                bloodGroup: member.bloodgroup || member.blood_group || 'O+',
                medicalConditions: member.medical_conditions || undefined,
                allergies: member.allergies || undefined,
                emergencyContactName: member.emergency_contact_name || undefined,
                emergencyContactPhone: member.emergency_contact_phone || undefined,
            });
        }

        return members;
    };

    // Batch import members from CSV
    const onBatchImport = async () => {
        if (!csvData.trim()) {
            Alert.alert("Error", "Please select a CSV file");
            return;
        }

        setImportLoading(true);
        try {
            const members = parseCSV(csvData);
            let successCount = 0;
            let failCount = 0;
            const errors: string[] = [];

            for (const member of members) {
                try {
                    const memberData = {
                        name: member.fullName,
                        email: member.email,
                        phone: member.phone,
                        govId: member.govId,
                        dob: member.dob,
                        nationality: member.nationality,
                        gender: member.gender,
                        bloodGroup: member.bloodGroup,
                        medicalConditions: member.medicalConditions,
                        allergies: member.allergies,
                        emergencyContact: (member.emergencyContactName && member.emergencyContactPhone) ? {
                            name: member.emergencyContactName,
                            phone: member.emergencyContactPhone,
                        } : undefined,
                    };

                    const response = await fetch(`${SERVER_URL}/api/group/members`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${state.token}`,
                        },
                        body: JSON.stringify(memberData),
                    });

                    const responseText = await response.text();
                    let data;
                    try {
                        data = responseText ? JSON.parse(responseText) : null;
                    } catch (e) {
                        data = null;
                    }

                    if (response.ok && data?.success) {
                        successCount++;
                    } else {
                        failCount++;
                        const errorMsg = data?.message || `Error: ${response.status}`;
                        errors.push(`${member.fullName}: ${errorMsg}`);
                    }
                } catch (error: any) {
                    failCount++;
                    errors.push(`${member.fullName}: ${error.message}`);
                }
            }

            setBatchImportDialogVisible(false);
            setCsvData('');
            
            if (successCount > 0) {
                Alert.alert(
                    "Batch Import Complete",
                    `✓ ${successCount} member(s) added successfully\n` +
                    (failCount > 0 ? `✗ ${failCount} failed` : ''),
                    [{ text: "OK", onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert("Import Failed", "All imports failed");
            }
        } catch (error: any) {
            Alert.alert("Parse Error", error.message || "Failed to parse CSV data");
        } finally {
            setImportLoading(false);
        }
    };

    const handleSave = async () => {
        console.log('[AddPerson] handleSave called');
        
        // Validation
        if (!fullName.trim()) {
            console.log('[AddPerson] Validation failed: name is empty');
            Alert.alert('Error', 'Please enter a name');
            return;
        }
        if (!email.trim()) {
            console.log('[AddPerson] Validation failed: email is empty');
            Alert.alert('Error', 'Please enter an email address');
            return;
        }
        if (!phone.trim()) {
            console.log('[AddPerson] Validation failed: phone is empty');
            Alert.alert('Error', 'Please enter a phone number');
            return;
        }

        console.log('[AddPerson] Validation passed, preparing data');
        
        // Prepare data
        const memberData = {
            name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            govId: govId.trim() || undefined,
            dob: dob.trim() || undefined,
            nationality: nationality.trim() || undefined,
            gender: gender,
            bloodGroup: bloodGroup,
            medicalConditions: medicalConditions.trim() || undefined,
            allergies: allergies.trim() || undefined,
            emergencyContact: (emergencyContactName.trim() && emergencyContactPhone.trim()) ? {
                name: emergencyContactName.trim(),
                phone: emergencyContactPhone.trim(),
            } : undefined,
        };

        console.log('[AddPerson] Member data prepared:', JSON.stringify(memberData, null, 2));

        try {
            setSaving(true);
            console.log('[AddPerson] Calling API: POST', `${SERVER_URL}/api/group/members`);
            console.log('[AddPerson] Token present:', !!state.token);
            
            const response = await fetch(`${SERVER_URL}/api/group/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`,
                },
                body: JSON.stringify(memberData),
            });

            console.log('[AddPerson] Response status:', response.status);
            
            const responseText = await response.text();
            console.log('[AddPerson] Response body:', responseText);
            
            let data;
            try {
                data = responseText ? JSON.parse(responseText) : null;
            } catch (e) {
                console.error('[AddPerson] Failed to parse response as JSON:', e);
                data = null;
            }

            console.log('[AddPerson] Parsed response:', JSON.stringify(data, null, 2));

            if (response.ok && data?.success) {
                console.log('[AddPerson] Member added successfully');
                Alert.alert(
                    'Success',
                    data.message || 'New person added successfully',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                console.log('[AddPerson] Navigating back to People screen');
                                navigation.goBack();
                            }
                        }
                    ]
                );
            } else {
                const errorMsg = data?.message || data?.error || `Server error: ${response.status}`;
                console.error('[AddPerson] API error:', errorMsg);
                Alert.alert('Error', errorMsg);
            }
        } catch (error: any) {
            console.error('[AddPerson] Exception occurred:', error);
            console.error('[AddPerson] Error message:', error?.message);
            console.error('[AddPerson] Error stack:', error?.stack);
            Alert.alert('Error', error.message || 'Failed to add person. Please try again.');
        } finally {
            setSaving(false);
            console.log('[AddPerson] handleSave completed');
        }
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
                <Text style={styles.headerTitle}>Add Person</Text>
                <TouchableOpacity 
                    onPress={handleSave}
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Batch Import Section */}
                <View style={styles.batchImportSection}>
                    <Button
                        mode="outlined"
                        onPress={() => setBatchImportDialogVisible(true)}
                        style={styles.batchImportButton}
                        labelStyle={styles.batchImportButtonLabel}
                        icon="file-upload-outline"
                    >
                        Batch Import from CSV
                    </Button>
                </View>

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

            {/* Batch Import Dialog */}
            <Portal>
                <Dialog visible={batchImportDialogVisible} onDismiss={() => setBatchImportDialogVisible(false)} style={styles.dialog}>
                    <Dialog.Title style={styles.dialogTitle}>Batch Import Members</Dialog.Title>
                    <Dialog.Content>
                        <Text style={styles.dialogText}>
                            Select a CSV file to import multiple members at once.
                        </Text>
                        
                        <Button
                            mode="contained"
                            onPress={pickCSVFile}
                            style={styles.filePickerButton}
                            labelStyle={styles.filePickerButtonLabel}
                            icon="file-document-outline"
                        >
                            Select CSV File
                        </Button>

                        {csvData ? (
                            <View style={styles.filePreview}>
                                <Text style={styles.filePreviewTitle}>✓ File Loaded</Text>
                                <Text style={styles.filePreviewText}>
                                    {csvData.split('\n').length - 1} members ready to import
                                </Text>
                            </View>
                        ) : null}

                        <Text style={styles.dialogHint}>
                            Required format: FullName, Email, Phone (Date of Birth, Nationality, Gender, Gov ID, Blood Group, Medical Conditions, Allergies, Emergency Contact Name, Emergency Contact Phone are optional)
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => {
                            setBatchImportDialogVisible(false);
                            setCsvData("");
                        }}>Cancel</Button>
                        <Button 
                            onPress={onBatchImport} 
                            loading={importLoading} 
                            disabled={importLoading || !csvData.trim()}
                            mode="contained"
                        >
                            Import
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.6,
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
    batchImportSection: {
        marginBottom: 20,
        alignItems: 'center',
    },
    batchImportButton: {
        borderRadius: 12,
        borderColor: '#3b82f6',
        borderWidth: 2,
        width: '100%',
    },
    batchImportButtonLabel: {
        fontWeight: '600',
        fontSize: 14,
        color: '#3b82f6',
    },
    dialog: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
    },
    dialogTitle: {
        fontWeight: '700',
        fontSize: 20,
        color: '#1f2937',
    },
    dialogText: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    filePickerButton: {
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        marginBottom: 16,
    },
    filePickerButtonLabel: {
        fontWeight: '600',
        fontSize: 15,
        color: '#FFFFFF',
    },
    filePreview: {
        backgroundColor: '#dcfce7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    filePreviewTitle: {
        fontWeight: '600',
        fontSize: 14,
        color: '#166534',
        marginBottom: 4,
    },
    filePreviewText: {
        fontWeight: '400',
        fontSize: 13,
        color: '#15803d',
    },
    dialogHint: {
        fontSize: 11,
        color: '#9ca3af',
        fontStyle: 'italic',
        marginTop: 8,
    },
});
