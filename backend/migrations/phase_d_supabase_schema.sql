-- ============================================================================
-- ASTRA Phase D — Complete Supabase PostgreSQL Schema Migration
-- 12 Relational Tables with UUID PKs, Foreign Keys, Indexes, and RLS Policies
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ASTRONAUTS
CREATE TABLE IF NOT EXISTS public.astronauts (
    id TEXT PRIMARY KEY, -- e.g. ASTRO-1, ASTRO-2, ASTRO-3
    uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    age INTEGER NOT NULL,
    blood_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. WEARABLE DEVICES
CREATE TABLE IF NOT EXISTS public.wearable_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL UNIQUE, -- e.g. 'BIO-PATCH-01', 'SMART-GARMENT-X'
    astronaut_id TEXT REFERENCES public.astronauts(id) ON DELETE SET NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL, -- 'bio_patch', 'smart_garment', 'smart_ring', 'dosimeter'
    protocol TEXT NOT NULL DEFAULT 'BLE', -- 'BLE', 'WIFI', 'HTTP_GATEWAY'
    supported_metrics JSONB NOT NULL DEFAULT '["hr", "hrv", "spo2", "temp"]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    firmware_version TEXT DEFAULT 'v1.4.2',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DEVICE SESSIONS
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES public.wearable_devices(device_id) ON DELETE CASCADE,
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    session_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_end TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'TERMINATED'
    total_packets INTEGER NOT NULL DEFAULT 0,
    dropped_packets INTEGER NOT NULL DEFAULT 0
);

-- 4. TELEMETRY READINGS (Scalable Time-Series Storage)
CREATE TABLE IF NOT EXISTS public.telemetry_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number BIGINT NOT NULL,
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL, -- 'hr', 'hrv', 'spo2', 'temp', 'sbp', 'dbp', 'dose'
    metric_value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    signal_quality DOUBLE PRECISION DEFAULT 1.0, -- 0.0 to 1.0
    device_source TEXT NOT NULL DEFAULT 'wearable_ble',
    measurement_provenance JSONB DEFAULT '{"sensor_firmware": "1.4.2", "calibrated": true}'::jsonb,
    is_synced BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Compound index for rapid chronological querying
CREATE INDEX IF NOT EXISTS idx_telemetry_astro_time ON public.telemetry_readings(astronaut_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_metric ON public.telemetry_readings(metric_name, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_dedupe ON public.telemetry_readings(device_id, sequence_number, metric_name, timestamp);

-- 5. HEALTH BASELINES
CREATE TABLE IF NOT EXISTS public.health_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL,
    mean DOUBLE PRECISION NOT NULL,
    sd DOUBLE PRECISION NOT NULL,
    calibration_window_days INTEGER DEFAULT 23,
    computed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(astronaut_id, metric_key)
);

-- 6. HEALTH ANALYSES
CREATE TABLE IF NOT EXISTS public.health_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    mission_day INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    overall_tier INTEGER NOT NULL DEFAULT 0, -- 0=Nominal, 1=Attention, 2=High, 3=Critical
    overall_status INTEGER NOT NULL DEFAULT 0,
    worst_domain TEXT NOT NULL DEFAULT 'car',
    analysis_payload JSONB NOT NULL,
    contributing_patterns JSONB DEFAULT '[]'::jsonb,
    forecast_days_to_amber INTEGER,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_analyses_astro_day ON public.health_analyses(astronaut_id, mission_day DESC);

-- 7. HEALTH ALERTS
CREATE TABLE IF NOT EXISTS public.health_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    mission_day INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    tier INTEGER NOT NULL, -- 1=Attention, 2=High Priority, 3=Critical
    category TEXT NOT NULL, -- 'NORMAL', 'ATTENTION', 'HIGH_PRIORITY', 'CRITICAL'
    domain TEXT NOT NULL,
    affected_metric TEXT NOT NULL,
    current_value DOUBLE PRECISION,
    baseline_value DOUBLE PRECISION,
    deviation_sd DOUBLE PRECISION,
    message TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    research_citations JSONB DEFAULT '[]'::jsonb,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_tier_astro ON public.health_alerts(tier DESC, astronaut_id);

-- 8. DAILY CHECKINS
CREATE TABLE IF NOT EXISTS public.daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    mission_day INTEGER NOT NULL,
    mood DOUBLE PRECISION NOT NULL,
    stress DOUBLE PRECISION NOT NULL,
    fatigue DOUBLE PRECISION NOT NULL,
    sleep DOUBLE PRECISION NOT NULL,
    symptoms JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(astronaut_id, mission_day)
);

-- 9. RESEARCH FINDINGS (Attributed literature)
CREATE TABLE IF NOT EXISTS public.research_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency TEXT NOT NULL, -- 'NASA', 'CSA'
    source_title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    health_domain TEXT NOT NULL,
    hazard_category TEXT NOT NULL,
    finding TEXT NOT NULL,
    evidence_type TEXT NOT NULL DEFAULT 'established',
    csa_instruments JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. EMERGENCY REPORTS
