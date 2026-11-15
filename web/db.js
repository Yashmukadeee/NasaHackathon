/**
 * ASTRA - Astronaut Health Intelligence System
 * web/db.js - Native IndexedDB Persistent Storage
 * 
 * Manages local offline telemetry, check-ins, clinical alerts,
 * multi-astronaut records, and store-and-forward telemetry synchronization.
 */

const DB_NAME = "ASTRA_HEALTH_DB";
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Open or initialize the IndexedDB instance with versioning and object stores.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    // Check IndexedDB availability
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this runtime environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Astronauts store
      if (!db.objectStoreNames.contains("astronauts")) {
        const astroStore = db.createObjectStore("astronauts", { keyPath: "id" });
        astroStore.createIndex("name", "name", { unique: false });
        astroStore.createIndex("role", "role", { unique: false });
      }

      // 2. Telemetry store (Key: "astronautId_day")
      if (!db.objectStoreNames.contains("telemetry")) {
        const telemStore = db.createObjectStore("telemetry", { keyPath: "id" });
        telemStore.createIndex("astronaut_id", "astronaut_id", { unique: false });
        telemStore.createIndex("day", "day", { unique: false });
        telemStore.createIndex("astronaut_day", ["astronaut_id", "day"], { unique: true });
      }

      // 3. Alerts store
      if (!db.objectStoreNames.contains("alerts")) {
        const alertStore = db.createObjectStore("alerts", { keyPath: "id", autoIncrement: true });
        alertStore.createIndex("astronaut_id", "astronaut_id", { unique: false });
        alertStore.createIndex("day", "day", { unique: false });
        alertStore.createIndex("domain", "domain", { unique: false });
        alertStore.createIndex("severity", "severity", { unique: false });
      }

      // 4. Check-ins store (Key: "astronautId_day")
      if (!db.objectStoreNames.contains("checkins")) {
        const checkinStore = db.createObjectStore("checkins", { keyPath: "id" });
        checkinStore.createIndex("astronaut_id", "astronaut_id", { unique: false });
        checkinStore.createIndex("day", "day", { unique: false });
        checkinStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // 5. Store-and-Forward Telemetry Synchronization Queue
      if (!db.objectStoreNames.contains("sync_queue")) {
        const syncStore = db.createObjectStore("sync_queue", { keyPath: "id" });
        syncStore.createIndex("status", "status", { unique: false });
        syncStore.createIndex("timestamp", "timestamp", { unique: false });
        syncStore.createIndex("type", "type", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("[ASTRA DB] IndexedDB initialization error:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Execute a transactional query with auto-commit and error handling.
 */
function withStore(storeName, mode, callback) {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = callback(store);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Validate telemetry record structure.
 */
function validateTelemetry(record) {
  if (!record || typeof record !== "object") throw new Error("Invalid telemetry record");
  if (!record.astronaut_id) throw new Error("Missing astronaut_id in telemetry");
  if (typeof record.day !== "number" || record.day < 1) throw new Error("Invalid mission day");
  if (!record.vitals || typeof record.vitals !== "object") throw new Error("Missing vitals map");
}

/**
 * Save or update a daily telemetry record for an astronaut.
 */
export function saveTelemetry(record) {
  validateTelemetry(record);
  const id = `${record.astronaut_id}_${record.day}`;
  const payload = {
    id,
    astronaut_id: record.astronaut_id,
    day: record.day,
    vitals: record.vitals,
    simulated: Boolean(record.simulated),
    updated_at: new Date().toISOString(),
  };

  return withStore("telemetry", "readwrite", (store) => store.put(payload));
}

/**
 * Retrieve telemetry for an astronaut on a specific day.
 */
export function getTelemetry(astronautId, day) {
  const id = `${astronautId}_${day}`;
  return withStore("telemetry", "readonly", (store) => store.get(id));
}

/**
 * Retrieve telemetry for an astronaut across a day range.
 */
export function getTelemetryRange(astronautId, startDay = 1, endDay = 180) {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("telemetry", "readonly");
      const store = tx.objectStore("telemetry");
      const index = store.index("astronaut_id");
      const request = index.getAll(astronautId);

      request.onsuccess = () => {
        const all = request.result || [];
        const filtered = all
          .filter((item) => item.day >= startDay && item.day <= endDay)
          .sort((a, b) => a.day - b.day);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Save a subjective astronaut check-in.
 */
export function saveCheckIn(record) {
  if (!record.astronaut_id || !record.day) throw new Error("Invalid check-in record parameters");
  const id = `${record.astronaut_id}_${record.day}`;
  const payload = {
    id,
    astronaut_id: record.astronaut_id,
    day: record.day,
    mood: Number(record.mood) || 0,
    stress: Number(record.stress) || 0,
    fatigue: Number(record.fatigue) || 0,
    sleep: Number(record.sleep) || 0,
    symptoms: Array.isArray(record.symptoms) ? record.symptoms : [],
    notes: typeof record.notes === "string" ? record.notes.trim() : "",
    timestamp: new Date().toISOString(),
  };

  return withStore("checkins", "readwrite", (store) => store.put(payload)).then((res) => {
    // Automatically add check-in to the Store-and-Forward sync queue
    addToSyncQueue({
      type: "CHECKIN",
      astronaut_id: record.astronaut_id,
      day: record.day,
      payload,
    }).catch((e) => console.warn("[ASTRA DB] Could not queue check-in for sync:", e));
    return res;
  });
}

/**
 * Retrieve all check-ins for an astronaut.
 */
export function getCheckIns(astronautId) {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("checkins", "readonly");
      const store = tx.objectStore("checkins");
      const index = store.index("astronaut_id");
      const req = index.getAll(astronautId);

      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => a.day - b.day);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Save a clinical alert.
 */
export function saveAlert(record) {
  const payload = {
    astronaut_id: record.astronaut_id || "ASTRO-1",
    day: Number(record.day),
    domain: record.domain,
    severity: Number(record.severity), // 0: Normal, 1: Attention, 2: High Priority
    rule: record.rule || null,
    explanation: record.explanation || "",
    actions: record.actions || [],
    timestamp: new Date().toISOString(),
  };

  return withStore("alerts", "readwrite", (store) => store.add(payload));
}

/**
 * Retrieve alerts for an astronaut, optionally filtered by mission day.
 */
export function getAlerts(astronautId, day = null) {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("alerts", "readonly");
      const store = tx.objectStore("alerts");
      const index = store.index("astronaut_id");
      const req = index.getAll(astronautId);

      req.onsuccess = () => {
        let results = req.result || [];
        if (day !== null) {
          results = results.filter((a) => a.day === day);
        }
        results.sort((a, b) => b.day - a.day);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Add a record to the Store-and-Forward synchronization queue.
 */
export function addToSyncQueue(item) {
  const payload = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: item.type || "TELEMETRY",
    astronaut_id: item.astronaut_id,
    day: item.day,
    payload: item.payload,
    status: "PENDING", // PENDING | TRANSMITTED | ACKNOWLEDGED
    timestamp: new Date().toISOString(),
  };

  return withStore("sync_queue", "readwrite", (store) => store.put(payload));
}

/**
 * Retrieve all pending items in the synchronization queue.
 */
export function getPendingSync() {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sync_queue", "readonly");
      const store = tx.objectStore("sync_queue");
      const index = store.index("status");
      const req = index.getAll("PENDING");

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Mark a synchronization queue item as transmitted/acknowledged.
 */
export function markSyncComplete(syncId) {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      const getReq = store.get(syncId);

      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) {
          resolve(false);
          return;
        }
        item.status = "ACKNOWLEDGED";
        item.acknowledged_at = new Date().toISOString();
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

/**
 * Get aggregate database storage metrics for telemetry management screen.
 */
export function getDatabaseStats() {
  return initDB().then((db) => {
    const counts = {};
    const stores = ["astronauts", "telemetry", "alerts", "checkins", "sync_queue"];

    const promises = stores.map((s) => {
      return new Promise((resolve) => {
        const tx = db.transaction(s, "readonly");
        const countReq = tx.objectStore(s).count();
        countReq.onsuccess = () => {
          counts[s] = countReq.result;
          resolve();
        };
        countReq.onerror = () => {
          counts[s] = 0;
          resolve();
        };
      });
    });

    return Promise.all(promises).then(() => {
      return {
        ...counts,
        db_name: DB_NAME,
        version: DB_VERSION,
        online: typeof navigator !== "undefined" ? navigator.onLine : false,
      };
    });
  });
}

/**
 * Default Crew Roster for Multi-Astronaut Support.
 */
export const DEFAULT_ASTRONAUTS = [
  {
    id: "ASTRO-1",
    name: "Alex Chen",
    rank: "Commander",
    role: "Mission Commander & Systems Specialist",
    age: 41,
    blood_type: "O-POS",
    mission: "Ares Mars Transit Phase 1",
  },
  {
    id: "ASTRO-2",
    name: "Sarah Tanaka",
    rank: "Lieutenant Commander",
    role: "Crew Medical Officer (CMO) & Biologist",
    age: 38,
    blood_type: "A-POS",
    mission: "Ares Mars Transit Phase 1",
  },
  {
    id: "ASTRO-3",
    name: "Marcus Vance",
    rank: "Flight Engineer",
    role: "Habitat & Life Support Specialist",
    age: 44,
    blood_type: "B-POS",
    mission: "Ares Mars Transit Phase 1",
  },
];

/**
 * Seed initial astronauts and immutable benchmark telemetry if the store is empty.
 * Never overwrites user check-ins.
 */
export async function seedInitialData(benchmarkMission) {
  const db = await initDB();

  // 1. Seed Astronauts
  await new Promise((resolve, reject) => {
    const tx = db.transaction("astronauts", "readwrite");
    const store = tx.objectStore("astronauts");
    DEFAULT_ASTRONAUTS.forEach((a) => store.put(a));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 2. Check if telemetry store already has data
  const count = await withStore("telemetry", "readonly", (s) => s.count());
  if (count > 0 || !benchmarkMission || !benchmarkMission.series) {
    return;
  }

  console.log("[ASTRA DB] Seeding initial 180-day telemetry series from benchmark...");
  const tx = db.transaction("telemetry", "readwrite");
  const store = tx.objectStore("telemetry");

  const days = benchmarkMission.meta?.days || 180;
  for (let d = 1; d <= days; d++) {
    const vitals = {};
    for (const k in benchmarkMission.series) {
      vitals[k] = benchmarkMission.series[k][d - 1];
    }
    store.put({
      id: `ASTRO-1_${d}`,
      astronaut_id: "ASTRO-1",
      day: d,
      vitals,
      simulated: true,
      updated_at: new Date().toISOString(),
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log("[ASTRA DB] Seed complete: 180 telemetry days stored.");
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
