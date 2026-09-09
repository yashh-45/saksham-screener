-- ================================================================
-- Saksham — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Students ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    class_section TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scans ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    image_url        TEXT,
    indicators_found JSONB NOT NULL DEFAULT '{}',
    indicator_count  INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_student_id ON scans(student_id);

-- ── Reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id    UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    pdf_url    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Model Metadata ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_metadata (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version              TEXT NOT NULL,
    validation_accuracy  NUMERIC(6,4),
    validation_precision NUMERIC(6,4),
    validation_recall    NUMERIC(6,4),
    dataset_description  TEXT,
    trained_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (basic: anon can read, authenticated can write) ──
ALTER TABLE students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_metadata ENABLE ROW LEVEL SECURITY;

-- Allow all for now (tighten before production)
CREATE POLICY "Allow all" ON students      FOR ALL USING (true);
CREATE POLICY "Allow all" ON scans          FOR ALL USING (true);
CREATE POLICY "Allow all" ON reports        FOR ALL USING (true);
CREATE POLICY "Allow all" ON model_metadata FOR ALL USING (true) WITH CHECK (true);
