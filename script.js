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

const teamInfoMap = {};

// Default Hackathon Teams Data Store (Clean for launch)
const defaultTeamsData = [];

function getTeamsData() {
  try {
    const data = localStorage.getItem('hackathonTeamsData');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  return [];
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

const VALID_JUDGE_IDS = [
  'MM001', 'MM002', 'MM003', 'MM004', 'MM005',
  'MM006', 'MM007', 'MM008', 'MM009', 'MM010',
  'JM001', 'JM002', 'JM003', 'JM004', 'JM005',
  'JM006', 'JM007', 'JM008', 'JM009', 'JM010', 'JM011'
];
const COMMON_JUDGE_PASS = 'Judge@Mecia2026!';

const JUDGE_PROFILES = {
  // ⭐ FINAL ROUND JUDGES (MM001 to MM010)
  'MM001': {
    id: 'MM001',
    group: 'Final Round Panel 1',
    names: ['Dr. P V RAMANA', 'Dr. Chetan O Yadav', 'Prof. Sanjay Natvarlal Patel', 'Dr. K P Mredula'],
    location: 'CE Dept. First Floor, F1'
  },
  'MM002': {
    id: 'MM002',
    group: 'Final Round Panel 2',
    names: ['Dr. Dipen S Shah', 'Dr. Nilay Narendrakumar Shah', 'Dr Jonita Roman', 'Prof. Priyal R. Patel'],
    location: 'CE Dept. First Floor, F2'
  },
  'MM003': {
    id: 'MM003',
    group: 'Final Round Panel 3',
    names: ['Dr. Neha Soni', 'Prof. Rimi V Gupta', 'Prof. Viral S Patel', 'Dr. Jigar B. Sura'],
    location: 'CE Dept. First Floor, F3'
  },
  'MM004': {
    id: 'MM004',
    group: 'Final Round Panel 4',
    names: ['Prof. Jayna B. Shah', 'Dr. Pratik Shah', 'Prof. Keyur Suthar', 'Dr. Bhavini Pandya'],
    location: 'CE Dept. First Floor, F4'
  },
  'MM005': {
    id: 'MM005',
    group: 'Final Round Panel 5',
    names: ['Dr. Mala H Mehta', 'Prof. Nisha S Velani', 'Prof. Hetal Ranjitsingh Chauhan', 'Dr. C D Kotwal'],
    location: 'CE Dept. First Floor, F5'
  },
  'MM006': {
    id: 'MM006',
    group: 'Final Round Panel 6',
    names: ['Prof. Jigneshkumar Narendrakumar Patel', 'Prof. Rashmin B Prajapati', 'Dr. Shrina Patel', 'Prof. Rakesh Gajjar'],
    location: 'CE Dept. First Floor, F6'
  },
  'MM007': {
    id: 'MM007',
    group: 'Final Round Panel 7',
    names: ['Dr. Falguni N Patel', 'Dr. Minal Patel', 'Dr. Nirali Rathod', 'Dr. Saurabh Patel'],
    location: 'CE Dept. Second Floor, S2'
  },
  'MM008': {
    id: 'MM008',
    group: 'Final Round Panel 8',
    names: ['Dr. Niranjan M. Trivedi', 'Dr. Ajaysinh Devendrasinh Rathod', 'Prof. Nisha V Shah', 'Prof. Amit Patel'],
    location: 'CE Dept. Second Floor, S1'
  },
  'MM009': {
    id: 'MM009',
    group: 'Final Round Panel 9',
    names: ['Prof. Parul V Bakaraniya', 'Dr. Barkha M. Joshi', 'Prof. Arpit Mehta', 'Prof. Nirav Patel'],
    location: 'CE Dept. Ground Floor, G3'
  },
  'MM010': {
    id: 'MM010',
    group: 'Final Round Panel 10',
    names: ['Prof. Keyur N Upadhyay', 'Prof. Amit I Chaudhari', 'Prof. Pradish D Dadhania', 'Prof. Ronak Roy'],
    location: 'CE Dept. Ground Floor, G1'
  },

  // ── Round-2 Archive Panels (JM001 to JM011) ──
  'JM001': {
    id: 'JM001',
    group: 'Group 1',
    names: ['Dr. P V RAMANA', 'Dr. Chetan O Yadav', 'Prof. Sanjay Natvarlal Patel', 'Dr. K P Mredula'],
    location: 'CE Dept. First Floor, F1'
  },
  'JM002': {
    id: 'JM002',
    group: 'Group 2',
    names: ['Dr. Dipen S Shah', 'Dr. Nilay Narendrakumar Shah', 'Dr Jonita Roman', 'Prof. Priyal R. Patel'],
    location: 'CE Dept. First Floor, F2'
  },
  'JM003': {
    id: 'JM003',
    group: 'Group 3',
    names: ['Dr. Neha Soni', 'Prof. Rimi V Gupta', 'Prof. Viral S Patel', 'Dr. Jigar B. Sura'],
    location: 'CE Dept. First Floor, F3'
  },
  'JM004': {
    id: 'JM004',
    group: 'Group 4',
    names: ['Prof. Jayna B. Shah', 'Dr. Pratik Shah', 'Prof. Keyur Suthar', 'Dr. Bhavini Pandya'],
    location: 'CE Dept. First Floor, F4'
  },
  'JM005': {
    id: 'JM005',
    group: 'Group 5',
    names: ['Dr. Mala H Mehta', 'Prof. Nisha S Velani', 'Prof. Hetal Ranjitsingh Chauhan', 'Dr. C D Kotwal'],
    location: 'CE Dept. First Floor, F5'
  },
  'JM006': {
    id: 'JM006',
    group: 'Group 6',
    names: ['Prof. Jigneshkumar Narendrakumar Patel', 'Prof. Rashmin B Prajapati', 'Dr. Shrina Patel', 'Prof. Rakesh Gajjar'],
    location: 'CE Dept. First Floor, F6'
  },
  'JM007': {
    id: 'JM007',
    group: 'Group 7',
    names: ['Dr. Falguni N Patel', 'Dr. Minal Patel', 'Dr. Nirali Rathod', 'Dr. Saurabh Patel'],
    location: 'CE Dept. Second Floor, S2'
  },
  'JM008': {
    id: 'JM008',
    group: 'Group 8',
    names: ['Dr. Niranjan M. Trivedi', 'Dr. Ajaysinh Devendrasinh Rathod', 'Prof. Nisha V Shah', 'Prof. Amit Patel'],
    location: 'CE Dept. Second Floor, S1'
  },
  'JM009': {
    id: 'JM009',
    group: 'Group 9',
    names: ['Prof. Parul V Bakaraniya', 'Dr. Barkha M. Joshi', 'Prof. Arpit Mehta', 'Prof. Nirav Patel'],
    location: 'CE Dept. Ground Floor, G3'
  },
  'JM010': {
    id: 'JM010',
    group: 'Group 10',
    names: ['Prof. Keyur N Upadhyay', 'Prof. Amit I Chaudhari', 'Prof. Pradish D Dadhania', 'Prof. Ronak Roy'],
    location: 'CE Dept. Ground Floor, G1'
  },
  'JM011': {
    id: 'JM011',
    group: 'Group 11',
    names: ['Special Jury Panel / Evaluators'],
    location: 'CE Dept. Central Hall'
  }
};

function getJudgeProfile(loginId) {
  if (!loginId) return null;
  const key = loginId.trim().toUpperCase();
  return JUDGE_PROFILES[key] || null;
}

// Handle Judge Login & Redirect to Judge Dashboard (Strictly JM001 to JM011 + Password)
async function handleJudgeLogin(event) {
  if (event) event.preventDefault();
  const judgeIdInput = getInputValue('judge-id') || getInputValue('judge-email');
  const judgePass = getInputValue('judge-pass');

  const cleanId = (judgeIdInput || '').trim().toUpperCase();
  if (!VALID_JUDGE_IDS.includes(cleanId)) {
    alert(`⛔ ACCESS DENIED: '${cleanId}' is not an authorized Judge ID. Access is strictly restricted.`);
    return false;
  }

  const enteredPass = (judgePass || '').trim();
  const isIdPasswordMatch = (enteredPass === `${cleanId}!`) || (enteredPass.toLowerCase() === `${cleanId.toLowerCase()}!`);
  const isPassValid = isIdPasswordMatch ||
                      enteredPass === COMMON_JUDGE_PASS || 
                      enteredPass.toLowerCase() === 'judge@mecia2026' || 
                      enteredPass.toLowerCase() === 'meciajudge2026!' || 
                      enteredPass === 'MeciaHacks2026!' ||
                      enteredPass.toLowerCase() === 'judge2026!';

  if (!isPassValid) {
    alert("⛔ ACCESS DENIED: Incorrect Judge Password.");
    return false;
  }

  sessionStorage.setItem('judgeEmail', cleanId);
  sessionStorage.setItem('judgeId', cleanId);

  if (supabaseClient) {
    try {
      await supabaseClient.from('user_logins').insert([
        { role: 'judge', user_identifier: cleanId }
      ]);
    } catch (e) {
      console.warn("Supabase login tracking warning:", e);
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
      await supabaseClient.from('user_logins').insert([
        { role: 'admin', user_identifier: adminEmail }
      ]);
    } catch (e) {
      console.warn("Supabase login tracking warning:", e);
    }
  }
  window.location.href = 'admin-dashboard.html';
  return false;
}

// Fetch existing registration details from Supabase if already registered
async function loadExistingRegistration(savedId) {
  if (!savedId || !supabaseClient) return;
  try {
    const { data: teamData } = await supabaseClient
      .from('teams')
      .select('*')
      .or(`leader_email.ilike.${savedId},leader_id.ilike.${savedId}`)
      .maybeSingle();

    if (teamData) {
      window.existingTeamId = teamData.id;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      setVal('team-name', teamData.team_name);
      setVal('leader-name', teamData.leader_name);
      setVal('leader-email', teamData.leader_email);
      setVal('leader-id', teamData.leader_id);
      setVal('leader-phone', teamData.leader_phone);
      setVal('project-title', teamData.project_title);
      setVal('tech-stack', teamData.tech_stack);

      if (teamData.team_id_no && teamData.team_id_no.trim() !== 'N/A') {
        setVal('team-id-no', teamData.team_id_no.trim());
      }

      const mainIdeaStr = teamData.main_idea || '';
      const match = mainIdeaStr.match(/\[Type:\s*([^|]+)\|\s*Branch:\s*([^|\]]+)(?:\|\s*Team ID:\s*([^\]]+))?\]/i);
      if (match) {
        setVal('project-type', match[1].trim().toLowerCase());
        setVal('leader-branch', match[2].trim());
        if (!teamData.team_id_no && match[3] && match[3].trim() !== 'N/A') {
          setVal('team-id-no', match[3].trim());
        }
        setVal('main-idea', mainIdeaStr.replace(/\[Type:[^\]]+\]\s*/i, '').trim());
      } else {
        setVal('main-idea', mainIdeaStr);
      }

      if (!teamData.team_id_no && (!match || !match[3])) {
        const idMatch = mainIdeaStr.match(/Team ID:\s*([^\]\n|]+)/i);
        if (idMatch && idMatch[1] && idMatch[1].trim() !== 'N/A') {
          setVal('team-id-no', idMatch[1].trim());
        }
      }

      const { data: memberData } = await supabaseClient
        .from('team_members')
        .select('*')
        .eq('team_id', teamData.id);

      if (memberData && memberData.length > 0) {
        const container = document.getElementById('team-members-container');
        if (container) {
          container.innerHTML = '';
          memberData.slice(0, 3).forEach(m => {
            let name = m.member_name || '';
            let branch = 'Computer Engineering (CE)';
            const mMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
            if (mMatch) { name = mMatch[1].trim(); branch = mMatch[2].trim(); }

            const row = document.createElement('div');
            row.className = 'member-row';
            row.innerHTML = `
              <input type="text" placeholder="Member Name" value="${name}" required>
              <input type="email" placeholder="Email ID" value="${m.member_email || ''}" required>
              <input type="text" placeholder="Enrollment No. / ID" value="${m.member_id || ''}" required>
              <select required>
                <option value="Computer Engineering (CE)" ${branch.includes('Computer Engineering') ? 'selected' : ''}>CE</option>
                <option value="Information Technology (IT)" ${branch.includes('Information') ? 'selected' : ''}>IT</option>
                <option value="Computer Science & Design (CSD)" ${branch.includes('Design') ? 'selected' : ''}>CSD</option>
                <option value="Aeronautical Engineering" ${branch.includes('Aeronautical') ? 'selected' : ''}>Aero</option>
                <option value="Diploma" ${branch.includes('Diploma') ? 'selected' : ''}>Diploma</option>
                <option value="BSc IT" ${branch.includes('BSc') ? 'selected' : ''}>BSc IT</option>
                <option value="BCA" ${branch.includes('BCA') ? 'selected' : ''}>BCA</option>
                <option value="MCA" ${branch.includes('MCA') ? 'selected' : ''}>MCA</option>
                <option value="Electronics & Communication (EC)" ${branch.includes('Electronics') ? 'selected' : ''}>EC</option>
                <option value="Electrical Engineering (EE)" ${branch.includes('Electrical') ? 'selected' : ''}>EE</option>
                <option value="Mechanical Engineering (ME)" ${branch.includes('Mechanical') ? 'selected' : ''}>ME</option>
                <option value="Civil Engineering (CL)" ${branch.includes('Civil') ? 'selected' : ''}>CL</option>
                <option value="Other" ${branch.includes('Other') ? 'selected' : ''}>Other</option>
              </select>
              <input type="tel" placeholder="10-digit Phone No." value="${m.member_phone || ''}" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)">
              <button type="button" class="remove-btn" onclick="removeMember(this)" title="Remove Member">&times;</button>
            `;
            container.appendChild(row);
          });
        }
      }
      validateLeaderDetails();
    }
  } catch (e) {
    console.warn("Load existing registration error:", e);
  }
}

