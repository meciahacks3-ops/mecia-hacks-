-- ============================================================================
-- MECIA HACKS 3.0: Internal Jury Evaluations Table Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vuqizkxqnjcyewmoeipg/sql
-- ============================================================================

-- 1. Create the dedicated internal_evaluations table
CREATE TABLE IF NOT EXISTS public.internal_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    team_id_no TEXT,
    judge_email TEXT NOT NULL,
    judge_name TEXT,
    judge_group TEXT,
    phase1_feedback TEXT DEFAULT '',
    phase2_feedback TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    c1_innovation NUMERIC DEFAULT 0,
    c2_execution NUMERIC DEFAULT 0,
    c3_feasibility NUMERIC DEFAULT 0,
    c4_presentation NUMERIC DEFAULT 0,
    total_score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_team_internal_judge UNIQUE (team_name, judge_email)
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_internal_evaluations_team ON public.internal_evaluations (team_name);
CREATE INDEX IF NOT EXISTS idx_internal_evaluations_judge ON public.internal_evaluations (judge_email);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.internal_evaluations ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies allowing full read and write access for anon & authenticated
DROP POLICY IF EXISTS "Allow all users to read internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to read internal evaluations"
    ON public.internal_evaluations
    FOR SELECT
    TO public, anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow all users to insert internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to insert internal evaluations"
    ON public.internal_evaluations
    FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to update internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to update internal evaluations"
    ON public.internal_evaluations
    FOR UPDATE
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to delete internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to delete internal evaluations"
    ON public.internal_evaluations
    FOR DELETE
    TO public, anon, authenticated
    USING (true);

-- 5. Grant table permissions to public roles
GRANT ALL ON TABLE public.internal_evaluations TO anon, authenticated, service_role;

-- 6. Backfill any existing internal mentor evaluations (MM001-MM010) from evaluations table if present
INSERT INTO public.internal_evaluations (
    team_name,
    judge_email,
    remarks,
    phase1_feedback,
    phase2_feedback,
    updated_at
)
SELECT 
    e.team_name,
    UPPER(TRIM(e.judge_email)) AS judge_email,
    COALESCE(e.remarks, '') AS remarks,
    COALESCE(
        SUBSTRING(e.remarks FROM '\[Phase\s*1(?:\s+Feedback)?\]([\s\S]*?)(?=\[Phase\s*2(?:\s+Feedback)?\]|$)'),
        CASE WHEN e.remarks NOT LIKE '%[Phase%' THEN e.remarks ELSE '' END
    ) AS phase1_feedback,
    COALESCE(
        SUBSTRING(e.remarks FROM '\[Phase\s*2(?:\s+Feedback)?\]([\s\S]*?)$'),
        ''
    ) AS phase2_feedback,
    COALESCE(e.updated_at, NOW()) AS updated_at
FROM public.evaluations e
WHERE UPPER(TRIM(e.judge_email)) LIKE 'MM%'
ON CONFLICT (team_name, judge_email) DO UPDATE 
SET 
    remarks = EXCLUDED.remarks,
    phase1_feedback = EXCLUDED.phase1_feedback,
    phase2_feedback = EXCLUDED.phase2_feedback,
    updated_at = EXCLUDED.updated_at;
