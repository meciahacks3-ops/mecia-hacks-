import * as XLSX from 'xlsx';
import JSZip from 'jszip';
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
  let c1 = '', c2 = '', c3 = '', c4 = '', c5 = '', total = '', remarks = '';

  if (evalEntry) {
    status = 'SCORED';
    c1 = evalEntry.c1 ?? '';
    c2 = evalEntry.c2 ?? '';
    c3 = evalEntry.c3 ?? '';
    c4 = evalEntry.c4 ?? '';
    c5 = evalEntry.c5 ?? '';
    total = evalEntry.totalScore ?? '';
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
 * Builds a dedicated, printable worksheet array of rows for a single panel
 */
function buildPanelSheetRows(panelProfile, assignedTeams, evaluations, dateStr) {
  const panelHeaders = [
    'S.No',
    'Team ID',
    'Team Name',
    'Project Title & Tech',
    'Leader Details (ID / Contact)',
    'Member 1 (Name / ID)',
    'Member 2 (Name / ID)',
    'Member 3 (Name / ID)',
    'C1: Architecture (10)',
    'C2: Scope (10)',
    'C3: Availability (10)',
    'C4: Feasibility (10)',
    'C5: Implementation (10)',
    'Total Score (50)',
    'Status',
    'Evaluator Remarks & Notes'
  ];

  const sheetRows = [
    ['MECIA HACK 3.0 — ROUND 2 JUDGING & EVALUATION DOSSIER'],
    [`PANEL ID: ${panelProfile.id}`, `GROUP: ${panelProfile.group}`, `ROOM / VENUE: ${panelProfile.location}`],
    [`FACULTY EVALUATORS: ${panelProfile.namesText || panelProfile.names?.join(', ') || 'N/A'}`],
    [`ALLOCATED TEAMS: ${assignedTeams.length}`, `REPORT DATE: ${dateStr}`],
    [],
    ['--- EVALUATION CRITERIA REFERENCE (MAX 10 MARKS EACH | TOTAL: 50 MARKS) ---'],
    ['C1: System Architecture & Design | C2: Prototype Scope & Completeness | C3: Component Availability & Integration | C4: Execution Feasibility & Timeline | C5: Implementation Details & Code Quality'],
    [],
    panelHeaders
  ];

  if (assignedTeams.length === 0) {
    sheetRows.push([1, 'N/A', '(No teams allocated to this panel yet)', '-', '-', '-', '-', '-', '', '', '', '', '', '', 'PENDING', '']);
  } else {
    assignedTeams.forEach((t, idx) => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      const rowData = getTeamRowData(t, evalEntry, panelProfile, idx);
      
      const leaderInfo = `${rowData.leaderName} (${rowData.leaderId || 'ID N/A'})${rowData.leaderBranch ? ` [${rowData.leaderBranch}]` : ''}\nPh: ${rowData.leaderPhone || 'N/A'}\nEmail: ${rowData.leaderEmail || 'N/A'}`;
      const m1Summary = rowData.m1Name ? `${rowData.m1Name} (${rowData.m1Id || 'ID N/A'})${rowData.m1Branch ? ` [${rowData.m1Branch}]` : ''}` : '-';
      const m2Summary = rowData.m2Name ? `${rowData.m2Name} (${rowData.m2Id || 'ID N/A'})${rowData.m2Branch ? ` [${rowData.m2Branch}]` : ''}` : '-';
      const m3Summary = rowData.m3Name ? `${rowData.m3Name} (${rowData.m3Id || 'ID N/A'})${rowData.m3Branch ? ` [${rowData.m3Branch}]` : ''}` : '-';
      const projTech = `${rowData.projectTitle || 'Untitled'}${rowData.techStack ? `\n[Tech: ${rowData.techStack}]` : ''}`;

      sheetRows.push([
        idx + 1,
        rowData.teamIdNo,
        rowData.teamName,
        projTech,
        leaderInfo,
        m1Summary,
        m2Summary,
        m3Summary,
        rowData.c1,
        rowData.c2,
        rowData.c3,
        rowData.c4,
        rowData.c5,
        rowData.total,
        rowData.status,
        rowData.remarks
      ]);
    });
  }

  // Physical Sign-off Block for Printouts
  sheetRows.push([]);
  sheetRows.push(['OFFICIAL EVALUATION SIGN-OFF & VERIFICATION']);
  sheetRows.push([]);
  sheetRows.push(['Judge 1 Signature: ___________________________', 'Judge 2 Signature: ___________________________']);
  sheetRows.push([]);
  sheetRows.push(['Judge 3 Signature: ___________________________', 'Judge 4 Signature: ___________________________']);

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 12 }, // Team ID
    { wch: 22 }, // Team Name
    { wch: 28 }, // Project & Tech
    { wch: 32 }, // Leader Details
    { wch: 24 }, // Member 1
    { wch: 24 }, // Member 2
    { wch: 24 }, // Member 3
    { wch: 14 }, // C1
    { wch: 14 }, // C2
    { wch: 14 }, // C3
    { wch: 14 }, // C4
    { wch: 14 }, // C5
    { wch: 16 }, // Total
    { wch: 12 }, // Status
    { wch: 30 }  // Remarks
  ];

  return ws;
}

