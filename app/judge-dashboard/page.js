'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RubricsModal from '@/app/components/RubricsModal';
import { getJudgeProfile } from '@/lib/judgeProfiles';

const initialDemoTeams = [];

export default function JudgeDashboardPage() {
  const router = useRouter();
  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teams, setTeams] = useState([]);
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
      } else {
        setTeams([]);
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
      } else {
        setEvaluations([]);
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

  // Strict Panel-based Filtering: Judges only see teams assigned specifically to their judgeEmail
  const assignedTeams = teams.filter(t => {
    if (!t.assignedJudge) return false;
    return t.assignedJudge.toLowerCase().trim() === judgeEmail.toLowerCase().trim();
  });

  const judgeProfile = getJudgeProfile(judgeEmail);

  return (
    <>
      <div className="scanlines"></div>

      <div className="judge-container">
        {/* Navigation Bar: Top-Left Judge Names & Top-Right Actions */}
        <div className="nav-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          {/* Top Left Corner: Judge Name(s) & Panel Info */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1.5px solid var(--neon-cyan, #00ffcc)',
            boxShadow: '0 0 12px rgba(0, 255, 204, 0.25)',
            borderRadius: '8px',
            padding: '10px 16px',
            maxWidth: '650px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="ghost cyan-ghost" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span>
              <span style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '0.65rem', color: '#00ffcc', letterSpacing: '1px' }}>
                JUDGE PANEL: <span id="logged-judge-email">{judgeEmail.toUpperCase()}</span> {judgeProfile?.group ? `• ${judgeProfile.group}` : ''}
              </span>
            </div>
            {judgeProfile ? (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', marginTop: '4px' }}>
                  {judgeProfile.names.map((name, idx) => (
                    <div key={idx} style={{ color: '#ffffff', fontSize: '0.86rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#00ffcc', fontSize: '0.7rem' }}>▸</span>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
                {judgeProfile.location && (
                  <div style={{ color: '#fdff00', fontSize: '0.72rem', fontWeight: '600', borderTop: '1px dashed rgba(255, 255, 255, 0.15)', paddingTop: '6px' }}>
                    📍 Location: {judgeProfile.location}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: '600' }}>
                👨‍⚖️ Authorized Evaluation Judge Panel
              </div>
            )}
          </div>

          {/* Top Right Corner: View Rubrics & Logout Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setShowRubrics(true)}
              style={{
                background: 'rgba(0, 255, 204, 0.15)',
                color: '#00ffcc',
                border: '1.5px solid #00ffcc',
                borderRadius: '8px',
                padding: '10px 14px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.6rem',
                cursor: 'pointer'
              }}
            >
              📋 VIEW RUBRICS
            </button>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

        <RubricsModal isOpen={showRubrics} onClose={() => setShowRubrics(false)} />

        {/* Dashboard Title Header */}
        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge eval-badge">STAGE 2: JUDGE EVALUATION PANEL</span>
          </div>
          <h2>ASSIGNED HACKATHON TEAMS ({assignedTeams.length})</h2>
          <p>Review team submissions, evaluate solutions against rubrics, and assign scores for panel: <strong>{judgeEmail}</strong>.</p>
        </div>

        {/* Assigned Teams List Section */}
        <div className="form-section">
          <h3 className="section-title"><span className="pacman-bullet"></span> HACKATHON TEAMS (CLICK NAME TO EVALUATE)</h3>

          <div className="teams-list">
            {assignedTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '10px', border: '1.5px dashed rgba(0, 255, 255, 0.3)' }}>
                <p style={{ fontSize: '1rem', color: 'var(--pacman-yellow)', marginBottom: '8px', fontWeight: '700' }}>⚠️ NO TEAMS ASSIGNED YET</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hackathon teams have been assigned to judge panel <strong>{judgeEmail}</strong> yet by the Admin.</p>
              </div>
            ) : (
              assignedTeams.map(t => {
                const evalEntry = evaluations.find(e => e.teamName.toLowerCase() === t.teamName.toLowerCase());
                const isScored = Boolean(evalEntry) || (t.teamName.toLowerCase() === 'quantum hackers');
                const scoreVal = evalEntry ? evalEntry.totalScore : (t.teamName.toLowerCase() === 'quantum hackers' ? 44 : 0);

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
                          <span className="status-pill status-completed">SCORED ({scoreVal}/50)</span>
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
              })
            )}
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
