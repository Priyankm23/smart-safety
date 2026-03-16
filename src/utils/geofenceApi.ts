/**
 * API functions for fetching static geofences from server
 */
import { SERVER_URL } from '../config'
import type { GeoFence, VisualStyle } from './geofenceLogic'

// Grid size in km (matches server GRID_SIZE_DEG ≈ 0.0045° ≈ 500m)
const GRID_RADIUS_KM = 0.25

/**
 * DangerZone interface (matches backend DangerZone model)
 */
export interface DangerZone {
  id?: string
  _id?: string
  name: string
  type: 'point' | 'circle' | 'polygon'
  coords: number[] | number[][]
  radiusKm?: number
  category?: string
  state?: string
  riskLevel?: string
  source?: string
  metadata?: Record<string, any>
  visualStyle?: VisualStyle
}

/**
 * RiskGrid interface (matches backend RiskGrid model)
 */
export interface RiskGrid {
  _id?: string
  gridId: string
  location: {
    type: string
    coordinates: number[] // [lng, lat]
  }
  riskScore: number
  riskLevel: string
  gridName?: string
  lastUpdated?: string
  reasons?: Array<{
    type: string
    title: string
    timestamp: string
    severity?: number
    eventType?: string
  }>
  visualStyle?: VisualStyle
}

/**
 * Geofence interface (matches backend Geofence model)
 */
export interface GeofenceDestination {
  _id?: string
  name: string
  destination: string
  type: 'circle' | 'polygon'
  coords: number[] // [lat, lng]
  radiusKm?: number
  polygonCoords?: number[][]
  isActive?: boolean
  alertMessage?: string
  visualStyle?: VisualStyle
}

/**
 * API Response from /api/geofence/all-zones-styled
 */
export interface AllZonesStyledResponse {
  dangerZones: DangerZone[]
  riskGrids: RiskGrid[]
  geofences: GeofenceDestination[]
}

function getDateKeyInTimezone(input: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(input)

  const year = parts.find(p => p.type === 'year')?.value || '0000'
  const month = parts.find(p => p.type === 'month')?.value || '01'
  const day = parts.find(p => p.type === 'day')?.value || '01'
  return `${year}-${month}-${day}`
}

function isScheduledForToday(scheduledDate: any, timeZone: string): boolean {
  if (!scheduledDate) return false
  const parsed = new Date(scheduledDate)
  if (Number.isNaN(parsed.getTime())) return false

  const todayKey = getDateKeyInTimezone(new Date(), timeZone)
  const scheduledKey = getDateKeyInTimezone(parsed, timeZone)
  return scheduledKey === todayKey
}

/**
 * Convert backend DangerZone to app GeoFence format
 */
function dangerZoneToGeoFence(zone: DangerZone): GeoFence {
  const id = zone.id || zone._id || `zone-${Date.now()}-${Math.random()}`
  const coords = Array.isArray(zone.coords) ? zone.coords : []
  const lat = coords[0] || 0
  const lng = coords[1] || 0

  return {
    id: id,
    name: zone.name || 'Unnamed Zone',
    type: zone.type || 'point',
    coords: coords,
    radiusKm: zone.radiusKm,
    category: zone.category || 'Danger Zone',
    state: zone.state,
    riskLevel: zone.riskLevel || 'Medium',
    source: zone.source || 'server',
    metadata: zone.metadata,
    visualStyle: zone.visualStyle
  }
}

/**
 * Convert backend RiskGrid to app GeoFence format
 */
function riskGridToGeoFence(grid: RiskGrid): GeoFence {
  const id = grid.gridId || grid._id || `grid-${Date.now()}-${Math.random()}`
  // RiskGrid location uses [lng, lat] format, we need [lat, lng]
  const lng = grid.location.coordinates[0]
  const lat = grid.location.coordinates[1]

  return {
    id: id,
    name: grid.gridName || 'Risk Grid',
    type: 'circle',
    coords: [lat, lng],
    radiusKm: 0.5, // 500m grid radius
    category: 'Risk Grid',
    riskLevel: grid.riskLevel,
    source: 'server',
    metadata: {
      riskScore: grid.riskScore,
      lastUpdated: grid.lastUpdated,
      reasons: grid.reasons,
      gridId: grid.gridId
    },
    visualStyle: grid.visualStyle
  }
}

