import { SERVER_URL, WEATHER_MODEL_URL, GEO_MODEL_URL } from "../config";

const handleResponse = async (response) => {
  try {
    const text = await response.text();
    // Try to parse JSON if possible
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    if (response.ok) {
      return data;
    }

    // Log server error details for debugging
    try {
      console.warn("API error response", {
        status: response.status,
        body: data,
      });
    } catch (e) {}

    if (data && data.message) throw new Error(data.message);
    throw new Error(`Server responded with status ${response.status}`);
  } catch (e: any) {
    // If parsing fails or other unexpected error
    // Keep original message for developer but return a friendly message for UI
    const msg = e?.message || "An unexpected error occurred. Please try again.";
    throw new Error(msg);
  }
};

export const login = async (email, password) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const res = await handleResponse(response);
    return res;
  } catch (e: any) {
    console.error("API: login error", { email, error: e?.message || e });
    throw e;
  }
};

export const loginWithCodes = async (guideId: string, touristId: string, groupAccessCode: string) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/login-with-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guideId, touristId, groupAccessCode }),
    });
    const res = await handleResponse(response);
    return res;
  } catch (e: any) {
    console.error("API: loginWithCodes error", { error: e?.message || e });
    throw e;
  }
};

export const register = async (userData) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    const res = await handleResponse(response);
    return res;
  } catch (e: any) {
    console.error("API: register error", { error: e?.message || e });
    throw e;
  }
};

export const getTouristData = async (token, method = "GET", data = null) => {
  try {
    const config: any = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };

    if (data && (method === "PATCH" || method === "PUT" || method === "POST")) {
      config.headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${SERVER_URL}/api/tourist/me`, config);
    const res = await handleResponse(response);
    return res;
  } catch (e: any) {
    console.error("API: getTouristData error", { error: e?.message || e });
    throw e;
  }
};

export const triggerSOS = async (token, sosData) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/sos/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sosData),
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    console.error("API: triggerSOS error", { error: e?.message || e });
    throw e;
  }
};

// Fetch geo model prediction by lat/lon
export const getGeoPrediction = async (
  latitude: number,
  longitude: number,
): Promise<{
  predicted_safety_score?: number;
  safety_score_100?: number;
  predicted_risk_label?: string;
  [key: string]: any;
}> => {
  try {
    const response = await fetch(GEO_MODEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    });

    // Try to parse JSON response
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        data && data.message
          ? data.message
          : `Model responded with status ${response.status}`,
      );
    }

    return data;
  } catch (e: any) {
    console.error("API: getGeoPrediction error", { error: e?.message || e });
    throw e;
  }
};

// Fetch weather model prediction given weather features
export const getWeatherPrediction = async (features: {
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_bearing: number;
  visibility: number;
  cloud_cover: number;
  pressure: number;
  summary_clear?: number;
}): Promise<{
  safety_score_100?: number;
  safety_score?: number;
  safety_category?: string;
  confidence?: number;
  [key: string]: any;
}> => {
  try {
    const response = await fetch(WEATHER_MODEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    if (!response.ok) {
      // Enhanced error logging for debugging
      console.error("Weather API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        responseBody: data,
        sentFeatures: features,
      });
      
      throw new Error(
        data && data.message
          ? data.message
          : `Model responded with status ${response.status}`,
      );
    }

    return data;
  } catch (e: any) {
    console.error("API: getWeatherPrediction error", {
      error: e?.message || e,
    });
    throw e;
  }
};

// Fetch weather data with automatic failover across multiple providers
export const fetchOpenMeteoCurrentHour = async (
  latitude: number,
  longitude: number,
): Promise<{
  compact: {
    temperature: number | null;
    apparent_temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_bearing: number | null;
    visibility: number | null;
    cloud_cover: number | null;
    pressure: number | null;
  };
  modelFeatures: {
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_bearing: number | null;
    visibility: number | null;
    cloud_cover: number | null;
    pressure: number | null;
  };
}> => {
  try {
    // Use weatherClient with automatic failover across Open-Meteo, WeatherAPI, and OpenWeatherMap
    const { fetchWeatherWithFailover } = await import('./weatherClient');
    const result = await fetchWeatherWithFailover(latitude, longitude);

    console.log('Weather data fetched successfully', {
      provider: result.provider,
      location: { latitude, longitude },
      temperature: result.compact.temperature,
      humidity: result.compact.humidity,
    });

    // Return the data in the expected format
    // Note: weatherClient already handles all unit conversions and provides model-ready features
    return { 
      compact: result.compact, 
      modelFeatures: result.modelFeatures 
    };
  } catch (e: any) {
    console.error("fetchOpenMeteoCurrentHour error", e?.message || e);
    throw e;
  }
};

export const getGroupDashboard = async (token) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/group/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    console.error("API: getGroupDashboard error", { error: e?.message || e });
    throw e;
  }
};

export const getSoloItinerary = async (token) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/itinerary`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    console.error("API: getSoloItinerary error", { error: e?.message || e });
    throw e;
  }
};