function updateAddMemberBtnState() {
  const container = document.getElementById('team-members-container');
  const addBtn = document.querySelector('.add-member-btn');
  if (!container || !addBtn) return;
  const count = container.querySelectorAll('.member-row').length;
  const isLeaderComplete = document.getElementById('lock-status-badge')?.classList.contains('unlocked');
  
  if (count >= 3) {
    addBtn.textContent = '⛔ MAX 3 MEMBERS REACHED';
    addBtn.setAttribute('disabled', 'true');
    addBtn.style.opacity = '0.5';
    addBtn.style.cursor = 'not-allowed';
  } else {
    addBtn.textContent = `+ ADD MEMBER (${count}/3)`;
    if (isLeaderComplete) {
      addBtn.removeAttribute('disabled');
      addBtn.style.opacity = '1';
      addBtn.style.cursor = 'pointer';
    } else {
      addBtn.setAttribute('disabled', 'true');
      addBtn.style.opacity = '0.5';
      addBtn.style.cursor = 'not-allowed';
    }
  }
}

// Validate Team Leader details to unlock subsequent sections
function validateLeaderDetails() {
  const teamName = getInputValue('team-name').trim();
  const teamIdNo = getInputValue('team-id-no').trim();
  const leaderName = getInputValue('leader-name').trim();
  const leaderEmail = getInputValue('leader-email').trim();
  const leaderId = getInputValue('leader-id').trim();
  const leaderBranch = getInputValue('leader-branch');
  const leaderPhone = getInputValue('leader-phone').trim();

  const isLeaderPhoneValid = /^\d{10}$/.test(leaderPhone);
  const isTeamIdValid = Boolean(teamIdNo && teamIdNo.length > 0 && teamIdNo.toUpperCase() !== 'N/A');
  const isLeaderComplete = Boolean(
    teamName &&
    isTeamIdValid &&
    leaderName &&
    leaderEmail &&
    leaderId &&
    leaderBranch &&
    isLeaderPhoneValid
  );

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

  updateAddMemberBtnState();
}

