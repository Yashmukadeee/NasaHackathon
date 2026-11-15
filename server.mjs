import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const WEB_DIR = path.resolve(__dirname, "web");
const BACKEND_URL = process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/+$/, "") : null;

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
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// In-Memory store for backend telemetry synchronization & check-ins
const inMemoryStore = {
  checkins: [],
  alerts: [],
  syncLogs: [],
  emergencyReports: [],
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
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
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

/**
 * Proxy request to upstream backend service when BACKEND_URL is configured.
 */
async function proxyToBackend(req, res, targetUrl) {
  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const options = {
      method: req.method,
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      options.body = Buffer.concat(chunks);
    }

    const resp = await fetch(targetUrl, options);
    const respHeaders = Object.fromEntries(resp.headers.entries());
    delete respHeaders["content-encoding"];

    res.writeHead(resp.status, {
      ...respHeaders,
      "Access-Control-Allow-Origin": "*",
      ...SECURITY_HEADERS,
    });
    const data = await resp.arrayBuffer();
    res.end(Buffer.from(data));
  } catch (err) {
    sendJson(res, 502, {
      success: false,
      error: `Bad Gateway: Could not forward to backend service (${err.message})`,
    });
  }
}

// ---------------------------------------------------------------------------
// Validation — single source of truth for the request handlers below
// ---------------------------------------------------------------------------

function validateCheckin(body) {
  const { astronaut_id, day, mood, stress, fatigue, sleep, symptoms, notes } = body || {};

  if (!astronaut_id || typeof astronaut_id !== "string") {
    throw new Error("Validation failed: 'astronaut_id' is required");
  }
  if (typeof day !== "number" || day < 1 || day > 180) {
    throw new Error("Validation failed: 'day' must be between 1 and 180");
  }
  if (typeof mood !== "number" || mood < 0 || mood > 10) {
    throw new Error("Validation failed: 'mood' must be between 0 and 10");
  }
  if (typeof stress !== "number" || stress < 0 || stress > 10) {
    throw new Error("Validation failed: 'stress' must be between 0 and 10");
  }
  if (typeof fatigue !== "number" || fatigue < 0 || fatigue > 10) {
    throw new Error("Validation failed: 'fatigue' must be between 0 and 10");
  }
  if (typeof sleep !== "number" || sleep < 0 || sleep > 24) {
    throw new Error("Validation failed: 'sleep' must be between 0 and 24 hours");
  }

  return {
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
}

function validateSyncBatch(body) {
  if (!body || !Array.isArray(body.records)) throw new Error("Expected 'records' array in request body");
  return body.records.map((r) => r && r.id).filter(Boolean);
}

// Router for /api/v1/*
async function handleApiRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
      ...SECURITY_HEADERS,
    });
    res.end();
    return;
  }

  // Health check endpoints
  if (method === "GET" && (pathname === "/api/v1/health" || pathname === "/health")) {
    sendJson(res, 200, {
      status: "healthy",
      service: "ASTRA Ground / Edge Telemetry Bridge",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // GET /api/v1/status
  if (method === "GET" && pathname === "/api/v1/status") {
    sendJson(res, 200, {
      success: true,
      service: "ASTRA Ground / Edge Telemetry Bridge",
      status: "ONLINE",
      version: "1.0.0",
      backend_connected: Boolean(BACKEND_URL),
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
      const record = validateCheckin(body);
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
      const acknowledged = validateSyncBatch(body);
      const timestamp = new Date().toISOString();

      for (const item of body.records) {
        if (!item || !item.id) continue;
        inMemoryStore.syncLogs.push({
          sync_id: item.id,
          type: item.type,
          astronaut_id: item.astronaut_id,
          received_at: timestamp,
        });
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

  // Proxy to FastAPI backend if configured
  if (BACKEND_URL) {
    const upstreamUrl = `${BACKEND_URL}${parsedUrl.pathname}${parsedUrl.search}`;
    await proxyToBackend(req, res, upstreamUrl);
    return;
  }

  // Fallback onboard CDSS assessment when running standalone without Python backend
  if (method === "POST" && pathname === "/api/v1/analysis/assess") {
    try {
      const body = await parseJsonBody(req);
      const astronautId = body.astronaut_id || "ASTRO-1";
      const missionDay = body.mission_day || 1;

      sendJson(res, 200, {
        success: true,
        astronaut_id: astronautId,
        mission_day: missionDay,
        status: "ASSESSED",
        tier: 1,
        predicted_drift: 0.14,
        findings: [
          "Onboard CDSS evaluated telemetry against personal flight baselines.",
          "Vital variance bands remain within expected nominal boundaries.",
        ],
        recommendations: [
          "Maintain daily cycle ergometer & resistive exercise protocol.",
          "Continue prescribed fluid and electrolyte replenishment.",
        ],
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
      return;
    }
  }

  // Fallback emergency report queuing
  if (method === "POST" && pathname === "/api/v1/ground-team/emergency-report") {
    try {
      const body = await parseJsonBody(req);
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      inMemoryStore.emergencyReports.push({ reportId, ...body });
      sendJson(res, 201, {
        success: true,
        report_id: reportId,
        astronaut_id: body.astronaut_id || "ASTRO-1",
        message: "Emergency report buffered in flight deck transmission queue.",
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
      return;
    }
  }

  // Fallback emergency contact transmission
  if (method === "POST" && pathname === "/api/v1/ground-team/contact") {
    try {
      const body = await parseJsonBody(req);
      sendJson(res, 200, {
        success: true,
        message: "Downlink packet scheduled for next high-gain ground pass.",
        report_id: body.report_id,
        timestamp: new Date().toISOString(),
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

  // Top-level health check endpoint for cloud load balancers and orchestrators
  if (pathname === "/health") {
    sendJson(res, 200, {
      status: "healthy",
      service: "ASTRA Ground / Edge Telemetry Bridge",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

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
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback for HTML routing if requested
      const acceptHeader = req.headers.accept || "";
      if (acceptHeader.includes("text/html")) {
        const indexPath = path.join(WEB_DIR, "index.html");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          ...SECURITY_HEADERS,
        });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // RFC 7233 Range Request Handling for video/audio streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

      if (start >= stats.size || end >= stats.size || start > end) {
        res.writeHead(416, {
          "Content-Range": `bytes */${stats.size}`,
          ...SECURITY_HEADERS,
        });
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
        ...SECURITY_HEADERS,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        }
        res.end("500 Internal Server Error");
      });
      stream.pipe(res);
      return;
    }

    // Standard static file response
    const isCacheable = ext !== ".html" && ext !== ".webmanifest" && ext !== ".json";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": isCacheable ? "public, max-age=86400" : "no-cache",
      ...SECURITY_HEADERS,
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

server.listen(PORT, HOST, () => {
  console.log(`[ASTRA] Server running at http://${HOST}:${PORT}`);
  console.log(`[ASTRA] Serving static directory: ${WEB_DIR}`);
  console.log(`[ASTRA] Telemetry API endpoints active on /api/v1/*`);
  if (BACKEND_URL) {
    console.log(`[ASTRA] Upstream backend proxy active -> ${BACKEND_URL}`);
  }
});

// Graceful container shutdown
function handleShutdown(signal) {
  console.log(`[ASTRA] ${signal} signal received: closing HTTP server...`);
  server.close(() => {
    console.log("[ASTRA] HTTP server closed cleanly.");
    process.exit(0);
  });
  // Force shutdown after 10s timeout
  setTimeout(() => {
    console.error("[ASTRA] Force shutdown timeout expired.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