/**
 * Creates an individual XLSX workbook object for a given panel
 */
export function createSinglePanelWorkbook(panelId, teams = [], evaluations = []) {
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
  const ws = buildPanelSheetRows(panelProfile, assignedTeams, evaluations, dateStr);
  const sheetTitle = sanitizeSheetName(`${panelProfile.id}_${panelProfile.group}`);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
  return { wb, panelProfile, assignedTeams };
}

/**
 * Export a single panel's dedicated Excel (.xlsx) file (Ready for direct printout)
 */
export function exportSinglePanelExcel(panelId, teams = [], evaluations = []) {
  const { wb, panelProfile } = createSinglePanelWorkbook(panelId, teams, evaluations);
  const safeId = (panelProfile.id || 'Panel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeGroup = (panelProfile.group || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Mecia_Hack_3.0_Panel_${safeId}_${safeGroup}_Printout_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * Export a ZIP file containing separate .xlsx printout sheets for EVERY panel (JM001 to JM011, Custom, Unassigned)
 */
export async function exportAllPanelsZip(teams = [], evaluations = []) {
  const zip = new JSZip();
  const dateStr = new Date().toLocaleString();
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

  // 1. Generate individual .xlsx for each JM001 - JM011 panel
  knownPanels.forEach(panel => {
    const assignedList = panelMap[panel.id.toUpperCase()].teams;
    const wb = XLSX.utils.book_new();
    const ws = buildPanelSheetRows(panel, assignedList, evaluations, dateStr);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(`${panel.id} - ${panel.group}`));
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const cleanFileName = `Panel_${panel.id}_${panel.group.replace(/\s+/g, '_')}_Printout.xlsx`;
    zip.file(cleanFileName, arrayBuffer);
  });

  // 2. Custom Panels
  Object.values(customPanelsMap).forEach(cp => {
    const assignedList = cp.teams;
    const wb = XLSX.utils.book_new();
    const ws = buildPanelSheetRows(cp.profile, assignedList, evaluations, dateStr);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(`Judge_${cp.profile.id}`));
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const cleanFileName = `Panel_Custom_${cp.profile.id.replace(/[^a-zA-Z0-9_-]/g, '_')}_Printout.xlsx`;
    zip.file(cleanFileName, arrayBuffer);
  });

  // 3. Unassigned Teams Sheet if any
  if (unassignedTeams.length > 0) {
    const unassignedProfile = {
      id: 'UNASSIGNED',
      group: 'Unassigned Teams',
      location: 'Not Allocated',
      names: ['Pending Allocation'],
      namesText: 'Pending Judge Allocation'
    };
    const wb = XLSX.utils.book_new();
    const ws = buildPanelSheetRows(unassignedProfile, unassignedTeams, evaluations, dateStr);
    XLSX.utils.book_append_sheet(wb, ws, 'Unassigned Teams');
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    zip.file('Panel_Unassigned_Teams_List.xlsx', arrayBuffer);
  }

  // 4. Generate & trigger zip download in browser
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFileName = `Mecia_Hack_3.0_All_Separate_Panel_Printouts_${Date.now()}.zip`;
  const url = URL.createObjectURL(zipBlob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = zipFileName;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  URL.revokeObjectURL(url);

  return zipFileName;
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

  // SHEET 1: MASTER LIST
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
    [],
    masterHeaders
  ];

  let masterRowCounter = 0;

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
        '', '', '', '', '', '', ''
      ]);
    }
  });

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
    { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 45 }, { wch: 12 },
    { wch: 24 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 22 },
    { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
    { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 50 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, 'All Panels & Teams');

  // SHEET 2: PANELS SUMMARY
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
      if (evalEntry && evalEntry.totalScore !== undefined && evalEntry.totalScore !== '') {
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

  Object.values(customPanelsMap).forEach(cp => {
    const assignedList = cp.teams;
    let scoredCount = 0;
    let totalScoreSum = 0;

    assignedList.forEach(t => {
      const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
      if (evalEntry && evalEntry.totalScore !== undefined && evalEntry.totalScore !== '') {
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
    { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 45 }, { wch: 22 },
    { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 30 }, { wch: 45 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Panels Summary');

  // INDIVIDUAL SHEETS FOR EACH PANEL (JM001 - JM011, Custom, Unassigned)
  knownPanels.forEach(panel => {
    const assignedList = panelMap[panel.id.toUpperCase()].teams;
    const wsPanel = buildPanelSheetRows(panel, assignedList, evaluations, dateStr);
    XLSX.utils.book_append_sheet(wb, wsPanel, sanitizeSheetName(`${panel.id} - ${panel.group}`));
  });

  Object.values(customPanelsMap).forEach(cp => {
    const assignedList = cp.teams;
    const wsCustom = buildPanelSheetRows(cp.profile, assignedList, evaluations, dateStr);
    XLSX.utils.book_append_sheet(wb, wsCustom, sanitizeSheetName(`Judge_${cp.profile.id}`));
  });

  if (unassignedTeams.length > 0) {
    const unassignedProfile = {
      id: 'UNASSIGNED',
      group: 'Unassigned Teams',
      location: 'Not Allocated',
      names: ['Pending Allocation'],
      namesText: 'Pending Judge Allocation'
    };
    const wsUnassigned = buildPanelSheetRows(unassignedProfile, unassignedTeams, evaluations, dateStr);
    XLSX.utils.book_append_sheet(wb, wsUnassigned, 'Unassigned Teams');
  }

  const fileName = `Mecia_Hack_3.0_Judges_Panels_And_Teams_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * Generates an HTML printout template for a single panel and triggers the browser print dialog
 */
export function printPanelDossier(panelId, teams = [], evaluations = []) {
  if (typeof window === 'undefined') return;

  const upperId = (panelId || '').trim().toUpperCase();
  const panelProfile = JUDGE_PROFILES[upperId] || {
    id: panelId,
    group: 'Custom Panel',
    names: [panelId],
    namesText: panelId,
    location: 'Assigned Room'
  };

  const assignedTeams = teams.filter(t => (t.assignedJudge || '').trim().toUpperCase() === upperId);
  const dateStr = new Date().toLocaleString();

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('Please allow popups to open the print dossier!');
    return;
  }

  const rowsHtml = assignedTeams.length === 0
    ? `<tr><td colspan="10" style="text-align:center; padding: 20px; font-style: italic;">No teams currently assigned to this panel.</td></tr>`
    : assignedTeams.map((t, idx) => {
        const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
        const m1 = t.members && t.members[0] ? `${t.members[0].name} (${t.members[0].idNo || 'ID N/A'})` : '';
        const m2 = t.members && t.members[1] ? `${t.members[1].name} (${t.members[1].idNo || 'ID N/A'})` : '';
        const m3 = t.members && t.members[2] ? `${t.members[2].name} (${t.members[2].idNo || 'ID N/A'})` : '';
        const membersList = [m1, m2, m3].filter(Boolean).join('<br/>');

        return `
          <tr>
            <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
            <td style="text-align: center; font-weight: bold; font-family: monospace; font-size: 13px;">${t.teamIdNo || 'N/A'}</td>
            <td><strong>${t.teamName}</strong></td>
            <td><strong>${t.projectTitle || 'N/A'}</strong><br/><small style="color: #555;">${t.techStack || ''}</small></td>
            <td>
              <strong>👑 ${t.leaderName}</strong> (${t.leaderId || 'ID N/A'})${t.leaderBranch ? ` [${t.leaderBranch}]` : ''}<br/>
              <small>📞 ${t.leaderPhone || 'N/A'} | ✉️ ${t.leaderEmail || 'N/A'}</small>
              ${membersList ? `<div style="margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 2px;"><small>👥 ${membersList}</small></div>` : ''}
            </td>
            <td style="text-align: center; font-weight: bold;">${evalEntry?.c1 ?? ''}</td>
            <td style="text-align: center; font-weight: bold;">${evalEntry?.c2 ?? ''}</td>
            <td style="text-align: center; font-weight: bold;">${evalEntry?.c3 ?? ''}</td>
            <td style="text-align: center; font-weight: bold;">${evalEntry?.c4 ?? ''}</td>
            <td style="text-align: center; font-weight: bold;">${evalEntry?.c5 ?? ''}</td>
            <td style="text-align: center; font-weight: bold; font-size: 14px; background: #f9f9f9;">${evalEntry?.totalScore ? `${evalEntry.totalScore}/50` : ''}</td>
            <td style="font-size: 11px;">${evalEntry?.remarks || ''}</td>
          </tr>
        `;
      }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Printout - Panel ${panelProfile.id} (${panelProfile.group})</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        body {
          font-family: Arial, sans-serif;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 10px;
          font-size: 12px;
        }
        .header {
          border: 2px solid #000;
          padding: 10px 14px;
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0 0 6px 0;
          font-size: 18px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header-grid {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .judges-box {
          background: #f0f0f0;
          padding: 6px 10px;
          margin-top: 6px;
          font-size: 12px;
          border: 1px solid #ccc;
        }
        .rubrics-bar {
          background: #fafafa;
          border: 1px solid #000;
          padding: 6px 10px;
          margin-bottom: 12px;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #000;
          padding: 6px 8px;
          vertical-align: top;
        }
        th {
          background: #e8e8e8;
          font-size: 11px;
          text-transform: uppercase;
        }
        .signatures {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          page-break-inside: avoid;
        }
        .sig-box {
          width: 45%;
          border-top: 1px solid #000;
          padding-top: 6px;
          margin-top: 35px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 14px; display: flex; gap: 10px; align-items: center;">
        <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background: #008000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          🖨️ PRINT THIS PANEL SHEET (A4)
        </button>
        <button onclick="window.close()" style="padding: 10px 16px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          ✕ Close
        </button>
        <span style="color: #666; font-size: 12px;">Tip: For best results, select <strong>Landscape</strong> orientation in the print dialog.</span>
      </div>

      <div class="header">
        <h1>MECIA HACK 3.0 — ROUND 2 JUDGING EVALUATION DOSSIER</h1>
        <div class="header-grid">
          <div><strong>PANEL ID:</strong> ${panelProfile.id} (${panelProfile.group})</div>
          <div><strong>VENUE / ROOM:</strong> ${panelProfile.location}</div>
          <div><strong>TOTAL TEAMS:</strong> ${assignedTeams.length}</div>
        </div>
        <div class="judges-box">
          <strong>FACULTY EVALUATORS:</strong> ${panelProfile.namesText || panelProfile.names?.join(', ') || 'N/A'}
        </div>
      </div>

      <div class="rubrics-bar">
        <span><strong>C1:</strong> Architecture (10)</span>
        <span><strong>C2:</strong> Prototype Scope (10)</span>
        <span><strong>C3:</strong> Availability (10)</span>
        <span><strong>C4:</strong> Feasibility (10)</span>
        <span><strong>C5:</strong> Implementation (10)</span>
        <span><strong>MAX SCORE:</strong> 50 Marks</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 4%;">#</th>
            <th style="width: 8%;">Team ID</th>
            <th style="width: 14%;">Team Name</th>
            <th style="width: 18%;">Project Title & Tech</th>
            <th style="width: 24%;">Leader & Members Contact</th>
            <th style="width: 4%;">C1 (10)</th>
            <th style="width: 4%;">C2 (10)</th>
            <th style="width: 4%;">C3 (10)</th>
            <th style="width: 4%;">C4 (10)</th>
            <th style="width: 4%;">C5 (10)</th>
            <th style="width: 6%;">Total (50)</th>
            <th style="width: 10%;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">Judge 1 Signature: __________________________________</div>
        <div class="sig-box">Judge 2 Signature: __________________________________</div>
      </div>
      <div class="signatures">
        <div class="sig-box">Judge 3 Signature: __________________________________</div>
        <div class="sig-box">Judge 4 Signature: __________________________________</div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generates an HTML printout with page breaks for ALL panels and triggers browser print
 */
export function printAllPanelsDossiers(teams = [], evaluations = []) {
  if (typeof window === 'undefined') return;

  const knownPanels = Object.values(JUDGE_PROFILES);
  const panelMap = {};
  knownPanels.forEach(p => {
    panelMap[p.id.toUpperCase()] = {
      profile: p,
      teams: []
    };
  });

  teams.forEach(t => {
    const rawJudge = (t.assignedJudge || '').trim().toUpperCase();
    if (panelMap[rawJudge]) {
      panelMap[rawJudge].teams.push(t);
    }
  });

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('Please allow popups to open the print dossiers!');
    return;
  }

  const panelsHtml = knownPanels.map((panel, pIdx) => {
    const assignedTeams = panelMap[panel.id.toUpperCase()].teams;
    const rowsHtml = assignedTeams.length === 0
      ? `<tr><td colspan="12" style="text-align:center; padding: 20px; font-style: italic;">No teams currently assigned to this panel.</td></tr>`
      : assignedTeams.map((t, idx) => {
          const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
          const m1 = t.members && t.members[0] ? `${t.members[0].name} (${t.members[0].idNo || 'ID N/A'})` : '';
          const m2 = t.members && t.members[1] ? `${t.members[1].name} (${t.members[1].idNo || 'ID N/A'})` : '';
          const m3 = t.members && t.members[2] ? `${t.members[2].name} (${t.members[2].idNo || 'ID N/A'})` : '';
          const membersList = [m1, m2, m3].filter(Boolean).join('<br/>');

          return `
            <tr>
              <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
              <td style="text-align: center; font-weight: bold; font-family: monospace; font-size: 13px;">${t.teamIdNo || 'N/A'}</td>
              <td><strong>${t.teamName}</strong></td>
              <td><strong>${t.projectTitle || 'N/A'}</strong><br/><small style="color: #555;">${t.techStack || ''}</small></td>
              <td>
                <strong>👑 ${t.leaderName}</strong> (${t.leaderId || 'ID N/A'})${t.leaderBranch ? ` [${t.leaderBranch}]` : ''}<br/>
                <small>📞 ${t.leaderPhone || 'N/A'} | ✉️ ${t.leaderEmail || 'N/A'}</small>
                ${membersList ? `<div style="margin-top: 4px; border-top: 1px dashed #ccc; padding-top: 2px;"><small>👥 ${membersList}</small></div>` : ''}
              </td>
              <td style="text-align: center; font-weight: bold;">${evalEntry?.c1 ?? ''}</td>
              <td style="text-align: center; font-weight: bold;">${evalEntry?.c2 ?? ''}</td>
              <td style="text-align: center; font-weight: bold;">${evalEntry?.c3 ?? ''}</td>
              <td style="text-align: center; font-weight: bold;">${evalEntry?.c4 ?? ''}</td>
              <td style="text-align: center; font-weight: bold;">${evalEntry?.c5 ?? ''}</td>
              <td style="text-align: center; font-weight: bold; font-size: 14px; background: #f9f9f9;">${evalEntry?.totalScore ? `${evalEntry.totalScore}/50` : ''}</td>
              <td style="font-size: 11px;">${evalEntry?.remarks || ''}</td>
            </tr>
          `;
        }).join('');

    return `
      <div class="page-container" ${pIdx < knownPanels.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="header">
          <h1>MECIA HACK 3.0 — ROUND 2 JUDGING EVALUATION DOSSIER</h1>
          <div class="header-grid">
            <div><strong>PANEL ID:</strong> ${panel.id} (${panel.group})</div>
            <div><strong>VENUE / ROOM:</strong> ${panel.location}</div>
            <div><strong>ALLOCATED TEAMS:</strong> ${assignedTeams.length}</div>
          </div>
          <div class="judges-box">
            <strong>FACULTY EVALUATORS:</strong> ${panel.namesText}
          </div>
        </div>

        <div class="rubrics-bar">
          <span><strong>C1:</strong> Architecture (10)</span>
          <span><strong>C2:</strong> Scope (10)</span>
          <span><strong>C3:</strong> Availability (10)</span>
          <span><strong>C4:</strong> Feasibility (10)</span>
          <span><strong>C5:</strong> Implementation (10)</span>
          <span><strong>MAX SCORE:</strong> 50 Marks</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 8%;">Team ID</th>
              <th style="width: 14%;">Team Name</th>
              <th style="width: 18%;">Project Title & Tech</th>
              <th style="width: 24%;">Leader & Members Contact</th>
              <th style="width: 4%;">C1 (10)</th>
              <th style="width: 4%;">C2 (10)</th>
              <th style="width: 4%;">C3 (10)</th>
              <th style="width: 4%;">C4 (10)</th>
              <th style="width: 4%;">C5 (10)</th>
              <th style="width: 6%;">Total (50)</th>
              <th style="width: 10%;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">Judge 1 Signature: __________________________________</div>
          <div class="sig-box">Judge 2 Signature: __________________________________</div>
        </div>
        <div class="signatures">
          <div class="sig-box">Judge 3 Signature: __________________________________</div>
          <div class="sig-box">Judge 4 Signature: __________________________________</div>
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print All Panels Dossiers - Mecia Hack 3.0</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        body {
          font-family: Arial, sans-serif;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 10px;
          font-size: 12px;
        }
        .header {
          border: 2px solid #000;
          padding: 10px 14px;
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0 0 6px 0;
          font-size: 18px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header-grid {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .judges-box {
          background: #f0f0f0;
          padding: 6px 10px;
          margin-top: 6px;
          font-size: 12px;
          border: 1px solid #ccc;
        }
        .rubrics-bar {
          background: #fafafa;
          border: 1px solid #000;
          padding: 6px 10px;
          margin-bottom: 12px;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #000;
          padding: 6px 8px;
          vertical-align: top;
        }
        th {
          background: #e8e8e8;
          font-size: 11px;
          text-transform: uppercase;
        }
        .signatures {
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          page-break-inside: avoid;
        }
        .sig-box {
          width: 45%;
          border-top: 1px solid #000;
          padding-top: 6px;
          margin-top: 35px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          .page-container { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 14px; display: flex; gap: 10px; align-items: center;">
        <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background: #008000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          🖨️ PRINT ALL 11 PANELS DOSSIERS (A4)
        </button>
        <button onclick="window.close()" style="padding: 10px 16px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          ✕ Close
        </button>
        <span style="color: #666; font-size: 12px;">Tip: Ensure <strong>Landscape</strong> is selected. Each panel will print on its own separate page.</span>
      </div>

      ${panelsHtml}
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
