import Constants from "expo-constants";

// Central configuration for backend endpoints used during development.
// IMPORTANT: If using Socket.IO for real-time alerts, ensure this URL matches your backend server
// - For physical device testing: use your computer's IP (e.g., http://192.168.1.4:5000)
// - For Android emulator: use http://10.0.2.2:5000
// - For iOS simulator: use http://localhost:5000
// - Update the port to match your actual backend port
export const SERVER_URL =
  Constants.expoConfig?.extra?.SERVER_URL ||
  process.env.SERVER_URL ||
  "http://10.171.138.44:5000"; // Your computer's local IP
// "https://smart-tourist-safety-app-backend-1.onrender.com";

// AI model URLs for getting safety score predictions
export const GEO_MODEL_URL =
  Constants.expoConfig?.extra?.GEO_MODEL_URL ||
  process.env.GEO_MODEL_URL ||
  "https://gcet--geofence-safety-api-fastapi-app.modal.run/predict";
export const WEATHER_MODEL_URL =
  Constants.expoConfig?.extra?.WEATHER_MODEL_URL ||
  process.env.WEATHER_MODEL_URL ||
  "https://gcet--weather-safety-api-fastapi-app.modal.run/predict";

// Mapbox configuration - prioritize .env over app.json for security
// Prefer value injected into expo.extra (via app.config.js) so it works with Expo/Metro.
export const MAPBOX_ACCESS_TOKEN =
  Constants.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_ACCESS_TOKEN ||
  "";

// Validate required configuration and provide actionable debug info
if (!MAPBOX_ACCESS_TOKEN) {
  const extraVal = Constants.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN;
  const envVal = process.env.MAPBOX_ACCESS_TOKEN;
  console.warn("⚠️  MAPBOX_ACCESS_TOKEN is not configured. Values found:", {
    extraVal,
    envVal,
  });
}

// If true, transitionStore will attempt to POST single transitions immediately and fall back to local storage.
// For strict 15-minute batching, keep this false.
export const ROLLING_LOG_ENABLED = false;

// Groq/LLM configuration - provide API key via expo.extra or env
export const GROQ_API_KEY =
  Constants.expoConfig?.extra?.GROQ_API_KEY || process.env.GROQ_API_KEY || "";
// Optional model name for Groq. Default follows Groq's recommended models.
export const GROQ_MODEL =
  Constants.expoConfig?.extra?.GROQ_MODEL ||
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile";

// Fallback authority phone number (can be overridden via expo.extra in app config)
export const AUTHORITY_PHONE =
  Constants.expoConfig?.extra?.AUTHORITY_PHONE ||
  process.env.AUTHORITY_PHONE ||
  "";

// Weather API Keys for backup/fallback weather data sources
export const WEATHERAPI_KEY =
  Constants.expoConfig?.extra?.WEATHERAPI_KEY || process.env.WEATHERAPI_KEY;

export const OPENWEATHERMAP_KEY =
  Constants.expoConfig?.extra?.OPENWEATHERMAP_KEY ||
  process.env.OPENWEATHERMAP_KEY;

if (!GROQ_API_KEY) {
  console.info(
    "Groq LLM not fully configured. GROQ_API_KEY missing. Using local fallback recommendations.",
  );
}

export default {
  SERVER_URL,
  GEO_MODEL_URL,
  WEATHER_MODEL_URL,
  MAPBOX_ACCESS_TOKEN,
  ROLLING_LOG_ENABLED,
  WEATHERAPI_KEY,
  OPENWEATHERMAP_KEY,
};
