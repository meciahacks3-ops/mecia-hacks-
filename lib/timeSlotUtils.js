/**
 * TIME SLOTS DEFINITION & UTILITIES
 * Mecia Hack 3.0 Round 2 Evaluation
 * 
 * Configured Time Slots:
 * 1. 09:30 AM - 11:30 AM (9:30 to 11:30)
 * 2. 12:15 PM - 02:15 PM (12:15 to 2:15)
 * 3. 02:30 PM - 04:15 PM (2:30 to 4:15)
 * 4. TBA (To Be Allocated / Not Allocated)
 */

export const TIME_SLOT_OPTIONS = [
  {
    id: 'TBA',
    value: 'TBA',
    label: '⏳ TBA (Not Allocated)',
    shortLabel: 'TBA',
    display: 'TBA (To Be Announced)',
    timeRange: 'To Be Announced',
    slotNumber: 0,
    badgeColor: '#ffb852',
    badgeBg: 'rgba(255, 184, 82, 0.15)',
    badgeBorder: '#ffb852'
  },
  {
    id: 'SLOT_1',
    value: '09:30 AM - 11:30 AM',
    label: '⏰ Slot 1: 09:30 AM - 11:30 AM',
    shortLabel: '09:30 - 11:30',
    display: '09:30 AM - 11:30 AM',
    timeRange: '09:30 AM to 11:30 AM',
    slotNumber: 1,
    badgeColor: '#00ffcc',
    badgeBg: 'rgba(0, 255, 204, 0.15)',
    badgeBorder: '#00ffcc'
  },
  {
    id: 'SLOT_2',
    value: '12:15 PM - 02:15 PM',
    label: '⏰ Slot 2: 12:15 PM - 02:15 PM',
    shortLabel: '12:15 - 02:15',
    display: '12:15 PM - 02:15 PM',
    timeRange: '12:15 PM to 02:15 PM',
    slotNumber: 2,
    badgeColor: '#fdff00',
    badgeBg: 'rgba(253, 255, 0, 0.15)',
    badgeBorder: '#fdff00'
  },
  {
    id: 'SLOT_3',
    value: '02:30 PM - 04:15 PM',
    label: '⏰ Slot 3: 02:30 PM - 04:15 PM',
    shortLabel: '02:30 - 04:15',
    display: '02:30 PM - 04:15 PM',
    timeRange: '02:30 PM to 04:15 PM',
    slotNumber: 3,
    badgeColor: '#ff66cc',
    badgeBg: 'rgba(255, 102, 204, 0.15)',
    badgeBorder: '#ff66cc'
  }
];

export const CANONICAL_SLOTS = [
  'TBA',
  '09:30 AM - 11:30 AM',
  '12:15 PM - 02:15 PM',
  '02:30 PM - 04:15 PM'
];

/**
 * Standardize any arbitrary user-provided or database time slot string into
 * one of the 4 canonical time slot representations.
 */
export function normalizeTimeSlot(raw) {
  if (!raw) return 'TBA';
  const clean = String(raw).trim();
  if (
    clean === '' ||
    clean.toUpperCase() === 'TBA' ||
    clean.toLowerCase() === 'unallocated' ||
    clean.toLowerCase() === 'not allocated' ||
    clean.toLowerCase() === 'pending' ||
    clean.toLowerCase() === 'n/a' ||
    clean.toLowerCase() === '-'
  ) {
    return 'TBA';
  }

  // 9:30 to 11:30 patterns
  if (/9[:.]?30/i.test(clean) && /11[:.]?30/i.test(clean)) {
    return '09:30 AM - 11:30 AM';
  }
  // 12:15 to 2:15 patterns
  if (/12[:.]?15/i.test(clean) && /2[:.]?15/i.test(clean)) {
    return '12:15 PM - 02:15 PM';
  }
  // 2:30 to 4:15 patterns
  if (/2[:.]?30/i.test(clean) && /4[:.]?15/i.test(clean)) {
    return '02:30 PM - 04:15 PM';
  }

  // Slot aliases
  if (/slot\s*1\b/i.test(clean)) return '09:30 AM - 11:30 AM';
  if (/slot\s*2\b/i.test(clean)) return '12:15 PM - 02:15 PM';
  if (/slot\s*3\b/i.test(clean)) return '02:30 PM - 04:15 PM';

  if (CANONICAL_SLOTS.includes(clean)) return clean;

  return 'TBA';
}

/**
 * Safely parse the allocated time slot from a team database object.
 * Checks both explicit `time_slot` column and metadata in `main_idea`.
 */
export function parseTimeSlotFromTeam(team) {
  if (!team) return 'TBA';

  // 1. Direct field checks
  if (team.time_slot && String(team.time_slot).trim()) {
    const norm = normalizeTimeSlot(team.time_slot);
    if (norm !== 'TBA') return norm;
  }
  if (team.timeSlot && String(team.timeSlot).trim()) {
    const norm = normalizeTimeSlot(team.timeSlot);
    if (norm !== 'TBA') return norm;
  }

  // 2. Embedded metadata check in main_idea
  const text = team.main_idea || team.mainIdea || '';
  if (text && text.includes('Slot:')) {
    const match = text.match(/Slot:\s*([^\]\n|]+)/i);
    if (match && match[1]) {
      return normalizeTimeSlot(match[1]);
    }
  }

  return 'TBA';
}

/**
 * Injects or updates the `[Slot: ...]` tag inside the bracketed header of `main_idea`.
 */
