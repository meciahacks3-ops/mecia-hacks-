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

  const handleAssignJudge = async (teamId, teamName) => {
    const selectedJudge = judgeSelections[teamId] || 'judge@eval.org';
    try {
      await supabase.from('teams').update({ assigned_judge: selectedJudge }).eq('team_name', teamName);
      setTeams(teams.map(t => t.id === teamId ? { ...t, assignedJudge: selectedJudge } : t));
      alert(`Successfully assigned ${selectedJudge} to team ${teamName}!`);
    } catch (err) {
      console.error("Judge assignment error:", err);
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
        {activeTab === 'teams-tab' && (
          <div className="admin-tab-content active">
            <div className="form-section">
              <h3 className="section-title"><span className="pacman-bullet"></span> REGISTERED TEAMS & JUDGE ASSIGNMENTS</h3>

              <div className="table-responsive">
                <table className="eval-table admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Team Name</th>
                      <th style={{ width: '25%' }}>Team Leader</th>
                      <th style={{ width: '25%' }}>Project Title</th>
                      <th style={{ width: '20%' }}>Assigned Judge</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(t => (
                      <tr key={t.id || t.teamName}>
                        <td className="criterion-name">{t.teamName}</td>
                        <td>{t.leaderName} ({t.leaderId})<br /><small style={{ color: 'var(--text-muted)' }}>{t.leaderEmail}</small></td>
                        <td>{t.projectTitle}<br /><small style={{ color: 'var(--text-muted)' }}>{t.techStack}</small></td>
                        <td>
                          <select
                            className="retro-select admin-judge-select"
                            value={judgeSelections[t.id] || t.assignedJudge}
                            onChange={(e) => setJudgeSelections({ ...judgeSelections, [t.id]: e.target.value })}
                          >
                            <option value="judge@eval.org">judge@eval.org</option>
                            <option value="judge2@eval.org">judge2@eval.org</option>
                            <option value="judge3@eval.org">judge3@eval.org</option>
                            <option value="Unassigned">Unassigned</option>
                          </select>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARKSHEET & LIVE SCORES OVERVIEW */}
        {activeTab === 'scores-tab' && (
          <div className="admin-tab-content active">
            <div className="form-section">
              <h3 className="section-title"><span className="pacman-bullet"></span> LIVE EVALUATION LEADERBOARD</h3>

              <div className="table-responsive">
                <table className="eval-table admin-table">
                  <thead>
                    <tr>
                      <th>Team Name</th>
                      <th>Assigned Judge</th>
                      <th style={{ textAlign: 'center' }}>Arch (10)</th>
                      <th style={{ textAlign: 'center' }}>Scope (10)</th>
                      <th style={{ textAlign: 'center' }}>Avail (10)</th>
                      <th style={{ textAlign: 'center' }}>Timeline (10)</th>
                      <th style={{ textAlign: 'center' }}>Impl (10)</th>
                      <th style={{ textAlign: 'center' }}>Total (50)</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(t => {
                      const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());

                      if (evalEntry) {
                        return (
                          <tr key={t.id || t.teamName}>
                            <td className="criterion-name">{t.teamName}</td>
                            <td>{evalEntry.judgeEmail || t.assignedJudge}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{evalEntry.c1}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{evalEntry.c2}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{evalEntry.c3}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{evalEntry.c4}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{evalEntry.c5}</td>
                            <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.1rem', color: 'var(--pacman-yellow)' }}>{evalEntry.totalScore} / 50</td>
                            <td><span className="status-pill status-completed">SCORED</span></td>
                            <td><small>{evalEntry.remarks || 'No remarks added.'}</small></td>
                          </tr>
                        );
                      }

                      if (t.teamName.toLowerCase() === 'quantum hackers') {
                        return (
                          <tr key={t.id || t.teamName}>
                            <td className="criterion-name">{t.teamName}</td>
                            <td>{t.assignedJudge}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>9</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>9</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>9</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>8</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>9</td>
                            <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.1rem', color: 'var(--pacman-yellow)' }}>44 / 50</td>
                            <td><span className="status-pill status-completed">SCORED</span></td>
                            <td><small>Strong post-quantum security architecture and live demo.</small></td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={t.id || t.teamName}>
                          <td className="criterion-name">{t.teamName}</td>
                          <td>{t.assignedJudge}</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          <td style={{ textAlign: 'center' }}>-</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>- / 50</td>
                          <td><span className="status-pill status-pending">PENDING</span></td>
                          <td><small style={{ color: 'var(--text-muted)' }}>Evaluation pending</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ALLOWED GMAILS WHITELIST */}
        {activeTab === 'whitelist-tab' && (
          <div className="admin-tab-content active">
            <div className="form-section">
              <h3 className="section-title"><span className="pacman-bullet"></span> GOOGLE OAUTH AUTHORIZED USERS WHITELIST</h3>

              <form onSubmit={handleAddAllowedGmail} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
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