// Dynamic Team Member Rows Management (Max 3 Members)
function addTeamMember() {
  const container = document.getElementById('team-members-container');
  if (!container) return;

  const currentRows = container.querySelectorAll('.member-row');
  if (currentRows.length >= 3) {
    alert("⚠️ Maximum Limit Reached: You can add up to 3 team members only.");
    updateAddMemberBtnState();
    return;
  }

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
  updateAddMemberBtnState();
}

function removeMember(btn) {
  const container = document.getElementById('team-members-container');
  if (!container) return;
  const rows = container.querySelectorAll('.member-row');
  if (rows.length > 1) {
    btn.parentElement.remove();
    updateAddMemberBtnState();
  } else {
    alert("At least one team member is required.");
  }
}

// Handle Student Project Submission & Save to Teams Data (Local + Supabase)
async function handleProjectSubmission(event) {
  if (event) event.preventDefault();

  const teamName = getInputValue('team-name').trim();
  const teamIdNo = getInputValue('team-id-no').trim();
  const leaderName = getInputValue('leader-name').trim();
  const leaderEmail = getInputValue('leader-email').trim();
  const leaderId = getInputValue('leader-id').trim();
  const leaderBranch = getInputValue('leader-branch') || 'Computer Engineering (CE)';
  const leaderPhone = getInputValue('leader-phone').trim();
  const projectTitle = getInputValue('project-title').trim() || 'New Project Entry';
  const projectType = getInputValue('project-type') || 'hardware';
  const mainIdea = getInputValue('project-idea').trim() || getInputValue('main-idea').trim() || 'Project Idea Details';
  const techStack = getInputValue('tech-stack').trim() || 'HTML, CSS, JS';

  sessionStorage.setItem('projectType', projectType);

  // 1. Strictly enforce compulsory Team ID for all student portal users
  if (!teamIdNo || teamIdNo.toUpperCase() === 'N/A') {
    alert("⚠️ Team ID Number is compulsory for all users in the Student Portal! Please enter your official Team ID before submitting.");
    const teamIdInput = document.getElementById('team-id-no');
    if (teamIdInput) teamIdInput.focus();
    return false;
  }

  if (!teamName || !leaderName || !leaderEmail || !leaderId || !leaderPhone) {
    alert("Please complete all compulsory Team Details first (including Team ID Number).");
    return false;
  }

  if (!/^\d{10}$/.test(leaderPhone)) {
    alert("Please enter a valid 10-digit numeric mobile number for the Team Leader.");
    return false;
  }

  // Parse Team Members (Max 3)
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

  if (members.length > 3) {
    alert("⚠️ A maximum of 3 team members are allowed. Please remove excess members before submitting.");
    return false;
  }

  const finalMembers = members.slice(0, 3);

  // Local Storage Save
  const currentTeams = getTeamsData();
  const newTeam = {
    id: `team-${Date.now()}`,
    teamName,
    leaderName,
    leaderEmail,
    leaderId,
    leaderPhone,
    members: finalMembers,
    projectTitle,
    projectType,
    mainIdea,
    techStack,
    assignedJudge: 'Unassigned'
  };

  const updatedTeams = currentTeams.filter(t => t.teamName.toLowerCase() !== teamName.toLowerCase());
  updatedTeams.push(newTeam);
  saveTeamsData(updatedTeams);

  // Supabase Database Insert / Update (if connected)
  if (supabaseClient) {
    try {
      const insertPayload = {
        team_name: teamName,
        team_id_no: teamIdNo,
        leader_name: leaderName,
        leader_email: leaderEmail,
        leader_id: leaderId,
        leader_phone: leaderPhone,
        project_title: projectTitle,
        main_idea: `[Type: ${projectType.toUpperCase()} | Branch: ${leaderBranch} | Team ID: ${teamIdNo}]\n\n${mainIdea}`,
        tech_stack: techStack
      };

      if (window.existingTeamId) {
        // Update existing registration
        const { error: updateErr } = await supabaseClient
          .from('teams')
          .update(insertPayload)
          .eq('id', window.existingTeamId);

        if (!updateErr && finalMembers.length > 0) {
          await supabaseClient.from('team_members').delete().eq('team_id', window.existingTeamId);
          const memberRecords = finalMembers.map(m => ({
            team_id: window.existingTeamId,
            member_name: m.branch ? `${m.name} (${m.branch})` : m.name,
            member_email: m.email,
            member_id: m.idNo,
            member_phone: m.phone
          }));
          await supabaseClient.from('team_members').insert(memberRecords);
        }
      } else {
        // Insert new registration
        const { data: teamRes, error: teamErr } = await supabaseClient
          .from('teams')
          .insert([insertPayload])
          .select()
          .single();

        if (!teamErr && teamRes) {
          window.existingTeamId = teamRes.id;
          if (finalMembers.length > 0) {
            const memberRecords = finalMembers.map(m => ({
              team_id: teamRes.id,
              member_name: m.branch ? `${m.name} (${m.branch})` : m.name,
              member_email: m.email,
              member_id: m.idNo,
              member_phone: m.phone
            }));
            await supabaseClient.from('team_members').insert(memberRecords);
          }
        }
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
  sessionStorage.clear();
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
        let q = supabaseClient.from('teams').update({ assigned_judge: judgeEmail });
        if (team.id && team.id.length > 20) {
          q = q.eq('id', team.id);
        } else {
          q = q.ilike('team_name', team.teamName.trim());
        }
        const { error } = await q;
        if (error) console.error("Supabase assignment error:", error);
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
      // Fetch team non-personal metadata
      const { data: teamData } = await supabaseClient
        .from('teams')
        .select('team_name, team_id_no, project_title, main_idea')
        .ilike('team_name', teamName)
        .maybeSingle();

      if (teamData) {
        let parsedTeamId = teamData.team_id_no && teamData.team_id_no.trim() !== 'N/A' ? teamData.team_id_no.trim() : '';
        if (!parsedTeamId && teamData.main_idea && teamData.main_idea.includes('Team ID:')) {
          const match = teamData.main_idea.match(/Team ID:\s*([^\]\n|]+)/i);
          if (match && match[1]) parsedTeamId = match[1].trim();
        }

        const teamSubEl = document.getElementById('evaluating-team-sub');
        if (teamSubEl) {
          teamSubEl.textContent = `🆔 Team ID: ${parsedTeamId || 'N/A'} | 💡 Project: ${teamData.project_title || 'N/A'}`;
        }
      }

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
        evaluations = data.map(d => {
          let c5Val = 0;
          let cleanRemarks = d.remarks || '';
          if (cleanRemarks) {
            const c5Match = cleanRemarks.match(/\[C5(?:\s+Implementation)?:\s*(\d+)(?:\/10)?\]/i);
            if (c5Match) {
              c5Val = parseInt(c5Match[1], 10);
              cleanRemarks = cleanRemarks.replace(/\[C5(?:\s+Implementation)?:\s*\d+(?:\/10)?\]\s*/gi, '').trim();
            }
          }
          const c1Val = Number(d.c1_innovation ?? d.c1) || 0;
          const c2Val = Number(d.c2_execution ?? d.c2) || 0;
          const c3Val = Number(d.c3_feasibility ?? d.c3) || 0;
          const c4Val = Number(d.c4_presentation ?? d.c4) || 0;
          if (c5Val === 0 && d.total_score !== undefined && d.total_score !== null) {
            const diff = Number(d.total_score) - (c1Val + c2Val + c3Val + c4Val);
            if (diff >= 0 && diff <= 10) c5Val = diff;
          }
          return {
            teamName: d.team_name,
            judgeEmail: d.judge_email,
            c1: c1Val,
            c2: c2Val,
            c3: c3Val,
            c4: c4Val,
            c5: c5Val,
            totalScore: d.total_score,
            remarks: cleanRemarks,
            timestamp: new Date(d.updated_at || Date.now()).toLocaleString()
          };
        });
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
    const filter = window.currentAdminTeamsFilter || 'unassigned';
    const filteredTeams = teams.filter(t => {
      const isAssigned = t.assignedJudge && t.assignedJudge !== 'Unassigned';
      if (filter === 'unassigned') return !isAssigned;
      if (filter === 'assigned') return isAssigned;
      return true;
    });

    if (filteredTeams.length === 0 && filter === 'unassigned') {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align:center; padding: 20px; color:#00ffcc; font-family:'Press Start 2P', monospace; font-size:0.7rem;">🎉 ALL TEAMS HAVE BEEN ASSIGNED TO JUDGES!</td>`;
      teamsTbody.appendChild(tr);
    } else {
      filteredTeams.forEach(t => {
        const tr = document.createElement('tr');
        const isAssigned = t.assignedJudge && t.assignedJudge !== 'Unassigned';
        const parsedTeamId = t.teamIdNo || t.teamId || 'N/A';
        tr.innerHTML = `
          <td style="text-align:center;">
            <span style="display:inline-block; background:rgba(253,255,0,0.15); color:#fdff00; border:1.5px solid #fdff00; border-radius:6px; padding:3px 6px; font-family:'Press Start 2P', monospace; font-size:0.65rem; font-weight:bold;">
              ${parsedTeamId}
            </span>
          </td>
          <td class="criterion-name">${t.teamName}</td>
          <td>${t.leaderName} (${t.leaderId})<br><small style="color:var(--text-muted);">${t.leaderEmail}</small></td>
          <td>${t.projectTitle}<br><small style="color:var(--text-muted);">${t.techStack}</small></td>
          <td>
            ${isAssigned ? `<span className="status-pill status-completed" style="background:rgba(0,255,204,0.15); color:#00ffcc; padding:4px 8px; border-radius:4px; font-size:0.7rem;">✅ ASSIGNED TO ${t.assignedJudge}</span><br><br>` : `<span className="status-pill status-pending" style="background:rgba(255,0,85,0.15); color:#ff0055; padding:4px 8px; border-radius:4px; font-size:0.7rem;">⚠️ UNASSIGNED</span><br><br>`}
            <div style="font-size:0.6rem; color:#00ffcc; margin-bottom:4px; font-family:'Press Start 2P', monospace;">ID: ${parsedTeamId}</div>
            <select id="judge-select-${t.id}" class="retro-select admin-judge-select">
              <option value="Unassigned" ${!t.assignedJudge || t.assignedJudge === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
              <option value="JM001" ${t.assignedJudge === 'JM001' ? 'selected' : ''}>JM001</option>
              <option value="JM002" ${t.assignedJudge === 'JM002' ? 'selected' : ''}>JM002</option>
              <option value="JM003" ${t.assignedJudge === 'JM003' ? 'selected' : ''}>JM003</option>
              <option value="JM004" ${t.assignedJudge === 'JM004' ? 'selected' : ''}>JM004</option>
              <option value="JM005" ${t.assignedJudge === 'JM005' ? 'selected' : ''}>JM005</option>
              <option value="JM006" ${t.assignedJudge === 'JM006' ? 'selected' : ''}>JM006</option>
              <option value="JM007" ${t.assignedJudge === 'JM007' ? 'selected' : ''}>JM007</option>
              <option value="JM008" ${t.assignedJudge === 'JM008' ? 'selected' : ''}>JM008</option>
              <option value="JM009" ${t.assignedJudge === 'JM009' ? 'selected' : ''}>JM009</option>
              <option value="JM010" ${t.assignedJudge === 'JM010' ? 'selected' : ''}>JM010</option>
              <option value="JM011" ${t.assignedJudge === 'JM011' ? 'selected' : ''}>JM011</option>
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
  }

  // 2. Render Live Leaderboard & Evaluation Scores Table (Ranked by Highest Score out of 50)
  if (scoresTbody) {
    scoresTbody.innerHTML = '';

    const leaderboardData = teams.map(t => {
      const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
      let isScored = false;
      let score = 0;
      let c1 = '-', c2 = '-', c3 = '-', c4 = '-', c5 = '-', remarks = 'Evaluation pending';
      let judge = t.assignedJudge || 'Unassigned';

      if (evalEntry) {
        isScored = true;
        score = Number(evalEntry.totalScore) || 0;
        c1 = evalEntry.c1;
        c2 = evalEntry.c2;
        c3 = evalEntry.c3;
        c4 = evalEntry.c4;
        c5 = evalEntry.c5;
        remarks = evalEntry.remarks || 'Scored';
        if (evalEntry.judgeEmail) judge = evalEntry.judgeEmail;
      }

      let projectType = (t.project_type || t.projectType || '').trim();
      if (!projectType && (t.main_idea || t.rawMainIdea)) {
        const text = t.main_idea || t.rawMainIdea || '';
        const match = text.match(/\[(?:.*?\b)?Type:\s*([^|\]\n]+)/i) || text.match(/\bType:\s*([^|\]\n,]+)/i);
        if (match && match[1]) projectType = match[1].trim();
      }
      if (projectType) {
        const lower = projectType.toLowerCase();
        if (lower === 'software') projectType = 'Software';
        else if (lower === 'hardware') projectType = 'Hardware';
        else if (lower === 'hybrid') projectType = 'Hybrid';
        else projectType = projectType.charAt(0).toUpperCase() + projectType.slice(1);
      } else {
        projectType = 'Hardware';
      }

      return {
        ...t,
        projectType,
        isScored,
        score,
        c1, c2, c3, c4, c5,
        remarks,
        judge
      };
    }).sort((a, b) => {
      if (a.isScored && b.isScored) return b.score - a.score;
      if (a.isScored && !b.isScored) return -1;
      if (!a.isScored && b.isScored) return 1;
      return 0;
    });

    leaderboardData.forEach((item, index) => {
      let rankBadge = '-';
      let rowBg = '';

      if (item.isScored) {
        if (index === 0) {
          rankBadge = '🥇 1ST';
          rowBg = 'background: rgba(253, 255, 0, 0.08);';
        } else if (index === 1) {
          rankBadge = '🥈 2ND';
          rowBg = 'background: rgba(224, 224, 224, 0.06);';
        } else if (index === 2) {
          rankBadge = '🥉 3RD';
          rowBg = 'background: rgba(205, 127, 50, 0.06);';
        } else {
          rankBadge = `#${index + 1}`;
        }
      }

      const pType = (item.projectType || 'Hardware').toLowerCase();
      let typeBadge = '';
      if (pType === 'software') {
        typeBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.56rem; font-family:'Press Start 2P', monospace; color:#00ffcc; background:rgba(0,255,204,0.12); border:1px solid #00ffcc; padding:3px 6px; border-radius:4px; white-space:nowrap; font-weight:bold;"><span>💻</span><span>SOFTWARE</span></span>`;
      } else if (pType === 'hybrid') {
        typeBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.56rem; font-family:'Press Start 2P', monospace; color:#ff66cc; background:rgba(255,102,204,0.12); border:1px solid #ff66cc; padding:3px 6px; border-radius:4px; white-space:nowrap; font-weight:bold;"><span>⚡</span><span>HYBRID</span></span>`;
      } else {
        typeBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.56rem; font-family:'Press Start 2P', monospace; color:#ffb852; background:rgba(255,184,82,0.12); border:1px solid #ffb852; padding:3px 6px; border-radius:4px; white-space:nowrap; font-weight:bold;"><span>⚙️</span><span>HARDWARE</span></span>`;
      }

      const totalMembersCount = item.totalTeamSize || (1 + (item.members?.length || 0));
      const hasMembers = item.members && item.members.length > 0;
      let membersHtml = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div>
            <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(0,255,204,0.15); color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; padding:3px 6px; font-family:'Press Start 2P', monospace; font-size:0.55rem; font-weight:bold;">
              👥 ${totalMembersCount} ${totalMembersCount === 1 ? 'MEMBER' : 'MEMBERS'}
            </span>
          </div>
          <div style="font-size:0.72rem; color:#fff; line-height:1.3;">
            <span style="color:#fdff00; font-weight:bold;">👑 ${item.leaderName || 'Leader'}</span>
            ${item.leaderBranch ? `<span style="color:#888; font-size:0.65rem;"> (${item.leaderBranch})</span>` : ''}
          </div>
          ${hasMembers ? `
            <div style="font-size:0.68rem; color:#aaa; line-height:1.3;">
              <span style="color:#00ffcc;">+${item.members.length} ${item.members.length === 1 ? 'member' : 'members'}:</span> ${item.members.map(m => m.name).filter(Boolean).join(', ')}
            </div>
          ` : `
            <div style="font-size:0.62rem; color:#666; font-style:italic;">• Solo (Leader Only)</div>
          `}
        </div>
      `;

      const tr = document.createElement('tr');
      if (rowBg) tr.setAttribute('style', rowBg);
      const parsedTeamId = item.teamIdNo || item.teamId || 'N/A';
      tr.innerHTML = `
        <td style="text-align:center; font-weight:bold; font-size:0.85rem; color:${index === 0 && item.isScored ? '#fdff00' : index === 1 && item.isScored ? '#e0e0e0' : index === 2 && item.isScored ? '#cd7f32' : '#fff'};">${rankBadge}</td>
        <td style="text-align:center;"><span style="display:inline-block; background:rgba(253,255,0,0.15); color:#fdff00; border:1.5px solid #fdff00; border-radius:6px; padding:3px 6px; font-family:'Press Start 2P', monospace; font-size:0.62rem; font-weight:bold;">${parsedTeamId}</span></td>
        <td class="criterion-name">${item.teamName} ${index === 0 && item.isScored ? '👑' : ''}</td>
        <td>${membersHtml}</td>
        <td style="text-align:center;">${typeBadge}</td>
        <td>${item.judge}</td>
        <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${item.c1}</td>
        <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${item.c2}</td>
        <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${item.c3}</td>
        <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${item.c4}</td>
        <td style="text-align:center; font-weight:700; color:var(--inky-cyan);">${item.c5}</td>
        <td style="text-align:center; font-weight:800; font-size:1.1rem; color:${item.isScored ? '#fdff00' : 'var(--text-muted)'};">${item.isScored ? `${item.score} / 50` : '- / 50'}</td>
        <td>${item.isScored ? '<span class="status-pill status-completed">SCORED</span>' : '<span class="status-pill status-pending">PENDING</span>'}</td>
      `;
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
    "Team ID",
    "Team Name",
    "Project Type",
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
    }

    let pType = (t.project_type || t.projectType || '').trim();
    if (!pType && (t.main_idea || t.rawMainIdea)) {
      const text = t.main_idea || t.rawMainIdea || '';
      const match = text.match(/\[(?:.*?\b)?Type:\s*([^|\]\n]+)/i) || text.match(/\bType:\s*([^|\]\n,]+)/i);
      if (match && match[1]) pType = match[1].trim();
    }
    if (pType) {
      const lower = pType.toLowerCase();
      if (lower === 'software') pType = 'Software';
      else if (lower === 'hardware') pType = 'Hardware';
      else if (lower === 'hybrid') pType = 'Hybrid';
      else pType = pType.charAt(0).toUpperCase() + pType.slice(1);
    } else {
      pType = 'Hardware';
    }

    csvRows.push([
      `"${t.teamIdNo || t.teamId || 'N/A'}"`,
      `"${t.teamName || ''}"`,
      `"${pType}"`,
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

// Generate & Download Special Leaderboard Report: Top 30 Software + Top 15 Hybrid + All Hardware
function exportSpecialLeaderboardExcel() {
  const teams = getTeamsData();
  let evaluations = [];
  try {
    evaluations = JSON.parse(localStorage.getItem('teamEvaluations') || '[]');
  } catch (e) {
    evaluations = [];
  }

  // Map and rank teams
  const scoredTeams = teams.map(t => {
    const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
    let isScored = false;
    let score = 0;
    let c1 = "-", c2 = "-", c3 = "-", c4 = "-", c5 = "-", remarks = "Pending";
    let judge = t.assignedJudge || 'Unassigned';

    if (evalEntry) {
      isScored = true;
      score = Number(evalEntry.totalScore) || 0;
      c1 = evalEntry.c1;
      c2 = evalEntry.c2;
      c3 = evalEntry.c3;
      c4 = evalEntry.c4;
      c5 = evalEntry.c5 || 0;
      remarks = evalEntry.remarks || "Scored";
      if (evalEntry.judgeEmail) judge = evalEntry.judgeEmail;
    }

    let pType = 'Hardware';
    if (t.projectType) {
      const lower = t.projectType.toLowerCase();
      if (lower === 'software') pType = 'Software';
      else if (lower === 'hybrid') pType = 'Hybrid';
      else if (lower === 'hardware') pType = 'Hardware';
      else pType = pType.charAt(0).toUpperCase() + pType.slice(1);
    }

    return {
      ...t,
      projectType: pType,
      isScored,
      score,
      c1, c2, c3, c4, c5,
      remarks,
      judge,
      totalTeamSize: 1 + (t.members ? t.members.length : 0)
    };
  }).sort((a, b) => {
    if (a.isScored && b.isScored) return b.score - a.score;
    if (a.isScored && !b.isScored) return -1;
    if (!a.isScored && b.isScored) return 1;
    return (a.teamIdNo || '').localeCompare(b.teamIdNo || '');
  });

  const soft = scoredTeams.filter(t => t.projectType.toLowerCase() === 'software').slice(0, 30);
  const hyb = scoredTeams.filter(t => t.projectType.toLowerCase() === 'hybrid').slice(0, 15);
  const hard = scoredTeams.filter(t => t.projectType.toLowerCase() === 'hardware');

  const combined = [
    ...soft.map((t, i) => ({ ...t, cat: 'Top 30 Software', catRank: i + 1 })),
    ...hyb.map((t, i) => ({ ...t, cat: 'Top 15 Hybrid', catRank: i + 1 })),
    ...hard.map((t, i) => ({ ...t, cat: 'All Hardware', catRank: i + 1 }))
  ];

  let csvRows = [];
  csvRows.push(["MECIA HACKS 3.0 — SPECIAL LEADERBOARD QUALIFIERS REPORT"]);
  csvRows.push(["SELECTION: TOP 30 SOFTWARE + TOP 15 HYBRID + ALL HARDWARE TEAMS"]);
  csvRows.push([`Generated: ${new Date().toLocaleString()}`, `Total Selected Teams: ${combined.length}`, `Total Participants: ${combined.reduce((s, t) => s + t.totalTeamSize, 0)}`]);
  csvRows.push([]);
  csvRows.push([
    "S.No",
    "Category",
    "Track Rank",
    "Team ID",
    "Team Name",
    "Project Title",
    "Track",
    "Score (50)",
    "Arch (10)",
    "Scope (10)",
    "Avail (10)",
    "Timeline (10)",
    "Impl (10)",
    "Status",
    "Total Members",
    "Leader Name",
    "Leader Phone",
    "Leader Email",
    "Assigned Judge",
    "All Members Roster"
  ]);

  combined.forEach((t, i) => {
    const allMembersStr = [
      `Leader: ${t.leaderName || ''} (${t.leaderId || ''}) Ph: ${t.leaderPhone || ''}`,
      ...(t.members || []).map((m, idx) => `M${idx+1}: ${m.name || ''} (${m.idNo || ''}) Ph: ${m.phone || ''}`)
    ].join(' | ');

    csvRows.push([
      i + 1,
      `"${t.cat}"`,
      `"#${t.catRank}"`,
      `"${t.teamIdNo || t.teamId || 'N/A'}"`,
      `"${(t.teamName || '').replace(/"/g, '""')}"`,
      `"${(t.projectTitle || '').replace(/"/g, '""')}"`,
      `"${t.projectType}"`,
      t.isScored ? t.score : 'Pending',
      t.c1,
      t.c2,
      t.c3,
      t.c4,
      t.c5,
      t.isScored ? 'SCORED' : 'PENDING',
      t.totalTeamSize,
      `"${(t.leaderName || '').replace(/"/g, '""')}"`,
      `"${t.leaderPhone || ''}"`,
      `"${t.leaderEmail || ''}"`,
      `"${t.judge || 'Unassigned'}"`,
      `"${allMembersStr.replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = csvRows.map(row => row.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_Top30Soft_Top15Hyb_AllHard_Leaderboard_${Date.now()}.csv`);
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
        evalBtn.innerHTML = '🔒 VIEW MARKS (LOCKED)';
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
      loadExistingRegistration(savedId);
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
      loggedJudgeEl.textContent = savedJudgeEmail.toUpperCase();
      const profile = getJudgeProfile(savedJudgeEmail);
      const judgeNamesEl = document.getElementById('logged-judge-names');
      if (judgeNamesEl && profile) {
        judgeNamesEl.innerHTML = `<div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">${profile.names.map(n => `<div>▸ ${n}</div>`).join('')}</div>`;
      }
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
  const leaderInputs = ['team-name', 'team-id-no', 'leader-name', 'leader-email', 'leader-id', 'leader-phone'];
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
