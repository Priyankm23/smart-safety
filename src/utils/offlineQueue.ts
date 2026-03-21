import STORAGE_KEYS from "../constants/storageKeys";
import { readJSON, writeJSON, pushToList, remove } from "./storage";
import { triggerSOS } from "./api";
import touristSocketService from "../services/touristSocketService";

export type QueuedSOS = {
  id: string;
  timestamp: number;
  token?: string | null;
  sosData: any;
  attempts?: number;
  idempotencyKey?: string;
};

const QUEUE_KEY = STORAGE_KEYS.SOS_QUEUE;

export async function queueSOS(
  item: Omit<QueuedSOS, "id" | "timestamp" | "attempts" | "idempotencyKey">,
) {
  try {
    const entry: QueuedSOS = {
      id: `sos_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      timestamp: Date.now(),
      attempts: 0,
      idempotencyKey: `sos_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      ...item,
    };
    try {
      console.log("queueSOS: adding entry", {
        id: entry.id,
        timestamp: entry.timestamp,
      });
    } catch (e) {}
    // Prepend to list using helper (pushToList adds to front)
    await pushToList(QUEUE_KEY, entry, 500);
    return entry;
  } catch (e) {
    console.warn("queueSOS failed", e);
    throw e;
  }
}

export async function getSOSQueue(): Promise<QueuedSOS[]> {
  try {
    const arr = (await readJSON<QueuedSOS[]>(QUEUE_KEY, [])) || [];
    try {
      console.log("getSOSQueue: read", {
        count: Array.isArray(arr) ? arr.length : 0,
      });
    } catch (e) {}
    return arr;
  } catch (e) {
    console.warn("getSOSQueue failed", e);
    return [];
  }
}

export async function clearSOSQueue(): Promise<void> {
  try {
    await remove(QUEUE_KEY);
    try {
      console.log("clearSOSQueue: removed storage key", QUEUE_KEY);
    } catch (e) {}
  } catch (e) {
    console.warn("clearSOSQueue failed", e);
  }
}

// Attempt to send queued SOS items. If token is present on item it will be used, else will try the provided token
// Returns an object with successes and failures
export async function drainSOSQueue(globalToken?: string, maxAttempts = 3) {
  const results = {
    success: [] as string[],
    failed: [] as { id: string; reason: any }[],
  };
  try {
    const queue = await getSOSQueue();
    if (!queue || queue.length === 0) return results;

    // We'll process from oldest to newest (reverse of storage push order)
    const items = [...queue].reverse();
    const remaining: QueuedSOS[] = [];

    for (const it of items) {
      const tokenToUse = it.token || globalToken;
      if (!tokenToUse) {
        // cannot send without token; keep in queue
        remaining.push(it);
        continue;
      }

      try {
        await triggerSOS(tokenToUse, it.sosData);
        results.success.push(it.id);

        // Request immediate safety score recalculation after queued SOS is successfully sent
        console.log(
          "[OfflineQueue] Requesting safety score update after processing queued SOS",
        );
        touristSocketService.requestSafetyScoreUpdate();
      } catch (e) {
        // If error looks like a network-level failure, stop draining and persist remaining items
        const isNetworkErr =
          (e &&
            e.message &&
            e.message
              .toString()
              .toLowerCase()
              .includes("network request failed")) ||
          (e &&
            e.toString &&
            e.toString().toLowerCase().includes("network request failed"));
        if (isNetworkErr) {
          // push current item and all items not yet processed back into remaining (preserve attempts)
          remaining.push({ ...it, attempts: (it.attempts || 0) + 1 });
          // find the index of current item in the original items array to append the rest
          const curIdx = items.indexOf(it);
          for (let j = curIdx + 1; j < items.length; j++) {
            remaining.push(items[j]);
          }
          try {
            console.log(
              "drainSOSQueue: network error detected, stopping drain to avoid repeated failures",
            );
          } catch (ee) {}
          break;
        }

        const attempts = (it.attempts || 0) + 1;
        if (attempts >= maxAttempts) {
          results.failed.push({ id: it.id, reason: e });
        } else {
          remaining.push({ ...it, attempts });
        }
      }
    }

    // Save remaining back to storage in original order (most recent first)
    await writeJSON(QUEUE_KEY, remaining.reverse());
    return results;
  } catch (e) {
    console.warn("drainSOSQueue failed", e);
    return results;
  }
}
