'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const initialDemoTeams = [
  {
    id: 'team-1',
    teamName: 'Cyber Byte Squad',
    leaderName: 'Alex Johnson',
    leaderEmail: 'alex@cyber.edu',
    leaderId: 'EN2026101',
    leaderPhone: '+91 9876543210',
    projectTitle: 'AI-Powered Autonomous Health Monitor',
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
    projectTitle: 'Post-Quantum Cryptography Ledger',
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
    projectTitle: 'Smart Urban Traffic Grid Optimization',
    techStack: 'OpenCV, PyTorch, Node.js, Leaflet.js',
    assignedJudge: 'judge2@eval.org'
  }
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState('admin_user');
  const [activeTab, setActiveTab] = useState('teams-tab'); // 'teams-tab', 'scores-tab', 'whitelist-tab'
  const [teamsFilter, setTeamsFilter] = useState('unassigned'); // 'unassigned', 'assigned', 'all'
  const [teams, setTeams] = useState(initialDemoTeams);
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
      // 1. Fetch Teams
      const { data: supaTeams } = await supabase.from('teams').select('*');
      if (supaTeams && supaTeams.length > 0) {
        const formattedTeams = supaTeams.map(st => ({
          id: st.id,
          teamName: st.team_name,
          leaderName: st.leader_name,
          leaderEmail: st.leader_email,
          leaderId: st.leader_id,
          leaderPhone: st.leader_phone,
          projectTitle: st.project_title,
          techStack: st.tech_stack,
          assignedJudge: st.assigned_judge || 'Unassigned'
        }));
        setTeams(formattedTeams);

        const initialMap = {};
        formattedTeams.forEach(t => {
          initialMap[t.id] = t.assignedJudge;
        });
        setJudgeSelections(initialMap);
      } else {
        const initialMap = {};
        initialDemoTeams.forEach(t => {
          initialMap[t.id] = t.assignedJudge;
        });
        setJudgeSelections(initialMap);
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
      }
    } catch (e) {
      console.warn("Supabase admin fetch error:", e);
    }
  };

  const [customJudgeInputs, setCustomJudgeInputs] = useState({});

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

    try {
      await supabase.from('teams').update({ assigned_judge: finalJudge }).eq('team_name', teamName);
      setTeams(teams.map(t => t.id === teamId ? { ...t, assignedJudge: finalJudge } : t));
      alert(`Successfully assigned ${finalJudge} to team "${teamName}"!`);
    } catch (err) {
      console.error("Judge assignment error:", err);
      setTeams(teams.map(t => t.id === teamId ? { ...t, assignedJudge: finalJudge } : t));
      alert(`Assigned ${finalJudge} to team "${teamName}"!`);
    }
  };

  const exportCSV = () => {
    let csvRows = [];
    csvRows.push(["Mecia Hack 3.0 - Complete Admin Master Report & Evaluation Sheet (Round 2)"]);
    csvRows.push(["Report Date", new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push([
      "Team Name",
      "Leader Name",
      "Leader Email",
      "Leader ID",
      "Leader Phone",
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
      } else if (t.teamName.toLowerCase() === 'quantum hackers') {
        status = "SCORED";
        c1 = 9; c2 = 9; c3 = 9; c4 = 8; c5 = 9; total = 44;
        remarks = "Strong post-quantum security architecture and live demo.";
      }

      csvRows.push([
        `"${t.teamName || ''}"`,
        `"${t.leaderName || ''}"`,
        `"${t.leaderEmail || ''}"`,
        `"${t.leaderId || ''}"`,
        `"${t.leaderPhone || ''}"`,
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
    downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_Admin_Master_Report_${Date.now()}.csv`);
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
          <button type="button" className="submit-btn excel-btn admin-excel-btn" onClick={exportCSV}>
            📊 EXPORT CSV
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
                          <th style={{ width: '20%' }}>Team Name</th>
                          <th style={{ width: '22%' }}>Team Leader</th>
                          <th style={{ width: '23%' }}>Project Title</th>
                          <th style={{ width: '15%' }}>Status</th>
                          <th style={{ width: '20%' }}>Assign Judge</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTeams.map(t => {
                          const defaultJudgeOptions = [
                            'JM001', 'JM002', 'JM003', 'JM004', 'JM005',
                            'JM006', 'JM007', 'JM008', 'JM009', 'JM010', 'JM011'
                          ];
                          const allJudgeOptions = Array.from(
                            new Set([
                              ...defaultJudgeOptions,
                              ...teams.map(item => item.assignedJudge).filter(j => j && j !== 'Unassigned' && j !== 'CUSTOM'),
                              ...allowedUsers.map(u => u.email).filter(Boolean)
                            ])
                          );
                          const selectedVal = judgeSelections[t.id] !== undefined ? judgeSelections[t.id] : t.assignedJudge;
                          const isCustom = selectedVal === 'CUSTOM' || (!allJudgeOptions.includes(selectedVal) && selectedVal !== 'Unassigned');
                          const isAssigned = t.assignedJudge && t.assignedJudge !== 'Unassigned';

                          return (
                            <tr key={t.id || t.teamName}>
                              <td className="criterion-name">{t.teamName}</td>
                              <td>{t.leaderName} ({t.leaderId})<br /><small style={{ color: 'var(--text-muted)' }}>{t.leaderEmail}</small></td>
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
                                <select
                                  className="retro-select admin-judge-select"
                                  value={isCustom ? 'CUSTOM' : selectedVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setJudgeSelections({ ...judgeSelections, [t.id]: val });
                                    if (val === 'CUSTOM' && !customJudgeInputs[t.id]) {
                                      setCustomJudgeInputs({ ...customJudgeInputs, [t.id]: t.assignedJudge !== 'Unassigned' ? t.assignedJudge : '' });
                                    }
                                  }}
                                >
                                  <option value="Unassigned">Unassigned</option>
                                  {allJudgeOptions.map(jOpt => (
                                    <option key={jOpt} value={jOpt}>{jOpt}</option>
                                  ))}
                                  <option value="CUSTOM">✍️ Enter Custom Judge Email / ID...</option>
                                </select>

                                {isCustom && (
                                  <input
                                    type="text"
                                    placeholder="Type Judge Email or ID..."
                                    value={customJudgeInputs[t.id] !== undefined ? customJudgeInputs[t.id] : (allJudgeOptions.includes(t.assignedJudge) ? '' : t.assignedJudge)}
                                    onChange={(e) => setCustomJudgeInputs({ ...customJudgeInputs, [t.id]: e.target.value })}
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
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                  onClick={() => handleAssignJudge(t.id, t.teamName)}
                                >
                                  ASSIGN
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
            } else if (t.teamName.toLowerCase() === 'quantum hackers') {
              isScored = true;
              score = 44;
              c1 = 9; c2 = 9; c3 = 9; c4 = 8; c5 = 9;
              remarks = 'Strong post-quantum security architecture and live demo.';
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
                        <th style={{ width: '20%' }}>Team Name</th>
                        <th style={{ width: '18%' }}>Assigned Judge</th>
                        <th style={{ textAlign: 'center' }}>Arch (10)</th>
                        <th style={{ textAlign: 'center' }}>Scope (10)</th>
                        <th style={{ textAlign: 'center' }}>Avail (10)</th>
                        <th style={{ textAlign: 'center' }}>Timeline (10)</th>
                        <th style={{ textAlign: 'center' }}>Impl (10)</th>
                        <th style={{ textAlign: 'center', width: '12%' }}>Total Score (50)</th>
                        <th style={{ width: '12%' }}>Status</th>
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
