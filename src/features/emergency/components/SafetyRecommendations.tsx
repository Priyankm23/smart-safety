import { Text, ActivityIndicator } from "react-native-paper"
import { View, StyleSheet } from "react-native"
import { Cloud, Bus, Moon, CreditCard, Phone } from 'lucide-react-native';
import { useEffect, useState } from "react";
import { fetchAllSafetyRecommendations, SafetyRecommendation } from "../../../services/safetyRecommendations";

const FALLBACK_TIPS: SafetyRecommendation[] = [
  {
    icon: 'weather-partly-cloudy',
    iconColor: '#5B9BD5',
    iconBg: '#D4EBFC',
    title: 'Weather Advisory',
    description: 'Check local weather conditions before heading out. Carry appropriate gear for sudden changes.',
    category: 'Weather',
  },
  {
    icon: 'bus',
    iconColor: '#3D9A6A',
    iconBg: '#D1F0E4',
    title: 'Transport Safety',
    description: 'Use verified transport services. Share your ride details with trusted contacts.',
    category: 'Transportation',
  },
  {
    icon: 'weather-night',
    iconColor: '#7A5BA5',
    iconBg: '#E8DDF5',
    title: 'Night Safety',
    description: 'Stay on well-lit main paths after sunset. Avoid isolated areas during late hours.',
    category: 'Night Travel',
  },
  {
    icon: 'wallet',
    iconColor: '#C98E3A',
    iconBg: '#FCECD4',
    title: 'Protect Valuables',
    description: 'Keep your belongings secure in crowded areas. Use anti-theft bags when possible.',
    category: 'Belongings',
  },
  {
    icon: 'phone-alert',
    iconColor: '#D66A6A',
    iconBg: '#FADED9',
    title: 'Emergency Ready',
    description: 'Save local emergency numbers. Keep your phone charged and location services on.',
    category: 'Emergency',
  },
];

export default function SafetyRecommendations() {
  const [recommendations, setRecommendations] = useState<SafetyRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        const data = await fetchAllSafetyRecommendations();
        setRecommendations(data);
        setError(false);
      } catch (err) {
        console.error('Failed to load safety recommendations:', err);
        setRecommendations(FALLBACK_TIPS);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, []);

  const displayTips = recommendations.length > 0 ? recommendations : FALLBACK_TIPS;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tips for Your Safety</Text>
      <Text style={styles.subtitle}>Stay informed and travel safely</Text>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#5B9BD5" />
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        </View>
      )}

      {!loading && (
        <View style={styles.tipsList}>
          {displayTips.map((tip, index) => (
            <View key={`tip${index}`} style={styles.tipItem}>
              <View style={[styles.iconContainer, { backgroundColor: tip.iconBg }]}>
                {(() => {
                  const IconMap: Record<string, any> = {
                    'weather-partly-cloudy': Cloud,
                    'bus': Bus,
                    'weather-night': Moon,
                    'wallet': CreditCard,
                    'phone-alert': Phone,
                  };
                  const IconComp = IconMap[tip.icon] || Cloud;
                  return <IconComp size={24} color={tip.iconColor} />;
                })()}
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
                <Text style={styles.tipCategory}>{tip.category}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  tipsList: {
    gap: 18,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tipContent: {
    flex: 1,
    paddingTop: 2,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 6,
    fontWeight: '500',
  },
  tipCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
