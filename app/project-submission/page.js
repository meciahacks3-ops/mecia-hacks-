'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProjectSubmissionPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  
  // Team leader state
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');

  // Team members state
  const [members, setMembers] = useState([
    { name: '', email: '', idNo: '', phone: '' }
  ]);

  // Project details state
  const [projectTitle, setProjectTitle] = useState('');
  const [projectType, setProjectType] = useState('hardware');
  const [projectIdea, setProjectIdea] = useState('');
  const [techStack, setTechStack] = useState('');

  // UI state
  const [showModal, setShowModal] = useState(false);

  const isLeaderComplete = Boolean(teamName && leaderName && leaderEmail && leaderId && leaderPhone);

  useEffect(() => {
    const savedId = sessionStorage.getItem('studentId');
    if (savedId) {
      setStudentId(savedId);
      if (savedId.includes('@')) {
        setLeaderEmail(savedId);
      } else {
        setLeaderId(savedId);
      }
    }
    const savedType = sessionStorage.getItem('projectType');
    if (savedType) {
      setProjectType(savedType);
    }
  }, []);

  const addMember = () => {
    setMembers([...members, { name: '', email: '', idNo: '', phone: '' }]);
  };

  const removeMember = (index) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    } else {
      alert("At least one team member is required.");
    }
  };

  const updateMember = (index, field, value) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLeaderComplete) {
      alert("Please complete all compulsory Team Leader details first.");
      return;
    }

    // Save to Supabase DB
    try {
      const { data: teamRes, error: teamErr } = await supabase
        .from('teams')
        .insert([{
          team_name: teamName,
          leader_name: leaderName,
          leader_email: leaderEmail,
          leader_id: leaderId,
          leader_phone: leaderPhone,
          project_title: projectTitle || 'New Project Entry',
          project_type: projectType,
          main_idea: projectIdea || 'Project Idea Details',
          tech_stack: techStack || 'HTML, CSS, JS'
        }])
        .select()
        .single();

      if (!teamErr && teamRes) {
        const validMembers = members.filter(m => m.name.trim());
        if (validMembers.length > 0) {
          const memberRecords = validMembers.map(m => ({
            team_id: teamRes.id,
            member_name: m.name,
            member_email: m.email,
            member_id: m.idNo,
            member_phone: m.phone
          }));
          await supabase.from('team_members').insert(memberRecords);
        }
      }
    } catch (err) {
      console.warn("Supabase team submission error:", err);
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

      <div className="submission-container">
        <div className="nav-header" style={{ justifyContent: 'flex-end', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div className="student-hud-badge">
            <span className="ghost blinky" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> LOGGED IN: <span id="logged-student-id">{studentId || 'STU2026101'}</span>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            🚪 LOG OUT
          </button>
        </div>

        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge">STAGE 1: PROJECT SUBMISSION</span>
            <span className={`lock-badge ${isLeaderComplete ? 'unlocked' : 'locked'}`}>
              {isLeaderComplete ? '🔓 UNLOCKED' : '🔒 ENTER LEADER DETAILS FIRST'}
            </span>
          </div>
          <h2>HACKATHON ENTRY FORM</h2>
          <p>Register your team leader, add team members, and outline your project details.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* SECTION 1: TEAM LEADER DETAILS */}
          <div className="form-section">
            <h3 className="section-title"><span className="pacman-bullet"></span> 1. TEAM LEADER DETAILS (COMPULSORY)</h3>
            <div className="leader-grid">
              <div className="form-group span-2">
                <label htmlFor="team-name">Team Name</label>
                <input
                  type="text"
                  id="team-name"
                  placeholder="e.g., Cyber Byte Squad"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="leader-name">Leader Full Name</label>
                <input
                  type="text"
                  id="leader-name"
                  placeholder="Alex Johnson"
                  required
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="leader-email">Leader Email ID</label>
                <input
                  type="email"
                  id="leader-email"
                  placeholder="alex@cyber.edu"
                  required
                  value={leaderEmail}
                  onChange={(e) => setLeaderEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="leader-id">Enrollment No. / ID</label>
                <input
                  type="text"
                  id="leader-id"
                  placeholder="EN2026101"
                  required
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="leader-phone">Phone Number</label>
                <input
                  type="tel"
                  id="leader-phone"
                  placeholder="+91 9876543210"
                  required
                  value={leaderPhone}
                  onChange={(e) => setLeaderPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: TEAM MEMBERS */}
          <div className={`form-section locked-until-leader ${!isLeaderComplete ? 'section-disabled' : ''}`}>
            <h3 className="section-title"><span className="pacman-bullet"></span> 2. OTHER TEAM MEMBERS DETAILS</h3>

            <div>
              {members.map((member, index) => (
                <div key={index} className="member-row">
                  <input
                    type="text"
                    placeholder="Member Name"
                    required
                    disabled={!isLeaderComplete}
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="Email ID"
                    required
                    disabled={!isLeaderComplete}
                    value={member.email}
                    onChange={(e) => updateMember(index, 'email', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Enrollment No. / ID Number"
                    required
                    disabled={!isLeaderComplete}
                    value={member.idNo}
                    onChange={(e) => updateMember(index, 'idNo', e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    required
                    disabled={!isLeaderComplete}
                    value={member.phone}
                    onChange={(e) => updateMember(index, 'phone', e.target.value)}
                  />
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeMember(index)}
                    disabled={!isLeaderComplete}
                    title="Remove Member"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="add-member-btn"
              onClick={addMember}
              disabled={!isLeaderComplete}
            >
              ➕ ADD ANOTHER TEAM MEMBER
            </button>
          </div>

          {/* SECTION 3: PROJECT DETAILS */}
          <div className={`form-section locked-until-leader ${!isLeaderComplete ? 'section-disabled' : ''}`}>
            <h3 className="section-title"><span className="pacman-bullet"></span> 3. PROJECT & SOLUTION DETAILS</h3>

            <div className="form-group">
              <label htmlFor="project-title">Project Title</label>
              <input
                type="text"
                id="project-title"
                placeholder="e.g., AI-Powered Autonomous Telemetry Monitor"
                required
                disabled={!isLeaderComplete}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="project-type">Project Type</label>
              <select
                id="project-type"
                required
                disabled={!isLeaderComplete}
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
              >
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="project-idea">Main Project Idea & Problem Statement</label>
              <textarea
                id="project-idea"
                rows="4"
                placeholder="Describe your innovation, core problem solved, unique value proposition..."
                required
                disabled={!isLeaderComplete}
                value={projectIdea}
                onChange={(e) => setProjectIdea(e.target.value)}
              ></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="tech-stack">Tech Stack & Tools Used</label>
              <input
                type="text"
                id="tech-stack"
                placeholder="e.g., React Native, Python, TensorFlow, Raspberry Pi, Docker"
                required
                disabled={!isLeaderComplete}
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="submit-btn full-width-btn locked-until-leader"
            disabled={!isLeaderComplete}
          >
            <span className="pacman-icon"></span> SUBMIT FINAL PROJECT ENTRY
          </button>
        </form>

        <div className="arcade-footer">
          <span>PROJECT ENTRY FORM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>

      {/* Victory Modal */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="modal-card">
            <div className="modal-ghost-row">
              <div className="ghost blinky"></div>
              <div className="ghost pinky"></div>
              <div className="ghost inky"></div>
              <div className="ghost clyde"></div>
            </div>
            <h2 className="victory-title">PROJECT SUBMITTED!</h2>
            <p className="victory-subtitle">ENTRY RECORDED SUCCESSFULLY IN DATABASE</p>
            <div className="score-box">
              <span>TEAM STATUS: <span className="hud-yellow">READY FOR JUDGING</span></span>
            </div>
            <button
              type="button"
              className="submit-btn full-width-btn"
              onClick={() => setShowModal(false)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
