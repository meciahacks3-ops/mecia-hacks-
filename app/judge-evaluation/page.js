'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RubricsModal from '@/app/components/RubricsModal';
import ThemeToggle from '@/app/components/ThemeToggle';
import { getJudgeProfile } from '@/lib/judgeProfiles';
import { parseTimeSlotFromTeam, getTimeSlotInfo } from '@/lib/timeSlotUtils';
import { parseEvaluationRecord, formatPhaseFeedback, parsePhaseFeedback, IS_PHASE_2_LOCKED } from '@/lib/teamUtils';
import { isFinalRoundTeam, getFinalRoundTeamInfo, getTeamLabLocation, FINAL_ROUND_STATS } from '@/lib/finalRoundTeams';

function JudgeEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamParam = searchParams.get('team') || '';

  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teamName, setTeamName] = useState(teamParam || 'Select Team');
  const [teamIdNo, setTeamIdNo] = useState('');
  const [labLocation, setLabLocation] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [timeSlot, setTimeSlot] = useState('TBA');
  const [assignedJudge, setAssignedJudge] = useState('');

  // Rubric scores (Round 2 Evaluation Sheet - Max 10 marks per section)
  const [c1, setC1] = useState(0); // System Architecture & Technical Readiness (Max 10)
  const [c2, setC2] = useState(0); // Interface/Circuit / Prototype Scope (Max 10)
  const [c3, setC3] = useState(0); // Data, API / Hardware Component Availability (Max 10)
  const [c4, setC4] = useState(0); // Execution Feasibility & Timeline (Max 10)
  const [c5, setC5] = useState(0); // Implementation Details (Max 10)
  const [remarks, setRemarks] = useState('');
  const [phase1Remarks, setPhase1Remarks] = useState('');
  const [phase2Remarks, setPhase2Remarks] = useState('');
  const [activeFeedbackTab, setActiveFeedbackTab] = useState('all'); // 'all', 'phase1', 'phase2'
  const [isLocked, setIsLocked] = useState(false); // Closed editing feature for evaluated teams
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalFeedbackList, setInternalFeedbackList] = useState([]);
  const [round2Data, setRound2Data] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);
  const [selectedRubricCategory, setSelectedRubricCategory] = useState(null);

  const cleanJudgeUpper = (judgeEmail || '').trim().toUpperCase();
  const isMentorJudge = cleanJudgeUpper.startsWith('MM');
  const isExternalRound3Judge = cleanJudgeUpper.startsWith('FM');
  const isFinalRoundJudge = isMentorJudge;

  const maxCriterionScore = isExternalRound3Judge ? 20 : 10;

  const isInvalid = (val) => {
    if (val === '' || val === null || val === undefined) return false;
    const num = Number(val);
    return isNaN(num) || num < 0 || num > maxCriterionScore;
  };

  const hasInvalidMarks = isInvalid(c1) || isInvalid(c2) || isInvalid(c3) || isInvalid(c4) || isInvalid(c5);

  const numC1 = Math.min(maxCriterionScore, Math.max(0, parseFloat(c1) || 0));
  const numC2 = Math.min(maxCriterionScore, Math.max(0, parseFloat(c2) || 0));
  const numC3 = Math.min(maxCriterionScore, Math.max(0, parseFloat(c3) || 0));
  const numC4 = Math.min(maxCriterionScore, Math.max(0, parseFloat(c4) || 0));
  const numC5 = Math.min(maxCriterionScore, Math.max(0, parseFloat(c5) || 0));

  // Round 3 Scoring: C1 (35%), C2 (25%), C3 (20%), C4 (10%), C5 (10%)
  const weightedTotal = Math.round((numC1 * 1.75 + numC2 * 1.25 + numC3 * 1.0 + numC4 * 0.5 + numC5 * 0.5) * 10) / 10;
  const rawTotal = Math.round((numC1 + numC2 + numC3 + numC4 + numC5) * 10) / 10;

  const totalScore = hasInvalidMarks
    ? 'INVALID'
    : (isExternalRound3Judge
        ? weightedTotal
        : Math.min(50, Math.max(0, numC1 + numC2 + numC3 + numC4 + numC5)));

  useEffect(() => {
    const savedJudgeEmail = sessionStorage.getItem('judgeEmail');
    if (savedJudgeEmail) setJudgeEmail(savedJudgeEmail);

    if (teamParam) {
      setTeamName(teamParam);
      const initialLoc = getTeamLabLocation({ teamName: teamParam });
      if (initialLoc) setLabLocation(initialLoc);
      loadExistingMarks(teamParam);
    }
  }, [teamParam]);

  const loadExistingMarks = async (name) => {
    try {
      // Pre-populate lab location
      const fallbackLoc = getTeamLabLocation({ teamName: name });
      if (fallbackLoc) setLabLocation(fallbackLoc);

      // 1. Fetch team metadata (only team ID, title, description - personal details hidden)
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, team_name, team_id_no, project_title, main_idea, assigned_judge')
        .ilike('team_name', name)
        .maybeSingle();

      if (teamData) {
        if (teamData.assigned_judge) {
          setAssignedJudge(teamData.assigned_judge);
        }
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
        const resolvedLoc = getTeamLabLocation({ teamName: name, teamIdNo: parsedTeamId, main_idea: teamData.main_idea });
        if (resolvedLoc) setLabLocation(resolvedLoc);

        setTimeSlot(parsedSlot);
        setTeamIdNo(parsedTeamId || 'N/A');
        setProjectTitle(teamData.project_title || 'N/A');
        setProjectDesc(cleanDesc || teamData.main_idea || 'No description provided.');
      }

      // 2. Fetch marks / feedback for this team
      const currentJudge = (sessionStorage.getItem('judgeEmail') || judgeEmail || '').trim().toUpperCase();
      const isMentor = currentJudge.startsWith('MM');
      const isExternal = currentJudge.startsWith('FM');

      // 1. Fetch evaluations from Supabase
      const { data: supaEvals } = await supabase
        .from('evaluations')
        .select('*');

      const allEvals = supaEvals || [];
      const cleanName = name.trim().toLowerCase();
      const cleanNoSpace = cleanName.replace(/\s+/g, '');

      // Match evaluations for this team (by team_name or project_title)
      const allTeamEvals = allEvals.filter(e => {
        const eName = (e.team_name || '').trim().toLowerCase();
        const eNoSpace = eName.replace(/\s+/g, '');
        const nameMatch = eName === cleanName || eNoSpace === cleanNoSpace;
        const projMatch = projectTitle && projectTitle !== 'Untitled Project' && projectTitle !== 'N/A' && eName === projectTitle.trim().toLowerCase();
        return nameMatch || projMatch;
      });

      // 2. Extract current judge's evaluation
      const myEval = allTeamEvals.find(e => (e.judge_email || '').trim().toUpperCase() === currentJudge);
      if (myEval) {
        const parsed = parseEvaluationRecord(myEval);
        if (parsed) {
          setC1(parsed.c1);
          setC2(parsed.c2);
          setC3(parsed.c3);
          setC4(parsed.c4);
          setC5(parsed.c5);
          const rawRemarks = parsed.remarks || '';
          setRemarks(rawRemarks.replace(/\[C5(?:\s+Implementation)?:\s*\d+(?:\/10)?\]\s*/gi, '').trim());
          setPhase1Remarks(parsed.phase1Feedback || '');
          setPhase2Remarks(parsed.phase2Feedback || '');
        }
      }

      // Also check external_evaluations dedicated table for external jury (FM001-FM007)
      if (isExternal) {
        try {
          const { data: extEval } = await supabase
            .from('external_evaluations')
            .select('*')
            .ilike('team_name', name)
            .ilike('judge_email', currentJudge)
            .maybeSingle();

          if (extEval) {
            setC1(extEval.c1_innovation ?? 0);
            setC2(extEval.c2_execution ?? 0);
            setC3(extEval.c3_feasibility ?? 0);
            setC4(extEval.c4_presentation ?? 0);
            setC5(extEval.c5_implementation ?? 0);
            setRemarks(extEval.remarks || '');
          }
        } catch (extReadErr) {
          console.warn("external_evaluations read notice:", extReadErr);
        }
      }

      // Also check internal_evaluations dedicated table for internal mentors (MM001-MM010)
      if (isMentor) {
        try {
          const { data: intEval } = await supabase
            .from('internal_evaluations')
            .select('*')
            .ilike('team_name', name)
            .ilike('judge_email', currentJudge)
            .maybeSingle();

          if (intEval) {
            if (intEval.phase1_feedback) setPhase1Remarks(intEval.phase1_feedback);
            if (intEval.phase2_feedback) setPhase2Remarks(intEval.phase2_feedback);
            if (intEval.remarks) setRemarks(intEval.remarks);
          }
        } catch (intReadErr) {
          console.warn("internal_evaluations read notice:", intReadErr);
        }
      }

      // 3. Extract official Round 2 marks & rubric details
      const finInfo = getFinalRoundTeamInfo({ teamName: name, teamIdNo });
      const r2Eval = allTeamEvals.find(e => (e.judge_email || '').trim().toUpperCase().startsWith('JM'));
      const parsedR2 = r2Eval ? parseEvaluationRecord(r2Eval) : null;
      const r2DataObj = {
        score: parsedR2 ? parsedR2.totalScore : (finInfo?.score ?? null),
        c1: parsedR2 ? parsedR2.c1 : (finInfo?.c1 ?? null),
        c2: parsedR2 ? parsedR2.c2 : (finInfo?.c2 ?? null),
        c3: parsedR2 ? parsedR2.c3 : (finInfo?.c3 ?? null),
        c4: parsedR2 ? parsedR2.c4 : (finInfo?.c4 ?? null),
        c5: parsedR2 ? parsedR2.c5 : (finInfo?.c5 ?? null),
        rank: finInfo?.rank || null,
        category: finInfo?.category || null,
        track: finInfo?.track || null,
        judge: r2Eval ? (r2Eval.judge_email || '').trim().toUpperCase() : (finInfo?.assignedJudge || null),
        remarks: parsedR2?.remarks || ''
      };
      setRound2Data(r2DataObj);

      // 4. Extract all internal mentor feedback (MM001-MM010)
      let mentorFeedback = allTeamEvals
        .map(parseEvaluationRecord)
        .filter(e => {
          if (!e) return false;
          const jEmail = (e.judgeEmail || '').trim().toUpperCase();
          return jEmail.startsWith('MM') && (e.remarks || e.phase1Feedback || e.phase2Feedback);
        });

      // Also query dedicated internal_evaluations table for mentor feedback
      try {
        const { data: intEvalsTable } = await supabase
          .from('internal_evaluations')
          .select('*');

        if (intEvalsTable && intEvalsTable.length > 0) {
          const matchedInt = intEvalsTable.filter(ie => {
            const ieName = (ie.team_name || '').trim().toLowerCase();
            return ieName === cleanName || ieName.replace(/\s+/g, '') === cleanNoSpace;
          });

          matchedInt.forEach(ie => {
            const p1 = ie.phase1_feedback || '';
            const p2 = ie.phase2_feedback || '';
            const formattedRemarks = ie.remarks || (p1 || p2 ? formatPhaseFeedback(p1, p2) : '');
            const item = {
              id: ie.id,
              teamName: ie.team_name,
              judgeEmail: (ie.judge_email || '').trim().toUpperCase(),
              judgeName: ie.judge_name,
              judgeGroup: ie.judge_group,
              phase1Feedback: p1,
              phase2Feedback: p2,
              hasPhase1: Boolean(p1 && p1.trim()),
              hasPhase2: Boolean(p2 && p2.trim()),
              hasPhases: Boolean((p1 && p1.trim()) || (p2 && p2.trim())),
              remarks: formattedRemarks,
              updatedAt: ie.updated_at
            };

            const existingIdx = mentorFeedback.findIndex(
              mf => (mf.judgeEmail || '').trim().toUpperCase() === item.judgeEmail
            );
            if (existingIdx >= 0) {
              mentorFeedback[existingIdx] = { ...mentorFeedback[existingIdx], ...item };
            } else if (item.remarks && item.remarks.trim()) {
              mentorFeedback.push(item);
            }
          });
        }
      } catch (intFetchErr) {
        console.warn("internal_evaluations fetch notice:", intFetchErr);
      }

      setInternalFeedbackList(mentorFeedback);

      // Only lock for legacy Round 2 JM judges, never lock for internal MM or external FM judges
      const isLegacyR2 = !isMentor && !isExternal;
      setIsLocked(isLegacyR2 && Boolean(myEval));
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
      alert(`⚠️ Invalid Marks: Scores for each criterion must be between 0 and ${maxCriterionScore}.`);
      return;
    }

    if (isFinalRoundJudge) {
      if (IS_PHASE_2_LOCKED) {
        if (!phase1Remarks.trim() && !remarks.trim()) {
          alert("⚠️ Phase 1 Feedback Required: Please enter your Phase 1 observations before submitting. (Phase 2 feedback is currently locked by administration).");
          return;
        }
      } else {
        if (!phase1Remarks.trim() && !phase2Remarks.trim() && !remarks.trim()) {
          alert("⚠️ Feedback Required: Please enter your feedback for Phase 1 or Phase 2 before submitting.");
          return;
        }
      }
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
        const p1 = phase1Remarks.trim();
        const p2 = phase2Remarks.trim();
        const formattedFeedback = (p1 || p2)
          ? formatPhaseFeedback(p1, p2)
          : remarks.trim();

        evalPayload = {
          team_name: teamName,
          judge_email: cleanJudge,
          c1_innovation: 0,
          c2_execution: 0,
          c3_feasibility: 0,
          c4_presentation: 0,
          total_score: 0,
          remarks: formattedFeedback,
          updated_at: new Date()
        };
      } else {
        const maxScore = isExternalRound3Judge ? 20 : 10;
        const scoreC1 = Math.min(maxScore, Math.max(0, parseFloat(c1) || 0));
        const scoreC2 = Math.min(maxScore, Math.max(0, parseFloat(c2) || 0));
        const scoreC3 = Math.min(maxScore, Math.max(0, parseFloat(c3) || 0));
        const scoreC4 = Math.min(maxScore, Math.max(0, parseFloat(c4) || 0));
        const scoreC5 = Math.min(maxScore, Math.max(0, parseFloat(c5) || 0));

        const cleanRemarks = remarks.replace(/\[C5(?:\s+[^\]]+)?:\s*\d+(?:\/(?:10|20))?\]\s*/gi, '').trim();
        const formattedRemarks = isExternalRound3Judge
          ? `[C5 Presentation & Demo: ${scoreC5}/20] ${cleanRemarks}`.trim()
          : `[C5 Implementation: ${scoreC5}/10] ${cleanRemarks}`.trim();

        const calculatedTotal = isExternalRound3Judge ? weightedTotal : (scoreC1 + scoreC2 + scoreC3 + scoreC4 + scoreC5);
        const totalNum = totalScore === 'INVALID' ? 0 : calculatedTotal;

        evalPayload = {
          team_name: teamName,
          judge_email: cleanJudge,
          c1_innovation: scoreC1,
          c2_execution: scoreC2,
          c3_feasibility: scoreC3,
          c4_presentation: scoreC4,
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

      // If External Jury (FM001-FM007), also save directly to dedicated external_evaluations table
      if (isExternalRound3Judge) {
        try {
          const scoreC1 = Math.min(20, Math.max(0, parseFloat(c1) || 0));
          const scoreC2 = Math.min(20, Math.max(0, parseFloat(c2) || 0));
          const scoreC3 = Math.min(20, Math.max(0, parseFloat(c3) || 0));
          const scoreC4 = Math.min(20, Math.max(0, parseFloat(c4) || 0));
          const scoreC5 = Math.min(20, Math.max(0, parseFloat(c5) || 0));
          const cleanRemarks = remarks.replace(/\[C5(?:\s+[^\]]+)?:\s*\d+(?:\/(?:10|20))?\]\s*/gi, '').trim();
          const calculatedTotal = weightedTotal;
          const totalNum = totalScore === 'INVALID' ? 0 : calculatedTotal;

          const externalPayload = {
            team_name: teamName,
            team_id_no: teamIdNo || null,
            judge_email: cleanJudge,
            judge_name: judgeProfile?.namesText || cleanJudge,
            judge_group: judgeProfile?.group || null,
            c1_innovation: scoreC1,
            c2_execution: scoreC2,
            c3_feasibility: scoreC3,
            c4_presentation: scoreC4,
            c5_implementation: scoreC5,
            total_score: totalNum,
            remarks: cleanRemarks,
            updated_at: new Date()
          };

          const { data: existingExt } = await supabase
            .from('external_evaluations')
            .select('id')
            .ilike('team_name', teamName)
            .ilike('judge_email', cleanJudge)
            .maybeSingle();

          if (existingExt && existingExt.id) {
            await supabase
              .from('external_evaluations')
              .update(externalPayload)
              .eq('id', existingExt.id);
          } else {
            await supabase
              .from('external_evaluations')
              .insert([externalPayload]);
          }
        } catch (extTableErr) {
          console.warn("Notice: external_evaluations write attempt:", extTableErr);
        }
      }

      // If Internal Mentor / Jury (MM001-MM010), also save directly to dedicated internal_evaluations table
      if (isFinalRoundJudge) {
        try {
          const p1 = phase1Remarks.trim();
          const p2 = phase2Remarks.trim();
          const formattedFeedback = (p1 || p2) ? formatPhaseFeedback(p1, p2) : remarks.trim();

          const internalPayload = {
            team_name: teamName,
            team_id_no: teamIdNo || null,
            judge_email: cleanJudge,
            judge_name: judgeProfile?.namesText || cleanJudge,
            judge_group: judgeProfile?.group || null,
            phase1_feedback: p1,
            phase2_feedback: p2,
            remarks: formattedFeedback,
            c1_innovation: 0,
            c2_execution: 0,
            c3_feasibility: 0,
            c4_presentation: 0,
            total_score: 0,
            updated_at: new Date()
          };

          const { data: existingInt } = await supabase
            .from('internal_evaluations')
            .select('id')
            .ilike('team_name', teamName)
            .ilike('judge_email', cleanJudge)
            .maybeSingle();

          if (existingInt && existingInt.id) {
            await supabase
              .from('internal_evaluations')
              .update(internalPayload)
              .eq('id', existingInt.id);
          } else {
            await supabase
              .from('internal_evaluations')
              .insert([internalPayload]);
          }
        } catch (intTableErr) {
          console.warn("Notice: internal_evaluations write attempt:", intTableErr);
        }
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
            <div className="judge-panel-info-card" style={{
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
                <span className="judge-panel-title" style={{ fontFamily: 'Press Start 2P, monospace', fontSize: '0.62rem', color: '#00ffcc' }}>
                  JUDGE PANEL: {judgeEmail.toUpperCase()} {judgeProfile?.group ? `• ${judgeProfile.group}` : ''}
                </span>
              </div>
              {judgeProfile ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    {judgeProfile.names.map((name, idx) => (
                      <div key={idx} className="judge-name-row" style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="judge-name-arrow" style={{ color: '#00ffcc', fontSize: '0.65rem' }}>▸</span>
                        <span className="judge-name-text">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="judge-name-row" style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600' }}>
                  👨‍⚖️ Authorized Evaluation Judge Panel
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => { setSelectedRubricCategory(null); setShowRubrics(true); }}
              style={{
                background: 'rgba(0, 255, 204, 0.15)',
                color: '#00ffcc',
                border: '1.5px solid #00ffcc',
                borderRadius: '8px',
                padding: '8px 12px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.58rem',
                cursor: 'pointer'
              }}
              title="Click to view full scoring rubrics and performance standards"
            >
              {isExternalRound3Judge ? '📋 VIEW ROUND 3 RUBRICS' : '📋 VIEW RUBRICS'}
            </button>
            <ThemeToggle />
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

        <RubricsModal
          isOpen={showRubrics}
          categoryIndex={selectedRubricCategory}
          defaultRound={isExternalRound3Judge ? 3 : 2}
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
                  ⚠️ Notice: This team is not listed in the {FINAL_ROUND_STATS.totalTeams} Final Round Qualifiers. Final round evaluations are intended for the {FINAL_ROUND_STATS.totalTeams} qualified finalist teams.
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
              {labLocation && (
                <div style={{
                  background: 'rgba(0, 255, 204, 0.15)',
                  border: '1.5px solid #00ffcc',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 10px rgba(0, 255, 204, 0.25)'
                }}>
                  <span style={{ color: '#00ffcc', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>📍 LAB VENUE:</span>
                  <span style={{ color: '#fdff00', fontWeight: 'bold', fontSize: '0.9rem' }}>{labLocation}</span>
                </div>
              )}
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
                <span style={{ color: '#00ffcc', fontSize: '0.82rem', fontWeight: 'bold' }}>🏛️ ASSIGNED PANEL: </span>
                {assignedJudge && assignedJudge.trim().toUpperCase() !== 'UNASSIGNED' ? (
                  assignedJudge.trim().toUpperCase() === cleanJudgeUpper ? (
                    <span style={{
                      background: 'rgba(0, 255, 204, 0.2)',
                      color: '#00ffcc',
                      border: '1.5px solid #00ffcc',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ⭐ YOUR PANEL ({assignedJudge.trim().toUpperCase()})
                    </span>
                  ) : (
                    <span style={{
                      background: 'rgba(253, 255, 0, 0.15)',
                      color: '#fdff00',
                      border: '1px solid #fdff00',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.7rem'
                    }}>
                      {assignedJudge.trim().toUpperCase()}
                    </span>
                  )
                ) : (
                  <span style={{
                    background: 'rgba(255, 0, 85, 0.15)',
                    color: '#ff0055',
                    border: '1px solid #ff0055',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem'
                  }}>
                    ⚠️ Unassigned
                  </span>
                )}
              </div>
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
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 0 15px rgba(0, 255, 204, 0.2)'
              }}>
                <div>
                  <h3 className="section-title" style={{ margin: 0, color: '#00ffcc', fontSize: '0.88rem' }}>
                    <span className="pacman-bullet"></span> 💬 MENTORS: TWO-PHASE TEAM FEEDBACK
                  </h3>
                  <p style={{ color: '#ccc', fontSize: '0.78rem', marginTop: '6px', margin: 0, lineHeight: '1.5' }}>
                    Logged in as Mentor <strong>{judgeEmail.toUpperCase()}</strong>. Record qualitative mentorship critique and observations for {IS_PHASE_2_LOCKED ? <strong>Phase 1</strong> : <strong>Phase 1 &amp; Phase 2</strong>}. {IS_PHASE_2_LOCKED ? <span style={{ color: '#ff6688', fontWeight: 'bold' }}>Phase 2 feedback is currently locked by administration.</span> : <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>Phase 2 feedback is active and unlocked!</span>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    background: phase1Remarks.trim() ? 'rgba(0, 255, 204, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: phase1Remarks.trim() ? '#00ffcc' : '#888',
                    border: `1px solid ${phase1Remarks.trim() ? '#00ffcc' : '#555'}`,
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.58rem',
                    fontWeight: 'bold'
                  }}>
                    {phase1Remarks.trim() ? '✅ PHASE 1 DONE' : '⏳ PHASE 1 PENDING'}
                  </span>
                  {IS_PHASE_2_LOCKED ? (
                    <span style={{
                      background: 'rgba(255, 51, 102, 0.15)',
                      color: '#ff6688',
                      border: '1.5px solid #ff3366',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.58rem',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      🔒 PHASE 2 LOCKED
                    </span>
                  ) : (
                    <span style={{
                      background: phase2Remarks.trim() ? 'rgba(255, 102, 204, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      color: phase2Remarks.trim() ? '#ff66cc' : '#888',
                      border: `1px solid ${phase2Remarks.trim() ? '#ff66cc' : '#555'}`,
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.58rem',
                      fontWeight: 'bold'
                    }}>
                      {phase2Remarks.trim() ? '✅ PHASE 2 DONE' : '⏳ PHASE 2 PENDING'}
                    </span>
                  )}
                </div>
              </div>

              {/* Tab navigation for Phases */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveFeedbackTab('all')}
                  style={{
                    background: activeFeedbackTab === 'all' ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                    color: activeFeedbackTab === 'all' ? '#000' : '#888',
                    border: '1.5px solid #00ffcc',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.6rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: activeFeedbackTab === 'all' ? '0 0 10px rgba(0, 255, 204, 0.4)' : 'none'
                  }}
                >
                  📋 ALL PHASES {IS_PHASE_2_LOCKED ? '(P1 ACTIVE • P2 LOCKED 🔒)' : '(1 & 2)'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFeedbackTab('phase1')}
                  style={{
                    background: activeFeedbackTab === 'phase1' ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                    color: activeFeedbackTab === 'phase1' ? '#000' : '#888',
                    border: '1.5px solid #00ffcc',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.6rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: activeFeedbackTab === 'phase1' ? '0 0 10px rgba(0, 255, 204, 0.4)' : 'none'
                  }}
                >
                  ⚡ PHASE 1 (ACTIVE)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFeedbackTab('phase2')}
                  style={{
                    background: activeFeedbackTab === 'phase2' ? (IS_PHASE_2_LOCKED ? 'rgba(255, 51, 102, 0.25)' : '#ff66cc') : 'rgba(0,0,0,0.6)',
                    color: activeFeedbackTab === 'phase2' ? (IS_PHASE_2_LOCKED ? '#ff6688' : '#000') : '#888',
                    border: `1.5px solid ${activeFeedbackTab === 'phase2' ? (IS_PHASE_2_LOCKED ? '#ff3366' : '#ff66cc') : (IS_PHASE_2_LOCKED ? 'rgba(255, 51, 102, 0.4)' : '#555')}`,
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.6rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: activeFeedbackTab === 'phase2' ? (IS_PHASE_2_LOCKED ? '0 0 10px rgba(255, 51, 102, 0.3)' : '0 0 10px rgba(255, 102, 204, 0.4)') : 'none'
                  }}
                >
                  {IS_PHASE_2_LOCKED ? '🔒 PHASE 2 (LOCKED)' : '🚀 PHASE 2 (ACTIVE)'}
                </button>
              </div>

              {/* PHASE 1 FEEDBACK BOX */}
              {(activeFeedbackTab === 'all' || activeFeedbackTab === 'phase1') && (
                <div className="form-group" style={{
                  background: 'rgba(0, 255, 204, 0.04)',
                  border: '1.5px solid rgba(0, 255, 204, 0.35)',
                  borderRadius: '8px',
                  padding: '16px 18px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <label htmlFor="phase1-remarks" style={{ color: '#00ffcc', fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span>⚡ PHASE 1: Initial Architecture &amp; Prototype Feedback (ACTIVE)</span>
                    </label>
                    <span style={{
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.55rem',
                      color: phase1Remarks.trim() ? '#00ffcc' : '#fdff00'
                    }}>
                      {phase1Remarks.trim() ? '✅ PHASE 1 ENTERED' : '⚠️ PHASE 1 EMPTY'}
                    </span>
                  </div>
                  <p style={{ color: '#aaa', fontSize: '0.74rem', marginTop: '2px', marginBottom: '10px' }}>
                    Initial review observations: idea validation, architectural strengths, proposed tech stack, initial prototype progress, and roadblocks discussed.
                  </p>
                  <textarea
                    id="phase1-remarks"
                    rows="6"
                    placeholder="Enter Phase 1 mentor observations, initial technical critique, architectural guidance, and recommendations..."
                    value={phase1Remarks}
                    onChange={(e) => setPhase1Remarks(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '0.92rem',
                      lineHeight: '1.6',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.85)',
                      border: '1.5px solid rgba(0, 255, 204, 0.4)',
                      color: '#ffffff',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      minHeight: '140px'
                    }}
                  ></textarea>
                </div>
              )}

              {/* PHASE 2 FEEDBACK BOX (LOCKED) */}
              {(activeFeedbackTab === 'all' || activeFeedbackTab === 'phase2') && (
                <div className="form-group" style={{
                  background: IS_PHASE_2_LOCKED ? 'rgba(255, 51, 102, 0.04)' : 'rgba(255, 102, 204, 0.04)',
                  border: IS_PHASE_2_LOCKED ? '1.5px dashed rgba(255, 51, 102, 0.45)' : '1.5px solid rgba(255, 102, 204, 0.35)',
                  borderRadius: '8px',
                  padding: '16px 18px',
                  marginBottom: '20px',
                  position: 'relative'
                }}>
                  {IS_PHASE_2_LOCKED && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(255, 51, 102, 0.15) 0%, rgba(20, 10, 15, 0.95) 100%)',
                      border: '1.5px solid #ff3366',
                      borderRadius: '6px',
                      padding: '12px 16px',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxShadow: '0 0 12px rgba(255, 51, 102, 0.2)'
                    }}>
                      <span style={{ fontSize: '1.4rem' }}>🔒</span>
                      <div style={{ fontSize: '0.78rem', color: '#ffccd5', lineHeight: '1.4' }}>
                        <div style={{ color: '#ff6688', fontFamily: 'Press Start 2P, monospace', fontSize: '0.62rem', marginBottom: '4px' }}>
                          PHASE 2 FEEDBACK IS CURRENTLY LOCKED
                        </div>
                        <div>
                          Phase 2 critique will unlock during the final sprint / demo evaluation round. Currently, only Phase 1 feedback is accepted and saved.
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <label htmlFor="phase2-remarks" style={{ color: IS_PHASE_2_LOCKED ? '#ff6688' : '#ff66cc', fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span>{IS_PHASE_2_LOCKED ? '🔒' : '🚀'} PHASE 2: Mid-Hackathon / Final Sprint Feedback {IS_PHASE_2_LOCKED && '(LOCKED)'}</span>
                    </label>
                    <span style={{
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.55rem',
                      color: IS_PHASE_2_LOCKED ? '#ff6688' : (phase2Remarks.trim() ? '#ff66cc' : '#fdff00')
                    }}>
                      {IS_PHASE_2_LOCKED ? '🔒 LOCKED BY ADMIN' : (phase2Remarks.trim() ? '✅ PHASE 2 ENTERED' : '⚠️ PHASE 2 EMPTY')}
                    </span>
                  </div>
                  <p style={{ color: '#888', fontSize: '0.74rem', marginTop: '2px', marginBottom: '10px' }}>
                    Second review observations: implementation progress made since Phase 1, demo readiness, UI/hardware completeness, and final guidance.
                  </p>
                  <textarea
                    id="phase2-remarks"
                    rows="5"
                    placeholder={IS_PHASE_2_LOCKED
                      ? "🔒 Phase 2 feedback is currently locked by the administration. It will be enabled when the Phase 2 judging round commences..."
                      : "Enter Phase 2 mentor observations, review of progress made after Phase 1, demo readiness, and final guidance..."}
                    value={phase2Remarks}
                    onChange={(e) => {
                      if (!IS_PHASE_2_LOCKED) setPhase2Remarks(e.target.value);
                    }}
                    readOnly={IS_PHASE_2_LOCKED}
                    disabled={IS_PHASE_2_LOCKED}
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '0.92rem',
                      lineHeight: '1.6',
                      borderRadius: '8px',
                      background: IS_PHASE_2_LOCKED ? 'rgba(30, 15, 20, 0.75)' : 'rgba(0, 0, 0, 0.85)',
                      border: IS_PHASE_2_LOCKED ? '1.5px dashed rgba(255, 51, 102, 0.4)' : '1.5px solid rgba(255, 102, 204, 0.4)',
                      color: IS_PHASE_2_LOCKED ? '#888' : '#ffffff',
                      fontFamily: 'inherit',
                      resize: IS_PHASE_2_LOCKED ? 'none' : 'vertical',
                      minHeight: '120px',
                      cursor: IS_PHASE_2_LOCKED ? 'not-allowed' : 'text'
                    }}
                  ></textarea>
                </div>
              )}

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
                  marginTop: '8px',
                  boxShadow: '0 0 15px rgba(0, 255, 204, 0.4)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                <span className="pacman-icon"></span> {isSubmitting ? 'SAVING FEEDBACK...' : (IS_PHASE_2_LOCKED ? '💾 SAVE PHASE 1 MENTOR FEEDBACK (P2 LOCKED 🔒)' : '💬 SUBMIT MENTOR FEEDBACK (PHASE 1 & 2)')}
              </button>
            </div>
          ) : (
            <>
              {/* STAGE 2 EVALUATION & MARKS DOSSIER (Visible to External Judges) */}
              {isExternalRound3Judge && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(253, 255, 0, 0.1) 0%, rgba(0, 255, 204, 0.08) 100%)',
                  border: '2px solid #fdff00',
                  borderRadius: '10px',
                  padding: '18px 22px',
                  marginBottom: '24px',
                  boxShadow: '0 0 25px rgba(253, 255, 0, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.6rem' }}>🎯</span>
                      <div>
                        <h3 style={{ margin: 0, fontFamily: 'Press Start 2P, monospace', fontSize: '0.78rem', color: '#fdff00', letterSpacing: '0.5px' }}>
                          STAGE 2 MARKS &amp; RUBRIC PERFORMANCE DOSSIER
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: '#ccc', fontSize: '0.74rem' }}>
                          Official qualification score, category ranking, and 5-pillar rubric marks from Stage 2.
                        </p>
                      </div>
                    </div>
                    {round2Data && round2Data.score !== null && round2Data.score !== undefined ? (
                      <span style={{
                        background: 'linear-gradient(135deg, #fdff00, #ffb852)',
                        color: '#000',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.75rem',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        boxShadow: '0 0 10px rgba(253, 255, 0, 0.4)'
                      }}>
                        {round2Data.score} / 50 MARKS ({Math.round((round2Data.score / 50) * 100)}%)
                      </span>
                    ) : (
                      <span style={{ color: '#888', fontSize: '0.65rem', fontFamily: 'Press Start 2P, monospace' }}>
                        STAGE 2 SCORE: N/A
                      </span>
                    )}
                  </div>

                  {/* Rank and Category Banner */}
                  {round2Data && (round2Data.rank || round2Data.category || round2Data.track) && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
                      {round2Data.rank && (
                        <span style={{
                          background: 'rgba(253, 255, 0, 0.2)',
                          color: '#fdff00',
                          border: '1px solid #fdff00',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontFamily: 'Press Start 2P, monospace',
                          fontWeight: 'bold'
                        }}>
                          🏆 {round2Data.rank}
                        </span>
                      )}
                      {round2Data.category && (
                        <span style={{
                          background: 'rgba(0, 255, 204, 0.15)',
                          color: '#00ffcc',
                          border: '1px solid #00ffcc',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontFamily: 'Press Start 2P, monospace'
                        }}>
                          📌 {round2Data.category}
                        </span>
                      )}
                      {round2Data.judge && (
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#fff',
                          border: '1px solid #555',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '0.68rem'
                        }}>
                          👨‍⚖️ Evaluated by Panel: <strong style={{ color: '#00ffcc' }}>{round2Data.judge}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* 5 Criteria Score Cards */}
                  {round2Data && (round2Data.c1 !== null || round2Data.c2 !== null || round2Data.c3 !== null || round2Data.c4 !== null || round2Data.c5 !== null) && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '10px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: '#aaa', marginBottom: '4px' }}>💡 Innovation &amp; Problem</div>
                        <div style={{ fontSize: '1rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                          {round2Data.c1 ?? '-'}<span style={{ fontSize: '0.6rem', color: '#666' }}>/10</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: '#aaa', marginBottom: '4px' }}>⚙️ Execution &amp; Tech</div>
                        <div style={{ fontSize: '1rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                          {round2Data.c2 ?? '-'}<span style={{ fontSize: '0.6rem', color: '#666' }}>/10</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: '#aaa', marginBottom: '4px' }}>🎯 Feasibility &amp; Impact</div>
                        <div style={{ fontSize: '1rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                          {round2Data.c3 ?? '-'}<span style={{ fontSize: '0.6rem', color: '#666' }}>/10</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: '#aaa', marginBottom: '4px' }}>🗣️ Presentation &amp; Q&amp;A</div>
                        <div style={{ fontSize: '1rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                          {round2Data.c4 ?? '-'}<span style={{ fontSize: '0.6rem', color: '#666' }}>/10</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: '#aaa', marginBottom: '4px' }}>🚀 Prototype Implementation</div>
                        <div style={{ fontSize: '1rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                          {round2Data.c5 ?? '-'}<span style={{ fontSize: '0.6rem', color: '#666' }}>/10</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {round2Data?.remarks && (
                    <div style={{ background: 'rgba(0, 0, 0, 0.6)', borderLeft: '3px solid #fdff00', padding: '8px 12px', borderRadius: '4px', marginTop: '8px' }}>
                      <span style={{ color: '#fdff00', fontSize: '0.7rem', fontWeight: 'bold' }}>Stage 2 Evaluator Remarks: </span>
                      <span style={{ color: '#fff', fontSize: '0.82rem', fontStyle: 'italic' }}>&ldquo;{round2Data.remarks}&rdquo;</span>
                    </div>
                  )}
                </div>
              )}

              {/* INTERNAL MENTOR FEEDBACK (Visible to External Judges) */}
              {(isExternalRound3Judge || internalFeedbackList.length > 0) && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(253, 255, 0, 0.1) 0%, rgba(0, 255, 204, 0.08) 100%)',
                  border: '2px solid #fdff00',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  boxShadow: '0 0 20px rgba(253, 255, 0, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.5rem' }}>📋</span>
                      <div>
                        <h3 style={{ margin: 0, fontFamily: 'Press Start 2P, monospace', fontSize: '0.74rem', color: '#fdff00', letterSpacing: '0.5px' }}>
                          MENTOR FEEDBACK &amp; OBSERVATIONS
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: '#ccc', fontSize: '0.74rem' }}>
                          Review qualitative observations, critique, and guidance provided by mentors.
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: internalFeedbackList.length > 0 ? '#fdff00' : 'rgba(255, 255, 255, 0.1)',
                      color: internalFeedbackList.length > 0 ? '#000' : '#888',
                      fontFamily: 'Press Start 2P, monospace',
                      fontSize: '0.58rem',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {internalFeedbackList.length} MENTOR REVIEW{internalFeedbackList.length === 1 ? '' : 'S'}
                    </span>
                  </div>

                  {internalFeedbackList.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {internalFeedbackList.map((fb, idx) => {
                        const mentorProf = getJudgeProfile(fb.judgeEmail);
                        const mentorNames = mentorProf ? mentorProf.namesText : fb.judgeEmail;
                        return (
                          <div key={idx} style={{
                            background: 'rgba(0, 0, 0, 0.75)',
                            borderLeft: '4px solid #fdff00',
                            borderRadius: '6px',
                            padding: '14px 18px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '0.84rem' }}>
                                👨‍🏫 Mentor Panel: <span style={{ color: '#fdff00' }}>{fb.judgeEmail}</span> {mentorProf?.group ? `(${mentorProf.group})` : ''} • {mentorNames}
                              </div>
                              {fb.updatedAt && (
                                <span style={{ color: '#888', fontSize: '0.7rem' }}>
                                  {new Date(fb.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {fb.hasPhase1 || fb.hasPhase2 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {fb.phase1Feedback && (
                                  <div style={{
                                    background: 'rgba(0, 255, 204, 0.05)',
                                    borderLeft: '3px solid #00ffcc',
                                    padding: '8px 12px',
                                    borderRadius: '4px'
                                  }}>
                                    <div style={{ color: '#00ffcc', fontSize: '0.68rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                                      ⚡ PHASE 1 FEEDBACK:
                                    </div>
                                    <p style={{ color: '#ffffff', fontSize: '0.88rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {fb.phase1Feedback}
                                    </p>
                                  </div>
                                )}
                                {fb.phase2Feedback && (
                                  <div style={{
                                    background: 'rgba(255, 102, 204, 0.05)',
                                    borderLeft: '3px solid #ff66cc',
                                    padding: '8px 12px',
                                    borderRadius: '4px'
                                  }}>
                                    <div style={{ color: '#ff66cc', fontSize: '0.68rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                                      🚀 PHASE 2 FEEDBACK:
                                    </div>
                                    <p style={{ color: '#ffffff', fontSize: '0.88rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {fb.phase2Feedback}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p style={{
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                lineHeight: '1.6',
                                whiteSpace: 'pre-wrap',
                                margin: 0,
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '10px 14px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                              }}>
                                {fb.remarks}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px dashed rgba(253, 255, 0, 0.3)',
                      borderRadius: '6px',
                      padding: '12px 16px',
                      color: '#aaa',
                      fontSize: '0.8rem',
                      fontStyle: 'italic'
                    }}>
                      ⏳ No mentor feedback has been recorded for this team yet.
                    </div>
                  )}
                </div>
              )}

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
                        <th style={{ width: '32%' }}>Evaluation Criterion {isExternalRound3Judge ? '(Round 3 Rubrics)' : ''}</th>
                        <th>Description & Guidelines</th>
                        <th style={{ width: '16%', textAlign: 'center' }}>Weight & Max</th>
                        <th style={{ width: '22%', textAlign: 'center' }}>Score {isExternalRound3Judge ? '(0–20)' : '(0–10)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isExternalRound3Judge ? (
                        <>
                          {/* CRITERION 1: WORKING MVP (35%) */}
                          <tr>
                            <td className="criterion-name">
                              1. Working MVP & Functional Execution
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                                <span style={{
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1px solid #fdff00',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold'
                                }}>
                                  Weight: 35%
                                </span>
                                <button
                                  type="button"
                                  className="rubric-info-btn"
                                  onClick={() => { setSelectedRubricCategory(0); setShowRubrics(true); }}
                                >
                                  ℹ️ Rubric Details
                                </button>
                              </div>
                            </td>
                            <td className="criterion-desc">
                              Fully functional live demo, real-time data flow, sensor-to-software execution, hardware stability.
                            </td>
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 'bold' }}>20 Marks</div>
                              <div style={{ fontSize: '0.72rem', color: '#fdff00' }}>35% Weight</div>
                            </td>
                            <td className="score-input-cell">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                placeholder="0 - 20"
                                required
                                disabled={isLocked}
                                style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                                className={`eval-score-input ${isInvalid(c1) ? 'invalid-input' : ''}`}
                                value={c1}
                                onChange={(e) => setC1(e.target.value)}
                              />
                              {isInvalid(c1) ? (
                                <span className="invalid-badge">❌ INVALID (0-20)</span>
                              ) : (
                                <div style={{ fontSize: '0.72rem', color: '#00ffcc', fontWeight: 'bold', marginTop: '3px' }}>
                                  +{((parseFloat(c1) || 0) * 1.75).toFixed(1)} / 35 pts
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* CRITERION 2: TECHNICAL COMPLEXITY & INTEGRATION (25%) */}
                          <tr>
                            <td className="criterion-name">
                              2. Technical Complexity & Hardware/Software Integration
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                                <span style={{
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1px solid #fdff00',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold'
                                }}>
                                  Weight: 25%
                                </span>
                                <button
                                  type="button"
                                  className="rubric-info-btn"
                                  onClick={() => { setSelectedRubricCategory(1); setShowRubrics(true); }}
                                >
                                  ℹ️ Rubric Details
                                </button>
                              </div>
                            </td>
                            <td className="criterion-desc">
                              Code quality, hardware assembly, firmware stability, protocol integration e.g., MQTT/HTTP/Bluetooth.
                            </td>
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 'bold' }}>20 Marks</div>
                              <div style={{ fontSize: '0.72rem', color: '#fdff00' }}>25% Weight</div>
                            </td>
                            <td className="score-input-cell">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                placeholder="0 - 20"
                                required
                                disabled={isLocked}
                                style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                                className={`eval-score-input ${isInvalid(c2) ? 'invalid-input' : ''}`}
                                value={c2}
                                onChange={(e) => setC2(e.target.value)}
                              />
                              {isInvalid(c2) ? (
                                <span className="invalid-badge">❌ INVALID (0-20)</span>
                              ) : (
                                <div style={{ fontSize: '0.72rem', color: '#00ffcc', fontWeight: 'bold', marginTop: '3px' }}>
                                  +{((parseFloat(c2) || 0) * 1.25).toFixed(1)} / 25 pts
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* CRITERION 3: INNOVATION & PROBLEM IMPACT (20%) */}
                          <tr>
                            <td className="criterion-name">
                              3. Innovation & Problem Impact
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                                <span style={{
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1px solid #fdff00',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold'
                                }}>
                                  Weight: 20%
                                </span>
                                <button
                                  type="button"
                                  className="rubric-info-btn"
                                  onClick={() => { setSelectedRubricCategory(2); setShowRubrics(true); }}
                                >
                                  ℹ️ Rubric Details
                                </button>
                              </div>
                            </td>
                            <td className="criterion-desc">
                              Uniqueness of approach, real-world utility, efficiency improvement over existing solutions.
                            </td>
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 'bold' }}>20 Marks</div>
                              <div style={{ fontSize: '0.72rem', color: '#fdff00' }}>20% Weight</div>
                            </td>
                            <td className="score-input-cell">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                placeholder="0 - 20"
                                required
                                disabled={isLocked}
                                style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                                className={`eval-score-input ${isInvalid(c3) ? 'invalid-input' : ''}`}
                                value={c3}
                                onChange={(e) => setC3(e.target.value)}
                              />
                              {isInvalid(c3) ? (
                                <span className="invalid-badge">❌ INVALID (0-20)</span>
                              ) : (
                                <div style={{ fontSize: '0.72rem', color: '#00ffcc', fontWeight: 'bold', marginTop: '3px' }}>
                                  +{((parseFloat(c3) || 0) * 1.0).toFixed(1)} / 20 pts
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* CRITERION 4: UI/UX, INDUSTRIAL DESIGN & FORM FACTOR (10%) */}
                          <tr>
                            <td className="criterion-name">
                              4. UI/UX, Industrial Design & Form Factor
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                                <span style={{
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1px solid #fdff00',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold'
                                }}>
                                  Weight: 10%
                                </span>
                                <button
                                  type="button"
                                  className="rubric-info-btn"
                                  onClick={() => { setSelectedRubricCategory(3); setShowRubrics(true); }}
                                >
                                  ℹ️ Rubric Details
                                </button>
                              </div>
                            </td>
                            <td className="criterion-desc">
                              Intuitive software UI/UX, neat circuit wiring, physical casing/enclosure design, user safety.
                            </td>
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 'bold' }}>20 Marks</div>
                              <div style={{ fontSize: '0.72rem', color: '#fdff00' }}>10% Weight</div>
                            </td>
                            <td className="score-input-cell">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                placeholder="0 - 20"
                                required
                                disabled={isLocked}
                                style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                                className={`eval-score-input ${isInvalid(c4) ? 'invalid-input' : ''}`}
                                value={c4}
                                onChange={(e) => setC4(e.target.value)}
                              />
                              {isInvalid(c4) ? (
                                <span className="invalid-badge">❌ INVALID (0-20)</span>
                              ) : (
                                <div style={{ fontSize: '0.72rem', color: '#00ffcc', fontWeight: 'bold', marginTop: '3px' }}>
                                  +{((parseFloat(c4) || 0) * 0.5).toFixed(1)} / 10 pts
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* CRITERION 5: PRESENTATION, PITCH & LIVE DEMO (10%) */}
                          <tr>
                            <td className="criterion-name">
                              5. Presentation, Pitch & Live Technical Demo
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                                <span style={{
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1px solid #fdff00',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold'
                                }}>
                                  Weight: 10%
                                </span>
                                <button
                                  type="button"
                                  className="rubric-info-btn"
                                  onClick={() => { setSelectedRubricCategory(4); setShowRubrics(true); }}
                                >
                                  ℹ️ Rubric Details
                                </button>
                              </div>
                            </td>
                            <td className="criterion-desc">
                              Clarity of live demo, structured pitch, team collaboration, depth of technical Q&A responses.
                            </td>
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 'bold' }}>20 Marks</div>
                              <div style={{ fontSize: '0.72rem', color: '#fdff00' }}>10% Weight</div>
                            </td>
                            <td className="score-input-cell">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                placeholder="0 - 20"
                                required
                                disabled={isLocked}
                                style={isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)', color: '#00ffcc', fontWeight: 'bold' } : {}}
                                className={`eval-score-input ${isInvalid(c5) ? 'invalid-input' : ''}`}
                                value={c5}
                                onChange={(e) => setC5(e.target.value)}
                              />
                              {isInvalid(c5) ? (
                                <span className="invalid-badge">❌ INVALID (0-20)</span>
                              ) : (
                                <div style={{ fontSize: '0.72rem', color: '#00ffcc', fontWeight: 'bold', marginTop: '3px' }}>
                                  +{((parseFloat(c5) || 0) * 0.5).toFixed(1)} / 10 pts
                                </div>
                              )}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <>
                          {/* LEGACY ROUND 2 ROWS (Max 10 each) */}
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
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>10 Marks</td>
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
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>10 Marks</td>
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
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>10 Marks</td>
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
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>10 Marks</td>
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
                            <td className="max-marks-cell" style={{ textAlign: 'center' }}>10 Marks</td>
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
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* TOTAL SCORE DISPLAY BOX */}
                <div className="total-score-box" style={hasInvalidMarks ? { borderColor: '#ff4d4d', boxShadow: '0 0 20px rgba(255, 77, 77, 0.4)' } : {}}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span className="total-label">
                      {isExternalRound3Judge ? '🏆 TOTAL OVERALL EVALUATION SCORE (100%):' : 'TOTAL EVALUATION SCORE:'}
                    </span>
                    <span className="total-value" style={hasInvalidMarks ? { color: '#ff4d4d', textShadow: '0 0 10px #ff4d4d' } : {}}>
                      {hasInvalidMarks
                        ? (isExternalRound3Judge ? '⚠️ INVALID MARKS (Must be 0–20)' : '⚠️ INVALID MARKS ENTERED')
                        : (isExternalRound3Judge ? `${weightedTotal} / 100` : `${totalScore} / 50`)}
                    </span>
                    {isExternalRound3Judge && !hasInvalidMarks && (
                      <div style={{ fontSize: '0.8rem', color: '#00ffcc', fontFamily: 'Outfit, sans-serif', marginTop: '4px' }}>
                        Weighted Score: <strong style={{ color: '#fdff00' }}>{weightedTotal}%</strong> • Raw Marks Sum: <strong>{rawTotal} / 100</strong>
                      </div>
                    )}
                  </div>
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
                <p className="victory-subtitle">MENTOR FEEDBACK RECORDED FOR {teamName.toUpperCase()}</p>
                <div className="score-box" style={{ background: 'rgba(0, 255, 204, 0.08)', borderColor: '#00ffcc', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {phase1Remarks.trim() && (
                    <div style={{ textAlign: 'left', borderBottom: phase2Remarks.trim() ? '1px dashed rgba(0, 255, 204, 0.3)' : 'none', paddingBottom: phase2Remarks.trim() ? '8px' : '0' }}>
                      <div style={{ color: '#00ffcc', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                        ⚡ PHASE 1 FEEDBACK:
                      </div>
                      <div style={{ color: '#fff', fontSize: '0.82rem', fontStyle: 'italic', lineHeight: '1.5', maxHeight: '100px', overflowY: 'auto' }}>
                        &ldquo;{phase1Remarks.trim()}&rdquo;
                      </div>
                    </div>
                  )}
                  {phase2Remarks.trim() && (
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: '#ff66cc', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', marginBottom: '4px' }}>
                        🚀 PHASE 2 FEEDBACK:
                      </div>
                      <div style={{ color: '#fff', fontSize: '0.82rem', fontStyle: 'italic', lineHeight: '1.5', maxHeight: '100px', overflowY: 'auto' }}>
                        &ldquo;{phase2Remarks.trim()}&rdquo;
                      </div>
                    </div>
                  )}
                  {!phase1Remarks.trim() && !phase2Remarks.trim() && remarks.trim() && (
                    <div style={{ color: '#fff', fontSize: '0.84rem', fontStyle: 'italic', lineHeight: '1.5' }}>
                      &ldquo;{remarks}&rdquo;
                    </div>
                  )}
                  {IS_PHASE_2_LOCKED && (
                    <div style={{
                      background: 'rgba(255, 51, 102, 0.12)',
                      border: '1px solid #ff3366',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      fontSize: '0.62rem',
                      color: '#ff88a3',
                      fontFamily: 'Press Start 2P, monospace',
                      textAlign: 'center',
                      lineHeight: '1.4'
                    }}>
                      🔒 PHASE 2 LOCKED • WILL UNLOCK FOR NEXT SPRINT
                    </div>
                  )}
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
