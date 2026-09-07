/**
 * Utility to search and load registered team details for a given identifier
 * (Leader email, Leader ID, Member email, Member ID, or Team ID).
 */
export async function findRegisteredTeam(supabaseClient, identifier) {
  if (!identifier || !supabaseClient) return null;
  const clean = identifier.trim();
  if (!clean) return null;

  try {
    // 1. Leader or Team ID check in 'teams' table
    const { data: leaderTeam, error: leaderErr } = await supabaseClient
      .from('teams')
      .select('*, team_members(*)')
      .or(`leader_email.ilike.${clean},leader_id.ilike.${clean},team_id_no.ilike.${clean}`)
      .maybeSingle();

    if (leaderTeam && !leaderErr) {
      return leaderTeam;
    }

    // 2. Member check in 'team_members' table
    const { data: memberEntry, error: memberErr } = await supabaseClient
      .from('team_members')
      .select('team_id')
      .or(`member_email.ilike.${clean},member_id.ilike.${clean}`)
      .maybeSingle();

    if (memberEntry?.team_id && !memberErr) {
      const { data: teamForMember, error: teamErr } = await supabaseClient
        .from('teams')
        .select('*, team_members(*)')
        .eq('id', memberEntry.team_id)
        .maybeSingle();

      if (teamForMember && !teamErr) {
        return teamForMember;
      }
    }
  } catch (e) {
    console.warn("findRegisteredTeam lookup exception:", e);
  }

  return null;
}

/**
 * Parse project type (Software, Hybrid, Hardware) from team data
 */
export function parseProjectTypeFromTeam(team) {
  if (!team) return 'Hardware';
  let type = (team.project_type || team.projectType || '').trim();
  if (!type) {
    const raw = team.rawMainIdea || team.main_idea || '';
    const match = raw.match(/\[(?:.*?\b)?Type:\s*([^|\]\n]+)/i) || raw.match(/\bType:\s*([^|\]\n,]+)/i);
    if (match && match[1]) {
      type = match[1].trim();
    }
  }
  if (type) {
    const lower = type.toLowerCase();
    if (lower === 'software') return 'Software';
    if (lower === 'hybrid') return 'Hybrid';
    if (lower === 'hardware') return 'Hardware';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
  return 'Hardware';
}

/**
 * Returns badge styling and icon for project type
 */
export function getProjectTypeInfo(type) {
  const norm = (type || '').trim().toLowerCase();
  if (norm === 'software') {
    return {
      type: 'Software',
      label: 'SOFTWARE',
      icon: '💻',
      color: '#00ffcc',
      bg: 'rgba(0, 255, 204, 0.12)',
      border: '#00ffcc',
      glow: '0 0 10px rgba(0, 255, 204, 0.3)'
    };
  }
  if (norm === 'hybrid') {
    return {
      type: 'Hybrid',
      label: 'HYBRID',
      icon: '⚡',
      color: '#ff66cc',
      bg: 'rgba(255, 102, 204, 0.12)',
      border: '#ff66cc',
      glow: '0 0 10px rgba(255, 102, 204, 0.3)'
    };
  }
  if (norm === 'hardware') {
    return {
      type: 'Hardware',
      label: 'HARDWARE',
      icon: '⚙️',
      color: '#ffb852',
      bg: 'rgba(255, 184, 82, 0.12)',
      border: '#ffb852',
      glow: '0 0 10px rgba(255, 184, 82, 0.3)'
    };
  }
  return {
    type: type || 'Unknown',
    label: type ? type.toUpperCase() : 'N/A',
    icon: '📦',
    color: '#aaa',
    bg: 'rgba(255, 255, 255, 0.08)',
    border: '#666',
    glow: 'none'
  };
}

/**
 * Parse Phase 1 and Phase 2 feedback from remarks text
 */
