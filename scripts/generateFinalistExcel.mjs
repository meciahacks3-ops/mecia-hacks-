import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { FINAL_ROUND_TEAMS } from '../lib/finalRoundTeams.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log(`Loaded ${FINAL_ROUND_TEAMS.length} finalist teams.`);

// Initialize new workbook
const wb = XLSX.utils.book_new();

// -------------------------------------------------------------
// Sheet 1: Master Finalist Teams Roster (Comprehensive)
// -------------------------------------------------------------
const sheet1Headers = [
  'S.No',
  'Team ID',
  'Team Name',
  'Track',
  'Leader Name',
  'Member Names',
  'Member 1 Name',
  'Member 2 Name',
  'Member 3 Name',
  'Total Team Size',
  'Project Title',
  'Assigned Lab Location'
];

const sheet1Rows = [
  ['MECIA HACKS 3.0 — OFFICIAL FINALIST TEAMS ROSTER'],
  [
    `TOTAL FINALIST TEAMS: ${FINAL_ROUND_TEAMS.length}`,
    `SOFTWARE: ${FINAL_ROUND_TEAMS.filter(t => (t.track || '').toLowerCase() === 'software').length}`,
    `HYBRID: ${FINAL_ROUND_TEAMS.filter(t => (t.track || '').toLowerCase() === 'hybrid').length}`,
    `HARDWARE: ${FINAL_ROUND_TEAMS.filter(t => (t.track || '').toLowerCase() === 'hardware').length}`,
    `TOTAL PARTICIPANTS: ${FINAL_ROUND_TEAMS.reduce((sum, t) => sum + (t.totalMembers || (1 + (t.members?.length || 0))), 0)}`
  ],
  [],
  sheet1Headers
];

FINAL_ROUND_TEAMS.forEach((team, idx) => {
  const m1 = team.members?.[0]?.name || '';
  const m2 = team.members?.[1]?.name || '';
  const m3 = team.members?.[2]?.name || '';
  const memberNamesList = (team.members || []).map(m => m.name).filter(Boolean).join(', ');

  sheet1Rows.push([
    idx + 1,
    team.teamId || '',
    team.teamName || '',
    team.track || '',
    team.leaderName || '',
    memberNamesList,
    m1,
    m2,
    m3,
    team.totalMembers || (1 + (team.members?.length || 0)),
    team.projectTitle || '',
    team.labLocation || ''
  ]);
});

const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
ws1['!cols'] = [
  { wch: 6 },   // S.No
  { wch: 12 },  // Team ID
  { wch: 24 },  // Team Name
  { wch: 14 },  // Track
  { wch: 25 },  // Leader Name
  { wch: 45 },  // Member Names
  { wch: 22 },  // Member 1 Name
  { wch: 22 },  // Member 2 Name
  { wch: 22 },  // Member 3 Name
  { wch: 16 },  // Total Team Size
  { wch: 35 },  // Project Title
  { wch: 32 }   // Lab Location
];
XLSX.utils.book_append_sheet(wb, ws1, 'Finalist Teams');

// -------------------------------------------------------------
// Sheet 2: Simple 4-Column Format (Direct Prompt Requirement)
// -------------------------------------------------------------
const sheet2Headers = [
  'Team ID',
  'Team Name',
  'Leader Name',
  'Member Names',
  'Member 1',
  'Member 2',
  'Member 3'
];

const sheet2Rows = [
  sheet2Headers
];

FINAL_ROUND_TEAMS.forEach((team) => {
  const m1 = team.members?.[0]?.name || '';
  const m2 = team.members?.[1]?.name || '';
  const m3 = team.members?.[2]?.name || '';
  const memberNamesList = (team.members || []).map(m => m.name).filter(Boolean).join(', ');

  sheet2Rows.push([
    team.teamId || '',
    team.teamName || '',
    team.leaderName || '',
    memberNamesList,
    m1,
    m2,
    m3
  ]);
});

const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
ws2['!cols'] = [
  { wch: 12 },  // Team ID
  { wch: 24 },  // Team Name
  { wch: 25 },  // Leader Name
  { wch: 45 },  // Member Names (combined)
  { wch: 22 },  // Member 1
  { wch: 22 },  // Member 2
  { wch: 22 }   // Member 3
];
XLSX.utils.book_append_sheet(wb, ws2, 'Clean Team & Members');

// -------------------------------------------------------------
// Sheet 3: Individual Members Roster (189 rows - 1 row per person)
// -------------------------------------------------------------
const sheet3Headers = [
  'S.No',
  'Team ID',
  'Team Name',
  'Track',
  'Role',
  'Participant Name',
  'Enrollment ID',
  'Phone Number',
  'Email Address',
  'Branch / Department',
  'Assigned Lab Location'
];

const sheet3Rows = [
  [`MECIA HACKS 3.0 — ALL FINALIST PARTICIPANTS ROSTER (${FINAL_ROUND_TEAMS.reduce((sum, t) => sum + (t.totalMembers || (1 + (t.members?.length || 0))), 0)} PARTICIPANTS)`],
  [],
  sheet3Headers
];

