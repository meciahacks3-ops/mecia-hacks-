'use client';

import { useState, useEffect } from 'react';

export const round3RubricCriteria = [
  {
    title: 'Working MVP & Functional Execution',
    weight: '35%',
    weightNum: 35,
    maxMarks: '20 Marks (Weight: 35%)',
    description: 'Fully functional live demo, real-time data flow, sensor-to-software execution, hardware stability.',
    scores: [
      { range: '1–4 (Poor)', text: 'Minimal or non-functional prototype; core logic crashes or fails during live run; sensor/hardware components unpowered, disconnected, or unresponsive; unable to demonstrate basic execution flow.' },
      { range: '5–8 (Fair)', text: 'Partially functional prototype; intermittent data flow or hardware instability; frequent glitches requiring continuous manual intervention; core software/hardware loop incomplete.' },
      { range: '9–12 (Good)', text: 'Working MVP completing core user flow; stable live demo under normal conditions; minor UI glitches, latency, or non-critical edge-case bugs; clear software-to-hardware coordination.' },
      { range: '13–16 (Very Good)', text: 'Highly reliable live execution; real-time sensor/data streaming operational without crashes; solid hardware assembly and resilient error handling during live demo.' },
      { range: '17–20 (Excellent)', text: 'Production-grade MVP execution; seamless end-to-end integration; instant response times, zero demo failures, robust failover handling, and polished live functionality.' }
    ]
  },
  {
    title: 'Technical Complexity & Hardware/Software Integration',
    weight: '25%',
    weightNum: 25,
    maxMarks: '20 Marks (Weight: 25%)',
    description: 'Code quality, hardware assembly, firmware stability, protocol integration e.g., MQTT/HTTP/Bluetooth.',
    scores: [
      { range: '1–4 (Poor)', text: 'Trivial architecture; heavy reliance on pre-built templates without modification; disconnected hardware/software with mock data only; unstable firmware setup.' },
      { range: '5–8 (Fair)', text: 'Basic integration; simple sensor reads or standard API calls; rudimentary system design with significant architectural bottlenecks or brittle communication protocols.' },
      { range: '9–12 (Good)', text: 'Well-architected solution; clean integration between hardware (microcontrollers/sensors) and software (backend/cloud/UI); proper communication protocol implementation (MQTT, HTTP, WebSockets, Bluetooth).' },
      { range: '13–16 (Very Good)', text: 'Advanced technical complexity; custom firmware or optimized algorithm implementation; robust multithreading/async handling; elegant circuit design and high reliability.' },
      { range: '17–20 (Excellent)', text: 'Masterful engineering; complex low-latency bidirectional pipeline; custom PCB or optimized circuitry; exceptional code modularity, security, and scalability.' }
    ]
  },
  {
    title: 'Innovation & Problem Impact',
    weight: '20%',
    weightNum: 20,
    maxMarks: '20 Marks (Weight: 20%)',
    description: 'Uniqueness of approach, real-world utility, efficiency improvement over existing solutions.',
    scores: [
      { range: '1–4 (Poor)', text: 'Conventional or derivative concept; minimal novelty; unclear real-world problem statement or negligible impact.' },
      { range: '5–8 (Fair)', text: 'Minor modification of existing tools or open-source tutorials; limited real-world utility or very narrow application scope.' },
      { range: '9–12 (Good)', text: 'Creative and original approach; directly solves a valid industry/societal pain point with clear benefits over standard alternatives.' },
      { range: '13–16 (Very Good)', text: 'Highly innovative approach; clear technological or operational advantage over existing market alternatives; validated market or user necessity.' },
      { range: '17–20 (Excellent)', text: 'Breakthrough innovation; paradigm-shifting solution; exceptional commercial/deployment viability, sustainability, and transformative potential.' }
    ]
  },
  {
    title: 'UI/UX, Industrial Design & Form Factor',
    weight: '10%',
    weightNum: 10,
    maxMarks: '20 Marks (Weight: 10%)',
    description: 'Intuitive software UI/UX, neat circuit wiring, physical casing/enclosure design, user safety.',
    scores: [
      { range: '1–4 (Poor)', text: 'Chaotic or broken UI; unorganized exposed wiring; no casing or structural support; hazardous electrical setup.' },
      { range: '5–8 (Fair)', text: 'Basic UI with poor accessibility/responsiveness; loose wiring or crude breadboard setup without enclosure; minimal ergonomics.' },
      { range: '9–12 (Good)', text: 'Clean, responsive user interface; organized circuit wiring; functional mounting, casing, or breadboard layout; clear feedback mechanisms.' },
      { range: '13–16 (Very Good)', text: 'Polished UI/UX design with smooth transitions and error handling; 3D-printed or custom enclosure; professional wiring harness and safe housing.' },
      { range: '17–20 (Excellent)', text: 'Commercial-grade industrial form factor; ergonomic casing with thoughtful aesthetics; seamless user flow and complete physical/electrical safety considerations.' }
    ]
  },
  {
    title: 'Presentation, Pitch & Live Technical Demo',
    weight: '10%',
    weightNum: 10,
    maxMarks: '20 Marks (Weight: 10%)',
    description: 'Clarity of live demo, structured pitch, team collaboration, depth of technical Q&A responses.',
    scores: [
      { range: '1–4 (Poor)', text: 'Disorganized presentation; inability to explain system architecture; failed demo with no explanation; team unable to answer jury questions.' },
      { range: '5–8 (Fair)', text: 'Rushed pitch with unclear problem framing; over-reliance on slides rather than working prototype; weak defense in Q&A.' },
      { range: '9–12 (Good)', text: 'Clear structured presentation; convincing live demo; cohesive team participation; satisfactory answers to jury questions.' },
      { range: '13–16 (Very Good)', text: 'Compelling narrative and business case; seamless live demonstration; confident and precise responses to technical jury queries.' },
      { range: '17–20 (Excellent)', text: 'Exemplary pitch; masterclass technical demonstration; comprehensive understanding of future roadmap and scalability; brilliant defense during Q&A.' }
    ]
  }
];

