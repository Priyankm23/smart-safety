/**
 * Path Deviation Context
 * Manages journey state, deviation status, and real-time updates
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Vibration, AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import type { WebView } from 'react-native-webview';
import { useApp } from './AppContext';
import { sendSMS } from '../utils/sms';
import { queueSMS } from '../utils/smsQueue';
import {
  pathDeviationService,
  JourneyConfig,
  DeviationStatus,
  GPSPoint,
  RouteInfo,
} from '../services/pathDeviationService';
import { 
  pathDeviationWebSocket,
  type DeviationUpdateMessage 
} from '../services/pathDeviationWebSocket';
import { 
  getNextInstruction, 
  CurrentInstruction 
} from '../services/turnByTurnService';
import { RouteStep, Route } from '../features/map/services/mapboxDirectionsService';

export interface DeviationAlert {
  id: string;
  severity: DeviationStatus['severity'];
  message: string;
  timestamp: Date;
  deviation: DeviationStatus;
}

export type DeviationScenario = 'normal' | 'deviation' | 'stop' | 'slow' | 'fast';
export type SimulationSpeed = 1 | 5 | 10 | 50 | 100;

interface PathDeviationContextType {
  // Journey state
  journeyId: string | null;
  isTracking: boolean;
  isConnected: boolean;
  routes: RouteInfo[];
  
  // Deviation state
  deviationStatus: DeviationStatus | null;
  routeProbabilities: Record<string, number>;
  progressPercentage: number;
  timeDeviation: number;
  
  // Navigation info
  currentSpeed: number; // km/h
  distanceTraveled: number; // meters
  distanceRemaining: number; // meters
  estimatedTimeRemaining: number; // seconds
  currentInstruction: CurrentInstruction | null;
  
  // Alerts
  alerts: DeviationAlert[];
  alertsMuted: boolean;
  
  // Deviation Testing
  deviationScenario: DeviationScenario;
  setDeviationScenario: (scenario: DeviationScenario) => void;
  
  // GPS Simulation
  isSimulating: boolean;
  simulationSpeed: SimulationSpeed;
  simulationProgress: number; // 0-100 percentage
  startSimulation: (speed?: SimulationSpeed) => void;
  stopSimulation: () => void;
  setSimulationSpeed: (speed: SimulationSpeed) => void;
  
  // Methods
  startJourney: (config: JourneyConfig, route?: Route) => Promise<void>;
  stopJourney: () => Promise<void>;
  dismissAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  setMapRef: (ref: React.RefObject<WebView> | null) => void;
  recenterMap: () => void;
  toggleMuteAlerts: () => void;
}

const PathDeviationContext = createContext<PathDeviationContextType | null>(null);
const OFF_ROUTE_SMS_COOLDOWN_MS = 5 * 60 * 1000;

export const PathDeviationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useApp();
  // State
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [deviationStatus, setDeviationStatus] = useState<DeviationStatus | null>(null);
  const [routeProbabilities, setRouteProbabilities] = useState<Record<string, number>>({});
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [timeDeviation, setTimeDeviation] = useState(0);
  const [alerts, setAlerts] = useState<DeviationAlert[]>([]);
  
  // Navigation info state
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [distanceTraveled, setDistanceTraveled] = useState(0); // meters
  const [distanceRemaining, setDistanceRemaining] = useState(0); // meters
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0); // seconds
  const [currentInstruction, setCurrentInstruction] = useState<CurrentInstruction | null>(null);
  const [alertsMuted, setAlertsMuted] = useState(false);
  const [deviationScenario, setDeviationScenario] = useState<DeviationScenario>('normal');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(10);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Sync deviationScenario state with ref for use in interval callback
  useEffect(() => {
    deviationScenarioRef.current = deviationScenario;
  }, [deviationScenario]);

  // Sync simulationSpeed with ref
  useEffect(() => {
    simulationSpeedRef.current = simulationSpeed;
  }, [simulationSpeed]);

  // Refs
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastGPSPointRef = useRef<GPSPoint | null>(null);
  const destinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const originRef = useRef<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<React.RefObject<WebView> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const routeStepsRef = useRef<RouteStep[]>([]);
  const currentStepIndexRef = useRef<number>(0);
  const totalRouteDistanceRef = useRef<number>(0); // Total route distance in meters
  const totalRouteDurationRef = useRef<number>(0); // Total route duration in seconds
  const distanceTraveledRef = useRef<number>(0); // Track distance traveled in a ref for accurate calculations
  const isTrackingActiveRef = useRef<boolean>(false); // Flag to prevent GPS updates after journey stops
  const deviationScenarioRef = useRef<DeviationScenario>('normal'); // Current deviation scenario for GPS modification
  const simulationSpeedRef = useRef<SimulationSpeed>(10); // Simulation speed multiplier
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null); // Simulation interval
  const simulationIndexRef = useRef<number>(0); // Current index in route coordinates
  const routeCoordinatesRef = useRef<[number, number][]>([]); // Route coordinates for simulation [lng, lat]
  const appStateRef = useRef(state);
  const lastOffRouteSmsAtRef = useRef<number>(0);
  const wasOffRouteRef = useRef<boolean>(false);

  useEffect(() => {
    appStateRef.current = state;
  }, [state]);

  /**
   * Set map reference for sending tracking updates
   */
  const setMapRef = useCallback((ref: React.RefObject<WebView> | null) => {
    mapRef.current = ref;
  }, []);

  /**
   * Send message to map WebView
   */
  const sendToMap = useCallback((message: any) => {
    if (mapRef.current && mapRef.current.current) {
      mapRef.current.current.postMessage(JSON.stringify(message));
    } else {
      // Map ref not available
      console.warn('[PathDeviation] Map ref not available for:', message.type);
    }
  }, []);

  const buildDeviationSmsMessage = useCallback((deviation: DeviationStatus) => {
    const currentState = appStateRef.current;
    const gpsPoint = lastGPSPointRef.current;
    const coords = gpsPoint ? `${gpsPoint.lat.toFixed(6)},${gpsPoint.lng.toFixed(6)}` : null;
    const travelerName = currentState.user?.name || 'Unknown Tourist';
    const travelerPhone = currentState.user?.phone || '';
    const mapLink = coords ? `https://maps.google.com/?q=${coords}` : null;

    const parts: string[] = [];
    parts.push('Path Deviation Alert: OFF_ROUTE');
    parts.push(`Name: ${travelerName}`);
    if (travelerPhone) parts.push(`Phone: ${travelerPhone}`);
    parts.push(`Severity: ${deviation.severity}`);
    parts.push(`Spatial: ${deviation.spatial}`);
    parts.push(`Temporal: ${deviation.temporal}`);
    parts.push(`Directional: ${deviation.directional}`);
    if (mapLink) parts.push(`Map: ${mapLink}`);
    return parts.join('\n');
  }, []);

  const sendDeviationSmsToContacts = useCallback(async (deviation: DeviationStatus): Promise<boolean> => {
    const currentState = appStateRef.current;
    if (currentState.user?.role !== 'solo') {
      return false;
    }

    const emergencyContact = (currentState.user as any)?.emergencyContact;
    const phoneCandidates = Array.isArray(emergencyContact)
      ? emergencyContact.map((c: any) => c?.phone || c?.mobile || c?.number)
      : [emergencyContact?.phone || emergencyContact?.mobile || emergencyContact?.number];
    const primaryRecipient = phoneCandidates.find(
      (phone: unknown): phone is string => typeof phone === 'string' && phone.trim().length > 0,
    )?.trim();

    if (!primaryRecipient) {
      console.warn('[PathDeviation] Skipping deviation SMS: no emergency contact phone for solo user');
      return false;
    }

    const recipients = Array.from(
      new Set(
        [currentState.authorityPhone, primaryRecipient]
          .filter((phone): phone is string => typeof phone === 'string' && phone.trim().length > 0)
          .map((phone) => phone.trim()),
      ),
    );
    if (!recipients.length) {
      console.warn('[PathDeviation] Skipping deviation SMS: no valid recipients');
      return false;
    }

    const message = buildDeviationSmsMessage(deviation);
    const payload = { recipients, message };

    if (currentState.offline) {
      try {
        await queueSMS({ payload });
      } catch (error) {
        console.warn('[PathDeviation] Failed queueing deviation SMS:', error);
        return false;
      }
      return true;
    }

    try {
      const smsRes = await sendSMS(payload);
      if (!smsRes.ok) {
        await queueSMS({ payload });
      }
    } catch (error) {
      console.warn('[PathDeviation] SMS send threw, queueing for retry', error);
      try {
        await queueSMS({ payload });
      } catch (queueError) {
        console.warn('[PathDeviation] Failed queueing deviation SMS:', queueError);
        return false;
      }
    }
    return true;
  }, [buildDeviationSmsMessage]);

  /**
   * Handle alerts based on deviation severity
   */
  const handleDeviationAlerts = async (deviation: DeviationStatus) => {
    // Skip if alerts are muted
    if (alertsMuted) {
      return;
    }

    // Vibration for moderate+ deviations
    if (deviation.severity === 'moderate' || deviation.severity === 'concerning') {
      Vibration.vibrate([0, 200, 100, 200]);
    } else if (deviation.severity === 'major') {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    }

    // System alert for major deviations
    if (deviation.severity === 'major') {
      Alert.alert(
        '⚠️ Major Route Deviation',
        'You are significantly off route. Please check your navigation.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Setup WebSocket event listeners
   */
  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleDeviationUpdate = (message: DeviationUpdateMessage) => {
      
      setDeviationStatus(message.deviation);
      
      if (message.route_probabilities) {
        setRouteProbabilities(message.route_probabilities);
      }

      // Show/hide deviation circle on map based on spatial status
      if (lastGPSPointRef.current) {
        if (message.deviation.spatial === 'OFF_ROUTE' || message.deviation.spatial === 'NEAR_ROUTE') {
          sendToMap({
            type: 'showDeviation',
            lng: lastGPSPointRef.current.lng,
            lat: lastGPSPointRef.current.lat,
            radius: message.deviation.spatial === 'OFF_ROUTE' ? 100 : 50,
          });
        } else {
          sendToMap({ type: 'hideDeviation' });
        }
      }

      // Create alert for significant deviations
      if (message.deviation.severity !== 'normal') {
        const alert = createAlert(message.deviation);
        setAlerts(prev => [alert, ...prev].slice(0, 10)); // Keep last 10 alerts

        // Trigger alerts based on severity
        handleDeviationAlerts(message.deviation);
      }

      // Send solo user emergency-contact SMS only when truly off route.
      const isOffRoute = message.deviation.spatial === 'OFF_ROUTE';
      if (isOffRoute) {
        const now = Date.now();
        const enteredOffRoute = !wasOffRouteRef.current;
        const cooldownElapsed = now - lastOffRouteSmsAtRef.current >= OFF_ROUTE_SMS_COOLDOWN_MS;

        if (enteredOffRoute || cooldownElapsed) {
          sendDeviationSmsToContacts(message.deviation)
            .then((sentOrQueued) => {
              if (sentOrQueued) {
                lastOffRouteSmsAtRef.current = now;
              }
            })
            .catch((error) => {
              console.warn('[PathDeviation] Failed sending deviation SMS:', error);
            });
        } else {
          // OFF_ROUTE cooldown active
        }
      }
      wasOffRouteRef.current = isOffRoute;
    };

    const handleError = (data: any) => {
      console.error('[PathDeviation] WebSocket error:', data.error);
    };

    pathDeviationWebSocket.on('connected', handleConnected);
    pathDeviationWebSocket.on('disconnected', handleDisconnected);
    pathDeviationWebSocket.on('deviation_update', handleDeviationUpdate);
    pathDeviationWebSocket.on('error', handleError);

    return () => {
      pathDeviationWebSocket.off('connected', handleConnected);
      pathDeviationWebSocket.off('disconnected', handleDisconnected);
      pathDeviationWebSocket.off('deviation_update', handleDeviationUpdate);
      pathDeviationWebSocket.off('error', handleError);
    };
  }, [handleDeviationAlerts, sendDeviationSmsToContacts, sendToMap]);

  /**
   * Create alert from deviation status
   */
  const createAlert = (deviation: DeviationStatus): DeviationAlert => {
    let message = '';
    
    if (deviation.spatial === 'OFF_ROUTE') {
      message = 'You are off the planned route!';
    } else if (deviation.spatial === 'NEAR_ROUTE') {
      message = 'You are near the edge of the route.';
    }
    
    if (deviation.temporal === 'SEVERELY_DELAYED') {
      message += ' You are significantly delayed.';
    } else if (deviation.temporal === 'STOPPED') {
      message += ' You have been stopped for a while.';
    }
    
    if (deviation.directional === 'AWAY') {
      message += ' You are moving away from the destination!';
    }

    if (!message) {
      message = 'Minor route deviation detected.';
    }

    return {
      id: Date.now().toString(),
      severity: deviation.severity,
      message,
      timestamp: new Date(),
      deviation,
    };
  };

  /**
   * Start a journey
   */
  const startJourney = useCallback(async (config: JourneyConfig, route?: Route) => {
    try {
      // Store route steps if provided
      if (route) {
        const allSteps: RouteStep[] = [];
        route.legs.forEach(leg => {
          allSteps.push(...leg.steps);
        });
        routeStepsRef.current = allSteps;
        currentStepIndexRef.current = 0;
        
        // Store route coordinates for GPS simulation
        if (route.geometry && route.geometry.coordinates) {
          routeCoordinatesRef.current = route.geometry.coordinates;
        }
        
        // Store total route distance and duration for accurate ETA calculation
        totalRouteDistanceRef.current = route.distance; // meters
        totalRouteDurationRef.current = route.duration; // seconds
        
        // Initialize distance remaining with actual route distance
        setDistanceRemaining(route.distance);
      }
      
      // Start journey on backend
      const response = await pathDeviationService.startJourney(config);
      
      setJourneyId(response.journey_id);
      setRoutes(response.routes);
      setIsTracking(true);
      destinationRef.current = config.destination;
      originRef.current = config.origin;
      startTimeRef.current = new Date();
      
      // Initialize distance states
      if (!route) {
        // If no route provided, fall back to straight-line distance
        const initialDistance = calculateDistance(
          config.origin.lat,
          config.origin.lng,
          config.destination.lat,
          config.destination.lng
        );
        setDistanceRemaining(initialDistance);
      }
      setDistanceTraveled(0);
      setCurrentSpeed(0);
      wasOffRouteRef.current = false;
      lastOffRouteSmsAtRef.current = 0;
      
      // Connect to WebSocket for real-time updates
      pathDeviationWebSocket.connect(response.journey_id);
      
      // Start GPS tracking
      startGPSTracking(response.journey_id);
    } catch (error) {
      console.error('[PathDeviation] Error starting journey:', error);
      Alert.alert(
        'Error',
        'Could not start path deviation tracking. Please try again.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  }, []);

  /**
   * Start GPS tracking
   */
  const startGPSTracking = useCallback((journeyId: string) => {
    // Clear any existing interval
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
    }

    // Set tracking active flag
    isTrackingActiveRef.current = true;

    // Tell map to start tracking mode
    sendToMap({ type: 'startTracking' });

    // Send GPS points every 2-3 seconds
    gpsIntervalRef.current = setInterval(async () => {
      // Check if tracking is still active (prevents updates after journey stops)
      if (!isTrackingActiveRef.current) {
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        // Apply deviation scenario modifications to GPS data
        let modifiedLocation = { ...location };
        let modifiedSpeed = location.coords.speed || 0;

        // Use ref to get current scenario (not captured in closure)
        const currentScenario = deviationScenarioRef.current;

        switch (currentScenario) {
          case 'deviation':
            // Add offset to simulate wrong turn (similar to web simulator)
            // Add sinusoidal offset to make it look like a wrong turn
            const deviationFactor = Math.sin(Date.now() / 10000) * 0.5 + 0.5; // 0-1 oscillating
            modifiedLocation = {
              ...location,
              coords: {
                ...location.coords,
                latitude: location.coords.latitude + (0.004 * deviationFactor), // ~400m offset at peak
                longitude: location.coords.longitude + (0.003 * deviationFactor), // ~300m offset at peak
              }
            };
            break;
            
          case 'stop':
            // Simulate extended stop with very low or zero speed
            modifiedSpeed = Math.random() < 0.7 ? 0 : 0.5; // 70% chance of 0, 30% chance of 0.5 m/s
            break;
            
          case 'slow':
            // Simulate slow traffic (15-30 km/h = 4.17-8.33 m/s)
            modifiedSpeed = (15 + Math.random() * 15) / 3.6; // Convert km/h to m/s
            break;
            
          case 'fast':
            // Simulate highway speed (90-120 km/h = 25-33.33 m/s)
            modifiedSpeed = (90 + Math.random() * 30) / 3.6; // Convert km/h to m/s
            break;
            
          case 'normal':
          default:
            // No modifications for normal scenario
            break;
        }

        const gpsPoint: GPSPoint = {
          lat: modifiedLocation.coords.latitude,
          lng: modifiedLocation.coords.longitude,
          timestamp: new Date(modifiedLocation.timestamp).toISOString(),
          speed: modifiedSpeed || undefined,
          bearing: location.coords.heading || undefined,
          accuracy: location.coords.accuracy || undefined,
        };

        // Update speed (convert m/s to km/h)
        const speedKmh = (location.coords.speed || 0) * 3.6;
        setCurrentSpeed(speedKmh);

        // Calculate distance traveled (only if actually moving, not GPS drift)
        // Minimum movement threshold: 5 meters (to filter GPS noise)
        const MIN_MOVEMENT_METERS = 5;
        let newDistanceTraveled = distanceTraveledRef.current;
        
        if (lastGPSPointRef.current) {
          const distance = calculateDistance(
            lastGPSPointRef.current.lat,
            lastGPSPointRef.current.lng,
            gpsPoint.lat,
            gpsPoint.lng
          );
          
          // Only count distance if it's meaningful movement (not GPS drift)
          // GPS drift typically causes small movements of 1-3 meters
          if (distance >= MIN_MOVEMENT_METERS) {
            newDistanceTraveled += distance;
            distanceTraveledRef.current = newDistanceTraveled;
            setDistanceTraveled(newDistanceTraveled);
          }
        }

        // Calculate remaining distance and ETA based on route progress
        if (destinationRef.current) {
          // Use route-based distance if available, otherwise fall back to straight-line
          let remainingDist: number;
          
          if (totalRouteDistanceRef.current > 0) {
            // Calculate remaining distance along the route
            remainingDist = Math.max(0, totalRouteDistanceRef.current - newDistanceTraveled);
            setDistanceRemaining(remainingDist);
          } else {
            // Fallback to straight-line distance
            remainingDist = calculateDistance(
              gpsPoint.lat,
              gpsPoint.lng,
              destinationRef.current.lat,
              destinationRef.current.lng
            );
            setDistanceRemaining(remainingDist);
          }

          // Minimum speed threshold to ignore GPS drift/noise
          // Speeds below 5 km/h are likely GPS noise when stationary
          const MIN_SPEED_THRESHOLD_KMH = 5;
          const isMoving = speedKmh >= MIN_SPEED_THRESHOLD_KMH;

          // Calculate estimated time remaining (in seconds)
          if (isMoving) {
            // Use actual speed: time (seconds) = distance (meters) / speed (m/s)
            const speedMps = speedKmh / 3.6;
            const timeRemaining = remainingDist / speedMps;
            setEstimatedTimeRemaining(Math.round(timeRemaining));
          } else if (totalRouteDurationRef.current > 0 && totalRouteDistanceRef.current > 0) {
            // User is stationary or moving very slowly (GPS drift)
            // Use route's estimated duration based on progress
            const progressPercentage = Math.min(1, newDistanceTraveled / totalRouteDistanceRef.current);
            const remainingDuration = totalRouteDurationRef.current * (1 - progressPercentage);
            setEstimatedTimeRemaining(Math.round(remainingDuration));
          } else {
            // Fallback: estimate based on average speed (30 km/h for driving)
            const avgSpeedMps = 30 / 3.6;
            const timeRemaining = remainingDist / avgSpeedMps;
            setEstimatedTimeRemaining(Math.round(timeRemaining));
          }
        }

        // Update turn-by-turn instruction
        if (routeStepsRef.current.length > 0) {
          const instruction = getNextInstruction(
            gpsPoint.lat,
            gpsPoint.lng,
            routeStepsRef.current,
            currentStepIndexRef.current
          );
          
          if (instruction) {
            // Update step index if changed
            if (instruction.stepIndex !== currentStepIndexRef.current) {
              currentStepIndexRef.current = instruction.stepIndex;
            }
            setCurrentInstruction(instruction);
          }
        }

        // Check if tracking is still active before sending to backend
        if (!isTrackingActiveRef.current) {
          return;
        }

        // Send to backend
        await pathDeviationService.sendGPSPoint(journeyId, gpsPoint);
        lastGPSPointRef.current = gpsPoint;

        // Update map with user's current position
        sendToMap({
          type: 'updateUserTracking',
          lng: gpsPoint.lng,
          lat: gpsPoint.lat,
          bearing: gpsPoint.bearing,
          speed: gpsPoint.speed,
        });

        // Check if reached destination (within 50 meters)
        if (destinationRef.current) {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            destinationRef.current.lat,
            destinationRef.current.lng
          );

          if (distance < 50) {
            stopJourney();
          }
        }
      } catch (error) {
        console.error('[PathDeviation] Error getting GPS location:', error);
      }
    }, 2500); // Every 2.5 seconds
  }, [sendToMap]);

  /**
   * Calculate distance between two points (Haversine formula)
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  /**
   * Stop journey
   */
  const stopJourney = useCallback(async () => {
    try {
      // Set tracking inactive FIRST to prevent any in-flight GPS updates
      isTrackingActiveRef.current = false;
      
      // Stop GPS tracking
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }

      // Stop tracking visualization on map
      sendToMap({ type: 'stopTracking' });
      sendToMap({ type: 'hideDeviation' });

      // Complete journey on backend
      if (journeyId) {
        await pathDeviationService.completeJourney(journeyId);
      }

      // Disconnect WebSocket
      pathDeviationWebSocket.disconnect();

      // Reset state
      setJourneyId(null);
      setIsTracking(false);
      setIsConnected(false);
      setDeviationStatus(null);
      setRouteProbabilities({});
      setProgressPercentage(0);
      setTimeDeviation(0);
      setCurrentInstruction(null);
      destinationRef.current = null;
      lastGPSPointRef.current = null;
      routeStepsRef.current = [];
      currentStepIndexRef.current = 0;
      totalRouteDistanceRef.current = 0;
      totalRouteDurationRef.current = 0;
      distanceTraveledRef.current = 0;
      wasOffRouteRef.current = false;
      lastOffRouteSmsAtRef.current = 0;
    } catch (error) {
      console.error('[PathDeviation] Error stopping journey:', error);
    }
  }, [journeyId, sendToMap]);

  /**
   * Dismiss alert
   */
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  /**
   * Clear all alerts
   */
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  /**
   * Re-center map on user's current location
   */
  const recenterMap = useCallback(() => {
    sendToMap({ type: 'recenterOnUser' });
  }, [sendToMap]);

  /**
   * Toggle mute/unmute alerts
   */
  const toggleMuteAlerts = useCallback(() => {
    setAlertsMuted(prev => !prev);
  }, []);

  /**
   * Calculate bearing between two points
   */
  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const toDeg = (rad: number) => rad * 180 / Math.PI;

    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

    let bearing = toDeg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360;
    return bearing;
  };

  /**
   * Get speed based on scenario for simulation
   */
  const getSpeedForScenario = (baseSpeedKmh: number): number => {
    const scenario = deviationScenarioRef.current;
    switch (scenario) {
      case 'stop':
        return Math.random() < 0.7 ? 0.5 : baseSpeedKmh * 0.3;
      case 'slow':
        return 15 + Math.random() * 15; // 15-30 km/h
      case 'fast':
        return 90 + Math.random() * 30; // 90-120 km/h
      default:
        return 50 + Math.random() * 30; // 50-80 km/h for normal
    }
  };

  /**
   * Start GPS simulation - walks through route coordinates
   */
  const startSimulation = useCallback((speed?: SimulationSpeed) => {
    if (!journeyId) {
      Alert.alert('Error', 'No active journey. Please start navigation first.');
      return;
    }

    const coordinates = routeCoordinatesRef.current;
    if (!coordinates || coordinates.length === 0) {
      Alert.alert('Error', 'No route coordinates available for simulation.');
      return;
    }

    // Stop real GPS tracking first
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }

    // Set simulation speed if provided
    if (speed) {
      setSimulationSpeed(speed);
      simulationSpeedRef.current = speed;
    }

    const currentSpeed = speed || simulationSpeedRef.current;
    
    // Calculate interval and points to skip based on multiplier
    const baseInterval = Math.max(100, 500 / Math.sqrt(currentSpeed));
    const pointsPerUpdate = Math.max(1, Math.floor(currentSpeed / 5));

    setIsSimulating(true);
    simulationIndexRef.current = 0;
    setSimulationProgress(0);

    // Ensure map tracking mode is active for simulation
    sendToMap({ type: 'startTracking' });

    // Clear any existing simulation interval
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    // Start simulation interval
    simulationIntervalRef.current = setInterval(async () => {
      const coords = routeCoordinatesRef.current;
      const currentIndex = simulationIndexRef.current;

      // Check if we've reached the end
      if (currentIndex >= coords.length) {
        stopSimulation();
        return;
      }

      // Get current coordinate [lng, lat]
      let [lng, lat] = coords[currentIndex];

      // Apply deviation scenario modifications
      const scenario = deviationScenarioRef.current;
      if (scenario === 'deviation') {
        // Add deviation in middle of route (30-70% of journey)
        const progress = currentIndex / coords.length;
        if (progress > 0.3 && progress < 0.7) {
          const deviationFactor = Math.sin((progress - 0.3) / 0.4 * Math.PI);
          lat += 0.004 * deviationFactor; // ~400m offset at peak
          lng += 0.003 * deviationFactor; // ~300m offset at peak
        }
      }

      // Calculate bearing to next point
      let bearing = 0;
      if (currentIndex < coords.length - 1) {
        const [nextLng, nextLat] = coords[currentIndex + 1];
        bearing = calculateBearing(lat, lng, nextLat, nextLng);
      }

      // Get simulated speed based on scenario
      const baseSpeedKmh = 60 * simulationSpeedRef.current;
      const simulatedSpeedKmh = getSpeedForScenario(baseSpeedKmh);
      const simulatedSpeedMps = simulatedSpeedKmh / 3.6; // Convert to m/s

      // Create GPS point
      const gpsPoint: GPSPoint = {
        lat,
        lng,
        timestamp: new Date().toISOString(),
        speed: simulatedSpeedMps,
        bearing,
        accuracy: 5 + Math.random() * 10, // 5-15m simulated accuracy
      };

      try {
        // Send to backend
        await pathDeviationService.sendGPSPoint(journeyId, gpsPoint);
        lastGPSPointRef.current = gpsPoint;

        // Update UI state
        setCurrentSpeed(simulatedSpeedKmh);
        
        // Calculate distance traveled
        const progressPercent = (currentIndex / coords.length) * 100;
        setSimulationProgress(progressPercent);
        
        const distTraveled = (totalRouteDistanceRef.current * currentIndex) / coords.length;
        setDistanceTraveled(distTraveled);
        distanceTraveledRef.current = distTraveled;
        
        const distRemaining = totalRouteDistanceRef.current - distTraveled;
        setDistanceRemaining(distRemaining);

        // Calculate ETA
        if (simulatedSpeedMps > 0) {
          const timeRemaining = distRemaining / simulatedSpeedMps;
          setEstimatedTimeRemaining(Math.round(timeRemaining));
        }

        // Update turn-by-turn instruction
        if (routeStepsRef.current.length > 0) {
          const instruction = getNextInstruction(
            lat,
            lng,
            routeStepsRef.current,
            currentStepIndexRef.current
          );
          if (instruction) {
            if (instruction.stepIndex !== currentStepIndexRef.current) {
              currentStepIndexRef.current = instruction.stepIndex;
            }
            setCurrentInstruction(instruction);
          }
        }

        // Update map
        sendToMap({
          type: 'updateUserTracking',
          lng: gpsPoint.lng,
          lat: gpsPoint.lat,
          bearing: gpsPoint.bearing,
          speed: gpsPoint.speed,
        });

      } catch (error) {
        console.error('[Simulation] Error sending GPS point:', error);
      }

      // Move to next point(s)
      simulationIndexRef.current += pointsPerUpdate;

    }, baseInterval);

  }, [journeyId, sendToMap]);

  /**
   * Stop GPS simulation
   */
  const stopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    setIsSimulating(false);
    simulationIndexRef.current = 0;

    // Restart real GPS tracking if journey is still active
    if (journeyId && isTrackingActiveRef.current) {
      startGPSTracking(journeyId);
    }
  }, [journeyId, startGPSTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      pathDeviationWebSocket.disconnect();
    };
  }, []);

  // Keep WebSocket alive across app background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (journeyId && isTrackingActiveRef.current && !pathDeviationWebSocket.isConnected()) {
          pathDeviationWebSocket.connect(journeyId);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [journeyId]);

  const value: PathDeviationContextType = {
    journeyId,
    isTracking,
    isConnected,
    routes,
    deviationStatus,
    routeProbabilities,
    progressPercentage,
    timeDeviation,
    currentSpeed,
    distanceTraveled,
    distanceRemaining,
    estimatedTimeRemaining,
    currentInstruction,
    alerts,
    alertsMuted,
    deviationScenario,
    setDeviationScenario,
    isSimulating,
    simulationSpeed,
    simulationProgress,
    startSimulation,
    stopSimulation,
    setSimulationSpeed,
    startJourney,
    stopJourney,
    dismissAlert,
    clearAllAlerts,
    setMapRef,
    recenterMap,
    toggleMuteAlerts,
  };

  return (
    <PathDeviationContext.Provider value={value}>
      {children}
    </PathDeviationContext.Provider>
  );
};

export const usePathDeviation = () => {
  const context = useContext(PathDeviationContext);
  if (!context) {
    throw new Error('usePathDeviation must be used within PathDeviationProvider');
  }
  return context;
};
