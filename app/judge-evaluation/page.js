'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RubricsModal from '@/app/components/RubricsModal';

function JudgeEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamParam = searchParams.get('team') || 'Cyber Byte Squad';

  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teamName, setTeamName] = useState(teamParam);
  const [teamSub, setTeamSub] = useState(`Evaluating team: ${teamParam}`);

  // Rubric scores (Round 2 Evaluation Sheet - Max 10 marks per section)
  const [c1, setC1] = useState(0); // System Architecture & Technical Readiness (Max 10)
  const [c2, setC2] = useState(0); // Interface/Circuit / Prototype Scope (Max 10)
  const [c3, setC3] = useState(0); // Data, API / Hardware Component Availability (Max 10)
  const [c4, setC4] = useState(0); // Execution Feasibility & Timeline (Max 10)
  const [c5, setC5] = useState(0); // Implementation Details (Max 10)
  const [remarks, setRemarks] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);

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
      setTeamSub(`Evaluating team: ${teamParam}`);
      loadExistingMarks(teamParam);
    }
  }, [teamParam]);

  const loadExistingMarks = async (name) => {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .ilike('team_name', name)
        .maybeSingle();

      if (data && !error) {
        setC1(data.c1_innovation ?? 0);
        setC2(data.c2_execution ?? 0);
        setC3(data.c3_feasibility ?? 0);
        setC4(data.c4_presentation ?? 0);
        setC5(data.c5_details ?? 0);
        setRemarks(data.remarks ?? '');
      } else if (name.toLowerCase() === 'quantum hackers') {
        setC1(9);
        setC2(9);
        setC3(9);
        setC4(8);
        setC5(9);
        setRemarks('Strong post-quantum security architecture and live demo.');
      }
    } catch (e) {
      console.warn("Supabase fetch marks warning:", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (hasInvalidMarks) {
      alert("⚠️ Invalid Marks: Scores for each criterion must be between 0 and 10.");
      return;
    }

    try {
      const { data: existingEval } = await supabase
        .from('evaluations')
        .select('id')
        .ilike('team_name', teamName)
        .eq('judge_email', judgeEmail)
        .maybeSingle();

      let evalErr = null;
      if (existingEval && existingEval.id) {
        const { error } = await supabase
          .from('evaluations')
          .update({
            c1_innovation: parseInt(c1) || 0,
            c2_execution: parseInt(c2) || 0,
            c3_feasibility: parseInt(c3) || 0,
            c4_presentation: parseInt(c4) || 0,
            c5_details: parseInt(c5) || 0,
            total_score: totalScore,
            remarks: remarks,
            updated_at: new Date()
          })
          .eq('id', existingEval.id);
        evalErr = error;
      } else {
        const { error } = await supabase
          .from('evaluations')
          .insert([{
            team_name: teamName,
            judge_email: judgeEmail,
            c1_innovation: parseInt(c1) || 0,
            c2_execution: parseInt(c2) || 0,
            c3_feasibility: parseInt(c3) || 0,
            c4_presentation: parseInt(c4) || 0,
            c5_details: parseInt(c5) || 0,
            total_score: totalScore,
            remarks: remarks,
            updated_at: new Date()
          }]);
        evalErr = error;
      }

      if (evalErr) {
        console.error("Supabase evaluation save error:", evalErr);
        alert("Supabase Database Notice: " + evalErr.message);
      }
    } catch (err) {
      console.warn("Evaluation submit error:", err);
    }

    setShowModal(true);
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
        <div className="nav-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <button type="button" className="nav-back-btn" onClick={() => router.push('/judge-dashboard')}>
            ⬅️ RETURN TO DASHBOARD
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="eval-btn edit-btn"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => setShowRubrics(true)}
            >
              📋 ROUND 2 RUBRICS
            </button>
            <div className="student-hud-badge">
              <span className="ghost cyan-ghost" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> JUDGE: <span>{judgeEmail}</span>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

        <RubricsModal isOpen={showRubrics} onClose={() => setShowRubrics(false)} />

        {/* Team Banner Header */}
        <div className="login-header text-left team-banner-section">
          <div className="badge-wrapper">
            <span className="role-badge eval-badge">STAGE 2: RUBRIC EVALUATION</span>
          </div>
          <h2>EVALUATING: <span className="highlight-title">{teamName}</span></h2>
          <p>{teamSub}</p>
        </div>

        {/* Evaluation Marksheet Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3 className="section-title"><span className="pacman-bullet"></span> EVALUATION CRITERIA MARKSHEET (MAX 50 MARKS)</h3>

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
                    <td className="criterion-name">1. System Architecture & Technical Readiness</td>
                    <td className="criterion-desc">Clear block/circuit diagrams, tech stack setup, component selection, software/hardware architecture logic.</td>
                    <td className="max-marks-cell">10</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="0 - 10"
                        required
                        className={`eval-score-input ${isInvalid(c1) ? 'invalid-input' : ''}`}
                        value={c1}
                        onChange={(e) => setC1(e.target.value)}
                      />
                      {isInvalid(c1) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">2. Interface/Circuit / Prototype Scope</td>
                    <td className="criterion-desc">Figma wireframes, UX flows, schematics, CAD models, physical/digital layout completeness.</td>
                    <td className="max-marks-cell">10</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="0 - 10"
                        required
                        className={`eval-score-input ${isInvalid(c2) ? 'invalid-input' : ''}`}
                        value={c2}
                        onChange={(e) => setC2(e.target.value)}
                      />
                      {isInvalid(c2) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">3. Data, API / Hardware Component Availability</td>
                    <td className="criterion-desc">APIs/keys verified, datasets accessible, physical hardware/sensors/microcontrollers procured and ready.</td>
                    <td className="max-marks-cell">10</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="0 - 10"
                        required
                        className={`eval-score-input ${isInvalid(c3) ? 'invalid-input' : ''}`}
                        value={c3}
                        onChange={(e) => setC3(e.target.value)}
                      />
                      {isInvalid(c3) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">4. Execution Feasibility & Timeline</td>
                    <td className="criterion-desc">Feasibility of completing a working MVP/physical prototype during the 24-hour sprint.</td>
                    <td className="max-marks-cell">10</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="0 - 10"
                        required
                        className={`eval-score-input ${isInvalid(c4) ? 'invalid-input' : ''}`}
                        value={c4}
                        onChange={(e) => setC4(e.target.value)}
                      />
                      {isInvalid(c4) && <span className="invalid-badge">❌ INVALID (0-10)</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">5. Implementation Details</td>
                    <td className="criterion-desc">Granular breakdown of build steps, module-wise execution plan, pinouts, and technical task assignments.</td>
                    <td className="max-marks-cell">10</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="0 - 10"
                        required
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
                onChange={(e) => setRemarks(e.target.value)}
              ></textarea>
            </div>
          </div>

          <button type="submit" className="submit-btn full-width-btn">
            <span className="pacman-icon"></span> SUBMIT EVALUATION MARKS
          </button>
        </form>

        <div className="arcade-footer">
          <span>JUDGE EVALUATION SYSTEM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>

      {/* Score Submission Modal */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="modal-card">
            <div className="modal-ghost-row">
              <div className="ghost blinky"></div>
              <div className="ghost pinky"></div>
              <div className="ghost inky"></div>
              <div className="ghost clyde"></div>
            </div>
            <h2 className="victory-title">EVALUATION SUBMITTED!</h2>
            <p className="victory-subtitle">MARKS RECORDED SUCCESSFULLY FOR TEAM</p>
            <div className="score-box">
              <span>FINAL TEAM SCORE: <span className="hud-yellow">{totalScore} / 50</span></span>
            </div>
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
