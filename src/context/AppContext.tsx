import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import geofenceService from "../features/map/services/geofenceService";
import { appendTransition } from "../features/map/store/transitionStore";
import { syncTransitions } from "../features/map/services/syncTransitions";
import { Alert } from "react-native";
import { showToast } from "../utils/toast";
import {
  triggerHighRiskAlert,
  startProgressiveAlert,
  stopProgressiveAlert,
  acknowledgeHighRisk as ackHighRisk,
} from "../utils/alertHelpers";
import STORAGE_KEYS from "../constants/storageKeys";
import { readJSON, writeJSON, remove } from "../utils/storage";
import { drainSOSQueue, clearSOSQueue } from "../utils/offlineQueue";
import { drainSMSQueue, clearSMSQueue } from "../utils/smsQueue";
import { MOCK_CONTACTS, MOCK_GROUP, MOCK_ITINERARY } from "../utils/mockData";
import type { Lang } from "./translations";
import {
  login as apiLogin,
  loginWithCodes as apiLoginWithCodes,
  register as apiRegister,
  getTouristData,
  tripsToItinerary,
  itineraryToTrips,
  joinGroup as apiJoinGroup,
  createGroup as apiCreateGroup,
} from "../utils/api";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Buffer } from "buffer";
import {
  SafetyEvent,
  sendSafetyLocationUpdate,
} from "../services/safetyLocationService";
import touristSocketService, {
  SafetyScoreData,
} from "../services/touristSocketService";

const decodeBase64 = (str: string): string => {
  return Buffer.from(str, "base64").toString("binary");
};

const parseJwt = (token: string) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(decodeBase64(payload));
  } catch (e) {
    return null;
  }
};

type User = {
  touristId: string;
  name: string;
  email: string;
  phone: string;
  role?: "solo" | "group-member" | "tour-admin";
  groupId?: string;
  ownedGroupId?: string;
  itinerary: string[];
  dayWiseItinerary?: Array<{
    dayNumber: number;
    date: string;
    nodes: Array<{
      type: string;
      name: string;
      location?: { type?: string; coordinates?: [number, number] };
      address?: string;
      scheduledTime?: string;
      description?: string;
    }>;
  }>;
  emergencyContact: { name: string; phone: string };
  language: string;
  safetyScore: number;
  consent: { tracking: boolean; dataRetention: boolean };
  createdAt: string;
  expiresAt: string;
  audit: { regHash: string; regTxHash: string; eventId: string };
} | null;

type Contact = { id: string; name: string; phone: string };
type Trip = {
  id: string;
  title: string;
  date: string;
  notes?: string;
  dayWiseItinerary?: Array<{
    dayNumber: number;
    date: string;
    nodes: Array<{
      type: string;
      name: string;
      locationName: string;
      lat: number;
      lng: number;
      scheduledTime: string;
      activityDetails?: string;
    }>;
  }>;
};
type Geofence = {
  id: string;
  name: string;
  risk: "Low" | "Medium" | "High" | string;
};
type GroupMember = {
  id: string;
  name: string;
  lastCheckIn: string;
  lat: number;
  lng: number;
};

type AppState = {
  user: User;
  token: string | null;
  contacts: Contact[];
  trips: Trip[];
  geofences: Geofence[];
  group: GroupMember[];
  shareLocation: boolean;
  offline: boolean;
  language: Lang;
  authorityPhone?: string | null;
  computedSafetyScore?: number | null;
  currentPrimary?: { id: string; name: string; risk?: string } | null;
  justRegistered: boolean;
};

type AppContextValue = {
  state: AppState;
  netInfoAvailable?: boolean | null;
  getToken: () => string | null;
  setJustRegistered: (val: boolean) => void;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; message: string }>;
  loginWithCodes: (
    guideId: string,
    touristId: string,
    groupAccessCode: string,
  ) => Promise<{ ok: boolean; message: string }>;
  register: (params: {
    role: "solo" | "group-member" | "tour-admin";
    name: string;
    govId: string;
    phone: string;
    email: string;
    password: string;
    dayWiseItinerary?: string[];
    emergencyContact?: { name: string; phone: string };
    language: string;
    tripEndDate?: string;
    accessCode?: string;
    organizationName?: string;
    age?: string;
    gender?: string;
    dateOfBirth?: string;
    nationality?: string;
    bloodGroup?: string;
  }) => Promise<{ ok: boolean; message: string; regTxHash?: string }>;
  joinGroup: (accessCode: string) => Promise<{ ok: boolean; message: string }>;
  createGroup: (
    groupData: any,
  ) => Promise<{ ok: boolean; message: string; groupId?: string }>;
  updateGroupItinerary: (
    itinerary: any[],
  ) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<NonNullable<User>>) => Promise<void>;
  addContact: (c: Omit<Contact, "id">) => void;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  removeContact: (id: string) => void;
  addTrip: (t: Omit<Trip, "id">) => Promise<void>;
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>;
  removeTrip: (id: string) => Promise<void>;
  updateTripsFromBackend: () => Promise<void>;
  toggleShareLocation: () => void;
  setOffline: (v: boolean) => void;
  setLanguage: (lang: Lang) => void;
  setAuthorityPhone: (phone: string | null) => void;
  setComputedSafetyScore: (score: number | null) => void;
  wipeMockData: () => Promise<void>;
  acknowledgeHighRisk: (minutes: number) => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const STORAGE_KEY = STORAGE_KEYS.APP_STATE;

