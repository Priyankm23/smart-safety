import * as Location from 'expo-location'
import { GeoFence, pointInCircle, pointInPolygon, haversineKm, normalizePolygon } from '../../../utils/geofenceLogic'
import { loadCachedFences, saveFences } from '../model/geoFenceModel'
import { fetchDynamicGeofences } from '../../../utils/geofenceApi'

// Simple geofence service: loads geofences from server API and bundled assets/geofences-output.json
// Watches user location; emits 'enter' and 'exit' events with { fence, location }
// Note: Fetches from /api/geofence/all-zones-styled endpoint which returns:
//   - dangerZones (static hazard areas with diagonal-stripe patterns)
//   - riskGrids (dynamic incident-based zones with dot patterns)
//   - geofences (tourist destination safe zones with solid patterns)
// All zones include visualStyle metadata for map rendering

// Small in-file EventEmitter replacement (avoids Node 'events' dependency)
const listeners: Record<string, Set<(payload: any) => void>> = {}
const emitter = {
  on(event: string, cb: (payload: any) => void) {
    if (!listeners[event]) listeners[event] = new Set()
    listeners[event].add(cb)
  },
  off(event: string, cb: (payload: any) => void) {
    listeners[event]?.delete(cb)
  },
  emit(event: string, payload: any) {
    const set = listeners[event]
    if (!set) return
    for (const cb of Array.from(set)) {
      try {
        cb(payload)
      } catch (e) {
        console.warn('emitter callback error', e)
      }
    }
  }
}
let watcher: Location.LocationSubscription | null = null
let fences: GeoFence[] = []
let states: Record<string, 'inside' | 'outside' | 'approaching'> = {}
// debounce counters to require N stable reads before committing a transition
const stabilityCounters: Record<string, { candidate?: 'inside' | 'outside' | 'approaching', count: number }> = {}
// per-fence cooldown (ms) to avoid immediate re-entry/exit flapping
const lastTransitionAt: Record<string, number> = {}
const STABILITY_REQUIRED = 2
const TRANSITION_COOLDOWN_MS = 10_000

// Track current primary fence for consumers that need risk context
let currentPrimary: GeoFence | null = null

export async function loadFences(userLat?: number, userLng?: number, userId?: string): Promise<GeoFence[]> {
  try {
    // If userId is provided, skip cache and fetch fresh from server
    // This ensures user gets their personal itinerary geofences immediately
    const shouldBypassCache = !!userId
    
    if (!shouldBypassCache) {
      // Try cached fences first for faster startup (only when no userId)
      const cached = await loadCachedFences()
      if (cached && cached.length > 0) {
        fences = cached
        states = {}
        fences.forEach(f => { states[f.id] = 'outside' })
        // Still try to refresh from server in background
        refreshFromServer(userLat, userLng, userId)
        return fences
      }
    } else {
      // Bypassing cache for userId-specific fetch
    }

    // Try server API first
    try {
      const serverFences = await fetchDynamicGeofences(userLat, userLng, 5000, userId)
      if (serverFences && serverFences.length > 0) {
        fences = serverFences
        states = {}
        fences.forEach(f => { states[f.id] = 'outside' })
        // Cache for offline use
        try { await saveFences(fences) } catch (e) { /* ignore */ }
        return fences
      }
    } catch (serverError) {
      console.warn('Server geofence fetch failed, falling back to bundled data:', serverError)
    }

    // Fallback: Load bundled JSON
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../../../../assets/geofences-output.json')
    fences = data
    // Normalize polygon geometries and default radii
    fences = fences.map((f: GeoFence) => {
      if (f.type === 'polygon' && Array.isArray(f.coords)) {
        const norm = normalizePolygon(f.coords as number[][])
        return { ...f, coords: norm }
      }
      if (f.type === 'circle' && (!f.radiusKm || f.radiusKm <= 0)) {
        return { ...f, radiusKm: 1 }
      }
      return f
    })
    // Initialize states
    states = {}
    fences.forEach(f => { states[f.id] = 'outside' })

    // Persist a cached copy for faster startup
    try { await saveFences(fences) } catch (e) { /* ignore */ }
    return fences
  } catch (e) {
    console.error('Failed to load geofences:', e)
    fences = []
    states = {}
    return []
  }
}

// Background refresh from server (non-blocking)
async function refreshFromServer(userLat?: number, userLng?: number, userId?: string) {
  try {
    const serverFences = await fetchDynamicGeofences(userLat, userLng, 5000, userId)
    if (serverFences && serverFences.length > 0) {
      fences = serverFences
      states = {}
      fences.forEach(f => { states[f.id] = 'outside' })
      try { await saveFences(fences) } catch (e) { /* ignore */ }
    }
  } catch (e) {
    // Silent fail for background refresh
  }
}

