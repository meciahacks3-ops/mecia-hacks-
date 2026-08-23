import * as XLSX from 'xlsx';
import { JUDGE_PROFILES } from './judgeProfiles.js';

/**
 * Sanitize a string to be a valid Excel worksheet name (<= 31 chars, no invalid characters)
 */
function sanitizeSheetName(name) {
  if (!name) return 'Sheet';
  const clean = name.replace(/[\\/?*\[\]:]/g, '_').trim();
  return clean.slice(0, 31) || 'Sheet';
}

/**
 * Format team and member details into standardized rows for Excel export
 */
function getTeamRowData(team, evalEntry, panelInfo, index) {
  const m1 = team.members && team.members[0] ? team.members[0] : null;
  const m2 = team.members && team.members[1] ? team.members[1] : null;
  const m3 = team.members && team.members[2] ? team.members[2] : null;

  let status = 'PENDING';
  let c1 = '-', c2 = '-', c3 = '-', c4 = '-', c5 = '-', total = '-', remarks = '';

  if (evalEntry) {
    status = 'SCORED';
    c1 = evalEntry.c1 ?? '-';
    c2 = evalEntry.c2 ?? '-';
    c3 = evalEntry.c3 ?? '-';
    c4 = evalEntry.c4 ?? '-';
    c5 = evalEntry.c5 ?? '-';
    total = evalEntry.totalScore ?? '-';
    remarks = evalEntry.remarks || '';
  }

  const allMembersRoster = [
    `Leader: ${team.leaderName || ''} (${team.leaderId || ''})${team.leaderBranch ? ` [${team.leaderBranch}]` : ''} - Ph: ${team.leaderPhone || ''} - Email: ${team.leaderEmail || ''}`,
    ...(team.members || []).map((m, idx) =>
      `Member ${idx + 1}: ${m.name || ''} (${m.idNo || ''})${m.branch ? ` [${m.branch}]` : ''} - Ph: ${m.phone || ''} - Email: ${m.email || ''}`
    )
  ].join(' | ');

  return {
    sNo: index + 1,
    panelId: panelInfo?.id || team.assignedJudge || 'Unassigned',
    panelGroup: panelInfo?.group || (team.assignedJudge && team.assignedJudge !== 'Unassigned' ? 'Custom Panel' : 'Unassigned'),
    panelLocation: panelInfo?.location || 'N/A',
    panelJudges: panelInfo?.namesText || (team.assignedJudge && team.assignedJudge !== 'Unassigned' ? team.assignedJudge : 'None'),
    teamIdNo: team.teamIdNo || 'N/A',
    teamName: team.teamName || '',
    projectTitle: team.projectTitle || '',
    techStack: team.techStack || '',
    teamSize: team.totalTeamSize || (1 + (team.members?.length || 0)),
    leaderName: team.leaderName || '',
    leaderEmail: team.leaderEmail || '',
    leaderId: team.leaderId || '',
    leaderPhone: team.leaderPhone || '',
    leaderBranch: team.leaderBranch || '',
    m1Name: m1 ? m1.name : '',
    m1Id: m1 ? m1.idNo : '',
    m1Email: m1 ? m1.email : '',
    m1Phone: m1 ? m1.phone : '',
    m1Branch: m1 ? m1.branch : '',
    m2Name: m2 ? m2.name : '',
    m2Id: m2 ? m2.idNo : '',
    m2Email: m2 ? m2.email : '',
    m2Phone: m2 ? m2.phone : '',
    m2Branch: m2 ? m2.branch : '',
    m3Name: m3 ? m3.name : '',
    m3Id: m3 ? m3.idNo : '',
    m3Email: m3 ? m3.email : '',
    m3Phone: m3 ? m3.phone : '',
    m3Branch: m3 ? m3.branch : '',
    allMembersRoster,
    status,
    c1,
    c2,
    c3,
    c4,
    c5,
    total,
    remarks
  };
}

