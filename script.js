// ==========================================
// SUPABASE DATABASE CONFIGURATION & CLIENT
// ==========================================
// Replace these placeholders with your actual Supabase credentials:
const SUPABASE_URL = 'https://vuqizkxqnjcyewmoeipg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1cWl6a3hxbmpjeWV3bW9laXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTAwMTMsImV4cCI6MjEwMTkyNjAxM30.uW69lruMly-ad-JpKUmAM5dleaH1CgNSp31rFbyAI78';

let supabaseClient = null;
if (window.supabase && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("⚡ Supabase database connected!");
  } catch (err) {
    console.warn("Supabase initialization warning:", err);
  }
}

// Helper function to safely read input value without throwing TypeError
function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

const teamInfoMap = {
  'cyber byte squad': {
    name: 'Cyber Byte Squad',
    sub: 'Leader: Alex Johnson (EN2026101) | Project: AI-Powered Autonomous Health Monitor'
  },
  'quantum hackers': {
    name: 'Quantum Hackers',
    sub: 'Leader: Sarah Chen (EN2026204) | Project: Post-Quantum Cryptography Ledger'
  },
  'visionary ai': {
    name: 'Visionary AI',
    sub: 'Leader: Rahul Sharma (EN2026309) | Project: Smart Urban Traffic Grid Optimization'
  }
};

// Default Hackathon Teams Data Store
const defaultTeamsData = [
  {
    id: 'team-1',
    teamName: 'Cyber Byte Squad',
    leaderName: 'Alex Johnson',
    leaderEmail: 'alex@cyber.edu',
    leaderId: 'EN2026101',
    leaderPhone: '+91 9876543210',
    members: [
      { name: 'Rohan Verma', email: 'rohan@cyber.edu', idNo: 'EN2026102', phone: '+91 9876543211' },
      { name: 'Priya Patel', email: 'priya@cyber.edu', idNo: 'EN2026103', phone: '+91 9876543212' },
      { name: 'David Miller', email: 'david@cyber.edu', idNo: 'EN2026104', phone: '+91 9876543213' }
    ],
    projectTitle: 'AI-Powered Autonomous Health Monitor',
    mainIdea: 'Real-time patient telemetry monitoring using wearable sensor fusion and edge AI anomaly detection.',
    techStack: 'Python, TensorFlow, React Native, Raspberry Pi',
    assignedJudge: 'judge@eval.org'
  },
  {
    id: 'team-2',
    teamName: 'Quantum Hackers',
    leaderName: 'Sarah Chen',
    leaderEmail: 'sarah@quantum.edu',
    leaderId: 'EN2026204',
    leaderPhone: '+91 9812345678',
    members: [
      { name: 'Michael Scott', email: 'michael@quantum.edu', idNo: 'EN2026205', phone: '+91 9812345679' },
      { name: 'Dwight Schrute', email: 'dwight@quantum.edu', idNo: 'EN2026206', phone: '+91 9812345680' }
    ],
    projectTitle: 'Post-Quantum Cryptography Ledger',
    mainIdea: 'Lattice-based encryption system for decentralized transaction validation resistant to quantum attacks.',
    techStack: 'Rust, WebAssembly, Go, Docker',
    assignedJudge: 'judge@eval.org'
  },
  {
    id: 'team-3',
    teamName: 'Visionary AI',
    leaderName: 'Rahul Sharma',
    leaderEmail: 'rahul@vision.edu',
    leaderId: 'EN2026309',
    leaderPhone: '+91 9765432109',
    members: [
      { name: 'Neha Gupta', email: 'neha@vision.edu', idNo: 'EN2026310', phone: '+91 9765432110' },
      { name: 'Aniket Das', email: 'aniket@vision.edu', idNo: 'EN2026311', phone: '+91 9765432111' },
      { name: 'Sophia Lee', email: 'sophia@vision.edu', idNo: 'EN2026312', phone: '+91 9765432112' }
    ],
    projectTitle: 'Smart Urban Traffic Grid Optimization',
    mainIdea: 'Computer-vision driven dynamic signal timing to minimize congestion and emergency vehicle response times.',
    techStack: 'OpenCV, PyTorch, Node.js, Leaflet.js',
    assignedJudge: 'judge2@eval.org'
  }
];

