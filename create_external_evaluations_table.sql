-- ============================================================================
-- MECIA HACKS 3.0: External Jury Evaluations Table Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vuqizkxqnjcyewmoeipg/sql
-- ============================================================================

-- 1. Create the dedicated external_evaluations table
CREATE TABLE IF NOT EXISTS public.external_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    team_id_no TEXT,
    judge_email TEXT NOT NULL,
    judge_name TEXT,
    judge_group TEXT,
    c1_innovation NUMERIC NOT NULL DEFAULT 0,
    c2_execution NUMERIC NOT NULL DEFAULT 0,
    c3_feasibility NUMERIC NOT NULL DEFAULT 0,
    c4_presentation NUMERIC NOT NULL DEFAULT 0,
    c5_implementation NUMERIC NOT NULL DEFAULT 0,
    total_score NUMERIC NOT NULL DEFAULT 0,
    remarks TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_team_external_judge UNIQUE (team_name, judge_email)
);

-- 2. Create indexes for fast lookups by team and judge
CREATE INDEX IF NOT EXISTS idx_external_evaluations_team ON public.external_evaluations (team_name);
CREATE INDEX IF NOT EXISTS idx_external_evaluations_judge ON public.external_evaluations (judge_email);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.external_evaluations ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies allowing full read and write access for anon & authenticated
DROP POLICY IF EXISTS "Allow all users to read external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to read external evaluations"
    ON public.external_evaluations
    FOR SELECT
    TO public, anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow all users to insert external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to insert external evaluations"
    ON public.external_evaluations
    FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to update external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to update external evaluations"
    ON public.external_evaluations
    FOR UPDATE
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to delete external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to delete external evaluations"
    ON public.external_evaluations
    FOR DELETE
    TO public, anon, authenticated
    USING (true);

-- 5. Grant table permissions to public roles
GRANT ALL ON TABLE public.external_evaluations TO anon, authenticated, service_role;

-- 6. Backfill / copy any existing external judge evaluations (FM001-FM007) from evaluations table if present
INSERT INTO public.external_evaluations (
    team_name,
    judge_email,
    c1_innovation,
    c2_execution,
    c3_feasibility,
    c4_presentation,
    c5_implementation,
    total_score,
    remarks,
    updated_at
)
SELECT 
    e.team_name,
    UPPER(TRIM(e.judge_email)) AS judge_email,
    COALESCE(e.c1_innovation, 0) AS c1_innovation,
    COALESCE(e.c2_execution, 0) AS c2_execution,
    COALESCE(e.c3_feasibility, 0) AS c3_feasibility,
    COALESCE(e.c4_presentation, 0) AS c4_presentation,
    -- Extract C5 from remarks if formatted as [C5 Implementation: X/10]
    COALESCE(
        SUBSTRING(e.remarks FROM '\[C5(?:\s+Implementation)?:\s*(\d+)\]')::NUMERIC,
        GREATEST(0, COALESCE(e.total_score, 0) - (COALESCE(e.c1_innovation, 0) + COALESCE(e.c2_execution, 0) + COALESCE(e.c3_feasibility, 0) + COALESCE(e.c4_presentation, 0)))
    ) AS c5_implementation,
    COALESCE(e.total_score, 0) AS total_score,
    TRIM(REGEXP_REPLACE(COALESCE(e.remarks, ''), '\[C5(?:\s+Implementation)?:\s*\d+(?:/10)?\]\s*', '', 'gi')) AS remarks,
    COALESCE(e.updated_at, NOW()) AS updated_at
FROM public.evaluations e
WHERE UPPER(TRIM(e.judge_email)) LIKE 'FM%'
ON CONFLICT (team_name, judge_email) DO UPDATE 
SET 
    c1_innovation = EXCLUDED.c1_innovation,
    c2_execution = EXCLUDED.c2_execution,
    c3_feasibility = EXCLUDED.c3_feasibility,
    c4_presentation = EXCLUDED.c4_presentation,
    c5_implementation = EXCLUDED.c5_implementation,
    total_score = EXCLUDED.total_score,
    remarks = EXCLUDED.remarks,
    updated_at = EXCLUDED.updated_at;
