'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RubricsModal from '@/app/components/RubricsModal';

const initialDemoTeams = [
  {
    id: 'team-1',
    teamName: 'Cyber Byte Squad',
    leaderName: 'Alex Johnson',
    leaderEmail: 'alex@cyber.edu',
    leaderId: 'EN2026101',
    leaderPhone: '+91 9876543210',
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
    projectTitle: 'Smart Urban Traffic Grid Optimization',
    mainIdea: 'Computer-vision driven dynamic signal timing to minimize congestion and emergency vehicle response times.',
    techStack: 'OpenCV, PyTorch, Node.js, Leaflet.js',
    assignedJudge: 'judge@eval.org'
  }
];

export default function JudgeDashboardPage() {
  const router = useRouter();
  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teams, setTeams] = useState(initialDemoTeams);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRubrics, setShowRubrics] = useState(false);

  useEffect(() => {
    const savedJudgeEmail = sessionStorage.getItem('judgeEmail');
    if (savedJudgeEmail) {
      setJudgeEmail(savedJudgeEmail);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    try {
      // 1. Fetch Teams from Supabase
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
          mainIdea: st.main_idea,
          techStack: st.tech_stack,
          assignedJudge: st.assigned_judge
        }));
        setTeams(formattedTeams);
      }

      // 2. Fetch Evaluations from Supabase
      const { data: supaEvals } = await supabase.from('evaluations').select('*');
      if (supaEvals && supaEvals.length > 0) {
        const formattedEvals = supaEvals.map(se => ({
          teamName: se.team_name,
          judgeEmail: se.judge_email,
          totalScore: se.total_score,
          remarks: se.remarks
        }));
        setEvaluations(formattedEvals);
      }
    } catch (e) {
      console.warn("Supabase fetch error on judge dashboard:", e);
    } finally {
      setLoading(false);
    }
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

      <div className="judge-container">
        {/* Navigation Bar */}
        <div className="nav-header" style={{ justifyContent: 'flex-end', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <button
            type="button"
            className="eval-btn edit-btn"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={() => setShowRubrics(true)}
          >
            📋 ROUND 2 RUBRICS
          </button>
          <div className="student-hud-badge">
            <span className="ghost cyan-ghost" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> JUDGE: <span id="logged-judge-email">{judgeEmail}</span>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            🚪 LOG OUT
          </button>
        </div>

        <RubricsModal isOpen={showRubrics} onClose={() => setShowRubrics(false)} />

        {/* Dashboard Title Header */}
        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge eval-badge">STAGE 2: JUDGE EVALUATION PANEL</span>
          </div>
          <h2>ASSIGNED HACKATHON TEAMS</h2>
          <p>Review team submissions, evaluate solutions against rubrics, and assign scores.</p>
        </div>

        {/* Assigned Teams List Section */}
        <div className="form-section">
          <h3 className="section-title"><span className="pacman-bullet"></span> HACKATHON TEAMS (CLICK NAME TO EVALUATE)</h3>

          <div className="teams-list">
            {teams.map(t => {
              const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
              const isScored = Boolean(evalEntry) || (t.teamName.toLowerCase() === 'quantum hackers');
              const scoreVal = evalEntry ? evalEntry.totalScore : (t.teamName.toLowerCase() === 'quantum hackers' ? 88 : 0);

              return (
                <div key={t.id || t.teamName} className="team-card">
                  <div className="team-card-header">
                    <div>
                      <a
                        href={`/judge-evaluation?team=${encodeURIComponent(t.teamName)}`}
                        className="team-name-link"
                        title={`Click to evaluate ${t.teamName}`}
                      >
                        <span className="team-name">{t.teamName}</span>
                      </a>
                      {isScored ? (
                        <span className="status-pill status-completed">SCORED ({scoreVal}/100)</span>
                      ) : (
                        <span className="status-pill status-pending">PENDING EVALUATION</span>
                      )}
                    </div>

                    <a
                      href={`/judge-evaluation?team=${encodeURIComponent(t.teamName)}`}
                      className={`eval-btn ${isScored ? 'edit-btn' : ''}`}
                    >
                      {isScored ? '✏️ EDIT MARKS' : '⭐ EVALUATE TEAM'}
                    </a>
                  </div>

                  <div className="team-card-body">
                    <div className="info-block">
                      <span className="info-label">👑 Team Leader:</span>
                      <span className="info-val">{t.leaderName} ({t.leaderId}) | {t.leaderEmail} | {t.leaderPhone}</span>
                    </div>
                    <div className="info-block">
                      <span className="info-label">💡 Project Title:</span>
                      <span className="info-val highlight-title">{t.projectTitle}</span>
                    </div>
                    <div className="info-block">
                      <span className="info-label">🎯 Main Idea:</span>
                      <span className="info-val">{t.mainIdea}</span>
                    </div>
                    <div className="info-block">
                      <span className="info-label">🛠️ Tech Stack:</span>
                      <span className="info-val">{t.techStack}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="arcade-footer">
          <span>JUDGE EVALUATION SYSTEM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>
    </>
  );
}
