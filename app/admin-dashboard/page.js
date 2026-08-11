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
  const [activeTab, setActiveTab] = useState('teams-tab'); // 'teams-tab' or 'scores-tab'
  const [teams, setTeams] = useState(initialDemoTeams);
  const [evaluations, setEvaluations] = useState([]);
  const [judgeSelections, setJudgeSelections] = useState({});

  useEffect(() => {
    const savedAdminUser = sessionStorage.getItem('adminUser');
    if (savedAdminUser) setAdminUser(savedAdminUser);
    fetchData();
  }, []);

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
          c1: se.c1_innovation,
          c2: se.c2_execution,
          c3: se.c3_feasibility,
          c4: se.c4_presentation,
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
    csvRows.push(["Mecia Hack 3.0 - Complete Admin Master Report & Evaluation Sheet"]);
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
      "Innovation (25)",
      "Technical Execution (25)",
      "Solution Feasibility (25)",
      "Presentation & UI/UX (25)",
      "Total Score (100)",
      "Judge Remarks"
    ]);

    teams.forEach(t => {
      const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
      let status = "PENDING";
      let c1 = "-", c2 = "-", c3 = "-", c4 = "-", total = "-", remarks = "-";

      if (evalEntry) {
        status = "SCORED";
        c1 = evalEntry.c1;
        c2 = evalEntry.c2;
        c3 = evalEntry.c3;
        c4 = evalEntry.c4;
        total = evalEntry.totalScore;
        remarks = evalEntry.remarks || '';
      } else if (t.teamName.toLowerCase() === 'quantum hackers') {
        status = "SCORED";
        c1 = 22; c2 = 23; c3 = 21; c4 = 22; total = 88;
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
            👥 TEAM ASSIGNMENTS & JUDGES
          </button>
          <button
            type="button"
            className={`judge-nav-btn eval-highlight ${activeTab === 'scores-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('scores-tab')}
          >
            ⭐ LEADERBOARD & MARKS
          </button>
          <button type="button" className="submit-btn excel-btn admin-excel-btn" onClick={exportCSV}>
            📊 EXPORT ALL TO EXCEL (.CSV)
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
                      <th style={{ textAlign: 'center' }}>Innov (25)</th>
                      <th style={{ textAlign: 'center' }}>Tech (25)</th>
                      <th style={{ textAlign: 'center' }}>Feas (25)</th>
                      <th style={{ textAlign: 'center' }}>Pres (25)</th>
                      <th style={{ textAlign: 'center' }}>Total (100)</th>
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
                            <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.1rem', color: 'var(--pacman-yellow)' }}>{evalEntry.totalScore} / 100</td>
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
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>22</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>23</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>21</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>22</td>
                            <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.1rem', color: 'var(--pacman-yellow)' }}>88 / 100</td>
                            <td><span class="status-pill status-completed">SCORED</span></td>
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
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>- / 100</td>
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

        <div className="arcade-footer">
          <span>ADMIN CONTROL SYSTEM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>
    </>
  );
}
