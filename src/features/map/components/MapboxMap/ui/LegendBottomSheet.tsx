import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { AlertTriangle, MapPin, Shield } from 'lucide-react-native';

interface LegendBottomSheetProps {
  isExpanded: boolean;
  onToggle: () => void;
  dangerZoneCount: number;
  riskGridCount: number;
  geofenceCount: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.7; // 70% of screen height

const THEME = {
  primary: '#0077CC',
  text: '#0F172A',
  subtext: '#64748B',
  background: '#FFFFFF',
  danger: '#EF4444',
  risk: '#F59E0B',
  geofence: '#3B82F6',
  low: '#22C55E',
  medium: '#EAB308',
  high: '#F97316',
  veryHigh: '#EF4444',
};

export default function LegendBottomSheet({
  isExpanded,
  onToggle,
  dangerZoneCount,
  riskGridCount,
  geofenceCount,
}: LegendBottomSheetProps) {
  // Animation - slide up/down
  const translateY = useSharedValue(EXPANDED_HEIGHT);

  useEffect(() => {
    translateY.value = withTiming(isExpanded ? 0 : EXPANDED_HEIGHT, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      height: EXPANDED_HEIGHT,
    };
  });

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      pointerEvents={isExpanded ? 'auto' : 'none'}
    >
      {/* Handle */}
      <TouchableOpacity style={styles.handleContainer} onPress={onToggle} activeOpacity={0.8}>
        <View style={styles.handle} />
      </TouchableOpacity>

      {/* Title */}


      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Statistics Grid */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{dangerZoneCount}</Text>
                <Text style={styles.statLabel}>Danger Zones</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{riskGridCount}</Text>
                <Text style={styles.statLabel}>Risk Grids</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{geofenceCount}</Text>
                <Text style={styles.statLabel}>Geofences</Text>
              </View>
            </View>

            {/* Zone Types Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Zone Types</Text>

              {/* Danger Zone */}
              <View style={styles.legendItem}>
                <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}> 
                  <AlertTriangle size={22} color={THEME.danger} />
                </View>
                <View style={styles.legendText}>
                  <Text style={styles.legendTitle}>Danger Zones</Text>
                  <View style={styles.patternInfo}>
                    <View style={[styles.borderDemo, styles.borderSolid, { borderColor: THEME.danger }]} />
                    <Text style={styles.patternText}>Solid Border • Diagonal Stripes</Text>
                  </View>
                </View>
              </View>

              {/* Risk Grid */}
              <View style={styles.legendItem}>
                <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}> 
                  <MapPin size={22} color={THEME.risk} />
                </View>
                <View style={styles.legendText}>
                  <Text style={styles.legendTitle}>Risk Grids</Text>
                  <View style={styles.patternInfo}>
                    <View style={[styles.borderDemo, styles.borderDashed, { borderColor: THEME.risk }]} />
                    <Text style={styles.patternText}>Dashed Border • Dot Pattern</Text>
                  </View>
                </View>
              </View>

              {/* Geofence */}
              <View style={styles.legendItem}>
                <View style={[styles.iconCircle, { backgroundColor: '#dbeafe' }]}> 
                  <Shield size={22} color={THEME.geofence} />
                </View>
                <View style={styles.legendText}>
                  <Text style={styles.legendTitle}>Geofences</Text>
                  <View style={styles.patternInfo}>
                    <View style={[styles.borderDemo, styles.borderDotted, { borderColor: THEME.geofence }]} />
                    <Text style={styles.patternText}>Dotted Border • Solid Fill</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Severity Colors Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Severity Colors</Text>

              <View style={styles.severityGrid}>
                <View style={styles.severityItem}>
                  <View style={[styles.severityColor, { backgroundColor: THEME.low }]} />
                  <Text style={styles.severityLabel}>Low Risk</Text>
                </View>
                <View style={styles.severityItem}>
                  <View style={[styles.severityColor, { backgroundColor: THEME.medium }]} />
                  <Text style={styles.severityLabel}>Medium</Text>
                </View>
                <View style={styles.severityItem}>
                  <View style={[styles.severityColor, { backgroundColor: THEME.high }]} />
                  <Text style={styles.severityLabel}>High Risk</Text>
                </View>
                <View style={styles.severityItem}>
                  <View style={[styles.severityColor, { backgroundColor: THEME.veryHigh }]} />
                  <Text style={styles.severityLabel}>Very High</Text>
                </View>
              </View>
            </View>

            {/* Additional Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Tap on any zone on the map to view detailed information, including recent incidents and risk scores.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 300,
    paddingBottom: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 48,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Statistics
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.subtext,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 12,
  },

  // Legend Items
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 22,
  },
  legendText: {
    flex: 1,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 4,
  },
  patternInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  borderDemo: {
    width: 30,
    height: 3,
    marginRight: 8,
    borderWidth: 1.5,
  },
  borderSolid: {
    // No additional styles needed
  },
  borderDashed: {
    borderStyle: 'dashed',
  },
  borderDotted: {
    borderStyle: 'dotted',
  },
  patternText: {
    fontSize: 12,
    color: THEME.subtext,
  },

  // Severity Colors
  severityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  severityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  severityColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
  },
  severityLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.text,
  },

  // Info Box
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
});
