'use client';

import { useState } from 'react';

const rubricCriteria = [
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

export default function RubricsModal({ isOpen, onClose, categoryIndex = null }) {
  if (!isOpen) return null;

  const displayCriteria = (categoryIndex !== null && categoryIndex >= 0 && categoryIndex < rubricCriteria.length)
    ? [rubricCriteria[categoryIndex]]
    : rubricCriteria;

  const isSingle = categoryIndex !== null && categoryIndex >= 0 && categoryIndex < rubricCriteria.length;
  const currentTitle = isSingle ? rubricCriteria[categoryIndex].title : 'MECIA 3.0 ROUND 2 RUBRICS';

  return (
    <div className="modal-overlay show" style={{ zIndex: 2000, overflowY: 'auto', padding: '20px 10px' }}>
      <div className="modal-card" style={{ maxWidth: '850px', width: '100%', textAlign: 'left', padding: '28px 24px', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid var(--inky-cyan)', paddingBottom: '12px' }}>
          <div>
            <h2 className="victory-title" style={{ fontSize: '1.05rem', margin: 0, textAlign: 'left', color: 'var(--inky-cyan)' }}>
              ℹ️ {currentTitle}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isSingle ? 'Detailed Criteria & Performance Expectation Guidelines' : 'Official Evaluation Criteria & Scoring Matrix for Judges (Max 10 Marks Each)'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href="/round-2-rubrics.docx"
              download="Mecia_3.0_Round_2_Rubrics.docx"
              className="eval-btn edit-btn"
              style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '0.75rem' }}
            >
              📥 DOWNLOAD DOCX
            </a>
            <button
              type="button"
              className="logout-btn"
              onClick={onClose}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            >
              ❌ CLOSE
            </button>
          </div>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '6px' }}>
          {displayCriteria.map((c, idx) => {
            const actualIndex = isSingle ? categoryIndex : idx;
            return (
              <div key={actualIndex} style={{ marginBottom: '20px', background: 'rgba(0, 0, 0, 0.6)', border: '1px solid rgba(0, 255, 255, 0.3)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--pacman-yellow)', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                    {actualIndex + 1}. {c.title}
                  </h3>
                  <span className="max-mark-badge" style={{ fontSize: '0.7rem' }}>Max: {c.maxMarks}</span>
                </div>

                <div className="table-responsive">
                  <table className="eval-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Score Band</th>
                        <th>Performance Expectation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.scores.map((s, sIdx) => (
                        <tr key={sIdx}>
                          <td style={{ fontWeight: '700', color: sIdx >= 3 ? 'var(--inky-cyan)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {s.range}
                          </td>
                          <td style={{ color: '#e2e8f0', lineHeight: 1.4 }}>{s.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button type="button" className="submit-btn" onClick={onClose} style={{ marginTop: 0, padding: '10px 24px' }}>
            GOT IT / CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
