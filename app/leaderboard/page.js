'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { computeFinalRoundScoreForTeam, parseProjectTypeFromTeam, getProjectTypeInfo } from '@/lib/teamUtils';
import { getFinalRoundTeamInfo, FINAL_ROUND_STATS } from '@/lib/finalRoundTeams';
import { JUDGE_PROFILES } from '@/lib/judgeProfiles';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function LiveLeaderboardPage() {
  const [teams, setTeams] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trackFilter, setTrackFilter] = useState('all'); // 'all', 'software', 'hybrid', 'hardware'
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch teams and evaluations
  const fetchData = async () => {
    try {
      // 1. Fetch Teams along with team members
      const { data: supaTeams } = await supabase.from('teams').select('*, team_members(*)');
      let finalistTeams = [];

      if (supaTeams && supaTeams.length > 0) {
        const formatted = supaTeams.map(st => {
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

          const parsedMembers = (st.team_members || []).map(m => ({
            id: m.id,
            name: m.member_name || '',
            idNo: m.member_id || '',
            phone: m.member_phone || ''
          }));

          const finInfo = getFinalRoundTeamInfo({
            teamName: st.team_name,
            teamIdNo: parsedTeamId,
            main_idea: st.main_idea
          });

          return {
            id: st.id,
            teamName: st.team_name,
            teamIdNo: parsedTeamId,
            leaderName: st.team_leader,
            leaderEmail: st.leader_email,
            leaderPhone: st.leader_phone,
            leaderBranch,
            projectTitle: st.project_title,
            projectType: st.project_type || parseProjectTypeFromTeam(st),
            assignedJudge: st.assigned_judge || 'Unassigned',
            members: parsedMembers,
            totalTeamSize: 1 + parsedMembers.length,
            isFinalist: Boolean(finInfo || (st.assigned_judge && st.assigned_judge.startsWith('FM'))),
            finalistInfo: finInfo
          };
        });

        finalistTeams = formatted.filter(t => t.isFinalist);
      }
      setTeams(finalistTeams);

      // 2. Fetch Evaluations from 'evaluations' table
      const { data: supaEvals } = await supabase.from('evaluations').select('*');
      let combinedEvals = [];
      if (supaEvals && supaEvals.length > 0) {
        combinedEvals = supaEvals.map(se => ({
          id: se.id,
          teamName: se.team_name,
          judgeEmail: (se.judge_email || '').trim().toUpperCase(),
          c1: Number(se.c1_innovation) || 0,
          c2: Number(se.c2_execution) || 0,
          c3: Number(se.c3_feasibility) || 0,
          c4: Number(se.c4_presentation) || 0,
          c5: Number(se.c5_details || se.c5) || 0,
          totalScore: Number(se.total_score) || 0,
          remarks: se.remarks || ''
        }));
      }

      // 3. Also fetch from dedicated 'external_evaluations' table
      try {
        const { data: extEvals } = await supabase.from('external_evaluations').select('*');
        if (extEvals && extEvals.length > 0) {
          extEvals.forEach(ee => {
            const formatted = {
              id: ee.id,
              teamName: ee.team_name,
              teamIdNo: ee.team_id_no,
              judgeEmail: (ee.judge_email || '').trim().toUpperCase(),
              judgeName: ee.judge_name,
              judgeGroup: ee.judge_group,
              c1: Number(ee.c1_innovation) || 0,
              c2: Number(ee.c2_execution) || 0,
              c3: Number(ee.c3_feasibility) || 0,
              c4: Number(ee.c4_presentation) || 0,
              c5: Number(ee.c5_implementation) || 0,
              totalScore: Number(ee.total_score) || 0,
              remarks: ee.remarks || ''
            };

            const existingIdx = combinedEvals.findIndex(ce =>
              (ce.teamName || '').trim().toLowerCase() === (formatted.teamName || '').trim().toLowerCase() &&
              (ce.judgeEmail || '').trim().toUpperCase() === formatted.judgeEmail
            );
            if (existingIdx >= 0) {
              combinedEvals[existingIdx] = { ...combinedEvals[existingIdx], ...formatted };
            } else {
              combinedEvals.push(formatted);
            }
          });
        }
      } catch (extErr) {
        console.warn("External evaluations query notice:", extErr);
      }

      setEvaluations(combinedEvals);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn("Live leaderboard fetch notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Polling interval every 3 seconds for continuous updates
    const pollInterval = setInterval(() => {
      fetchData();
    }, 3000);

    // Supabase Realtime channel for instant push updates
    const liveChannel = supabase
      .channel('public-live-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_evaluations' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(liveChannel);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Compute live Final Round scored leaderboard
  const rawLeaderboard = teams.map(t => {
    const finalScore = computeFinalRoundScoreForTeam(t, evaluations);
    const judgeProfile = JUDGE_PROFILES[t.assignedJudge];
    const judgeDisplay = judgeProfile?.namesText
      ? `${t.assignedJudge} — ${judgeProfile.namesText}`
      : (t.assignedJudge || 'Awaiting Jury');

    return {
      ...t,
      isScored: finalScore.isScored,
      score: finalScore.score,               // Combined Total / 150
      totalScore: finalScore.totalScore,     // Combined Total / 150
      finalScore: finalScore.finalScore,     // External Jury Final / 100
      round2Score: finalScore.round2Score,   // Round 2 / 50
      c1: finalScore.c1,
      c2: finalScore.c2,
      c3: finalScore.c3,
      c4: finalScore.c4,
      c5: finalScore.c5,
      remarks: finalScore.remarks,
      evalCount: finalScore.evalCount,
      extJudgeDisplay: judgeDisplay,
      labLocation: t.finalistInfo?.labLocation || 'CE Dept.'
    };
  });

  // Sort: Scored teams first by total score descending (/150), with tiebreakers: finalScore (/100), round2Score (/50), C1, C2, then pending teams
  const sortedLeaderboard = [...rawLeaderboard].sort((a, b) => {
    if (a.isScored && b.isScored) {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.finalScore || 0) !== (a.finalScore || 0)) return (b.finalScore || 0) - (a.finalScore || 0);
      if ((b.round2Score || 0) !== (a.round2Score || 0)) return (b.round2Score || 0) - (a.round2Score || 0);
      if ((b.c1 || 0) !== (a.c1 || 0)) return (b.c1 || 0) - (a.c1 || 0);
      if ((b.c2 || 0) !== (a.c2 || 0)) return (b.c2 || 0) - (a.c2 || 0);
      return (a.teamIdNo || '').localeCompare(b.teamIdNo || '');
    }
    if (a.isScored && !b.isScored) return -1;
    if (!a.isScored && b.isScored) return 1;
    const trackOrder = { 'software': 1, 'hybrid': 2, 'hardware': 3 };
    const aTrack = trackOrder[(a.projectType || '').toLowerCase()] || 4;
    const bTrack = trackOrder[(b.projectType || '').toLowerCase()] || 4;
    if (aTrack !== bTrack) return aTrack - bTrack;
    return (a.teamIdNo || '').localeCompare(b.teamIdNo || '');
  });

  // Filter by track and search query
  const cleanQuery = searchQuery.trim().toLowerCase();
  const filteredLeaderboard = sortedLeaderboard.filter(t => {
    if (trackFilter !== 'all' && (t.projectType || '').toLowerCase() !== trackFilter.toLowerCase()) {
      return false;
    }
    if (!cleanQuery) return true;
    if (t.teamIdNo && t.teamIdNo.toLowerCase().includes(cleanQuery)) return true;
    if (t.teamName && t.teamName.toLowerCase().includes(cleanQuery)) return true;
    if (t.projectTitle && t.projectTitle.toLowerCase().includes(cleanQuery)) return true;
    if (t.leaderName && t.leaderName.toLowerCase().includes(cleanQuery)) return true;
    if (t.extJudgeDisplay && t.extJudgeDisplay.toLowerCase().includes(cleanQuery)) return true;
    if (t.labLocation && t.labLocation.toLowerCase().includes(cleanQuery)) return true;
    return false;
  });

  // Summary Metrics
  const totalFinalists = sortedLeaderboard.length;
  const scoredCount = sortedLeaderboard.filter(t => t.isScored).length;
  const pendingCount = totalFinalists - scoredCount;
  const percentComplete = totalFinalists > 0 ? Math.round((scoredCount / totalFinalists) * 100) : 0;

  // Top 3 Podium
  const topScoredTeams = sortedLeaderboard.filter(t => t.isScored);
  const firstPlace = topScoredTeams[0] || null;
  const secondPlace = topScoredTeams[1] || null;
  const thirdPlace = topScoredTeams[2] || null;

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#060713',
      color: '#fff',
      padding: isFullscreen ? '20px 30px' : '24px 20px 60px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

        {/* TOP BAR / NAVIGATION */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#aaa',
                border: '1px solid #444',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '0.65rem',
                fontFamily: 'Press Start 2P, monospace'
              }}
            >
              ⬅ PORTAL
            </Link>
            <Link
              href="/admin-dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(253, 255, 0, 0.1)',
                color: '#fdff00',
                border: '1px solid rgba(253, 255, 0, 0.4)',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '0.65rem',
                fontFamily: 'Press Start 2P, monospace'
              }}
            >
              ⚙️ ADMIN
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 0, 85, 0.12)',
              border: '1.5px solid #ff0055',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.6rem',
              fontFamily: 'Press Start 2P, monospace',
              color: '#ff6699',
              boxShadow: '0 0 12px rgba(255, 0, 85, 0.3)'
            }}>
              <span className="live-pulse-dot"></span>
              <span>LIVE SYNC ACTIVE</span>
            </div>

            {lastUpdated && (
              <span style={{ fontSize: '0.65rem', color: '#888' }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(0, 255, 204, 0.15)',
                color: '#00ffcc',
                border: '1.5px solid #00ffcc',
                borderRadius: '6px',
                padding: '6px 12px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.6rem',
                cursor: 'pointer'
              }}
              title="Toggle Fullscreen Projector Mode"
            >
              {isFullscreen ? '🗗 EXIT FULLSCREEN' : '⛶ FULLSCREEN'}
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* HERO TITLE BANNER */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
          background: 'linear-gradient(180deg, rgba(20, 24, 50, 0.8), rgba(10, 12, 28, 0.95))',
          border: '2px solid rgba(0, 255, 204, 0.3)',
          borderRadius: '16px',
          padding: '24px 20px',
          boxShadow: '0 0 30px rgba(0, 255, 204, 0.15)'
        }}>
          <div style={{
            fontSize: '0.7rem',
            fontFamily: 'Press Start 2P, monospace',
            color: '#fdff00',
            letterSpacing: '3px',
            marginBottom: '8px'
          }}>
            MECIA HACKS 3.0 — GRAND FINALE
          </div>
          <h1 style={{
            fontSize: 'clamp(1.4rem, 4vw, 2.4rem)',
            fontFamily: 'Press Start 2P, monospace',
            color: '#fff',
            textShadow: '0 0 20px rgba(0, 255, 204, 0.6), 0 0 40px rgba(0, 255, 204, 0.3)',
            marginBottom: '10px',
            lineHeight: '1.3'
          }}>
            ⚡ LIVE EVALUATION LEADERBOARD ⚡
          </h1>
          <p style={{
            color: '#00ffcc',
            fontSize: '0.85rem',
            maxWidth: '800px',
            margin: '0 auto',
            lineHeight: '1.5'
          }}>
            Live scores entered by External Jury Panels (FM001–FM007). Grand Total: 150 Marks (Round 2: 50 Marks + Final Round: 100 Marks).
          </p>

          {/* KPI METRICS ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginTop: '20px'
          }}>
            <div style={{
              background: 'rgba(0, 255, 204, 0.08)',
              border: '1px solid rgba(0, 255, 204, 0.3)',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'Press Start 2P, monospace', color: '#888', marginBottom: '6px' }}>
                TOTAL FINALISTS
              </div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'Press Start 2P, monospace', color: '#00ffcc' }}>
                {totalFinalists}
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 255, 128, 0.08)',
              border: '1px solid rgba(0, 255, 128, 0.4)',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'Press Start 2P, monospace', color: '#888', marginBottom: '6px' }}>
                SCORED BY JURY
              </div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'Press Start 2P, monospace', color: '#00ff80' }}>
                {scoredCount}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 184, 82, 0.08)',
              border: '1px solid rgba(255, 184, 82, 0.4)',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'Press Start 2P, monospace', color: '#888', marginBottom: '6px' }}>
                PENDING MARKS
              </div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'Press Start 2P, monospace', color: '#ffb852' }}>
                {pendingCount}
              </div>
            </div>

            <div style={{
              background: 'rgba(253, 255, 0, 0.08)',
              border: '1px solid rgba(253, 255, 0, 0.4)',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'Press Start 2P, monospace', color: '#888', marginBottom: '6px' }}>
                COMPLETION
              </div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'Press Start 2P, monospace', color: '#fdff00' }}>
                {percentComplete}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            marginTop: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            height: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentComplete}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #00ffcc, #fdff00)',
              transition: 'width 0.5s ease',
              boxShadow: '0 0 10px rgba(0, 255, 204, 0.8)'
            }} />
          </div>
        </div>

        {/* TOP 3 PODIUM DISPLAY */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}>
          {/* 🥈 2ND PLACE */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(220, 220, 220, 0.12), rgba(10, 15, 30, 0.85))',
            border: '2px solid #c0c0c0',
            borderRadius: '14px',
            padding: '18px',
            textAlign: 'center',
            boxShadow: '0 0 20px rgba(192, 192, 192, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🥈</div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'Press Start 2P, monospace', color: '#c0c0c0', marginBottom: '8px' }}>
                2ND PLACE
              </div>
              {secondPlace ? (
                <>
                  <div style={{ fontSize: '0.68rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                    {secondPlace.teamIdNo}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>
                    {secondPlace.teamName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '8px' }}>
                    {secondPlace.projectTitle || 'N/A'}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#c0c0c0'
                  }}>
                    {secondPlace.projectType}
                  </div>
                </>
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.75rem', padding: '16px 0' }}>
                  Awaiting Evaluation
                </div>
              )}
            </div>
            {secondPlace && (
              <div style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                fontSize: '1.3rem',
                fontFamily: 'Press Start 2P, monospace',
                color: '#c0c0c0'
              }}>
                {secondPlace.score} <span style={{ fontSize: '0.65rem', color: '#888' }}>/ 150</span>
                <div style={{ fontSize: '0.62rem', color: '#aaa', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>
                  R2: <strong>{secondPlace.round2Score}</strong>/50 • Final: <strong>{secondPlace.finalScore}</strong>/100
                </div>
              </div>
            )}
          </div>

          {/* 🥇 1ST PLACE (GOLD PODIUM) */}
          <div className="gold-podium" style={{
            background: 'linear-gradient(180deg, rgba(253, 255, 0, 0.18), rgba(20, 20, 10, 0.9))',
            border: '2.5px solid #fdff00',
            borderRadius: '16px',
            padding: '22px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transform: 'scale(1.02)'
          }}>
            <div>
              <div style={{ fontSize: '2.4rem', marginBottom: '4px' }}>👑 🥇</div>
              <div style={{ fontSize: '0.82rem', fontFamily: 'Press Start 2P, monospace', color: '#fdff00', marginBottom: '10px', letterSpacing: '1px' }}>
                CURRENT LEADER
              </div>
              {firstPlace ? (
                <>
                  <div style={{ fontSize: '0.75rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                    {firstPlace.teamIdNo}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                    {firstPlace.teamName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#ccc', marginBottom: '10px' }}>
                    {firstPlace.projectTitle || 'N/A'}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(253, 255, 0, 0.2)',
                    border: '1px solid #fdff00',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    color: '#fdff00',
                    fontWeight: 'bold'
                  }}>
                    {firstPlace.projectType}
                  </div>
                </>
              ) : (
                <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.8rem', padding: '20px 0' }}>
                  Awaiting External Jury Submissions
                </div>
              )}
            </div>
            {firstPlace && (
              <div style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px dashed rgba(253, 255, 0, 0.3)',
                fontSize: '1.6rem',
                fontFamily: 'Press Start 2P, monospace',
                color: '#fdff00',
                textShadow: '0 0 15px rgba(253, 255, 0, 0.6)'
              }}>
                {firstPlace.score} <span style={{ fontSize: '0.75rem', color: '#aaa' }}>/ 150</span>
                <div style={{ fontSize: '0.65rem', color: '#fdff00', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>
                  R2: <strong>{firstPlace.round2Score}</strong>/50 • Final: <strong>{firstPlace.finalScore}</strong>/100
                </div>
              </div>
            )}
          </div>

          {/* 🥉 3RD PLACE */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(205, 127, 50, 0.12), rgba(10, 15, 30, 0.85))',
            border: '2px solid #cd7f32',
            borderRadius: '14px',
            padding: '18px',
            textAlign: 'center',
            boxShadow: '0 0 20px rgba(205, 127, 50, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🥉</div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'Press Start 2P, monospace', color: '#cd7f32', marginBottom: '8px' }}>
                3RD PLACE
              </div>
              {thirdPlace ? (
                <>
                  <div style={{ fontSize: '0.68rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                    {thirdPlace.teamIdNo}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>
                    {thirdPlace.teamName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '8px' }}>
                    {thirdPlace.projectTitle || 'N/A'}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#cd7f32'
                  }}>
                    {thirdPlace.projectType}
                  </div>
                </>
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.75rem', padding: '16px 0' }}>
                  Awaiting Evaluation
                </div>
              )}
            </div>
            {thirdPlace && (
              <div style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                fontSize: '1.3rem',
                fontFamily: 'Press Start 2P, monospace',
                color: '#cd7f32'
              }}>
                {thirdPlace.score} <span style={{ fontSize: '0.65rem', color: '#888' }}>/ 150</span>
                <div style={{ fontSize: '0.62rem', color: '#aaa', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>
                  R2: <strong>{thirdPlace.round2Score}</strong>/50 • Final: <strong>{thirdPlace.finalScore}</strong>/100
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONTROLS: TRACK FILTER & SEARCH */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '14px 18px'
        }}>
          {/* Track Filters */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `ALL TRACKS (${sortedLeaderboard.length})`, color: '#fdff00' },
              { id: 'software', label: `SOFTWARE (${sortedLeaderboard.filter(t => (t.projectType || '').toLowerCase() === 'software').length})`, color: '#00ffcc' },
              { id: 'hybrid', label: `HYBRID (${sortedLeaderboard.filter(t => (t.projectType || '').toLowerCase() === 'hybrid').length})`, color: '#ff66cc' },
              { id: 'hardware', label: `HARDWARE (${sortedLeaderboard.filter(t => (t.projectType || '').toLowerCase() === 'hardware').length})`, color: '#ffb852' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTrackFilter(f.id)}
                style={{
                  background: trackFilter === f.id ? `rgba(255, 255, 255, 0.15)` : 'rgba(0, 0, 0, 0.3)',
                  color: trackFilter === f.id ? f.color : '#888',
                  border: trackFilter === f.id ? `1.5px solid ${f.color}` : '1px solid #444',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.6rem',
                  fontFamily: 'Press Start 2P, monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: trackFilter === f.id ? `0 0 10px ${f.color}40` : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div style={{ minWidth: '260px' }}>
            <input
              type="text"
              placeholder="🔍 Search team, ID, project, lab..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid #444',
                borderRadius: '6px',
                padding: '8px 14px',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* LIVE LEADERBOARD TABLE */}
        <div style={{
          overflowX: 'auto',
          background: 'rgba(10, 12, 25, 0.95)',
          border: '1px solid rgba(0, 255, 204, 0.3)',
          borderRadius: '12px',
          boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                background: 'rgba(0, 255, 204, 0.12)',
                borderBottom: '2px solid #00ffcc',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                color: '#00ffcc'
              }}>
                <th style={{ padding: '14px 8px', textAlign: 'center', width: '60px' }}>RANK</th>
                <th style={{ padding: '14px 8px', textAlign: 'center', width: '80px' }}>TEAM ID</th>
                <th style={{ padding: '14px 12px' }}>TEAM NAME & PROJECT</th>
                <th style={{ padding: '14px 8px', textAlign: 'center' }}>TRACK</th>
                <th style={{ padding: '14px 8px' }}>EXTERNAL JURY PANEL</th>
                <th style={{ padding: '14px 8px', textAlign: 'center', color: '#00ffcc', width: '85px' }} title="Round 2 Evaluation Marks (Max 50)">ROUND 2 (50)</th>
                <th style={{ padding: '14px 6px', textAlign: 'center' }} title="Working MVP & Functional Execution (Max 20)">MVP (20)</th>
                <th style={{ padding: '14px 6px', textAlign: 'center' }} title="Technical Complexity & Integration (Max 20)">TECH (20)</th>
                <th style={{ padding: '14px 6px', textAlign: 'center' }} title="Innovation & Problem Impact (Max 20)">INNO (20)</th>
                <th style={{ padding: '14px 6px', textAlign: 'center' }} title="UI/UX, Design & Form Factor (Max 20)">UI/UX (20)</th>
                <th style={{ padding: '14px 6px', textAlign: 'center' }} title="Presentation & Pitch Demo (Max 20)">PITCH (20)</th>
                <th style={{ padding: '14px 8px', textAlign: 'center', color: '#00ffcc', width: '95px' }} title="Final Round External Jury Marks (Max 100)">FINAL (100)</th>
                <th style={{ padding: '14px 10px', textAlign: 'center', color: '#fdff00', width: '115px' }} title="Grand Total: Round 2 (50) + Final Round (100) = 150 Marks">TOTAL (150)</th>
                <th style={{ padding: '14px 8px', textAlign: 'center', width: '90px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan="14" style={{ textAlign: 'center', padding: '40px 16px', color: '#888' }}>
                    {loading ? 'Loading live leaderboard data...' : 'No finalist teams matching the criteria.'}
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((item, index) => {
                  let rankBadge = '-';
                  let rowBg = 'transparent';

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

                  const typeInfo = getProjectTypeInfo(item.projectType);

                  return (
                    <tr
                      key={item.id || item.teamName}
                      style={{
                        background: rowBg,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Rank */}
                      <td style={{
                        textAlign: 'center',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: index === 0 && item.isScored ? '#fdff00' : index === 1 && item.isScored ? '#e0e0e0' : index === 2 && item.isScored ? '#cd7f32' : '#888'
                      }}>
                        {rankBadge}
                      </td>

                      {/* Team ID */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(253, 255, 0, 0.12)',
                          color: '#fdff00',
                          border: '1px solid rgba(253, 255, 0, 0.5)',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.62rem',
                          fontWeight: 'bold'
                        }}>
                          {item.teamIdNo || 'N/A'}
                        </span>
                      </td>

                      {/* Team Name, Project, Location, Members */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.teamName}</span>
                          {index === 0 && item.isScored && <span style={{ fontSize: '0.85rem' }}>👑</span>}
                        </div>
                        {item.projectTitle && (
                          <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>
                            💡 {item.projectTitle}
                          </div>
                        )}
                        <div style={{ fontSize: '0.68rem', color: '#fdff00', marginTop: '3px', fontWeight: 'bold' }}>
                          📍 {item.labLocation}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px' }}>
                          👑 {item.leaderName} {item.members?.length > 0 && `(+${item.members.length} members)`}
                        </div>
                      </td>

                      {/* Track */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.58rem',
                          fontFamily: 'Press Start 2P, monospace',
                          color: typeInfo.color,
                          background: typeInfo.bg,
                          border: `1px solid ${typeInfo.border}`,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* External Jury Panel */}
                      <td style={{ fontSize: '0.75rem', color: '#ddd', maxWidth: '200px' }}>
                        <div style={{ color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', fontSize: '0.62rem' }}>
                          {item.assignedJudge}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>
                          {item.extJudgeDisplay}
                        </div>
                      </td>

                      {/* Round 2 Marks */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(0, 255, 204, 0.12)',
                          color: '#00ffcc',
                          border: '1px solid rgba(0, 255, 204, 0.4)',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.72rem',
                          fontWeight: 'bold'
                        }}>
                          {item.round2Score ?? '-'}
                        </span>
                        <span style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginTop: '2px' }}>
                          / 50
                        </span>
                      </td>

                      {/* Criteria Scores */}
                      <td style={{ textAlign: 'center', color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        {item.c1}
                      </td>
                      <td style={{ textAlign: 'center', color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        {item.c2}
                      </td>
                      <td style={{ textAlign: 'center', color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        {item.c3}
                      </td>
                      <td style={{ textAlign: 'center', color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        {item.c4}
                      </td>
                      <td style={{ textAlign: 'center', color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        {item.c5}
                      </td>

                      {/* Final Round Score (100) */}
                      <td style={{
                        textAlign: 'center',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: item.isScored ? '#00ffcc' : '#666'
                      }}>
                        {item.isScored ? `${item.finalScore}` : '-'}
                        <span style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginTop: '2px' }}>
                          {item.isScored ? '/ 100' : 'PENDING'}
                        </span>
                      </td>

                      {/* Total Score (150) */}
                      <td style={{
                        textAlign: 'center',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: item.isScored ? '#fdff00' : '#666',
                        textShadow: item.isScored ? '0 0 10px rgba(253, 255, 0, 0.4)' : 'none'
                      }}>
                        {item.isScored ? `${item.score}` : '-'}
                        <span style={{ fontSize: '0.55rem', color: '#888', display: 'block', marginTop: '2px' }}>
                          {item.isScored ? '/ 150' : 'PENDING'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {item.isScored ? (
                          <span style={{
                            display: 'inline-block',
                            background: 'rgba(0, 255, 128, 0.15)',
                            color: '#00ff80',
                            border: '1px solid #00ff80',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.55rem',
                            fontFamily: 'Press Start 2P, monospace',
                            fontWeight: 'bold'
                          }}>
                            SCORED
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            background: 'rgba(255, 184, 82, 0.15)',
                            color: '#ffb852',
                            border: '1px solid #ffb852',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.55rem',
                            fontFamily: 'Press Start 2P, monospace'
                          }}>
                            PENDING
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER TICKER */}
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.62rem',
          fontFamily: 'Press Start 2P, monospace',
          lineHeight: '1.8'
        }}>
          <div>MECIA HACKS 3.0 • GRAND FINALE LEADERBOARD SYSTEM (TOTAL 150 MARKS)</div>
          <div style={{ color: '#00ffcc', marginTop: '4px' }}>
            TOTAL QUALIFIED FINALISTS: {FINAL_ROUND_STATS.totalTeams} ({FINAL_ROUND_STATS.softwareTeams} SOFTWARE • {FINAL_ROUND_STATS.hybridTeams} HYBRID • {FINAL_ROUND_STATS.hardwareTeams} HARDWARE)
          </div>
        </div>

      </div>
    </div>
  );
}
