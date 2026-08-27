-- =========================================================================
-- MECIA HACKS 3.0: Supabase SQL Views & Time Slot Schema Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vuqizkxqnjcyewmoeipg/sql
-- =========================================================================

-- 1. ADD TIME_SLOT COLUMN TO TEAMS TABLE IF NOT EXISTS
ALTER TABLE teams ADD COLUMN IF NOT EXISTS time_slot TEXT DEFAULT 'TBA';

-- 2. DROP OLD VIEWS IF THEY EXIST
DROP VIEW IF EXISTS view_teams_with_all_members CASCADE;
DROP VIEW IF EXISTS view_all_students_master_list CASCADE;

-- 3. CREATE VIEW: TEAMS WITH ALL MEMBERS & ALLOCATED TIME SLOTS (Single Row per Team)
CREATE OR REPLACE VIEW view_teams_with_all_members AS
WITH numbered_members AS (
    SELECT 
        tm.team_id,
        tm.member_name,
        tm.member_email,
        tm.member_id,
        tm.member_phone,
        ROW_NUMBER() OVER (PARTITION BY tm.team_id ORDER BY tm.id ASC) AS member_idx
    FROM team_members tm
),
aggregated_members AS (
    SELECT 
        team_id,
        MAX(CASE WHEN member_idx = 1 THEN member_name END) AS member1_name,
        MAX(CASE WHEN member_idx = 1 THEN member_email END) AS member1_email,
        MAX(CASE WHEN member_idx = 1 THEN member_id END) AS member1_enrollment_no,
        MAX(CASE WHEN member_idx = 1 THEN member_phone END) AS member1_phone,
        
        MAX(CASE WHEN member_idx = 2 THEN member_name END) AS member2_name,
        MAX(CASE WHEN member_idx = 2 THEN member_email END) AS member2_email,
        MAX(CASE WHEN member_idx = 2 THEN member_id END) AS member2_enrollment_no,
        MAX(CASE WHEN member_idx = 2 THEN member_phone END) AS member2_phone,
        
        MAX(CASE WHEN member_idx = 3 THEN member_name END) AS member3_name,
        MAX(CASE WHEN member_idx = 3 THEN member_email END) AS member3_email,
        MAX(CASE WHEN member_idx = 3 THEN member_id END) AS member3_enrollment_no,
        MAX(CASE WHEN member_idx = 3 THEN member_phone END) AS member3_phone,

        COUNT(*) AS additional_members_count,
        STRING_AGG(
            CONCAT(
                'Member ', member_idx, ': ', member_name, 
                ' (ID: ', COALESCE(member_id, 'N/A'), 
                ' | Email: ', COALESCE(member_email, 'N/A'), 
                ' | Phone: ', COALESCE(member_phone, 'N/A'), ')'
            ), 
            E'\n' ORDER BY member_idx
        ) AS all_members_summary
    FROM numbered_members
    GROUP BY team_id
)
SELECT 
    t.id AS team_uuid,
    COALESCE(t.team_id_no, 'N/A') AS team_id_no,
    t.team_name,
    COALESCE(t.time_slot, 'TBA') AS time_slot,
    t.project_title,
    t.tech_stack,
    t.assigned_judge,
    (1 + COALESCE(am.additional_members_count, 0)) AS total_team_size,
    
    -- Leader Details
    t.leader_name,
    t.leader_email,
    t.leader_id AS leader_enrollment_no,
    t.leader_phone,
    
    -- Member 1 Details
    am.member1_name,
    am.member1_email,
    am.member1_enrollment_no,
    am.member1_phone,
    
    -- Member 2 Details
    am.member2_name,
    am.member2_email,
    am.member2_enrollment_no,
    am.member2_phone,
    
    -- Member 3 Details
    am.member3_name,
    am.member3_email,
    am.member3_enrollment_no,
    am.member3_phone,
    
    -- Formatted multi-line summary of members
    am.all_members_summary,
    t.main_idea,
    t.created_at
FROM teams t
LEFT JOIN aggregated_members am ON t.id = am.team_id
ORDER BY t.team_id_no ASC, t.team_name ASC;

-- 4. CREATE VIEW: ALL STUDENTS DIRECTORY (1 row per participant with Time Slot)
CREATE OR REPLACE VIEW view_all_students_master_list AS
SELECT 
    t.id AS team_uuid,
    COALESCE(t.team_id_no, 'N/A') AS team_id_no,
    t.team_name,
    COALESCE(t.time_slot, 'TBA') AS time_slot,
    'Team Leader' AS role,
    t.leader_name AS student_name,
    t.leader_id AS enrollment_no,
    t.leader_email AS email,
    t.leader_phone AS phone,
    t.project_title,
    t.assigned_judge,
    t.created_at
FROM teams t

UNION ALL

SELECT 
    t.id AS team_uuid,
    COALESCE(t.team_id_no, 'N/A') AS team_id_no,
    t.team_name,
    COALESCE(t.time_slot, 'TBA') AS time_slot,
    'Team Member' AS role,
    tm.member_name AS student_name,
    tm.member_id AS enrollment_no,
    tm.member_email AS email,
    tm.member_phone AS phone,
    t.project_title,
    t.assigned_judge,
    t.created_at
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
ORDER BY team_id_no ASC, role DESC, student_name ASC;
