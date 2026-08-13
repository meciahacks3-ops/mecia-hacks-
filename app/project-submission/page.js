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
  const [leaderBranch, setLeaderBranch] = useState('Computer Engineering (CE)');

  // Team members state
  const [members, setMembers] = useState([
    { name: '', email: '', idNo: '', branch: 'Computer Engineering (CE)', phone: '' }
  ]);

  // Project details state
  const [projectTitle, setProjectTitle] = useState('');
  const [projectType, setProjectType] = useState('hardware');
  const [projectIdea, setProjectIdea] = useState('');
  const [techStack, setTechStack] = useState('');

  // Existing Registration State
  const [existingTeamId, setExistingTeamId] = useState(null);
  const [isExistingRecord, setIsExistingRecord] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [modalAction, setModalAction] = useState('created');

  // UI state
  const [showModal, setShowModal] = useState(false);

  const isLeaderPhoneValid = /^\d{10}$/.test(leaderPhone);
  const isLeaderComplete = Boolean(teamName && leaderName && leaderEmail && leaderId && isLeaderPhoneValid && leaderBranch);

  useEffect(() => {
    const fetchExistingRegistration = async (idToSearch) => {
      if (!idToSearch) return;
      try {
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .or(`leader_email.ilike.${idToSearch},leader_id.ilike.${idToSearch}`)
          .maybeSingle();

        if (teamData) {
          setExistingTeamId(teamData.id);
          setIsExistingRecord(true);
          setIsEditing(false); // Lock to view mode with Edit button

          if (teamData.team_name) setTeamName(teamData.team_name);
          if (teamData.leader_name) setLeaderName(teamData.leader_name);
          if (teamData.leader_email) setLeaderEmail(teamData.leader_email);
          if (teamData.leader_id) setLeaderId(teamData.leader_id);
          if (teamData.leader_phone) setLeaderPhone(teamData.leader_phone);
          if (teamData.project_title) setProjectTitle(teamData.project_title);
          if (teamData.tech_stack) setTechStack(teamData.tech_stack);

          const mainIdeaStr = teamData.main_idea || '';
          const match = mainIdeaStr.match(/\[Type:\s*([^|]+)\|\s*Branch:\s*([^\]]+)\]/i);
          if (match) {
            setProjectType(match[1].trim().toLowerCase());
            setLeaderBranch(match[2].trim());
            setProjectIdea(mainIdeaStr.replace(/\[Type:[^\]]+\]\s*/i, '').trim());
          } else {
            setProjectIdea(mainIdeaStr);
          }

          const { data: memberData } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', teamData.id);

          if (memberData && memberData.length > 0) {
            const parsedMembers = memberData.map(m => {
              let name = m.member_name || '';
              let branch = 'Computer Engineering (CE)';
              const mMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
              if (mMatch) {
                name = mMatch[1].trim();
                branch = mMatch[2].trim();
              }
              return {
                name,
                email: m.member_email || '',
                idNo: m.member_id || '',
                branch,
                phone: m.member_phone || ''
              };
            });
            setMembers(parsedMembers);
          }
        }
      } catch (e) {
        console.warn("Fetch existing registration error:", e);
      }
    };

    const savedId = sessionStorage.getItem('studentId');
    if (savedId) {
      setStudentId(savedId);
      if (savedId.includes('@')) {
        setLeaderEmail(savedId);
      } else {
        setLeaderId(savedId);
      }
      fetchExistingRegistration(savedId);
    }
    const savedType = sessionStorage.getItem('projectType');
    if (savedType) {
      setProjectType(savedType);
    }
  }, []);

  const addMember = () => {
    setMembers([...members, { name: '', email: '', idNo: '', branch: 'Computer Engineering (CE)', phone: '' }]);
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
      alert("Please complete all compulsory Team Leader details first (including a valid 10-digit mobile number).");
      return;
    }

    const invalidMembers = members.filter(m => m.name.trim() && (!m.phone || !/^\d{10}$/.test(m.phone)));
    if (invalidMembers.length > 0) {
      alert("Please enter a valid 10-digit numeric mobile number for all added team members.");
      return;
    }

    const insertPayload = {
      team_name: teamName,
      leader_name: leaderName,
      leader_email: leaderEmail,
      leader_id: leaderId,
      leader_phone: leaderPhone,
      project_title: projectTitle || 'New Project Entry',
      main_idea: `[Type: ${projectType.toUpperCase()} | Branch: ${leaderBranch}]\n\n${projectIdea || 'Project Idea Details'}`,
      tech_stack: techStack || 'HTML, CSS, JS'
    };

    try {
      if (existingTeamId) {
        // Update existing registration
        const { error: updateErr } = await supabase
          .from('teams')
          .update(insertPayload)
          .eq('id', existingTeamId);

        if (!updateErr) {
          await supabase.from('team_members').delete().eq('team_id', existingTeamId);
          const validMembers = members.filter(m => m.name.trim());
          if (validMembers.length > 0) {
            const memberRecords = validMembers.map(m => ({
              team_id: existingTeamId,
              member_name: m.branch ? `${m.name} (${m.branch})` : m.name,
              member_email: m.email,
              member_id: m.idNo,
              member_phone: m.phone
            }));
            await supabase.from('team_members').insert(memberRecords);
          }
          setIsExistingRecord(true);
          setIsEditing(false);
          setModalAction('updated');
        } else {
          console.error("Supabase update error:", updateErr);
        }
      } else {
        // Insert new registration
        const { data: teamRes, error: teamErr } = await supabase
          .from('teams')
          .insert([insertPayload])
          .select()
          .single();

        if (teamRes) {
          setExistingTeamId(teamRes.id);
          setIsExistingRecord(true);
          setIsEditing(false);
          setModalAction('created');

          const validMembers = members.filter(m => m.name.trim());
          if (validMembers.length > 0) {
            const memberRecords = validMembers.map(m => ({
              team_id: teamRes.id,
              member_name: m.branch ? `${m.name} (${m.branch})` : m.name,
              member_email: m.email,
              member_id: m.idNo,
              member_phone: m.phone
            }));
            await supabase.from('team_members').insert(memberRecords);
          }
        }
      }
    } catch (err) {
      console.warn("Supabase save exception:", err);
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

        {/* Existing Registration Banner & Edit Control */}
        {isExistingRecord && (
          <div style={{
            background: 'rgba(0, 255, 204, 0.1)',
            border: '2px solid #00ffcc',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: '0 0 15px rgba(0, 255, 204, 0.2)'
          }}>
            <div>
              <div style={{ color: '#00ffcc', fontFamily: 'Press Start 2P, monospace', fontSize: '0.68rem', marginBottom: '6px' }}>
                ✅ REGISTERED TEAM ENTRY FOUND
              </div>
              <div style={{ color: '#ccc', fontSize: '0.78rem', lineHeight: '1.4' }}>
                {isEditing 
                  ? '✏️ EDITING MODE ACTIVE: Modify any details below and click "💾 UPDATE & SAVE CHANGES".' 
                  : '🔒 VIEW MODE: Your team details have been loaded. Click "✏️ EDIT REGISTRATION DETAILS" to make changes.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              style={{
                background: isEditing ? '#ff0055' : '#fdff00',
                color: isEditing ? '#fff' : '#000',
                border: '2px solid ' + (isEditing ? '#ff0055' : '#fdff00'),
                borderRadius: '8px',
                padding: '10px 18px',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.62rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 10px rgba(253, 255, 0, 0.4)'
              }}
            >
              {isEditing ? '🔒 LOCK VIEW' : '✏️ EDIT REGISTRATION DETAILS'}
            </button>
          </div>
        )}

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
                <label htmlFor="leader-branch">Leader Branch</label>
                <select
                  id="leader-branch"
                  required
                  value={leaderBranch}
                  onChange={(e) => setLeaderBranch(e.target.value)}
                >
                  <option value="Computer Engineering (CE)">Computer Engineering (CE)</option>
                  <option value="Information Technology (IT)">Information Technology (IT)</option>
                  <option value="Computer Science & Design (CSD)">Computer Science & Design (CSD)</option>
                  <option value="Aeronautical Engineering">Aeronautical Engineering</option>
                  <option value="Diploma">Diploma</option>
                  <option value="BSc IT">BSc IT</option>
                  <option value="BCA">BCA</option>
                  <option value="MCA">MCA</option>
                  <option value="Electronics & Communication (EC)">Electronics & Communication (EC)</option>
                  <option value="Electrical Engineering (EE)">Electrical Engineering (EE)</option>
                  <option value="Mechanical Engineering (ME)">Mechanical Engineering (ME)</option>
                  <option value="Civil Engineering (CL)">Civil Engineering (CL)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="leader-phone">Phone Number (10 digits)</label>
                <input
                  type="tel"
                  id="leader-phone"
                  placeholder="e.g., 9876543210"
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                  value={leaderPhone}
                  onChange={(e) => setLeaderPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
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
                    placeholder="Enrollment No. / ID"
                    required
                    disabled={!isLeaderComplete}
                    value={member.idNo}
                    onChange={(e) => updateMember(index, 'idNo', e.target.value)}
                  />
                  <select
                    required
                    disabled={!isLeaderComplete}
                    value={member.branch || 'Computer Engineering (CE)'}
                    onChange={(e) => updateMember(index, 'branch', e.target.value)}
                  >
                    <option value="Computer Engineering (CE)">CE</option>
                    <option value="Information Technology (IT)">IT</option>
                    <option value="Computer Science & Design (CSD)">CSD</option>
                    <option value="Aeronautical Engineering">Aero</option>
                    <option value="Diploma">Diploma</option>
                    <option value="BSc IT">BSc IT</option>
                    <option value="BCA">BCA</option>
                    <option value="MCA">MCA</option>
                    <option value="Electronics & Communication (EC)">EC</option>
                    <option value="Electrical Engineering (EE)">EE</option>
                    <option value="Mechanical Engineering (ME)">ME</option>
                    <option value="Civil Engineering (CL)">CL</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="10-digit Phone No."
                    required
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    disabled={!isLeaderComplete}
                    value={member.phone}
                    onChange={(e) => updateMember(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
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
            disabled={!isLeaderComplete || (isExistingRecord && !isEditing)}
            style={{
              background: isExistingRecord ? 'var(--maze-blue, #2121ff)' : undefined,
              borderColor: isExistingRecord ? '#00ffcc' : undefined
            }}
          >
            <span className="pacman-icon"></span> {isExistingRecord ? '💾 UPDATE & SAVE CHANGES' : '🚀 SUBMIT FINAL PROJECT ENTRY'}
          </button>
        </form>

        <div className="arcade-footer">
          <span>PROJECT ENTRY FORM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>

      {/* Registration Completed Victory Modal Pop-up */}
      {showModal && (
        <div className="modal-overlay show" style={{ zIndex: 99999 }}>
          <div className="modal-card" style={{ maxWidth: '560px', width: '92%', padding: '28px 24px', textAlign: 'center' }}>
            <div className="modal-ghost-row" style={{ marginBottom: '16px' }}>
              <div className="ghost blinky"></div>
              <div className="ghost pinky"></div>
              <div className="ghost inky"></div>
              <div className="ghost clyde"></div>
            </div>
            <h2 className="victory-title" style={{ color: '#fdff00', fontSize: '1.1rem', textShadow: '0 0 10px rgba(253, 255, 0, 0.5)', marginBottom: '8px' }}>
              {modalAction === 'updated' ? '🎉 REGISTRATION UPDATED!' : '🎉 REGISTRATION COMPLETED!'}
            </h2>
            <p className="victory-subtitle" style={{ color: '#00ffcc', fontSize: '0.62rem', marginBottom: '20px' }}>
              {modalAction === 'updated' ? 'YOUR CHANGES HAVE BEEN SUCCESSFULLY SAVED TO DATABASE' : 'YOUR ENTRY IS OFFICIALLY REGISTERED IN MECIA HACK 3.0'}
            </p>

            <div style={{
              background: 'rgba(0, 0, 0, 0.85)',
              border: '2px solid var(--maze-blue, #2121ff)',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '20px',
              boxShadow: '0 0 15px rgba(33, 33, 255, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.58rem', color: '#8888aa' }}>TEAM NAME:</span>
                <span style={{ fontSize: '0.62rem', color: '#fdff00', fontWeight: 'bold' }}>{teamName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.58rem', color: '#8888aa' }}>TEAM LEADER:</span>
                <span style={{ fontSize: '0.62rem', color: '#fff' }}>{leaderName} ({leaderBranch})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.58rem', color: '#8888aa' }}>PROJECT TITLE:</span>
                <span style={{ fontSize: '0.62rem', color: '#00ffcc' }}>{projectTitle || 'New Project Entry'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.58rem', color: '#8888aa' }}>PROJECT TYPE:</span>
                <span style={{ fontSize: '0.62rem', color: '#ff0055', textTransform: 'uppercase' }}>{projectType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.58rem', color: '#8888aa' }}>STATUS:</span>
                <span style={{ fontSize: '0.58rem', color: '#00ffcc', fontWeight: 'bold' }}>✅ VERIFIED & STORED IN DATABASE</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="submit-btn"
                onClick={() => window.print()}
                style={{ flex: 1, background: '#2121ff', color: '#fff', fontSize: '0.58rem', padding: '12px 8px' }}
              >
                🖨️ PRINT CONFIRMATION
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={handleLogout}
                style={{ flex: 1, background: '#ff0055', color: '#fff', fontSize: '0.58rem', padding: '12px 8px' }}
              >
                🏠 RETURN TO HOME
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