let personIndex = 1;
FINAL_ROUND_TEAMS.forEach((team) => {
  // Leader row
  sheet3Rows.push([
    personIndex++,
    team.teamId || '',
    team.teamName || '',
    team.track || '',
    'Team Leader',
    team.leaderName || '',
    team.leaderId || '',
    team.leaderPhone || '',
    team.leaderEmail || '',
    team.leaderBranch || '',
    team.labLocation || ''
  ]);

  // Members rows
  (team.members || []).forEach((mem, mIdx) => {
    sheet3Rows.push([
      personIndex++,
      team.teamId || '',
      team.teamName || '',
      team.track || '',
      `Member ${mIdx + 1}`,
      mem.name || '',
      mem.idNo || '',
      mem.phone || '',
      mem.email || '',
      mem.branch || '',
      team.labLocation || ''
    ]);
  });
});

const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
ws3['!cols'] = [
  { wch: 6 },   // S.No
  { wch: 12 },  // Team ID
  { wch: 24 },  // Team Name
  { wch: 14 },  // Track
  { wch: 16 },  // Role
  { wch: 25 },  // Participant Name
  { wch: 24 },  // Enrollment ID
  { wch: 16 },  // Phone Number
  { wch: 30 },  // Email Address
  { wch: 28 },  // Branch
  { wch: 32 }   // Lab Location
];
const totalParticipantsCount = FINAL_ROUND_TEAMS.reduce((sum, t) => sum + (t.totalMembers || (1 + (t.members?.length || 0))), 0);
XLSX.utils.book_append_sheet(wb, ws3, `All ${totalParticipantsCount} Participants`);

// -------------------------------------------------------------
// Sheet 4: Software Finalists
// -------------------------------------------------------------
function buildTrackSheet(trackName, filterFn) {
  const teams = FINAL_ROUND_TEAMS.filter(filterFn);
  const rows = [
    [`MECIA HACKS 3.0 — ${trackName.toUpperCase()} FINALISTS (${teams.length} TEAMS)`],
    [],
    [
      'S.No',
      'Team ID',
      'Team Name',
      'Leader Name',
      'Member Names',
      'Member 1 Name',
      'Member 2 Name',
      'Member 3 Name',
      'Project Title',
      'Lab Location'
    ]
  ];

  teams.forEach((t, i) => {
    const m1 = t.members?.[0]?.name || '';
    const m2 = t.members?.[1]?.name || '';
    const m3 = t.members?.[2]?.name || '';
    const memList = (t.members || []).map(m => m.name).filter(Boolean).join(', ');

    rows.push([
      i + 1,
      t.teamId || '',
      t.teamName || '',
      t.leaderName || '',
      memList,
      m1,
      m2,
      m3,
      t.projectTitle || '',
      t.labLocation || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 24 },
    { wch: 25 },
    { wch: 45 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 35 },
    { wch: 32 }
  ];
  return ws;
}

const softCount = FINAL_ROUND_TEAMS.filter(t => (t.track || '').toLowerCase() === 'software').length;
const hybCount = FINAL_ROUND_TEAMS.filter(t => (t.track || '').toLowerCase() === 'hybrid').length;
const hardCount = FINAL_ROUND_TEAMS.filter(t => (t.track || '').toLowerCase() === 'hardware').length;

const wsSoftware = buildTrackSheet('Software Track', t => (t.track || '').toLowerCase() === 'software');
XLSX.utils.book_append_sheet(wb, wsSoftware, `Software Track (${softCount})`);

const wsHybrid = buildTrackSheet('Hybrid Track', t => (t.track || '').toLowerCase() === 'hybrid');
XLSX.utils.book_append_sheet(wb, wsHybrid, `Hybrid Track (${hybCount})`);

const wsHardware = buildTrackSheet('Hardware Track', t => (t.track || '').toLowerCase() === 'hardware');
XLSX.utils.book_append_sheet(wb, wsHardware, `Hardware Track (${hardCount})`);

// Write XLSX to disk
const xlsxPath = path.join(rootDir, 'MECIA_HACKS_3.0_Finalist_Teams_Members.xlsx');
XLSX.writeFile(wb, xlsxPath);
console.log(`✅ Generated Excel File: ${xlsxPath}`);

// Also generate a clean CSV file
const csvRows = [
  ['"S.No"', '"Team ID"', '"Team Name"', '"Track"', '"Leader Name"', '"Member Names"', '"Member 1 Name"', '"Member 2 Name"', '"Member 3 Name"', '"Total Members"', '"Project Title"', '"Lab Location"']
];

FINAL_ROUND_TEAMS.forEach((team, idx) => {
  const m1 = team.members?.[0]?.name || '';
  const m2 = team.members?.[1]?.name || '';
  const m3 = team.members?.[2]?.name || '';
  const memberNamesList = (team.members || []).map(m => m.name).filter(Boolean).join('; ');

  csvRows.push([
    idx + 1,
    `"${team.teamId || ''}"`,
    `"${(team.teamName || '').replace(/"/g, '""')}"`,
    `"${team.track || ''}"`,
    `"${(team.leaderName || '').replace(/"/g, '""')}"`,
    `"${memberNamesList.replace(/"/g, '""')}"`,
    `"${m1.replace(/"/g, '""')}"`,
    `"${m2.replace(/"/g, '""')}"`,
    `"${m3.replace(/"/g, '""')}"`,
    team.totalMembers || (1 + (team.members?.length || 0)),
    `"${(team.projectTitle || '').replace(/"/g, '""')}"`,
    `"${(team.labLocation || '').replace(/"/g, '""')}"`
  ]);
});

const csvPath = path.join(rootDir, 'MECIA_HACKS_3.0_Finalist_Teams_Members.csv');
fs.writeFileSync(csvPath, csvRows.map(r => r.join(',')).join('\r\n'), 'utf8');
console.log(`✅ Generated CSV File: ${csvPath}`);
