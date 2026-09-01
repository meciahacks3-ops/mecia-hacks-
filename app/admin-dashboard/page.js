'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { JUDGE_PROFILES } from '@/lib/judgeProfiles';
import {
  TIME_SLOT_OPTIONS,
  normalizeTimeSlot,
  parseTimeSlotFromTeam,
  getTimeSlotInfo,
  saveTeamAssignment,
  computePanelSlotSplit,
  computeAllPanelsSlotSplit
} from '@/lib/timeSlotUtils';
import {
  exportJudgesPanelsAndTeamsExcel,
  exportSinglePanelExcel,
  exportAllPanelsZip,
  exportTimeSlotScheduleExcel,
  printPanelDossier,
  printAllPanelsDossiers,
  printTimeSlotSchedule,
  exportAttendanceSheetExcel,
  printAttendanceSheet,
  exportAttendanceCSV,
  extractAllStudentsRoster,
  ROUND_2_PANEL_IDS,
  exportProjectTracksWorkbook,
  exportSingleTrackExcel,
  exportAllTracksZip
} from '@/lib/excelExport';
import { parseProjectTypeFromTeam, getProjectTypeInfo, parseEvaluationRecord } from '@/lib/teamUtils';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('adminUser') || 'admin_user';
    }
    return 'admin_user';
  });
  const [activeTab, setActiveTab] = useState('teams-tab'); // 'teams-tab', 'schedule-tab', 'scores-tab', 'panels-tab', 'whitelist-tab'
  
  // Filters for Tab 1 (Teams & Judges)
  const [teamsFilter, setTeamsFilter] = useState('all'); // 'unassigned', 'assigned', 'all'
  const [timeSlotFilter, setTimeSlotFilter] = useState('all'); // 'all', 'TBA', '09:30 AM - 11:30 AM', '12:15 PM - 02:15 PM', '02:30 PM - 04:15 PM'
  
  // Filter for Schedule Tab
  const [scheduleViewSlot, setScheduleViewSlot] = useState('all'); // 'all', 'TBA', '09:30 AM - 11:30 AM', '12:15 PM - 02:15 PM', '02:30 PM - 04:15 PM'

  // Filter for Leaderboard Tab (Project Type: all, software, hybrid, hardware)
  const [leaderboardTypeFilter, setLeaderboardTypeFilter] = useState('all');

  const [teams, setTeams] = useState([]);
  const [evaluations, setEvaluations] = useState([]);

  const [judgeSelections, setJudgeSelections] = useState({});
  const [timeSlotSelections, setTimeSlotSelections] = useState({});
  const [customJudgeInputs, setCustomJudgeInputs] = useState({});

  // Auto-Split 4-4-4 State
  const [isAutoSplitting, setIsAutoSplitting] = useState(false);
  const [autoSplitProgress, setAutoSplitProgress] = useState('');
  const [autoSplittingPanelId, setAutoSplittingPanelId] = useState(null);

  // Bulk Selection & Assignment State
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [bulkSlotChoice, setBulkSlotChoice] = useState('09:30 AM - 11:30 AM');
  const [bulkJudgeChoice, setBulkJudgeChoice] = useState('JM001');
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Per-team saving tracking
  const [assigningTeamId, setAssigningTeamId] = useState(null);
  const [savingSlotTeamId, setSavingSlotTeamId] = useState(null);

  // Whitelist State
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [newGmail, setNewGmail] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingEmail, setEditingEmail] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [showZipPanelsModal, setShowZipPanelsModal] = useState(false);
  const [zipModalSearch, setZipModalSearch] = useState('');
  const [zipModalSlotFilter, setZipModalSlotFilter] = useState('all');

  // Attendance Modal & Filters State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendancePanelFilter, setAttendancePanelFilter] = useState('all');
  const [attendanceSlotFilter, setAttendanceSlotFilter] = useState('all');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');

  // Project Tracks Modal State
  const [showTracksModal, setShowTracksModal] = useState(false);
  const [isExportingTracksZip, setIsExportingTracksZip] = useState(false);

  const fetchAllowedUsers = async () => {
    try {
      const { data } = await supabase.from('allowed_users').select('*').order('created_at', { ascending: false });
      if (data) setAllowedUsers(data);
    } catch (e) {
      console.warn("Allowed users fetch warning:", e);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch Teams along with all team members
      const { data: supaTeams } = await supabase.from('teams').select('*, team_members(*)');
      if (supaTeams && supaTeams.length > 0) {
        const formattedTeams = supaTeams.map(st => {
          let parsedTeamId = st.team_id_no && st.team_id_no.trim() !== 'N/A' ? st.team_id_no.trim() : 'N/A';
          if (parsedTeamId === 'N/A' && st.main_idea && st.main_idea.includes('Team ID:')) {
            const match = st.main_idea.match(/Team ID:\s*([^\]\n|]+)/i);
            if (match && match[1]) parsedTeamId = match[1].trim();
          }

          let leaderBranch = '';
          if (st.main_idea && st.main_idea.includes('Branch:')) {
            const bMatch = st.main_idea.match(/Branch:\s*([^|\]]+)/i);
            if (bMatch && bMatch[1]) leaderBranch = bMatch[1].trim();
          }

          const parsedSlot = parseTimeSlotFromTeam(st);
          const parsedProjectType = parseProjectTypeFromTeam(st);

          const seenMemberKeys = new Set();
          const parsedMembers = [];

          (st.team_members || []).forEach(m => {
            let mName = m.member_name || '';
            let mBranch = '';
            const mMatch = mName.match(/^(.*?)\s*\((.*?)\)$/);
            if (mMatch) {
              mName = mMatch[1].trim();
              mBranch = mMatch[2].trim();
            }

            const cleanName = mName.trim().toLowerCase();
            const cleanId = (m.member_id || '').trim().toLowerCase();
            const dupeKey = cleanId && cleanId !== 'n/a' ? cleanId : cleanName;

            if (dupeKey) {
              if (seenMemberKeys.has(dupeKey)) return;
              seenMemberKeys.add(dupeKey);
            }

            parsedMembers.push({
              id: m.id,
              name: mName,
              email: m.member_email || '',
              idNo: m.member_id || '',
              phone: m.member_phone || '',
              branch: mBranch
            });
          });

          return {
            id: st.id,
            teamName: st.team_name,
            teamIdNo: parsedTeamId,
            leaderName: st.leader_name,
            leaderEmail: st.leader_email,
            leaderId: st.leader_id,
            leaderPhone: st.leader_phone,
            leaderBranch: leaderBranch,
            projectTitle: st.project_title,
            projectType: parsedProjectType,
            techStack: st.tech_stack,
            assignedJudge: st.assigned_judge || 'Unassigned',
            timeSlot: parsedSlot,
            rawMainIdea: st.main_idea || '',
            members: parsedMembers,
            totalTeamSize: 1 + parsedMembers.length
          };
        });
        setTeams(formattedTeams);

        setJudgeSelections(prev => {
          const next = { ...prev };
          formattedTeams.forEach(t => {
            if (next[t.id] === undefined) {
              next[t.id] = t.assignedJudge;
            }
          });
          return next;
        });

        setTimeSlotSelections(prev => {
          const next = { ...prev };
          formattedTeams.forEach(t => {
            if (next[t.id] === undefined) {
              next[t.id] = t.timeSlot;
            }
          });
          return next;
        });
      } else {
        setTeams([]);
        setJudgeSelections({});
        setTimeSlotSelections({});
      }

      // 2. Fetch Evaluations
      const { data: supaEvals } = await supabase.from('evaluations').select('*');
      if (supaEvals && supaEvals.length > 0) {
        const formattedEvals = supaEvals.map(parseEvaluationRecord).filter(Boolean);
        setEvaluations(formattedEvals);
      } else {
        setEvaluations([]);
      }
    } catch (e) {
      console.warn("Supabase admin fetch error:", e);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        const searchInput = document.getElementById('admin-search-input');
        if (searchInput) searchInput.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
    fetchAllowedUsers();

    const pollInterval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleAddAllowedGmail = async (e) => {
    e.preventDefault();
    if (!newGmail.trim()) return;

    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .insert([{ email: newGmail.trim().toLowerCase(), added_by: adminUser }])
        .select()
        .single();

      if (error) {
        alert("Database Notice: " + error.message);
      } else if (data) {
        setAllowedUsers([data, ...allowedUsers]);
        setNewGmail('');
        alert(`Successfully authorized ${data.email} for Google OAuth!`);
      }
    } catch (err) {
      console.error("Add allowed email error:", err);
    }
  };

  const startEditGmail = (u) => {
    setEditingUserId(u.id);
    setEditingEmail(u.email);
  };

  const handleUpdateAllowedGmail = async (id) => {
    if (!editingEmail.trim()) return;

    try {
      const { error } = await supabase
        .from('allowed_users')
        .update({ email: editingEmail.trim().toLowerCase() })
        .eq('id', id);

      if (error) {
        alert("Database Notice: " + error.message);
      } else {
        setAllowedUsers(allowedUsers.map(u => u.id === id ? { ...u, email: editingEmail.trim().toLowerCase() } : u));
        setEditingUserId(null);
        setEditingEmail('');
        alert("Successfully updated authorized email!");
      }
    } catch (err) {
      console.error("Update allowed email error:", err);
    }
  };

  const handleRemoveAllowedGmail = async (id, email) => {
    if (!confirm(`Are you sure you want to revoke access for ${email}?`)) return;

    try {
      await supabase.from('allowed_users').delete().eq('id', id);
      setAllowedUsers(allowedUsers.filter(u => u.id !== id));
    } catch (err) {
      console.error("Remove allowed email error:", err);
    }
  };

  // Save both Judge Panel & Time Slot for a single team
  const handleSaveTeam = async (teamId, teamName) => {
    const currentTeam = teams.find(t => t.id === teamId);
    const selectedJudgeVal = judgeSelections[teamId] !== undefined ? judgeSelections[teamId] : (currentTeam?.assignedJudge || 'Unassigned');
    let finalJudge = selectedJudgeVal;

    if (selectedJudgeVal === 'CUSTOM') {
      finalJudge = (customJudgeInputs[teamId] || '').trim();
      if (!finalJudge) {
        alert("Please enter a valid Judge Email or Panel ID!");
        return;
      }
    }

    const selectedSlotVal = timeSlotSelections[teamId] !== undefined ? timeSlotSelections[teamId] : (currentTeam?.timeSlot || 'TBA');
    const finalSlot = normalizeTimeSlot(selectedSlotVal);

    setAssigningTeamId(teamId);

    try {
      const { error, updatedMainIdea } = await saveTeamAssignment(
        supabase,
        teamId,
        teamName,
        {
          assignedJudge: finalJudge,
          timeSlot: finalSlot,
          rawMainIdea: currentTeam?.rawMainIdea || ''
        }
      );

      if (error) {
        console.error("Assignment error:", error);
        alert("Error saving assignment: " + error.message);
        setAssigningTeamId(null);
        return;
      }

      setTeams(prev => prev.map(t => t.id === teamId ? {
        ...t,
        assignedJudge: finalJudge,
        timeSlot: finalSlot,
        rawMainIdea: updatedMainIdea
      } : t));

      setJudgeSelections(prev => ({ ...prev, [teamId]: finalJudge }));
      setTimeSlotSelections(prev => ({ ...prev, [teamId]: finalSlot }));
      alert(`✅ Updated "${teamName}":\n• Judge: ${finalJudge}\n• Time Slot: ${finalSlot}`);
    } catch (err) {
      console.error("Save team error:", err);
      alert(`Updated "${teamName}"!`);
    } finally {
      setAssigningTeamId(null);
    }
  };

  // Quick single-click time slot update (used on schedule view)
  const handleQuickSlotChange = async (teamId, teamName, targetSlot) => {
    const finalSlot = normalizeTimeSlot(targetSlot);
    const currentTeam = teams.find(t => t.id === teamId);
    setSavingSlotTeamId(teamId);

    try {
      const { error, updatedMainIdea } = await saveTeamAssignment(
        supabase,
        teamId,
        teamName,
        {
          assignedJudge: currentTeam?.assignedJudge || 'Unassigned',
          timeSlot: finalSlot,
          rawMainIdea: currentTeam?.rawMainIdea || ''
        }
      );

      if (error) {
        alert("Error updating slot: " + error.message);
        return;
      }

      setTeams(prev => prev.map(t => t.id === teamId ? {
        ...t,
        timeSlot: finalSlot,
        rawMainIdea: updatedMainIdea
      } : t));

      setTimeSlotSelections(prev => ({ ...prev, [teamId]: finalSlot }));
    } catch (err) {
      console.error("Quick slot change error:", err);
    } finally {
      setSavingSlotTeamId(null);
    }
  };

  // 1-Click Auto-Assign balanced 4-4-4 time slots across all Judge Panels
  const handleAutoSplitAllPanels = async () => {
    if (!teams || teams.length === 0) {
      alert("No teams available to allocate slots!");
      return;
    }

    const assignedCount = teams.filter(t => t.assignedJudge && t.assignedJudge !== 'Unassigned').length;
    const confirmMsg = `⚡ 1-CLICK AUTO-SPLIT TIME SLOTS (4-4-4 BALANCE)\n\n` +
      `This will automatically balance all teams within their assigned judge panels into equal batches across the 3 official slots:\n\n` +
      `• Slot 1: 09:30 AM — 11:30 AM (~4 teams per panel)\n` +
      `• Slot 2: 12:15 PM — 02:15 PM (~4 teams per panel)\n` +
      `• Slot 3: 02:30 PM — 04:15 PM (~4 teams per panel)\n\n` +
      `Total teams to allocate: ${teams.length} (${assignedCount} assigned to judge panels)\n\n` +
      `Do you want to proceed?`;

    if (!confirm(confirmMsg)) return;

    setIsAutoSplitting(true);
    setAutoSplitProgress(`Calculating optimal 4-4-4 split across panels...`);

    try {
      const plannedAssignments = computeAllPanelsSlotSplit(teams);
      let successCount = 0;
      const total = plannedAssignments.length;

      // Update in batches of 15 concurrent promises
      const BATCH_SIZE = 15;
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = plannedAssignments.slice(i, i + BATCH_SIZE);
        setAutoSplitProgress(`Saving slots... (${Math.min(i + BATCH_SIZE, total)} / ${total})`);

        await Promise.all(
          batch.map(async (item) => {
            const { error, updatedMainIdea } = await saveTeamAssignment(
              supabase,
              item.id,
              item.teamName,
              {
                assignedJudge: item.assignedJudge,
                timeSlot: item.timeSlot,
                rawMainIdea: item.rawMainIdea
              }
            );
            if (!error) {
              successCount++;
              setTeams(prev => prev.map(t => t.id === item.id ? {
                ...t,
                timeSlot: item.timeSlot,
                rawMainIdea: updatedMainIdea
              } : t));
              setTimeSlotSelections(prev => ({ ...prev, [item.id]: item.timeSlot }));
            }
          })
        );
      }

      const s1Count = plannedAssignments.filter(a => a.timeSlot === '09:30 AM - 11:30 AM').length;
      const s2Count = plannedAssignments.filter(a => a.timeSlot === '12:15 PM - 02:15 PM').length;
      const s3Count = plannedAssignments.filter(a => a.timeSlot === '02:30 PM - 04:15 PM').length;

      alert(
        `🎉 AUTO-ALLOCATION COMPLETE!\n\n` +
        `✅ Successfully assigned balanced time slots to ${successCount} teams:\n` +
        `• Slot 1 (09:30 AM - 11:30 AM): ${s1Count} teams\n` +
        `• Slot 2 (12:15 PM - 02:15 PM): ${s2Count} teams\n` +
        `• Slot 3 (02:30 PM - 04:15 PM): ${s3Count} teams\n\n` +
        `Master timetable and judge sheets have been updated!`
      );
    } catch (e) {
      console.error("Auto-split all panels error:", e);
      alert("Error during auto-allocation: " + e.message);
    } finally {
      setIsAutoSplitting(false);
      setAutoSplitProgress('');
    }
  };

  // Auto-split slots for a single panel
  const handleAutoSplitSinglePanel = async (panelId) => {
    const upperId = (panelId || '').trim().toUpperCase();
    const panelTeams = teams.filter(t => (t.assignedJudge || '').trim().toUpperCase() === upperId);

    if (panelTeams.length === 0) {
      alert(`No teams are assigned to Panel ${panelId} yet!`);
      return;
    }

    if (!confirm(`Auto-split ${panelTeams.length} teams in Panel ${panelId} equally across Slot 1, Slot 2, and Slot 3 (4-4-4)?`)) {
      return;
    }

    setAutoSplittingPanelId(panelId);
    try {
      const planned = computePanelSlotSplit(panelTeams);
      let successCount = 0;

      await Promise.all(
        planned.map(async (item) => {
          const { error, updatedMainIdea } = await saveTeamAssignment(
            supabase,
            item.id,
            item.teamName,
            {
              assignedJudge: item.assignedJudge,
              timeSlot: item.timeSlot,
              rawMainIdea: item.rawMainIdea
            }
          );
          if (!error) {
            successCount++;
            setTeams(prev => prev.map(t => t.id === item.id ? {
              ...t,
              timeSlot: item.timeSlot,
              rawMainIdea: updatedMainIdea
            } : t));
            setTimeSlotSelections(prev => ({ ...prev, [item.id]: item.timeSlot }));
          }
        })
      );

      alert(`✅ Successfully balanced ${successCount} teams for Panel ${panelId} across 3 time slots!`);
    } catch (e) {
      console.error("Auto split panel error:", e);
      alert("Error auto-splitting panel: " + e.message);
    } finally {
      setAutoSplittingPanelId(null);
    }
  };

  // Bulk Apply Time Slot to Selected Teams
  const handleBulkApplySlot = async () => {
    if (selectedTeamIds.length === 0) {
      alert("Please select at least one team using the checkboxes.");
      return;
    }

    const normSlot = normalizeTimeSlot(bulkSlotChoice);
    if (!confirm(`Are you sure you want to allocate Time Slot "${normSlot}" to the ${selectedTeamIds.length} selected team(s)?`)) {
      return;
    }

    setIsSavingBulk(true);
    try {
      let successCount = 0;
      for (const teamId of selectedTeamIds) {
        const currentTeam = teams.find(t => t.id === teamId);
        if (currentTeam) {
          const { error, updatedMainIdea } = await saveTeamAssignment(
            supabase,
            teamId,
            currentTeam.teamName,
            {
              assignedJudge: currentTeam.assignedJudge,
              timeSlot: normSlot,
              rawMainIdea: currentTeam.rawMainIdea || ''
            }
          );
          if (!error) {
            successCount++;
            setTeams(prev => prev.map(t => t.id === teamId ? { ...t, timeSlot: normSlot, rawMainIdea: updatedMainIdea } : t));
            setTimeSlotSelections(prev => ({ ...prev, [teamId]: normSlot }));
          }
        }
      }
      alert(`✅ Successfully allocated Time Slot "${normSlot}" to ${successCount} team(s)!`);
      setSelectedTeamIds([]);
    } catch (e) {
      console.error("Bulk slot assignment error:", e);
      alert("Bulk assignment notice: " + e.message);
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Bulk Apply Judge Panel to Selected Teams
  const handleBulkApplyJudge = async () => {
    if (selectedTeamIds.length === 0) {
      alert("Please select at least one team using the checkboxes.");
      return;
    }

    const targetJudge = bulkJudgeChoice;
    if (!confirm(`Are you sure you want to assign Judge Panel "${targetJudge}" to the ${selectedTeamIds.length} selected team(s)?`)) {
      return;
    }

    setIsSavingBulk(true);
    try {
      let successCount = 0;
      for (const teamId of selectedTeamIds) {
        const currentTeam = teams.find(t => t.id === teamId);
        if (currentTeam) {
          const { error, updatedMainIdea } = await saveTeamAssignment(
            supabase,
            teamId,
            currentTeam.teamName,
            {
              assignedJudge: targetJudge,
              timeSlot: currentTeam.timeSlot || 'TBA',
              rawMainIdea: currentTeam.rawMainIdea || ''
            }
          );
          if (!error) {
            successCount++;
            setTeams(prev => prev.map(t => t.id === teamId ? { ...t, assignedJudge: targetJudge, rawMainIdea: updatedMainIdea } : t));
            setJudgeSelections(prev => ({ ...prev, [teamId]: targetJudge }));
          }
        }
      }
      alert(`✅ Successfully assigned Judge "${targetJudge}" to ${successCount} team(s)!`);
      setSelectedTeamIds([]);
    } catch (e) {
      console.error("Bulk judge assignment error:", e);
      alert("Bulk assignment notice: " + e.message);
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Toggle selection for single team
  const toggleSelectTeam = (teamId) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  // Toggle select all currently displayed teams
  const toggleSelectAllDisplayed = (displayedList) => {
    const displayedIds = displayedList.map(t => t.id);
    const allSelected = displayedIds.every(id => selectedTeamIds.includes(id));
    if (allSelected) {
      setSelectedTeamIds(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedTeamIds(prev => Array.from(new Set([...prev, ...displayedIds])));
    }
  };

  // Export Judges Panels & Teams Master Excel (.xlsx)
  const handleExportJudgesPanelsExcel = () => {
    try {
      if (!teams || teams.length === 0) {
        alert("No teams available to export yet!");
        return;
      }
      const filename = exportJudgesPanelsAndTeamsExcel(teams, evaluations);
      alert(`✅ Master Excel workbook generated!\n\nFile: ${filename}\n\nIncludes allocated time slots for all panels & teams.`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Error generating Excel sheet: " + err.message);
    }
  };

  // Export Time Slots Master Schedule Excel (.xlsx)
  const handleExportScheduleExcel = () => {
    try {
      if (!teams || teams.length === 0) {
        alert("No teams available to export yet!");
        return;
      }
      const filename = exportTimeSlotScheduleExcel(teams, evaluations);
      alert(`✅ Master Time Slot Schedule workbook generated!\n\nFile: ${filename}\n\nIncludes sheets for 9:30-11:30, 12:15-2:15, 2:30-4:15, and TBA.`);
    } catch (err) {
      console.error("Schedule export error:", err);
      alert("Error exporting schedule: " + err.message);
    }
  };

  // Print Master Time Slot Schedule (A4)
  const handlePrintSchedule = () => {
    printTimeSlotSchedule(teams, evaluations);
  };

  // Export a single panel's dedicated Excel (.xlsx) file
  const handleExportSinglePanel = (panelId) => {
    try {
      const filename = exportSinglePanelExcel(panelId, teams, evaluations);
      alert(`✅ Separate Excel sheet for Panel ${panelId} downloaded!\n\nFile: ${filename}`);
    } catch (err) {
      console.error("Single panel export error:", err);
      alert("Error exporting panel Excel sheet: " + err.message);
    }
  };

  // Export all panels as a ZIP archive of separate individual .xlsx files
  const handleExportAllPanelsZip = async () => {
    try {
      if (!teams || teams.length === 0) {
        alert("No teams available to export yet!");
        return;
      }
      setIsExportingZip(true);
      const zipFileName = await exportAllPanelsZip(teams, evaluations);
      alert(`✅ Complete ZIP Archive Created & Downloaded!\n\nAll 11 Judges Panels dossiers, dedicated time slot sheets, and master overview are included.\n\nFile: ${zipFileName}`);
    } catch (err) {
      console.error("ZIP export error:", err);
      alert("Error creating ZIP archive: " + err.message);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Direct browser print for a single panel
  const handlePrintPanel = (panelId) => {
    printPanelDossier(panelId, teams, evaluations);
  };

  // Direct browser print for all panels with page breaks
  const handlePrintAllPanels = () => {
    printAllPanelsDossiers(teams, evaluations);
  };

  // Export dedicated attendance Excel workbook (.xlsx)
  const handleExportAttendanceExcel = () => {
    try {
      if (!teams || teams.length === 0) {
        alert("No teams available to export attendance for yet!");
        return;
      }
      const filename = exportAttendanceSheetExcel(teams);
      alert(`✅ Official Student Attendance Workbook Generated!\n\nFile: ${filename}\n\nIncludes Master Panel-Wise Attendance sheet + Dedicated individual sheets for each Judge Panel (JM001 to JM010) with signature columns.`);
    } catch (err) {
      console.error("Attendance Excel export error:", err);
      alert("Error generating attendance Excel sheet: " + err.message);
    }
  };

  // Direct browser print for student attendance sheets
  const handlePrintAttendance = (mode = 'by-panel', panelId = null) => {
    try {
      if (!teams || teams.length === 0) {
        alert("No teams available to print attendance for yet!");
        return;
      }
      printAttendanceSheet(teams, { mode, panelId });
    } catch (err) {
      console.error("Print attendance error:", err);
      alert("Error opening printable attendance sheet: " + err.message);
    }
  };

  // Export student attendance CSV
  const handleExportAttendanceCSV = () => {
    try {
      if (!teams || teams.length === 0) {
        alert("No teams available to export attendance for yet!");
        return;
      }
      exportAttendanceCSV(teams);
    } catch (err) {
      console.error("Attendance CSV export error:", err);
      alert("Error exporting attendance CSV: " + err.message);
    }
  };

  // Export Teams Master CSV
  const exportCSV = () => {
    let csvRows = [];
    csvRows.push(["Mecia Hack 3.0 - Complete Admin Master Report & Evaluation Sheet (Round 2)"]);
    csvRows.push(["Report Date", new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push([
      "Team ID",
      "Team Name",
      "Project Type",
      "Total Team Size",
      "Allocated Time Slot",
      "Assigned Judge",
      "Leader Name",
      "Leader Email",
      "Leader Enrollment ID",
      "Leader Phone",
      "Leader Branch",
      "Member 1 Name",
      "Member 1 Email",
      "Member 1 Enrollment ID",
      "Member 1 Phone",
      "Member 1 Branch",
      "Member 2 Name",
      "Member 2 Email",
      "Member 2 Enrollment ID",
      "Member 2 Phone",
      "Member 2 Branch",
      "Member 3 Name",
      "Member 3 Email",
      "Member 3 Enrollment ID",
      "Member 3 Phone",
      "Member 3 Branch",
      "All Members Roster Summary",
      "Project Title",
      "Tech Stack",
      "Evaluation Status",
      "System Architecture (10)",
      "Prototype Scope (10)",
      "Component Availability (10)",
      "Execution Feasibility (10)",
      "Implementation Details (10)",
      "Total Score (50)",
      "Judge Remarks"
    ]);

    teams.forEach(t => {
      const evalEntry = evaluations.find(e => (e.teamName || '').trim().toLowerCase() === (t.teamName || '').trim().toLowerCase());
      let status = "PENDING";
      let c1 = "-", c2 = "-", c3 = "-", c4 = "-", c5 = "-", total = "-", remarks = "-";

      if (evalEntry) {
        status = "SCORED";
        c1 = evalEntry.c1;
        c2 = evalEntry.c2;
        c3 = evalEntry.c3;
        c4 = evalEntry.c4;
        c5 = evalEntry.c5;
        total = evalEntry.totalScore;
        remarks = evalEntry.remarks || '';
      }

      const m1 = t.members && t.members[0] ? t.members[0] : null;
      const m2 = t.members && t.members[1] ? t.members[1] : null;
      const m3 = t.members && t.members[2] ? t.members[2] : null;

      const allMembersSummary = [
        `Leader: ${t.leaderName} (${t.leaderId}) [Phone: ${t.leaderPhone}] [Email: ${t.leaderEmail}]`,
        ...(t.members || []).map((m, idx) => `Member ${idx + 1}: ${m.name} (${m.idNo}) [Phone: ${m.phone}] [Email: ${m.email}]${m.branch ? ` [${m.branch}]` : ''}`)
      ].join(' | ');

      csvRows.push([
        `"${t.teamIdNo || 'N/A'}"`,
        `"${t.teamName || ''}"`,
        `"${t.projectType || 'Hardware'}"`,
        t.totalTeamSize || (1 + (t.members?.length || 0)),
        `"${t.timeSlot || 'TBA'}"`,
        `"${t.assignedJudge || 'Unassigned'}"`,
        `"${t.leaderName || ''}"`,
        `"${t.leaderEmail || ''}"`,
        `"${t.leaderId || ''}"`,
        `"${t.leaderPhone || ''}"`,
        `"${t.leaderBranch || ''}"`,
        `"${m1 ? m1.name : ''}"`,
        `"${m1 ? m1.email : ''}"`,
        `"${m1 ? m1.idNo : ''}"`,
        `"${m1 ? m1.phone : ''}"`,
        `"${m1 ? m1.branch : ''}"`,
        `"${m2 ? m2.name : ''}"`,
        `"${m2 ? m2.email : ''}"`,
        `"${m2 ? m2.idNo : ''}"`,
        `"${m2 ? m2.phone : ''}"`,
        `"${m2 ? m2.branch : ''}"`,
        `"${m3 ? m3.name : ''}"`,
        `"${m3 ? m3.email : ''}"`,
        `"${m3 ? m3.idNo : ''}"`,
        `"${m3 ? m3.phone : ''}"`,
        `"${m3 ? m3.branch : ''}"`,
        `"${allMembersSummary.replace(/"/g, '""')}"`,
        `"${(t.projectTitle || '').replace(/"/g, '""')}"`,
        `"${(t.techStack || '').replace(/"/g, '""')}"`,
        `"${status}"`,
        c1,
        c2,
        c3,
        c4,
        c5,
        total,
        `"${(remarks || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_Teams_Master_Report_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Export All Students Directory CSV
  const exportStudentsDirectoryCSV = () => {
    let csvRows = [];
    csvRows.push(["Mecia Hack 3.0 - Complete All Students & Participants Directory"]);
    csvRows.push(["Report Date", new Date().toLocaleString()]);
    csvRows.push([]);
    csvRows.push([
      "Team ID",
      "Team Name",
      "Allocated Time Slot",
      "Assigned Judge",
      "Participant Role",
      "Student Name",
      "Enrollment No / ID",
      "Email Address",
      "Mobile Phone",
      "Branch / Dept",
      "Project Title"
    ]);

    teams.forEach(t => {
      // Leader row
      csvRows.push([
        `"${t.teamIdNo || 'N/A'}"`,
        `"${t.teamName || ''}"`,
        `"${t.timeSlot || 'TBA'}"`,
        `"${t.assignedJudge || 'Unassigned'}"`,
        `"Team Leader"`,
        `"${t.leaderName || ''}"`,
        `"${t.leaderId || ''}"`,
        `"${t.leaderEmail || ''}"`,
        `"${t.leaderPhone || ''}"`,
        `"${t.leaderBranch || ''}"`,
        `"${(t.projectTitle || '').replace(/"/g, '""')}"`
      ]);

      // Members rows
      (t.members || []).forEach((m) => {
        csvRows.push([
          `"${t.teamIdNo || 'N/A'}"`,
          `"${t.teamName || ''}"`,
          `"${t.timeSlot || 'TBA'}"`,
          `"${t.assignedJudge || 'Unassigned'}"`,
          `"Member"`,
          `"${m.name || ''}"`,
          `"${m.idNo || ''}"`,
          `"${m.email || ''}"`,
          `"${m.phone || ''}"`,
          `"${m.branch || ''}"`,
          `"${(t.projectTitle || '').replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', `Mecia_Hack_3.0_All_Students_Directory_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
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

  const cleanQuery = searchQuery.trim().toLowerCase();

  // Global search filter
  const searchMatchedTeams = teams.filter(t => {
    if (!cleanQuery) return true;

    if (t.teamIdNo && t.teamIdNo.toLowerCase().includes(cleanQuery)) return true;
    if (t.teamName && t.teamName.toLowerCase().includes(cleanQuery)) return true;
    if (t.projectType && t.projectType.toLowerCase().includes(cleanQuery)) return true;
    if (t.timeSlot && t.timeSlot.toLowerCase().includes(cleanQuery)) return true;
    if (t.assignedJudge && t.assignedJudge.toLowerCase().includes(cleanQuery)) return true;

    if (t.leaderName && t.leaderName.toLowerCase().includes(cleanQuery)) return true;
    if (t.leaderEmail && t.leaderEmail.toLowerCase().includes(cleanQuery)) return true;
    if (t.leaderId && t.leaderId.toLowerCase().includes(cleanQuery)) return true;
    if (t.leaderPhone && t.leaderPhone.toLowerCase().includes(cleanQuery)) return true;
    if (t.leaderBranch && t.leaderBranch.toLowerCase().includes(cleanQuery)) return true;

    if (t.projectTitle && t.projectTitle.toLowerCase().includes(cleanQuery)) return true;
    if (t.techStack && t.techStack.toLowerCase().includes(cleanQuery)) return true;

    if (t.members && t.members.some(m =>
      (m.name && m.name.toLowerCase().includes(cleanQuery)) ||
      (m.email && m.email.toLowerCase().includes(cleanQuery)) ||
      (m.idNo && m.idNo.toLowerCase().includes(cleanQuery)) ||
      (m.phone && m.phone.toLowerCase().includes(cleanQuery)) ||
      (m.branch && m.branch.toLowerCase().includes(cleanQuery))
    )) return true;

    return false;
  });

  // Calculate statistics
  const unassignedJudgeCount = searchMatchedTeams.filter(t => !t.assignedJudge || t.assignedJudge === 'Unassigned').length;
  const assignedJudgeCount = searchMatchedTeams.filter(t => t.assignedJudge && t.assignedJudge !== 'Unassigned').length;

  const tbaSlotCount = searchMatchedTeams.filter(t => t.timeSlot === 'TBA').length;
  const slot1Count = searchMatchedTeams.filter(t => t.timeSlot === '09:30 AM - 11:30 AM').length;
  const slot2Count = searchMatchedTeams.filter(t => t.timeSlot === '12:15 PM - 02:15 PM').length;
  const slot3Count = searchMatchedTeams.filter(t => t.timeSlot === '02:30 PM - 04:15 PM').length;
  const allocatedSlotCount = searchMatchedTeams.length - tbaSlotCount;

  return (
    <>
      <div className="scanlines"></div>

      <div className="admin-container">
        {/* Navigation Header */}
        <div className="nav-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
          {/* Top Left: Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 340px', maxWidth: '620px' }}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '12px', color: searchQuery ? 'var(--pacman-yellow, #fdff00)' : '#888', fontSize: '0.85rem', pointerEvents: 'none' }}>
                🔍
              </span>
              <input
                id="admin-search-input"
                type="text"
                placeholder="Search Team ID, Name, Leader, Judge, Slot (9:30, 12:15, 2:30, TBA)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 36px',
                  background: 'rgba(0, 0, 0, 0.88)',
                  border: searchQuery ? '2px solid var(--pacman-yellow, #fdff00)' : '2px solid var(--maze-blue, #2121ff)',
                  boxShadow: searchQuery ? '0 0 14px rgba(253, 255, 0, 0.4)' : '0 0 8px rgba(33, 33, 255, 0.25)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'rgba(255, 0, 85, 0.25)',
                    border: '1px solid #ff0055',
                    color: '#ff6699',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              className="eval-btn"
              onClick={() => {
                const el = document.getElementById('admin-search-input');
                if (el) el.focus();
              }}
              style={{
                padding: '10px 14px',
                fontSize: '0.62rem',
                whiteSpace: 'nowrap',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                background: searchQuery ? '#fdff00' : undefined,
                color: searchQuery ? '#000' : undefined
              }}
              title="Search teams, participants, time slots, or judges (Shortcut: Press '/')"
            >
              🔍 SEARCH
            </button>
          </div>

          {/* Top Right: User & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="student-hud-badge">
              <span className="ghost pink-ghost" style={{ width: '14px', height: '14px', display: 'inline-block' }}></span> ADMIN USER: <span>{adminUser}</span>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              🚪 LOG OUT
            </button>
          </div>
        </div>

        {/* Dashboard Title Header */}
        <div className="login-header text-left">
          <div className="badge-wrapper">
            <span className="role-badge admin-badge">STAGE 3: ADMIN CONTROL PANEL</span>
          </div>
          <h2>HACKATHON MASTER CONTROL</h2>
          <p>Allocate presentation time slots (9:30-11:30, 12:15-2:15, 2:30-4:15, TBA), assign judge panels, and monitor live evaluations.</p>
        </div>

        {/* Admin Master Control Frame */}
        <div className="admin-master-frame">
          {/* Section 1: Dashboard Navigation Views */}
          <div className="admin-frame-section">
            <div className="admin-frame-header">
              <div className="admin-frame-label">
                <span className="ghost cyan-ghost" style={{ width: '12px', height: '12px', display: 'inline-block' }}></span>
                <span>🕹️ DASHBOARD VIEWS & NAVIGATION</span>
              </div>
              <span style={{ color: '#888', fontSize: '0.58rem', fontFamily: 'Press Start 2P, monospace' }}>
                SELECT ACTIVE TAB
              </span>
            </div>
            <div className="admin-buttons-row admin-nav-grid">
              <button
                type="button"
                className={`admin-control-btn admin-tab-btn ${activeTab === 'teams-tab' ? 'active' : ''}`}
                onClick={() => setActiveTab('teams-tab')}
              >
                👥 TEAMS & JUDGES {cleanQuery ? `(${searchMatchedTeams.length})` : `(${teams.length})`}
              </button>
              <button
                type="button"
                className={`admin-control-btn admin-tab-btn schedule-tab-btn ${activeTab === 'schedule-tab' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedule-tab')}
              >
                📅 TIME SLOTS ({allocatedSlotCount}/{teams.length})
              </button>
              <button
                type="button"
                className={`admin-control-btn admin-tab-btn eval-highlight ${activeTab === 'scores-tab' ? 'active' : ''}`}
                onClick={() => setActiveTab('scores-tab')}
              >
                ⭐ LEADERBOARD
              </button>
              <button
                type="button"
                className={`admin-control-btn admin-tab-btn panels-tab-btn ${activeTab === 'panels-tab' ? 'active' : ''}`}
                onClick={() => setActiveTab('panels-tab')}
              >
                🏛️ JUDGES PANELS
              </button>
              <button
                type="button"
                className={`admin-control-btn admin-tab-btn ${activeTab === 'whitelist-tab' ? 'active' : ''}`}
                onClick={() => setActiveTab('whitelist-tab')}
              >
                🔐 OAUTH WHITELIST ({allowedUsers.length})
              </button>
            </div>
          </div>

          {/* Section 2: Master Exports & Print Dossiers */}
          <div className="admin-frame-section" style={{ borderTop: '1px solid rgba(33, 33, 255, 0.35)', paddingTop: '12px' }}>
            <div className="admin-frame-header">
              <div className="admin-frame-label action-label">
                <span className="ghost pink-ghost" style={{ width: '12px', height: '12px', display: 'inline-block' }}></span>
                <span>⚡ EXPORT DATA & PRINT DOSSIERS</span>
              </div>
              <span style={{ color: '#00ffcc', fontSize: '0.58rem', fontFamily: 'Press Start 2P, monospace' }}>
                EXCEL • CSV • A4 PRINT
              </span>
            </div>
            <div className="admin-buttons-row admin-export-grid">
              <button
                type="button"
                className="admin-control-btn admin-export-btn"
                onClick={() => setShowAttendanceModal(true)}
                title="Open attendance manager with live roster preview, filtering, printable A4 sheets, and Excel exports"
                style={{
                  background: 'linear-gradient(135deg, #00ffcc, #00bb99)',
                  border: '2px solid #00ffcc',
                  color: '#000',
                  fontWeight: 'bold',
                  boxShadow: '0 0 12px rgba(0, 255, 204, 0.3)'
                }}
              >
                📝 ATTENDANCE & SIGNATURES
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-green"
                onClick={handleExportAttendanceExcel}
                title="Download dedicated attendance Excel workbook (.xlsx) with student signature column"
              >
                📗 ATTENDANCE (.XLSX)
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-yellow-outline"
                onClick={() => handlePrintAttendance('by-panel')}
                title="Open printable student attendance sheets with signature lines and page-breaks for each lab room"
              >
                🖨️ PRINT ATTENDANCE (A4)
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-gold"
                onClick={handleExportScheduleExcel}
                title="Download dedicated Excel schedule workbook with sheets for each time slot"
              >
                📅 TIMETABLE (.XLSX)
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-yellow-outline"
                onClick={handlePrintSchedule}
                title="Open printable master timetable arranged by time slots on A4 landscape"
              >
                🖨️ PRINT TIMETABLE (A4)
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-green"
                onClick={() => setShowZipPanelsModal(true)}
                title="View all judges panels with allocated time slots and export separate sheets (.ZIP)"
              >
                {isExportingZip ? '⏳ PACKAGING ZIP...' : '📦 ALL PANELS ZIP'}
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-cyan"
                onClick={handleExportJudgesPanelsExcel}
                title="Download master multi-sheet workbook containing all panels"
              >
                📗 MASTER WORKBOOK (.XLSX)
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-emerald"
                onClick={exportCSV}
                title="Export spreadsheet with all teams, members, judge assignments, and time slots"
              >
                📊 MASTER CSV
              </button>
              <button
                type="button"
                className="admin-control-btn admin-export-btn btn-blue"
                onClick={exportStudentsDirectoryCSV}
                title="Export individual participant directory with time slots"
              >
                👥 PARTICIPANTS CSV
              </button>
            </div>
          </div>
        </div>

        {/* Active Search Notification Banner */}
        {cleanQuery && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(253, 255, 0, 0.08)',
            border: '1.5px solid rgba(253, 255, 0, 0.4)',
            boxShadow: '0 0 12px rgba(253, 255, 0, 0.15)',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '20px',
            fontSize: '0.68rem',
            color: '#fdff00',
            fontFamily: 'Press Start 2P, monospace',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>🔍 SEARCH FILTER:</span>
              <span style={{ color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fdff00' }}>
                &ldquo;{searchQuery}&rdquo;
              </span>
              <span style={{ color: '#00ffcc', fontSize: '0.62rem' }}>
                ({searchMatchedTeams.length} total team match{searchMatchedTeams.length === 1 ? '' : 'es'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: '#ff0055',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '0.58rem',
                fontFamily: 'Press Start 2P, monospace',
                cursor: 'pointer'
              }}
            >
              ✕ CLEAR FILTER
            </button>
          </div>
        )}

        {/* TAB 1: TEAMS, JUDGES & TIME SLOTS ALLOCATION */}
        {activeTab === 'teams-tab' && (() => {
          const filteredByJudge = teamsFilter === 'unassigned'
            ? searchMatchedTeams.filter(t => !t.assignedJudge || t.assignedJudge === 'Unassigned')
            : teamsFilter === 'assigned'
            ? searchMatchedTeams.filter(t => t.assignedJudge && t.assignedJudge !== 'Unassigned')
            : searchMatchedTeams;

          const displayedTeams = timeSlotFilter === 'all'
            ? filteredByJudge
            : filteredByJudge.filter(t => t.timeSlot === timeSlotFilter);

          const isAllDisplayedSelected = displayedTeams.length > 0 && displayedTeams.every(t => selectedTeamIds.includes(t.id));

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                {/* Header & Dual Filter Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                      <span className="pacman-bullet"></span> REGISTERED TEAMS & ALLOCATIONS
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px', margin: 0 }}>
                      Assign Judge Panels and Presentation Time Slots (9:30-11:30, 12:15-2:15, 2:30-4:15, or TBA) manually for each team.
                    </p>
                  </div>

                  {/* Summary Metric Counters Bar */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #444', borderRadius: '6px', padding: '6px 10px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#fff' }}>
                      TOTAL: <span style={{ color: '#00ffcc' }}>{teams.length}</span>
                    </div>
                    <div style={{ background: 'rgba(255, 184, 82, 0.12)', border: '1px solid #ffb852', borderRadius: '6px', padding: '6px 10px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#ffb852' }}>
                      ⏳ TBA SLOTS: <span style={{ fontWeight: 'bold' }}>{tbaSlotCount}</span>
                    </div>
                    <div style={{ background: 'rgba(0, 255, 204, 0.12)', border: '1px solid #00ffcc', borderRadius: '6px', padding: '6px 10px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#00ffcc' }}>
                      ⏰ SLOT 1 (9:30): <span>{slot1Count}</span>
                    </div>
                    <div style={{ background: 'rgba(253, 255, 0, 0.12)', border: '1px solid #fdff00', borderRadius: '6px', padding: '6px 10px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#fdff00' }}>
                      ⏰ SLOT 2 (12:15): <span>{slot2Count}</span>
                    </div>
                    <div style={{ background: 'rgba(255, 102, 204, 0.12)', border: '1px solid #ff66cc', borderRadius: '6px', padding: '6px 10px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#ff66cc' }}>
                      ⏰ SLOT 3 (2:30): <span>{slot3Count}</span>
                    </div>
                  </div>
                </div>

                {/* Filter Control Strips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: 'rgba(0, 0, 0, 0.5)', padding: '14px', borderRadius: '8px', border: '1px solid #222' }}>
                  {/* Row 1: Judge Assignment Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#888', minWidth: '120px' }}>
                      ⚖️ JUDGE FILTER:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setTeamsFilter('all')}
                        style={{
                          background: teamsFilter === 'all' ? '#fdff00' : 'rgba(0,0,0,0.6)',
                          color: teamsFilter === 'all' ? '#000' : '#fff',
                          border: '1px solid ' + (teamsFilter === 'all' ? '#fdff00' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        📋 ALL JUDGE STATES ({searchMatchedTeams.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeamsFilter('unassigned')}
                        style={{
                          background: teamsFilter === 'unassigned' ? '#ff0055' : 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          border: '1px solid ' + (teamsFilter === 'unassigned' ? '#ff0055' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⚠️ UNASSIGNED JUDGE ({unassignedJudgeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeamsFilter('assigned')}
                        style={{
                          background: teamsFilter === 'assigned' ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                          color: teamsFilter === 'assigned' ? '#000' : '#fff',
                          border: '1px solid ' + (teamsFilter === 'assigned' ? '#00ffcc' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        ✅ ASSIGNED JUDGE ({assignedJudgeCount})
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Time Slot Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', color: '#888', minWidth: '120px' }}>
                      ⏰ TIME SLOT:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setTimeSlotFilter('all')}
                        style={{
                          background: timeSlotFilter === 'all' ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                          color: timeSlotFilter === 'all' ? '#000' : '#fff',
                          border: '1px solid ' + (timeSlotFilter === 'all' ? '#00ffcc' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        ALL SLOTS ({searchMatchedTeams.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeSlotFilter('TBA')}
                        style={{
                          background: timeSlotFilter === 'TBA' ? '#ffb852' : 'rgba(0,0,0,0.6)',
                          color: timeSlotFilter === 'TBA' ? '#000' : '#ffb852',
                          border: '1.5px solid ' + (timeSlotFilter === 'TBA' ? '#ffb852' : '#555'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        ⏳ TBA / UNALLOCATED ({tbaSlotCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeSlotFilter('09:30 AM - 11:30 AM')}
                        style={{
                          background: timeSlotFilter === '09:30 AM - 11:30 AM' ? '#00ffcc' : 'rgba(0,0,0,0.6)',
                          color: timeSlotFilter === '09:30 AM - 11:30 AM' ? '#000' : '#00ffcc',
                          border: '1px solid ' + (timeSlotFilter === '09:30 AM - 11:30 AM' ? '#00ffcc' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⏰ 09:30 - 11:30 ({slot1Count})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeSlotFilter('12:15 PM - 02:15 PM')}
                        style={{
                          background: timeSlotFilter === '12:15 PM - 02:15 PM' ? '#fdff00' : 'rgba(0,0,0,0.6)',
                          color: timeSlotFilter === '12:15 PM - 02:15 PM' ? '#000' : '#fdff00',
                          border: '1px solid ' + (timeSlotFilter === '12:15 PM - 02:15 PM' ? '#fdff00' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⏰ 12:15 - 02:15 ({slot2Count})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeSlotFilter('02:30 PM - 04:15 PM')}
                        style={{
                          background: timeSlotFilter === '02:30 PM - 04:15 PM' ? '#ff66cc' : 'rgba(0,0,0,0.6)',
                          color: timeSlotFilter === '02:30 PM - 04:15 PM' ? '#000' : '#ff66cc',
                          border: '1px solid ' + (timeSlotFilter === '02:30 PM - 04:15 PM' ? '#ff66cc' : '#444'),
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⏰ 02:30 - 04:15 ({slot3Count})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bulk Action Toolbar (When teams are selected) */}
                {selectedTeamIds.length > 0 && (
                  <div style={{
                    background: 'rgba(33, 33, 255, 0.25)',
                    border: '2px solid var(--maze-blue, #2121ff)',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    boxShadow: '0 0 15px rgba(33, 33, 255, 0.4)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#fdff00', fontFamily: 'Press Start 2P, monospace', fontSize: '0.68rem', fontWeight: 'bold' }}>
                        ☑️ {selectedTeamIds.length} TEAMS SELECTED
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTeamIds([])}
                        style={{ background: 'transparent', border: '1px solid #777', color: '#bbb', borderRadius: '4px', padding: '4px 8px', fontSize: '0.58rem', fontFamily: 'Press Start 2P, monospace', cursor: 'pointer' }}
                      >
                        ✕ DESELECT
                      </button>
                    </div>

                    {/* Bulk Slot Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="retro-select"
                        value={bulkSlotChoice}
                        onChange={(e) => setBulkSlotChoice(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', width: 'auto' }}
                      >
                        {TIME_SLOT_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleBulkApplySlot}
                        disabled={isSavingBulk}
                        style={{
                          background: '#00ffcc',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.6rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {isSavingBulk ? 'SAVING...' : '⚡ ALLOCATE SLOT'}
                      </button>
                    </div>

                    {/* Bulk Judge Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="retro-select"
                        value={bulkJudgeChoice}
                        onChange={(e) => setBulkJudgeChoice(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.75rem', width: 'auto' }}
                      >
                        <option value="Unassigned">⚠️ Unassigned</option>
                        {Object.values(JUDGE_PROFILES).map(p => (
                          <option key={p.id} value={p.id}>{p.id} ({p.group})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleBulkApplyJudge}
                        disabled={isSavingBulk}
                        style={{
                          background: '#fdff00',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontFamily: 'Press Start 2P, monospace',
                          fontSize: '0.6rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {isSavingBulk ? 'SAVING...' : '⚡ ASSIGN JUDGE'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Main Teams Table */}
                {displayedTeams.length === 0 ? (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px dashed #444',
                    borderRadius: '10px',
                    padding: '30px',
                    textAlign: 'center',
                    color: '#aaa',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.7rem',
                    lineHeight: '1.8'
                  }}>
                    NO TEAMS FOUND MATCHING THE CURRENT FILTERS
                    <br />
                    <button
                      type="button"
                      onClick={() => {
                        setTeamsFilter('all');
                        setTimeSlotFilter('all');
                        setSearchQuery('');
                      }}
                      style={{
                        marginTop: '12px',
                        background: '#fdff00',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.6rem',
                        cursor: 'pointer'
                      }}
                    >
                      RESET ALL FILTERS
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="eval-table admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '4%', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isAllDisplayedSelected}
                              onChange={() => toggleSelectAllDisplayed(displayedTeams)}
                              title="Select/Deselect all displayed teams"
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                          </th>
                          <th style={{ width: '9%', textAlign: 'center' }}>Team ID</th>
                          <th style={{ width: '15%' }}>Team Name</th>
                          <th style={{ width: '22%' }}>Leader & Members</th>
                          <th style={{ width: '14%' }}>Project Title</th>
                          <th style={{ width: '15%' }}>Assign Judge Panel</th>
                          <th style={{ width: '13%' }}>Allocate Time Slot</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTeams.map(t => {
                          const judgeProfilesList = Object.values(JUDGE_PROFILES);
                          const validJudgeIds = judgeProfilesList.map(p => p.id);

                          const selectedJudgeVal = judgeSelections[t.id] !== undefined ? judgeSelections[t.id] : t.assignedJudge;
                          const isCustomJudge = selectedJudgeVal === 'CUSTOM' || (!validJudgeIds.includes(selectedJudgeVal) && selectedJudgeVal !== 'Unassigned');
                          const isAssignedJudge = t.assignedJudge && t.assignedJudge !== 'Unassigned';

                          const selectedSlotVal = timeSlotSelections[t.id] !== undefined ? timeSlotSelections[t.id] : t.timeSlot;
                          const slotInfo = getTimeSlotInfo(t.timeSlot);
                          const isSaving = assigningTeamId === t.id;
                          const isSelected = selectedTeamIds.includes(t.id);

                          return (
                            <tr key={t.id || t.teamName} style={{ background: isSelected ? 'rgba(33, 33, 255, 0.15)' : undefined }}>
                              {/* Checkbox */}
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectTeam(t.id)}
                                  style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                />
                              </td>

                              {/* Team ID */}
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1.5px solid #fdff00',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontFamily: 'Press Start 2P, monospace',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold',
                                  boxShadow: '0 0 8px rgba(253, 255, 0, 0.25)'
                                }}>
                                  {t.teamIdNo && t.teamIdNo !== 'N/A' ? t.teamIdNo : 'N/A'}
                                </span>
                                <div style={{ fontSize: '0.62rem', color: '#888', marginTop: '6px' }}>
                                  👥 {t.totalTeamSize || (1 + (t.members?.length || 0))} {t.totalTeamSize === 1 ? 'person' : 'members'}
                                </div>
                              </td>

                              {/* Team Name */}
                              <td className="criterion-name">
                                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{t.teamName}</strong>
                                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {/* Judge status badge */}
                                  {isAssignedJudge ? (
                                    <span style={{ fontSize: '0.55rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace' }}>
                                      🏛️ {t.assignedJudge}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.55rem', color: '#ff0055', fontFamily: 'Press Start 2P, monospace' }}>
                                      ⚠️ UNASSIGNED JUDGE
                                    </span>
                                  )}
                                  {/* Slot status badge */}
                                  <span style={{
                                    fontSize: '0.55rem',
                                    fontFamily: 'Press Start 2P, monospace',
                                    color: slotInfo.badgeColor,
                                    background: slotInfo.badgeBg,
                                    border: `1px solid ${slotInfo.badgeBorder}`,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                    width: 'fit-content'
                                  }}>
                                    {t.timeSlot === 'TBA' ? '⏳ SLOT: TBA' : `⏰ ${t.timeSlot}`}
                                  </span>
                                </div>
                              </td>

                              {/* Leader & Members */}
                              <td>
                                {/* Leader */}
                                <div style={{ background: 'rgba(253, 255, 0, 0.05)', border: '1px solid rgba(253, 255, 0, 0.3)', borderRadius: '6px', padding: '6px 8px', marginBottom: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ background: '#fdff00', color: '#000', borderRadius: '3px', padding: '1px 4px', fontSize: '0.55rem', fontWeight: 'bold', fontFamily: 'Press Start 2P, monospace' }}>LEADER</span>
                                    <strong style={{ color: '#fff', fontSize: '0.82rem' }}>{t.leaderName}</strong>
                                    {t.leaderBranch && <span style={{ color: '#00ffcc', fontSize: '0.7rem' }}>({t.leaderBranch})</span>}
                                  </div>
                                  <div style={{ color: '#ccc', fontSize: '0.72rem' }}>
                                    🆔 {t.leaderId} • 📞 <strong>{t.leaderPhone || 'N/A'}</strong>
                                  </div>
                                </div>

                                {/* Members */}
                                {t.members && t.members.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {t.members.map((m, mIdx) => (
                                      <div key={m.id || mIdx} style={{ background: 'rgba(0, 255, 204, 0.04)', borderLeft: '2px solid #00ffcc', borderRadius: '3px', padding: '3px 6px', fontSize: '0.7rem', color: '#bbb' }}>
                                        <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>M{mIdx+1}:</span> {m.name} ({m.idNo || 'N/A'}) - 📞 {m.phone || 'N/A'}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#777', fontSize: '0.68rem', fontStyle: 'italic' }}>• Solo Team</span>
                                )}
                              </td>

                              {/* Project Title */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                  {(() => {
                                    const typeInfo = getProjectTypeInfo(t.projectType);
                                    return (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '0.52rem',
                                        fontFamily: 'Press Start 2P, monospace',
                                        color: typeInfo.color,
                                        background: typeInfo.bg,
                                        border: `1px solid ${typeInfo.border}`,
                                        padding: '2px 5px',
                                        borderRadius: '3px'
                                      }}>
                                        {typeInfo.icon} {typeInfo.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 'bold' }}>{t.projectTitle || 'Untitled'}</div>
                                <small style={{ color: 'var(--text-muted)' }}>{t.techStack || '-'}</small>
                              </td>

                              {/* Assign Judge Panel Dropdown */}
                              <td>
                                <select
                                  className="retro-select admin-judge-select"
                                  value={isCustomJudge ? 'CUSTOM' : selectedJudgeVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setJudgeSelections(prev => ({ ...prev, [t.id]: val }));
                                    if (val === 'CUSTOM' && !customJudgeInputs[t.id]) {
                                      setCustomJudgeInputs(prev => ({ ...prev, [t.id]: t.assignedJudge !== 'Unassigned' ? t.assignedJudge : '' }));
                                    }
                                  }}
                                  style={{ padding: '6px 8px', fontSize: '0.75rem' }}
                                >
                                  <option value="Unassigned">⚠️ Unassigned</option>
                                  <optgroup label="── Round-2 Judge IDs (JM001 - JM011) ──">
                                    {judgeProfilesList.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.id} • {p.group}
                                      </option>
                                    ))}
                                  </optgroup>
                                  <option value="CUSTOM">✍️ Enter Custom Judge ID...</option>
                                </select>

                                {isCustomJudge && (
                                  <input
                                    type="text"
                                    placeholder="Judge ID / Email..."
                                    value={customJudgeInputs[t.id] !== undefined ? customJudgeInputs[t.id] : (validJudgeIds.includes(t.assignedJudge) ? '' : t.assignedJudge)}
                                    onChange={(e) => setCustomJudgeInputs(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    style={{
                                      marginTop: '4px',
                                      width: '100%',
                                      padding: '4px 8px',
                                      background: '#000',
                                      border: '1.5px solid var(--pacman-yellow)',
                                      borderRadius: '4px',
                                      color: '#fff',
                                      fontSize: '0.75rem'
                                    }}
                                  />
                                )}
                              </td>

                              {/* Allocate Time Slot Dropdown */}
                              <td>
                                <select
                                  className="retro-select"
                                  value={selectedSlotVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTimeSlotSelections(prev => ({ ...prev, [t.id]: val }));
                                  }}
                                  style={{
                                    padding: '6px 8px',
                                    fontSize: '0.75rem',
                                    borderColor: selectedSlotVal === 'TBA' ? '#ffb852' : '#00ffcc',
                                    color: selectedSlotVal === 'TBA' ? '#ffb852' : '#00ffcc'
                                  }}
                                >
                                  {TIME_SLOT_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Action Save Button */}
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="eval-btn edit-btn"
                                  style={{ padding: '8px 12px', fontSize: '0.68rem', opacity: isSaving ? 0.6 : 1 }}
                                  disabled={isSaving}
                                  onClick={() => handleSaveTeam(t.id, t.teamName)}
                                  title="Save Judge Panel and Time Slot for this team"
                                >
                                  {isSaving ? 'SAVING...' : '💾 SAVE'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 2: TIME SLOTS & MASTER PRESENTATION TIMETABLE */}
        {activeTab === 'schedule-tab' && (() => {
          const tbaTeams = searchMatchedTeams.filter(t => t.timeSlot === 'TBA');
          const slot1Teams = searchMatchedTeams.filter(t => t.timeSlot === '09:30 AM - 11:30 AM');
          const slot2Teams = searchMatchedTeams.filter(t => t.timeSlot === '12:15 PM - 02:15 PM');
          const slot3Teams = searchMatchedTeams.filter(t => t.timeSlot === '02:30 PM - 04:15 PM');

          const slotSections = [
            {
              id: 'SLOT_1',
              title: 'SLOT 1: 09:30 AM — 11:30 AM (MORNING SESSION)',
              slotVal: '09:30 AM - 11:30 AM',
              color: '#00ffcc',
              bg: 'rgba(0, 255, 204, 0.08)',
              border: '2px solid #00ffcc',
              teams: slot1Teams
            },
            {
              id: 'SLOT_2',
              title: 'SLOT 2: 12:15 PM — 02:15 PM (AFTERNOON SESSION)',
              slotVal: '12:15 PM - 02:15 PM',
              color: '#fdff00',
              bg: 'rgba(253, 255, 0, 0.08)',
              border: '2px solid #fdff00',
              teams: slot2Teams
            },
            {
              id: 'SLOT_3',
              title: 'SLOT 3: 02:30 PM — 04:15 PM (LATE AFTERNOON SESSION)',
              slotVal: '02:30 PM - 04:15 PM',
              color: '#ff66cc',
              bg: 'rgba(255, 102, 204, 0.08)',
              border: '2px solid #ff66cc',
              teams: slot3Teams
            },
            {
              id: 'TBA',
              title: '⏳ TBA: PENDING TIME SLOT ALLOCATION',
              slotVal: 'TBA',
              color: '#ffb852',
              bg: 'rgba(255, 184, 82, 0.08)',
              border: '2px dashed #ffb852',
              teams: tbaTeams
            }
          ];

          const displayedSections = scheduleViewSlot === 'all'
            ? slotSections
            : slotSections.filter(s => s.slotVal === scheduleViewSlot);

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                {/* Header Banner */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '24px',
                  background: 'rgba(253, 255, 0, 0.06)',
                  border: '2px solid rgba(253, 255, 0, 0.3)',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  boxShadow: '0 0 15px rgba(253, 255, 0, 0.1)'
                }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0, color: '#fdff00', fontSize: '0.9rem' }}>
                      <span className="pacman-bullet" style={{ background: '#fdff00' }}></span> 📅 PRESENTATION TIME SLOTS & TIMETABLE
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px', margin: 0 }}>
                      Manage scheduled presentations across the 3 official hackathon slots (9:30-11:30, 12:15-2:15, 2:30-4:15) and allocate pending TBA teams.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleAutoSplitAllPanels}
                      disabled={isAutoSplitting}
                      style={{
                        background: 'linear-gradient(135deg, #00ffcc, #00bb99)',
                        border: '2px solid #00ffcc',
                        color: '#000',
                        padding: '10px 16px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold',
                        boxShadow: '0 0 12px rgba(0, 255, 204, 0.4)'
                      }}
                      title="Automatically balance all teams within their assigned judge panels into equal batches across Slot 1, Slot 2, and Slot 3 (4-4-4 split)"
                    >
                      {isAutoSplitting ? `⏳ ${autoSplitProgress || 'ALLOCATING...'}` : '⚡ AUTO-SPLIT ALL PANELS (4-4-4)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportScheduleExcel}
                      style={{
                        background: 'linear-gradient(135deg, #b8860b, #e6b800)',
                        border: '2px solid #fdff00',
                        color: '#000',
                        padding: '10px 16px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold'
                      }}
                      title="Download dedicated Excel workbook organized by time slots"
                    >
                      📥 EXPORT SCHEDULE (.XLSX)
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintSchedule}
                      style={{
                        background: 'rgba(253, 255, 0, 0.15)',
                        border: '2px solid #fdff00',
                        color: '#fdff00',
                        padding: '10px 16px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Open printable master timetable on A4 landscape"
                    >
                      🖨️ PRINT TIMETABLE (A4)
                    </button>
                  </div>
                </div>

                {/* 4 Stat Metric Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <div
                    onClick={() => setScheduleViewSlot(scheduleViewSlot === 'TBA' ? 'all' : 'TBA')}
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: `2px solid ${scheduleViewSlot === 'TBA' ? '#ffb852' : 'rgba(255, 184, 82, 0.4)'}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: scheduleViewSlot === 'TBA' ? '0 0 12px rgba(255, 184, 82, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.58rem', color: '#ffb852', fontFamily: 'Press Start 2P, monospace', marginBottom: '6px' }}>⏳ TBA / UNALLOCATED</div>
                    <div style={{ fontSize: '1.6rem', color: '#ffb852', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>{tbaTeams.length} Teams</div>
                    <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: '4px' }}>Click to filter</div>
                  </div>

                  <div
                    onClick={() => setScheduleViewSlot(scheduleViewSlot === '09:30 AM - 11:30 AM' ? 'all' : '09:30 AM - 11:30 AM')}
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: `2px solid ${scheduleViewSlot === '09:30 AM - 11:30 AM' ? '#00ffcc' : 'rgba(0, 255, 204, 0.4)'}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: scheduleViewSlot === '09:30 AM - 11:30 AM' ? '0 0 12px rgba(0, 255, 204, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.58rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace', marginBottom: '6px' }}>⏰ SLOT 1 (9:30 - 11:30)</div>
                    <div style={{ fontSize: '1.6rem', color: '#00ffcc', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>{slot1Teams.length} Teams</div>
                    <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: '4px' }}>Click to filter</div>
                  </div>

                  <div
                    onClick={() => setScheduleViewSlot(scheduleViewSlot === '12:15 PM - 02:15 PM' ? 'all' : '12:15 PM - 02:15 PM')}
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: `2px solid ${scheduleViewSlot === '12:15 PM - 02:15 PM' ? '#fdff00' : 'rgba(253, 255, 0, 0.4)'}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: scheduleViewSlot === '12:15 PM - 02:15 PM' ? '0 0 12px rgba(253, 255, 0, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.58rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace', marginBottom: '6px' }}>⏰ SLOT 2 (12:15 - 2:15)</div>
                    <div style={{ fontSize: '1.6rem', color: '#fdff00', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>{slot2Teams.length} Teams</div>
                    <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: '4px' }}>Click to filter</div>
                  </div>

                  <div
                    onClick={() => setScheduleViewSlot(scheduleViewSlot === '02:30 PM - 04:15 PM' ? 'all' : '02:30 PM - 04:15 PM')}
                    style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: `2px solid ${scheduleViewSlot === '02:30 PM - 04:15 PM' ? '#ff66cc' : 'rgba(255, 102, 204, 0.4)'}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: scheduleViewSlot === '02:30 PM - 04:15 PM' ? '0 0 12px rgba(255, 102, 204, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.58rem', color: '#ff66cc', fontFamily: 'Press Start 2P, monospace', marginBottom: '6px' }}>⏰ SLOT 3 (2:30 - 4:15)</div>
                    <div style={{ fontSize: '1.6rem', color: '#ff66cc', fontWeight: 'bold', fontFamily: 'Outfit, sans-serif' }}>{slot3Teams.length} Teams</div>
                    <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: '4px' }}>Click to filter</div>
                  </div>
                </div>

                {/* Slot Filter Indicator */}
                {scheduleViewSlot !== 'all' && (
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.06)', padding: '8px 14px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'Press Start 2P, monospace', color: '#fdff00' }}>
                      🔎 VIEWING ONLY: {scheduleViewSlot}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScheduleViewSlot('all')}
                      style={{ background: '#ff0055', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.55rem', fontFamily: 'Press Start 2P, monospace', cursor: 'pointer' }}
                    >
                      ✕ SHOW ALL SLOTS
                    </button>
                  </div>
                )}

                {/* Four Slot Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {displayedSections.map(section => {
                    const isTba = section.slotVal === 'TBA';

                    return (
                      <div
                        key={section.id}
                        style={{
                          background: 'rgba(10, 10, 20, 0.95)',
                          border: section.border,
                          borderRadius: '10px',
                          padding: '18px 20px',
                          boxShadow: `0 0 15px ${section.bg}`
                        }}
                      >
                        {/* Section Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              background: section.color,
                              color: '#000',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontFamily: 'Press Start 2P, monospace',
                              fontSize: '0.68rem',
                              fontWeight: 'bold'
                            }}>
                              {section.id}
                            </span>
                            <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>
                              {section.title}
                            </span>
                          </div>
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: section.color,
                            border: `1px solid ${section.color}`,
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontFamily: 'Press Start 2P, monospace',
                            fontSize: '0.62rem'
                          }}>
                            👥 {section.teams.length} {section.teams.length === 1 ? 'TEAM' : 'TEAMS'}
                          </span>
                        </div>

                        {/* Section Body */}
                        {section.teams.length === 0 ? (
                          <div style={{
                            padding: '20px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '6px',
                            border: '1px dashed #444',
                            color: '#777',
                            fontSize: '0.72rem',
                            textAlign: 'center',
                            fontFamily: 'Press Start 2P, monospace'
                          }}>
                            {isTba ? '🎉 ALL TEAMS HAVE BEEN ALLOCATED A PRESENTATION TIME SLOT!' : `NO TEAMS ALLOCATED TO THIS TIME SLOT YET`}
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="eval-table admin-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '4%', textAlign: 'center' }}>#</th>
                                  <th style={{ width: '9%', textAlign: 'center' }}>Team ID</th>
                                  <th style={{ width: '18%' }}>Team Name</th>
                                  <th style={{ width: '18%' }}>Judge Panel & Room</th>
                                  <th style={{ width: '20%' }}>Leader Contact</th>
                                  <th style={{ width: '15%' }}>Project Title</th>
                                  <th style={{ width: '16%', textAlign: 'center' }}>
                                    {isTba ? '⚡ One-Click Allocate Slot' : 'Reassign Slot'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {section.teams.map((t, idx) => {
                                  const panelProfile = JUDGE_PROFILES[(t.assignedJudge || '').toUpperCase()];
                                  const isAssignedJudge = t.assignedJudge && t.assignedJudge !== 'Unassigned';
                                  const isSlotSaving = savingSlotTeamId === t.id;

                                  return (
                                    <tr key={t.id || idx}>
                                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                          display: 'inline-block',
                                          background: 'rgba(253, 255, 0, 0.15)',
                                          color: '#fdff00',
                                          border: '1px solid #fdff00',
                                          borderRadius: '4px',
                                          padding: '3px 6px',
                                          fontFamily: 'Press Start 2P, monospace',
                                          fontSize: '0.62rem',
                                          fontWeight: 'bold'
                                        }}>
                                          {t.teamIdNo && t.teamIdNo !== 'N/A' ? t.teamIdNo : 'N/A'}
                                        </span>
                                      </td>
                                      <td>
                                        <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{t.teamName}</strong>
                                      </td>
                                      <td>
                                        {isAssignedJudge ? (
                                          <div>
                                            <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '0.82rem' }}>
                                              🏛️ {panelProfile ? `${panelProfile.id} (${panelProfile.group})` : t.assignedJudge}
                                            </div>
                                            <div style={{ color: '#fdff00', fontSize: '0.72rem' }}>
                                              📍 {panelProfile?.location || 'Assigned Room'}
                                            </div>
                                          </div>
                                        ) : (
                                          <span style={{ color: '#ff0055', fontSize: '0.68rem', fontFamily: 'Press Start 2P, monospace' }}>
                                            ⚠️ UNASSIGNED JUDGE
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        <div style={{ color: '#fff', fontSize: '0.8rem' }}>{t.leaderName}</div>
                                        <div style={{ color: '#aaa', fontSize: '0.72rem' }}>📞 {t.leaderPhone || 'N/A'}</div>
                                      </td>
                                      <td>
                                        <div style={{ color: '#ccc', fontSize: '0.78rem' }}>{t.projectTitle || 'Untitled'}</div>
                                      </td>

                                      {/* Slot Allocation Actions */}
                                      <td style={{ textAlign: 'center' }}>
                                        {isTba ? (
                                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickSlotChange(t.id, t.teamName, '09:30 AM - 11:30 AM')}
                                              disabled={isSlotSaving}
                                              style={{
                                                background: 'rgba(0, 255, 204, 0.2)',
                                                border: '1px solid #00ffcc',
                                                color: '#00ffcc',
                                                borderRadius: '4px',
                                                padding: '4px 6px',
                                                fontSize: '0.55rem',
                                                fontFamily: 'Press Start 2P, monospace',
                                                cursor: 'pointer'
                                              }}
                                              title="Allocate to 09:30 AM - 11:30 AM"
                                            >
                                              + 9:30
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickSlotChange(t.id, t.teamName, '12:15 PM - 02:15 PM')}
                                              disabled={isSlotSaving}
                                              style={{
                                                background: 'rgba(253, 255, 0, 0.2)',
                                                border: '1px solid #fdff00',
                                                color: '#fdff00',
                                                borderRadius: '4px',
                                                padding: '4px 6px',
                                                fontSize: '0.55rem',
                                                fontFamily: 'Press Start 2P, monospace',
                                                cursor: 'pointer'
                                              }}
                                              title="Allocate to 12:15 PM - 02:15 PM"
                                            >
                                              + 12:15
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickSlotChange(t.id, t.teamName, '02:30 PM - 04:15 PM')}
                                              disabled={isSlotSaving}
                                              style={{
                                                background: 'rgba(255, 102, 204, 0.2)',
                                                border: '1px solid #ff66cc',
                                                color: '#ff66cc',
                                                borderRadius: '4px',
                                                padding: '4px 6px',
                                                fontSize: '0.55rem',
                                                fontFamily: 'Press Start 2P, monospace',
                                                cursor: 'pointer'
                                              }}
                                              title="Allocate to 02:30 PM - 04:15 PM"
                                            >
                                              + 2:30
                                            </button>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                            <select
                                              className="retro-select"
                                              value={t.timeSlot}
                                              onChange={(e) => handleQuickSlotChange(t.id, t.teamName, e.target.value)}
                                              disabled={isSlotSaving}
                                              style={{ padding: '4px 6px', fontSize: '0.7rem', width: 'auto' }}
                                            >
                                              {TIME_SLOT_OPTIONS.map(opt => (
                                                <option key={opt.id} value={opt.value}>{opt.shortLabel}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 3: LIVE EVALUATION LEADERBOARD */}
        {activeTab === 'scores-tab' && (() => {
          const leaderboardData = teams.map(t => {
            const evalEntry = evaluations.find(e => (e.teamName || '').trim().toLowerCase() === (t.teamName || '').trim().toLowerCase());
            let isScored = false;
            let score = 0;
            let c1 = '-', c2 = '-', c3 = '-', c4 = '-', c5 = '-', remarks = 'Evaluation pending';
            let judge = t.assignedJudge || 'Unassigned';

            if (evalEntry) {
              isScored = true;
              score = Number(evalEntry.totalScore) || 0;
              c1 = evalEntry.c1;
              c2 = evalEntry.c2;
              c3 = evalEntry.c3;
              c4 = evalEntry.c4;
              c5 = evalEntry.c5;
              remarks = evalEntry.remarks || 'Scored';
              if (evalEntry.judgeEmail) judge = evalEntry.judgeEmail;
            }

            return {
              ...t,
              projectType: t.projectType || parseProjectTypeFromTeam(t),
              isScored,
              score,
              c1, c2, c3, c4, c5,
              remarks,
              judge
            };
          }).sort((a, b) => {
            if (a.isScored && b.isScored) return b.score - a.score;
            if (a.isScored && !b.isScored) return -1;
            if (!a.isScored && b.isScored) return 1;
            return 0;
          });

          const totalLbCount = leaderboardData.length;
          const softwareLbCount = leaderboardData.filter(item => (item.projectType || '').toLowerCase() === 'software').length;
          const hybridLbCount = leaderboardData.filter(item => (item.projectType || '').toLowerCase() === 'hybrid').length;
          const hardwareLbCount = leaderboardData.filter(item => (item.projectType || '').toLowerCase() === 'hardware').length;

          const filteredByType = leaderboardData.filter(item => {
            if (leaderboardTypeFilter === 'all') return true;
            return (item.projectType || '').toLowerCase() === leaderboardTypeFilter.toLowerCase();
          });

          const displayedLeaderboard = filteredByType.filter(item => {
            if (!cleanQuery) return true;
            if (item.teamIdNo && item.teamIdNo.toLowerCase().includes(cleanQuery)) return true;
            if (item.teamName && item.teamName.toLowerCase().includes(cleanQuery)) return true;
            if (item.projectType && item.projectType.toLowerCase().includes(cleanQuery)) return true;
            if (item.timeSlot && item.timeSlot.toLowerCase().includes(cleanQuery)) return true;
            if (item.judge && item.judge.toLowerCase().includes(cleanQuery)) return true;
            if (item.leaderName && item.leaderName.toLowerCase().includes(cleanQuery)) return true;
            if (item.leaderId && item.leaderId.toLowerCase().includes(cleanQuery)) return true;
            if (item.leaderBranch && item.leaderBranch.toLowerCase().includes(cleanQuery)) return true;
            if (item.projectTitle && item.projectTitle.toLowerCase().includes(cleanQuery)) return true;
            if (item.remarks && item.remarks.toLowerCase().includes(cleanQuery)) return true;
            if (item.score !== undefined && String(item.score).includes(cleanQuery)) return true;
            if (item.members && item.members.some(m =>
              (m.name && m.name.toLowerCase().includes(cleanQuery)) ||
              (m.idNo && m.idNo.toLowerCase().includes(cleanQuery)) ||
              (m.email && m.email.toLowerCase().includes(cleanQuery))
            )) return true;
            return false;
          });

          const totalDisplayedParticipants = displayedLeaderboard.reduce((sum, item) => sum + (item.totalTeamSize || (1 + (item.members?.length || 0))), 0);

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    <span className="pacman-bullet"></span> LIVE EVALUATION LEADERBOARD (RANKED BY HIGHEST SCORE)
                  </h3>
                  <span className="status-pill status-completed" style={{ background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', border: '1px solid #00ffcc', fontFamily: 'Press Start 2P, monospace', fontSize: '0.58rem', padding: '6px 12px' }}>
                    🔴 LIVE REAL-TIME SYNC (3S POLL)
                  </span>
                </div>

                {/* Project Type Filter Controls & Summary Stats */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '20px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <span style={{ fontSize: '0.62rem', color: '#aaa', fontFamily: 'Press Start 2P, monospace', marginRight: '4px' }}>
                    TRACK / TYPE:
                  </span>
                  <button
                    type="button"
                    onClick={() => setLeaderboardTypeFilter('all')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.58rem',
                      fontFamily: 'Press Start 2P, monospace',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: leaderboardTypeFilter === 'all' ? 'rgba(253, 255, 0, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: leaderboardTypeFilter === 'all' ? '#fdff00' : '#888',
                      border: leaderboardTypeFilter === 'all' ? '1.5px solid #fdff00' : '1px solid #444',
                      boxShadow: leaderboardTypeFilter === 'all' ? '0 0 10px rgba(253, 255, 0, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ALL TRACKS ({totalLbCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardTypeFilter('software')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.58rem',
                      fontFamily: 'Press Start 2P, monospace',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: leaderboardTypeFilter === 'software' ? 'rgba(0, 255, 204, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: leaderboardTypeFilter === 'software' ? '#00ffcc' : '#888',
                      border: leaderboardTypeFilter === 'software' ? '1.5px solid #00ffcc' : '1px solid #444',
                      boxShadow: leaderboardTypeFilter === 'software' ? '0 0 10px rgba(0, 255, 204, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    💻 SOFTWARE ({softwareLbCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardTypeFilter('hybrid')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.58rem',
                      fontFamily: 'Press Start 2P, monospace',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: leaderboardTypeFilter === 'hybrid' ? 'rgba(255, 102, 204, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: leaderboardTypeFilter === 'hybrid' ? '#ff66cc' : '#888',
                      border: leaderboardTypeFilter === 'hybrid' ? '1.5px solid #ff66cc' : '1px solid #444',
                      boxShadow: leaderboardTypeFilter === 'hybrid' ? '0 0 10px rgba(255, 102, 204, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ⚡ HYBRID ({hybridLbCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardTypeFilter('hardware')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.58rem',
                      fontFamily: 'Press Start 2P, monospace',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: leaderboardTypeFilter === 'hardware' ? 'rgba(255, 184, 82, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: leaderboardTypeFilter === 'hardware' ? '#ffb852' : '#888',
                      border: leaderboardTypeFilter === 'hardware' ? '1.5px solid #ffb852' : '1px solid #444',
                      boxShadow: leaderboardTypeFilter === 'hardware' ? '0 0 10px rgba(255, 184, 82, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ⚙️ HARDWARE ({hardwareLbCount})
                  </button>

                  <div style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(0, 255, 204, 0.12)',
                    border: '1px solid #00ffcc',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontFamily: 'Press Start 2P, monospace',
                    fontSize: '0.58rem',
                    color: '#00ffcc',
                    boxShadow: '0 0 10px rgba(0, 255, 204, 0.2)'
                  }}>
                    👥 TOTAL MEMBERS: <span style={{ color: '#fdff00', fontWeight: 'bold' }}>{totalDisplayedParticipants}</span> (INCL. LEADERS)
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="eval-table admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '5%', textAlign: 'center' }}>Rank</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>Team ID</th>
                        <th style={{ width: '13%' }}>Team Name</th>
                        <th style={{ width: '14%' }}>Total Members</th>
                        <th style={{ width: '9%', textAlign: 'center' }}>Project Type</th>
                        <th style={{ width: '10%' }}>Time Slot</th>
                        <th style={{ width: '11%' }}>Assigned Judge</th>
                        <th style={{ textAlign: 'center' }}>Arch (10)</th>
                        <th style={{ textAlign: 'center' }}>Scope (10)</th>
                        <th style={{ textAlign: 'center' }}>Avail (10)</th>
                        <th style={{ textAlign: 'center' }}>Timeline (10)</th>
                        <th style={{ textAlign: 'center' }}>Impl (10)</th>
                        <th style={{ textAlign: 'center', width: '8%' }}>Total (50)</th>
                        <th style={{ width: '6%' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan="14" style={{ textAlign: 'center', color: cleanQuery || leaderboardTypeFilter !== 'all' ? '#ff6699' : 'var(--text-muted)', padding: '32px 16px' }}>
                            No evaluations found matching the selected filter or search query.
                          </td>
                        </tr>
                      ) : (
                        displayedLeaderboard.map((item, index) => {
                          let rankBadge = '-';
                          let rowBg = undefined;

                          if (item.isScored) {
                            if (index === 0) {
                              rankBadge = '🥇 1ST';
                              rowBg = 'rgba(253, 255, 0, 0.08)';
                            } else if (index === 1) {
                              rankBadge = '🥈 2ND';
                              rowBg = 'rgba(224, 224, 224, 0.06)';
                            } else if (index === 2) {
                              rankBadge = '🥉 3RD';
                              rowBg = 'rgba(205, 127, 50, 0.06)';
                            } else {
                              rankBadge = `#${index + 1}`;
                            }
                          }

                          const slotInfo = getTimeSlotInfo(item.timeSlot);
                          const typeInfo = getProjectTypeInfo(item.projectType);
                          const totalMembersCount = item.totalTeamSize || (1 + (item.members?.length || 0));
                          const hasMembers = item.members && item.members.length > 0;

                          return (
                            <tr key={item.id || item.teamName} style={{ background: rowBg }}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: index === 0 && item.isScored ? '#fdff00' : index === 1 && item.isScored ? '#e0e0e0' : index === 2 && item.isScored ? '#cd7f32' : '#fff' }}>
                                {rankBadge}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  background: 'rgba(253, 255, 0, 0.15)',
                                  color: '#fdff00',
                                  border: '1.5px solid #fdff00',
                                  borderRadius: '6px',
                                  padding: '3px 6px',
                                  fontFamily: 'Press Start 2P, monospace',
                                  fontSize: '0.62rem',
                                  fontWeight: 'bold'
                                }}>
                                  {item.teamIdNo && item.teamIdNo !== 'N/A' ? item.teamIdNo : 'N/A'}
                                </span>
                              </td>
                              <td className="criterion-name">
                                <span style={{ fontWeight: 'bold', color: '#fff' }}>{item.teamName}</span>
                                {index === 0 && item.isScored && <span style={{ marginLeft: '6px', fontSize: '0.75rem' }}>👑</span>}
                                {item.projectTitle && (
                                  <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px', fontWeight: 'normal' }}>
                                    {item.projectTitle}
                                  </div>
                                )}
                              </td>
                              {/* Total Team Members (including Team Leader) */}
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: 'rgba(0, 255, 204, 0.15)',
                                      color: '#00ffcc',
                                      border: '1px solid #00ffcc',
                                      borderRadius: '4px',
                                      padding: '3px 6px',
                                      fontFamily: 'Press Start 2P, monospace',
                                      fontSize: '0.55rem',
                                      fontWeight: 'bold'
                                    }}>
                                      👥 {totalMembersCount} {totalMembersCount === 1 ? 'MEMBER' : 'MEMBERS'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#fff', lineHeight: '1.3' }}>
                                    <span style={{ color: '#fdff00', fontWeight: 'bold' }}>👑 {item.leaderName || 'Leader'}</span>
                                    {item.leaderBranch && <span style={{ color: '#888', fontSize: '0.65rem' }}> ({item.leaderBranch})</span>}
                                  </div>
                                  {hasMembers ? (
                                    <div style={{ fontSize: '0.68rem', color: '#aaa', lineHeight: '1.3' }}>
                                      <span style={{ color: '#00ffcc' }}>+{item.members.length} {item.members.length === 1 ? 'member' : 'members'}:</span> {item.members.map(m => m.name).filter(Boolean).join(', ')}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.62rem', color: '#666', fontStyle: 'italic' }}>
                                      • Solo (Leader Only)
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.56rem',
                                  fontFamily: 'Press Start 2P, monospace',
                                  color: typeInfo.color,
                                  background: typeInfo.bg,
                                  border: `1px solid ${typeInfo.border}`,
                                  padding: '3px 6px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                  fontWeight: 'bold'
                                }}>
                                  <span>{typeInfo.icon}</span>
                                  <span>{typeInfo.label}</span>
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '0.55rem',
                                  fontFamily: 'Press Start 2P, monospace',
                                  color: slotInfo.badgeColor,
                                  background: slotInfo.badgeBg,
                                  border: `1px solid ${slotInfo.badgeBorder}`,
                                  padding: '2px 5px',
                                  borderRadius: '3px',
                                  display: 'inline-block'
                                }}>
                                  {item.timeSlot === 'TBA' ? 'TBA' : item.timeSlot}
                                </span>
                              </td>
                              <td>{item.judge}</td>
                              <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c1}</td>
                              <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c2}</td>
                              <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c3}</td>
                              <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c4}</td>
                              <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--inky-cyan)' }}>{item.c5}</td>
                              <td style={{ textAlign: 'center', fontWeight: '800', fontSize: '1.1rem', color: item.isScored ? '#fdff00' : 'var(--text-muted)' }}>
                                {item.isScored ? `${item.score} / 50` : '- / 50'}
                              </td>
                              <td>
                                {item.isScored ? (
                                  <span className="status-pill status-completed">SCORED</span>
                                ) : (
                                  <span className="status-pill status-pending">PENDING</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 4: JUDGES PANELS & ASSIGNED TEAMS */}
        {activeTab === 'panels-tab' && (() => {
          const knownPanels = Object.values(JUDGE_PROFILES);
          
          const panelMap = {};
          knownPanels.forEach(p => {
            panelMap[p.id.toUpperCase()] = {
              profile: p,
              teams: []
            };
          });

          const customPanelsMap = {};
          const unassignedTeams = [];

          teams.forEach(t => {
            const rawJudge = (t.assignedJudge || '').trim();
            const upperJudge = rawJudge.toUpperCase();

            if (!rawJudge || rawJudge.toLowerCase() === 'unassigned') {
              unassignedTeams.push(t);
            } else if (panelMap[upperJudge]) {
              panelMap[upperJudge].teams.push(t);
            } else {
              if (!customPanelsMap[rawJudge]) {
                customPanelsMap[rawJudge] = {
                  profile: {
                    id: rawJudge,
                    group: 'Custom Judge',
                    names: [rawJudge],
                    namesText: rawJudge,
                    location: 'Assigned by Admin'
                  },
                  teams: []
                };
              }
              customPanelsMap[rawJudge].teams.push(t);
            }
          });

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                {/* Header Banner */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '24px',
                  background: 'rgba(0, 255, 102, 0.06)',
                  border: '2px solid rgba(0, 255, 102, 0.3)',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  boxShadow: '0 0 15px rgba(0, 255, 102, 0.1)'
                }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0, color: '#00ff66', fontSize: '0.9rem' }}>
                      <span className="pacman-bullet" style={{ background: '#00ff66' }}></span> 🏛️ JUDGES PANELS & ASSIGNED TEAMS DOSSIER
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px', margin: 0 }}>
                      View all judging panels (JM001 - JM011), faculty evaluators, room venues, and allocated teams with presentation time slots.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleAutoSplitAllPanels}
                      disabled={isAutoSplitting}
                      style={{
                        background: 'linear-gradient(135deg, #00ffcc, #00bb99)',
                        border: '2px solid #00ffcc',
                        color: '#000',
                        padding: '12px 18px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'bold',
                        boxShadow: '0 0 15px rgba(0, 255, 204, 0.4)'
                      }}
                      title="Automatically balance all teams within every judge panel into equal 4-4-4 batches for Slot 1, Slot 2, and Slot 3"
                    >
                      {isAutoSplitting ? `⏳ ${autoSplitProgress || 'ALLOCATING...'}` : '⚡ 1-CLICK AUTO-SPLIT (4-4-4)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJudgesPanelsExcel}
                      style={{
                        background: 'linear-gradient(135deg, #b8860b, #e6b800)',
                        border: '2px solid #fdff00',
                        color: '#000',
                        padding: '12px 18px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'bold'
                      }}
                      title="Download comprehensive Excel workbook with Master Timetable, Dedicated Time Slot sheets, Panels Summary, and all Panel Dossiers"
                    >
                      📥 MASTER PANELS & SLOTS (.XLSX)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowZipPanelsModal(true)}
                      style={{
                        background: 'linear-gradient(135deg, #107c41, #1e8e3e)',
                        border: '2px solid #00ff66',
                        color: '#fff',
                        padding: '12px 18px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 0 15px rgba(0, 255, 102, 0.4)',
                        fontWeight: 'bold'
                      }}
                      title="View all judge panels with allocated time slots and download separate individual .xlsx files (.ZIP)"
                    >
                      {isExportingZip ? '⏳ PACKAGING ZIP...' : '📦 DOWNLOAD ALL SEPARATE SHEETS (.ZIP)'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintAllPanels}
                      style={{
                        background: 'rgba(253, 255, 0, 0.15)',
                        border: '2px solid #fdff00',
                        color: '#fdff00',
                        padding: '12px 18px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 'bold'
                      }}
                      title="Open print view to print all 11 panel sheets on A4 landscape"
                    >
                      🖨️ PRINT ALL 11 PANELS (A4)
                    </button>
                  </div>
                </div>

                {/* List of Judges Panels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {knownPanels.map(panel => {
                    const assignedList = panelMap[panel.id.toUpperCase()].teams;
                    const matchesSearch = !cleanQuery || 
                      panel.id.toLowerCase().includes(cleanQuery) ||
                      panel.group.toLowerCase().includes(cleanQuery) ||
                      panel.location.toLowerCase().includes(cleanQuery) ||
                      panel.namesText.toLowerCase().includes(cleanQuery) ||
                      assignedList.some(t => 
                        (t.teamName && t.teamName.toLowerCase().includes(cleanQuery)) ||
                        (t.teamIdNo && t.teamIdNo.toLowerCase().includes(cleanQuery)) ||
                        (t.timeSlot && t.timeSlot.toLowerCase().includes(cleanQuery))
                      );

                    if (!matchesSearch) return null;

                    const isPanelSplitting = autoSplittingPanelId === panel.id;

                    return (
                      <div key={panel.id} style={{
                        background: 'rgba(10, 10, 20, 0.95)',
                        border: '2px solid ' + (assignedList.length > 0 ? 'var(--maze-blue)' : '#333'),
                        borderRadius: '10px',
                        padding: '18px 20px',
                        boxShadow: assignedList.length > 0 ? '0 0 12px rgba(33, 33, 255, 0.2)' : 'none'
                      }}>
                        {/* Panel Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: '#fdff00',
                              color: '#000',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontFamily: 'Press Start 2P, monospace',
                              fontSize: '0.72rem',
                              fontWeight: 'bold'
                            }}>
                              {panel.id}
                            </span>
                            <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>
                              {panel.group}
                            </span>
                            <span style={{
                              background: 'rgba(0, 255, 204, 0.12)',
                              color: '#00ffcc',
                              border: '1px solid #00ffcc',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.75rem'
                            }}>
                              📍 {panel.location}
                            </span>
                            <span style={{
                              background: assignedList.length > 0 ? 'rgba(33, 33, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                              color: assignedList.length > 0 ? '#99bbff' : '#888',
                              border: '1px solid ' + (assignedList.length > 0 ? '#2121ff' : '#444'),
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontFamily: 'Press Start 2P, monospace'
                            }}>
                              👥 {assignedList.length} {assignedList.length === 1 ? 'TEAM' : 'TEAMS'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleAutoSplitSinglePanel(panel.id)}
                              disabled={isPanelSplitting || isAutoSplitting || assignedList.length === 0}
                              style={{
                                background: 'rgba(0, 255, 204, 0.15)',
                                border: '1.5px solid #00ffcc',
                                color: '#00ffcc',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontFamily: 'Press Start 2P, monospace',
                                fontSize: '0.58rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 'bold'
                              }}
                              title="Auto-split this panel's teams equally (4-4-4) across the 3 time slots"
                            >
                              {isPanelSplitting ? '⏳ SPLITTING...' : '⚡ AUTO-SPLIT (4-4-4)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportSinglePanel(panel.id)}
                              style={{
                                background: 'rgba(0, 255, 102, 0.12)',
                                border: '1.5px solid #00ff66',
                                color: '#00ff66',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontFamily: 'Press Start 2P, monospace',
                                fontSize: '0.58rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              📥 EXPORT (.XLSX)
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintPanel(panel.id)}
                              style={{
                                background: 'rgba(253, 255, 0, 0.12)',
                                border: '1.5px solid #fdff00',
                                color: '#fdff00',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontFamily: 'Press Start 2P, monospace',
                                fontSize: '0.58rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              🖨️ PRINT {panel.id}
                            </button>
                          </div>
                        </div>

                        {/* Faculty Judges List */}
                        <div style={{ marginBottom: '14px', background: 'rgba(0, 0, 0, 0.5)', padding: '10px 14px', borderRadius: '6px', border: '1px solid #222' }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--inky-cyan)', fontFamily: 'Press Start 2P, monospace', marginBottom: '6px' }}>
                            ⚖️ FACULTY EVALUATORS / JUDGES:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {panel.names.map((jName, jIdx) => (
                              <span key={jIdx} style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '0.78rem',
                                color: '#e0e0e0'
                              }}>
                                👨‍🏫 {jName}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Assigned Teams Table */}
                        {assignedList.length === 0 ? (
                          <div style={{
                            padding: '16px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '6px',
                            border: '1px dashed #444',
                            color: '#777',
                            fontSize: '0.75rem',
                            textAlign: 'center',
                            fontFamily: 'Press Start 2P, monospace'
                          }}>
                            ⚠️ NO TEAMS ASSIGNED TO THIS PANEL YET
                          </div>
                        ) : (
                          <div className="table-responsive" style={{ margin: 0 }}>
                            <table className="eval-table admin-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '9%', textAlign: 'center' }}>Team ID</th>
                                  <th style={{ width: '16%' }}>Team Name</th>
                                  <th style={{ width: '18%' }}>Time Slot</th>
                                  <th style={{ width: '23%' }}>Leader & Members</th>
                                  <th style={{ width: '18%' }}>Project & Tech</th>
                                  <th style={{ width: '10%', textAlign: 'center' }}>Score (50)</th>
                                  <th style={{ width: '6%', textAlign: 'center' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assignedList.map((t, idx) => {
                                  const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
                                  const isScored = !!evalEntry;
                                  const score = evalEntry?.totalScore ?? '-';
                                  const slotInfo = getTimeSlotInfo(t.timeSlot);
                                  const isSlotSaving = savingSlotTeamId === t.id;

                                  return (
                                    <tr key={t.id || idx}>
                                      <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                          display: 'inline-block',
                                          background: 'rgba(253, 255, 0, 0.15)',
                                          color: '#fdff00',
                                          border: '1px solid #fdff00',
                                          borderRadius: '4px',
                                          padding: '2px 6px',
                                          fontFamily: 'Press Start 2P, monospace',
                                          fontSize: '0.62rem',
                                          fontWeight: 'bold'
                                        }}>
                                          {t.teamIdNo && t.teamIdNo !== 'N/A' ? t.teamIdNo : 'N/A'}
                                        </span>
                                      </td>
                                      <td className="criterion-name">
                                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{t.teamName}</strong>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <select
                                            className="retro-select"
                                            value={t.timeSlot}
                                            onChange={(e) => handleQuickSlotChange(t.id, t.teamName, e.target.value)}
                                            disabled={isSlotSaving}
                                            style={{
                                              padding: '4px 6px',
                                              fontSize: '0.68rem',
                                              width: 'auto',
                                              border: `1px solid ${slotInfo.badgeBorder}`,
                                              color: slotInfo.badgeColor,
                                              background: 'rgba(0, 0, 0, 0.8)'
                                            }}
                                            title="Click to instantly reassign time slot"
                                          >
                                            {TIME_SLOT_OPTIONS.map(opt => (
                                              <option key={opt.id} value={opt.value}>{opt.shortLabel}</option>
                                            ))}
                                          </select>
                                          {isSlotSaving && <span style={{ fontSize: '0.6rem', color: '#fdff00' }}>⏳</span>}
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontSize: '0.8rem', color: '#fdff00' }}>
                                          <strong>{t.leaderName}</strong> <span style={{ color: '#aaa', fontSize: '0.72rem' }}>({t.leaderId}){t.leaderBranch ? ` [${t.leaderBranch}]` : ''}</span>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                          📞 {t.leaderPhone || 'N/A'} • ✉️ {t.leaderEmail}
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: '500' }}>{t.projectTitle || 'Untitled Project'}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t.techStack || '-'}</div>
                                      </td>
                                      <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.95rem', color: isScored ? '#fdff00' : 'var(--text-muted)' }}>
                                        {isScored ? `${score} / 50` : '-'}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isScored ? (
                                          <span className="status-pill status-completed" style={{ fontSize: '0.55rem', padding: '3px 6px' }}>SCORED</span>
                                        ) : (
                                          <span className="status-pill status-pending" style={{ fontSize: '0.55rem', padding: '3px 6px' }}>PENDING</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 5: ALLOWED GMAILS WHITELIST */}
        {activeTab === 'whitelist-tab' && (() => {
          const displayedAllowedUsers = allowedUsers.filter(u => {
            if (!cleanQuery) return true;
            if (u.email && u.email.toLowerCase().includes(cleanQuery)) return true;
            if (u.added_by && u.added_by.toLowerCase().includes(cleanQuery)) return true;
            return false;
          });

          return (
            <div className="admin-tab-content active">
              <div className="form-section">
                <h3 className="section-title"><span className="pacman-bullet"></span> GOOGLE OAUTH AUTHORIZED USERS WHITELIST</h3>

                <form onSubmit={handleAddAllowedGmail} className="whitelist-add-form" style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <input
                    type="email"
                    placeholder="Enter authorized Gmail address (e.g., student@gmail.com)"
                    required
                    value={newGmail}
                    onChange={(e) => setNewGmail(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      background: '#000',
                      border: '2px solid var(--inky-cyan)',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none'
                    }}
                  />
                  <button type="submit" className="submit-btn" style={{ marginTop: 0, padding: '12px 20px', whiteSpace: 'nowrap' }}>
                    ➕ ADD AUTHORIZED GMAIL
                  </button>
                </form>

                <div className="table-responsive">
                  <table className="eval-table admin-table">
                    <thead>
                      <tr>
                        <th>Authorized Gmail Address</th>
                        <th>Added By</th>
                        <th>Authorized On</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAllowedUsers.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: cleanQuery ? '#ff6699' : 'var(--text-muted)', padding: '24px' }}>
                            {cleanQuery ? `No authorized Gmail matching "${searchQuery}"` : "No email restriction entries found."}
                          </td>
                        </tr>
                      ) : (
                        displayedAllowedUsers.map(u => (
                          <tr key={u.id || u.email}>
                            <td className="criterion-name">
                              {editingUserId === u.id ? (
                                <input
                                  type="email"
                                  value={editingEmail}
                                  onChange={(e) => setEditingEmail(e.target.value)}
                                  style={{
                                    padding: '6px 10px',
                                    background: '#000',
                                    border: '2px solid var(--pacman-yellow)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontFamily: 'Outfit, sans-serif',
                                    fontSize: '0.9rem',
                                    width: '100%',
                                    maxWidth: '280px'
                                  }}
                                />
                              ) : (
                                u.email
                              )}
                            </td>
                            <td>{u.added_by || 'Admin'}</td>
                            <td><small style={{ color: 'var(--text-muted)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}</small></td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {editingUserId === u.id ? (
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="eval-btn"
                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                    onClick={() => handleUpdateAllowedGmail(u.id)}
                                  >
                                    💾 SAVE
                                  </button>
                                  <button
                                    type="button"
                                    className="logout-btn"
                                    style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: '#777', color: '#aaa', background: 'transparent' }}
                                    onClick={() => setEditingUserId(null)}
                                  >
                                    ❌ CANCEL
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="eval-btn edit-btn"
                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                    onClick={() => startEditGmail(u)}
                                  >
                                    ✏️ EDIT
                                  </button>
                                  <button
                                    type="button"
                                    className="logout-btn"
                                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                    onClick={() => handleRemoveAllowedGmail(u.id, u.email)}
                                  >
                                    🗑️ REMOVE
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* 📦 ALL JUDGES PANELS & ALLOCATED TIME SLOTS DOSSIER MODAL */}
        {/* ========================================================================= */}
        {showZipPanelsModal && (() => {
          const knownPanels = Object.values(JUDGE_PROFILES);
          const panelMap = {};
          knownPanels.forEach(p => {
            panelMap[p.id.toUpperCase()] = {
              profile: p,
              teams: []
            };
          });

          const customPanelsMap = {};
          const unassignedTeams = [];

          teams.forEach(t => {
            const rawJudge = (t.assignedJudge || '').trim();
            const upperJudge = rawJudge.toUpperCase();

            if (!rawJudge || rawJudge.toLowerCase() === 'unassigned') {
              unassignedTeams.push(t);
            } else if (panelMap[upperJudge]) {
              panelMap[upperJudge].teams.push(t);
            } else {
              if (!customPanelsMap[rawJudge]) {
                customPanelsMap[rawJudge] = {
                  profile: {
                    id: rawJudge,
                    group: 'Custom Judge',
                    names: [rawJudge],
                    namesText: rawJudge,
                    location: 'Assigned by Admin'
                  },
                  teams: []
                };
              }
              customPanelsMap[rawJudge].teams.push(t);
            }
          });

          const cleanModalQuery = zipModalSearch.trim().toLowerCase();

          // Compute overall slot counts
          let s1Total = 0, s2Total = 0, s3Total = 0, tbaTotal = 0;
          teams.forEach(t => {
            const slot = parseTimeSlotFromTeam(t);
            if (slot === '09:30 AM - 11:30 AM') s1Total++;
            else if (slot === '12:15 PM - 02:15 PM') s2Total++;
            else if (slot === '02:30 PM - 04:15 PM') s3Total++;
            else tbaTotal++;
          });

          const totalAssignedTeams = teams.filter(t => t.assignedJudge && t.assignedJudge !== 'Unassigned').length;

          return (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}>
              <div style={{
                background: 'var(--card-bg, #0a0a14)',
                border: '3px solid var(--maze-blue, #2121ff)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '1200px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 0 35px rgba(33, 33, 255, 0.6), inset 0 0 15px rgba(33, 33, 255, 0.2)',
                overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '18px 24px',
                  background: 'linear-gradient(180deg, rgba(16, 124, 65, 0.25) 0%, rgba(10, 10, 20, 0.95) 100%)',
                  borderBottom: '2px solid rgba(0, 255, 102, 0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{
                        background: '#00ff66',
                        color: '#000',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.72rem',
                        fontWeight: 'bold'
                      }}>
                        📦 ZIP DOSSIER
                      </span>
                      <h2 style={{
                        fontFamily: 'Press Start 2P, monospace',
                        fontSize: '0.95rem',
                        color: '#fff',
                        margin: 0,
                        letterSpacing: '-0.02em'
                      }}>
                        ALL JUDGES PANELS & TIME SLOTS
                      </h2>
                    </div>
                    <p style={{ color: 'var(--text-muted, #a0a0c0)', fontSize: '0.82rem', margin: 0 }}>
                      Complete assignment dossier of judging panels (JM001 - JM011), faculty evaluators, and allocated teams with presentation time slots.
                    </p>
                  </div>

                  {/* Top Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleExportAllPanelsZip}
                      disabled={isExportingZip}
                      style={{
                        background: 'linear-gradient(135deg, #107c41, #1e8e3e)',
                        border: '2px solid #00ff66',
                        color: '#fff',
                        padding: '10px 16px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 0 15px rgba(0, 255, 102, 0.4)',
                        fontWeight: 'bold'
                      }}
                      title="Download separate individual .xlsx dossier sheets for every judge panel"
                    >
                      {isExportingZip ? '⏳ PACKAGING ZIP...' : '📦 DOWNLOAD (.ZIP)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportScheduleExcel}
                      style={{
                        background: 'linear-gradient(135deg, #b8860b, #e6b800)',
                        border: '2px solid #fdff00',
                        color: '#000',
                        padding: '10px 14px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="Download master timetable workbook"
                    >
                      📅 TIMETABLE (.XLSX)
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintAllPanels}
                      style={{
                        background: 'rgba(253, 255, 0, 0.15)',
                        border: '1.5px solid #fdff00',
                        color: '#fdff00',
                        padding: '10px 14px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="Print all panel sheets on A4 landscape"
                    >
                      🖨️ PRINT ALL (A4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowZipPanelsModal(false)}
                      style={{
                        background: 'rgba(255, 0, 0, 0.2)',
                        border: '1.5px solid #ff4444',
                        color: '#ff6666',
                        padding: '10px 14px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* KPI Metrics Chips */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '10px',
                  padding: '12px 24px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ background: 'rgba(33, 33, 255, 0.15)', border: '1px solid #2121ff', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#99bbff', fontFamily: 'Press Start 2P, monospace' }}>🏛️ PANELS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>11 PANELS</div>
                  </div>
                  <div style={{ background: 'rgba(0, 255, 102, 0.15)', border: '1px solid #00ff66', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#00ff66', fontFamily: 'Press Start 2P, monospace' }}>👥 ASSIGNED TEAMS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{totalAssignedTeams} TEAMS</div>
                  </div>
                  <div style={{ background: 'rgba(0, 255, 204, 0.12)', border: '1px solid #00ffcc', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace' }}>⏰ SLOT 1 (9:30-11:30)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#00ffcc', marginTop: '4px' }}>{s1Total} TEAMS</div>
                  </div>
                  <div style={{ background: 'rgba(253, 255, 0, 0.12)', border: '1px solid #fdff00', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace' }}>⏰ SLOT 2 (12:15-2:15)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fdff00', marginTop: '4px' }}>{s2Total} TEAMS</div>
                  </div>
                  <div style={{ background: 'rgba(255, 102, 204, 0.12)', border: '1px solid #ff66cc', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#ff66cc', fontFamily: 'Press Start 2P, monospace' }}>⏰ SLOT 3 (2:30-4:15)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ff66cc', marginTop: '4px' }}>{s3Total} TEAMS</div>
                  </div>
                  <div style={{ background: 'rgba(255, 184, 82, 0.12)', border: '1px solid #ffb852', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#ffb852', fontFamily: 'Press Start 2P, monospace' }}>⏳ TBA (UNALLOCATED)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ffb852', marginTop: '4px' }}>{tbaTotal} TEAMS</div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{
                  padding: '12px 24px',
                  background: 'rgba(10, 10, 20, 0.9)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <input
                      type="text"
                      className="retro-input"
                      placeholder="🔍 Filter panels, judges, rooms, team ID, time slots..."
                      value={zipModalSearch}
                      onChange={(e) => setZipModalSearch(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--inky-cyan)', fontFamily: 'Press Start 2P, monospace' }}>SLOT:</span>
                    <select
                      className="retro-select"
                      value={zipModalSlotFilter}
                      onChange={(e) => setZipModalSlotFilter(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                    >
                      <option value="all">⭐ All Time Slots</option>
                      <option value="09:30 AM - 11:30 AM">⏰ Slot 1: 09:30 AM - 11:30 AM</option>
                      <option value="12:15 PM - 02:15 PM">⏰ Slot 2: 12:15 PM - 02:15 PM</option>
                      <option value="02:30 PM - 04:15 PM">⏰ Slot 3: 02:30 PM - 04:15 PM</option>
                      <option value="TBA">⏳ TBA (Unallocated)</option>
                    </select>
                  </div>
                  {zipModalSearch && (
                    <button
                      type="button"
                      onClick={() => setZipModalSearch('')}
                      style={{ background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', padding: '6px 10px', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      ✕ Clear Filter
                    </button>
                  )}
                </div>

                {/* Scrollable Panels Content */}
                <div style={{
                  padding: '20px 24px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  {knownPanels.map(panel => {
                    const allAssigned = panelMap[panel.id.toUpperCase()].teams;
                    
                    // Filter by slot if selected
                    const assignedList = zipModalSlotFilter === 'all'
                      ? allAssigned
                      : allAssigned.filter(t => parseTimeSlotFromTeam(t) === zipModalSlotFilter);

                    const matchesSearch = !cleanModalQuery ||
                      panel.id.toLowerCase().includes(cleanModalQuery) ||
                      panel.group.toLowerCase().includes(cleanModalQuery) ||
                      panel.location.toLowerCase().includes(cleanModalQuery) ||
                      panel.namesText.toLowerCase().includes(cleanModalQuery) ||
                      assignedList.some(t =>
                        (t.teamName && t.teamName.toLowerCase().includes(cleanModalQuery)) ||
                        (t.teamIdNo && t.teamIdNo.toLowerCase().includes(cleanModalQuery)) ||
                        (t.timeSlot && t.timeSlot.toLowerCase().includes(cleanModalQuery)) ||
                        (t.leaderName && t.leaderName.toLowerCase().includes(cleanModalQuery))
                      );

                    if (!matchesSearch) return null;

                    // Per-panel slot counts
                    let pS1 = 0, pS2 = 0, pS3 = 0, pTba = 0;
                    allAssigned.forEach(t => {
                      const slot = parseTimeSlotFromTeam(t);
                      if (slot === '09:30 AM - 11:30 AM') pS1++;
                      else if (slot === '12:15 PM - 02:15 PM') pS2++;
                      else if (slot === '02:30 PM - 04:15 PM') pS3++;
                      else pTba++;
                    });

                    return (
                      <div key={panel.id} style={{
                        background: 'rgba(15, 15, 25, 0.95)',
                        border: '2px solid ' + (allAssigned.length > 0 ? 'var(--maze-blue, #2121ff)' : '#333'),
                        borderRadius: '10px',
                        padding: '16px 18px',
                        boxShadow: allAssigned.length > 0 ? '0 0 12px rgba(33, 33, 255, 0.2)' : 'none'
                      }}>
                        {/* Panel Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                          marginBottom: '12px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          paddingBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: '#fdff00',
                              color: '#000',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontFamily: 'Press Start 2P, monospace',
                              fontSize: '0.72rem',
                              fontWeight: 'bold'
                            }}>
                              {panel.id}
                            </span>
                            <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>
                              {panel.group}
                            </span>
                            <span style={{
                              background: 'rgba(0, 255, 204, 0.12)',
                              color: '#00ffcc',
                              border: '1px solid #00ffcc',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.75rem'
                            }}>
                              📍 {panel.location}
                            </span>
                            <span style={{
                              background: allAssigned.length > 0 ? 'rgba(33, 33, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                              color: allAssigned.length > 0 ? '#99bbff' : '#888',
                              border: '1px solid ' + (allAssigned.length > 0 ? '#2121ff' : '#444'),
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontFamily: 'Press Start 2P, monospace'
                            }}>
                              👥 {allAssigned.length} TEAMS
                            </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.68rem', color: '#00ffcc', background: 'rgba(0, 255, 204, 0.1)', border: '1px solid rgba(0, 255, 204, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                                S1: {pS1}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#fdff00', background: 'rgba(253, 255, 0, 0.1)', border: '1px solid rgba(253, 255, 0, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                                S2: {pS2}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#ff66cc', background: 'rgba(255, 102, 204, 0.1)', border: '1px solid rgba(255, 102, 204, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                                S3: {pS3}
                              </span>
                              {pTba > 0 && (
                                <span style={{ fontSize: '0.68rem', color: '#ffb852', background: 'rgba(255, 184, 82, 0.1)', border: '1px solid rgba(255, 184, 82, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                                  TBA: {pTba}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleExportSinglePanel(panel.id)}
                              style={{
                                background: 'rgba(0, 255, 102, 0.15)',
                                border: '1.5px solid #00ff66',
                                color: '#00ff66',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontFamily: 'Press Start 2P, monospace',
                                fontSize: '0.58rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title={`Download individual multi-sheet Excel file for Panel ${panel.id}`}
                            >
                              📥 EXPORT (.XLSX)
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintPanel(panel.id)}
                              style={{
                                background: 'rgba(253, 255, 0, 0.15)',
                                border: '1.5px solid #fdff00',
                                color: '#fdff00',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontFamily: 'Press Start 2P, monospace',
                                fontSize: '0.58rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title={`Open printable A4 landscape evaluation sheet for Panel ${panel.id}`}
                            >
                              🖨️ PRINT {panel.id}
                            </button>
                          </div>
                        </div>

                        {/* Faculty Evaluators */}
                        <div style={{ marginBottom: '12px', background: 'rgba(0, 0, 0, 0.4)', padding: '8px 12px', borderRadius: '6px', border: '1px solid #222' }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--inky-cyan, #00ffff)', fontFamily: 'Press Start 2P, monospace', marginBottom: '6px' }}>
                            ⚖️ FACULTY EVALUATORS:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {panel.names.map((jName, jIdx) => (
                              <span key={jIdx} style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                color: '#e0e0e0'
                              }}>
                                👨‍🏫 {jName}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Teams Table */}
                        {assignedList.length === 0 ? (
                          <div style={{
                            padding: '14px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '6px',
                            border: '1px dashed #444',
                            color: '#777',
                            fontSize: '0.72rem',
                            textAlign: 'center',
                            fontFamily: 'Press Start 2P, monospace'
                          }}>
                            ⚠️ NO TEAMS MATCHING FILTER IN THIS PANEL
                          </div>
                        ) : (
                          <div className="table-responsive" style={{ margin: 0 }}>
                            <table className="eval-table admin-table" style={{ margin: 0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '8%', textAlign: 'center' }}>Team ID</th>
                                  <th style={{ width: '18%' }}>Team Name</th>
                                  <th style={{ width: '22%' }}>Allocated Time Slot</th>
                                  <th style={{ width: '22%' }}>Leader & Members</th>
                                  <th style={{ width: '18%' }}>Project & Tech</th>
                                  <th style={{ width: '12%', textAlign: 'center' }}>Score (50)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assignedList.map((t, tIdx) => {
                                  const evalEntry = evaluations.find(e => (e.teamName || '').toLowerCase() === (t.teamName || '').toLowerCase());
                                  const isScored = !!evalEntry;
                                  const score = evalEntry?.totalScore ?? '-';
                                  const slotInfo = getTimeSlotInfo(t.timeSlot);
                                  const isSlotSaving = savingSlotTeamId === t.id;

                                  return (
                                    <tr key={t.id || tIdx}>
                                      <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                          display: 'inline-block',
                                          background: 'rgba(253, 255, 0, 0.15)',
                                          color: '#fdff00',
                                          border: '1px solid #fdff00',
                                          borderRadius: '4px',
                                          padding: '2px 6px',
                                          fontFamily: 'Press Start 2P, monospace',
                                          fontSize: '0.62rem',
                                          fontWeight: 'bold'
                                        }}>
                                          {t.teamIdNo && t.teamIdNo !== 'N/A' ? t.teamIdNo : 'N/A'}
                                        </span>
                                      </td>
                                      <td>
                                        <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{t.teamName}</strong>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <select
                                            className="retro-select"
                                            value={t.timeSlot}
                                            onChange={(e) => handleQuickSlotChange(t.id, t.teamName, e.target.value)}
                                            disabled={isSlotSaving}
                                            style={{
                                              padding: '4px 6px',
                                              fontSize: '0.68rem',
                                              color: slotInfo.badgeColor,
                                              background: slotInfo.badgeBg,
                                              border: `1.5px solid ${slotInfo.badgeBorder}`,
                                              borderRadius: '4px',
                                              fontWeight: 'bold'
                                            }}
                                          >
                                            {TIME_SLOT_OPTIONS.map(opt => (
                                              <option key={opt.id} value={opt.value} style={{ background: '#111', color: opt.badgeColor }}>
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                          {isSlotSaving && <span style={{ fontSize: '0.6rem', color: '#fdff00' }}>⏳</span>}
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontSize: '0.78rem' }}>
                                          <strong style={{ color: '#00ffcc' }}>{t.leaderName || 'N/A'}</strong>
                                          {t.leaderBranch && <span style={{ color: '#aaa', marginLeft: '4px' }}>[{t.leaderBranch}]</span>}
                                          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                                            📞 {t.leaderPhone || 'N/A'} | ✉️ {t.leaderEmail || 'N/A'}
                                          </div>
                                          {t.members && t.members.length > 0 && (
                                            <div style={{ fontSize: '0.68rem', color: '#bbb', marginTop: '2px' }}>
                                              👥 {t.members.map(m => m.name).join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontSize: '0.78rem', color: '#e0e0e0', fontWeight: 'bold' }}>
                                          {t.projectTitle || 'N/A'}
                                        </div>
                                        {t.techStack && (
                                          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                                            ⚡ {t.techStack}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isScored ? (
                                          <span style={{
                                            display: 'inline-block',
                                            background: 'rgba(0, 255, 102, 0.15)',
                                            color: '#00ff66',
                                            border: '1px solid #00ff66',
                                            borderRadius: '4px',
                                            padding: '2px 8px',
                                            fontFamily: 'Press Start 2P, monospace',
                                            fontSize: '0.65rem',
                                            fontWeight: 'bold'
                                          }}>
                                            {score}/50
                                          </span>
                                        ) : (
                                          <span style={{
                                            display: 'inline-block',
                                            background: 'rgba(255, 0, 0, 0.15)',
                                            color: '#ff4444',
                                            border: '1px solid #ff4444',
                                            borderRadius: '4px',
                                            padding: '2px 6px',
                                            fontFamily: 'Press Start 2P, monospace',
                                            fontSize: '0.58rem'
                                          }}>
                                            PENDING
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom Panels if any */}
                  {Object.values(customPanelsMap).map(cp => {
                    const assignedList = zipModalSlotFilter === 'all'
                      ? cp.teams
                      : cp.teams.filter(t => parseTimeSlotFromTeam(t) === zipModalSlotFilter);

                    if (assignedList.length === 0 && zipModalSlotFilter !== 'all') return null;

                    return (
                      <div key={cp.profile.id} style={{
                        background: 'rgba(15, 15, 25, 0.95)',
                        border: '2px solid #fdff00',
                        borderRadius: '10px',
                        padding: '16px 18px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ background: '#fdff00', color: '#000', padding: '4px 10px', borderRadius: '6px', fontFamily: 'Press Start 2P, monospace', fontSize: '0.72rem', fontWeight: 'bold' }}>
                            {cp.profile.id} (Custom Judge)
                          </span>
                          <span style={{ color: '#fdff00', fontSize: '0.72rem', fontFamily: 'Press Start 2P, monospace' }}>
                            👥 {cp.teams.length} TEAMS
                          </span>
                        </div>
                        <div className="table-responsive" style={{ margin: 0 }}>
                          <table className="eval-table admin-table" style={{ margin: 0 }}>
                            <thead>
                              <tr>
                                <th style={{ width: '8%', textAlign: 'center' }}>Team ID</th>
                                <th style={{ width: '20%' }}>Team Name</th>
                                <th style={{ width: '22%' }}>Allocated Time Slot</th>
                                <th style={{ width: '25%' }}>Leader & Members</th>
                                <th style={{ width: '25%' }}>Project & Tech</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assignedList.map((t, idx) => (
                                <tr key={t.id || idx}>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#fdff00' }}>{t.teamIdNo || 'N/A'}</td>
                                  <td><strong>{t.teamName}</strong></td>
                                  <td>{t.timeSlot}</td>
                                  <td>{t.leaderName} ({t.leaderPhone || 'N/A'})</td>
                                  <td>{t.projectTitle || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned Teams if any */}
                  {unassignedTeams.length > 0 && (
                    <div style={{
                      background: 'rgba(255, 0, 0, 0.08)',
                      border: '2px solid #ff4444',
                      borderRadius: '10px',
                      padding: '16px 18px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ background: '#ff4444', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontFamily: 'Press Start 2P, monospace', fontSize: '0.72rem', fontWeight: 'bold' }}>
                          ⚠️ UNASSIGNED TEAMS ({unassignedTeams.length})
                        </span>
                        <span style={{ color: '#ff6666', fontSize: '0.72rem' }}>
                          Pending Judge Panel Allocation
                        </span>
                      </div>
                      <div className="table-responsive" style={{ margin: 0 }}>
                        <table className="eval-table admin-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '8%', textAlign: 'center' }}>Team ID</th>
                              <th style={{ width: '22%' }}>Team Name</th>
                              <th style={{ width: '22%' }}>Time Slot</th>
                              <th style={{ width: '25%' }}>Leader & Contact</th>
                              <th style={{ width: '23%' }}>Project Title</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unassignedTeams.map((t, idx) => (
                              <tr key={t.id || idx}>
                                <td style={{ textAlign: 'center', color: '#fdff00' }}>{t.teamIdNo || 'N/A'}</td>
                                <td><strong>{t.teamName}</strong></td>
                                <td>{t.timeSlot}</td>
                                <td>{t.leaderName} ({t.leaderPhone || 'N/A'})</td>
                                <td>{t.projectTitle || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div style={{
                  padding: '16px 24px',
                  background: 'rgba(10, 10, 20, 0.98)',
                  borderTop: '2px solid rgba(33, 33, 255, 0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    📦 ZIP archive packages <strong>individual multi-sheet workbooks</strong> for all 11 judge panels with dedicated time slot sheets and summary overview.
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleExportAllPanelsZip}
                      disabled={isExportingZip}
                      style={{
                        background: 'linear-gradient(135deg, #107c41, #1e8e3e)',
                        border: '2px solid #00ff66',
                        color: '#fff',
                        padding: '12px 20px',
                        fontSize: '0.65rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 0 15px rgba(0, 255, 102, 0.4)'
                      }}
                    >
                      {isExportingZip ? '⏳ PACKAGING ZIP ARCHIVE...' : '📦 DOWNLOAD COMPLETE ZIP ARCHIVE (.ZIP)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowZipPanelsModal(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid #666',
                        color: '#fff',
                        padding: '12px 18px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Close Dossier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ======================================================== */}
        {/* ATTENDANCE ROSTER & STUDENT SIGNATURE DOSSIER MODAL     */}
        {/* ======================================================== */}
        {showAttendanceModal && (() => {
          const allStudents = extractAllStudentsRoster(teams);
          const cleanAttendSearch = attendanceSearchQuery.trim().toLowerCase();

          const filteredStudents = allStudents.filter(s => {
            const sJudge = (s.assignedJudge || '').trim().toUpperCase();

            // Panel filter (Default to Round-2 Panels JM001 to JM010)
            if (attendancePanelFilter === 'all') {
              if (!ROUND_2_PANEL_IDS.includes(sJudge)) {
                return false;
              }
            } else {
              if (sJudge !== attendancePanelFilter.toUpperCase()) {
                return false;
              }
            }

            // Slot filter
            if (attendanceSlotFilter !== 'all') {
              if (attendanceSlotFilter === 'TBA') {
                const isKnown = ['09:30 AM - 11:30 AM', '12:15 PM - 02:15 PM', '02:30 PM - 04:15 PM'].includes(s.timeSlot);
                if (isKnown) return false;
              } else if (s.timeSlot !== attendanceSlotFilter) {
                return false;
              }
            }

            // Search filter
            if (cleanAttendSearch) {
              const matchName = s.studentName.toLowerCase().includes(cleanAttendSearch);
              const matchId = s.enrollmentNo.toLowerCase().includes(cleanAttendSearch);
              const matchTeam = s.teamName.toLowerCase().includes(cleanAttendSearch);
              const matchTeamId = s.teamId.toLowerCase().includes(cleanAttendSearch);
              const matchDept = s.department.toLowerCase().includes(cleanAttendSearch);
              const matchJudge = s.assignedJudge.toLowerCase().includes(cleanAttendSearch);
              const matchLoc = s.panelLocation.toLowerCase().includes(cleanAttendSearch);
              if (!matchName && !matchId && !matchTeam && !matchTeamId && !matchDept && !matchJudge && !matchLoc) {
                return false;
              }
            }

            return true;
          });

          // Sort panel-wise (JM001 to JM010) then time slot then leader
          filteredStudents.sort((a, b) => {
            const jA = (a.assignedJudge || '').trim().toUpperCase();
            const jB = (b.assignedJudge || '').trim().toUpperCase();
            if (jA !== jB) return jA.localeCompare(jB);
            const slotOrder = { '09:30 AM - 11:30 AM': 1, '12:15 PM - 02:15 PM': 2, '02:30 PM - 04:15 PM': 3, 'TBA': 4 };
            const slotA = slotOrder[a.timeSlot] || 5;
            const slotB = slotOrder[b.timeSlot] || 5;
            if (slotA !== slotB) return slotA - slotB;
            if (a.teamId !== b.teamId) return (a.teamId || '').localeCompare(b.teamId || '');
            if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
            return (a.studentName || '').localeCompare(b.studentName || '');
          });

          const r2Students = allStudents.filter(s => ROUND_2_PANEL_IDS.includes((s.assignedJudge || '').trim().toUpperCase()));
          const totalLeaders = r2Students.filter(s => s.isLeader).length;
          const totalMembers = r2Students.filter(s => !s.isLeader).length;

          return (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}>
              <div style={{
                background: 'rgba(12, 12, 28, 0.98)',
                border: '2px solid #00ffcc',
                borderRadius: '14px',
                boxShadow: '0 0 40px rgba(0, 255, 204, 0.35)',
                width: '100%',
                maxWidth: '1240px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '16px 24px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 204, 0.15), rgba(33, 33, 255, 0.2))',
                  borderBottom: '2px solid rgba(0, 255, 204, 0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#00ffcc', color: '#000', padding: '3px 8px', borderRadius: '4px', fontSize: '0.62rem', fontFamily: 'Press Start 2P, monospace', fontWeight: 'bold' }}>
                        PANELS 001 - 010
                      </span>
                      <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace' }}>
                        📝 JUDGE PANEL ATTENDANCE (JM001 - JM010)
                      </h2>
                    </div>
                    <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      Judge Panel Wise attendance sheets for Panels 001 to 010 with Team Name, Leader/Member Names, Enrollment Number, Department, and Student Signature column.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintAttendance('by-panel')}
                      style={{
                        background: 'linear-gradient(135deg, #107c41, #1e8e3e)',
                        border: '2px solid #00ff66',
                        color: '#fff',
                        padding: '10px 16px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 0 12px rgba(0, 255, 102, 0.3)'
                      }}
                      title="Print dedicated attendance sheets for Panels JM001 to JM010 with page breaks for each lab venue"
                    >
                      🖨️ PRINT PANELS (001-010)
                    </button>
                    <button
                      type="button"
                      onClick={handleExportAttendanceExcel}
                      style={{
                        background: 'linear-gradient(135deg, #b8860b, #e6b800)',
                        border: '2px solid #fdff00',
                        color: '#000',
                        padding: '10px 14px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="Download dedicated Excel workbook (.xlsx) organized by Panels JM001 to JM010"
                    >
                      📗 EXCEL (.XLSX)
                    </button>
                    <button
                      type="button"
                      onClick={handleExportAttendanceCSV}
                      style={{
                        background: 'rgba(33, 150, 243, 0.2)',
                        border: '1.5px solid #2196f3',
                        color: '#2196f3',
                        padding: '10px 14px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="Download attendance CSV file for Panels JM001 to JM010"
                    >
                      📋 CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttendanceModal(false)}
                      style={{
                        background: 'rgba(255, 0, 0, 0.2)',
                        border: '1.5px solid #ff4444',
                        color: '#ff6666',
                        padding: '10px 14px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* Metrics Chips */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '10px',
                  padding: '12px 24px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ background: 'rgba(0, 255, 204, 0.12)', border: '1px solid #00ffcc', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace' }}>🏛️ ROUND-2 PANELS</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>10 PANELS (001-010)</div>
                  </div>
                  <div style={{ background: 'rgba(33, 33, 255, 0.15)', border: '1px solid #2121ff', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#99bbff', fontFamily: 'Press Start 2P, monospace' }}>👥 PANEL STUDENTS</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{r2Students.length} PARTICIPANTS</div>
                  </div>
                  <div style={{ background: 'rgba(253, 255, 0, 0.12)', border: '1px solid #fdff00', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace' }}>TEAM LEADERS</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fdff00', marginTop: '4px' }}>{totalLeaders} LEADERS</div>
                  </div>
                  <div style={{ background: 'rgba(255, 102, 204, 0.12)', border: '1px solid #ff66cc', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#ff66cc', fontFamily: 'Press Start 2P, monospace' }}>TEAM MEMBERS</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ff66cc', marginTop: '4px' }}>{totalMembers} MEMBERS</div>
                  </div>
                  <div style={{ background: 'rgba(0, 255, 102, 0.12)', border: '1px solid #00ff66', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#00ff66', fontFamily: 'Press Start 2P, monospace' }}>📍 FILTERED DISPLAY</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#00ff66', marginTop: '4px' }}>{filteredStudents.length} ROWS</div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div style={{
                  padding: '12px 24px',
                  background: 'rgba(10, 10, 20, 0.9)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <input
                      type="text"
                      className="retro-input"
                      placeholder="🔍 Search student name, enrollment ID, team name, branch, lab..."
                      value={attendanceSearchQuery}
                      onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: '#00ffcc', fontFamily: 'Press Start 2P, monospace' }}>PANEL / ROOM:</span>
                    <select
                      className="retro-select"
                      value={attendancePanelFilter}
                      onChange={(e) => setAttendancePanelFilter(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                    >
                      <option value="all">⭐ All Panels (JM001 - JM010)</option>
                      {ROUND_2_PANEL_IDS.map(pId => {
                        const p = JUDGE_PROFILES[pId];
                        return (
                          <option key={pId} value={pId}>
                            {pId} ({p?.location || 'Room N/A'})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace' }}>SLOT:</span>
                    <select
                      className="retro-select"
                      value={attendanceSlotFilter}
                      onChange={(e) => setAttendanceSlotFilter(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                    >
                      <option value="all">⭐ All Slots</option>
                      <option value="09:30 AM - 11:30 AM">⏰ Slot 1: 09:30 AM - 11:30 AM</option>
                      <option value="12:15 PM - 02:15 PM">⏰ Slot 2: 12:15 PM - 02:15 PM</option>
                      <option value="02:30 PM - 04:15 PM">⏰ Slot 3: 02:30 PM - 04:15 PM</option>
                      <option value="TBA">⏳ TBA Slot</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: '#fdff00', fontFamily: 'Press Start 2P, monospace' }}>SLOT:</span>
                    <select
                      className="retro-select"
                      value={attendanceSlotFilter}
                      onChange={(e) => setAttendanceSlotFilter(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                    >
                      <option value="all">⭐ All Slots</option>
                      <option value="09:30 AM - 11:30 AM">⏰ Slot 1: 09:30 AM - 11:30 AM</option>
                      <option value="12:15 PM - 02:15 PM">⏰ Slot 2: 12:15 PM - 02:15 PM</option>
                      <option value="02:30 PM - 04:15 PM">⏰ Slot 3: 02:30 PM - 04:15 PM</option>
                      <option value="TBA">⏳ TBA Slot</option>
                    </select>
                  </div>
                  {(attendanceSearchQuery || attendancePanelFilter !== 'all' || attendanceSlotFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttendanceSearchQuery('');
                        setAttendancePanelFilter('all');
                        setAttendanceSlotFilter('all');
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid #888',
                        color: '#fff',
                        padding: '6px 12px',
                        fontSize: '0.72rem',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Table Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  <div className="table-responsive" style={{ margin: 0 }}>
                    <table className="eval-table admin-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '4%', textAlign: 'center' }}>#</th>
                          <th style={{ width: '16%' }}>Team ID & Name</th>
                          <th style={{ width: '12%' }}>Participant Role</th>
                          <th style={{ width: '18%' }}>Student Name</th>
                          <th style={{ width: '14%', textAlign: 'center' }}>Enrollment Number</th>
                          <th style={{ width: '16%' }}>Department / Branch</th>
                          <th style={{ width: '12%', textAlign: 'center' }}>Slot & Lab Venue</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Student Signature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                              ⚠️ No student participants match the selected filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((s, idx) => (
                            <tr key={`${s.teamId}-${s.enrollmentNo}-${idx}`} style={{ background: s.isLeader ? 'rgba(253, 255, 0, 0.03)' : 'transparent' }}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00ffcc' }}>
                                {idx + 1}
                              </td>
                              <td>
                                <span style={{ color: '#fdff00', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                  {s.teamId}
                                </span>
                                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>
                                  {s.teamName}
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 'bold',
                                  background: s.isLeader ? 'rgba(253, 255, 0, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                  color: s.isLeader ? '#fdff00' : '#ccc',
                                  border: s.isLeader ? '1px solid rgba(253, 255, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'
                                }}>
                                  {s.role}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{s.studentName}</strong>
                                {s.email && s.email !== 'N/A' && (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                                    ✉️ {s.email}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  background: 'rgba(0, 0, 0, 0.5)',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(0, 255, 204, 0.3)',
                                  color: '#00ffcc',
                                  fontFamily: 'monospace',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem'
                                }}>
                                  {s.enrollmentNo}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: '#ddd', fontSize: '0.8rem' }}>
                                  {s.department}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fdff00' }}>
                                  {s.timeSlot}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#00ffcc', marginTop: '2px' }}>
                                  🏛️ {s.assignedJudge} ({s.panelLocation})
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{
                                  border: '1px dashed rgba(255, 255, 255, 0.3)',
                                  borderRadius: '4px',
                                  padding: '6px 8px',
                                  fontSize: '0.68rem',
                                  color: 'rgba(255, 255, 255, 0.4)',
                                  background: 'rgba(0, 0, 0, 0.3)'
                                }}>
                                  [ Sign On Sheet ]
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                  padding: '14px 24px',
                  background: 'rgba(10, 10, 20, 0.98)',
                  borderTop: '2px solid rgba(0, 255, 204, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    💡 <em>Print with <strong>"PRINT PANELS (001-010)"</strong> to distribute dedicated attendance signature sheets for each judge panel venue (F1-F6, S1, S2, G1, G3).</em>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintAttendance('by-panel')}
                      style={{
                        background: 'linear-gradient(135deg, #107c41, #1e8e3e)',
                        border: '2px solid #00ff66',
                        color: '#fff',
                        padding: '10px 18px',
                        fontSize: '0.62rem',
                        fontFamily: 'Press Start 2P, monospace',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🖨️ PRINT PANELS (001-010)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttendanceModal(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid #666',
                        color: '#fff',
                        padding: '10px 16px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="arcade-footer">
          <span>ADMIN CONTROL SYSTEM</span>
          <span>LEVEL 3.0</span>
        </div>
      </div>
    </>
  );
}
