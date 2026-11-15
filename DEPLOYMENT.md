# ASTRA Deployment & Hosting Guide

This guide covers deployment instructions for the **ASTRA Astronaut Vital Telemetry & Decision Support System** across popular cloud providers, container runtimes, and edge hosting platforms.

---

## Architecture at a Glance

ASTRA supports two deployment modes:

1. **Autonomous Edge Mode (Recommended & Lightweight)**
   - Single Node.js service running `server.mjs`.
   - Serves the static flight deck, handles RFC 7233 byte-range video streaming, and provides the complete `/api/v1/*` ground bridge and onboard CDSS assessment API.
   - Zero database required; operates offline-first with client-side IndexedDB persistence and onboard intelligence.
   - Deploys on Render, Railway, Fly.io, Vercel, Netlify, or as a single Docker container.

2. **Full-Stack Hybrid Mode (with Python FastAPI)**
   - Runs `server.mjs` on port `8080` and the Python FastAPI clinical intelligence engine on port `8000`.
   - `server.mjs` acts as an edge reverse proxy forwarding requests to `BACKEND_URL=http://backend:8000`.
   - Deploys via `docker compose up -d` or multi-service cloud providers.

---

## 1. Deploy with Docker & Docker Compose

### Option A: Single Container (Autonomous Edge Web)
```bash
# Build the production image
docker build -t astra-web:latest .

# Run container on port 8080
docker run -d --name astra -p 8080:8080 astra-web:latest
```
Visit `http://localhost:8080`.

### Option B: Full-Stack Multi-Container (Web + FastAPI Backend)
```bash
docker compose up -d --build
```
- Web Flight Deck: `http://localhost:8080`
- FastAPI Documentation / Swagger: `http://localhost:8000/docs`
- Health check: `http://localhost:8080/health`

---

## 2. Deploy to Render

### Using Blueprint (`render.yaml`):
1. Push your repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** → **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml` and provisions the web service.

### Manual Web Service Setup:
- **Environment**: `Node`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `HOST`: `0.0.0.0`
  - `PORT`: `10000` (Render default)

---

## 3. Deploy to Railway

Railway detects `railway.json` and `Procfile` automatically.

1. Install Railway CLI (`npm i -g @railway/cli`) or connect via the [Railway Dashboard](https://railway.app).
2. Run:
   ```bash
   railway login
   railway init
   railway up
   ```
3. In settings, verify the healthcheck endpoint is set to `/health`.

---

## 4. Deploy to Fly.io

Fly.io provides lightning-fast edge hosting using `fly.toml`:

1. Install the Fly CLI:
   ```bash
   # macOS / Linux
   curl -L https://fly.io/install.sh | sh
   # Windows PowerShell
   iwr https://fly.io/install.ps1 -useb | iex
   ```
2. Launch and deploy:
   ```bash
   fly launch --no-deploy
   fly deploy
   ```
3. Fly.io automatically probes the health endpoint at `/health` before routing traffic.

---

## 5. Deploy to Vercel

The static flight deck shell can be deployed directly to Vercel's global CDN:

1. Push your repository to GitHub.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Vercel automatically detects `vercel.json` and sets:
   - **Framework Preset**: Other
   - **Output Directory**: `web`
4. Click **Deploy**.

---

## 6. Deploy to Netlify

1. In the [Netlify Dashboard](https://app.netlify.com), select **Add new site** → **Import an existing project**.
2. Netlify reads `netlify.toml` and configures:
   - **Publish directory**: `web`
   - **Build command**: `npm run build`
3. Click **Deploy Site**.

---

## 7. Cloud VPS / Linux VM (Ubuntu / Debian / systemd)

To run ASTRA as a system service on any cloud VM (AWS EC2, Google Compute Engine, DigitalOcean Droplet):

1. Clone and install Node 20+:
   ```bash
   git clone https://github.com/your-org/NasaHackathon.git /opt/astra
   cd /opt/astra
   ```
2. Create `/etc/systemd/system/astra.service`:
   ```ini
   [Unit]
   Description=ASTRA Astronaut Health Intelligence Service
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/astra
   ExecStart=/usr/bin/node /opt/astra/server.mjs
   Restart=always
   RestartSec=5
   Environment=PORT=8080
   Environment=HOST=0.0.0.0
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now astra
   ```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port for the HTTP server |
| `HOST` | `0.0.0.0` | Network interface to bind |
| `NODE_ENV` | `production` | Environment mode |
| `BACKEND_URL` | *None* | Optional upstream FastAPI backend URL (e.g. `http://backend:8000`) |
| `SUPABASE_URL` | *None* | Optional Supabase cloud database URL |
| `SUPABASE_ANON_KEY` | *None* | Optional Supabase anon public key |
| `FASTAPI_API_KEY` | *None* | API key for protected assessment endpoints |

---

## Production Health Checks

- Top-level health check: `GET /health` → `200 OK`
- Telemetry API status: `GET /api/v1/status` → `200 OK`
- Range-streaming verification: `GET /background.mp4` with header `Range: bytes=0-1024` → `206 Partial Content`
