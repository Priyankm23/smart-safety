/**
 * Mapbox Directions API Service
 * Provides route calculation with turn-by-turn navigation
 * Docs: https://docs.mapbox.com/api/navigation/directions/
 */

import { MAPBOX_ACCESS_TOKEN } from '../../../config';

// Routing profiles supported by Mapbox
export type RoutingProfile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  distance: number; // meters
  duration: number; // seconds
  instruction: string;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    bearing_after: number;
    bearing_before: number;
    location: [number, number]; // [lng, lat]
    instruction: string;
  };
}

export interface RouteLeg {
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
  summary: string;
}

export interface Route {
  distance: number; // meters
  duration: number; // seconds
  legs: RouteLeg[];
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat][]
  };
  weight: number;
  weight_name: string;
}

export interface DirectionsResponse {
  routes: Route[];
  waypoints: Array<{
    name: string;
    location: [number, number];
  }>;
  code: string;
  uuid?: string;
}

/**
 * Format profile string for API
 */
function getProfileString(profile: RoutingProfile): string {
  return `mapbox/${profile}`;
}

/**
 * Format coordinates for API (semicolon-separated lon,lat pairs)
 */
function formatCoordinates(coords: RouteCoordinate[]): string {
  return coords.map(c => `${c.longitude},${c.latitude}`).join(';');
}

/**
 * Fetch directions from Mapbox Directions API
 */
export async function fetchDirections(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
  profile: RoutingProfile = 'driving',
  options: {
    alternatives?: boolean;
    steps?: boolean;
    geometries?: 'geojson' | 'polyline' | 'polyline6';
    overview?: 'full' | 'simplified' | 'false';
    annotations?: string[];
  } = {}
): Promise<DirectionsResponse> {
  if (!MAPBOX_ACCESS_TOKEN || !MAPBOX_ACCESS_TOKEN.startsWith('pk.')) {
    throw new Error('Invalid or missing Mapbox access token');
  }

  // Default options
  const {
    alternatives = true,
    steps = true,
    geometries = 'geojson',
    overview = 'full',
    annotations = ['distance', 'duration']
  } = options;

  const coordinates = formatCoordinates([origin, destination]);
  const profileString = getProfileString(profile);

  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    alternatives: alternatives.toString(),
    steps: steps.toString(),
    geometries,
    overview,
    annotations: annotations.join(','),
    language: 'en'
  });

  const url = `https://api.mapbox.com/directions/v5/${profileString}/${coordinates}?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DirectionsAPI] Error:', response.status, errorText);

      // Try to parse JSON error if possible
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `Directions API error: ${response.status}`);
      } catch (e) {
        throw new Error(`Directions API error: ${response.status}`);
      }
    }

    const data: DirectionsResponse = await response.json();

    if (data.code !== 'Ok') {
      throw new Error(JSON.stringify({ code: data.code, message: (data as any).message || 'Unknown error' }));
    }

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found');
    }

    return data;

  } catch (error) {
    console.error('[DirectionsAPI] Fetch error:', error);
    throw error;
  }
}

/**
 * Fetch directions for multiple waypoints (2+ coordinates)
 */
export async function fetchDirectionsForWaypoints(
  coordinates: RouteCoordinate[],
  profile: RoutingProfile = 'driving',
  options: {
    alternatives?: boolean;
    steps?: boolean;
    geometries?: 'geojson' | 'polyline' | 'polyline6';
    overview?: 'full' | 'simplified' | 'false';
    annotations?: string[];
  } = {}
): Promise<DirectionsResponse> {
  if (!MAPBOX_ACCESS_TOKEN || !MAPBOX_ACCESS_TOKEN.startsWith('pk.')) {
    throw new Error('Invalid or missing Mapbox access token');
  }

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('At least 2 coordinates are required for directions');
  }

  const {
    alternatives = false,
    steps = true,
    geometries = 'geojson',
    overview = 'full',
    annotations = ['distance', 'duration']
  } = options;

  const coordinatesParam = formatCoordinates(coordinates);
  const profileString = getProfileString(profile);

  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    alternatives: alternatives.toString(),
    steps: steps.toString(),
    geometries,
    overview,
    annotations: annotations.join(','),
    language: 'en'
  });

  const url = `https://api.mapbox.com/directions/v5/${profileString}/${coordinatesParam}?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DirectionsAPI] Error:', response.status, errorText);

      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `Directions API error: ${response.status}`);
      } catch (e) {
        throw new Error(`Directions API error: ${response.status}`);
      }
    }

    const data: DirectionsResponse = await response.json();

    if (data.code !== 'Ok') {
      throw new Error(JSON.stringify({ code: data.code, message: (data as any).message || 'Unknown error' }));
    }

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found');
    }

    return data;
  } catch (error) {
    console.error('[DirectionsAPI] Fetch error:', error);
    throw error;
  }
}

/**
 * Calculate route summary information
 */
export function getRouteSummary(route: Route) {
  const distanceKm = (route.distance / 1000).toFixed(1);
  const durationMin = Math.round(route.duration / 60);
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;

  let durationText = '';
  if (hours > 0) {
    durationText = `${hours}h ${mins}m`;
  } else {
    durationText = `${mins} min`;
  }

  return {
    distance: route.distance,
    distanceText: `${distanceKm} km`,
    duration: route.duration,
    durationText,
    steps: route.legs.reduce((acc, leg) => acc + leg.steps.length, 0)
  };
}

/**
 * Get icon name for maneuver type
 */
export function getManeuverIcon(maneuverType: string, modifier?: string): string {
  const type = maneuverType.toLowerCase();
  const mod = modifier?.toLowerCase() || '';

  // Map maneuver types to MaterialCommunityIcons names
  switch (type) {
    case 'turn':
      if (mod.includes('left')) return 'arrow-left-top';
      if (mod.includes('right')) return 'arrow-right-top';
      return 'arrow-up';
    case 'merge':
      return 'call-merge';
    case 'depart':
      return 'arrow-up-circle';
    case 'arrive':
      return 'flag-checkered';
    case 'fork':
      if (mod.includes('left')) return 'arrow-top-left';
      if (mod.includes('right')) return 'arrow-top-right';
      return 'call-split';
    case 'roundabout':
    case 'rotary':
      return 'rotate-right';
    case 'continue':
      return 'arrow-up';
    case 'new name':
      return 'arrow-up';
    case 'on ramp':
    case 'off ramp':
      return 'highway';
    default:
      return 'arrow-up';
  }
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Get all turn-by-turn instructions from a route
 */
export function getRouteInstructions(route: Route): RouteStep[] {
  const instructions: RouteStep[] = [];

  route.legs.forEach(leg => {
    leg.steps.forEach(step => {
      instructions.push(step);
    });
  });

  return instructions;
}

/**
 * Calculate bounds for a route to fit on map
 */
export function getRouteBounds(route: Route): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const coords = route.geometry.coordinates;

  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];

  coords.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return { minLat, maxLat, minLng, maxLng };
}