function getTeamsData() {
  try {
    const data = localStorage.getItem('hackathonTeamsData');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  localStorage.setItem('hackathonTeamsData', JSON.stringify(defaultTeamsData));
  return defaultTeamsData;
}

function saveTeamsData(data) {
  try {
    localStorage.setItem('hackathonTeamsData', JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

function switchRole(role) {
  // Update tabs
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => tab.classList.remove('active'));

  // Hide all forms
  const forms = document.querySelectorAll('.login-form');
  forms.forEach(form => form.classList.remove('active'));

  // Update header text and active elements
  const title = document.getElementById('portal-title');
  const desc = document.getElementById('portal-desc');
  const roleBadge = document.getElementById('role-badge');

  if (title) title.textContent = 'Mecia Hack 3.0';

  if (role === 'student') {
    if (tabs[0]) tabs[0].classList.add('active');
    const studentForm = document.getElementById('student-form');
    if (studentForm) studentForm.classList.add('active');
    if (desc) desc.textContent = 'Access your project dashboard and submit entries.';
    if (roleBadge) roleBadge.textContent = 'STAGE 1: STUDENT';
  } else if (role === 'judge') {
    if (tabs[1]) tabs[1].classList.add('active');
    const judgeForm = document.getElementById('judge-form');
    if (judgeForm) judgeForm.classList.add('active');
    if (desc) desc.textContent = 'Evaluate hackathon submissions and score projects.';
    if (roleBadge) roleBadge.textContent = 'STAGE 2: JUDGE';
  } else if (role === 'admin') {
    if (tabs[2]) tabs[2].classList.add('active');
    const adminForm = document.getElementById('admin-form');
    if (adminForm) adminForm.classList.add('active');
    if (desc) desc.textContent = 'Manage events, teams, and administrative settings.';
    if (roleBadge) roleBadge.textContent = 'STAGE 3: ADMIN';
  }
}

// Handle Student Google SSO Login & Redirect to Project Submission Page
async function handleStudentGoogleLogin() {
  const projectType = getInputValue('project-type') || sessionStorage.getItem('projectType') || 'hardware';
  sessionStorage.setItem('targetRole', 'student');
  sessionStorage.setItem('projectType', projectType);

  if (supabaseClient) {
    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mecia-hacks.vercel.app';
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: originUrl }
      });
      if (!error) return;
    } catch (e) {
      console.warn("Supabase Google OAuth fallback warning:", e);
    }
  }

  // Fallback redirect for static environment
  window.location.href = 'project-submission.html';
}

async function handleStudentLogin(event) {
  if (event) event.preventDefault();
  return handleStudentGoogleLogin();
}

// Handle Judge Login & Redirect to Judge Dashboard
async function handleJudgeLogin(event) {
  if (event) event.preventDefault();
  const judgeEmail = getInputValue('judge-email');
  if (judgeEmail) {
    sessionStorage.setItem('judgeEmail', judgeEmail);
    if (supabaseClient) {
      try {
        await supabaseClient.from('user_logins').insert([{ role: 'judge', user_identifier: judgeEmail }]);
      } catch (e) {
        console.warn("Supabase login tracking warning:", e);
      }
    }
  }
  window.location.href = 'judge-dashboard.html';
  return false;
}

const COMMON_ADMIN_PASS = 'MeciaHacks2026!';

const ALLOWED_ADMIN_EMAILS = {
  '24ce58@svitvasad.ac.in': { name: 'Manav Patel', pass: COMMON_ADMIN_PASS },
  '24ce67@svitvasad.ac.in': { name: 'Het Patel', pass: COMMON_ADMIN_PASS },
  'devpatel4536@gmail.com': { name: 'Dev Patel', pass: COMMON_ADMIN_PASS },
  '224csd8@svitvasad.ac.in': { name: 'Tej Patel', pass: COMMON_ADMIN_PASS },
  'milinpatel.comp@svitvasad.ac.in': { name: 'Milin Patel', pass: COMMON_ADMIN_PASS }
};

// Handle Admin Login & Redirect to Admin Control Panel
async function handleAdminLogin(event) {
  if (event) event.preventDefault();
  const adminEmail = getInputValue('admin-user').trim().toLowerCase();
  const adminPass = getInputValue('admin-pass').trim();

  const adminAccount = ALLOWED_ADMIN_EMAILS[adminEmail];
  if (!adminAccount) {
    alert(`⛔ ACCESS DENIED: '${adminEmail}' is not an authorized Admin Email ID. Access is strictly limited to the 5 official Admin team accounts.`);
    return false;
  }

  const isPassValid = adminPass === COMMON_ADMIN_PASS || adminPass.toLowerCase() === 'meciahacks2026' || adminPass === 'MeciaHacks2026';

  if (!isPassValid) {
    alert("⛔ ACCESS DENIED: Incorrect Admin Password.");
    return false;
  }

  sessionStorage.setItem('adminUser', adminEmail);
  sessionStorage.setItem('adminRoleName', adminAccount.name);

  if (supabaseClient) {
    try {
      await supabaseClient.from('user_logins').insert([{ role: 'admin', user_identifier: adminEmail }]);
    } catch (e) {
      console.warn("Supabase login tracking warning:", e);
    }
  }
  window.location.href = 'admin-dashboard.html';
  return false;
}