const defaultState: AppState = {
  user: null,
  token: null,
  contacts: MOCK_CONTACTS,
  trips: [],
  geofences: [],
  group: MOCK_GROUP,
  shareLocation: false,
  offline: false,
  language: "en",
  authorityPhone: null,
  computedSafetyScore: null,
  currentPrimary: null,
  justRegistered: false,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [netInfoAvailable, setNetInfoAvailable] = useState<boolean | null>(
    null,
  );
  // Drain queued SOS items when app becomes hydrated and online, or when offline->online transition occurs.
  const drainingRef = useRef(false);
  const prevOfflineRef = useRef<boolean | null>(null);
  const tokenRef = useRef<string | null>(null);
  const stateRef = useRef<AppState>(state);
  const safetyNotificationSentAtRef = useRef<Record<string, number>>({});

  const SAFETY_LOCATION_INTERVAL_MS = 5 * 60 * 1000;
  const SAFETY_NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  const getSafetyNotificationTitle = (event: SafetyEvent): string => {
    if (event.zoneType === "danger_zone") return "Critical Safety Alert";
    if (event.zoneType === "risk_grid") return "Risk Area Alert";
    return "Geofence Alert";
  };

  const buildSafetyNotificationKey = (event: SafetyEvent): string => {
    return [
      event.zoneKey,
      event.state,
      event.thresholdMeters || 0,
      event.occurredAt,
    ].join(":");
  };

  // keep refs updated with latest state/token to avoid stale closures in listeners
  useEffect(() => {
    tokenRef.current = state.token;
  }, [state.token]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Centralized offline setter so both UI toggle and NetInfo use same logic
  const handleSetOffline = (v: boolean) => {
    try {
      console.log("handleSetOffline called, offline=", v);
    } catch (e) {}
    setState((s) => ({ ...s, offline: v }));
    // if switching to online, attempt to drain queued SOS items
    if (!v) {
      if (drainingRef.current) return;
      drainingRef.current = true;
      (async () => {
        try {
          const tokenNow = tokenRef.current;
          if (tokenNow) {
            try {
              console.log("drainSOSQueue starting (setOffline false)");
            } catch (e) {}
            const res = await drainSOSQueue(tokenNow);
            try {
              console.log("drainSOSQueue result (setOffline false)", res);
            } catch (e) {}
            if (
              res &&
              Array.isArray(res.failed) &&
              res.failed.length === 0 &&
              Array.isArray(res.success) &&
              res.success.length > 0
            ) {
              try {
                await clearSOSQueue();
                try {
                  console.log("clearSOSQueue called after successful drain");
                } catch (e) {}
              } catch (e) {}
            }
            // Attempt to drain queued SMS as well (best-effort)
            try {
              const smsRes = await drainSMSQueue();
              try {
                console.log("drainSMSQueue result", smsRes);
              } catch (e) {}
              if (
                smsRes &&
                Array.isArray(smsRes.failed) &&
                smsRes.failed.length === 0 &&
                Array.isArray(smsRes.success) &&
                smsRes.success.length > 0
              ) {
                try {
                  await clearSMSQueue();
                  try {
                    console.log("clearSMSQueue called after successful drain");
                  } catch (e) {}
                } catch (e) {}
              }
            } catch (e) {
              console.warn("drainSMSQueue failed", e);
            }
          } else {
            try {
              console.log("drainSOSQueue skipped: no token");
            } catch (e) {}
          }
        } catch (e) {
          console.warn("drainSOSQueue on setOffline(false) error", e);
        } finally {
          drainingRef.current = false;
        }
      })();
    }
  };
  // Automatic connectivity listener (dynamic import so app still runs if NetInfo missing)
  useEffect(() => {
    let unsub: any = null;
    let mounted = true;
    (async () => {
      try {
        const mod: any = await import("@react-native-community/netinfo");
        const NetInfo = mod && (mod.default || mod);
        if (!NetInfo) {
          try {
            console.log("NetInfo import resolved but no default export");
          } catch (e) {}
          setNetInfoAvailable(false);
          return;
        }
        setNetInfoAvailable(true);
        try {
          console.log("NetInfo available - fetching initial state");
        } catch (e) {}
        try {
          const st = await NetInfo.fetch();
          const online =
            !!st.isConnected &&
            (typeof st.isInternetReachable === "undefined"
              ? true
              : !!st.isInternetReachable);
          try {
            console.log(
              "NetInfo initial fetch isConnected=",
              st.isConnected,
              "isInternetReachable=",
              st.isInternetReachable,
              "=> online=",
              online,
            );
          } catch (e) {}
          // update offline flag using centralized handler
          handleSetOffline(!online);
        } catch (e) {
          try {
            console.warn("NetInfo initial fetch failed", e);
          } catch (ee) {}
        }

        unsub = NetInfo.addEventListener((st: any) => {
          const online =
            !!st.isConnected &&
            (typeof st.isInternetReachable === "undefined"
              ? true
              : !!st.isInternetReachable);
          try {
            console.log(
              "NetInfo event, isConnected=",
              st.isConnected,
              "isInternetReachable=",
              st.isInternetReachable,
              "=> online=",
              online,
            );
          } catch (e) {}
          // update offline flag using centralized handler
          handleSetOffline(!online);
        });
      } catch (e) {
        try {
          console.log(
            "NetInfo not available; automatic connectivity detection disabled",
          );
        } catch (ee) {}
        setNetInfoAvailable(false);
      }
    })();
    return () => {
      mounted = false;
      try {
        if (unsub) unsub();
      } catch (e) {}
    };
  }, []);
  // load persisted app state once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const parsed = await readJSON<typeof defaultState>(
          STORAGE_KEY,
          undefined,
        );
        if (parsed && mounted) {
          // restore persisted state (including token). We'll avoid overwriting trips so that
          // server-sourced itineraries can be refreshed below if needed.
          setState((prev) => ({ ...defaultState, ...prev, ...parsed }));
          // If the persisted state contains a token, always refresh /me now
          // This ensures server-side updates (groupId, name, itinerary) are reflected
          try {
            if (parsed.token) {
              console.log(
                "Hydration: token present in storage but no trips — fetching /me",
              );
              const userRes = await getTouristData(parsed.token);
              const userData = Array.isArray(userRes)
                ? userRes.length
                  ? userRes[0]
                  : null
                : userRes;
              if (userData && mounted) {
                const itinerary = Array.isArray(userData.dayWiseItinerary)
                  ? userData.dayWiseItinerary
                  : [];
                const trips = itineraryToTrips(itinerary);
                setState((s) => ({
                  ...s,
                  user: userData,
                  token: parsed.token,
                  trips,
                }));
                try {
                  console.log("Hydration fetched itinerary:", {
                    count: itinerary.length,
                  });
                } catch (e) {}
              }
            }
          } catch (e: any) {
            const errorMsg = e?.message || String(e);
            const is401Unauthorized =
              errorMsg.toLowerCase().includes("unauthorized") ||
              errorMsg.includes("401") ||
              errorMsg.toLowerCase().includes("jwt expired") ||
              errorMsg.toLowerCase().includes("jwt malformed");
            console.warn("Hydration: failed to refresh /me", {
              error: errorMsg,
              is401: is401Unauthorized,
            });
            if (is401Unauthorized && mounted) {
              console.log(
                "Hydration: token invalid or expired, clearing auth state and redirecting to login",
              );
              await remove(STORAGE_KEY);
              setState(defaultState);
              setTimeout(() => {
                try {
                  showToast("Session expired. Please login again.");
                } catch (ee) {}
              }, 500);
            }
          }
        }
      } catch (error) {
        console.warn("Error loading app state:", error);
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // start geofence monitoring and periodic sync after hydration
  // NOTE: this effect should only run once after hydration to avoid re-registering
  // listeners and re-creating intervals on every state change (which can cause
  // frequent re-renders and UI jitter, especially on lower-end devices).
  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;

    (async () => {
      try {
        // Pass userId to loadFences to fetch user's personal itinerary geofences
        const userId = state.user?.touristId;
        await geofenceService.loadFences(undefined, undefined, userId);
        // start geofence monitoring; transitions will be logged on enter/exit
        await geofenceService.startMonitoring({ intervalMs: 30000 });

        geofenceService.on("enter", ({ fence, location }) => {
          try {
            showToast(`Entered: ${fence.name} (${fence.category || "zone"})`);
          } catch (e) {
            try {
              Alert.alert(
                "Geo-fence entered",
                `${fence.name} (${fence.category || "zone"})`,
              );
            } catch (ee) {
              console.log("enter alert failed", ee);
            }
          }
          try {
            const rl = (fence.riskLevel || "").toString().toLowerCase();
            if (rl.includes("high")) {
              // Start progressive alert escalation for sustained presence
              try {
                startProgressiveAlert(
                  `High risk area: ${fence.name}`,
                  fence.category || "High risk zone",
                );
              } catch (e) {
                /* ignore */
              }
            }
          } catch (e) {
            /* ignore */
          }
          try {
            appendTransition({
              id: `t${Date.now()}`,
              fenceId: fence.id,
              fenceName: fence.name,
              type: "enter",
              at: Date.now(),
              coords: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
            });
          } catch (e) {
            /* ignore */
          }
        });

        geofenceService.on("exit", ({ fence, location }) => {
          try {
            showToast(`Exited: ${fence.name} (${fence.category || "zone"})`);
          } catch (e) {
            try {
              Alert.alert(
                "Geo-fence exited",
                `${fence.name} (${fence.category || "zone"})`,
              );
            } catch (ee) {
              console.log("exit alert failed", ee);
            }
          }
          try {
            stopProgressiveAlert();
          } catch (e) {
            /* ignore */
          }
          try {
            appendTransition({
              id: `t${Date.now()}`,
              fenceId: fence.id,
              fenceName: fence.name,
              type: "exit",
              at: Date.now(),
              coords: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
            });
          } catch (e) {
            /* ignore */
          }
        });

        geofenceService.on("primary", ({ primary }) => {
          try {
            if (!primary) setState((s) => ({ ...s, currentPrimary: null }));
            else
              setState((s) => ({
                ...s,
                currentPrimary: {
                  id: primary.id,
                  name: primary.name,
                  risk: primary.riskLevel,
                },
              }));
          } catch (e) {
            /* ignore */
          }
          try {
            const rl = (primary?.riskLevel || "").toString().toLowerCase();
            if (!rl.includes("high")) stopProgressiveAlert();
          } catch (e) {
            /* ignore */
          }
        });
      } catch (e) {
        console.warn("geofence monitor failed to start", e);
      }
    })();

    let syncInterval: any = null;
    try {
      // keep a safety net sync for transitions every 15 minutes (batch uploads handle samples)
      // Use stateRef.current to avoid this effect depending on changing `state`.
      syncInterval = setInterval(
        async () => {
          try {
            if (!stateRef.current.offline)
              await syncTransitions(stateRef.current.token);
          } catch (e) {}
        },
        15 * 60 * 1000,
      );
    } catch (e) {
      /* ignore */
    }

    // Persist current state once on start (use stateRef to avoid depending on `state`)
    const saveState = async () => {
      try {
        await writeJSON(STORAGE_KEY, stateRef.current);
      } catch (error) {
        console.warn("Error saving app state:", error);
      }
    };
    saveState();

    return () => {
      mounted = false;
      try {
        geofenceService.off("enter", () => {});
        geofenceService.off("exit", () => {});
        geofenceService.off("primary", () => {});
      } catch (e) {}
      try {
        if (syncInterval) clearInterval(syncInterval);
      } catch (e) {}
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.user?.touristId) return;

    let isDisposed = false;
    let intervalRef: ReturnType<typeof setInterval> | null = null;

    const hasLocationPermission = async (): Promise<boolean> => {
      try {
        const current = await Location.getForegroundPermissionsAsync();
        if (current.status === "granted") return true;
        const requested = await Location.requestForegroundPermissionsAsync();
        return requested.status === "granted";
      } catch (error) {
        console.warn(
          "[SafetyTracking] Location permission check failed:",
          error,
        );
        return false;
      }
    };

    const hasNotificationPermission = async (): Promise<boolean> => {
      try {
        const current = await Notifications.getPermissionsAsync();
        if (current.status === "granted") return true;
        const requested = await Notifications.requestPermissionsAsync();
        return requested.status === "granted";
      } catch (error) {
        console.warn(
          "[SafetyTracking] Notification permission check failed:",
          error,
        );
        return false;
      }
    };

    const pruneNotificationRegistry = () => {
      const now = Date.now();
      const registry = safetyNotificationSentAtRef.current;
      Object.keys(registry).forEach((key) => {
        if (now - registry[key] > SAFETY_NOTIFICATION_COOLDOWN_MS) {
          delete registry[key];
        }
      });
    };

    const syncSafetyLocation = async () => {
      if (isDisposed) return;
      if (stateRef.current.offline) return;

      const userId = stateRef.current.user?.touristId;
      if (!userId) return;

      const locationPermissionGranted = await hasLocationPermission();
      if (!locationPermissionGranted) return;

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const response = await sendSafetyLocationUpdate({
          userId: String(userId),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
          safetyScore:
            stateRef.current.computedSafetyScore ||
            stateRef.current.user?.safetyScore ||
            0,
        });

        if (response) {
          console.log(
            "[SafetyTracking] Location synced:",
            "userId=",
            userId,
            "events=",
            response.events?.length || 0,
          );
        } else {
          console.warn("[SafetyTracking] Location sync returned null response");
        }

        if (
          !response ||
          !Array.isArray(response.events) ||
          response.events.length === 0
        ) {
          return;
        }

        const notificationPermissionGranted = await hasNotificationPermission();
        if (!notificationPermissionGranted) return;

        pruneNotificationRegistry();

        for (const event of response.events) {
          const dedupeKey = buildSafetyNotificationKey(event);
          const lastSentAt = safetyNotificationSentAtRef.current[dedupeKey];
          const now = Date.now();
          if (
            lastSentAt &&
            now - lastSentAt < SAFETY_NOTIFICATION_COOLDOWN_MS
          ) {
            continue;
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: getSafetyNotificationTitle(event),
              body: event.message,
              data: {
                type: "safety-zone-event",
                ...event,
              },
            },
            trigger: null,
          });

          safetyNotificationSentAtRef.current[dedupeKey] = now;
        }
      } catch (error) {
        console.warn("[SafetyTracking] Failed syncing safety location:", error);
      }
    };

    syncSafetyLocation();
    intervalRef = setInterval(syncSafetyLocation, SAFETY_LOCATION_INTERVAL_MS);

    return () => {
      isDisposed = true;
      if (intervalRef) {
        clearInterval(intervalRef);
      }
    };
  }, [hydrated, state.offline, state.user?.touristId]);

  // Day change detection: refresh geofences when the day changes (for itinerary geofences)
  useEffect(() => {
    if (!hydrated) return;
    if (!state.user?.touristId) return;

    // Store the current day to detect changes
    let currentDay = new Date().toDateString();

    const checkDayChange = async () => {
      const newDay = new Date().toDateString();
      if (newDay !== currentDay) {
        console.log("Day changed - refreshing geofences for new itinerary day");
        currentDay = newDay;

        // Reload geofences to get updated itinerary geofences for the new day
        try {
          const userId = state.user?.touristId;
          await geofenceService.loadFences(undefined, undefined, userId);
          console.log("Geofences refreshed after day change");
        } catch (error) {
          console.warn("Failed to refresh geofences after day change:", error);
        }
      }
    };

    // Check for day change every hour (3600000 ms)
    const dayChangeInterval = setInterval(checkDayChange, 3600000);

    // Also check immediately when user changes (e.g., login/logout)
    checkDayChange();

    return () => {
      clearInterval(dayChangeInterval);
    };
  }, [hydrated, state.user?.touristId]);

  // Listen for real-time safety score updates
  useEffect(() => {
    // Only subscribe if we have a logged-in user with an ID
    if (!hydrated || !state.user?.touristId) return;

    console.log(
      "[AppContext] Setting up safety score listener for user:",
      state.user.touristId,
    );

    // Subscribe to safety score updates from socket
    const unsubscribe = touristSocketService.onSafetyScoreUpdate(
      (data: SafetyScoreData) => {
        console.log(
          "[AppContext] Received real-time safety score update:",
          data.safetyScore,
        );

        // Update state with new score
        setState((s) => ({
          ...s,
          computedSafetyScore: data.safetyScore,
          // Also update the user object if present, to keep them in sync
          user: s.user ? { ...s.user, safetyScore: data.safetyScore } : s.user,
        }));
      },
    );

    return () => {
      console.log("[AppContext] Cleaning up safety score listener");
      if (unsubscribe) unsubscribe();
    };
  }, [hydrated, state.user?.touristId]);

  // Persist state changes with a small debounce to avoid frequent disk writes when
  // the app state updates rapidly (this also helps reduce re-renders related to
  // storage operations).
  useEffect(() => {
    const id = setTimeout(() => {
      (async () => {
        try {
          await writeJSON(STORAGE_KEY, state);
        } catch (error) {
          console.warn("Error saving app state:", error);
        }
      })();
    }, 800);
    return () => clearTimeout(id);
  }, [state]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      netInfoAvailable: netInfoAvailable,
      getToken: () => tokenRef.current,
      setJustRegistered(val) {
        setState((s) => ({ ...s, justRegistered: val }));
      },
      async login(email, password) {
        try {
          const data = await apiLogin(email, password);
          // getTouristData may return an object or an array (API docs show object but some endpoints return arrays)
          const userRes = await getTouristData(data.token);
          let userData: any = null;
          if (Array.isArray(userRes)) {
            userData = userRes.length ? userRes[0] : null;
          } else {
            userData = userRes;
          }

          if (!userData) throw new Error("Failed to fetch user data");

          // Frontend-only fallback: if role is missing from the backend response, try to derive it from the
          // JWT token returned by apiLogin. This assumes the backend has already validated and signed the token
          // and that the claims can be trusted for read-only UI purposes. If the backend does not include `role`
          // in its tourist data, this is a known limitation and should ideally be fixed on the backend instead
          // of relying on this client-side workaround.
          if (!userData.role && data.token) {
            const decoded = parseJwt(data.token);
            if (decoded && decoded.role) {
              userData.role = decoded.role;
              console.log(
                "Patched user role from token (frontend fallback):",
                userData.role,
              );
            }
          }

          // Frontend note: `ownedGroupId` is expected to come from the backend. For new admins it may legitimately
          // be missing until a group is created. If this becomes a problem, prefer fixing the backend contract
          // rather than inferring it from JWT or other client-side data.
          if (userData.role === "tour-admin" && !userData.ownedGroupId) {
            // It's possibly acceptable to have no ownedGroupId yet (new admin).
            // Intentionally not inferring ownedGroupId from the token here to avoid relying on unvalidated claims.
          }

          // Log login response and fetched user data for debugging
          try {
            console.log(
              "Login successful - token:",
              data.token,
              "touristId:",
              data.touristId,
              "user:",
              userData,
            );
          } catch (e) {
            // ignore logging errors
          }

          // Build trips from userData.itinerary. The API may provide an array of strings or objects.
          const itinerary = Array.isArray(userData.itinerary)
            ? userData.itinerary
            : [];
          const trips = itineraryToTrips(itinerary);

          // Map emergency contact from API (if present) to app contacts so UI shows real contact(s)
          let contactsFromApi:
            | { id: string; name: string; phone: string }[]
            | null = null;
          try {
            if (userData.emergencyContact) {
              const ec = userData.emergencyContact;
              const resolved = Array.isArray(ec) ? ec : [ec];
              const now = Date.now();
              contactsFromApi = resolved.map((c: any, i: number) => ({
                id: `ec${now}_${i}`,
                name: c.name || c.title || "Emergency",
                phone: c.phone || c.mobile || c.number || "",
              }));
            }
          } catch (e) {
            // keep contactsFromApi null on error
            contactsFromApi = null;
          }

          setState((s) => ({
            ...s,
            user: userData,
            token: data.token,
            trips,
            contacts: contactsFromApi || s.contacts,
          }));
          try {
            console.log("Built trips from API:", {
              count: trips.length,
              trips,
            });
          } catch (e) {}
          return { ok: true, message: "Login successful" };
        } catch (error: any) {
          // Check if this is a group member trying to login with email/password
          if (
            error.message &&
            error.message.includes("must login using the 3-code system")
          ) {
            return {
              ok: false,
              message:
                "Group members must use the 3-code login. Click 'Group Member? Login with Codes' below.",
              isGroupMemberError: true,
            };
          }
          return { ok: false, message: error.message || "An error occurred" };
        }
      },
      async loginWithCodes(guideId, touristId, groupAccessCode) {
        try {
          const data = await apiLoginWithCodes(
            guideId,
            touristId,
            groupAccessCode,
          );

          if (!data.success || !data.data) {
            throw new Error(data.message || "Login failed");
          }

          // Get full user data
          const userRes = await getTouristData(data.data.token);
          let userData: any = null;
          if (Array.isArray(userRes)) {
            userData = userRes.length ? userRes[0] : null;
          } else {
            userData = userRes;
          }

          if (!userData) throw new Error("Failed to fetch user data");

          // IMPORTANT: Ensure role is set from the login response
          // The getTouristData might not return role, so we use it from login response
          if (!userData.role && data.data.role) {
            userData.role = data.data.role;
          }

          // Also ensure other fields from login response are preserved
          if (!userData.touristId && data.data.touristId) {
            userData.touristId = data.data.touristId;
          }
          if (!userData.groupId && data.data.groupId) {
            userData.groupId = data.data.groupId;
          }

          // Build trips from userData.itinerary
          const itinerary = Array.isArray(userData.itinerary)
            ? userData.itinerary
            : [];
          const trips = itineraryToTrips(itinerary);

          // Map emergency contact from API
          let contactsFromApi:
            | { id: string; name: string; phone: string }[]
            | null = null;
          try {
            if (userData.emergencyContact) {
              const ec = userData.emergencyContact;
              const resolved = Array.isArray(ec) ? ec : [ec];
              const now = Date.now();
              contactsFromApi = resolved.map((c: any, i: number) => ({
                id: `ec${now}_${i}`,
                name: c.name || c.title || "Emergency",
                phone: c.phone || c.mobile || c.number || "",
              }));
            }
          } catch (e) {
            contactsFromApi = null;
          }

          setState((s) => ({
            ...s,
            user: userData,
            token: data.data.token,
            trips,
            contacts: contactsFromApi || s.contacts,
          }));

          try {
            console.log("✅ 3-code login successful");
            console.log("   User role:", userData.role);
            console.log("   User name:", userData.name);
            console.log("   User ID:", userData.touristId);
          } catch (e) {}

          return { ok: true, message: "Login successful" };
        } catch (error: any) {
          return { ok: false, message: error.message || "An error occurred" };
        }
      },
      async register(params) {
        try {
          const data = await apiRegister(params);
          return {
            ok: true,
            message: "Registration successful",
            regTxHash: data.audit.regTxHash,
          };
        } catch (error: any) {
          return { ok: false, message: error.message || "An error occurred" };
        }
      },
      async joinGroup(accessCode) {
        try {
          const token = tokenRef.current;
          if (!token) throw new Error("Not authenticated");
          const data = await apiJoinGroup(token, accessCode);

          // Update local user state
          setState((prev) => ({
            ...prev,
            user: prev.user
              ? { ...prev.user, groupId: data.data?.groupId || "joined" }
              : null,
          }));

          return { ok: true, message: "Joined group successfully" };
        } catch (error: any) {
          return {
            ok: false,
            message: error.message || "Failed to join group",
          };
        }
      },
      async createGroup(groupData) {
        try {
          const token = tokenRef.current;
          if (!token) throw new Error("Not authenticated");
          const data = await apiCreateGroup(token, groupData);

          // Update local user state to reflect ownedGroupId and role change
          setState(
            (prev) =>
              ({
                ...prev,
                user: prev.user
                  ? {
                      ...prev.user,
                      ownedGroupId: data.data?.groupId,
                      role: "tour-admin" as const,
                      groupId: data.data?.groupId,
                    }
                  : null,
                // Also rebuild trips from the itinerary
                trips: itineraryToTrips(groupData.itinerary || []),
              }) as typeof defaultState,
          );

          return {
            ok: true,
            message: "Group created successfully",
            groupId: data.data?.groupId,
          };
        } catch (error: any) {
          return {
            ok: false,
            message: error.message || "Failed to create group",
          };
        }
      },
      async updateGroupItinerary(itinerary) {
        try {
          const token = tokenRef.current;
          if (!token) throw new Error("Not authenticated");

          const { updateGroupItinerary: apiUpdateGroupItinerary } =
            await import("../utils/api");
          const data = await apiUpdateGroupItinerary(token, itinerary);

          if (data?.success) {
            // Update local trips from the updated itinerary
            setState(
              (prev) =>
                ({
                  ...prev,
                  trips: itineraryToTrips(itinerary || []),
                }) as typeof defaultState,
            );

            // Refresh geofences after itinerary update
            try {
              const userId = stateRef.current.user?.touristId;
              if (userId) {
                await geofenceService.loadFences(undefined, undefined, userId);
                console.log("Geofences refreshed after itinerary update");
              }
            } catch (geoErr) {
              console.warn(
                "Failed to refresh geofences after itinerary update:",
                geoErr,
              );
            }

            return {
              ok: true,
              message: "Group itinerary updated successfully",
            };
          } else {
            throw new Error(data?.message || "Failed to update itinerary");
          }
        } catch (error: any) {
          return {
            ok: false,
            message: error.message || "Failed to update group itinerary",
          };
        }
      },
      async logout() {
        await remove(STORAGE_KEY);
        setState(defaultState);
      },
      async updateProfile(patch) {
        setState((s) => ({
          ...s,
          user: s.user ? { ...s.user, ...patch } : null,
        }));
        // In real app: call backend to update profile
      },
      addContact(c) {
        setState((s) => ({
          ...s,
          contacts: [...s.contacts, { ...c, id: `c${Date.now()}` }],
        }));
      },
      updateContact(id, patch) {
        setState((s) => ({
          ...s,
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        }));
      },
      removeContact(id) {
        setState((s) => ({
          ...s,
          contacts: s.contacts.filter((c) => c.id !== id),
        }));
      },
      addTrip: async (t) => {
        const newTrip = { ...t, id: `t${Date.now()}` };
        const updatedTrips = [...state.trips, newTrip];
        // Note: Backend doesn't support PATCH /api/tourist/me for updating trips
        // Trips are stored locally only. Use createGroup API for group itineraries.
        setState((s) => ({ ...s, trips: updatedTrips }));
      },
      updateTrip: async (id, patch) => {
        const updatedTrips = state.trips.map((tr) =>
          tr.id === id ? { ...tr, ...patch } : tr,
        );
        // Note: Backend doesn't support PATCH /api/tourist/me for updating trips
        // Trips are stored locally only. Use createGroup API for group itineraries.
        setState((s) => ({ ...s, trips: updatedTrips }));
      },
      removeTrip: async (id) => {
        const updatedTrips = state.trips.filter((tr) => tr.id !== id);
        // Note: Backend doesn't support PATCH /api/tourist/me for updating trips
        // Trips are stored locally only. Use createGroup API for group itineraries.
        setState((s) => ({ ...s, trips: updatedTrips }));
      },
      updateTripsFromBackend: async () => {
        try {
          if (!state.token) {
            throw new Error("Not authenticated");
          }

          const userRole = state.user?.role;
          console.log(
            "[AppContext] updateTripsFromBackend for role:",
            userRole,
          );

          // Solo travelers fetch from /api/itinerary
          if (userRole === "solo") {
            console.log("[AppContext] Fetching solo itinerary...");
            const { getSoloItinerary } = await import("../utils/api");
            const data = await getSoloItinerary(state.token);

            console.log("[AppContext] Solo itinerary response:", data);

            // Response structure: { success: true, data: [...dayWiseItinerary] }
            const itineraryData = data?.data || [];

            if (Array.isArray(itineraryData) && itineraryData.length > 0) {
              console.log(
                "[AppContext] Converting solo itinerary to trips:",
                itineraryData,
              );
              const trips = itineraryToTrips(itineraryData);
              console.log("[AppContext] Converted trips:", trips);
              setState((s) => ({ ...s, trips }));
              console.log("Solo trips updated from backend:", trips.length);

              // Refresh geofences after solo itinerary update
              try {
                const userId = state.user?.touristId;
                if (userId) {
                  await geofenceService.loadFences(
                    undefined,
                    undefined,
                    userId,
                  );
                  console.log(
                    "Geofences refreshed after solo itinerary update",
                  );
                }
              } catch (geoErr) {
                console.warn(
                  "Failed to refresh geofences after solo itinerary update:",
                  geoErr,
                );
              }
            } else {
              console.log("[AppContext] No solo itinerary found");
              setState((s) => ({ ...s, trips: [] }));
            }
          } else {
            // Group members/admins fetch from group dashboard
            console.log("[AppContext] Fetching group dashboard...");
            const { getGroupDashboard } = await import("../utils/api");
            let groupItinerary: any[] | null = null;
            try {
              const data = await getGroupDashboard(state.token);
              console.log("[AppContext] Group dashboard response:", data);
              const groupData = data?.data || data;
              if (
                groupData &&
                Array.isArray(groupData.itinerary) &&
                groupData.itinerary.length > 0
              ) {
                groupItinerary = groupData.itinerary;
              }
            } catch (dashErr: any) {
              console.warn(
                "[AppContext] Group dashboard failed, will use user itinerary:",
                dashErr?.message,
              );
            }

            if (groupItinerary && groupItinerary.length > 0) {
              console.log(
                "[AppContext] Found group itinerary:",
                groupItinerary.length,
                "days",
              );
              const trips = itineraryToTrips(groupItinerary);
              console.log("[AppContext] Converted trips:", trips);
              setState((s) => ({ ...s, trips }));
              console.log("Group trips updated from backend:", trips.length);

              // Refresh geofences after group itinerary fetch
              try {
                const userId = state.user?.touristId;
                if (userId) {
                  await geofenceService.loadFences(
                    undefined,
                    undefined,
                    userId,
                  );
                  console.log(
                    "Geofences refreshed after group itinerary fetch",
                  );
                }
              } catch (geoErr) {
                console.warn(
                  "Failed to refresh geofences after group itinerary fetch:",
                  geoErr,
                );
              }
            } else {
              // Fallback: use the user's own dayWiseItinerary
              const fallbackItinerary = state.user?.dayWiseItinerary || [];
              if (
                Array.isArray(fallbackItinerary) &&
                fallbackItinerary.length > 0
              ) {
                console.log(
                  "[AppContext] Using user dayWiseItinerary as fallback:",
                  fallbackItinerary.length,
                  "days",
                );
                const trips = itineraryToTrips(fallbackItinerary);
                setState((s) => ({ ...s, trips }));
                console.log("User trips updated from backend:", trips.length);
              } else {
                console.log("[AppContext] No itinerary found anywhere");
                setState((s) => ({ ...s, trips: [] }));
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch trips from backend:", error);
          throw error;
        }
      },
      toggleShareLocation() {
        setState((s) => ({ ...s, shareLocation: !s.shareLocation }));
      },
      setOffline(v) {
        handleSetOffline(v);
      },
      setLanguage(lang) {
        setState((s) => ({ ...s, language: lang }));
      },
      setAuthorityPhone(phone) {
        setState((s) => ({ ...s, authorityPhone: phone }));
      },
      setComputedSafetyScore(score) {
        setState((s) => ({ ...s, computedSafetyScore: score }));
      },
      async wipeMockData() {
        await remove(STORAGE_KEY);
        setState(defaultState);
      },
      async acknowledgeHighRisk(minutes: number) {
        try {
          await ackHighRisk(minutes);
        } catch (e) {
          /* ignore */
        }
      },
    }),
    [state, hydrated],
  );

  if (!hydrated) {
    return null; // Return null instead of undefined to prevent rendering issues
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
