'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RubricsModal from '@/app/components/RubricsModal';
import { getJudgeProfile } from '@/lib/judgeProfiles';
import { parseTimeSlotFromTeam, getTimeSlotInfo } from '@/lib/timeSlotUtils';
import { parseEvaluationRecord } from '@/lib/teamUtils';
import { isFinalRoundTeam, getFinalRoundTeamInfo } from '@/lib/finalRoundTeams';

function JudgeEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamParam = searchParams.get('team') || '';

  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teamName, setTeamName] = useState(teamParam || 'Select Team');
  const [teamIdNo, setTeamIdNo] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [timeSlot, setTimeSlot] = useState('TBA');

  // Rubric scores (Round 2 Evaluation Sheet - Max 10 marks per section)
  const [c1, setC1] = useState(0); // System Architecture & Technical Readiness (Max 10)
  const [c2, setC2] = useState(0); // Interface/Circuit / Prototype Scope (Max 10)
  const [c3, setC3] = useState(0); // Data, API / Hardware Component Availability (Max 10)
  const [c4, setC4] = useState(0); // Execution Feasibility & Timeline (Max 10)
  const [c5, setC5] = useState(0); // Implementation Details (Max 10)
  const [remarks, setRemarks] = useState('');
  const [isLocked, setIsLocked] = useState(false); // Closed editing feature for evaluated teams
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);
  const [selectedRubricCategory, setSelectedRubricCategory] = useState(null);

  const isFinalRoundJudge = (judgeEmail || '').trim().toUpperCase().startsWith('MM');

  const isInvalid = (val) => {
    if (val === '' || val === null || val === undefined) return false;
    const num = Number(val);
    return isNaN(num) || num < 0 || num > 10;
  };

  const hasInvalidMarks = isInvalid(c1) || isInvalid(c2) || isInvalid(c3) || isInvalid(c4) || isInvalid(c5);

  const totalScore = hasInvalidMarks
    ? 'INVALID'
    : Math.min(50, Math.max(0, (parseInt(c1) || 0) + (parseInt(c2) || 0) + (parseInt(c3) || 0) + (parseInt(c4) || 0) + (parseInt(c5) || 0)));

  useEffect(() => {
    const savedJudgeEmail = sessionStorage.getItem('judgeEmail');
    if (savedJudgeEmail) setJudgeEmail(savedJudgeEmail);

    if (teamParam) {
      setTeamName(teamParam);
      loadExistingMarks(teamParam);
    }
  }, [teamParam]);

  const loadExistingMarks = async (name) => {
    try {
      // 1. Fetch team metadata (only team ID, title, description - personal details hidden)
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, team_name, team_id_no, project_title, main_idea')
        .ilike('team_name', name)
        .maybeSingle();

      if (teamData) {
        let parsedTeamId = teamData.team_id_no && teamData.team_id_no.trim() !== 'N/A' ? teamData.team_id_no.trim() : '';
        if (!parsedTeamId && teamData.main_idea && teamData.main_idea.includes('Team ID:')) {
          const match = teamData.main_idea.match(/Team ID:\s*([^\]\n|]+)/i);
          if (match && match[1]) parsedTeamId = match[1].trim();
        }

        let cleanDesc = (teamData.main_idea || '').trim();
        if (cleanDesc.includes('[Type:') || cleanDesc.includes('[type:') || cleanDesc.includes('[Slot:')) {
          cleanDesc = cleanDesc.replace(/\[[^\]]+\]\s*/g, '').trim();
        }

        const parsedSlot = parseTimeSlotFromTeam(teamData);
        setTimeSlot(parsedSlot);
        setTeamIdNo(parsedTeamId || 'N/A');
        setProjectTitle(teamData.project_title || 'N/A');
        setProjectDesc(cleanDesc || teamData.main_idea || 'No description provided.');
      }

      // 2. Fetch marks / feedback
      const currentJudge = sessionStorage.getItem('judgeEmail') || judgeEmail;
      const isFinal = (currentJudge || '').trim().toUpperCase().startsWith('MM');

      let evalQuery = supabase.from('evaluations').select('*').ilike('team_name', name);
      if (isFinal) {
        evalQuery = evalQuery.ilike('judge_email', currentJudge.trim());
      }
      const { data, error } = await evalQuery.maybeSingle();

      if (data && !error) {
        const parsed = parseEvaluationRecord(data);
        if (parsed) {
          setC1(parsed.c1);
          setC2(parsed.c2);
          setC3(parsed.c3);
          setC4(parsed.c4);
          setC5(parsed.c5);
          const rawRemarks = parsed.remarks || '';
          setRemarks(rawRemarks.replace(/\[C5(?:\s+Implementation)?:\s*\d+(?:\/10)?\]\s*/gi, '').trim());
          if (!isFinal) {
            setIsLocked(true); // Locked for marks in Round 2
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn("Supabase fetch marks warning:", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFinalRoundJudge && isLocked) {
      alert("🔒 Editing Closed: Marks for this team have already been submitted and locked by the administration.");
      return;
    }

    if (!isFinalRoundJudge && hasInvalidMarks) {
      alert("⚠️ Invalid Marks: Scores for each criterion must be between 0 and 10.");
      return;
    }

    if (isFinalRoundJudge && !remarks.trim()) {
      alert("⚠️ Feedback Required: Please enter your feedback and recommendations for this team before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanJudge = (judgeEmail || '').trim().toUpperCase();
      const { data: existingEval } = await supabase
        .from('evaluations')
        .select('id')
        .ilike('team_name', teamName)
        .ilike('judge_email', cleanJudge)
        .maybeSingle();

      let evalPayload;
      if (isFinalRoundJudge) {
        evalPayload = {
          team_name: teamName,
          judge_email: cleanJudge,
          c1_innovation: 0,
          c2_execution: 0,
          c3_feasibility: 0,
          c4_presentation: 0,
          total_score: 0,
          remarks: remarks.trim(),
          updated_at: new Date()
        };
      } else {
        const numC1 = parseInt(c1) || 0;
        const numC2 = parseInt(c2) || 0;
        const numC3 = parseInt(c3) || 0;
        const numC4 = parseInt(c4) || 0;
        const numC5 = parseInt(c5) || 0;

        const cleanRemarks = remarks.replace(/\[C5(?:\s+Implementation)?:\s*\d+(?:\/10)?\]\s*/gi, '').trim();
        const formattedRemarks = `[C5 Implementation: ${numC5}/10] ${cleanRemarks}`.trim();
        const calculatedTotal = numC1 + numC2 + numC3 + numC4 + numC5;
        const totalNum = totalScore === 'INVALID' ? 0 : calculatedTotal;

        evalPayload = {
          team_name: teamName,
          judge_email: cleanJudge,
          c1_innovation: numC1,
          c2_execution: numC2,
          c3_feasibility: numC3,
          c4_presentation: numC4,
          total_score: totalNum,
          remarks: formattedRemarks,
          updated_at: new Date()
        };
      }

      let evalErr = null;
      if (existingEval && existingEval.id) {
        const { error } = await supabase
          .from('evaluations')
          .update(evalPayload)
          .eq('id', existingEval.id);
        evalErr = error;
      } else {
        const { error } = await supabase
          .from('evaluations')
          .insert([evalPayload]);
        evalErr = error;
      }

      if (evalErr) {
        console.error("Supabase evaluation save error:", evalErr);
        alert("Database Notice: " + evalErr.message);
        setIsSubmitting(false);
        return;
      }

      setShowModal(true);
    } catch (err) {
      console.warn("Evaluation submit error:", err);
    } finally {
      setIsSubmitting(false);
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

  const judgeProfile = getJudgeProfile(judgeEmail);

  return (
    <>
      <div className="scanlines"></div>

      <div className="judge-container">
        {/* Navigation Bar: Top-Left Return & Judge Profile */}
        <div className="nav-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button type="button" className="nav-back-btn" onClick={() => router.push('/judge-dashboard')}>
              <span className="pacman-bullet" style={{ transform: 'rotate(180deg)', width: '10px', height: '10px', margin: 0 }}></span>
              RETURN TO DASHBOARD
            </button>
            <div style={{
              background: 'rgba(0, 0, 0, 0.85)',
              border: '1.5px solid var(--neon-cyan, #00ffcc)',
              boxShadow: '0 0 12px rgba(0, 255, 204, 0.25)',
              borderRadius: '8px',
              padding: '8px 14px',
              maxWidth: '550px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="ghost cyan-ghost" style={{ width: '12px', height: '12px', display: 'inline-block' }}></span>
                <span style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '0.62rem', color: '#00ffcc' }}>
                  JUDGE PANEL: {judgeEmail.toUpperCase()} {judgeProfile?.group ? `• ${judgeProfile.group}` : ''}
                </span>
              </div>
              {judgeProfile ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px', marginTop: '4px' }}>
                    {judgeProfile.names.map((name, idx) => (
                      <div key={idx} style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#00ffcc', fontSize: '0.65rem' }}>▸</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                  {judgeProfile.location && (
                    <div style={{ color: '#fdff00', fontSize: '0.68rem', fontWeight: '600', borderTop: '1px dashed rgba(255, 255, 255, 0.15)', paddingTop: '4px' }}>
                      📍 {judgeProfile.location}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600' }}>
                  👨‍⚖️ Authorized Evaluation Judge Panel
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

        <RubricsModal
          isOpen={showRubrics}
          categoryIndex={selectedRubricCategory}
          onClose={() => setShowRubrics(false)}
        />

        {/* Team Banner Header */}
        {(() => {
          const finalistInfo = getFinalRoundTeamInfo({ teamName, teamIdNo });
          const isFinalist = Boolean(finalistInfo);

          return (
            <div className="login-header text-left team-banner-section">
              <div className="badge-wrapper">
                <span className="role-badge eval-badge" style={isFinalist ? { background: '#fdff00', color: '#000', fontWeight: 'bold' } : {}}>
                  {isFinalist ? 'STAGE 3: FINAL ROUND EVALUATION' : 'STAGE 2: RUBRIC EVALUATION'}
                </span>
              </div>
              <h2>EVALUATING: <span className="highlight-title">{teamName}</span></h2>

              {isFinalist ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(253, 255, 0, 0.15) 0%, rgba(0, 255, 204, 0.15) 100%)',
                  border: '2px solid #fdff00',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginTop: '14px',
                  boxShadow: '0 0 15px rgba(253, 255, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.6rem' }}>🏆</span>
                    <div>
                      <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '0.72rem', color: '#fdff00', fontWeight: 'bold' }}>
                        OFFICIAL FINAL ROUND QUALIFIER
                      </div>
                      <div style={{ color: '#ccc', fontSize: '0.74rem', marginTop: '4px' }}>
                        Track: <strong style={{ color: '#00ffcc' }}>{finalistInfo.track} Track</strong> • Qualifier Rank: <strong style={{ color: '#fdff00' }}>{finalistInfo.rank}</strong> • Round 2 Score: <strong style={{ color: '#ff66cc' }}>{finalistInfo.score}/50</strong>
                      </div>
                    </div>
                  </div>
                  <span style={{
                    background: '#fdff00',
                    color: '#000',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.58rem',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    FINALIST TEAM
                  </span>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255, 77, 77, 0.1)',
                  border: '1.5px dashed #ff4d4d',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginTop: '12px',
                  color: '#ff8888',
                  fontSize: '0.78rem'
                }}>
                  ⚠️ Notice: This team is not listed in the 49 Final Round Qualifiers. Final round evaluations are intended for the 49 qualified finalist teams.
                </div>
              )}

          <div style={{
            marginTop: '14px',
            background: 'rgba(0, 0, 0, 0.75)',
            border: '1.5px solid rgba(0, 255, 204, 0.35)',
            borderRadius: '8px',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#00ffcc', fontSize: '0.82rem', fontWeight: 'bold' }}>🆔 TEAM ID: </span>
                <span style={{ color: '#fdff00', fontWeight: 'bold', fontSize: '0.92rem' }}>{teamIdNo || 'N/A'}</span>
              </div>
              {!isFinalRoundJudge && (
                <div>
                  <span style={{ color: '#00ffcc', fontSize: '0.82rem', fontWeight: 'bold' }}>⏰ TIME SLOT: </span>
                  <span style={{
                    color: getTimeSlotInfo(timeSlot).badgeColor,
                    fontWeight: 'bold',
                    fontSize: '0.82rem',
                    fontFamily: 'Press Start 2P, monospace',
                    background: getTimeSlotInfo(timeSlot).badgeBg,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${getTimeSlotInfo(timeSlot).badgeBorder}`
                  }}>
                    {timeSlot === 'TBA' ? '⏳ TBA (UNALLOCATED)' : timeSlot}
                  </span>
                </div>
              )}
              <div>
                <span style={{ color: '#00ffcc', fontSize: '0.82rem', fontWeight: 'bold' }}>💡 PROJECT TITLE: </span>
                <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '0.92rem' }}>{projectTitle || 'N/A'}</span>
              </div>
            </div>
            {projectDesc && (
              <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.15)', paddingTop: '8px' }}>
                <span style={{ color: '#00ffcc', fontSize: '0.82rem', fontWeight: 'bold' }}>🎯 PROJECT DESCRIPTION: </span>
                <p style={{ color: '#e0e0e0', fontSize: '0.88rem', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {projectDesc}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    })()}

        {/* Evaluation / Feedback Form */}
        <form onSubmit={handleSubmit}>
          {isFinalRoundJudge ? (
            <div className="form-section">
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 255, 204, 0.12), rgba(0, 100, 255, 0.1))',
                border: '1.5px solid #00ffcc',
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 0 15px rgba(0, 255, 204, 0.2)'
              }}>
                <div>
                  <h3 className="section-title" style={{ margin: 0, color: '#00ffcc', fontSize: '0.88rem' }}>
                    <span className="pacman-bullet"></span> 💬 FINAL ROUND TEAM FEEDBACK
                  </h3>
                  <p style={{ color: '#ccc', fontSize: '0.78rem', marginTop: '6px', margin: 0, lineHeight: '1.5' }}>
                    Logged in as Final Round Judge <strong>{judgeEmail.toUpperCase()}</strong>. Final Round evaluation is strictly qualitative feedback &amp; mentorship guidance. Numeric marks are disabled.
                  </p>
                </div>
                <span style={{
                  background: 'rgba(0, 255, 204, 0.2)',
                  color: '#00ffcc',
                  border: '1px solid #00ffcc',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontFamily: 'Press Start 2P, monospace',
                  fontSize: '0.62rem',
                  fontWeight: 'bold'
                }}>
                  ✍️ FEEDBACK ONLY
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="judge-remarks" style={{ color: '#00ffcc', fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💬 Expert Judge Feedback &amp; Recommendations</span>
                  <span style={{ color: '#fdff00', fontSize: '0.68rem', fontFamily: 'Press Start 2P, monospace' }}>*REQUIRED</span>
                </label>
                <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '4px', marginBottom: '10px' }}>
                  Provide constructive observations covering project innovation, architectural strengths, execution feasibility, questions asked during presentation, and key recommendations.
                </p>
                <textarea
                  id="judge-remarks"
                  rows="10"
                  placeholder="Enter your detailed feedback, technical observations, critique, and mentorship recommendations for this finalist team..."
                  value={remarks}
                  required
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '0.94rem',
                    lineHeight: '1.6',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.85)',
                    border: '1.5px solid rgba(0, 255, 204, 0.4)',
                    color: '#ffffff',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '220px'
                  }}
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="submit-btn full-width-btn"
                style={{
                  background: 'linear-gradient(135deg, #00ffcc, #00bb99)',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  padding: '16px',
                  marginTop: '16px',
                  boxShadow: '0 0 15px rgba(0, 255, 204, 0.4)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="pacman-icon"></span> {isSubmitting ? 'SAVING FEEDBACK...' : '💬 SUBMIT TEAM FEEDBACK'}
              </button>
            </div>
          ) : (
            <>
              <div className="form-section">
                <h3 className="section-title"><span className="pacman-bullet"></span> EVALUATION CRITERIA MARKSHEET (MAX 50 MARKS)</h3>

                {isLocked && (
                  <div style={{
                    background: 'rgba(255, 77, 77, 0.12)',
                    border: '1.5px solid #ff4d4d',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 0 15px rgba(255, 77, 77, 0.2)'
                  }}>
                    <span style={{ fontSize: '1.8rem' }}>🔒</span>
                    <div>
                      <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '0.72rem', color: '#ff6666', marginBottom: '6px' }}>
                        EVALUATION LOCKED / EDITING CLOSED
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#eee', lineHeight: '1.4' }}>
                        Marks for this team have already been submitted and finalized. Editing has been closed by the administration.
                      </div>
                    </div>
                  </div>
                )}

                <div className="table-responsive">
                  <table className="eval-table">
                    <thead>
                      <tr>
                        <th style={{ width: '32%' }}>Evaluation Criterion</th>
                        <th>Description</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Max Marks</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>Score (0-10)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="criterion-name">
                          1. System Architecture & Technical Readiness
                          <div>
                            <button
                              type="button"
                              className="rubric-info-btn"
                              onClick={() => { setSelectedRubricCategory(0); setShowRubrics(true); }}
                            >
                              ℹ️ Rubric Details
                            </button>
                          </div>
                        </td>
                        <td className="criterion-desc">Clear block/circuit diagrams, tech stack setup, component selection, software/hardware architecture logic.</td>
                        <td className="max-marks-cell">10</td>
                        <td className="score-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="0 - 10"
                            required
                            disabled={isLocked}
                            style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                            className={`eval-score-input ${isInvalid(c1) ? 'invalid-input' : ''}`}
                            value={c1}
                            onChange={(e) => setC1(e.target.value)}
                          />
                          {isInvalid(c1) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="criterion-name">
                          2. Interface/Circuit / Prototype Scope
                          <div>
                            <button
                              type="button"
                              className="rubric-info-btn"
                              onClick={() => { setSelectedRubricCategory(1); setShowRubrics(true); }}
                            >
                              ℹ️ Rubric Details
                            </button>
                          </div>
                        </td>
                        <td className="criterion-desc">Wireframes, responsive layouts, or circuit schematics; pin definitions, sensor/actuator interfaces, communication protocols.</td>
                        <td className="max-marks-cell">10</td>
                        <td className="score-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="0 - 10"
                            required
                            disabled={isLocked}
                            style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                            className={`eval-score-input ${isInvalid(c2) ? 'invalid-input' : ''}`}
                            value={c2}
                            onChange={(e) => setC2(e.target.value)}
                          />
                          {isInvalid(c2) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="criterion-name">
                          3. Data, API / Hardware Component Availability
                          <div>
                            <button
                              type="button"
                              className="rubric-info-btn"
                              onClick={() => { setSelectedRubricCategory(2); setShowRubrics(true); }}
                            >
                              ℹ️ Rubric Details
                            </button>
                          </div>
                        </td>
                        <td className="criterion-desc">Datasets identified/collected, schema designed, external APIs verified, or physical sensors/MCUs on hand.</td>
                        <td className="max-marks-cell">10</td>
                        <td className="score-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="0 - 10"
                            required
                            disabled={isLocked}
                            style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                            className={`eval-score-input ${isInvalid(c3) ? 'invalid-input' : ''}`}
                            value={c3}
                            onChange={(e) => setC3(e.target.value)}
                          />
                          {isInvalid(c3) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="criterion-name">
                          4. Execution Feasibility & Timeline
                          <div>
                            <button
                              type="button"
                              className="rubric-info-btn"
                              onClick={() => { setSelectedRubricCategory(3); setShowRubrics(true); }}
                            >
                              ℹ️ Rubric Details
                            </button>
                          </div>
                        </td>
                        <td className="criterion-desc">Practical scope for the 24-hour hackathon, clear milestones, dependency awareness, contingency planning.</td>
                        <td className="max-marks-cell">10</td>
                        <td className="score-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="0 - 10"
                            required
                            disabled={isLocked}
                            style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                            className={`eval-score-input ${isInvalid(c4) ? 'invalid-input' : ''}`}
                            value={c4}
                            onChange={(e) => setC4(e.target.value)}
                          />
                          {isInvalid(c4) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="criterion-name">
                          5. Implementation Details
                          <div>
                            <button
                              type="button"
                              className="rubric-info-btn"
                              onClick={() => { setSelectedRubricCategory(4); setShowRubrics(true); }}
                            >
                              ℹ️ Rubric Details
                            </button>
                          </div>
                        </td>
                        <td className="criterion-desc">Granular breakdown of build steps, module-wise execution plan, pinouts, and technical task assignments.</td>
                        <td className="max-marks-cell">10</td>
                        <td className="score-input-cell">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="0 - 10"
                            required
                            disabled={isLocked}
                            style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                            className={`eval-score-input ${isInvalid(c5) ? 'invalid-input' : ''}`}
                            value={c5}
                            onChange={(e) => setC5(e.target.value)}
                          />
                          {isInvalid(c5) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* TOTAL SCORE DISPLAY BOX */}
                <div className="total-score-box" style={hasInvalidMarks ? { borderColor: '#ff4d4d', boxShadow: '0 0 20px rgba(255, 77, 77, 0.4)' } : {}}>
                  <span className="total-label">TOTAL EVALUATION SCORE:</span>
                  <span className="total-value" style={hasInvalidMarks ? { color: '#ff4d4d', textShadow: '0 0 10px #ff4d4d' } : {}}>
                    {hasInvalidMarks ? '⚠️ INVALID MARKS ENTERED' : `${totalScore} / 50`}
                  </span>
                </div>

                {/* REMARKS & FEEDBACK */}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label htmlFor="judge-remarks">Judge Remarks & Feedback (Optional)</label>
                  <textarea
                    id="judge-remarks"
                    rows="3"
                    placeholder="Add constructive feedback, strengths, and recommendations for the team..."
                    value={remarks}
                    disabled={isLocked}
                    style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' } : {}}
                    onChange={(e) => setRemarks(e.target.value)}
                  ></textarea>
                </div>
              </div>

              {isLocked ? (
                <button
                  type="button"
                  disabled
                  className="submit-btn full-width-btn"
                  style={{
                    background: 'rgba(255, 77, 77, 0.12)',
                    color: '#ff8888',
                    border: '1.5px solid #ff4d4d',
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.7rem',
                    padding: '14px',
                    opacity: 0.95
                  }}
                >
                  🔒 EDITING CLOSED — MARKS ARE FINALIZED
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="submit-btn full-width-btn">
                  <span className="pacman-icon"></span> {isSubmitting ? 'SAVING MARKS...' : 'SUBMIT EVALUATION MARKS'}
                </button>
              )}
            </>
          )}
        </form>

        <div className="arcade-footer">
          <span>JUDGE EVALUATION SYSTEM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>

      {/* Submission Modal */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="modal-card">
            <div className="modal-ghost-row">
              <div className="ghost blinky"></div>
              <div className="ghost pinky"></div>
              <div className="ghost inky"></div>
              <div className="ghost clyde"></div>
            </div>
            {isFinalRoundJudge ? (
              <>
                <h2 className="victory-title" style={{ color: '#00ffcc' }}>FEEDBACK SUBMITTED!</h2>
                <p className="victory-subtitle">EXPERT FEEDBACK RECORDED FOR {teamName.toUpperCase()}</p>
                <div className="score-box" style={{ background: 'rgba(0, 255, 204, 0.08)', borderColor: '#00ffcc', padding: '16px' }}>
                  <div style={{ color: '#00ffcc', fontSize: '0.65rem', fontFamily: 'Press Start 2P, monospace', marginBottom: '8px' }}>
                    SUBMITTED FEEDBACK PREVIEW:
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.84rem', fontStyle: 'italic', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto' }}>
                    &ldquo;{remarks}&rdquo;
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="victory-title">EVALUATION SUBMITTED!</h2>
                <p className="victory-subtitle">MARKS RECORDED SUCCESSFULLY FOR TEAM</p>
                <div className="score-box">
                  <span>FINAL TEAM SCORE: <span className="hud-yellow">{totalScore} / 50</span></span>
                </div>
              </>
            )}
            <button
              type="button"
              className="submit-btn full-width-btn"
              onClick={() => {
                setShowModal(false);
                router.push('/judge-dashboard');
              }}
            >
              RETURN TO TEAMS LIST
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function JudgeEvaluationPage() {
  return (
    <Suspense fallback={<div style={{ color: '#fff', padding: '40px', textCenter: 'center' }}>Loading evaluation sheet...</div>}>
      <JudgeEvaluationContent />
    </Suspense>
  );
}