// Validate Team Leader details to unlock subsequent sections
function validateLeaderDetails() {
  const teamName = getInputValue('team-name');
  const leaderName = getInputValue('leader-name');
  const leaderEmail = getInputValue('leader-email');
  const leaderId = getInputValue('leader-id');
  const leaderBranch = getInputValue('leader-branch');
  const leaderPhone = getInputValue('leader-phone');

  const isLeaderPhoneValid = /^\d{10}$/.test(leaderPhone);
  const isLeaderComplete = Boolean(teamName && leaderName && leaderEmail && leaderId && leaderBranch && isLeaderPhoneValid);

  const lockedElements = document.querySelectorAll('.locked-until-leader');
  const lockStatusBadge = document.getElementById('lock-status-badge');

  lockedElements.forEach(el => {
    if (isLeaderComplete) {
      el.classList.remove('section-disabled');
      const inputs = el.querySelectorAll('input, textarea, button, select');
      inputs.forEach(input => input.removeAttribute('disabled'));
    } else {
      el.classList.add('section-disabled');
      const inputs = el.querySelectorAll('input, textarea, button, select');
      inputs.forEach(input => input.setAttribute('disabled', 'true'));
    }
  });

  if (lockStatusBadge) {
    if (isLeaderComplete) {
      lockStatusBadge.textContent = '🔓 UNLOCKED';
      lockStatusBadge.className = 'lock-badge unlocked';
    } else {
      lockStatusBadge.textContent = '🔒 ENTER LEADER DETAILS FIRST';
      lockStatusBadge.className = 'lock-badge locked';
    }
  }
}

// Dynamic Team Member Rows Management
function addTeamMember() {
  const container = document.getElementById('team-members-container');
  if (!container) return;

  const memberRow = document.createElement('div');
  memberRow.className = 'member-row';
  memberRow.innerHTML = `
    <input type="text" placeholder="Member Name" required>
    <input type="email" placeholder="Email ID" required>
    <input type="text" placeholder="Enrollment No. / ID" required>
    <select required>
      <option value="Computer Engineering (CE)">CE</option>
      <option value="Information Technology (IT)">IT</option>
      <option value="Computer Science & Design (CSD)">CSD</option>
      <option value="Aeronautical Engineering">Aero</option>
      <option value="Diploma">Diploma</option>
      <option value="BSc IT">BSc IT</option>
      <option value="BCA">BCA</option>
      <option value="MCA">MCA</option>
      <option value="Electronics & Communication (EC)">EC</option>
      <option value="Electrical Engineering (EE)">EE</option>
      <option value="Mechanical Engineering (ME)">ME</option>
      <option value="Civil Engineering (CL)">CL</option>
      <option value="Other">Other</option>
    </select>
    <input type="tel" placeholder="10-digit Phone No." maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)">
    <button type="button" class="remove-btn" onclick="removeMember(this)" title="Remove Member">&times;</button>
  `;
  container.appendChild(memberRow);
}

function removeMember(btn) {
  const container = document.getElementById('team-members-container');
  if (!container) return;
  const rows = container.querySelectorAll('.member-row');
  if (rows.length > 1) {
    btn.parentElement.remove();
  } else {
    alert("At least one team member is required.");
  }
}

