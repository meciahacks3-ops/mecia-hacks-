'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { JUDGE_PROFILES } from '@/lib/judgeProfiles';

const initialDemoTeams = [];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState('admin_user');
  const [activeTab, setActiveTab] = useState('teams-tab'); // 'teams-tab', 'scores-tab', 'whitelist-tab'
  const [teamsFilter, setTeamsFilter] = useState('unassigned'); // 'unassigned', 'assigned', 'all'
  const [teams, setTeams] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [judgeSelections, setJudgeSelections] = useState({});
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [newGmail, setNewGmail] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingEmail, setEditingEmail] = useState('');

  useEffect(() => {
    const savedAdminUser = sessionStorage.getItem('adminUser');
    if (savedAdminUser) setAdminUser(savedAdminUser);
    fetchData();
    fetchAllowedUsers();

    const pollInterval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const fetchAllowedUsers = async () => {
    try {
      const { data } = await supabase.from('allowed_users').select('*').order('created_at', { ascending: false });
      if (data) setAllowedUsers(data);
    } catch (e) {
      console.warn("Allowed users fetch warning:", e);
    }
  };

  const handleAddAllowedGmail = async (e) => {
    e.preventDefault();
    if (!newGmail.trim()) return;

    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .insert([{ email: newGmail.trim().toLowerCase(), added_by: adminUser }])
        .select()
        .single();

      if (error) {
        alert("Database Notice: " + error.message);
      } else if (data) {
        setAllowedUsers([data, ...allowedUsers]);
        setNewGmail('');
        alert(`Successfully authorized ${data.email} for Google OAuth!`);
      }
    } catch (err) {
      console.error("Add allowed email error:", err);
    }
  };

  const startEditGmail = (u) => {
    setEditingUserId(u.id);
    setEditingEmail(u.email);
  };

  const handleUpdateAllowedGmail = async (id) => {
    if (!editingEmail.trim()) return;

    try {
      const { error } = await supabase
        .from('allowed_users')
        .update({ email: editingEmail.trim().toLowerCase() })
        .eq('id', id);

      if (error) {
        alert("Database Notice: " + error.message);
      } else {
        setAllowedUsers(allowedUsers.map(u => u.id === id ? { ...u, email: editingEmail.trim().toLowerCase() } : u));
        setEditingUserId(null);
        setEditingEmail('');
        alert("Successfully updated authorized email!");
      }
    } catch (err) {
      console.error("Update allowed email error:", err);
    }
  };

  const handleRemoveAllowedGmail = async (id, email) => {
    if (!confirm(`Are you sure you want to revoke access for ${email}?`)) return;

    try {
      await supabase.from('allowed_users').delete().eq('id', id);
      setAllowedUsers(allowedUsers.filter(u => u.id !== id));
    } catch (err) {
      console.error("Remove allowed email error:", err);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch Teams along with all team members
      const { data: supaTeams } = await supabase.from('teams').select('*, team_members(*)');
      if (supaTeams && supaTeams.length > 0) {
        const formattedTeams = supaTeams.map(st => {
          let parsedTeamId = st.team_id_no && st.team_id_no.trim() !== 'N/A' ? st.team_id_no.trim() : 'N/A';
          if (parsedTeamId === 'N/A' && st.main_idea && st.main_idea.includes('Team ID:')) {
            const match = st.main_idea.match(/Team ID:\s*([^\]\n|]+)/i);
            if (match && match[1]) parsedTeamId = match[1].trim();
          }

          let leaderBranch = '';
          if (st.main_idea && st.main_idea.includes('Branch:')) {
            const bMatch = st.main_idea.match(/Branch:\s*([^|\]]+)/i);
            if (bMatch && bMatch[1]) leaderBranch = bMatch[1].trim();
          }

          const parsedMembers = (st.team_members || []).map(m => {
            let mName = m.member_name || '';
            let mBranch = '';
            const mMatch = mName.match(/^(.*?)\s*\((.*?)\)$/);
            if (mMatch) {
              mName = mMatch[1].trim();
              mBranch = mMatch[2].trim();
            }
            return {
              id: m.id,
              name: mName,
              email: m.member_email || '',
              idNo: m.member_id || '',
              phone: m.member_phone || '',
              branch: mBranch
            };
          });

          return {
            id: st.id,
            teamName: st.team_name,
            teamIdNo: parsedTeamId,
            leaderName: st.leader_name,
            leaderEmail: st.leader_email,
            leaderId: st.leader_id,
            leaderPhone: st.leader_phone,
            leaderBranch: leaderBranch,
            projectTitle: st.project_title,
            techStack: st.tech_stack,
            assignedJudge: st.assigned_judge || 'Unassigned',
            members: parsedMembers,
            totalTeamSize: 1 + parsedMembers.length
          };
        });
        setTeams(formattedTeams);

        setJudgeSelections(prev => {
          const next = { ...prev };
          formattedTeams.forEach(t => {
            if (next[t.id] === undefined) {
              next[t.id] = t.assignedJudge;
            }
          });
          return next;
        });
      } else {
        setTeams([]);
        setJudgeSelections({});
      }

      // 2. Fetch Evaluations
      const { data: supaEvals } = await supabase.from('evaluations').select('*');
      if (supaEvals && supaEvals.length > 0) {
        const formattedEvals = supaEvals.map(se => ({
          teamName: se.team_name,
          judgeEmail: se.judge_email,
          c1: se.c1_innovation ?? 0,
          c2: se.c2_execution ?? 0,
          c3: se.c3_feasibility ?? 0,
          c4: se.c4_presentation ?? 0,
          c5: se.c5_details ?? 0,
          totalScore: se.total_score,
          remarks: se.remarks
        }));
        setEvaluations(formattedEvals);
      } else {
        setEvaluations([]);
      }
    } catch (e) {
      console.warn("Supabase admin fetch error:", e);
    }
  };

  const [customJudgeInputs, setCustomJudgeInputs] = useState({});
  const [assigningTeamId, setAssigningTeamId] = useState(null);

  const handleAssignJudge = async (teamId, teamName) => {
    const currentTeam = teams.find(t => t.id === teamId);
    const selectedVal = judgeSelections[teamId] !== undefined ? judgeSelections[teamId] : (currentTeam?.assignedJudge || 'Unassigned');
    let finalJudge = selectedVal;

    if (selectedVal === 'CUSTOM') {
      finalJudge = (customJudgeInputs[teamId] || '').trim();
      if (!finalJudge) {
        alert("Please enter a valid Judge Email or Panel ID!");
        return;
      }
    }

    setAssigningTeamId(teamId);

    try {
      let updateQuery = supabase.from('teams').update({ assigned_judge: finalJudge });
      if (teamId && teamId.length > 20) {
        updateQuery = updateQuery.eq('id', teamId);
      } else {
        updateQuery = updateQuery.ilike('team_name', teamName.trim());
      }

      const { error } = await updateQuery;
      if (error) {
        console.error("Judge assignment error:", error);
        alert("Error saving assignment to Supabase: " + error.message);
        setAssigningTeamId(null);
        return;
      }

      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, assignedJudge: finalJudge } : t));
      setJudgeSelections(prev => ({ ...prev, [teamId]: finalJudge }));
      alert(`✅ Successfully assigned ${finalJudge} to team "${teamName}"!`);
    } catch (err) {
      console.error("Judge assignment error:", err);
      alert(`Assigned ${finalJudge} to team "${teamName}"!`);
    } finally {
      setAssigningTeamId(null);
    }
  };

  // 1. Export Teams Master CSV (with Leader + Member 1, 2, 3 in separate columns)
  const exportCSV = () => {
    let csvRows = [];
    csvRows.push(["Mecia Hack 3.0 - Complete Admin Master Report & Evaluation Sheet (Round 2)"]);
    csvRows.push(["Report Date", new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push([
      "Team ID",
      "Team Name",
      "Total Team Size",
      "Leader Name",
      "Leader Email",
      "Leader Enrollment ID",
      "Leader Phone",
      "Leader Branch",
      "Member 1 Name",
      "Member 1 Email",
      "Member 1 Enrollment ID",
      "Member 1 Phone",
      "Member 1 Branch",
      "Member 2 Name",
      "Member 2 Email",
      "Member 2 Enrollment ID",
      "Member 2 Phone",
      "Member 2 Branch",
      "Member 3 Name",
      "Member 3 Email",
      "Member 3 Enrollment ID",
      "Member 3 Phone",
      "Member 3 Branch",
      "All Members Roster Summary",
      "Project Title",
      "Tech Stack",
      "Assigned Judge",
      "Evaluation Status",
      "System Architecture (10)",
      "Prototype Scope (10)",
      "Component Availability (10)",
      "Execution Feasibility (10)",
      "Implementation Details (10)",
      "Total Score (50)",
      "Judge Remarks"
    ]);

    teams.forEach(t => {
      const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
      let status = "PENDING";
      let c1 = "-", c2 = "-", c3 = "-", c4 = "-", c5 = "-", total = "-", remarks = "-";

      if (evalEntry) {
        status = "SCORED";
        c1 = evalEntry.c1;
        c2 = evalEntry.c2;
        c3 = evalEntry.c3;
        c4 = evalEntry.c4;
        c5 = evalEntry.c5;
        total = evalEntry.totalScore;
        remarks = evalEntry.remarks || '';
      }

      const m1 = t.members && t.members[0] ? t.members[0] : null;
      const m2 = t.members && t.members[1] ? t.members[1] : null;
      const m3 = t.members && t.members[2] ? t.members[2] : null;

      const allMembersSummary = [
        `Leader: ${t.leaderName} (${t.leaderId}) [Phone: ${t.leaderPhone}] [Email: ${t.leaderEmail}]`,
        ...(t.members || []).map((m, idx) => `Member ${idx + 1}: ${m.name} (${m.idNo}) [Phone: ${m.phone}] [Email: ${m.email}]${m.branch ? ` [${m.branch}]` : ''}`)
      ].join(' | ');

      csvRows.push([
        `"${t.teamIdNo || 'N/A'}"`,
        `"${t.teamName || ''}"`,
        t.totalTeamSize || (1 + (t.members?.length || 0)),
        `"${t.leaderName || ''}"`,
        `"${t.leaderEmail || ''}"`,
        `"${t.leaderId || ''}"`,
        `"${t.leaderPhone || ''}"`,
        `"${t.leaderBranch || ''}"`,
        `"${m1 ? m1.name : ''}"`,
        `"${m1 ? m1.email : ''}"`,
        `"${m1 ? m1.idNo : ''}"`,
        `"${m1 ? m1.phone : ''}"`,
        `"${m1 ? m1.branch : ''}"`,
        `"${m2 ? m2.name : ''}"`,
        `"${m2 ? m2.email : ''}"`,
        `"${m2 ? m2.idNo : ''}"`,
        `"${m2 ? m2.phone : ''}"`,
        `"${m2 ? m2.branch : ''}"`,
        `"${m3 ? m3.name : ''}"`,
        `"${m3 ? m3.email : ''}"`,
        `"${m3 ? m3.idNo : ''}"`,
        `"${m3 ? m3.phone : ''}"`,
        `"${m3 ? m3.branch : ''}"`,
        `"${allMembersSummary.replace(/"/g, '""')}"`,
        `"${(t.projectTitle || '').replace(/"/g, '""')}"`,
        `"${(t.techStack || '').replace(/"/g, '""')}"`,
        `"${t.assignedJudge || 'Unassigned'}"`,
        `"${status}"`,
        c1,
        c2,
        c3,
        c4,
        c5,
        total,
        `"${(remarks || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_Teams_All_Members_Master_Report_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // 2. Export All Students Directory CSV (1 row per participant: Leader or Member)
  const exportStudentsDirectoryCSV = () => {
    let csvRows = [];
    csvRows.push(["Mecia Hack 3.0 - Complete All Students & Participants Directory"]);
    csvRows.push(["Report Date", new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push([
      "Team ID",
      "Team Name",
      "Participant Role",
      "Student Name",
      "Enrollment No / ID",
      "Email Address",
      "Mobile Phone",
      "Branch / Dept",
      "Project Title",
      "Assigned Judge"
    ]);

    teams.forEach(t => {
      // Leader row
      csvRows.push([
        `"${t.teamIdNo || 'N/A'}"`,
        `"${t.teamName || ''}"`,
        `"👑 Team Leader"`,
        `"${t.leaderName || ''}"`,
        `"${t.leaderId || ''}"`,
        `"${t.leaderEmail || ''}"`,
        `"${t.leaderPhone || ''}"`,
        `"${t.leaderBranch || ''}"`,
        `"${(t.projectTitle || '').replace(/"/g, '""')}"`,
        `"${t.assignedJudge || 'Unassigned'}"`
      ]);

      // Members rows
      (t.members || []).forEach((m, idx) => {
        csvRows.push([
          `"${t.teamIdNo || 'N/A'}"`,
          `"${t.teamName || ''}"`,
          `"👤 Member #${idx + 1}"`,
          `"${m.name || ''}"`,
          `"${m.idNo || ''}"`,
          `"${m.email || ''}"`,
          `"${m.phone || ''}"`,
          `"${m.branch || ''}"`,
          `"${(t.projectTitle || '').replace(/"/g, '""')}"`,
          `"${t.assignedJudge || 'Unassigned'}"`
        ]);
      });
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_All_Students_Directory_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const handleLogout = async () => {
    sessionStorage.clear();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out warning:", e);
    }
    router.push('/');
  };

  return (
    <>
      <div className="scanlines"></div>

      <div className="admin-container">
        {/* Navigation Header */}
        <div className="nav-header" style={{ justifyContent: 'flex-end', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div className="student-hud-badge">
            <span className="ghost pink-ghost" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> ADMIN USER: <span>{adminUser}</span>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            🚪 LOG OUT
          </button>
        </div>

        {/* Dashboard Title Header */}
        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge admin-badge">STAGE 3: ADMIN CONTROL PANEL</span>
          </div>
          <h2>HACKATHON MASTER CONTROL</h2>
          <p>Assign teams to judges, view live evaluation scores, and export full reports.</p>
        </div>

        {/* Admin Top Controls Bar */}
        <div className="judge-nav-tabs admin-controls-bar">
          <button
            type="button"
            className={`judge-nav-btn ${activeTab === 'teams-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams-tab')}
          >
            👥 TEAMS & JUDGES
          </button>
          <button
            type="button"
            className={`judge-nav-btn eval-highlight ${activeTab === 'scores-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('scores-tab')}
          >
            ⭐ LEADERBOARD
          </button>
          <button
            type="button"
            className={`judge-nav-btn ${activeTab === 'whitelist-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('whitelist-tab')}
          >
            🔐 OAUTH WHITELIST ({allowedUsers.length})
          </button>
          <button type="button" className="submit-btn excel-btn admin-excel-btn" onClick={exportCSV} title="Export spreadsheet with all teams and all members details">
            📊 MASTER CSV (ALL MEMBERS)
          </button>
          <button type="button" className="submit-btn" style={{ background: '#2121ff', border: '2px solid #2121ff', color: '#fff', padding: '10px 16px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', borderRadius: '8px', cursor: 'pointer' }} onClick={exportStudentsDirectoryCSV} title="Export individual participant directory">
            👥 STUDENTS DIRECTORY CSV
          </button>
        </div>

        {/* TAB 1: TEAMS & JUDGE ASSIGNMENTS */}
        {activeTab === 'teams-tab' && (() => {
          const unassignedTeams = teams.filter(t => !t.assignedJudge || t.assignedJudge === 'Unassigned');
          const assignedTeams = teams.filter(t => t.assignedJudge && t.assignedJudge !== 'Unassigned');
          const displayedTeams = teamsFilter === 'unassigned' 
            ? unassignedTeams 
            : teamsFilter === 'assigned' 
            ? assignedTeams 
            : teams;

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                  <h3 className="section-title" style={{ margin: 0 }}><span className="pacman-bullet"></span> REGISTERED TEAMS & JUDGE ASSIGNMENTS</h3>
                  
                  {/* Sub-filter tabs */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTeamsFilter('unassigned')}
                      style={{
                        background: teamsFilter === 'unassigned' ? '#ff0055' : 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        border: '1px solid ' + (teamsFilter === 'unassigned' ? '#ff0055' : '#444'),
                        borderRadius: '6px',
                        padding: '8px 14px',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.6rem',
                        cursor: 'pointer'
                      }}
                    >
                      ⚠️ UNASSIGNED ({unassignedTeams.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamsFilter('assigned')}
                      style={{
                        background: teamsFilter === 'assigned' ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                        color: teamsFilter === 'assigned' ? '#000' : '#fff',
                        border: '1px solid ' + (teamsFilter === 'assigned' ? '#00ffcc' : '#444'),
                        borderRadius: '6px',
                        padding: '8px 14px',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.6rem',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ ASSIGNED ({assignedTeams.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamsFilter('all')}
                      style={{
                        background: teamsFilter === 'all' ? '#fdff00' : 'rgba(0,0,0,0.6)',
                        color: teamsFilter === 'all' ? '#000' : '#fff',
                        border: '1px solid ' + (teamsFilter === 'all' ? '#fdff00' : '#444'),
                        borderRadius: '6px',
                        padding: '8px 14px',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.6rem',
                        cursor: 'pointer'
                      }}
                    >
                      📋 ALL TEAMS ({teams.length})
                    </button>
                  </div>
                </div>

                {teamsFilter === 'unassigned' && unassignedTeams.length === 0 ? (
                  <div style={{
                    background: 'rgba(0, 255, 204, 0.1)',
                    border: '2px solid #00ffcc',
                    borderRadius: '10px',
                    padding: '24px',
                    textAlign: 'center',
                    color: '#00ffcc',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.75rem',
                    lineHeight: '1.8'
                  }}>
                    🎉 ALL TEAMS HAVE BEEN ASSIGNED TO JUDGES!
                    <br />
                    <span style={{ fontSize: '0.65rem', color: '#aaa' }}>Click "✅ ASSIGNED" above to view or modify judge assignments.</span>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="eval-table admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '10%', textAlign: 'center' }}>Team ID</th>
                          <th style={{ width: '16%' }}>Team Name</th>
                          <th style={{ width: '28%' }}>Team Leader & Members</th>
                          <th style={{ width: '16%' }}>Project Title</th>
                          <th style={{ width: '10%' }}>Status</th>
                          <th style={{ width: '14%' }}>Assign Judge Panel</th>
                          <th style={{ width: '6%', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTeams.map(t => {
                          const judgeProfilesList = Object.values(JUDGE_PROFILES);
                          const validJudgeIds = judgeProfilesList.map(p => p.id);

                          const selectedVal = judgeSelections[t.id] !== undefined ? judgeSelections[t.id] : t.assignedJudge;
                          const isCustom = selectedVal === 'CUSTOM' || (!validJudgeIds.includes(selectedVal) && selectedVal !== 'Unassigned');
                          const isAssigned = t.assignedJudge && t.assignedJudge !== 'Unassigned';
                          const isSavingThisTeam = assigningTeamId === t.id;

                          return (
                            <tr key={t.id || t.teamName}>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1.5px solid #fdff00',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontFamily: 'Press Start 2P, monospace',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold',
                                  boxShadow: '0 0 8px rgba(253, 255, 0, 0.25)'
                                }}>
                                  {t.teamIdNo && t.teamIdNo !== 'N/A' ? t.teamIdNo : 'N/A'}
                                </span>
                                <div style={{ fontSize: '0.62rem', color: '#888', marginTop: '6px' }}>
                                  👥 {t.totalTeamSize || (1 + (t.members?.length || 0))} {t.totalTeamSize === 1 ? 'person' : 'members'}
                                </div>
                              </td>
                              <td className="criterion-name">
                                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{t.teamName}</strong>
                              </td>
                              <td>
                                {/* Team Leader details */}
                                <div style={{ background: 'rgba(253, 255, 0, 0.05)', border: '1px solid rgba(253, 255, 0, 0.3)', borderRadius: '6px', padding: '8px 10px', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <span style={{
                                      background: '#fdff00',
                                      color: '#000',
                                      borderRadius: '3px',
                                      padding: '2px 5px',
                                      fontSize: '0.58rem',
                                      fontWeight: 'bold',
                                      fontFamily: 'Press Start 2P, monospace'
                                    }}>👑 LEADER</span>
                                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{t.leaderName}</strong>
                                    {t.leaderBranch && <span style={{ color: '#00ffcc', fontSize: '0.72rem' }}>({t.leaderBranch})</span>}
                                  </div>
                                  <div style={{ color: '#ccc', fontSize: '0.74rem' }}>
                                    🆔 <strong>{t.leaderId}</strong> • 📞 <strong>{t.leaderPhone || 'N/A'}</strong>
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                                    ✉️ {t.leaderEmail}
                                  </div>
                                </div>

                                {/* Additional Team Members */}
                                {t.members && t.members.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {t.members.map((m, mIdx) => (
                                      <div key={m.id || mIdx} style={{ background: 'rgba(0, 255, 204, 0.04)', borderLeft: '3px solid #00ffcc', borderRadius: '4px', padding: '5px 8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                          <span style={{
                                            background: '#00ffcc',
                                            color: '#000',
                                            borderRadius: '3px',
                                            padding: '1px 4px',
                                            fontSize: '0.55rem',
                                            fontWeight: 'bold',
                                            fontFamily: 'Press Start 2P, monospace'
                                          }}>👤 M{mIdx + 1}</span>
                                          <span style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>{m.name}</span>
                                          {m.branch && <span style={{ color: '#888', fontSize: '0.7rem' }}>({m.branch})</span>}
                                        </div>
                                        <div style={{ color: '#bbb', fontSize: '0.72rem' }}>
                                          🆔 <strong>{m.idNo || 'N/A'}</strong> • 📞 <strong>{m.phone || 'N/A'}</strong>
                                        </div>
                                        {m.email && (
                                          <div style={{ color: '#888', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                                            ✉️ {m.email}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#777', fontSize: '0.72rem', fontStyle: 'italic' }}>
                                    • Solo Team (No extra members added)
                                  </span>
                                )}
                              </td>
                              <td>{t.projectTitle}<br /><small style={{ color: 'var(--text-muted)' }}>{t.techStack}</small></td>
                              <td>
                                {isAssigned ? (
                                  <span className="status-pill status-completed" style={{ background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', border: '1px solid #00ffcc' }}>
                                    ✅ ASSIGNED TO {t.assignedJudge}
                                  </span>
                                ) : (
                                  <span className="status-pill status-pending" style={{ background: 'rgba(255, 0, 85, 0.15)', color: '#ff0055', border: '1px solid #ff0055' }}>
                                    ⚠️ UNASSIGNED
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ fontSize: '0.6rem', color: '#00ffcc', marginBottom: '4px', fontFamily: 'Press Start 2P, monospace' }}>
                                  🆔 ASSIGN FOR: {t.teamIdNo || t.teamName}
                                </div>
                                <select
                                  className="retro-select admin-judge-select"
                                  value={isCustom ? 'CUSTOM' : selectedVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setJudgeSelections(prev => ({ ...prev, [t.id]: val }));
                                    if (val === 'CUSTOM' && !customJudgeInputs[t.id]) {
                                      setCustomJudgeInputs(prev => ({ ...prev, [t.id]: t.assignedJudge !== 'Unassigned' ? t.assignedJudge : '' }));
                                    }
                                  }}
                                >
                                  <option value="Unassigned">⚠️ Unassigned</option>
                                  <optgroup label="── Round-2 Judge IDs (JM001 - JM011) ──">
                                    {judgeProfilesList.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.id} • {p.group} ({p.names.slice(0, 2).join(', ')}...)
                                      </option>
                                    ))}
                                  </optgroup>
                                  <option value="CUSTOM">✍️ Enter Custom Judge Email / ID...</option>
                                </select>

                                {isCustom && (
                                  <input
                                    type="text"
                                    placeholder="Type Judge Email or ID..."
                                    value={customJudgeInputs[t.id] !== undefined ? customJudgeInputs[t.id] : (validJudgeIds.includes(t.assignedJudge) ? '' : t.assignedJudge)}
                                    onChange={(e) => setCustomJudgeInputs(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    style={{
                                      marginTop: '6px',
                                      width: '100%',
                                      padding: '6px 10px',
                                      background: '#000',
                                      border: '1.5px solid var(--pacman-yellow)',
                                      borderRadius: '6px',
                                      color: '#fff',
                                      fontSize: '0.8rem'
                                    }}
                                  />
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="eval-btn edit-btn"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', opacity: isSavingThisTeam ? 0.6 : 1 }}
                                  disabled={isSavingThisTeam}
                                  onClick={() => handleAssignJudge(t.id, t.teamName)}
                                >
                                  {isSavingThisTeam ? 'SAVING...' : 'ASSIGN'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 2: MARKSHEET & LIVE SCORES OVERVIEW */}
        {activeTab === 'scores-tab' && (() => {
          // Map team scores and sort descending by totalScore (out of 50)
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

            return {
              ...t,
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

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    <span className="pacman-bullet"></span> LIVE EVALUATION LEADERBOARD (RANKED BY HIGHEST SCORE)
                  </h3>
                  <span className="status-pill status-completed" style={{ background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', border: '1px solid #00ffcc', fontFamily: 'Press Start 2P, monospace', fontSize: '0.58rem', padding: '6px 12px' }}>
                    🔴 LIVE REAL-TIME SYNC (3S POLL)
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="eval-table admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '8%', textAlign: 'center' }}>Rank</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>Team ID</th>
                        <th style={{ width: '18%' }}>Team Name</th>
                        <th style={{ width: '16%' }}>Assigned Judge</th>
                        <th style={{ textAlign: 'center' }}>Arch (10)</th>
                        <th style={{ textAlign: 'center' }}>Scope (10)</th>
                        <th style={{ textAlign: 'center' }}>Avail (10)</th>
                        <th style={{ textAlign: 'center' }}>Timeline (10)</th>
                        <th style={{ textAlign: 'center' }}>Impl (10)</th>
                        <th style={{ textAlign: 'center', width: '12%' }}>Total Score (50)</th>
                        <th style={{ width: '10%' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardData.map((item, index) => {
                        let rankBadge = '-';
                        let rowBg = undefined;

                        if (item.isScored) {
                          if (index === 0) {
                            rankBadge = '🥇 1ST';
                            rowBg = 'rgba(253, 255, 0, 0.08)';
                          } else if (index === 1) {
                            rankBadge = '🥈 2ND';
                            rowBg = 'rgba(224, 224, 224, 0.06)';
                          } else if (index === 2) {
                            rankBadge = '🥉 3RD';
                            rowBg = 'rgba(205, 127, 50, 0.06)';
                          } else {
                            rankBadge = `#${index + 1}`;
                          }
                        }

                        return (
                          <tr key={item.id || item.teamName} style={{ background: rowBg }}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: index === 0 && item.isScored ? '#fdff00' : index === 1 && item.isScored ? '#e0e0e0' : index === 2 && item.isScored ? '#cd7f32' : '#fff' }}>
                              {rankBadge}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                background: 'rgba(253, 255, 0, 0.15)',
                                color: '#fdff00',
                                border: '1.5px solid #fdff00',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                fontFamily: 'Press Start 2P, monospace',
                                fontSize: '0.62rem',
                                fontWeight: 'bold'
                              }}>
                                {item.teamIdNo && item.teamIdNo !== 'N/A' ? item.teamIdNo : 'N/A'}
                              </span>
                            </td>
                            <td className="criterion-name">
                              {item.teamName}
                              {index === 0 && item.isScored && <span style={{ marginLeft: '6px', fontSize: '0.75rem' }}>👑</span>}
                            </td>
                            <td>{item.judge}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c1}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c2}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c3}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c4}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c5}</td>
                            <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.1rem', color: item.isScored ? '#fdff00' : 'var(--text-muted)' }}>
                              {item.isScored ? `${item.score} / 50` : '- / 50'}
                            </td>
                            <td>
                              {item.isScored ? (
                                <span className="status-pill status-completed">SCORED</span>
                              ) : (
                                <span className="status-pill status-pending">PENDING</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 3: ALLOWED GMAILS WHITELIST */}
        {activeTab === 'whitelist-tab' && (
          <div className="admin-tab-content active">
            <div className="form-section">
              <h3 className="section-title"><span className="pacman-bullet"></span> GOOGLE OAUTH AUTHORIZED USERS WHITELIST</h3>

              <form onSubmit={handleAddAllowedGmail} className="whitelist-add-form" style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <input
                  type="email"
                  placeholder="Enter authorized Gmail address (e.g., student@gmail.com)"
                  required
                  value={newGmail}
                  onChange={(e) => setNewGmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    background: '#000',
                    border: '2px solid var(--inky-cyan)',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
                <button type="submit" className="submit-btn" style={{ marginTop: 0, padding: '12px 20px', whiteSpace: 'nowrap' }}>
                  ➕ ADD AUTHORIZED GMAIL
                </button>
              </form>

              <div className="table-responsive">
                <table className="eval-table admin-table">
                  <thead>
                    <tr>
                      <th>Authorized Gmail Address</th>
                      <th>Added By</th>
                      <th>Authorized On</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowedUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                          No email restriction entries found. (Google OAuth is open to all users by default until an email is added).
                        </td>
                      </tr>
                    ) : (
                      allowedUsers.map(u => (
                        <tr key={u.id || u.email}>
                          <td className="criterion-name">
                            {editingUserId === u.id ? (
                              <input
                                type="email"
                                value={editingEmail}
                                onChange={(e) => setEditingEmail(e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  background: '#000',
                                  border: '2px solid var(--pacman-yellow)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontFamily: 'Outfit, sans-serif',
                                  fontSize: '0.9rem',
                                  width: '100%',
                                  maxWidth: '280px'
                                }}
                              />
                            ) : (
                              u.email
                            )}
                          </td>
                          <td>{u.added_by || 'Admin'}</td>
                          <td><small style={{ color: 'var(--text-muted)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}</small></td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {editingUserId === u.id ? (
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="eval-btn"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                  onClick={() => handleUpdateAllowedGmail(u.id)}
                                >
                                  💾 SAVE
                                </button>
                                <button
                                  type="button"
                                  className="logout-btn"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: '#777', color: '#aaa', background: 'transparent' }}
                                  onClick={() => setEditingUserId(null)}
                                >
                                  ❌ CANCEL
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="eval-btn edit-btn"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                  onClick={() => startEditGmail(u)}
                                >
                                  ✏️ EDIT
                                </button>
                                <button
                                  type="button"
                                  className="logout-btn"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                  onClick={() => handleRemoveAllowedGmail(u.id, u.email)}
                                >
                                  🗑️ REMOVE
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="arcade-footer">
          <span>ADMIN CONTROL SYSTEM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>
    </>
  );
}
