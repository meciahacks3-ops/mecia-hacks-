-- ============================================================================
-- MECIA HACKS 3.0: Complete Jury Tables Migration (Internal & External)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vuqizkxqnjcyewmoeipg/sql
-- ============================================================================

-- ============================================================================
-- PART 1: EXTERNAL JURY EVALUATIONS TABLE
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_external_evaluations_team ON public.external_evaluations (team_name);
CREATE INDEX IF NOT EXISTS idx_external_evaluations_judge ON public.external_evaluations (judge_email);

ALTER TABLE public.external_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to read external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to read external evaluations"
    ON public.external_evaluations FOR SELECT TO public, anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all users to insert external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to insert external evaluations"
    ON public.external_evaluations FOR INSERT TO public, anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to update external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to update external evaluations"
    ON public.external_evaluations FOR UPDATE TO public, anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to delete external evaluations" ON public.external_evaluations;
CREATE POLICY "Allow all users to delete external evaluations"
    ON public.external_evaluations FOR DELETE TO public, anon, authenticated USING (true);

GRANT ALL ON TABLE public.external_evaluations TO anon, authenticated, service_role;

-- Backfill FM judges
INSERT INTO public.external_evaluations (
    team_name, judge_email, c1_innovation, c2_execution, c3_feasibility,
    c4_presentation, c5_implementation, total_score, remarks, updated_at
)
SELECT 
    e.team_name,
    UPPER(TRIM(e.judge_email)) AS judge_email,
    COALESCE(e.c1_innovation, 0) AS c1_innovation,
    COALESCE(e.c2_execution, 0) AS c2_execution,
    COALESCE(e.c3_feasibility, 0) AS c3_feasibility,
    COALESCE(e.c4_presentation, 0) AS c4_presentation,
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

-- ============================================================================
-- PART 2: INTERNAL JURY EVALUATIONS TABLE
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_internal_evaluations_team ON public.internal_evaluations (team_name);
CREATE INDEX IF NOT EXISTS idx_internal_evaluations_judge ON public.internal_evaluations (judge_email);

ALTER TABLE public.internal_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to read internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to read internal evaluations"
    ON public.internal_evaluations FOR SELECT TO public, anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow all users to insert internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to insert internal evaluations"
    ON public.internal_evaluations FOR INSERT TO public, anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to update internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to update internal evaluations"
    ON public.internal_evaluations FOR UPDATE TO public, anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all users to delete internal evaluations" ON public.internal_evaluations;
CREATE POLICY "Allow all users to delete internal evaluations"
    ON public.internal_evaluations FOR DELETE TO public, anon, authenticated USING (true);

GRANT ALL ON TABLE public.internal_evaluations TO anon, authenticated, service_role;

-- Backfill MM judges
INSERT INTO public.internal_evaluations (
    team_name, judge_email, remarks, phase1_feedback, phase2_feedback, updated_at
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
