import io, { Socket } from "socket.io-client";
import { Platform } from "react-native";
import { Alert } from "react-native";
import { SERVER_URL } from "../config";

// Configuration - Use centralized server URL from config
const SOCKET_URL = SERVER_URL;

export interface TouristAlert {
  alertId: string;
  type: "emergency" | "warning" | "info" | "weather" | "civil_unrest";
  title: string;
  message: string;
  priority: "critical" | "high" | "medium" | "low";
  timestamp: string;
  authorityName: string;
  authorityId: string;
  requiresAcknowledgment: boolean;
  actionRequired: string | null;
  expiresAt: string | null;
  targetArea: {
    lat: number;
    lng: number;
    radius: number;
  } | null;
  distanceFromEvent?: number;
}

export interface SafetyScoreData {
  safetyScore: number;
  timestamp: string;
  safetyLevel?: string;
  safetyColor?: string;
  description?: string;
  geofenceScore?: number;
  weatherScore?: number;
  nearestThreat?: {
    name: string;
    distance: number;
    severity: string;
    type: string;
    impact: number;
    coordinates?: any;
  };
  threats?: any[];
  totalThreats?: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface SafetyScoreAlert {
  previousScore: number;
  newScore: number;
  changeType:
    | "significant_drop"
    | "significant_increase"
    | "critical_threshold";
  message: string;
  safetyScoreData: SafetyScoreData;
}

interface LocationCoords {
  lat: number;
  lng: number;
}

class TouristSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private touristId: string | null = null;
  private locationUpdateInterval: NodeJS.Timeout | null = null;
  private listeners: Record<string, Function[]> = {};

  /**
   * Initialize and connect to the socket server
   * @param {string} touristId - Unique tourist ID from your auth system
   * @param {LocationCoords} initialLocation - { lat: number, lng: number }
   */
  connect(touristId: string, initialLocation: LocationCoords) {
    if (this.socket && this.isConnected) {
      console.log("Socket already connected");
      return;
    }

    this.touristId = touristId;

    console.log(`Attempting to connect to ${SOCKET_URL} as ${touristId}`);

    // Create socket connection
    // Start with polling for better compatibility, then upgrade to websocket
    this.socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    // Handle connection event
    this.socket.on("connect", () => {
      console.log("✅ Connected to backend:", this.socket?.id);
      console.log(
        `✅ Socket transport: ${this.socket?.io.engine.transport.name}`,
      );
      this.isConnected = true;

      // Register as tourist
      console.log(`📤 Sending registration for tourist: ${this.touristId}`);
      this.socket?.emit("registerTourist", {
        role: "tourist",
        touristId: this.touristId,
        location: initialLocation,
      });
    });

    // Handle risk grid updates
    this.socket.on("riskGridUpdated", (gridData: any) => {
      console.log(`Risk grid update broadcasted: ${gridData.gridId}`);
      this.emit("riskGridUpdated", gridData);
    });

    // Debug: Log all incoming events
    if (this.socket.onAny) {
      this.socket.onAny((eventName, ...args) => {
        console.log(`📡 Socket event received: ${eventName}`, args);
      });
    }

    // Handle registration confirmation
    this.socket.on("registrationConfirmed", (data: any) => {
      console.log("✅ Registration confirmed:", data?.message);
      // Registration confirmed silently
    });

    // Handle connection errors
    this.socket.on("connect_error", (error: any) => {
      console.error("❌ Connection error:", error);
      console.error("❌ Error details:", error.message, error.description);
      this.isConnected = false;

      // Provide helpful debugging info
      console.log(
        `💡 Troubleshooting: Ensure backend is running at ${SOCKET_URL}`,
      );
      console.log(
        `💡 For physical device, use your computer's local IP instead of localhost`,
      );
      console.log(`💡 For Android emulator, use 10.0.2.2 instead of localhost`);
    });

    // Handle disconnection
    this.socket.on("disconnect", (reason: any) => {
      console.log("🔌 Disconnected:", reason);
      this.isConnected = false;

      // Auto-reconnect if server disconnected
      if (reason === "io server disconnect") {
        this.socket?.connect();
      }
    });
  }