// Handle Student Project Submission & Save to Teams Data (Local + Supabase)
async function handleProjectSubmission(event) {
  if (event) event.preventDefault();

  const teamName = getInputValue('team-name');
  const leaderName = getInputValue('leader-name');
  const leaderEmail = getInputValue('leader-email');
  const leaderId = getInputValue('leader-id');
  const leaderBranch = getInputValue('leader-branch') || 'Computer Engineering (CE)';
  const leaderPhone = getInputValue('leader-phone');
  const projectTitle = getInputValue('project-title') || 'New Project Entry';
  const projectType = getInputValue('project-type') || 'hardware';
  const mainIdea = getInputValue('project-idea') || getInputValue('main-idea') || 'Project Idea Details';
  const techStack = getInputValue('tech-stack') || 'HTML, CSS, JS';

  sessionStorage.setItem('projectType', projectType);

  if (!teamName || !leaderName || !leaderEmail || !leaderId || !leaderPhone) {
    alert("Please complete all compulsory Team Leader details first.");
    return false;
  }

  if (!/^\d{10}$/.test(leaderPhone)) {
    alert("Please enter a valid 10-digit numeric mobile number for the Team Leader.");
    return false;
  }

  // Parse Team Members
  const memberRows = document.querySelectorAll('#team-members-container .member-row');
  const members = [];
  memberRows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const select = row.querySelector('select');
    if (inputs.length >= 3 && inputs[0].value.trim()) {
      members.push({
        name: inputs[0].value.trim(),
        email: inputs[1].value.trim(),
        idNo: inputs[2].value.trim(),
        branch: select ? select.value : 'Computer Engineering (CE)',
        phone: inputs[3] ? inputs[3].value.trim() : ''
      });
    }
  });

  // Local Storage Save
  const currentTeams = getTeamsData();
  const newTeam = {
    id: `team-${Date.now()}`,
    teamName,
    leaderName,
    leaderEmail,
    leaderId,
    leaderPhone,
    members,
    projectTitle,
    projectType,
    mainIdea,
    techStack,
    assignedJudge: 'Unassigned'
  };

  const updatedTeams = currentTeams.filter(t => t.teamName.toLowerCase() !== teamName.toLowerCase());
  updatedTeams.push(newTeam);
  saveTeamsData(updatedTeams);

  // Supabase Database Insert (if connected)
  if (supabaseClient) {
    try {
      const insertPayload = {
        team_name: teamName,
        leader_name: leaderName,
        leader_email: leaderEmail,
        leader_id: leaderId,
        leader_phone: leaderPhone,
        project_title: projectTitle,
        main_idea: `[Type: ${projectType.toUpperCase()} | Branch: ${leaderBranch}]\n\n${mainIdea}`,
        tech_stack: techStack
      };

      const { data: teamRes, error: teamErr } = await supabaseClient
        .from('teams')
        .insert([insertPayload])
        .select()
        .single();

      if (!teamErr && teamRes && members.length > 0) {
        const memberRecords = members.map(m => ({
          team_id: teamRes.id,
          member_name: m.branch ? `${m.name} (${m.branch})` : m.name,
          member_email: m.email,
          member_id: m.idNo,
          member_phone: m.phone
        }));
        await supabaseClient.from('team_members').insert(memberRecords);
      }
    } catch (e) {
      console.warn("Supabase sync warning:", e);
    }
  }

  const modal = document.getElementById('victory-modal');
  if (modal) {
    modal.classList.add('show');
  }
  return false;
}

function closeVictoryModal() {
  const modal = document.getElementById('victory-modal');
  if (modal) {
    modal.classList.remove('show');
  }
  window.location.href = 'mecia03.html';
}

// Judge Evaluation Auto Score Calculation
function calculateTotalScore() {
  const c1 = parseInt(getInputValue('c1-score') || 0);
  const c2 = parseInt(getInputValue('c2-score') || 0);
  const c3 = parseInt(getInputValue('c3-score') || 0);
  const c4 = parseInt(getInputValue('c4-score') || 0);

  const total = Math.min(100, Math.max(0, c1 + c2 + c3 + c4));
  const totalEl = document.getElementById('live-total-score');
  if (totalEl) {
    totalEl.textContent = `${total} / 100`;
  }
}