CREATE TABLE IF NOT EXISTS public.emergency_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_code TEXT NOT NULL UNIQUE,
    astronaut_id TEXT NOT NULL REFERENCES public.astronauts(id) ON DELETE CASCADE,
    mission_day INTEGER NOT NULL,
    tier INTEGER NOT NULL DEFAULT 3,
    primary_domain TEXT NOT NULL,
    content_json JSONB NOT NULL,
    human_readable TEXT NOT NULL,
    communication_status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'queued_offline', 'transmitted', 'acknowledged'
    queued_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    transmitted_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    disclaimer TEXT NOT NULL
);

-- 11. COMMUNICATION LOGS
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_report_id UUID REFERENCES public.emergency_reports(id) ON DELETE CASCADE,
    attempt_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL, -- 'queued', 'transmitted', 'failed', 'acknowledged'
    gateway_url TEXT,
    response_payload TEXT,
    round_trip_latency_ms INTEGER
);

-- 12. DEVICE STATUS
CREATE TABLE IF NOT EXISTS public.device_status (
    device_id TEXT PRIMARY KEY REFERENCES public.wearable_devices(device_id) ON DELETE CASCADE,
    astronaut_id TEXT REFERENCES public.astronauts(id) ON DELETE SET NULL,
    connection_state TEXT NOT NULL DEFAULT 'DISCONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'RECONNECTING', 'DATA_STALE', 'OFFLINE_BUFFERING'
    battery_level INTEGER DEFAULT 100, -- 0 to 100%
    last_reading_at TIMESTAMPTZ,
    transmission_frequency_hz DOUBLE PRECISION DEFAULT 1.0,
    signal_quality DOUBLE PRECISION DEFAULT 1.0,
    sensor_availability JSONB DEFAULT '{"heart_rate": true, "hrv": true, "spo2": true, "temperature": true}'::jsonb,
    sync_status TEXT NOT NULL DEFAULT 'SYNCHRONIZED',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================
ALTER TABLE public.astronauts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated & anonymous users with public key
CREATE POLICY "Allow public read access on astronauts" ON public.astronauts FOR SELECT USING (true);
CREATE POLICY "Allow public read access on wearable_devices" ON public.wearable_devices FOR SELECT USING (true);
CREATE POLICY "Allow public read access on telemetry_readings" ON public.telemetry_readings FOR SELECT USING (true);
CREATE POLICY "Allow public read access on health_analyses" ON public.health_analyses FOR SELECT USING (true);
CREATE POLICY "Allow public read access on health_alerts" ON public.health_alerts FOR SELECT USING (true);
CREATE POLICY "Allow public read access on device_status" ON public.device_status FOR SELECT USING (true);

-- Allow service_role full control on all tables
CREATE POLICY "Service role full access on telemetry" ON public.telemetry_readings USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on alerts" ON public.health_alerts USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on analyses" ON public.health_analyses USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on device_status" ON public.device_status USING (true) WITH CHECK (true);

-- Seed initial crew
INSERT INTO public.astronauts (id, name, role, age, blood_type) VALUES
    ('ASTRO-1', 'CDR. Alex Chen', 'Commander', 41, 'O-POS'),
    ('ASTRO-2', 'LCDR. Sarah Tanaka', 'CMO/Biologist', 38, 'A-POS'),
    ('ASTRO-3', 'Marcus Vance', 'Flight Engineer', 44, 'B-POS')
ON CONFLICT (id) DO NOTHING;

-- Seed default wearable devices
INSERT INTO public.wearable_devices (device_id, astronaut_id, device_name, device_type, protocol, supported_metrics) VALUES
    ('ASTRO-BIO-01', 'ASTRO-1', 'BioSticker Clinical Patch #01', 'bio_patch', 'BLE', '["hr", "hrv", "spo2", "temp", "ex"]'::jsonb),
    ('ASTRO-GARMENT-02', 'ASTRO-2', 'AstroSkin Smart Garment #02', 'smart_garment', 'BLE', '["hr", "hrv", "spo2", "temp", "sbp", "dbp", "ex"]'::jsonb),
    ('ASTRO-RING-03', 'ASTRO-3', 'Crew Circadian Smart Ring #03', 'smart_ring', 'BLE', '["hr", "hrv", "temp", "slp"]'::jsonb)
ON CONFLICT (device_id) DO NOTHING;

-- Seed initial device status
INSERT INTO public.device_status (device_id, astronaut_id, connection_state, battery_level, signal_quality) VALUES
    ('ASTRO-BIO-01', 'ASTRO-1', 'CONNECTED', 94, 0.98),
    ('ASTRO-GARMENT-02', 'ASTRO-2', 'CONNECTED', 88, 0.95),
    ('ASTRO-RING-03', 'ASTRO-3', 'CONNECTED', 91, 0.92)
ON CONFLICT (device_id) DO NOTHING;
