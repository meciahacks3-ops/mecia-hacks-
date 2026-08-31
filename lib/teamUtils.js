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

