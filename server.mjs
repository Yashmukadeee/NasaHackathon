import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const WEB_DIR = path.resolve(__dirname, "web");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

// In-Memory store for backend telemetry synchronization & check-ins
const inMemoryStore = {
  checkins: [],
  alerts: [],
  syncLogs: [],
};

// Load benchmark mission
let benchmarkMission = null;
try {
  const missionPath = path.join(WEB_DIR, "data", "mission.json");
  if (fs.existsSync(missionPath)) {
    benchmarkMission = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  }
} catch (e) {
  console.warn("[ASTRA Server] Could not preload benchmark mission:", e.message);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error("Payload Too Large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// Router for /api/v1/*
async function handleApiRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // GET /api/v1/status
  if (method === "GET" && pathname === "/api/v1/status") {
    sendJson(res, 200, {
      success: true,
      service: "ASTRA Ground / Edge Telemetry Bridge",
      status: "ONLINE",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // GET /api/v1/telemetry?astronaut_id=ASTRO-1&start_day=1&end_day=30
  if (method === "GET" && pathname === "/api/v1/telemetry") {
    const astronautId = parsedUrl.searchParams.get("astronaut_id") || "ASTRO-1";
    const startDay = Math.max(1, Number(parsedUrl.searchParams.get("start_day")) || 1);
    const endDay = Math.min(180, Number(parsedUrl.searchParams.get("end_day")) || 180);

    if (!benchmarkMission || !benchmarkMission.series) {
      sendJson(res, 500, { success: false, error: "Benchmark telemetry dataset unavailable on server" });
      return;
    }

    const records = [];
    for (let d = startDay; d <= endDay; d++) {
      const vitals = {};
      for (const k in benchmarkMission.series) {
        vitals[k] = benchmarkMission.series[k][d - 1];
      }
      records.push({
        astronaut_id: astronautId,
        day: d,
        vitals,
        simulated: true,
      });
    }

    sendJson(res, 200, {
      success: true,
      astronaut_id: astronautId,
      start_day: startDay,
      end_day: endDay,
      count: records.length,
      data: records,
    });
    return;
  }

  // POST /api/v1/checkin
  if (method === "POST" && pathname === "/api/v1/checkin") {
    try {
      const body = await parseJsonBody(req);
      const { astronaut_id, day, mood, stress, fatigue, sleep, symptoms, notes } = body;

      if (!astronaut_id || typeof astronaut_id !== "string") {
        sendJson(res, 400, { success: false, error: "Validation failed: 'astronaut_id' is required" });
        return;
      }
      if (typeof day !== "number" || day < 1 || day > 180) {
        sendJson(res, 400, { success: false, error: "Validation failed: 'day' must be between 1 and 180" });
        return;
      }
      if (typeof mood !== "number" || mood < 0 || mood > 10) {
        sendJson(res, 400, { success: false, error: "Validation failed: 'mood' must be between 0 and 10" });
        return;
      }
      if (typeof stress !== "number" || stress < 0 || stress > 10) {
        sendJson(res, 400, { success: false, error: "Validation failed: 'stress' must be between 0 and 10" });
        return;
      }
      if (typeof fatigue !== "number" || fatigue < 0 || fatigue > 10) {
        sendJson(res, 400, { success: false, error: "Validation failed: 'fatigue' must be between 0 and 10" });
        return;
      }
      if (typeof sleep !== "number" || sleep < 0 || sleep > 24) {
        sendJson(res, 400, { success: false, error: "Validation failed: 'sleep' must be between 0 and 24 hours" });
        return;
      }

      const record = {
        id: `checkin_${astronaut_id}_${day}`,
        astronaut_id,
        day,
        mood,
        stress,
        fatigue,
        sleep,
        symptoms: Array.isArray(symptoms) ? symptoms : [],
        notes: typeof notes === "string" ? notes.slice(0, 1000) : "",
        timestamp: new Date().toISOString(),
      };

      inMemoryStore.checkins.push(record);
      sendJson(res, 201, {
        success: true,
        message: "Astronaut daily check-in accepted and logged.",
        record,
      });
      return;
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
      return;
    }
  }

  // GET /api/v1/alerts?astronaut_id=ASTRO-1&day=70
  if (method === "GET" && pathname === "/api/v1/alerts") {
    const astronautId = parsedUrl.searchParams.get("astronaut_id") || "ASTRO-1";
    const dayParam = parsedUrl.searchParams.get("day");
    const day = dayParam !== null ? Number(dayParam) : null;

    let filtered = inMemoryStore.alerts.filter((a) => a.astronaut_id === astronautId);
    if (day !== null) {
      filtered = filtered.filter((a) => a.day === day);
    }

    sendJson(res, 200, {
      success: true,
      astronaut_id: astronautId,
      count: filtered.length,
      alerts: filtered,
    });
    return;
  }

  // POST /api/v1/sync/batch
  if (method === "POST" && pathname === "/api/v1/sync/batch") {
    try {
      const body = await parseJsonBody(req);
      const records = body.records;

      if (!Array.isArray(records)) {
        sendJson(res, 400, { success: false, error: "Expected 'records' array in request body" });
        return;
      }

      const acknowledged = [];
      const timestamp = new Date().toISOString();

      for (const item of records) {
        if (!item || !item.id) continue;
        inMemoryStore.syncLogs.push({
          sync_id: item.id,
          type: item.type,
          astronaut_id: item.astronaut_id,
          received_at: timestamp,
        });
        acknowledged.push(item.id);
      }

      sendJson(res, 200, {
        success: true,
        synchronized_count: acknowledged.length,
        acknowledged_ids: acknowledged,
        server_timestamp: timestamp,
      });
      return;
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
      return;
    }
  }

  sendJson(res, 404, { success: false, error: `API route not found: ${method} ${pathname}` });
}

// Master HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Direct API requests
  if (pathname.startsWith("/api/v1/")) {
    await handleApiRequest(req, res, parsedUrl);
    return;
  }

  // Serve static files from web/
  let filePathName = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(filePathName).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(WEB_DIR, safePath);

  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      // Aggressively disable caching so local reloads ALWAYS get fresh code
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    });

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("500 Internal Server Error");
    });
    stream.pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[ASTRA] Server running at http://localhost:${PORT}`);
  console.log(`[ASTRA] Serving static directory: ${WEB_DIR}`);
  console.log(`[ASTRA] Telemetry API endpoints active on /api/v1/*`);
});
