import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { Shield, Truck, Phone } from 'lucide-react-native';

const EMERGENCY_SERVICES = [
    {
        id: 'police',
        title: 'Police',
        number: '100',
        icon: 'shield-account',
        cardBg: '#E8F0FE',
        iconBg: '#D4E4FC',
        iconColor: '#1A56DB',
        description: 'Crime & Security Emergency',
    },
    {
        id: 'medical',
        title: 'Medical Emergency',
        number: '108',
        icon: 'ambulance',
        cardBg: '#FEE8E8',
        iconBg: '#FCD4D4',
        iconColor: '#DC2626',
        description: 'Health & Ambulance Services',
    },
    {
        id: 'safety',
        title: 'Unified Emergency',
        number: '112',
        icon: 'phone-alert',
        cardBg: '#E8FEF0',
        iconBg: '#D4FCE4',
        iconColor: '#16A34A',
        description: 'National Emergency Helpline',
    },
];

const EmergencyServicesCard = () => {
    const handleCall = (number: string) => {
        Linking.openURL(`tel:${number}`);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Emergency Services</Text>
            <Text style={styles.subtitle}>Quick access to emergency helplines</Text>

            <View style={styles.cardsList}>
                {EMERGENCY_SERVICES.map((service) => (
                    <View
                        key={service.id}
                        style={[styles.card, { backgroundColor: service.cardBg }]}
                    >
                        {/* Left: Icon */}
                        <View style={[styles.iconContainer, { backgroundColor: service.iconBg }]}>
                            {service.id === 'police' && <Shield size={28} color={service.iconColor} />}
                            {service.id === 'medical' && <Truck size={28} color={service.iconColor} />}
                            {service.id === 'safety' && <Phone size={28} color={service.iconColor} />}
                        </View>

                        {/* Center: Info */}
                        <View style={styles.infoContainer}>
                            <Text style={styles.serviceName}>{service.title}</Text>
                            <Text style={styles.serviceDesc}>{service.description}</Text>
                        </View>

                        {/* Right: Call + Number */}
                        <View style={styles.rightSection}>
                            <TouchableOpacity
                                style={styles.callButton}
                                onPress={() => handleCall(service.number)}
                            >
                                <Phone size={22} color="#16A34A" />
                            </TouchableOpacity>
                            <Text style={styles.serviceNumber}>{service.number}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

export default EmergencyServicesCard;

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
        marginBottom: 18,
    },
    cardsList: {
        gap: 12,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        padding: 14,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 14,
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 2,
    },
    serviceDesc: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    rightSection: {
        alignItems: 'center',
        marginLeft: 10,
    },
    serviceNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 6,
    },
    callButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
});
