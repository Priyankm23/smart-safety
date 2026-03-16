import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { showToast } from '../../../utils/toast';
import { useApp } from '../../../context/AppContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TripDurationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { state } = useApp();
  const user = state.user as any;

  // Hide default stack header (e.g. "Plan your trip") for this screen
  useLayoutEffect(() => {
    try {
      (navigation as any).setOptions?.({ headerShown: false });
    } catch (e) {
      // ignore if navigation not available
    }
  }, [navigation]);
  
  const [tripDuration, setTripDuration] = useState(7);
  const [startDate, setStartDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  
  // Calculate return date based on duration
  const returnDate = new Date(startDate);
  returnDate.setDate(startDate.getDate() + tripDuration);

  // Logging: lifecycle and state changes for analytics / debugging
  useEffect(() => {
    console.log('[TripDuration] mounted', { touristId: user?.touristId });
    return () => {
      console.log('[TripDuration] unmounted');
    };
  }, []);

  useEffect(() => {
    try {
      console.log('[TripDuration] state', {
        tripDuration,
        startDate: startDate.toISOString(),
      });
    } catch (e) {
      // safe-guard: logging should not break UI
      console.warn('[TripDuration] logging failed', e);
    }
  }, [tripDuration, startDate]);

  const handleIncrement = () => {
    if (tripDuration < 150) {
      const next = tripDuration + 1;
      console.log('[TripDuration] increment', { previous: tripDuration, next });
      setTripDuration(next);
    }
  };

  const handleDecrement = () => {
    if (tripDuration > 1) {
      const next = tripDuration - 1;
      console.log('[TripDuration] decrement', { previous: tripDuration, next });
      setTripDuration(next);
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      console.log('[TripDuration] startDate selected', { selected: selectedDate.toISOString() });
      setStartDate(selectedDate);
    }
  };

  const handleNext = () => {
    if (tripDuration < 1) {
      console.warn('[TripDuration] validation failed: duration < 1');
      showToast('Please select at least 1 day');
      return;
    }

    if (!user?.touristId) {
      console.error('[TripDuration] missing touristId on user object', { user });
      showToast('User information not found. Please login again.');
      return;
    }

    // Navigate to itinerary builder with trip info
    const payload = {
      tripDuration,
      startDate: startDate.toISOString(),
      returnDate: returnDate.toISOString(),
      touristId: user.touristId,
    };
    console.log('[TripDuration] navigate -> BuildItinerary', payload);
    (navigation.navigate as any)('BuildItinerary', payload);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Pressable
        style={styles.backButton}
        onPress={() => (navigation as any).goBack?.()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#0C87DE" />
      </Pressable>

      <View style={styles.totalDurationCard}>
        <Text style={styles.totalLabel}>Total duration</Text>
        <View style={styles.durationRow}>
          <IconButton
            icon="minus"
            size={20}
            onPress={handleDecrement}
            disabled={tripDuration <= 1}
            style={styles.circleButton}
            iconColor="#0C87DE"
          />
          <View style={styles.durationCenter}>
            <Text style={styles.durationNumber}>{tripDuration}</Text>
            <Text style={styles.durationUnit}>Days</Text>
          </View>
          <IconButton
            icon="plus"
            size={20}
            onPress={handleIncrement}
            disabled={tripDuration >= 150}
            style={styles.circleButton}
            iconColor="#0C87DE"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Starting Date</Text>
        <Pressable style={styles.inputField} onPress={() => setShowStartPicker(true)}>
          <Text style={styles.inputValue}>
            {startDate.toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
            })}
          </Text>
          <MaterialCommunityIcons name="calendar-month" size={20} color="#9CA4AB" />
        </Pressable>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
          minimumDate={new Date()}
        />
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ending Date</Text>
        <View style={styles.inputField}>
          <Text style={styles.inputValue}>
            {returnDate.toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
            })}
          </Text>
          <MaterialCommunityIcons name="calendar-month" size={20} color="#9CA4AB" />
        </View>
      </View>

      <Button
        mode="contained"
        onPress={handleNext}
        style={styles.nextButton}
        contentStyle={styles.nextButtonContent}
      >
        Build Itinerary
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 34,
    paddingTop: 92,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 67,
    left: 30,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  totalDurationCard: {
    alignItems: 'center',
    marginBottom: 36,
    width: '100%',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#939393',
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  durationCenter: {
    alignItems: 'center',
  },
  durationNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0C87DE',
  },
  durationUnit: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#939393',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C87DE',
    marginBottom: 8,
  },
  inputField: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  inputValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA4AB',
  },
  nextButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#0C87DE',
  },
  nextButtonContent: {
    height: 52,
  },
});