/**
 * Export complete multi-sheet Excel (.xlsx) file containing:
 * 1. Master list of Judges Panels with all Teams under each panel
 * 2. Panels Summary Sheet (counts, locations, judges, completion status)
 * 3. Individual Sheets for each Judge Panel (JM001 to JM011, Custom, Unassigned)
 */
export function exportJudgesPanelsAndTeamsExcel(teams = [], evaluations = []) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString();

  // Map known panels from JUDGE_PROFILES
  const knownPanels = Object.values(JUDGE_PROFILES);
  const panelMap = {};
  
  knownPanels.forEach(p => {
    panelMap[p.id.toUpperCase()] = {
      profile: p,
      teams: []
    };
  });

  const customPanelsMap = {};
  const unassignedTeams = [];

  // Group teams by their assigned judge panel
  teams.forEach(t => {
    const rawJudge = (t.assignedJudge || '').trim();
    const upperJudge = rawJudge.toUpperCase();

    if (!rawJudge || rawJudge.toLowerCase() === 'unassigned') {
      unassignedTeams.push(t);
    } else if (panelMap[upperJudge]) {
      panelMap[upperJudge].teams.push(t);
    } else {
      if (!customPanelsMap[rawJudge]) {
        customPanelsMap[rawJudge] = {
          profile: {
            id: rawJudge,
            group: 'Custom Judge',
            names: [rawJudge],
            namesText: rawJudge,
            location: 'Assigned by Admin'
          },
          teams: []
        };
      }
      customPanelsMap[rawJudge].teams.push(t);
    }
  });

  // ==========================================
  // SHEET 1: MASTER LIST (All Panels & Assigned Teams)
  // ==========================================
  const masterHeaders = [
    'Panel ID',
    'Panel Group',
    'Room / Location',
    'Judges / Evaluators',
    'Team ID',
    'Team Name',
    'Project Title',
    'Tech Stack',
    'Team Size',
    'Leader Name',
    'Leader Enrollment ID',
    'Leader Email',
    'Leader Phone',
    'Leader Branch',
    'Member 1 Name',
    'Member 1 ID',
    'Member 1 Email',
    'Member 1 Phone',
    'Member 1 Branch',
    'Member 2 Name',
    'Member 2 ID',
    'Member 2 Email',
    'Member 2 Phone',
    'Member 2 Branch',
    'Member 3 Name',
    'Member 3 ID',
    'Member 3 Email',
    'Member 3 Phone',
    'Member 3 Branch',
    'Complete Team Roster',
    'Evaluation Status',
    'System Architecture (10)',
    'Prototype Scope (10)',
    'Component Availability (10)',
    'Execution Feasibility (10)',
    'Implementation Details (10)',
    'Total Score (50)',
    'Judge Remarks'
  ];

  const masterRows = [
    ['MECIA HACK 3.0 - JUDGES PANELS & ASSIGNED TEAMS MASTER DOSSIER'],
    ['Generated On:', dateStr, '', '', 'Total Teams Registered:', teams.length],
    [], // Blank separator
    masterHeaders
  ];

  let masterRowCounter = 0;

  // Process all known panels
  knownPanels.forEach(panel => {
    const assignedList = panelMap[panel.id.toUpperCase()].teams;
    if (assignedList.length > 0) {
      assignedList.forEach(t => {
        const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
        const rowData = getTeamRowData(t, evalEntry, panel, masterRowCounter++);
        masterRows.push([
          rowData.panelId,
          rowData.panelGroup,
          rowData.panelLocation,
          rowData.panelJudges,
          rowData.teamIdNo,
          rowData.teamName,
          rowData.projectTitle,
          rowData.techStack,
          rowData.teamSize,
          rowData.leaderName,
          rowData.leaderId,
          rowData.leaderEmail,
          rowData.leaderPhone,
          rowData.leaderBranch,
          rowData.m1Name,
          rowData.m1Id,
          rowData.m1Email,
          rowData.m1Phone,
          rowData.m1Branch,
          rowData.m2Name,
          rowData.m2Id,
          rowData.m2Email,
          rowData.m2Phone,
          rowData.m2Branch,
          rowData.m3Name,
          rowData.m3Id,
          rowData.m3Email,
          rowData.m3Phone,
          rowData.m3Branch,
          rowData.allMembersRoster,
          rowData.status,
          rowData.c1,
          rowData.c2,
          rowData.c3,
          rowData.c4,
          rowData.c5,
          rowData.total,
          rowData.remarks
        ]);
      });
    } else {
      // Add row showing panel with no teams assigned yet
      masterRows.push([
        panel.id,
        panel.group,
        panel.location,
        panel.namesText,
        'N/A',
        '(No teams assigned yet)',
        '-',
        '-',
        0,
        '-', '-', '-', '-', '-',
        '-', '-', '-', '-', '-',
        '-', '-', '-', '-', '-',
        '-', '-', '-', '-', '-',
        '-',
        'PENDING',
        '-', '-', '-', '-', '-', '-', ''
      ]);
    }
  });

  // Process custom panels
  Object.values(customPanelsMap).forEach(customPanel => {
    customPanel.teams.forEach(t => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      const rowData = getTeamRowData(t, evalEntry, customPanel.profile, masterRowCounter++);
      masterRows.push([
        rowData.panelId,
        rowData.panelGroup,
        rowData.panelLocation,
        rowData.panelJudges,
        rowData.teamIdNo,
        rowData.teamName,
        rowData.projectTitle,
        rowData.techStack,
        rowData.teamSize,
        rowData.leaderName,
        rowData.leaderId,
        rowData.leaderEmail,
        rowData.leaderPhone,
        rowData.leaderBranch,
        rowData.m1Name,
        rowData.m1Id,
        rowData.m1Email,
        rowData.m1Phone,
        rowData.m1Branch,
        rowData.m2Name,
        rowData.m2Id,
        rowData.m2Email,
        rowData.m2Phone,
        rowData.m2Branch,
        rowData.m3Name,
        rowData.m3Id,
        rowData.m3Email,
        rowData.m3Phone,
        rowData.m3Branch,
        rowData.allMembersRoster,
        rowData.status,
        rowData.c1,
        rowData.c2,
        rowData.c3,
        rowData.c4,
        rowData.c5,
        rowData.total,
        rowData.remarks
      ]);
    });
  });

  // Process unassigned teams
  if (unassignedTeams.length > 0) {
    unassignedTeams.forEach(t => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      const rowData = getTeamRowData(t, evalEntry, { id: 'Unassigned', group: 'Unassigned', location: 'Not Allocated', namesText: 'None' }, masterRowCounter++);
      masterRows.push([
        'Unassigned',
        'Unassigned',
        'Not Allocated',
        'None',
        rowData.teamIdNo,
        rowData.teamName,
        rowData.projectTitle,
        rowData.techStack,
        rowData.teamSize,
        rowData.leaderName,
        rowData.leaderId,
        rowData.leaderEmail,
        rowData.leaderPhone,
        rowData.leaderBranch,
        rowData.m1Name,
        rowData.m1Id,
        rowData.m1Email,
        rowData.m1Phone,
        rowData.m1Branch,
        rowData.m2Name,
        rowData.m2Id,
        rowData.m2Email,
        rowData.m2Phone,
        rowData.m2Branch,
        rowData.m3Name,
        rowData.m3Id,
        rowData.m3Email,
        rowData.m3Phone,
        rowData.m3Branch,
        rowData.allMembersRoster,
        rowData.status,
        rowData.c1,
        rowData.c2,
        rowData.c3,
        rowData.c4,
        rowData.c5,
        rowData.total,
        rowData.remarks
      ]);
    });
  }

  const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
  wsMaster['!cols'] = [
    { wch: 12 }, // Panel ID
    { wch: 14 }, // Panel Group
    { wch: 28 }, // Location
    { wch: 45 }, // Judges
    { wch: 12 }, // Team ID
    { wch: 24 }, // Team Name
    { wch: 30 }, // Project Title
    { wch: 22 }, // Tech Stack
    { wch: 10 }, // Team Size
    { wch: 22 }, // Leader Name
    { wch: 18 }, // Leader ID
    { wch: 28 }, // Leader Email
    { wch: 16 }, // Leader Phone
    { wch: 16 }, // Leader Branch
    { wch: 20 }, // M1 Name
    { wch: 16 }, // M1 ID
    { wch: 24 }, // M1 Email
    { wch: 14 }, // M1 Phone
    { wch: 14 }, // M1 Branch
    { wch: 20 }, // M2 Name
    { wch: 16 }, // M2 ID
    { wch: 24 }, // M2 Email
    { wch: 14 }, // M2 Phone
    { wch: 14 }, // M2 Branch
    { wch: 20 }, // M3 Name
    { wch: 16 }, // M3 ID
    { wch: 24 }, // M3 Email
    { wch: 14 }, // M3 Phone
    { wch: 14 }, // M3 Branch
    { wch: 50 }, // Complete Team Roster
    { wch: 16 }, // Status
    { wch: 14 }, // C1
    { wch: 14 }, // C2
    { wch: 14 }, // C3
    { wch: 14 }, // C4
    { wch: 14 }, // C5
    { wch: 16 }, // Total Score
    { wch: 35 }  // Remarks
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, 'All Panels & Teams');

  // ==========================================
  // SHEET 2: PANELS SUMMARY
  // ==========================================
  const summaryHeaders = [
    'Panel ID',
    'Group Name',
    'Venue / Room Location',
    'Faculty Judges Members',
    'Total Assigned Teams',
    'Evaluated (Scored)',
    'Pending Evaluation',
    'Average Score (out of 50)',
    'Assigned Team IDs',
    'Assigned Team Names'
  ];

  const summaryRows = [
    ['MECIA HACK 3.0 - JUDGES PANELS SUMMARY OVERVIEW'],
    ['Generated On:', dateStr],
    [],
    summaryHeaders
  ];

  knownPanels.forEach(panel => {
    const assignedList = panelMap[panel.id.toUpperCase()].teams;
    let scoredCount = 0;
    let totalScoreSum = 0;

    assignedList.forEach(t => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      if (evalEntry && evalEntry.totalScore !== undefined) {
        scoredCount++;
        totalScoreSum += Number(evalEntry.totalScore) || 0;
      }
    });

    const pendingCount = assignedList.length - scoredCount;
    const avgScore = scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : '-';
    const teamIdsStr = assignedList.map(t => t.teamIdNo || 'N/A').join(', ');
    const teamNamesStr = assignedList.map(t => t.teamName).join(', ');

    summaryRows.push([
      panel.id,
      panel.group,
      panel.location,
      panel.namesText,
      assignedList.length,
      scoredCount,
      pendingCount,
      avgScore,
      teamIdsStr || 'None',
      teamNamesStr || 'None'
    ]);
  });

  // Custom panels in summary
  Object.values(customPanelsMap).forEach(cp => {
    const assignedList = cp.teams;
    let scoredCount = 0;
    let totalScoreSum = 0;

    assignedList.forEach(t => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      if (evalEntry && evalEntry.totalScore !== undefined) {
        scoredCount++;
        totalScoreSum += Number(evalEntry.totalScore) || 0;
      }
    });

    const pendingCount = assignedList.length - scoredCount;
    const avgScore = scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : '-';

    summaryRows.push([
      cp.profile.id,
      cp.profile.group,
      cp.profile.location,
      cp.profile.namesText,
      assignedList.length,
      scoredCount,
      pendingCount,
      avgScore,
      assignedList.map(t => t.teamIdNo || 'N/A').join(', ') || 'None',
      assignedList.map(t => t.teamName).join(', ') || 'None'
    ]);
  });

  // Unassigned row
  if (unassignedTeams.length > 0) {
    summaryRows.push([
      'Unassigned',
      'Unassigned Teams',
      'Not Allocated',
      'None',
      unassignedTeams.length,
      0,
      unassignedTeams.length,
      '-',
      unassignedTeams.map(t => t.teamIdNo || 'N/A').join(', '),
      unassignedTeams.map(t => t.teamName).join(', ')
    ]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 12 }, // Panel ID
    { wch: 14 }, // Group
    { wch: 28 }, // Location
    { wch: 45 }, // Judges
    { wch: 22 }, // Total Assigned Teams
    { wch: 20 }, // Evaluated
    { wch: 20 }, // Pending
    { wch: 24 }, // Average Score
    { wch: 30 }, // Team IDs
    { wch: 45 }  // Team Names
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Panels Summary');

  // ==========================================
  // SHEET 3+: INDIVIDUAL PANEL SHEETS (JM001 - JM011)
  // ==========================================
  const panelHeaders = [
    'S.No',
    'Team ID',
    'Team Name',
    'Project Title',
    'Tech Stack',
    'Size',
    'Team Leader',
    'Leader ID',
    'Leader Phone',
    'Leader Email',
    'Leader Branch',
    'Member 1',
    'Member 2',
    'Member 3',
    'Status',
    'Architecture (10)',
    'Scope (10)',
    'Availability (10)',
    'Feasibility (10)',
    'Implementation (10)',
    'Total (50)',
    'Judge Remarks'
  ];

  knownPanels.forEach(panel => {
    const assignedList = panelMap[panel.id.toUpperCase()].teams;
    const sheetRows = [
      [`MECIA HACK 3.0 - JUDGING PANEL EVALUATION DOSSIER: ${panel.id} (${panel.group})`],
      [`Venue / Room: ${panel.location}`],
      [`Judges / Evaluators: ${panel.namesText}`],
      [`Assigned Teams Count: ${assignedList.length}`, `Date: ${dateStr}`],
      [],
      panelHeaders
    ];

    if (assignedList.length === 0) {
      sheetRows.push([1, 'N/A', '(No teams assigned to this panel yet)', '-', '-', 0, '-', '-', '-', '-', '-', '-', '-', '-', 'PENDING', '-', '-', '-', '-', '-', '-', '']);
    } else {
      assignedList.forEach((t, idx) => {
        const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
        const rowData = getTeamRowData(t, evalEntry, panel, idx);
        
        const m1Summary = rowData.m1Name ? `${rowData.m1Name} (${rowData.m1Id || 'ID N/A'})` : '-';
        const m2Summary = rowData.m2Name ? `${rowData.m2Name} (${rowData.m2Id || 'ID N/A'})` : '-';
        const m3Summary = rowData.m3Name ? `${rowData.m3Name} (${rowData.m3Id || 'ID N/A'})` : '-';

        sheetRows.push([
          idx + 1,
          rowData.teamIdNo,
          rowData.teamName,
          rowData.projectTitle,
          rowData.techStack,
          rowData.teamSize,
          rowData.leaderName,
          rowData.leaderId,
          rowData.leaderPhone,
          rowData.leaderEmail,
          rowData.leaderBranch,
          m1Summary,
          m2Summary,
          m3Summary,
          rowData.status,
          rowData.c1,
          rowData.c2,
          rowData.c3,
          rowData.c4,
          rowData.c5,
          rowData.total,
          rowData.remarks
        ]);
      });
    }

    const wsPanel = XLSX.utils.aoa_to_sheet(sheetRows);
    wsPanel['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Team ID
      { wch: 22 }, // Team Name
      { wch: 28 }, // Project Title
      { wch: 20 }, // Tech Stack
      { wch: 6 },  // Size
      { wch: 20 }, // Leader
      { wch: 16 }, // Leader ID
      { wch: 15 }, // Phone
      { wch: 25 }, // Email
      { wch: 14 }, // Branch
      { wch: 24 }, // Member 1
      { wch: 24 }, // Member 2
      { wch: 24 }, // Member 3
      { wch: 12 }, // Status
      { wch: 15 }, // C1
      { wch: 12 }, // C2
      { wch: 15 }, // C3
      { wch: 15 }, // C4
      { wch: 16 }, // C5
      { wch: 12 }, // Total
      { wch: 30 }  // Remarks
    ];
    XLSX.utils.book_append_sheet(wb, wsPanel, sanitizeSheetName(`${panel.id} - ${panel.group}`));
  });

  // Custom panels individual sheets
  Object.values(customPanelsMap).forEach(cp => {
    const assignedList = cp.teams;
    const sheetRows = [
      [`MECIA HACK 3.0 - CUSTOM JUDGE EVALUATION DOSSIER: ${cp.profile.id}`],
      [`Venue / Room: ${cp.profile.location}`],
      [`Judges / Evaluators: ${cp.profile.namesText}`],
      [`Assigned Teams Count: ${assignedList.length}`, `Date: ${dateStr}`],
      [],
      panelHeaders
    ];

    assignedList.forEach((t, idx) => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      const rowData = getTeamRowData(t, evalEntry, cp.profile, idx);
      const m1Summary = rowData.m1Name ? `${rowData.m1Name} (${rowData.m1Id || 'ID N/A'})` : '-';
      const m2Summary = rowData.m2Name ? `${rowData.m2Name} (${rowData.m2Id || 'ID N/A'})` : '-';
      const m3Summary = rowData.m3Name ? `${rowData.m3Name} (${rowData.m3Id || 'ID N/A'})` : '-';

      sheetRows.push([
        idx + 1,
        rowData.teamIdNo,
        rowData.teamName,
        rowData.projectTitle,
        rowData.techStack,
        rowData.teamSize,
        rowData.leaderName,
        rowData.leaderId,
        rowData.leaderPhone,
        rowData.leaderEmail,
        rowData.leaderBranch,
        m1Summary,
        m2Summary,
        m3Summary,
        rowData.status,
        rowData.c1,
        rowData.c2,
        rowData.c3,
        rowData.c4,
        rowData.c5,
        rowData.total,
        rowData.remarks
      ]);
    });

    const wsCustom = XLSX.utils.aoa_to_sheet(sheetRows);
    wsCustom['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 20 },
      { wch: 6 }, { wch: 20 }, { wch: 16 }, { wch: 15 }, { wch: 25 },
      { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 16 },
      { wch: 12 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCustom, sanitizeSheetName(`Judge_${cp.profile.id}`));
  });

  // Unassigned teams sheet if any
  if (unassignedTeams.length > 0) {
    const unassignedRows = [
      ['MECIA HACK 3.0 - UNASSIGNED TEAMS (PENDING JUDGE ALLOCATION)'],
      [`Total Unassigned Teams: ${unassignedTeams.length}`, `Date: ${dateStr}`],
      [],
      panelHeaders
    ];

    unassignedTeams.forEach((t, idx) => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      const rowData = getTeamRowData(t, evalEntry, null, idx);
      const m1Summary = rowData.m1Name ? `${rowData.m1Name} (${rowData.m1Id || 'ID N/A'})` : '-';
      const m2Summary = rowData.m2Name ? `${rowData.m2Name} (${rowData.m2Id || 'ID N/A'})` : '-';
      const m3Summary = rowData.m3Name ? `${rowData.m3Name} (${rowData.m3Id || 'ID N/A'})` : '-';

      unassignedRows.push([
        idx + 1,
        rowData.teamIdNo,
        rowData.teamName,
        rowData.projectTitle,
        rowData.techStack,
        rowData.teamSize,
        rowData.leaderName,
        rowData.leaderId,
        rowData.leaderPhone,
        rowData.leaderEmail,
        rowData.leaderBranch,
        m1Summary,
        m2Summary,
        m3Summary,
        rowData.status,
        rowData.c1,
        rowData.c2,
        rowData.c3,
        rowData.c4,
        rowData.c5,
        rowData.total,
        rowData.remarks
      ]);
    });

    const wsUnassigned = XLSX.utils.aoa_to_sheet(unassignedRows);
    wsUnassigned['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 20 },
      { wch: 6 }, { wch: 20 }, { wch: 16 }, { wch: 15 }, { wch: 25 },
      { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 16 },
      { wch: 12 }, { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, wsUnassigned, 'Unassigned Teams');
  }

  // Trigger Excel file download
  const fileName = `Mecia_Hack_3.0_Judges_Panels_And_Teams_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * Export a single panel's dedicated Excel (.xlsx) file
 */
export function exportSinglePanelExcel(panelId, teams = [], evaluations = []) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString();
  const upperId = (panelId || '').trim().toUpperCase();
  const panelProfile = JUDGE_PROFILES[upperId] || {
    id: panelId,
    group: 'Custom Panel',
    names: [panelId],
    namesText: panelId,
    location: 'Assigned by Admin'
  };

  const assignedTeams = teams.filter(t => (t.assignedJudge || '').trim().toUpperCase() === upperId);

  const panelHeaders = [
    'S.No',
    'Team ID',
    'Team Name',
    'Project Title',
    'Tech Stack',
    'Size',
    'Team Leader',
    'Leader ID',
    'Leader Phone',
    'Leader Email',
    'Leader Branch',
    'Member 1',
    'Member 2',
    'Member 3',
    'Status',
    'Architecture (10)',
    'Scope (10)',
    'Availability (10)',
    'Feasibility (10)',
    'Implementation (10)',
    'Total (50)',
    'Judge Remarks'
  ];

  const sheetRows = [
    [`MECIA HACK 3.0 - JUDGING PANEL EVALUATION DOSSIER: ${panelProfile.id} (${panelProfile.group})`],
    [`Venue / Room Location: ${panelProfile.location}`],
    [`Judges / Evaluators: ${panelProfile.namesText}`],
    [`Assigned Teams Count: ${assignedTeams.length}`, `Date: ${dateStr}`],
    [],
    panelHeaders
  ];

  if (assignedTeams.length === 0) {
    sheetRows.push([1, 'N/A', '(No teams assigned to this panel yet)', '-', '-', 0, '-', '-', '-', '-', '-', '-', '-', '-', 'PENDING', '-', '-', '-', '-', '-', '-', '']);
  } else {
    assignedTeams.forEach((t, idx) => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      const rowData = getTeamRowData(t, evalEntry, panelProfile, idx);
      const m1Summary = rowData.m1Name ? `${rowData.m1Name} (${rowData.m1Id || 'ID N/A'})` : '-';
      const m2Summary = rowData.m2Name ? `${rowData.m2Name} (${rowData.m2Id || 'ID N/A'})` : '-';
      const m3Summary = rowData.m3Name ? `${rowData.m3Name} (${rowData.m3Id || 'ID N/A'})` : '-';

      sheetRows.push([
        idx + 1,
        rowData.teamIdNo,
        rowData.teamName,
        rowData.projectTitle,
        rowData.techStack,
        rowData.teamSize,
        rowData.leaderName,
        rowData.leaderId,
        rowData.leaderPhone,
        rowData.leaderEmail,
        rowData.leaderBranch,
        m1Summary,
        m2Summary,
        m3Summary,
        rowData.status,
        rowData.c1,
        rowData.c2,
        rowData.c3,
        rowData.c4,
        rowData.c5,
        rowData.total,
        rowData.remarks
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 20 },
    { wch: 6 }, { wch: 20 }, { wch: 16 }, { wch: 15 }, { wch: 25 },
    { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 12 },
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 16 },
    { wch: 12 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(`${panelProfile.id} Panel`));
  const fileName = `Mecia_Hack_3.0_Panel_${panelProfile.id}_Teams_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