export const updateSoloItinerary = async (token, itinerary) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/itinerary`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itinerary }),
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    console.error("API: updateSoloItinerary error", { error: e?.message || e });
    throw e;
  }
};

export const getAlerts = async (token) => {
  try {
    if (!token) {
      throw new Error("No authentication token provided");
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${SERVER_URL}/api/authority/alerts`, {
      method: "GET",
      headers: headers,
    });

    const res = await handleResponse(response);

    // Ensure alerts is an array
    if (res && res.alerts && Array.isArray(res.alerts)) {
      return res;
    } else {
      throw new Error("Invalid response format from server");
    }
  } catch (e) {
    console.error("API: getAlerts error", { error: e?.message || e });
    throw e;
  }
};

// Utility functions for trip/itinerary conversion
export const tripsToItinerary = (
  trips: { id: string; title: string; date: string; notes?: string }[],
): string[] => {
  return trips.map((trip) => {
    if (trip.date && trip.notes) {
      return `${trip.title} (${trip.date}) - ${trip.notes}`;
    } else if (trip.date) {
      return `${trip.title} (${trip.date})`;
    } else {
      return trip.title;
    }
  });
};

export const itineraryToTrips = (
  itinerary: any[],
): Array<{ id: string; title: string; date: string; notes?: string; dayWiseItinerary?: any[] }> => {
  const baseTs = Date.now();
  const toFiniteNumber = (value: any): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  };

  const normalizeNode = (node: any) => {
    if (!node || typeof node !== 'object') return node;

    const locationCoords = Array.isArray(node.location?.coordinates)
      ? node.location.coordinates
      : Array.isArray(node.coordinates)
        ? node.coordinates
        : null;

    const lat = toFiniteNumber(
      node.lat ?? node.latitude ?? (locationCoords ? locationCoords[1] : undefined)
    );

    const lng = toFiniteNumber(
      node.lng ?? node.longitude ?? (locationCoords ? locationCoords[0] : undefined)
    );

    return {
      ...node,
      name: node.name || node.title || node.activity || node.locationName || 'Stop',
      locationName: node.locationName || node.address || node.name || node.title || '',
      lat,
      lng,
    };
  };

  const normalizeDays = (days: any[]) =>
    days.map((day) => ({
      ...day,
      nodes: Array.isArray(day?.nodes) ? day.nodes.map(normalizeNode) : [],
    }));
  
  // If itinerary is empty, return empty array
  if (!Array.isArray(itinerary) || itinerary.length === 0) {
    return [];
  }
  
  // Check if this is the day-wise structure from API (has dayNumber and nodes)
  if (itinerary[0] && typeof itinerary[0] === 'object' && itinerary[0].nodes) {
    const normalizedItinerary = normalizeDays(itinerary);
    // Group consecutive days into trips. Only split on large date gaps (>3 days).
    // 'start'/'end' node types are per-day markers, NOT trip boundaries.
    const trips: Array<{ id: string; title: string; date: string; notes?: string; dayWiseItinerary?: any[] }> = [];
    let currentTrip: any[] = [];
    let tripIndex = 0;
    
    for (let i = 0; i < normalizedItinerary.length; i++) {
      const day = normalizedItinerary[i];
      
      // Check if there's a significant date gap (more than 3 days) from previous day
      const isDateGap = currentTrip.length > 0 && i > 0 && (() => {
        const prevDate = new Date(normalizedItinerary[i - 1].date);
        const currDate = new Date(day.date);
        const daysDiff = Math.abs((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 3;
      })();
      
      // Start a new trip only when there's a significant date gap
      if (isDateGap && currentTrip.length > 0) {
        const firstDay = currentTrip[0];
        const firstNode = firstDay.nodes?.[0];
        const title = firstNode?.name || firstNode?.locationName || 'Trip';
        const startDate = firstDay.date || new Date().toISOString();
        
        trips.push({
          id: `trip_${baseTs}_${tripIndex}`,
          title,
          date: startDate,
          notes: `${currentTrip.length} day${currentTrip.length > 1 ? 's' : ''}`,
          dayWiseItinerary: currentTrip,
        });
        
        tripIndex++;
        currentTrip = [];
      }
      
      // Add current day to the trip
      currentTrip.push(day);
    }
    
    // Save the remaining trip
    if (currentTrip.length > 0) {
      const firstDay = currentTrip[0];
      const firstNode = firstDay.nodes?.[0];
      const title = firstNode?.name || firstNode?.locationName || 'Trip';
      const startDate = firstDay.date || new Date().toISOString();
      
      trips.push({
        id: `trip_${baseTs}_${tripIndex}`,
        title,
        date: startDate,
        notes: `${currentTrip.length} day${currentTrip.length > 1 ? 's' : ''}`,
        dayWiseItinerary: currentTrip,
      });
    }
    
    console.log('[itineraryToTrips] Converted to trips:', trips.length, 'trips from', itinerary.length, 'days');
    return trips;
  }
  
  // Handle simple string/object array format
  return itinerary.map((item: any, index: number) => {
    if (typeof item === "string") {
      // Parse string format: "Title (Date) - Notes" or "Title (Date)" or "Title"
      const match = item.match(/^(.+?)(?:\s*\(([^)]+)\))?(?:\s*-\s*(.+))?$/);
      if (match) {
        const [, title, date, notes] = match;
        return {
          id: `t${baseTs}_${index}`,
          title: title.trim(),
          date: date || "",
          notes: notes || "",
        };
      }
      return { id: `t${baseTs}_${index}`, title: item, date: "" };
    }
    if (item && typeof item === "object") {
      const title =
        item.title || item.name || item.locationName || JSON.stringify(item);
      const date = item.date || item.dateTime || item.when || "";
      const notes = item.notes || item.extra || "";
      return { id: `t${baseTs}_${index}`, title, date, notes };
    }
    return { id: `t${baseTs}_${index}`, title: String(item), date: "" };
  });
};