async function handleEvaluationSubmission(event) {
  if (event) event.preventDefault();
  const teamNameEl = document.getElementById('evaluating-team-name');
  const teamName = teamNameEl ? teamNameEl.textContent.trim() : 'Cyber Byte Squad';
  const judgeEmail = sessionStorage.getItem('judgeEmail') || 'judge@eval.org';
  const c1 = parseInt(getInputValue('c1-score') || 0);
  const c2 = parseInt(getInputValue('c2-score') || 0);
  const c3 = parseInt(getInputValue('c3-score') || 0);
  const c4 = parseInt(getInputValue('c4-score') || 0);
  const total = Math.min(100, Math.max(0, c1 + c2 + c3 + c4));
  const remarks = getInputValue('judge-remarks');

  // Local Storage Save
  try {
    let evaluations = JSON.parse(localStorage.getItem('teamEvaluations') || '[]');
    evaluations = evaluations.filter(e => e.teamName !== teamName);
    evaluations.push({
      teamName,
      judgeEmail,
      c1,
      c2,
      c3,
      c4,
      totalScore: total,
      remarks,
      timestamp: new Date().toLocaleString()
    });
    localStorage.setItem('teamEvaluations', JSON.stringify(evaluations));
  } catch (err) {
    console.error("Storage error:", err);
  }

  // Supabase Database Save (if connected)
  if (supabaseClient) {
    try {
      const { data: existingEval } = await supabaseClient
        .from('evaluations')
        .select('id')
        .ilike('team_name', teamName)
        .eq('judge_email', judgeEmail)
        .maybeSingle();

      let evalErr = null;
      if (existingEval && existingEval.id) {
        const { error } = await supabaseClient
          .from('evaluations')
          .update({
            c1_innovation: c1,
            c2_execution: c2,
            c3_feasibility: c3,
            c4_presentation: c4,
            total_score: total,
            remarks: remarks,
            updated_at: new Date()
          })
          .eq('id', existingEval.id);
        evalErr = error;
      } else {
        const { error } = await supabaseClient
          .from('evaluations')
          .insert([{
            team_name: teamName,
            judge_email: judgeEmail,
            c1_innovation: c1,
            c2_execution: c2,
            c3_feasibility: c3,
            c4_presentation: c4,
            total_score: total,
            remarks: remarks,
            updated_at: new Date()
          }]);
        evalErr = error;
      }

      if (evalErr) {
        console.error("Supabase evaluation save error:", evalErr.message, evalErr);
        alert("Supabase Database Notice: " + evalErr.message);
      } else {
        console.log("✅ Evaluation marks successfully saved to Supabase!");
      }
    } catch (e) {
      console.warn("Supabase evaluation sync error:", e);
    }
  }

  const modalScoreEl = document.getElementById('modal-team-score');
  if (modalScoreEl) {
    modalScoreEl.textContent = `${total} / 100`;
  }

  const modal = document.getElementById('eval-modal');
  if (modal) {
    modal.classList.add('show');
  }
  return false;
}

function closeEvalModal() {
  const modal = document.getElementById('eval-modal');
  if (modal) {
    modal.classList.remove('show');
  }
  window.location.href = 'judge-dashboard.html';
}