function computeFenceState(f: GeoFence, location: Location.LocationObjectCoords): 'inside' | 'outside' | 'approaching' {
  const pt: [number, number] = [location.latitude, location.longitude]
  if (f.type === 'circle' && Array.isArray(f.coords)) {
    const center = f.coords as number[]
    const radiusKm = f.radiusKm || 1
    const d = haversineKm(pt, center)
    if (d <= radiusKm) return 'inside'
    if (d <= radiusKm + 0.5) return 'approaching'
    return 'outside'
  }

  if (f.type === 'point' && Array.isArray(f.coords)) {
    const center = f.coords as number[]
    const d = haversineKm(pt, center)
    if (d <= 0.2) return 'inside'
    if (d <= 1) return 'approaching'
    return 'outside'
  }

  if (f.type === 'polygon' && Array.isArray(f.coords)) {
    const inside = pointInPolygon(pt, f.coords as number[][])
    return inside ? 'inside' : 'outside'
  }

  return 'outside'
}

export function on(event: 'enter' | 'exit' | 'state' | 'primary' | 'location', cb: (payload: any) => void) {
  emitter.on(event, cb)
}

export function off(event: 'enter' | 'exit' | 'state' | 'primary' | 'location', cb: (payload: any) => void) {
  emitter.off(event, cb)
}

export async function startMonitoring(options?: { accuracy?: Location.LocationAccuracy, intervalMs?: number, distance?: number }) {
  const accuracy = options?.accuracy || Location.Accuracy.Balanced
  const interval = options?.intervalMs || 30000
  const distance = options?.distance || 0

  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') {
    throw new Error('Location permission denied')
  }

  if (!fences || fences.length === 0) {
    await loadFences()
  }

  if (watcher) {
    watcher.remove()
    watcher = null
  }

  watcher = await Location.watchPositionAsync({ accuracy, timeInterval: interval, distanceInterval: distance }, (loc) => {
    // always emit raw location; consumers can decide sampling
    try { emitter.emit('location', { coords: loc.coords, timestamp: Date.now(), primary: currentPrimary }) } catch (e) { /* ignore */ }

    // evaluate all fences
    fences.forEach(f => {
      try {
        const newState = computeFenceState(f, loc.coords)
        const prev = states[f.id] || 'outside'

        // quick cooldown: ignore transitions that happen too soon after previous transition
        const now = Date.now()
        const lastAt = lastTransitionAt[f.id] || 0
        if (now - lastAt < TRANSITION_COOLDOWN_MS && newState !== prev) {
          // still update stability counters but skip emitting
        }

        // stability/debounce: only commit when same candidate state is seen STABILITY_REQUIRED times
        const s = stabilityCounters[f.id] || { count: 0 }
        if (s.candidate === newState) {
          s.count = (s.count || 0) + 1
        } else {
          s.candidate = newState
          s.count = 1
        }
        stabilityCounters[f.id] = s

        if (s.count >= STABILITY_REQUIRED && s.candidate && s.candidate !== prev) {
          // commit transition
          states[f.id] = s.candidate
          stabilityCounters[f.id] = { count: 0 }
          lastTransitionAt[f.id] = now
          emitter.emit('state', { fence: f, prev, current: s.candidate, location: loc.coords })
          if (prev !== 'inside' && s.candidate === 'inside') emitter.emit('enter', { fence: f, location: loc.coords })
          if (prev === 'inside' && s.candidate !== 'inside') emitter.emit('exit', { fence: f, location: loc.coords })
        }
      } catch (e) {
        console.warn('fence eval error', e)
      }
    })

    // overlapping/primary fence selection: choose highest riskLevel (if numeric) else smallest radius
    try {
      const insideFences = fences.filter(f => states[f.id] === 'inside')
      let primary: GeoFence | null = null
      if (insideFences.length > 0) {
        insideFences.sort((a, b) => {
          const ra = parseFloat((a.riskLevel || '') as any) || 0
          const rb = parseFloat((b.riskLevel || '') as any) || 0
          if (ra !== rb) return rb - ra
          const rka = a.radiusKm || Infinity
          const rkb = b.radiusKm || Infinity
          return rka - rkb
        })
        primary = insideFences[0]
      }
      const prevPrimaryId = (getFences() as any[]).find(x => x && (x as any)._isPrimary)?.id
      // annotate fences with _isPrimary locally (not persisted)
      fences.forEach(x => { delete (x as any)._isPrimary })
      if (primary) (primary as any)._isPrimary = true
      const newPrimaryId = primary ? primary.id : null
      if (newPrimaryId !== prevPrimaryId) {
        currentPrimary = primary || null
        emitter.emit('primary', { primary: currentPrimary })
      }
    } catch (e) {
      // non-critical
    }
  })

  return watcher
}

export function stopMonitoring() {
  if (watcher) {
    watcher.remove()
    watcher = null
  }
}

export function getFences() {
  return fences
}

export function filterFencesByDistance(userLat: number, userLng: number, radiusKm: number = 15) {
  const { filterFencesByDistance: filterFn } = require('../../../utils/geofenceLogic')
  const filtered = filterFn(fences, userLat, userLng, radiusKm)
  return filtered
}

export function getAllFencesFiltered(
  userLat?: number,
  userLng?: number,
  radiusKm: number = 15
): GeoFence[] {
  if (userLat === undefined || userLng === undefined) {
    return fences
  }
  return filterFencesByDistance(userLat, userLng, radiusKm)
}

export default { loadFences, startMonitoring, stopMonitoring, on, off, getFences, filterFencesByDistance, getAllFencesFiltered }