  /**
   * Listen for authority alerts
   * @param {function} callback - Function to handle incoming alerts
   */
  onAuthorityAlert(callback: (alert: TouristAlert) => void) {
    if (!this.socket) {
      console.warn("Socket not initialized when adding listener");
    }

    this.socket?.off("authorityAlert");
    this.socket?.on("authorityAlert", (alertData: TouristAlert) => {
      console.log("🚨 Authority alert received:", alertData);
      callback(alertData);
    });
  }

  /**
   * Listen for safety score updates from backend
   * @param {function} callback - Function to handle safety score updates
   * @returns {function} - Cleanup function to remove the listener
   */
  onSafetyScoreUpdate(callback: (data: SafetyScoreData) => void) {
    if (!this.socket) {
      console.warn(
        "Socket not initialized when adding safetyScoreUpdate listener",
      );
      console.warn("Make sure to call connect() before setting up listeners");
      return () => {};
    }

    // Define the wrapper function to log and call callback
    // Define the wrapper function to call callback
    const listener = (data: SafetyScoreData) => {
      console.log("📊 ===== SAFETY SCORE UPDATE RECEIVED =====");
      console.log(
        "📊 Safety score update received from backend:",
        data.safetyScore,
      );
      // console.log("📊 Full data:", JSON.stringify(data, null, 2));
      callback(data);
      console.log("📊 ===== CALLBACK COMPLETE =====");
    };

    // Add new listener (supports multiple listeners now)
    this.socket.on("safetyScoreUpdate", listener);
    console.log("✅ Safety score update listener registered");

    // Return cleanup function
    return () => {
      if (this.socket) {
        this.socket.off("safetyScoreUpdate", listener);
        console.log("✅ Safety score update listener removed");
      }
    };
  }

  /**
   * Listen for critical safety score alerts
   * @param {function} callback - Function to handle safety score alerts
   */
  onSafetyScoreAlert(callback: (alert: SafetyScoreAlert) => void) {
    if (!this.socket) {
      console.warn("Socket not initialized when adding listener");
    }

    this.socket?.off("safetyScoreAlert");
    this.socket?.on("safetyScoreAlert", (alert: SafetyScoreAlert) => {
      console.log(
        "⚠️ Safety score alert:",
        alert.previousScore,
        "→",
        alert.newScore,
      );
      callback(alert);
    });
  }

  /**
   * Update tourist location in real-time
   * @param {LocationCoords} location - { lat: number, lng: number }
   */
  updateLocation(location: LocationCoords) {
    if (!this.socket) {
      return;
    }

    this.socket.emit("updateTouristLocation", {
      location: location,
    });
  }

  /**
   * Request immediate safety score recalculation from backend
   * This should be called after critical events like SOS triggers or incident reports
   * to get immediate reflection in the safety score instead of waiting for the periodic update
   */
  requestSafetyScoreUpdate() {
    if (!this.socket || !this.isConnected) {
      console.warn("Socket not connected, cannot request safety score update");
      return;
    }

    console.log("🔄 Requesting immediate safety score update from backend");
    this.socket.emit("requestSafetyScoreUpdate");
  }

  /**
   * Start periodic location updates (every 45 seconds)
   * @param {function} getLocationFunc - Async function that returns current location coords
   */
  startPeriodicLocationUpdates(
    getLocationFunc: () => Promise<LocationCoords | null>,
  ) {
    // Clear any existing interval
    this.stopPeriodicLocationUpdates();

    // Send initial update
    getLocationFunc().then((coords) => {
      if (coords) this.updateLocation(coords);
    });

    // Set up periodic updates every 45 seconds
    this.locationUpdateInterval = setInterval(async () => {
      const coords = await getLocationFunc();
      if (coords) {
        this.updateLocation(coords);
        console.log("📍 Periodic location update sent");
      }
    }, 45000); // 45 seconds

    console.log("✅ Started periodic location updates (45s interval)");
  }

  /**
   * Stop periodic location updates
   */
  stopPeriodicLocationUpdates() {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
      console.log("🛑 Stopped periodic location updates");
    }
  }

  /**
   * Disconnect from socket server
   */
  disconnect() {
    this.stopPeriodicLocationUpdates();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log("Socket disconnected");
    }
  }

  /**
   * Check if socket is connected
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Check if socket is initialized (connect has been called)
   */
  isInitialized() {
    return this.socket !== null;
  }

  /**
   * Register listener for internal service events
   */
  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return cleanup function
    return () => {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Emit internal service event
   */
  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }
}

// Export singleton instance
export default new TouristSocketService();