// ADMIN DASHBOARD TAB SWITCHING & CONTROL LOGIC
function switchAdminTab(tabId) {
  const tabs = document.querySelectorAll('.admin-tab-content');
  tabs.forEach(t => t.classList.remove('active'));

  const navBtns = document.querySelectorAll('.admin-controls-bar .judge-nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add('active');

  if (tabId === 'teams-tab' && navBtns[0]) navBtns[0].classList.add('active');
  if (tabId === 'scores-tab' && navBtns[1]) navBtns[1].classList.add('active');
}

async function assignJudgeToTeam(teamId) {
  const selectEl = document.getElementById(`judge-select-${teamId}`);
  if (!selectEl) return;
  const judgeEmail = selectEl.value;

  const teams = getTeamsData();
  const team = teams.find(t => t.id === teamId);
  if (team) {
    team.assignedJudge = judgeEmail;
    saveTeamsData(teams);

    // Sync to Supabase if client is configured
    if (supabaseClient) {
      try {
        await supabaseClient.from('teams').update({ assigned_judge: judgeEmail }).eq('team_name', team.teamName);
      } catch (e) {
        console.warn("Supabase judge assignment sync error:", e);
      }
    }

    alert(`Successfully assigned ${judgeEmail} to team ${team.teamName}!`);
    renderAdminTables();
  }
}

async function loadExistingEvaluation(teamName) {
  let evalData = null;

  // 1. Fetch from Supabase first
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('evaluations')
        .select('*')
        .ilike('team_name', teamName)
        .maybeSingle();

      if (data && !error) {
        evalData = {
          c1: data.c1_innovation,
          c2: data.c2_execution,
          c3: data.c3_feasibility,
          c4: data.c4_presentation,
          remarks: data.remarks
        };
      }
    } catch (e) {
      console.warn("Supabase fetch evaluation error:", e);
    }
  }

  // 2. Fallback to LocalStorage
  if (!evalData) {
    try {
      const evaluations = JSON.parse(localStorage.getItem('teamEvaluations') || '[]');
      const match = evaluations.find(e => e.teamName.toLowerCase() === teamName.toLowerCase());
      if (match) {
        evalData = {
          c1: match.c1,
          c2: match.c2,
          c3: match.c3,
          c4: match.c4,
          remarks: match.remarks
        };
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Populate inputs if evaluation exists
  if (evalData) {
    const c1Input = document.getElementById('c1-score');
    const c2Input = document.getElementById('c2-score');
    const c3Input = document.getElementById('c3-score');
    const c4Input = document.getElementById('c4-score');
    const remarksInput = document.getElementById('judge-remarks');

    if (c1Input) c1Input.value = evalData.c1 ?? '';
    if (c2Input) c2Input.value = evalData.c2 ?? '';
    if (c3Input) c3Input.value = evalData.c3 ?? '';
    if (c4Input) c4Input.value = evalData.c4 ?? '';
    if (remarksInput) remarksInput.value = evalData.remarks ?? '';

    calculateTotalScore();
  }
}

async function renderAdminTables() {
  const teamsTbody = document.getElementById('admin-teams-tbody');
  const scoresTbody = document.getElementById('admin-scores-tbody');
  if (!teamsTbody && !scoresTbody) return;

  const teams = getTeamsData();
  let evaluations = [];

  // Try fetching evaluations from Supabase first
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('evaluations').select('*');
      if (data && !error && data.length > 0) {
        evaluations = data.map(d => ({
          teamName: d.team_name,
          judgeEmail: d.judge_email,
          c1: d.c1_innovation,
          c2: d.c2_execution,
          c3: d.c3_feasibility,
          c4: d.c4_presentation,
          totalScore: d.total_score,
          remarks: d.remarks,
          timestamp: new Date(d.updated_at || Date.now()).toLocaleString()
        }));
      }
    } catch (e) {
      console.warn("Supabase fetch evaluations warning:", e);
    }
  }

  if (evaluations.length === 0) {
    try {
      evaluations = JSON.parse(localStorage.getItem('teamEvaluations') || '[]');
    } catch (e) {
      evaluations = [];
    }
  }

  // 1. Render Teams & Judge Assignment Table
  if (teamsTbody) {
    teamsTbody.innerHTML = '';
    teams.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="criterion-name">${t.teamName}</td>
        <td>${t.leaderName} (${t.leaderId})<br><small style="color:var(--text-muted);">${t.leaderEmail}</small></td>
        <td>${t.projectTitle}<br><small style="color:var(--text-muted);">${t.techStack}</small></td>
        <td>
          <select id="judge-select-${t.id}" class="retro-select admin-judge-select">
            <option value="judge@eval.org" ${t.assignedJudge === 'judge@eval.org' ? 'selected' : ''}>judge@eval.org</option>
            <option value="judge2@eval.org" ${t.assignedJudge === 'judge2@eval.org' ? 'selected' : ''}>judge2@eval.org</option>
            <option value="judge3@eval.org" ${t.assignedJudge === 'judge3@eval.org' ? 'selected' : ''}>judge3@eval.org</option>
            <option value="Unassigned" ${t.assignedJudge === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
          </select>
        </td>
        <td style="text-align:center;">
          <button type="button" class="eval-btn edit-btn" style="padding:6px 12px; font-size:0.75rem;" onclick="assignJudgeToTeam('${t.id}')">
            ASSIGN
          </button>
        </td>
      `;
      teamsTbody.appendChild(tr);
    });
  }

  // 2. Render Live Leaderboard & Evaluation Scores Table
  if (scoresTbody) {
    scoresTbody.innerHTML = '';
    teams.forEach(t => {
      const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
      const tr = document.createElement('tr');

      if (evalEntry) {
        tr.innerHTML = `
          <td class="criterion-name">${t.teamName}</td>
          <td>${evalEntry.judgeEmail || t.assignedJudge}</td>
          <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${evalEntry.c1}</td>
          <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${evalEntry.c2}</td>
          <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${evalEntry.c3}</td>
          <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${evalEntry.c4}</td>
          <td style="text-align:center; font-weight:800; font-size:1.1rem; color:var(--pacman-yellow);">${evalEntry.totalScore} / 100</td>
          <td><span class="status-pill status-completed">SCORED</span></td>
          <td><small>${evalEntry.remarks || 'No remarks added.'}</small></td>
        `;
      } else {
        if (t.teamName.toLowerCase() === 'quantum hackers') {
          tr.innerHTML = `
            <td class="criterion-name">${t.teamName}</td>
            <td>${t.assignedJudge}</td>
            <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">22</td>
            <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">23</td>
            <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">21</td>
            <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">22</td>
            <td style="text-align:center; font-weight:800; font-size:1.1rem; color:var(--pacman-yellow);">88 / 100</td>
            <td><span class="status-pill status-completed">SCORED</span></td>
            <td><small>Strong post-quantum security architecture and live demo.</small></td>
          `;
        } else {
          tr.innerHTML = `
            <td class="criterion-name">${t.teamName}</td>
            <td>${t.assignedJudge}</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:center; color:var(--text-muted);">- / 100</td>
            <td><span class="status-pill status-pending">PENDING</span></td>
            <td><small style="color:var(--text-muted);">Evaluation pending</small></td>
          `;
        }
      }
      scoresTbody.appendChild(tr);
    });
  }
}

// Generate & Download Admin Master Excel / CSV Report
function exportAdminDataToExcel() {
  const teams = getTeamsData();
  let evaluations = [];
  try {
    evaluations = JSON.parse(localStorage.getItem('teamEvaluations') || '[]');
  } catch (e) {
    evaluations = [];
  }

  let csvRows = [];
  csvRows.push(["Mecia Hack 3.0 - Complete Admin Master Report & Evaluation Sheet"]);
  csvRows.push(["Report Date", new Date().toLocaleString()]);
  csvRows.push([]);
  csvRows.push([
    "Team Name",
    "Leader Name",
    "Leader Email",
    "Leader ID",
    "Leader Phone",
    "Team Members List",
    "Project Title",
    "Main Idea",
    "Tech Stack",
    "Assigned Judge",
    "Evaluation Status",
    "Innovation (25)",
    "Technical Execution (25)",
    "Solution Feasibility (25)",
    "Presentation & UI/UX (25)",
    "Total Score (100)",
    "Judge Remarks",
    "Evaluation Timestamp"
  ]);

  teams.forEach(t => {
    const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
    const membersStr = t.members ? t.members.map(m => `${m.name} (${m.idNo || m.email})`).join("; ") : '';

    let status = "PENDING";
    let c1 = "-", c2 = "-", c3 = "-", c4 = "-", total = "-", remarks = "-", timestamp = "-";

    if (evalEntry) {
      status = "SCORED";
      c1 = evalEntry.c1;
      c2 = evalEntry.c2;
      c3 = evalEntry.c3;
      c4 = evalEntry.c4;
      total = evalEntry.totalScore;
      remarks = evalEntry.remarks || '';
      timestamp = evalEntry.timestamp || '';
    } else if (t.teamName.toLowerCase() === 'quantum hackers') {
      status = "SCORED";
      c1 = 22; c2 = 23; c3 = 21; c4 = 22; total = 88;
      remarks = "Strong post-quantum security architecture and live demo.";
      timestamp = new Date().toLocaleString();
    }

    csvRows.push([
      `"${t.teamName || ''}"`,
      `"${t.leaderName || ''}"`,
      `"${t.leaderEmail || ''}"`,
      `"${t.leaderId || ''}"`,
      `"${t.leaderPhone || ''}"`,
      `"${membersStr.replace(/"/g, '""')}"`,
      `"${(t.projectTitle || '').replace(/"/g, '""')}"`,
      `"${(t.mainIdea || '').replace(/"/g, '""')}"`,
      `"${(t.techStack || '').replace(/"/g, '""')}"`,
      `"${t.assignedJudge || 'Unassigned'}"`,
      `"${status}"`,
      c1,
      c2,
      c3,
      c4,
      total,
      `"${(remarks || '').replace(/"/g, '""')}"`,
      `"${timestamp}"`
    ]);
  });

  const csvContent = csvRows.map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_Admin_Master_Report_${Date.now()}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
}

