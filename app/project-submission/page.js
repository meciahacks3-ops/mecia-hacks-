'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { findRegisteredTeam } from '@/lib/teamUtils';
import { getJudgeProfile } from '@/lib/judgeProfiles';
import { parseTimeSlotFromTeam, getTimeSlotInfo } from '@/lib/timeSlotUtils';

export default function ProjectSubmissionPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Judge assignment, time slot & venue state
  const [assignedJudge, setAssignedJudge] = useState('');
  const [timeSlot, setTimeSlot] = useState('TBA');

  // Team leader state
  const [teamName, setTeamName] = useState('');
  const [teamIdNo, setTeamIdNo] = useState('');
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
  const [isEditing, setIsEditing] = useState(false);
  const [modalAction, setModalAction] = useState('updated');

  // UI state
  const [showModal, setShowModal] = useState(false);

  const isLeaderPhoneValid = /^\d{10}$/.test(leaderPhone ? leaderPhone.trim() : '');
  const isTeamIdValid = Boolean(teamIdNo && teamIdNo.trim().length > 0 && teamIdNo.trim().toUpperCase() !== 'N/A');
  const isLeaderComplete = Boolean(
    teamName && teamName.trim() &&
    isTeamIdValid &&
    leaderName && leaderName.trim() &&
    leaderEmail && leaderEmail.trim() &&
    leaderId && leaderId.trim() &&
    isLeaderPhoneValid &&
    leaderBranch
  );

  useEffect(() => {
    let pollTimer;

    const fetchExistingRegistration = async (idToSearch) => {
      if (!idToSearch) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const teamData = await findRegisteredTeam(supabase, idToSearch);

        if (teamData) {
          setExistingTeamId(teamData.id);
          setIsExistingRecord(true);
          setIsEditing(false); // Default to locked view mode on load for existing registered teams

          const parsedSlot = parseTimeSlotFromTeam(teamData);
          setTimeSlot(parsedSlot);

          if (teamData.assigned_judge) {
            setAssignedJudge(teamData.assigned_judge);
          } else {
            setAssignedJudge('');
          }

          if (teamData.team_name) setTeamName(teamData.team_name);
          if (teamData.leader_name) setLeaderName(teamData.leader_name);
          if (teamData.leader_email) setLeaderEmail(teamData.leader_email);
          if (teamData.leader_id) setLeaderId(teamData.leader_id);
          if (teamData.leader_phone) setLeaderPhone(teamData.leader_phone);
          if (teamData.project_title) setProjectTitle(teamData.project_title);
          if (teamData.tech_stack) setTechStack(teamData.tech_stack);

          let foundTeamId = '';
          if (teamData.team_id_no && teamData.team_id_no.trim() !== 'N/A') {
            foundTeamId = teamData.team_id_no.trim();
            setTeamIdNo(foundTeamId);
          }

          const mainIdeaStr = teamData.main_idea || '';
          const match = mainIdeaStr.match(/\[Type:\s*([^|]+)\|\s*Branch:\s*([^|\]]+)(?:\|\s*Team ID:\s*([^\]]+))?/i);
          if (match) {
            setProjectType(match[1].trim().toLowerCase());
            setLeaderBranch(match[2].trim());
            if (!foundTeamId && match[3] && match[3].trim() !== 'N/A') {
              foundTeamId = match[3].trim();
              setTeamIdNo(foundTeamId);
            }
            setProjectIdea(mainIdeaStr.replace(/\[[^\]]+\]\s*/g, '').trim());
          } else {
            setProjectIdea(mainIdeaStr.replace(/\[[^\]]+\]\s*/g, '').trim());
          }

          // Fallback regex to parse Team ID if formatted differently
          if (!foundTeamId) {
            const idMatch = mainIdeaStr.match(/Team ID:\s*([^\]\n|]+)/i);
            if (idMatch && idMatch[1] && idMatch[1].trim() !== 'N/A') {
              foundTeamId = idMatch[1].trim();
              setTeamIdNo(foundTeamId);
            }
          }

          const memberData = teamData.team_members || [];

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
            setMembers(parsedMembers.slice(0, 3));
          }
        } else {
          // New student registration mode - NOW CLOSED
          setExistingTeamId(null);
          setIsExistingRecord(false);
          setIsEditing(false);
        }
      } catch (e) {
        console.warn("Fetch existing registration error:", e);
        setExistingTeamId(null);
        setIsExistingRecord(false);
        setIsEditing(false);
      } finally {
        setIsLoading(false);
      }
    };

    const initUser = async () => {
      let savedId = sessionStorage.getItem('studentId');
      if (!savedId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            savedId = session.user.email;
            sessionStorage.setItem('studentId', savedId);
            sessionStorage.setItem('targetRole', 'student');
          }
        } catch (e) {
          console.warn("Session check error:", e);
        }
      }

      if (savedId) {
        setStudentId(savedId);
        if (savedId.includes('@')) {
          setLeaderEmail(savedId);
        } else {
          setLeaderId(savedId);
        }
        await fetchExistingRegistration(savedId);

        // Auto-poll every 4s to sync newly assigned judge panel and lab locations live
        pollTimer = setInterval(() => {
          findRegisteredTeam(supabase, savedId).then(tData => {
            if (tData) {
              setAssignedJudge(tData.assigned_judge || '');
            }
          }).catch(err => console.warn("Live allocation poll notice:", err));
        }, 4000);
      } else {
        setIsLoading(false);
        router.push('/');
      }
    };

    initUser();

    const savedType = sessionStorage.getItem('projectType');
    if (savedType) {
      setProjectType(savedType);
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [router]);

  const addMember = () => {
    if (members.length >= 3) {
      alert("⚠️ Maximum Limit Reached: You can add up to 3 team members only.");
      return;
    }
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

    // Strict validation: New team registrations are closed
    if (!existingTeamId) {
      alert("⛔ REGISTRATION CLOSED: New team registrations for Mecia Hack 3.0 are officially closed. No new teams can be registered.");
      return;
    }

    // 1. Strictly enforce compulsory Team ID for all student portal users
    if (!teamIdNo || !teamIdNo.trim() || teamIdNo.trim().toUpperCase() === 'N/A') {
      alert("⚠️ Team ID Number is compulsory for all users in the Student Portal! Please enter your official Team ID before submitting.");
      return;
    }

    if (!teamName || !teamName.trim()) {
      alert("⚠️ Team Name is compulsory! Please enter your Team Name before submitting.");
      return;
    }

    if (!leaderName || !leaderName.trim() || !leaderEmail || !leaderEmail.trim() || !leaderId || !leaderId.trim()) {
      alert("⚠️ Please fill in all compulsory Team Leader details before submitting.");
      return;
    }

    if (!isLeaderPhoneValid) {
      alert("⚠️ Please enter a valid 10-digit numeric mobile number for the Team Leader.");
      return;
    }

    if (!isLeaderComplete) {
      alert("Please complete all compulsory Team Details first (including Team ID Number, Team Name, and a valid 10-digit mobile number).");
      return;
    }

    const invalidMembers = members.filter(m => m.name.trim() && (!m.phone || !/^\d{10}$/.test(m.phone.trim())));
    if (invalidMembers.length > 0) {
      alert("Please enter a valid 10-digit numeric mobile number for all added team members.");
      return;
    }

    const validMembers = members.filter(m => m.name.trim());
    if (validMembers.length > 3) {
      alert("⚠️ A maximum of 3 team members are allowed. Please remove extra members before submitting.");
      return;
    }

    const slotTag = timeSlot && timeSlot !== 'TBA' ? ` | Slot: ${timeSlot}` : '';
    const insertPayload = {
      team_name: teamName.trim(),
      team_id_no: teamIdNo.trim(),
      leader_name: leaderName.trim(),
      leader_email: leaderEmail.trim(),
      leader_id: leaderId.trim(),
      leader_phone: leaderPhone.trim(),
      project_title: projectTitle.trim() || 'New Project Entry',
      main_idea: `[Type: ${projectType.toUpperCase()} | Branch: ${leaderBranch} | Team ID: ${teamIdNo.trim()}${slotTag}]\n\n${projectIdea.trim() || 'Project Idea Details'}`,
      tech_stack: techStack.trim() || 'HTML, CSS, JS'
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
          const membersToInsert = validMembers.slice(0, 3);
          if (membersToInsert.length > 0) {
            const memberRecords = membersToInsert.map(m => ({
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
          setShowModal(true);
        } else {
          console.error("Supabase update error:", updateErr);
          alert("Database Update Notice: " + updateErr.message);
        }
      } else {
        // Insert new registration
        const { data: teamRes, error: teamErr } = await supabase
          .from('teams')
          .insert([insertPayload])
          .select()
          .single();

        if (teamErr) {
          console.error("Supabase insert error:", teamErr);
          alert("Registration Error: " + teamErr.message);
          return;
        }

        if (teamRes) {
          setExistingTeamId(teamRes.id);
          setIsExistingRecord(true);
          setIsEditing(false);
          setModalAction('created');

          const membersToInsert = validMembers.slice(0, 3);
          if (membersToInsert.length > 0) {
            const memberRecords = membersToInsert.map(m => ({
              team_id: teamRes.id,
              member_name: m.branch ? `${m.name} (${m.branch})` : m.name,
              member_email: m.email,
              member_id: m.idNo,
              member_phone: m.phone
            }));
            await supabase.from('team_members').insert(memberRecords);
          }
          setShowModal(true);
        }
      }
    } catch (err) {
      console.warn("Supabase save exception:", err);
      alert("Error saving registration. Please try again.");
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

  const judgeProfile = getJudgeProfile(assignedJudge);

  return (
    <>
      <div className="scanlines"></div>

      <div className="submission-container">
        <div className="nav-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="student-hud-badge">
              <span className="ghost blinky" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> LOGGED IN: <span id="logged-student-id">{studentId || 'STUDENT'}</span>
            </div>
            {assignedJudge && assignedJudge !== 'Unassigned' && (
              <div style={{
                background: 'rgba(0, 255, 204, 0.15)',
                border: '1.5px solid #00ffcc',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#00ffcc',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: '0.62rem',
                boxShadow: '0 0 10px rgba(0, 255, 204, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>🏛️ {assignedJudge.toUpperCase()}</span>
                <span>•</span>
                <span style={{ color: '#fdff00' }}>📍 {judgeProfile?.location || 'Assigned Lab'}</span>
              </div>
            )}
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            🚪 LOG OUT
          </button>
        </div>

        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge" style={{ borderColor: !isExistingRecord ? '#ff0055' : undefined, color: !isExistingRecord ? '#ff0055' : undefined }}>
              {isExistingRecord ? 'STAGE 1: REGISTERED TEAM PORTAL' : 'STAGE 1: REGISTRATION CLOSED'}
            </span>
            <span
              className={`lock-badge ${isExistingRecord ? 'confirmed' : 'locked'}`}
              style={{
                borderColor: isExistingRecord ? '#00ffcc' : '#ff0055',
                color: isExistingRecord ? '#00ffcc' : '#ff0055'
              }}
            >
              {isExistingRecord
                ? '✅ REGISTRATION CONFIRMED • VIEW MODE'
                : '⛔ REGISTRATIONS CLOSED'}
            </span>
          </div>
          <h2>{isExistingRecord ? 'HACKATHON TEAM DETAILS' : 'REGISTRATION WINDOW CLOSED'}</h2>
          <p>
            {isExistingRecord
              ? 'Review your confirmed team details, allocated Judge Panel, presentation lab venue, and scheduled time slot.'
              : 'New team registrations for Mecia Hack 3.0 (Round 2) are now officially closed.'}
          </p>
        </div>

        {/* 1. Loading State */}
        {isLoading && (
          <div style={{
            background: 'rgba(13, 14, 27, 0.95)',
            border: '2px solid var(--maze-blue, #2121ff)',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            color: '#00ffcc',
            fontFamily: 'Press Start 2P, monospace',
            fontSize: '0.75rem',
            lineHeight: '2',
            boxShadow: '0 0 25px rgba(33, 33, 255, 0.3)',
            maxWidth: '650px',
            margin: '32px auto'
          }}>
            <div className="ghost blinky" style={{ width: '28px', height: '28px', margin: '0 auto 20px' }}></div>
            🕹️ LOADING TEAM DETAILS...
          </div>
        )}

        {/* 2. Existing Registration Banner & Edit Control */}
        {!isLoading && isExistingRecord && (
          <div style={{
            background: !isTeamIdValid ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 255, 204, 0.1)',
            border: `2px solid ${!isTeamIdValid ? '#ff0055' : '#00ffcc'}`,
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: `0 0 15px ${!isTeamIdValid ? 'rgba(255, 0, 85, 0.3)' : 'rgba(0, 255, 204, 0.2)'}`
          }}>
            <div>
              <div style={{ color: !isTeamIdValid ? '#ff0055' : '#00ffcc', fontFamily: 'Press Start 2P, monospace', fontSize: '0.68rem', marginBottom: '6px' }}>
                {!isTeamIdValid ? '⚠️ ACTION REQUIRED: COMPULSORY TEAM ID MISSING' : '✅ REGISTERED TEAM ENTRY CONFIRMED'}
              </div>
              <div style={{ color: '#ccc', fontSize: '0.78rem', lineHeight: '1.4' }}>
                {!isTeamIdValid
                  ? 'Your previously submitted registration is missing an official Team ID. Please enter your Team ID Number below and click "💾 UPDATE & SAVE CHANGES".'
                  : isEditing 
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

        {/* 4. Registered Team Summary Dashboard View */}
        {!isLoading && isExistingRecord && !isEditing && (
          <div className="registered-summary-card" style={{
            background: 'rgba(13, 14, 27, 0.95)',
            border: '2px solid var(--maze-blue, #2121ff)',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 0 25px rgba(33, 33, 255, 0.3)',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '2px dashed rgba(33, 33, 255, 0.5)', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <span className="role-badge" style={{ background: '#00ffcc', color: '#000', marginBottom: '8px', display: 'inline-block' }}>✅ REGISTRATION CONFIRMED</span>
                <h2 style={{ color: '#fdff00', fontSize: '1.4rem', margin: '4px 0', fontFamily: 'Press Start 2P, monospace', textShadow: '0 0 10px rgba(253, 255, 0, 0.5)' }}>{teamName}</h2>
                <p style={{ color: '#aaa', fontSize: '0.82rem', margin: 0 }}>Registered Project Entry • Mecia Hack 3.0</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{
                    background: '#fdff00',
                    color: '#000',
                    border: '2px solid #fdff00',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                    boxShadow: '0 0 10px rgba(253, 255, 0, 0.4)'
                  }}
                >
                  ✏️ EDIT REGISTRATION DETAILS
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#2121ff',
                    color: '#fff',
                    border: '2px solid #2121ff',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.62rem',
                    cursor: 'pointer'
                  }}
                >
                  🖨️ PRINT
                </button>
              </div>
            </div>

            {/* ROUND 2: ALLOCATED JUDGE PANEL & LAB VENUE LOCATION */}
            <div style={{
              background: assignedJudge && assignedJudge !== 'Unassigned'
                ? 'linear-gradient(135deg, rgba(0, 255, 204, 0.1) 0%, rgba(33, 33, 255, 0.15) 100%)'
                : 'rgba(255, 184, 82, 0.08)',
              border: assignedJudge && assignedJudge !== 'Unassigned'
                ? '2px solid var(--neon-cyan, #00ffcc)'
                : '2px dashed var(--clyde-orange, #ffb852)',
              boxShadow: assignedJudge && assignedJudge !== 'Unassigned'
                ? '0 0 20px rgba(0, 255, 204, 0.25)'
                : '0 0 12px rgba(255, 184, 82, 0.15)',
              borderRadius: '14px',
              padding: '24px 20px',
              marginBottom: '28px',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="ghost cyan-ghost" style={{ width: '16px', height: '16px', display: 'inline-block' }}></span>
                  <h3 style={{
                    color: assignedJudge && assignedJudge !== 'Unassigned' ? '#00ffcc' : '#ffb852',
                    fontSize: '0.88rem',
                    fontFamily: 'Press Start 2P, monospace',
                    margin: 0,
                    letterSpacing: '0.5px'
                  }}>
                    🏛️ ROUND 2: EVALUATION PANEL & LAB ALLOCATION
                  </h3>
                </div>
                <span style={{
                  background: assignedJudge && assignedJudge !== 'Unassigned' ? '#00ffcc' : '#ffb852',
                  color: '#000',
                  fontFamily: 'Press Start 2P, monospace',
                  fontSize: '0.62rem',
                  fontWeight: 'bold',
                  padding: '5px 10px',
                  borderRadius: '4px'
                }}>
                  {assignedJudge && assignedJudge !== 'Unassigned' ? '✅ VENUE ALLOCATED' : '⏳ PENDING ALLOCATION'}
                </span>
              </div>

              {assignedJudge && assignedJudge !== 'Unassigned' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    {/* Card 1: Assigned Judge Panel Number */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: '1.5px solid rgba(0, 255, 204, 0.4)',
                      borderRadius: '10px',
                      padding: '20px 18px',
                      boxShadow: '0 0 12px rgba(0, 255, 204, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '0.62rem', color: '#8888aa', fontFamily: 'Press Start 2P, monospace', marginBottom: '10px' }}>
                        ALLOCATED JUDGE PANEL
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: 'rgba(253, 255, 0, 0.15)',
                          color: '#fdff00',
                          border: '2px solid #fdff00',
                          borderRadius: '6px',
                          padding: '8px 16px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '1.15rem',
                          fontWeight: 'bold',
                          boxShadow: '0 0 12px rgba(253, 255, 0, 0.4)'
                        }}>
                          {assignedJudge.toUpperCase()}
                        </span>
                        {judgeProfile?.group && (
                          <span style={{ color: '#00ffcc', fontSize: '0.95rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>
                            {judgeProfile.group}
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#aaa', fontSize: '0.74rem', marginTop: '10px' }}>
                        Official evaluation jury assigned for Round 2.
                      </div>
                    </div>

                    {/* Card 2: Lab Venue Location */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: '1.5px solid rgba(253, 255, 0, 0.4)',
                      borderRadius: '10px',
                      padding: '20px 18px',
                      boxShadow: '0 0 12px rgba(253, 255, 0, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '0.62rem', color: '#8888aa', fontFamily: 'Press Start 2P, monospace', marginBottom: '10px' }}>
                        📍 PRESENTATION & EVALUATION VENUE
                      </div>
                      <div style={{
                        background: 'rgba(253, 255, 0, 0.12)',
                        border: '2px solid #fdff00',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 0 12px rgba(253, 255, 0, 0.2)'
                      }}>
                        <span style={{ fontSize: '1.8rem' }}>📍</span>
                        <div>
                          <div style={{ color: '#fdff00', fontFamily: 'Press Start 2P, monospace', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {judgeProfile?.location || 'Computer Engineering Dept.'}
                          </div>
                        </div>
                      </div>
                      <div style={{ color: '#bbb', fontSize: '0.74rem', marginTop: '10px' }}>
                        Report directly to this lab room with your team when called.
                      </div>
                    </div>

                    {/* Card 3: Presentation Time Slot */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: `1.5px solid ${getTimeSlotInfo(timeSlot).badgeBorder}`,
                      borderRadius: '10px',
                      padding: '20px 18px',
                      boxShadow: `0 0 12px ${getTimeSlotInfo(timeSlot).badgeBg}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: '0.62rem', color: '#8888aa', fontFamily: 'Press Start 2P, monospace', marginBottom: '10px' }}>
                        ⏰ PRESENTATION TIME SLOT
                      </div>
                      <div style={{
                        background: getTimeSlotInfo(timeSlot).badgeBg,
                        border: `2px solid ${getTimeSlotInfo(timeSlot).badgeBorder}`,
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: `0 0 12px ${getTimeSlotInfo(timeSlot).badgeBg}`
                      }}>
                        <span style={{ fontSize: '1.8rem' }}>{timeSlot === 'TBA' ? '⏳' : '⏰'}</span>
                        <div>
                          <div style={{ color: getTimeSlotInfo(timeSlot).badgeColor, fontFamily: 'Press Start 2P, monospace', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {timeSlot === 'TBA' ? 'TBA (TO BE ANNOUNCED)' : timeSlot}
                          </div>
                        </div>
                      </div>
                      <div style={{ color: '#bbb', fontSize: '0.74rem', marginTop: '10px' }}>
                        {timeSlot === 'TBA'
                          ? 'Your presentation time slot will be allocated by the admin soon.'
                          : 'Be present in your allocated lab before this scheduled presentation window.'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(33, 33, 255, 0.15)',
                    border: '1px solid rgba(33, 33, 255, 0.4)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '0.74rem',
                    color: '#ccc',
                    lineHeight: '1.5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span>💡</span>
                    <span><strong>Presentation Checklist:</strong> Please keep your working prototype, presentation slides, and College ID cards ready when reporting to the lab.</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px dashed rgba(255, 184, 82, 0.3)',
                  borderRadius: '8px',
                  padding: '16px',
                  color: '#ffb852',
                  fontSize: '0.78rem',
                  lineHeight: '1.6'
                }}>
                  ⏳ <strong>Judge panel allocation is currently underway.</strong> Once the hackathon organizers finalize your panel and designated lab room, your allocated judge panel (e.g., JM001 - JM011) and exact lab location (e.g., CE Dept. First/Second Floor) will appear automatically on this page in real-time.
                </div>
              )}
            </div>

            {/* Section 1: Team & Leader Details Summary */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#00ffcc', fontSize: '0.85rem', fontFamily: 'Press Start 2P, monospace', marginBottom: '14px' }}>
                👤 TEAM & LEADER DETAILS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ background: '#000', border: `1px solid ${!isTeamIdValid ? '#ff0055' : 'rgba(255, 255, 255, 0.1)'}`, padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>TEAM ID NUMBER</div>
                  <div style={{ color: !isTeamIdValid ? '#ff0055' : '#fdff00', fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {isTeamIdValid ? teamIdNo : '⚠️ MISSING (Click Edit to Add)'}
                  </div>
                </div>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>FULL NAME</div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{leaderName}</div>
                </div>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>EMAIL ID</div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{leaderEmail}</div>
                </div>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>ENROLLMENT NO. / ID</div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{leaderId}</div>
                </div>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>BRANCH / DEPT</div>
                  <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '0.9rem' }}>{leaderBranch}</div>
                </div>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>PHONE NUMBER</div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{leaderPhone}</div>
                </div>
              </div>
            </div>

            {/* Section 2: Team Members Summary */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#00ffcc', fontSize: '0.85rem', fontFamily: 'Press Start 2P, monospace', marginBottom: '14px' }}>
                👥 TEAM MEMBERS ({members.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {members.map((m, idx) => (
                  <div key={idx} style={{ background: '#000', border: '1px solid rgba(33, 33, 255, 0.4)', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ color: '#fdff00', fontWeight: 'bold', fontSize: '0.85rem' }}>{idx + 1}. {m.name}</div>
                      <div style={{ color: '#8888aa', fontSize: '0.75rem' }}>{m.email} • ID: {m.idNo}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#00ffcc', fontSize: '0.75rem', fontWeight: 'bold' }}>{m.branch}</div>
                      <div style={{ color: '#aaa', fontSize: '0.75rem' }}>📞 {m.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Project & Solution Details Summary */}
            <div>
              <h3 style={{ color: '#00ffcc', fontSize: '0.85rem', fontFamily: 'Press Start 2P, monospace', marginBottom: '14px' }}>
                💡 PROJECT & SOLUTION DETAILS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>PROJECT TITLE</div>
                  <div style={{ color: '#fdff00', fontWeight: 'bold', fontSize: '0.95rem' }}>{projectTitle || 'N/A'}</div>
                </div>
                <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '4px' }}>PROJECT TYPE</div>
                  <div style={{ color: '#ff0055', fontWeight: 'bold', fontSize: '0.95rem', textTransform: 'uppercase' }}>{projectType}</div>
                </div>
              </div>

              <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '8px', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '6px' }}>MAIN IDEA & PROBLEM STATEMENT</div>
                <div style={{ color: '#eee', fontSize: '0.82rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{projectIdea || 'N/A'}</div>
              </div>

              <div style={{ background: '#000', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '14px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.65rem', color: '#8888aa', marginBottom: '6px' }}>TECH STACK & TOOLS</div>
                <div style={{ color: '#00ffcc', fontSize: '0.85rem', fontWeight: 'bold' }}>{techStack || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Closed Registration Notice (For Unregistered Users) */}
        {!isLoading && !isExistingRecord && (
          <div className="registered-summary-card" style={{
            background: 'rgba(20, 10, 15, 0.95)',
            border: '2px solid #ff0055',
            borderRadius: '16px',
            padding: '40px 28px',
            boxShadow: '0 0 30px rgba(255, 0, 85, 0.35)',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <div style={{ fontSize: '3.2rem', marginBottom: '16px' }}>⛔</div>
            <span className="role-badge" style={{ background: '#ff0055', color: '#fff', border: '2px solid #ff0055', marginBottom: '14px', display: 'inline-block' }}>
              STAGE 1: REGISTRATION CLOSED
            </span>
            <h2 style={{ color: '#ff0055', fontSize: '1.25rem', fontFamily: 'Press Start 2P, monospace', margin: '14px 0 16px', textShadow: '0 0 12px rgba(255, 0, 85, 0.6)' }}>
              NEW TEAM REGISTRATION IS CLOSED
            </h2>
            <p style={{ color: '#e0e0e0', fontSize: '0.88rem', maxWidth: '640px', margin: '0 auto 20px', lineHeight: '1.6' }}>
              New team and project registrations for <strong>Mecia Hack 3.0 (Round 2)</strong> are now officially closed.
            </p>
            <div style={{
              background: 'rgba(0, 0, 0, 0.75)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              padding: '18px 22px',
              maxWidth: '620px',
              margin: '0 auto 26px',
              textAlign: 'left',
              fontSize: '0.8rem',
              color: '#bbb',
              lineHeight: '1.6'
            }}>
              <div style={{ color: '#fdff00', fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Press Start 2P, monospace', fontSize: '0.62rem' }}>
                ℹ️ ARE YOU PART OF A REGISTERED TEAM?
              </div>
              <div>
                Logged in account: <strong style={{ color: '#00ffcc' }}>{studentId}</strong>
              </div>
              <div style={{ marginTop: '8px' }}>
                If your team has already registered, please log in using the exact <strong>Leader Email</strong>, <strong>Member Email</strong>, or <strong>Enrollment ID</strong> submitted during registration to view your allocated Judge Panel, Lab Venue, and Presentation Time Slot.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleLogout}
                className="logout-btn"
                style={{
                  padding: '12px 24px',
                  fontSize: '0.68rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🚪 LOG OUT & SWITCH ACCOUNT
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="nav-back-btn"
                style={{
                  padding: '12px 24px',
                  fontSize: '0.68rem'
                }}
              >
                🏠 RETURN TO LOGIN
              </button>
            </div>
          </div>
        )}

        {/* 6. Existing Team Registration Editing Form View */}
        {!isLoading && isExistingRecord && isEditing && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  background: 'rgba(33, 33, 255, 0.2)',
                  color: '#00ffcc',
                  border: '1px solid #00ffcc',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontFamily: 'Press Start 2P, monospace',
                  fontSize: '0.6rem',
                  cursor: 'pointer'
                }}
              >
                ← CANCEL / BACK TO SUMMARY
              </button>
            </div>

            {/* Allocated Venue & Panel Quick Info inside Edit View */}
            {assignedJudge && assignedJudge !== 'Unassigned' && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 255, 204, 0.1) 0%, rgba(33, 33, 255, 0.15) 100%)',
                border: '1.5px solid #00ffcc',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 0 12px rgba(0, 255, 204, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.3rem' }}>🏛️</span>
                  <div>
                    <div style={{ color: '#00ffcc', fontFamily: 'Press Start 2P, monospace', fontSize: '0.68rem', marginBottom: '4px' }}>
                      ALLOCATED EVALUATION PANEL: <span style={{ color: '#fdff00' }}>{assignedJudge.toUpperCase()}</span> {judgeProfile?.group ? `(${judgeProfile.group})` : ''}
                    </div>
                    <div style={{ color: '#fff', fontSize: '0.78rem' }}>
                      📍 <strong>Venue Location:</strong> <span style={{ color: '#fdff00', fontWeight: 'bold' }}>{judgeProfile?.location || 'Computer Engineering Dept.'}</span>
                    </div>
                  </div>
                </div>
                <span style={{
                  background: 'rgba(0, 255, 204, 0.2)',
                  color: '#00ffcc',
                  border: '1px solid #00ffcc',
                  fontFamily: 'Press Start 2P, monospace',
                  fontSize: '0.58rem',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  ROUND 2 READY
                </span>
              </div>
            )}

            {/* SECTION 1: TEAM LEADER DETAILS */}
            <div className="form-section">
              <h3 className="section-title"><span className="pacman-bullet"></span> 1. TEAM LEADER DETAILS (COMPULSORY)</h3>
              <div className="leader-grid">
                <div className="form-group">
                  <label htmlFor="team-name">Team Name <span style={{ color: '#ff0055' }}>*</span></label>
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
                  <label htmlFor="team-id-no">
                    Team ID Number <span style={{ color: '#ff0055' }}>* (COMPULSORY)</span>
                  </label>
                  <input
                    type="text"
                    id="team-id-no"
                    placeholder="e.g., TEAM-101 / MH-042"
                    required
                    value={teamIdNo}
                    onChange={(e) => setTeamIdNo(e.target.value)}
                  />
                  {!teamIdNo.trim() && (
                    <span style={{ color: '#ff0055', fontSize: '0.62rem', marginTop: '4px', display: 'block' }}>
                      ⚠️ Team ID is compulsory to unlock other sections & submit
                    </span>
                  )}
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
              <h3 className="section-title"><span className="pacman-bullet"></span> 2. OTHER TEAM MEMBERS DETAILS (MAX 3 MEMBERS)</h3>

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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <button
                  type="button"
                  className="add-member-btn"
                  onClick={addMember}
                  disabled={!isLeaderComplete || members.length >= 3}
                  style={{
                    opacity: (!isLeaderComplete || members.length >= 3) ? 0.5 : 1,
                    cursor: (!isLeaderComplete || members.length >= 3) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {members.length >= 3 ? '⛔ MAX 3 MEMBERS LIMIT REACHED' : `+ ADD ANOTHER MEMBER (${members.length}/3)`}
                </button>
                <span style={{ fontSize: '0.62rem', color: '#8888aa', fontFamily: 'Press Start 2P, monospace' }}>
                  MEMBERS: <span style={{ color: members.length >= 3 ? '#ff0055' : '#00ffcc' }}>{members.length} / 3</span>
                </span>
              </div>
            </div>

            {/* SECTION 3: PROJECT DETAILS & MAIN IDEA */}
            <div className={`form-section locked-until-leader ${!isLeaderComplete ? 'section-disabled' : ''}`}>
              <h3 className="section-title"><span className="pacman-bullet"></span> 3. PROJECT & SOLUTION DETAILS</h3>

              <div className="form-group">
                <label htmlFor="project-title">Project Title / Name</label>
                <input
                  type="text"
                  id="project-title"
                  placeholder="e.g., Autonomous Maze Navigator Bot"
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
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  disabled={!isLeaderComplete}
                  required
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
              disabled={!isLeaderComplete || !isTeamIdValid}
              title={!isTeamIdValid ? "Please enter Team ID Number first" : undefined}
              style={{
                background: isExistingRecord ? 'var(--maze-blue, #2121ff)' : undefined,
                borderColor: isExistingRecord ? '#00ffcc' : undefined,
                opacity: (!isLeaderComplete || !isTeamIdValid) ? 0.5 : 1,
                cursor: (!isLeaderComplete || !isTeamIdValid) ? 'not-allowed' : 'pointer'
              }}
            >
              <span className="pacman-icon"></span> {isExistingRecord ? '💾 UPDATE & SAVE CHANGES' : '🚀 SUBMIT FINAL PROJECT ENTRY'}
            </button>
          </form>
        )}

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
                <span style={{ fontSize: '0.58rem', color: '#8888aa' }}>TEAM ID:</span>
                <span style={{ fontSize: '0.62rem', color: '#fdff00', fontWeight: 'bold' }}>{teamIdNo || 'N/A'}</span>
              </div>
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="submit-btn"
                onClick={() => window.print()}
                style={{ flex: 1, minWidth: '130px', background: '#2121ff', color: '#fff', fontSize: '0.58rem', padding: '12px 8px' }}
              >
                🖨️ PRINT CONFIRMATION
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={() => setShowModal(false)}
                style={{ flex: 1, minWidth: '130px', background: '#00ffcc', color: '#000', fontSize: '0.58rem', padding: '12px 8px' }}
              >
                👁️ VIEW SUMMARY
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={handleLogout}
                style={{ flex: 1, minWidth: '130px', background: '#ff0055', color: '#fff', fontSize: '0.58rem', padding: '12px 8px' }}
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
