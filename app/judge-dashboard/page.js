'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RubricsModal from '@/app/components/RubricsModal';
import { getJudgeProfile } from '@/lib/judgeProfiles';
import { parseTimeSlotFromTeam, getTimeSlotInfo } from '@/lib/timeSlotUtils';
import { parseEvaluationRecord } from '@/lib/teamUtils';
import { isFinalRoundTeam, getFinalRoundTeamInfo, getTeamLabLocation } from '@/lib/finalRoundTeams';

export default function JudgeDashboardPage() {
  const router = useRouter();
  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teams, setTeams] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRubrics, setShowRubrics] = useState(false);
  const [finalistsOnlyFilter, setFinalistsOnlyFilter] = useState(true);

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
      // 1. Fetch Teams from Supabase (fetching project details, hiding personal leader/member info)
      const { data: supaTeams } = await supabase
        .from('teams')
        .select('id, team_name, team_id_no, project_title, main_idea, assigned_judge');
      if (supaTeams && supaTeams.length > 0) {
        const formattedTeams = supaTeams.map(st => {
          let parsedTeamId = st.team_id_no && st.team_id_no.trim() !== 'N/A' ? st.team_id_no.trim() : 'N/A';
          if (parsedTeamId === 'N/A' && st.main_idea && st.main_idea.includes('Team ID:')) {
            const match = st.main_idea.match(/Team ID:\s*([^\]\n|]+)/i);
            if (match && match[1]) parsedTeamId = match[1].trim();
          }

          let cleanDesc = (st.main_idea || '').trim();
          if (cleanDesc.includes('[Type:') || cleanDesc.includes('[type:') || cleanDesc.includes('[Slot:')) {
            cleanDesc = cleanDesc.replace(/\[[^\]]+\]\s*/g, '').trim();
          }

          const parsedSlot = parseTimeSlotFromTeam(st);
          const finalistInfo = getFinalRoundTeamInfo({ teamName: st.team_name, teamIdNo: parsedTeamId, main_idea: st.main_idea });
          const labLocation = getTeamLabLocation({ teamName: st.team_name, teamIdNo: parsedTeamId, main_idea: st.main_idea });

          return {
            id: st.id,
            teamName: st.team_name,
            teamIdNo: parsedTeamId,
            projectTitle: st.project_title || 'N/A',
            projectDesc: cleanDesc || st.main_idea || 'No description provided.',
            assignedJudge: st.assigned_judge,
            timeSlot: parsedSlot,
            isFinalist: Boolean(finalistInfo),
            finalistInfo: finalistInfo || null,
            labLocation: labLocation || finalistInfo?.labLocation || null
          };
        });
        setTeams(formattedTeams);
      } else {
        setTeams([]);
      }

      // 2. Fetch Evaluations from Supabase
      const { data: supaEvals } = await supabase.from('evaluations').select('*');
      if (supaEvals && supaEvals.length > 0) {
        const formattedEvals = supaEvals.map(parseEvaluationRecord).filter(Boolean);
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
  }).sort((a, b) => {
    const slotOrder = { '09:30 AM - 11:30 AM': 1, '12:15 PM - 02:15 PM': 2, '02:30 PM - 04:15 PM': 3, 'TBA': 4 };
    const aSlot = slotOrder[a.timeSlot] || 5;
    const bSlot = slotOrder[b.timeSlot] || 5;
    if (aSlot !== bSlot) return aSlot - bSlot;
    return (a.teamIdNo || '').localeCompare(b.teamIdNo || '');
  });

  const finalistAssignedTeams = assignedTeams.filter(t => t.isFinalist);

  const displayedAssignedTeams = (finalistsOnlyFilter && finalistAssignedTeams.length > 0)
    ? finalistAssignedTeams
    : assignedTeams;

  const cleanJudgeUpper = (judgeEmail || '').trim().toUpperCase();
  const isMentorJudge = cleanJudgeUpper.startsWith('MM');
  const isExternalRound3Judge = cleanJudgeUpper.startsWith('FM');
  const isFinalRoundJudge = isMentorJudge;
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

          {/* Top Right Corner: View Rubrics (Round 2 only) & Logout Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isFinalRoundJudge && (
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
            )}
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

        <RubricsModal isOpen={showRubrics} onClose={() => setShowRubrics(false)} />

        {/* STAGE 3: FINAL ROUND ACTIVE BANNER */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(253, 255, 0, 0.12) 0%, rgba(0, 255, 204, 0.12) 100%)',
          border: '2px solid #fdff00',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '28px',
          boxShadow: '0 0 20px rgba(253, 255, 0, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem' }}>🏆</span>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Press Start 2P, monospace', fontSize: '0.78rem', color: '#fdff00', letterSpacing: '1px' }}>
                  {isMentorJudge ? 'STAGE 3: FINAL ROUND FEEDBACK PANEL' : isExternalRound3Judge ? 'ROUND 3: GRAND FINALE JURY PANEL' : 'STAGE 3: FINAL ROUND EVALUATIONS ACTIVE'}
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#ccc', fontSize: '0.74rem' }}>
                  {isMentorJudge
                    ? `Reviewing the 49 qualified finalist teams. Provide feedback for your ${finalistAssignedTeams.length} assigned finalist ${finalistAssignedTeams.length === 1 ? 'team' : 'teams'}.`
                    : isExternalRound3Judge
                    ? `Round 3 Grand Finale evaluation. Evaluate and score your ${finalistAssignedTeams.length} assigned finalist ${finalistAssignedTeams.length === 1 ? 'team' : 'teams'} across all 5 evaluation criteria.`
                    : `Evaluating the 49 qualified finalist teams. Your panel has ${finalistAssignedTeams.length} Finalist ${finalistAssignedTeams.length === 1 ? 'Team' : 'Teams'} to evaluate.`}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFinalistsOnlyFilter(true)}
              style={{
                background: finalistsOnlyFilter ? '#fdff00' : 'rgba(0,0,0,0.6)',
                color: finalistsOnlyFilter ? '#000' : '#888',
                border: '1.5px solid #fdff00',
                padding: '8px 12px',
                borderRadius: '6px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: finalistsOnlyFilter ? '0 0 10px rgba(253, 255, 0, 0.4)' : 'none'
              }}
            >
              🏆 FINALISTS ONLY ({finalistAssignedTeams.length})
            </button>
            <button
              type="button"
              onClick={() => setFinalistsOnlyFilter(false)}
              style={{
                background: !finalistsOnlyFilter ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                color: !finalistsOnlyFilter ? '#000' : '#888',
                border: '1.5px solid #00ffcc',
                padding: '8px 12px',
                borderRadius: '6px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: !finalistsOnlyFilter ? '0 0 10px rgba(0, 255, 204, 0.4)' : 'none'
              }}
            >
              ALL ASSIGNED ({assignedTeams.length})
            </button>
          </div>
        </div>

        {/* Dashboard Title Header */}
        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge eval-badge" style={{ background: '#fdff00', color: '#000', fontWeight: 'bold' }}>
              {isMentorJudge ? 'STAGE 3: FINAL ROUND FEEDBACK PANEL' : isExternalRound3Judge ? 'ROUND 3: EXTERNAL JURY PANEL' : 'STAGE 3: FINAL ROUND EVALUATION PANEL'}
            </span>
          </div>
          <h2>{isMentorJudge ? 'ASSIGNED FINALIST TEAMS FOR FEEDBACK' : isExternalRound3Judge ? 'ROUND 3: ASSIGNED FINALIST TEAMS' : 'ASSIGNED FINAL ROUND TEAMS'} ({displayedAssignedTeams.length})</h2>
          <p>
            {isMentorJudge
              ? `Provide constructive qualitative feedback and recommendations for assigned finalist teams (Panel: ${judgeEmail.toUpperCase()}). Marks are disabled.`
              : isExternalRound3Judge
              ? `Evaluate assigned finalist teams (Panel: ${judgeEmail.toUpperCase()}) across all 5 official evaluation rubrics.`
              : (finalistsOnlyFilter
                  ? `Review Final Round qualified submissions and assign scores for panel: ${judgeEmail}.`
                  : `Viewing all assigned teams (including Round 2 archive) for panel: ${judgeEmail}.`)}
          </p>
        </div>

        {/* Assigned Teams List Section */}
        <div className="form-section">
          <h3 className="section-title">
            <span className="pacman-bullet"></span> {isFinalRoundJudge ? 'FINAL ROUND TEAMS (CLICK TO ADD / VIEW FEEDBACK)' : 'FINAL ROUND TEAMS (CLICK NAME TO EVALUATE)'}
          </h3>

          <div className="teams-list">
            {displayedAssignedTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '10px', border: '1.5px dashed rgba(0, 255, 255, 0.3)' }}>
                <p style={{ fontSize: '1rem', color: 'var(--pacman-yellow)', marginBottom: '8px', fontWeight: '700' }}>⚠️ NO TEAMS FOUND</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teams found for judge panel <strong>{judgeEmail}</strong> under the current filter.</p>
                {finalistsOnlyFilter && (
                  <button
                    type="button"
                    onClick={() => setFinalistsOnlyFilter(false)}
                    style={{
                      marginTop: '12px',
                      background: '#00ffcc',
                      color: '#000',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.6rem',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    VIEW ALL ASSIGNED TEAMS ({assignedTeams.length})
                  </button>
                )}
              </div>
            ) : (
              displayedAssignedTeams.map(t => {
                const evalEntry = evaluations.find(e => {
                  const nameMatch = (e.teamName || '').trim().toLowerCase() === (t.teamName || '').trim().toLowerCase();
                  if (!nameMatch) return false;
                  if (isMentorJudge || isExternalRound3Judge) {
                    return (e.judgeEmail || '').trim().toUpperCase() === cleanJudgeUpper;
                  }
                  return true;
                });
                const hasFeedback = Boolean(evalEntry && evalEntry.remarks && evalEntry.remarks.trim());
                const isScored = isFinalRoundJudge ? hasFeedback : Boolean(evalEntry);
                const scoreVal = evalEntry ? evalEntry.totalScore : 0;
                const slotInfo = getTimeSlotInfo(t.timeSlot);

                const internalMentorFeedback = evaluations.filter(e => {
                  const nameMatch = (e.teamName || '').trim().toLowerCase() === (t.teamName || '').trim().toLowerCase();
                  if (!nameMatch) return false;
                  const jEmail = (e.judgeEmail || '').trim().toUpperCase();
                  const isInternal = jEmail.startsWith('MM') || jEmail.startsWith('JM');
                  return isInternal && e.remarks && e.remarks.trim();
                });

                return (
                  <div key={t.id || t.teamName} className="team-card" style={t.isFinalist ? { border: '1.5px solid rgba(253, 255, 0, 0.4)', boxShadow: '0 0 15px rgba(253, 255, 0, 0.15)' } : {}}>
                    <div className="team-card-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <a
                            href={`/judge-evaluation?team=${encodeURIComponent(t.teamName)}`}
                            className="team-name-link"
                            title={`Click to ${isFinalRoundJudge ? 'give feedback for' : 'evaluate'} ${t.teamName}`}
                          >
                            <span className="team-name">{t.teamName}</span>
                          </a>

                          {t.isFinalist ? (
                            <span style={{
                              background: 'linear-gradient(135deg, #fdff00, #ffb852)',
                              color: '#000',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.55rem',
                              fontFamily: 'Press Start 2P, monospace',
                              fontWeight: 'bold',
                              boxShadow: '0 0 8px rgba(253, 255, 0, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              🏆 FINALIST: {t.finalistInfo?.track} {t.finalistInfo?.rank}
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#888',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.52rem',
                              fontFamily: 'Press Start 2P, monospace'
                            }}>
                              ROUND 2 ONLY
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {isFinalRoundJudge ? (
                            evalEntry?.hasPhase1 && evalEntry?.hasPhase2 ? (
                              <span className="status-pill status-completed" style={{ background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', border: '1px solid #00ffcc' }}>
                                ✅ BOTH PHASES SUBMITTED
                              </span>
                            ) : evalEntry?.hasPhase1 ? (
                              <span className="status-pill status-completed" style={{ background: 'rgba(0, 255, 204, 0.12)', color: '#00ffcc', border: '1px solid rgba(0, 255, 204, 0.6)' }}>
                                ⚡ PHASE 1 DONE • P2 PENDING
                              </span>
                            ) : evalEntry?.hasPhase2 ? (
                              <span className="status-pill status-completed" style={{ background: 'rgba(255, 102, 204, 0.12)', color: '#ff66cc', border: '1px solid rgba(255, 102, 204, 0.6)' }}>
                                🚀 PHASE 2 DONE • P1 PENDING
                              </span>
                            ) : hasFeedback ? (
                              <span className="status-pill status-completed" style={{ background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', border: '1px solid #00ffcc' }}>
                                💬 FEEDBACK SUBMITTED
                              </span>
                            ) : (
                              <span className="status-pill status-pending" style={{ background: 'rgba(253, 255, 0, 0.12)', color: '#fdff00', border: '1px solid rgba(253, 255, 0, 0.4)' }}>
                                ⏳ FEEDBACK PENDING
                              </span>
                            )
                          ) : (
                            isScored ? (
                              <span className="status-pill status-completed">SCORED ({scoreVal}/50)</span>
                            ) : (
                              <span className="status-pill status-pending">PENDING EVALUATION</span>
                            )
                          )}

                          {t.isFinalist && t.finalistInfo?.score && (
                            <span style={{
                              fontFamily: 'Press Start 2P, monospace',
                              fontSize: '0.55rem',
                              color: '#fdff00',
                              background: 'rgba(253, 255, 0, 0.12)',
                              border: '1px solid rgba(253, 255, 0, 0.4)',
                              padding: '3px 8px',
                              borderRadius: '4px'
                            }}>
                              ⭐ R2 SCORE: {t.finalistInfo.score}/50
                            </span>
                          )}
                        </div>

                        {t.labLocation && (
                          <div style={{ marginTop: '8px' }}>
                            <span style={{
                              fontFamily: 'Press Start 2P, monospace',
                              fontSize: '0.62rem',
                              color: '#000',
                              background: '#00ffcc',
                              border: '1.5px solid #00ffcc',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 0 10px rgba(0, 255, 204, 0.4)',
                              fontWeight: 'bold',
                              letterSpacing: '0.5px'
                            }}>
                              📍 LAB VENUE: {t.labLocation}
                            </span>
                          </div>
                        )}

                        {!isFinalRoundJudge && (
                          <div style={{ marginTop: '8px' }}>
                            <span style={{
                              fontFamily: 'Press Start 2P, monospace',
                              fontSize: '0.62rem',
                              color: slotInfo.badgeColor,
                              background: slotInfo.badgeBg,
                              border: `1.5px solid ${slotInfo.badgeBorder}`,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {t.timeSlot === 'TBA' ? '⏳ PRESENTATION SLOT: TBA' : `⏰ TIME SLOT: ${t.timeSlot}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {isFinalRoundJudge ? (
                        <a
                          href={`/judge-evaluation?team=${encodeURIComponent(t.teamName)}`}
                          className="eval-btn"
                          style={hasFeedback ? {
                            background: 'rgba(0, 255, 204, 0.15)',
                            color: '#00ffcc',
                            border: '1.5px solid #00ffcc'
                          } : {
                            background: '#00ffcc',
                            color: '#000',
                            border: 'none',
                            fontWeight: 'bold'
                          }}
                          title={hasFeedback ? `View or edit feedback for ${t.teamName}` : `Add feedback for ${t.teamName}`}
                        >
                          {evalEntry?.hasPhase1 && evalEntry?.hasPhase2
                            ? '💬 VIEW / EDIT PHASES'
                            : evalEntry?.hasPhase1
                            ? '🚀 ADD PHASE 2 FEEDBACK'
                            : evalEntry?.hasPhase2
                            ? '⚡ ADD PHASE 1 FEEDBACK'
                            : '✍️ ADD FEEDBACK'}
                        </a>
                      ) : isExternalRound3Judge ? (
                        <a
                          href={`/judge-evaluation?team=${encodeURIComponent(t.teamName)}`}
                          className="eval-btn"
                          style={isScored ? {
                            background: 'rgba(0, 255, 204, 0.15)',
                            color: '#00ffcc',
                            border: '1.5px solid #00ffcc',
                            fontWeight: 'bold'
                          } : {
                            background: 'linear-gradient(135deg, #fdff00, #ffb800)',
                            color: '#000',
                            border: 'none',
                            fontWeight: 'bold',
                            boxShadow: '0 0 10px rgba(253, 255, 0, 0.4)'
                          }}
                          title={isScored ? `Review or edit evaluation marks for ${t.teamName}` : `Evaluate ${t.teamName}`}
                        >
                          {isScored ? `✏️ EDIT MARKS (${scoreVal}/50)` : '⭐ EVALUATE TEAM'}
                        </a>
                      ) : (
                        <a
                          href={`/judge-evaluation?team=${encodeURIComponent(t.teamName)}`}
                          className={`eval-btn ${isScored ? 'locked-btn' : ''}`}
                          style={isScored ? {
                            background: 'rgba(255, 77, 77, 0.12)',
                            color: '#ff8888',
                            border: '1.5px solid #ff4d4d'
                          } : {}}
                          title={isScored ? 'Marks evaluated and finalized (View only)' : `Evaluate ${t.teamName}`}
                        >
                          {isScored ? '🔒 VIEW MARKS (LOCKED)' : '⭐ EVALUATE TEAM'}
                        </a>
                      )}
                    </div>

                    <div className="team-card-body">
                      {t.labLocation && (
                        <div className="info-block" style={{
                          background: 'rgba(0, 255, 204, 0.08)',
                          borderLeft: '4px solid #00ffcc',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          marginBottom: '8px'
                        }}>
                          <span className="info-label" style={{ color: '#00ffcc', fontWeight: 'bold' }}>📍 Lab Allocation:</span>
                          <span className="info-val" style={{ color: '#fdff00', fontWeight: 'bold', fontSize: '0.92rem' }}>{t.labLocation}</span>
                        </div>
                      )}
                      <div className="info-block">
                        <span className="info-label">🆔 Team ID:</span>
                        <span className="info-val" style={{ color: '#fdff00', fontWeight: 'bold' }}>{t.teamIdNo || 'N/A'}</span>
                      </div>
                      <div className="info-block">
                        <span className="info-label">💡 Project Title:</span>
                        <span className="info-val highlight-title">{t.projectTitle}</span>
                      </div>
                      <div className="info-block">
                        <span className="info-label">🎯 Project Description:</span>
                        <span className="info-val" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{t.projectDesc}</span>
                      </div>

                      {/* Mentor Judge view of their own feedback */}
                      {isFinalRoundJudge && hasFeedback && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px 14px',
                          background: 'rgba(0, 255, 204, 0.06)',
                          border: '1px solid rgba(0, 255, 204, 0.35)',
                          borderRadius: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.68rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                              💬 YOUR SUBMITTED MENTOR FEEDBACK
                            </span>
                          </div>
                          {evalEntry.hasPhase1 || evalEntry.hasPhase2 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {evalEntry.phase1Feedback && (
                                <div style={{ background: 'rgba(0, 0, 0, 0.6)', borderLeft: '3px solid #00ffcc', padding: '8px 12px', borderRadius: '4px' }}>
                                  <div style={{ color: '#00ffcc', fontSize: '0.64rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                                    ⚡ PHASE 1 FEEDBACK:
                                  </div>
                                  <p style={{ color: '#ffffff', fontSize: '0.84rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {evalEntry.phase1Feedback}
                                  </p>
                                </div>
                              )}
                              {evalEntry.phase2Feedback && (
                                <div style={{ background: 'rgba(0, 0, 0, 0.6)', borderLeft: '3px solid #ff66cc', padding: '8px 12px', borderRadius: '4px' }}>
                                  <div style={{ color: '#ff66cc', fontSize: '0.64rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                                    🚀 PHASE 2 FEEDBACK:
                                  </div>
                                  <p style={{ color: '#ffffff', fontSize: '0.84rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {evalEntry.phase2Feedback}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ color: '#ffffff', fontSize: '0.86rem', whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0 }}>
                              {evalEntry.remarks}
                            </p>
                          )}
                        </div>
                      )}

                      {/* External Judge view of Internal Mentor Feedback */}
                      {isExternalRound3Judge && (
                        <div style={{
                          marginTop: '14px',
                          padding: '12px 16px',
                          background: 'linear-gradient(135deg, rgba(253, 255, 0, 0.08) 0%, rgba(0, 255, 204, 0.06) 100%)',
                          border: '1.5px solid #fdff00',
                          borderRadius: '8px',
                          boxShadow: '0 0 12px rgba(253, 255, 0, 0.15)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.9rem' }}>📝</span>
                              <span style={{ fontSize: '0.68rem', color: '#fdff00', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                                INTERNAL MENTOR FEEDBACK
                              </span>
                            </div>
                            <span style={{
                              background: internalMentorFeedback.length > 0 ? '#fdff00' : 'rgba(255, 255, 255, 0.1)',
                              color: internalMentorFeedback.length > 0 ? '#000' : '#888',
                              fontSize: '0.55rem',
                              fontFamily: 'Press Start 2P, monospace',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {internalMentorFeedback.length} REVIEW{internalMentorFeedback.length === 1 ? '' : 'S'}
                            </span>
                          </div>

                          {internalMentorFeedback.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {internalMentorFeedback.map((fb, idx) => {
                                const mentorProf = getJudgeProfile(fb.judgeEmail);
                                const mentorNames = mentorProf ? mentorProf.namesText : fb.judgeEmail;
                                return (
                                  <div key={idx} style={{
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    borderLeft: '3px solid #00ffcc',
                                    padding: '8px 12px',
                                    borderRadius: '4px'
                                  }}>
                                    <div style={{ color: '#00ffcc', fontSize: '0.74rem', fontWeight: 'bold', marginBottom: '6px' }}>
                                      👨‍🏫 Mentor Panel: <span style={{ color: '#fdff00' }}>{fb.judgeEmail}</span> {mentorProf?.group ? `(${mentorProf.group})` : ''} • {mentorNames}
                                    </div>
                                    {fb.hasPhase1 || fb.hasPhase2 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {fb.phase1Feedback && (
                                          <div style={{ background: 'rgba(0, 255, 204, 0.05)', borderLeft: '3px solid #00ffcc', padding: '6px 10px', borderRadius: '4px' }}>
                                            <div style={{ color: '#00ffcc', fontSize: '0.62rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', marginBottom: '2px' }}>
                                              ⚡ PHASE 1:
                                            </div>
                                            <p style={{ color: '#ffffff', fontSize: '0.82rem', lineHeight: '1.4', whiteSpace: 'pre-wrap', margin: 0 }}>
                                              {fb.phase1Feedback}
                                            </p>
                                          </div>
                                        )}
                                        {fb.phase2Feedback && (
                                          <div style={{ background: 'rgba(255, 102, 204, 0.05)', borderLeft: '3px solid #ff66cc', padding: '6px 10px', borderRadius: '4px' }}>
                                            <div style={{ color: '#ff66cc', fontSize: '0.62rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', marginBottom: '2px' }}>
                                              🚀 PHASE 2:
                                            </div>
                                            <p style={{ color: '#ffffff', fontSize: '0.82rem', lineHeight: '1.4', whiteSpace: 'pre-wrap', margin: 0 }}>
                                              {fb.phase2Feedback}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p style={{ color: '#ffffff', fontSize: '0.86rem', whiteSpace: 'pre-wrap', lineHeight: '1.5', margin: 0 }}>
                                        {fb.remarks}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p style={{ color: '#aaa', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>
                              ⏳ Internal mentor feedback has not yet been submitted for this team.
                            </p>
                          )}
                        </div>
                      )}

                      {/* External Judge view of their own scored evaluation */}
                      {isExternalRound3Judge && evalEntry && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 14px',
                          background: 'rgba(0, 255, 204, 0.08)',
                          border: '1px solid rgba(0, 255, 204, 0.4)',
                          borderRadius: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                              ⭐ YOUR EVALUATION SCORE:
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#fdff00', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                              {evalEntry.totalScore}/50 MARKS
                            </span>
                          </div>
                          {evalEntry.remarks && (
                            <p style={{ color: '#ddd', fontSize: '0.82rem', margin: '6px 0 0 0', fontStyle: 'italic' }}>
                              &ldquo;{evalEntry.remarks}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
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