async function updateJudgeDashboardStatus() {
  const teamCards = document.querySelectorAll('.team-card');
  if (!teamCards || teamCards.length === 0) return;

  let evaluations = [];

  // 1. Fetch evaluations from Supabase if connected
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('evaluations').select('*');
      if (data && !error && data.length > 0) {
        evaluations = data.map(d => ({
          teamName: d.team_name,
          totalScore: d.total_score
        }));
      }
    } catch (e) {
      console.warn("Supabase fetch evaluations warning:", e);
    }
  }

  // 2. Fallback & merge local storage evaluations
  try {
    const localEvals = JSON.parse(localStorage.getItem('teamEvaluations') || '[]');
    localEvals.forEach(le => {
      if (!evaluations.some(e => e.teamName.toLowerCase() === le.teamName.toLowerCase())) {
        evaluations.push({
          teamName: le.teamName,
          totalScore: le.totalScore
        });
      }
    });
  } catch (e) {
    console.error(e);
  }

  // 3. Update pill to SCORED and button to EDIT MARKS for evaluated teams
  teamCards.forEach(card => {
    const teamNameEl = card.querySelector('.team-name');
    if (!teamNameEl) return;
    const teamName = teamNameEl.textContent.trim();

    const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === teamName.toLowerCase());
    if (evalEntry) {
      const statusPill = card.querySelector('.status-pill');
      if (statusPill) {
        statusPill.className = 'status-pill status-completed';
        statusPill.textContent = `SCORED (${evalEntry.totalScore}/100)`;
      }

      const evalBtn = card.querySelector('.eval-btn');
      if (evalBtn) {
        evalBtn.className = 'eval-btn edit-btn';
        evalBtn.innerHTML = '✏️ EDIT MARKS';
      }
    }
  });
}