/**
 * Convert backend GeofenceDestination to app GeoFence format
 */
function geofenceDestinationToGeoFence(fence: any): GeoFence {
  const id = fence._id || `geofence-${Date.now()}-${Math.random()}`
  
  return {
    id: id,
    name: fence.name || 'Unnamed Geofence',
    type: fence.type || 'circle',
    coords: fence.coords,
    radiusKm: fence.radiusKm,
    category: fence.sourceType === 'itinerary' ? 'Itinerary Geofence' : 'Tourist Destination',
    riskLevel: 'Low',
    source: fence.sourceType || 'server',
    metadata: {
      destination: fence.destination,
      alertMessage: fence.alertMessage,
      isActive: fence.isActive,
      polygonCoords: fence.polygonCoords,
      // Preserve itinerary-specific fields
      sourceType: fence.sourceType,
      ownerId: fence.ownerId,
      ownerType: fence.ownerType,
      dayNumber: fence.dayNumber,
      scheduledDate: fence.scheduledDate,
      activityNodeName: fence.activityNodeName,
      activityNodeType: fence.activityNodeType,
      expiresAt: fence.expiresAt
    },
    visualStyle: fence.visualStyle
  }
}

/**
 * Fetch all zones with styling from server
 * @param lat - User latitude (optional, not used in current implementation)
 * @param lng - User longitude (optional, not used in current implementation)
 * @param radius - Radius in meters (optional, not used in current implementation)
 * @param userId - User ID to fetch personal itinerary geofences (optional)
 * @returns Array of GeoFence objects (merged from all three zone types)
 */
export async function fetchDynamicGeofences(
  lat?: number,
  lng?: number,
  radius: number = 5000,
  userId?: string
): Promise<GeoFence[]> {
  try {
    // Build URL for new styled zones endpoint with optional userId query parameter
    let url = `${SERVER_URL}/api/geofence/all-zones-styled`
    if (userId) {
      url += `?userId=${encodeURIComponent(userId)}`
    }

    console.log('Fetching styled geofences from:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`)
    }

    const data: AllZonesStyledResponse = await response.json()

    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.warn('Invalid response from server - expected object')
      return []
    }

    // Convert and merge all three zone types
    const dangerZones = Array.isArray(data.dangerZones) 
      ? data.dangerZones.filter(zone => zone && zone.name).map(dangerZoneToGeoFence)
      : []
    
    const riskGrids = Array.isArray(data.riskGrids)
      ? data.riskGrids.filter(grid => grid && grid.gridId).map(riskGridToGeoFence)
      : []
    
    const geofences = Array.isArray(data.geofences)
      ? data.geofences.filter(fence => fence && fence.name).map(geofenceDestinationToGeoFence)
      : []

    // Day-wise filtering for itinerary geofences (show only current day in IST)
    const itineraryGeofences = geofences.filter((f: any) => f?.metadata?.sourceType === 'itinerary')
    const staticGeofences = geofences.filter((f: any) => f?.metadata?.sourceType !== 'itinerary')
    const todayItineraryGeofences = itineraryGeofences.filter((f: any) =>
      isScheduledForToday(f?.metadata?.scheduledDate, 'Asia/Kolkata')
    )

    // Keep itinerary fences without a scheduled date as fallback to avoid accidental hiding
    const undatedItineraryGeofences = itineraryGeofences.filter((f: any) => !f?.metadata?.scheduledDate)
    const filteredGeofences = [...staticGeofences, ...todayItineraryGeofences, ...undatedItineraryGeofences]

    // Merge all zones with priority order (danger zones first, then grids, then geofences)
    const allZones = [...dangerZones, ...riskGrids, ...filteredGeofences]

    return allZones
  } catch (error: any) {
    console.error('Failed to fetch geofences:', error?.message || error)
    throw error
  }
}

export default { fetchDynamicGeofences }