export const round2RubricCriteria = [
  {
    title: 'System Architecture & Technical Readiness',
    maxMarks: '10 Marks',
    scores: [
      { range: '1–2 (Poor)', text: 'No system or circuit architecture provided; tech stack or hardware components completely undefined.' },
      { range: '3–4 (Fair)', text: 'Basic architecture; unclear software/hardware integration or missing critical system components.' },
      { range: '5–6 (Good)', text: 'Clear system architecture or block diagram; sound tech stack and logic circuit selection.' },
      { range: '7–8 (Very Good)', text: 'Well-structured technical architecture; dependencies, component compatibility, and potential hurdles pre-identified.' },
      { range: '9–10 (Excellent)', text: 'Robust, complete architecture roadmap (software/hardware); pre-configured development environment or pinout mapping ready.' }
    ]
  },
  {
    title: 'Interface / Circuit / Prototype Scope',
    maxMarks: '10 Marks',
    scores: [
      { range: '1–2 (Poor)', text: 'No UI wireframes, CAD models, or schematics prepared; user/device flow completely undefined.' },
      { range: '3–4 (Fair)', text: 'Bare minimum sketches/schematics; missing core user flow or cluttered, unorganized layout.' },
      { range: '5–6 (Good)', text: 'Clear wireframes (Figma) or circuit schematics mapping the primary flow and layout.' },
      { range: '7–8 (Very Good)', text: 'Detailed wireframes/3D CAD models/schematics; well-thought-out UI and physical/digital interaction flow.' },
      { range: '9–10 (Excellent)', text: 'Polished, interactive prototype design (Figma) or fully modeled CAD/breadboard plan; ready for live deployment.' }
    ]
  },
  {
    title: 'Data, API / Hardware Component Availability',
    maxMarks: '10 Marks',
    scores: [
      { range: '1–2 (Poor)', text: 'Required APIs, datasets, microcontrollers, or physical sensors are unverified or missing entirely.' },
      { range: '3–4 (Fair)', text: 'Major APIs or essential hardware components missing; high risk of assembly or integration failure.' },
      { range: '5–6 (Good)', text: 'Primary APIs, datasets, and hardware modules identified and physically available.' },
      { range: '7–8 (Very Good)', text: 'All required API keys, endpoints, and physical hardware components acquired and basic connectivity/power verified.' },
      { range: '9–10 (Excellent)', text: 'All APIs/keys tested; physical sensors, microcontrollers, and datasets pre-tested and ready for full assembly.' }
    ]
  },
  {
    title: 'Execution Feasibility & Timeline',
    maxMarks: '10 Marks',
    scores: [
      { range: '1–2 (Poor)', text: 'Unrealistic build; impossible to code or assemble a functional working demo in 24 hours.' },
      { range: '3–4 (Fair)', text: 'Scope is bloated; high risk of failing to deliver a functional MVP/hardware build.' },
      { range: '5–6 (Good)', text: 'Reasonable MVP scope; team has a viable plan to assemble and build within the 24-hour limit.' },
      { range: '7–8 (Very Good)', text: 'Well-scoped MVP; clear boundary between core features/hardware setup and stretch goals.' },
      { range: '9–10 (Excellent)', text: 'Perfectly calibrated scope for a 24-hour sprint; clear task distribution across software and hardware execution.' }
    ]
  },
  {
    title: 'Implementation Details',
    maxMarks: '10 Marks',
    scores: [
      { range: '1–2 (Poor)', text: 'No implementation details provided; build steps and technical execution strategy are missing completely.' },
      { range: '3–4 (Fair)', text: 'Vague build plan; key technical steps, pinouts, or code module breakdowns are omitted or unclear.' },
      { range: '5–6 (Good)', text: 'Moderate details; basic step-by-step technical plan outlined for core software or hardware modules.' },
      { range: '7–8 (Very Good)', text: 'Comprehensive implementation details; clear module breakdowns, pinout schemes, and data flow steps.' },
      { range: '9–10 (Excellent)', text: 'Flawless technical specifics; granular step-by-step build roadmap, explicit pin mappings, and task assignments ready for immediate build.' }
    ]
  }
];

