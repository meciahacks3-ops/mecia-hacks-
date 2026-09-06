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
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState('ALL'); // 'ALL', 'Software', 'Hybrid', 'Hardware'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'EVALUATED', 'PENDING'

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
      let combinedEvals = [];
      if (supaEvals && supaEvals.length > 0) {
        combinedEvals = supaEvals.map(parseEvaluationRecord).filter(Boolean);
      }

      // 3. Also fetch from dedicated external_evaluations table if available
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
              remarks: ee.remarks || '',
              updatedAt: ee.updated_at
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
      } catch (extQueryErr) {
        console.warn("external_evaluations query notice (table may not exist yet):", extQueryErr);
      }

      // 4. Also fetch from dedicated internal_evaluations table if available
      try {
        const { data: intEvals } = await supabase.from('internal_evaluations').select('*');
        if (intEvals && intEvals.length > 0) {
          intEvals.forEach(ie => {
            const p1 = ie.phase1_feedback || '';
            const p2 = ie.phase2_feedback || '';
            const formatted = {
              id: ie.id,
              teamName: ie.team_name,
              teamIdNo: ie.team_id_no,
              judgeEmail: (ie.judge_email || '').trim().toUpperCase(),
              judgeName: ie.judge_name,
              judgeGroup: ie.judge_group,
              c1: 0,
              c2: 0,
              c3: 0,
              c4: 0,
              c5: 0,
              totalScore: 0,
              remarks: ie.remarks || (p1 || p2 ? formatPhaseFeedback(p1, p2) : ''),
              phase1Feedback: p1,
              phase2Feedback: p2,
              hasPhase1: Boolean(p1 && p1.trim()),
              hasPhase2: Boolean(p2 && p2.trim()),
              hasPhases: Boolean((p1 && p1.trim()) || (p2 && p2.trim())),
              updatedAt: ie.updated_at
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
      } catch (intQueryErr) {
        console.warn("internal_evaluations query notice (table may not exist yet):", intQueryErr);
      }

      setEvaluations(combinedEvals);
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

  const cleanJudgeUpper = (judgeEmail || '').trim().toUpperCase();
  const isMentorJudge = cleanJudgeUpper.startsWith('MM');
  const isExternalRound3Judge = cleanJudgeUpper.startsWith('FM');
  const isFinalRoundJudge = isMentorJudge;
  const judgeProfile = getJudgeProfile(judgeEmail);

  // Pool of teams:
  // External Jury (FM001-FM007) and Internal Jury (MM001-MM010) see ALL teams without panel restrictions.
  // Legacy judges fall back to assigned teams if assigned, otherwise all teams.
  const availableTeams = (isExternalRound3Judge || isMentorJudge)
    ? teams
    : teams.filter(t => {
        if (!t.assignedJudge) return true;
        return t.assignedJudge.toLowerCase().trim() === judgeEmail.toLowerCase().trim();
      });

  const finalistTeams = availableTeams.filter(t => t.isFinalist);

  // Sorting: Finalists sorted by Track (Software, Hybrid, Hardware), then Rank, then Team ID
  const sortedTeams = [...availableTeams].sort((a, b) => {
    if (a.isFinalist !== b.isFinalist) return a.isFinalist ? -1 : 1;
    const trackOrder = { 'Software': 1, 'Hybrid': 2, 'Hardware': 3 };
    const aTrack = trackOrder[a.finalistInfo?.track] || 4;
    const bTrack = trackOrder[b.finalistInfo?.track] || 4;
    if (aTrack !== bTrack) return aTrack - bTrack;
    const aRank = a.finalistInfo?.categoryRank || 999;
    const bRank = b.finalistInfo?.categoryRank || 999;
    if (aRank !== bRank) return aRank - bRank;
    return (a.teamIdNo || '').localeCompare(b.teamIdNo || '');
  });

  // Calculate evaluation stats for this logged-in judge
  const evaluatedTeamNames = new Set(
    evaluations
      .filter(e => {
        const jEmail = (e.judgeEmail || '').trim().toUpperCase();
        if (jEmail !== cleanJudgeUpper) return false;
        if (isFinalRoundJudge) {
          return Boolean(e.remarks && e.remarks.trim());
        }
        return e.totalScore !== undefined && e.totalScore !== null;
      })
      .map(e => (e.teamName || '').trim().toLowerCase())
  );

  const finalistEvaluatedCount = finalistTeams.filter(t => evaluatedTeamNames.has((t.teamName || '').trim().toLowerCase())).length;
  const finalistPendingCount = Math.max(0, finalistTeams.length - finalistEvaluatedCount);

  // Filtered teams based on finalists toggle, track, status, and search query
  const displayedAssignedTeams = sortedTeams.filter(t => {
    if (finalistsOnlyFilter && !t.isFinalist) return false;

    if (trackFilter !== 'ALL') {
      const tTrack = t.finalistInfo?.track || '';
      if (tTrack.toLowerCase() !== trackFilter.toLowerCase()) return false;
    }

    const isDone = evaluatedTeamNames.has((t.teamName || '').trim().toLowerCase());
    if (statusFilter === 'EVALUATED' && !isDone) return false;
    if (statusFilter === 'PENDING' && isDone) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (t.teamName || '').toLowerCase().includes(q);
      const idMatch = (t.teamIdNo || '').toLowerCase().includes(q);
      const titleMatch = (t.projectTitle || '').toLowerCase().includes(q);
      const locMatch = (t.labLocation || '').toLowerCase().includes(q);
      const trackMatch = (t.finalistInfo?.track || '').toLowerCase().includes(q);
      if (!nameMatch && !idMatch && !titleMatch && !locMatch && !trackMatch) return false;
    }

    return true;
  });

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
          padding: '18px 22px',
          marginBottom: '24px',
          boxShadow: '0 0 20px rgba(253, 255, 0, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.8rem' }}>🏆</span>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Press Start 2P, monospace', fontSize: '0.8rem', color: '#fdff00', letterSpacing: '1px' }}>
                  {isMentorJudge ? 'STAGE 3: INTERNAL JURY MENTOR PANEL' : isExternalRound3Judge ? 'ROUND 3: GRAND FINALE EXTERNAL JURY PANEL' : 'STAGE 3: FINAL ROUND EVALUATIONS ACTIVE'}
                </h3>
                <p style={{ margin: '6px 0 0 0', color: '#ccc', fontSize: '0.76rem', lineHeight: '1.5' }}>
                  {isExternalRound3Judge
                    ? `Open Grand Finale access: All ${finalistTeams.length} qualified finalist teams are open to your jury panel (${judgeEmail.toUpperCase()}). You can evaluate and score any team across all 5 official evaluation rubrics (50 marks max).`
                    : isMentorJudge
                    ? `Open Mentorship access: All ${finalistTeams.length} qualified finalist teams are open to your mentor panel (${judgeEmail.toUpperCase()}) for Phase 1 and Phase 2 feedback.`
                    : `Evaluating qualified finalist teams. All finalist teams are available to evaluate.`}
                </p>
              </div>
            </div>

            {/* Quick Live Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid #00ffcc',
                color: '#00ffcc',
                padding: '4px 10px',
                borderRadius: '6px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                fontWeight: 'bold'
              }}>
                🏆 TOTAL FINALISTS: {finalistTeams.length}
              </span>
              <span style={{
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid #fdff00',
                color: '#fdff00',
                padding: '4px 10px',
                borderRadius: '6px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                fontWeight: 'bold'
              }}>
                {isFinalRoundJudge ? '💬 FEEDBACK RECORDED: ' : '⭐ EVALUATED BY YOU: '}{finalistEvaluatedCount} / {finalistTeams.length}
              </span>
              <span style={{
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: finalistPendingCount === 0 ? '#00ffcc' : '#ff9999',
                padding: '4px 10px',
                borderRadius: '6px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                fontWeight: 'bold'
              }}>
                ⏳ PENDING: {finalistPendingCount}
              </span>
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
              🏆 FINALISTS ONLY ({finalistTeams.length})
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
              ALL TEAMS ({availableTeams.length})
            </button>
          </div>
        </div>

        {/* Search & Filter Controls Bar */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.75)',
          border: '1.5px solid rgba(0, 255, 204, 0.35)',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 0 15px rgba(0, 255, 204, 0.15)'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="🔍 Search teams by name, ID (e.g. SM013), lab venue (e.g. S2 Lab), or project title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 42px 12px 16px',
                fontSize: '0.9rem',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.85)',
                border: '1.5px solid rgba(0, 255, 204, 0.5)',
                color: '#ffffff',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#ff6666',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Track Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: '#888', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', marginRight: '4px' }}>TRACK:</span>
              {[
                { label: 'ALL TRACKS', val: 'ALL' },
                { label: '💻 SOFTWARE', val: 'Software' },
                { label: '⚡ HYBRID', val: 'Hybrid' },
                { label: '⚙️ HARDWARE', val: 'Hardware' }
              ].map(t => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setTrackFilter(t.val)}
                  style={{
                    background: trackFilter === t.val ? '#00ffcc' : 'rgba(255, 255, 255, 0.06)',
                    color: trackFilter === t.val ? '#000' : '#ccc',
                    border: `1px solid ${trackFilter === t.val ? '#00ffcc' : 'rgba(255, 255, 255, 0.15)'}`,
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontFamily: 'Press Start 2P, monospace',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: '#888', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', marginRight: '4px' }}>STATUS:</span>
              {[
                { label: 'ALL', val: 'ALL' },
                { label: `✅ EVALUATED (${finalistEvaluatedCount})`, val: 'EVALUATED' },
                { label: `⏳ PENDING (${finalistPendingCount})`, val: 'PENDING' }
              ].map(s => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => setStatusFilter(s.val)}
                  style={{
                    background: statusFilter === s.val ? '#fdff00' : 'rgba(255, 255, 255, 0.06)',
                    color: statusFilter === s.val ? '#000' : '#ccc',
                    border: `1px solid ${statusFilter === s.val ? '#fdff00' : 'rgba(255, 255, 255, 0.15)'}`,
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontFamily: 'Press Start 2P, monospace',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard Title Header */}
        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge eval-badge" style={{ background: '#fdff00', color: '#000', fontWeight: 'bold' }}>
              {isMentorJudge ? 'STAGE 3: INTERNAL JURY PANEL' : isExternalRound3Judge ? 'ROUND 3: EXTERNAL JURY PANEL' : 'STAGE 3: FINAL ROUND EVALUATION PANEL'}
            </span>
          </div>
          <h2>{isExternalRound3Judge ? 'ROUND 3: ALL FINALIST TEAMS' : isMentorJudge ? 'ALL FINALIST TEAMS FOR FEEDBACK' : 'FINAL ROUND TEAMS'} ({displayedAssignedTeams.length})</h2>
          <p>
            {isExternalRound3Judge
              ? `Open evaluation: All 49 qualified finalist teams are open to all judges. You can evaluate and score any finalist team across all 5 official evaluation rubrics (50 marks max).`
              : isMentorJudge
              ? `Open feedback: All 49 qualified finalist teams are open to all internal judges. You can view or add Phase 1 and Phase 2 feedback for any finalist team.`
              : (finalistsOnlyFilter
                  ? `Review Final Round qualified submissions and assign scores.`
                  : `Viewing all teams in the hackathon portal.`)}
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
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teams match your current search and filter settings.</p>
                {(searchQuery || trackFilter !== 'ALL' || statusFilter !== 'ALL') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setTrackFilter('ALL');
                      setStatusFilter('ALL');
                      setFinalistsOnlyFilter(true);
                    }}
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
                    🔄 RESET SEARCH &amp; FILTERS
                  </button>
                ) : (
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
                    VIEW ALL TEAMS ({availableTeams.length})
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