export function parsePhaseFeedback(remarks = '') {
  if (!remarks) return { phase1: '', phase2: '', hasPhases: false };
  const str = remarks.trim();

  // Pattern matching [Phase 1: ...] or [Phase 1 Feedback] ...
  const p1Match = str.match(/\[Phase\s*1(?:\s+Feedback)?\]([\s\S]*?)(?=\[Phase\s*2(?:\s+Feedback)?\]|$)/i);
  const p2Match = str.match(/\[Phase\s*2(?:\s+Feedback)?\]([\s\S]*?)$/i);

  if (p1Match || p2Match) {
    return {
      phase1: p1Match ? p1Match[1].trim() : '',
      phase2: p2Match ? p2Match[1].trim() : '',
      hasPhases: true
    };
  }

  // If no phase headers, treat existing remarks as Phase 1
  return {
    phase1: str,
    phase2: '',
    hasPhases: false
  };
}

/**
 * Master Lock Flag for Phase 2 internal judge feedback.
 * Set to `true` to lock Phase 2 feedback across judge evaluation and dashboards.
 * Set to `false` when organizers are ready to unlock Phase 2 for final sprint evaluation.
 */
export const IS_PHASE_2_LOCKED = false;

/**
 * Format Phase 1 and Phase 2 feedback into structured remarks
 */
export function formatPhaseFeedback(phase1 = '', phase2 = '') {
  const p1 = (phase1 || '').trim();
  const p2 = (phase2 || '').trim();
  const parts = [];
  if (p1) parts.push(`[Phase 1 Feedback]\n${p1}`);
  if (p2) parts.push(`[Phase 2 Feedback]\n${p2}`);
  return parts.join('\n\n');
}

/**
 * Parse an evaluation record from Supabase or localStorage, properly extracting
 * C1 (Arch), C2 (Scope), C3 (Avail), C4 (Timeline), C5 (Impl), total score, clean remarks,
 * and distinct Phase 1 & Phase 2 feedback.
 */
export function parseEvaluationRecord(se) {
  if (!se) return null;
  let c5Val = 0;
  let cleanRemarks = se.remarks || '';

  if (se.c5_details !== undefined && se.c5_details !== null && !isNaN(Number(se.c5_details))) {
    c5Val = Number(se.c5_details);
  } else if (se.c5 !== undefined && se.c5 !== null && !isNaN(Number(se.c5))) {
    c5Val = Number(se.c5);
  }

  if (cleanRemarks) {
    const c5Match = cleanRemarks.match(/\[C5(?:\s+[^\]]+)?:\s*(\d+)(?:\/(?:10|20))?\]/i);
    if (c5Match) {
      c5Val = parseInt(c5Match[1], 10);
      cleanRemarks = cleanRemarks.replace(/\[C5(?:\s+[^\]]+)?:\s*\d+(?:\/(?:10|20))?\]\s*/gi, '').trim();
    }
  }

  const c1Val = Number(se.c1_innovation ?? se.c1) || 0;
  const c2Val = Number(se.c2_execution ?? se.c2) || 0;
  const c3Val = Number(se.c3_feasibility ?? se.c3) || 0;
  const c4Val = Number(se.c4_presentation ?? se.c4) || 0;

  // Fallback: if c5 is 0 and not found in remarks, but total_score exceeds c1+c2+c3+c4
  if (c5Val === 0 && se.total_score !== undefined && se.total_score !== null) {
    const sumC1toC4 = c1Val + c2Val + c3Val + c4Val;
    const diff = Number(se.total_score) - sumC1toC4;
    if (diff >= 0 && diff <= 20) {
      c5Val = diff;
    }
  }

  const totalScore = se.total_score !== undefined && se.total_score !== null
    ? Number(se.total_score)
    : (c1Val + c2Val + c3Val + c4Val + c5Val);

  const phaseFeedback = parsePhaseFeedback(cleanRemarks);

  return {
    id: se.id,
    teamName: se.team_name || se.teamName || '',
    judgeEmail: se.judge_email || se.judgeEmail || '',
    c1: c1Val,
    c2: c2Val,
    c3: c3Val,
    c4: c4Val,
    c5: c5Val,
    totalScore: totalScore,
    remarks: cleanRemarks,
    phase1Feedback: phaseFeedback.phase1,
    phase2Feedback: phaseFeedback.phase2,
    hasPhase1: Boolean(phaseFeedback.phase1 && phaseFeedback.phase1.trim()),
    hasPhase2: Boolean(phaseFeedback.phase2 && phaseFeedback.phase2.trim()),
    hasPhases: phaseFeedback.hasPhases,
    updatedAt: se.updated_at || se.updatedAt || null
  };
}

