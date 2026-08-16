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