// THEME SWITCHER LOGIC (Simple Theme vs Arcade Theme)
function toggleWebsiteTheme() {
  const currentMode = localStorage.getItem('themeMode') || 'arcade';
  const newMode = currentMode === 'simple' ? 'arcade' : 'simple';
  localStorage.setItem('themeMode', newMode);
  applyStoredTheme();
}

function applyStoredTheme() {
  const mode = localStorage.getItem('themeMode') || 'arcade';
  const btn = document.getElementById('theme-toggle-btn');

  if (mode === 'simple') {
    document.body.classList.add('simple-theme');
    if (btn) {
      btn.innerHTML = '🕹️ SWITCH TO ARCADE THEME';
    }
  } else {
    document.body.classList.remove('simple-theme');
    if (btn) {
      btn.innerHTML = '🌗 CONVERT TO SIMPLE THEME';
    }
  }
}

// Initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  // Apply active theme mode
  applyStoredTheme();

  // Ensure teams data is initialized
  getTeamsData();

  // Populate student ID & project type if on student submission page
  const loggedIdEl = document.getElementById('logged-student-id');
  if (loggedIdEl) {
    const savedId = sessionStorage.getItem('studentId');
    if (savedId) {
      loggedIdEl.textContent = savedId;
      const leaderIdInput = document.getElementById('leader-id');
      if (leaderIdInput && !leaderIdInput.value) {
        leaderIdInput.value = savedId;
      }
    }
  }

  const savedProjectType = sessionStorage.getItem('projectType');
  const projectTypeInput = document.getElementById('project-type');
  if (savedProjectType && projectTypeInput) {
    projectTypeInput.value = savedProjectType;
  }

  // Populate judge email if on judge panel
  const loggedJudgeEl = document.getElementById('logged-judge-email');
  if (loggedJudgeEl) {
    const savedJudgeEmail = sessionStorage.getItem('judgeEmail');
    if (savedJudgeEmail) {
      loggedJudgeEl.textContent = savedJudgeEmail;
    }
    updateJudgeDashboardStatus();
  }

  // Populate admin username if on admin panel
  const loggedAdminEl = document.getElementById('logged-admin-user');
  if (loggedAdminEl) {
    const savedAdminUser = sessionStorage.getItem('adminUser');
    if (savedAdminUser) {
      loggedAdminEl.textContent = savedAdminUser;
    }
    renderAdminTables();
  }

  // Check URL query parameters for team selection on evaluation sheet
  const urlParams = new URLSearchParams(window.location.search);
  const selectedTeamParam = urlParams.get('team');
  const teamNameEl = document.getElementById('evaluating-team-name');
  const teamSubEl = document.getElementById('evaluating-team-sub');

  if (selectedTeamParam && teamNameEl) {
    const key = selectedTeamParam.toLowerCase();
    if (teamInfoMap[key]) {
      teamNameEl.textContent = teamInfoMap[key].name;
      if (teamSubEl) teamSubEl.textContent = teamInfoMap[key].sub;
    } else {
      teamNameEl.textContent = selectedTeamParam;
      if (teamSubEl) teamSubEl.textContent = `Evaluating team: ${selectedTeamParam}`;
    }

    // Auto load existing evaluation marks for this team if already evaluated
    loadExistingEvaluation(selectedTeamParam);
  }

  // Attach event listeners to Team Leader fields if present
  const leaderInputs = ['team-name', 'leader-name', 'leader-email', 'leader-id', 'leader-phone'];
  leaderInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      if (id === 'leader-phone') {
        input.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
          validateLeaderDetails();
        });
      } else {
        input.addEventListener('input', validateLeaderDetails);
      }
    }
  });

  // Run initial leader details validation if team-name input exists
  if (document.getElementById('team-name')) {
    validateLeaderDetails();
  }
});