export const joinGroup = async (token, accessCode) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/group/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accessCode }),
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    console.error("API: joinGroup error", { error: e?.message || e });
    throw e;
  }
};

export const createGroup = async (token, groupData) => {
  try {
    console.log("API: Making POST request to /api/group/create");
    console.log("Token:", token ? "Present" : "Missing");
    console.log("Request body:", JSON.stringify(groupData, null, 2));
    
    const response = await fetch(`${SERVER_URL}/api/group/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(groupData),
    });
    
    console.log("Response status:", response.status);
    
    const res = await handleResponse(response);
    
    console.log("API: createGroup response:", res);
    
    return res;
  } catch (e) {
    console.error("API: createGroup error", { error: e?.message || e });
    throw e;
  }
};

export const updateGroupItinerary = async (token, itinerary) => {
  try {
    console.log("API: Making PUT request to /api/group/update");
    console.log("Token:", token ? "Present" : "Missing");
    console.log("Request body:", JSON.stringify({ itinerary }, null, 2));
    
    const response = await fetch(`${SERVER_URL}/api/group/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ itinerary }),
    });
    
    console.log("Response status:", response.status);
    
    const res = await handleResponse(response);
    
    console.log("API: updateGroupItinerary response:", res);
    
    return res;
  } catch (e) {
    console.error("API: updateGroupItinerary error", { error: e?.message || e });
    throw e;
  }
};

export const getAllMembers = async (token) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/group/members`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    console.error("API: getAllMembers error", { error: e?.message || e });
    throw e;
  }
};

export const sendWelcomeEmailsToAll = async (token) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/group/members/send-welcome-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const res = await handleResponse(response);
    return res;
  } catch (e) {
    // Error will be handled and displayed via dialog in the component
    throw e;
  }
};