export function buildMainIdeaWithSlot(mainIdea, newSlot) {
  const normSlot = normalizeTimeSlot(newSlot);
  let text = mainIdea || '';

  // If Slot tag already exists in header, replace it
  if (/Slot:\s*[^\]|]+/i.test(text)) {
    return text.replace(/Slot:\s*[^\]|]+/i, `Slot: ${normSlot}`);
  }

  // If header bracket exists [Type: ... ], append Slot to it
  if (text.startsWith('[') && text.includes(']')) {
    const endBracketIdx = text.indexOf(']');
    const header = text.slice(1, endBracketIdx);
    const rest = text.slice(endBracketIdx + 1);
    return `[${header} | Slot: ${normSlot}]${rest}`;
  }

  // Otherwise prepend header
  return `[Slot: ${normSlot}]\n\n${text}`;
}

/**
 * Strips all bracket metadata tags from main_idea to return clean user description.
 */
export function cleanMainIdeaText(mainIdea) {
  let text = (mainIdea || '').trim();
  if (text.includes('[Type:') || text.includes('[type:') || text.includes('[Slot:') || text.includes('[slot:')) {
    text = text.replace(/\[[^\]]+\]\s*/g, '').trim();
  }
  return text;
}

/**
 * Lookup visual styling and display metadata for a given time slot.
 */
export function getTimeSlotInfo(slot) {
  const norm = normalizeTimeSlot(slot);
  return TIME_SLOT_OPTIONS.find(opt => opt.value === norm) || TIME_SLOT_OPTIONS[0];
}

/**
 * Universal save helper that updates both `assigned_judge` and `time_slot`
 * with automatic fallback to `main_idea` if `time_slot` column is not present.
 */
export async function saveTeamAssignment(supabaseClient, teamId, teamName, { assignedJudge, timeSlot, rawMainIdea }) {
  if (!supabaseClient) throw new Error("Supabase client is required");

  const normSlot = normalizeTimeSlot(timeSlot);
  const updatedMainIdea = buildMainIdeaWithSlot(rawMainIdea, normSlot);

  const updatePayload = {
    main_idea: updatedMainIdea
  };
  if (assignedJudge !== undefined) {
    updatePayload.assigned_judge = assignedJudge;
  }
  if (normSlot !== undefined) {
    updatePayload.time_slot = normSlot;
  }

  let query = supabaseClient.from('teams').update(updatePayload);
  if (teamId && teamId.length > 20) {
    query = query.eq('id', teamId);
  } else {
    query = query.ilike('team_name', teamName.trim());
  }

  let { error } = await query;

  // Fallback if time_slot column doesn't exist yet in Supabase schema
  if (error && (error.code === '42703' || String(error.message || '').toLowerCase().includes('time_slot'))) {
    const fallbackPayload = { main_idea: updatedMainIdea };
    if (assignedJudge !== undefined) fallbackPayload.assigned_judge = assignedJudge;

    let fallbackQuery = supabaseClient.from('teams').update(fallbackPayload);
    if (teamId && teamId.length > 20) {
      fallbackQuery = fallbackQuery.eq('id', teamId);
    } else {
      fallbackQuery = fallbackQuery.ilike('team_name', teamName.trim());
    }

    const fallbackRes = await fallbackQuery;
    error = fallbackRes.error;
  }

  return { error, updatedMainIdea, normSlot, finalJudge: assignedJudge };
}

/**
 * Computes balanced 3-way time slot splits for teams within a panel.
 * Default standard slots (e.g. 4-4-4 for 12 teams):
 * Slot 1: 09:30 AM - 11:30 AM
 * Slot 2: 12:15 PM - 02:15 PM
 * Slot 3: 02:30 PM - 04:15 PM
 */
export function computePanelSlotSplit(teamsInPanel = []) {
  if (!teamsInPanel || teamsInPanel.length === 0) return [];

  // Stable sort by Team ID or Team Name
  const sorted = [...teamsInPanel].sort((a, b) => {
    const idA = (a.teamIdNo || '').trim();
    const idB = (b.teamIdNo || '').trim();
    if (idA && idB && idA !== 'N/A' && idB !== 'N/A') {
      return idA.localeCompare(idB, undefined, { numeric: true });
    }
    return (a.teamName || '').localeCompare(b.teamName || '');
  });

  const total = sorted.length;
  const s1Count = Math.ceil(total / 3);
  const s2Count = Math.ceil((total - s1Count) / 2);

  return sorted.map((t, idx) => {
    let targetSlot = '09:30 AM - 11:30 AM';
    if (idx < s1Count) {
      targetSlot = '09:30 AM - 11:30 AM';
    } else if (idx < s1Count + s2Count) {
      targetSlot = '12:15 PM - 02:15 PM';
    } else {
      targetSlot = '02:30 PM - 04:15 PM';
    }
    return {
      id: t.id,
      teamName: t.teamName,
      teamIdNo: t.teamIdNo,
      assignedJudge: t.assignedJudge,
      timeSlot: targetSlot,
      rawMainIdea: t.rawMainIdea || ''
    };
  });
}

/**
 * Computes 4-4-4 balanced time slot allocations across all judge panels
 */
export function computeAllPanelsSlotSplit(allTeams = []) {
  if (!allTeams || allTeams.length === 0) return [];

  const panelMap = {};
  const unassigned = [];

  allTeams.forEach(t => {
    const rawJudge = (t.assignedJudge || '').trim();
    if (!rawJudge || rawJudge.toLowerCase() === 'unassigned') {
      unassigned.push(t);
    } else {
      const key = rawJudge.toUpperCase();
      if (!panelMap[key]) panelMap[key] = [];
      panelMap[key].push(t);
    }
  });

  const assignments = [];

  Object.values(panelMap).forEach(panelTeams => {
    const split = computePanelSlotSplit(panelTeams);
    assignments.push(...split);
  });

  if (unassigned.length > 0) {
    const splitUnassigned = computePanelSlotSplit(unassigned);
    assignments.push(...splitUnassigned);
  }

  return assignments;
}

