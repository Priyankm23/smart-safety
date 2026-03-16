import React, { useState } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput, Button, SegmentedButtons, HelperText, Menu, Text } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { showToast } from '../../../utils/toast';

interface ActivityNode {
  type: 'start' | 'visit' | 'stay' | 'transit' | 'end';
  name: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  address?: string;
  scheduledTime?: string;
  description?: string;
}

interface Props {
  onAddNode: (node: ActivityNode) => void;
}

export default function ActivityNodeForm({ onAddNode }: Props) {
  const [activityType, setActivityType] = useState<string>('visit');
  const [activityName, setActivityName] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [safetyNotes, setSafetyNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [showForm, setShowForm] = useState(true);

  const activityTypes = [
    { value: 'start', label: 'Start' },
    { value: 'visit', label: 'Visit' },
    { value: 'stay', label: 'Stay' },
    { value: 'transit', label: 'Transit' },
    { value: 'end', label: 'End' },
  ];

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedTime(selectedDate);
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setScheduledTime(`${hours}:${minutes}`);
    }
  };

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) {
      showToast('Please enter a location to search');
      return;
    }

    try {
      // Using Nominatim (OpenStreetMap) for geocoding - free API
      const query = encodeURIComponent(locationSearch);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
        {
          headers: {
            // Nominatim requires a User-Agent or Referer per usage policy
            'User-Agent': 'smart-safety-app/1.0 (expo client)'
          },
        }
      );
      if (!response.ok) {
        console.warn('[ActivityForm] geocode non-200', { status: response.status });
        showToast('Location lookup failed. Try again.');
        return;
      }
      const data = await response.json();

      if (data && data.length > 0) {
        const location = data[0];
        setCoordinates([parseFloat(location.lon), parseFloat(location.lat)]);
        setAddress(location.display_name);
        showToast('Location found!');
      } else {
        console.warn('[ActivityForm] geocode empty result');
        showToast('Location not found. Try a different search.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      showToast('Failed to search location. Please try again.');
    }
  };

  const handleAddActivity = () => {
    // Validation
    if (!activityName.trim()) {
      showToast('Please enter an activity name');
      return;
    }

    if (!coordinates) {
      showToast('Please search and select a location');
      return;
    }

    const newNode: ActivityNode = {
      type: activityType as any,
      name: activityName.trim(),
      location: {
        type: 'Point',
        coordinates: coordinates,
      },
      address: address || undefined,
      scheduledTime: scheduledTime || undefined,
      description: safetyNotes.trim() || (duration ? `Duration: ${duration}` : undefined),
    };

    onAddNode(newNode);

    // Reset form
    setActivityName('');
    setLocationSearch('');
    setAddress('');
    setCoordinates(null);
    setScheduledTime('');
    setSafetyNotes('');
    setDuration('');
    setShowForm(false);
    showToast('Activity added!');
  };

  if (!showForm) {
    return (
      <Button
        mode="contained-tonal"
        icon="plus"
        onPress={() => {
          setShowForm(true);
        }}
        style={styles.addButton}
      >
        Add Another Stop
      </Button>
    );
  }

  return (
    <View style={styles.container}>
      {/* Activity Type Selector */}
      <View style={styles.typeContainerWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeContainer}
        >
          {activityTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => setActivityType(type.value)}
              style={[
                styles.typeButton,
                activityType === type.value && styles.typeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  activityType === type.value && styles.typeButtonTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Activity Title */}
      <TextInput
        label="Activity Title *"
        value={activityName}
        onChangeText={setActivityName}
        mode="outlined"
        placeholder="e.g., Morning Hike"
        style={styles.input}
        outlineColor="#C2C2C2"
        activeOutlineColor="#C2C2C2"
        theme={{ colors: { background: '#FFFFFF' } }}
      />

      {/* Scheduled Time and Duration */}
      <View style={styles.timeRow}>
        <TextInput
          label="Start Time"
          value={scheduledTime}
          mode="outlined"
          placeholder="09:00 AM"
          style={[styles.input, styles.timeInput]}
          outlineColor="#C2C2C2"
          activeOutlineColor="#C2C2C2"
          theme={{ colors: { background: '#FFFFFF' } }}
          right={
            <TextInput.Icon
              icon="clock-outline"
              onPress={() => setShowTimePicker(true)}
            />
          }
          editable={false}
          onPressIn={() => setShowTimePicker(true)}
        />

        <TextInput
          label="Duration"
          value={duration}
          onChangeText={setDuration}
          mode="outlined"
          placeholder="1 hr"
          style={[styles.input, styles.durationInput]}
          outlineColor="#C2C2C2"
          activeOutlineColor="#C2C2C2"
          theme={{ colors: { background: '#FFFFFF' } }}
        />
      </View>

      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Location Search */}
      <TextInput
        label="Location *"
        value={locationSearch}
        onChangeText={setLocationSearch}
        mode="outlined"
        placeholder="Search for a place..."
        style={styles.input}
        outlineColor="#C2C2C2"
        activeOutlineColor="#C2C2C2"
        theme={{ colors: { background: '#FFFFFF' } }}
        left={<TextInput.Icon icon="magnify" />}
        right={
          <TextInput.Icon
            icon="map-marker-check"
            onPress={handleLocationSearch}
            disabled={!locationSearch.trim()}
          />
        }
      />
      {coordinates && (
        <HelperText type="info" visible={true}>
          ✓ Location set: {address?.slice(0, 50)}...
        </HelperText>
      )}

      {/* Safety Notes / Description */}
      <TextInput
        label="Safety Notes"
        value={safetyNotes}
        onChangeText={setSafetyNotes}
        mode="outlined"
        placeholder="Contact details, meeting point, or specific safety concerns..."
        multiline
        numberOfLines={3}
        style={styles.input}
        outlineColor="#C2C2C2"
        activeOutlineColor="#C2C2C2"
        theme={{ colors: { background: '#FFFFFF' } }}
      />

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={() => {
            setShowForm(false);
            // Reset form
            setActivityName('');
            setLocationSearch('');
            setAddress('');
            setCoordinates(null);
            setScheduledTime('');
            setSafetyNotes('');
            setDuration('');
          }}
          style={styles.clearButton}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAddActivity}
          style={styles.addActivityButton}
        >
          <Text style={styles.addActivityButtonText}>Add Activity</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 16,
  },
  typeContainerWrapper: {
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  typeButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  typeButtonText: {
    fontFamily: 'Roboto',
    fontSize: 15,
    lineHeight: 16,
    color: '#808080',
  },
  typeButtonTextSelected: {
    color: '#808080',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  durationInput: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 9,
  },
  clearButton: {
    flex: 1,
    height: 45,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C2C2C2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 24,
    color: '#000000',
    textAlign: 'center',
  },
  addActivityButton: {
    flex: 1,
    height: 45,
    backgroundColor: '#0C87DE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addActivityButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addButton: {
    marginTop: 16,
  },
});
