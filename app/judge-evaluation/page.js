'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function JudgeEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamParam = searchParams.get('team') || 'Cyber Byte Squad';

  const [judgeEmail, setJudgeEmail] = useState('judge@eval.org');
  const [teamName, setTeamName] = useState(teamParam);
  const [teamSub, setTeamSub] = useState(`Evaluating team: ${teamParam}`);

  // Rubric scores
  const [c1, setC1] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(0);
  const [c4, setC4] = useState(0);
  const [remarks, setRemarks] = useState('');

  const [showModal, setShowModal] = useState(false);

  const totalScore = Math.min(100, Math.max(0, (parseInt(c1) || 0) + (parseInt(c2) || 0) + (parseInt(c3) || 0) + (parseInt(c4) || 0)));

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
        setRemarks(data.remarks ?? '');
      } else if (name.toLowerCase() === 'quantum hackers') {
        setC1(22);
        setC2(23);
        setC3(21);
        setC4(22);
        setRemarks('Strong post-quantum security architecture and live demo.');
      }
    } catch (e) {
      console.warn("Supabase fetch marks warning:", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
            <div className="student-hud-badge">
              <span className="ghost cyan-ghost" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> JUDGE: <span>{judgeEmail}</span>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

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
            <h3 className="section-title"><span className="pacman-bullet"></span> EVALUATION CRITERIA MARKSHEET (MAX 100 MARKS)</h3>

            <div className="table-responsive">
              <table className="eval-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Evaluation Criterion</th>
                    <th>Description</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Max Marks</th>
                    <th style={{ width: '22%', textAlign: 'center' }}>Score (0-25)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="criterion-name">1. Innovation & Originality</td>
                    <td className="criterion-desc">Uniqueness of the idea, novelty of approach, and creative problem solving.</td>
                    <td className="max-marks-cell">25</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="25"
                        placeholder="0 - 25"
                        required
                        className="eval-score-input"
                        value={c1}
                        onChange={(e) => setC1(e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">2. Technical Execution & Architecture</td>
                    <td className="criterion-desc">Code quality, system complexity, tech stack utilization, and stability.</td>
                    <td className="max-marks-cell">25</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="25"
                        placeholder="0 - 25"
                        required
                        className="eval-score-input"
                        value={c2}
                        onChange={(e) => setC2(e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">3. Solution Feasibility & Impact</td>
                    <td className="criterion-desc">Practical implementation, real-world utility, scalability, and impact.</td>
                    <td className="max-marks-cell">25</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="25"
                        placeholder="0 - 25"
                        required
                        className="eval-score-input"
                        value={c3}
                        onChange={(e) => setC3(e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="criterion-name">4. Presentation, UI/UX & Demo</td>
                    <td className="criterion-desc">Quality of live demonstration, user experience design, and pitch clarity.</td>
                    <td className="max-marks-cell">25</td>
                    <td className="score-input-cell">
                      <input
                        type="number"
                        min="0"
                        max="25"
                        placeholder="0 - 25"
                        required
                        className="eval-score-input"
                        value={c4}
                        onChange={(e) => setC4(e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* TOTAL SCORE DISPLAY BOX */}
            <div className="total-score-box">
              <span className="total-label">TOTAL EVALUATION SCORE:</span>
              <span className="total-value">{totalScore} / 100</span>
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
              <span>FINAL TEAM SCORE: <span className="hud-yellow">{totalScore} / 100</span></span>
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
