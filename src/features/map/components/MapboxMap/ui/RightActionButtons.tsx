import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface RightActionButtonsProps {
    onCompassPress?: () => void;
    onLayersPress?: () => void;
    onSOSPress?: () => void;
    onDirectionsPress?: () => void;
    onLegendPress?: () => void;
    hideDirectionsButton?: boolean;
    hideCompassButton?: boolean;
    customBottom?: number;
    visible?: boolean;
}

export default function RightActionButtons({
    onCompassPress,
    onLayersPress,
    onSOSPress,
    onDirectionsPress,
    onLegendPress,
    hideDirectionsButton = false,
    hideCompassButton = false,
    customBottom,
    visible = true,
}: RightActionButtonsProps) {
    if (!visible) return null;
    return (
        <View style={[styles.container, customBottom !== undefined && { bottom: customBottom }]}>
            {/* Main Action Group */}
            <View style={styles.buttonGroup}>
                {/* Compass / Navigation Button */}
                {!hideCompassButton && (
                    <TouchableOpacity
                        style={[styles.button, styles.compassButton]}
                        onPress={onCompassPress}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#2563EB" />
                    </TouchableOpacity>
                )}

                {/* Directions Button */}
                {!hideDirectionsButton && (
                    <TouchableOpacity
                        style={[styles.button, styles.directionsButton]}
                        onPress={onDirectionsPress}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="directions" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                )}

                {/* Layers Button */}
                <TouchableOpacity
                    style={[styles.button, styles.layersButton]}
                    onPress={onLayersPress}
                    activeOpacity={0.85}
                >
                    <MaterialCommunityIcons name="layers-outline" size={20} color="#6366F1" />
                </TouchableOpacity>

                {/* Legend Button */}
                {onLegendPress && (
                    <TouchableOpacity
                        style={[styles.button, styles.legendButton]}
                        onPress={onLegendPress}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="map-legend" size={20} color="#10B981" />
                    </TouchableOpacity>
                )}
            </View>

            {/* SOS Button - Separate for emphasis */}
            <TouchableOpacity
                style={[styles.button, styles.sosButton]}
                onPress={onSOSPress}
                activeOpacity={0.85}
            >
                <MaterialCommunityIcons name="shield-alert" size={22} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 14,
        bottom: 100,
        zIndex: 10,
        elevation: 10,
        gap: 14,
    },
    buttonGroup: {
        gap: 8,
    },
    button: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    compassButton: {
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
    },
    directionsButton: {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe',
    },
    layersButton: {
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
    },
    legendButton: {
        backgroundColor: '#f0fdf4',
        borderColor: '#d1fae5',
    },
    sosButton: {
        backgroundColor: '#EF4444',
        borderColor: '#dc2626',
        width: 52,
        height: 52,
        borderRadius: 16,
    },
});