export default function RubricsModal({ isOpen, onClose, categoryIndex = null, defaultRound = 3 }) {
  const [selectedRound, setSelectedRound] = useState(defaultRound);

  useEffect(() => {
    if (defaultRound) {
      setSelectedRound(defaultRound);
    }
  }, [defaultRound]);

  if (!isOpen) return null;

  const currentCriteriaList = selectedRound === 3 ? round3RubricCriteria : round2RubricCriteria;
  const isSingle = categoryIndex !== null && categoryIndex >= 0 && categoryIndex < currentCriteriaList.length;
  const displayCriteria = isSingle ? [currentCriteriaList[categoryIndex]] : currentCriteriaList;

  const currentTitle = isSingle
    ? currentCriteriaList[categoryIndex].title
    : (selectedRound === 3 ? 'MECIA 3.0: ROUND 3 SCORING RUBRICS (GRAND FINALE)' : 'MECIA 3.0: ROUND 2 EVALUATION RUBRICS');

  return (
    <div className="modal-overlay show" style={{ zIndex: 2000, overflowY: 'auto', padding: '20px 10px' }}>
      <div className="modal-card" style={{ maxWidth: '880px', width: '100%', textAlign: 'left', padding: '24px 24px', margin: 'auto' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', borderBottom: '2px solid var(--inky-cyan)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 className="victory-title" style={{ fontSize: '1.05rem', margin: 0, textAlign: 'left', color: 'var(--inky-cyan)' }}>
              ℹ️ {currentTitle}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isSingle
                ? (selectedRound === 3
                    ? `Category ${categoryIndex + 1} Guidelines • Weight: ${currentCriteriaList[categoryIndex].weight} • Score Scale: 1–20`
                    : `Category ${categoryIndex + 1} Guidelines • Max 10 Marks`)
                : (selectedRound === 3
                    ? 'Official External Jury Scoring Rubrics (5 Criteria • 1–20 Score Scale • Weighted Total = 100%)'
                    : 'Round 2 Prototype Architecture & Readiness Matrix (Max 10 Marks Each • Total = 50 Marks)')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href={selectedRound === 3 ? '/round-3-rubrics.docx' : '/round-2-rubrics.docx'}
              download={selectedRound === 3 ? 'Mecia_3.0_Round_3_Rubrics.docx' : 'Mecia_3.0_Round_2_Rubrics.docx'}
              className="eval-btn edit-btn"
              style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Download official evaluation sheet DOCX"
            >
              📥 DOWNLOAD DOCX
            </a>
            <button
              type="button"
              className="logout-btn"
              onClick={onClose}
              style={{ padding: '6px 12px', fontSize: '0.72rem' }}
            >
              ❌ CLOSE
            </button>
          </div>
        </div>

        {/* Round Switcher Tabs (shown when browsing all rubrics) */}
        {!isSingle && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.04)', padding: '6px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setSelectedRound(3)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '6px',
                border: selectedRound === 3 ? '1.5px solid #fdff00' : '1px solid transparent',
                background: selectedRound === 3 ? 'rgba(253, 255, 0, 0.15)' : 'transparent',
                color: selectedRound === 3 ? '#fdff00' : 'var(--text-muted)'
              }}
            >
              🏆 ROUND 3: GRAND FINALE RUBRICS (100% WEIGHTED)
            </button>
            <button
              type="button"
              onClick={() => setSelectedRound(2)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '6px',
                border: selectedRound === 2 ? '1.5px solid #00ffcc' : '1px solid transparent',
                background: selectedRound === 2 ? 'rgba(0, 255, 204, 0.15)' : 'transparent',
                color: selectedRound === 2 ? '#00ffcc' : 'var(--text-muted)'
              }}
            >
              📋 ROUND 2: PROTOTYPE RUBRICS (50 MARKS)
            </button>
          </div>
        )}

        {/* Criteria List */}
        <div style={{ maxHeight: '62vh', overflowY: 'auto', paddingRight: '6px' }}>
          {displayCriteria.map((c, idx) => {
            const actualIndex = isSingle ? categoryIndex : idx;
            return (
              <div
                key={actualIndex}
                className="rubric-item-box"
                style={{
                  marginBottom: '18px',
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1px solid rgba(0, 255, 255, 0.25)',
                  borderRadius: '10px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', color: 'var(--pacman-yellow)', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                      {actualIndex + 1}. {c.title}
                    </h3>
                    {c.description && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                        {c.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {c.weight && (
                      <span style={{
                        background: 'rgba(253, 255, 0, 0.15)',
                        color: '#fdff00',
                        border: '1px solid #fdff00',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        fontFamily: 'Outfit, sans-serif'
                      }}>
                        Weight: {c.weight}
                      </span>
                    )}
                    <span className="max-mark-badge" style={{ fontSize: '0.72rem' }}>
                      Max: {c.maxMarks}
                    </span>
                  </div>
                </div>

                <div className="table-responsive" style={{ marginTop: '10px' }}>
                  <table className="eval-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Score Band</th>
                        <th>Performance Expectation & Technical Standards</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.scores.map((s, sIdx) => (
                        <tr key={sIdx}>
                          <td style={{ fontWeight: '700', color: sIdx >= 3 ? '#00ffcc' : sIdx === 2 ? '#fdff00' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {s.range}
                          </td>
                          <td style={{ color: '#e2e8f0', lineHeight: 1.45 }}>{s.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Round 3 Scoring Summary Card */}
          {selectedRound === 3 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(253, 255, 0, 0.08) 0%, rgba(0, 255, 204, 0.08) 100%)',
              border: '1px solid rgba(253, 255, 0, 0.35)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginTop: '12px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace' }}>
                📊 ROUND 3 WEIGHTED SCORING BREAKDOWN
              </h4>
              <div style={{ fontSize: '0.78rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                <div>• <strong>Criterion 1 (Working MVP):</strong> 35% Weight <em>(Score × 1.75 = Max 35 pts)</em></div>
                <div>• <strong>Criterion 2 (Technical Complexity & Integration):</strong> 25% Weight <em>(Score × 1.25 = Max 25 pts)</em></div>
                <div>• <strong>Criterion 3 (Innovation & Problem Impact):</strong> 20% Weight <em>(Score × 1.00 = Max 20 pts)</em></div>
                <div>• <strong>Criterion 4 (UI/UX, Design & Form Factor):</strong> 10% Weight <em>(Score × 0.50 = Max 10 pts)</em></div>
                <div>• <strong>Criterion 5 (Presentation, Pitch & Live Demo):</strong> 10% Weight <em>(Score × 0.50 = Max 10 pts)</em></div>
                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.2)', color: '#00ffcc', fontWeight: 'bold' }}>
                  🎯 Total Overall Evaluation Score = Weighted Sum of all 5 Criteria (Max: 100%)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Reference document: <strong>Round 3.docx (Final Hackathon)</strong>
          </span>
          <button type="button" className="submit-btn" onClick={onClose} style={{ marginTop: 0, padding: '10px 24px' }}>
            GOT IT / CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
