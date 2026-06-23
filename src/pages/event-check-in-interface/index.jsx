import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import BackButton from '../../components/ui/BackButton';
import { Checkbox } from '../../components/ui/Checkbox';
import LogEventModal from '../../components/ui/LogEventModal';
import { attendanceService } from '../../services/attendanceService';
import AddAttendeeModal from '../../components/ui/AddAttendeeModal';
import { supabase } from '../../lib/supabase';

const TRANSITION_DELAY_MS = 1000;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

const isFormMissing = (participant) => participant?.formReceived === false;

const getMissingFormWeeks = (participant) => {
  if (!participant?.createdAt) return 0;

  const createdAt = new Date(participant?.createdAt)?.getTime();
  if (Number.isNaN(createdAt)) return 0;

  return Math.max(0, Math.floor((Date.now() - createdAt) / WEEK_IN_MS));
};

const getMissingFormLabel = (participant) => {
  const weeks = getMissingFormWeeks(participant);
  return `Form missing: ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
};

const EventCheckInInterface = () => {
  const navigate = useNavigate();
  const [eventName, setEventName] = useState('');
  const [activeEvent, setActiveEvent] = useState(null);
  const [activeFilter, setActiveFilter] = useState('check-in'); // 'check-in', 'in', 'out'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLogEventModalOpen, setIsLogEventModalOpen] = useState(false);
  const [isAddAttendeeModalOpen, setIsAddAttendeeModalOpen] = useState(false);

  // Three-stage tracking: null -> 'in' -> 'out'
  const [participantStages, setParticipantStages] = useState({});
  const [pendingTransitions, setPendingTransitions] = useState({});
  const transitionTimeoutsRef = useRef({});

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Track expanded participant rows
  const [expandedParticipants, setExpandedParticipants] = useState({});

  // Load participants on mount
  useEffect(() => {
    loadParticipants();
    loadActiveEvent();
  }, []);

  // Real-time subscription for attendance changes
  useEffect(() => {
    if (!activeEvent?.id) return;

    // Subscribe to attendance_records changes for the active event
    const channel = supabase?.channel('attendance-changes')?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `event_id=eq.${activeEvent?.id}`
        },
        (payload) => {
          handleAttendanceChange(payload);
        }
      )?.subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [activeEvent?.id]);

  // Animation loop for gradual green transition
  useEffect(() => {
    const hasPendingTransitions = Object.keys(pendingTransitions)?.length > 0;
    if (!hasPendingTransitions) return;

    // Force re-render every 50ms to update background color smoothly
    const intervalId = setInterval(() => {
      // Trigger re-render by updating a dummy state
      setParticipantStages((prev) => ({ ...prev }));
    }, 50);

    return () => clearInterval(intervalId);
  }, [pendingTransitions]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts when component unmounts
      Object.values(transitionTimeoutsRef?.current)?.forEach((timeoutId) => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    };
  }, [transitionTimeoutsRef?.current]);

  const handleAttendanceChange = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // Someone checked in
      const participantId = newRecord?.participant_id;
      setParticipantStages((prev) => ({
        ...prev,
        [participantId]: newRecord?.checked_out_at ? 'out' : 'in'
      }));
    } else if (eventType === 'UPDATE') {
      // Someone checked out (checked_out_at was updated)
      const participantId = newRecord?.participant_id;
      setParticipantStages((prev) => ({
        ...prev,
        [participantId]: newRecord?.checked_out_at ? 'out' : 'in'
      }));
    } else if (eventType === 'DELETE') {
      // Attendance record deleted
      const participantId = oldRecord?.participant_id;
      setParticipantStages((prev) => {
        const updated = { ...prev };
        delete updated?.[participantId];
        return updated;
      });
    }
  };

  const loadActiveEvent = async () => {
    try {
      const event = await attendanceService?.getActiveEvent();
      if (event) {
        setActiveEvent(event);
        setEventName(event?.eventName || '');
        // Load initial attendance state
        await loadAttendanceState(event?.id);
      }
    } catch (error) {
      console.error('Error loading active event:', error);
    }
  };

  // Create active event when user enters event name
  const handleEventNameChange = async (e) => {
    const newName = e?.target?.value;
    setEventName(newName);

    // If there's a name and no active event, create one
    if (newName?.trim() && !activeEvent) {
      try {
        const event = await attendanceService?.createActiveEvent({
          eventName: newName?.trim(),
          date: new Date()?.toISOString()?.split('T')?.[0],
          eventCategory: 'General'
        });
        setActiveEvent(event);
      } catch (error) {
        console.error('Error creating event:', error);
      }
    } else if (activeEvent && newName?.trim()) {
      // Update existing event name
      try {
        await attendanceService?.updateEvent(activeEvent?.id, {
          eventName: newName?.trim()
        });
      } catch (error) {
        console.error('Error updating event name:', error);
      }
    }
  };

  const loadAttendanceState = async (eventId) => {
    try {
      const records = await attendanceService?.getAttendanceRecords(eventId);
      const stages = {};
      records?.forEach((record) => {
        stages[record?.participantId] = record?.checkedOutAt ? 'out' : 'in';
      });
      setParticipantStages(stages);
    } catch (error) {
      console.error('Error loading attendance state:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const data = await attendanceService?.getAllParticipants();
      setParticipants(data || []);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load participants');
      console.error('Error loading participants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter participants based on active tab
  const filteredParticipants = useMemo(() => {
    let filtered = participants;

    // Filter by search query
    if (searchQuery?.trim()) {
      const query = searchQuery?.toLowerCase();
      filtered = filtered?.filter((p) =>
      `${p?.firstName} ${p?.lastName}`?.toLowerCase()?.includes(query)
      );
    }

    // Filter by active tab
    if (activeFilter === 'check-in') {
      // Show all participants who haven't been checked in yet
      filtered = filtered?.filter((p) => !participantStages?.[p?.id]);
    } else if (activeFilter === 'in') {
      // Show participants who are checked in but not checked out
      filtered = filtered
        ?.filter((p) => participantStages?.[p?.id] === 'in')
        ?.sort((a, b) => {
          const aIsAdult = Boolean(a?.is18OrOver);
          const bIsAdult = Boolean(b?.is18OrOver);

          if (aIsAdult !== bIsAdult) {
            return Number(bIsAdult) - Number(aIsAdult);
          }

          const aName = `${a?.firstName || ''} ${a?.lastName || ''}`?.trim();
          const bName = `${b?.firstName || ''} ${b?.lastName || ''}`?.trim();
          return aName.localeCompare(bName);
        });
    } else if (activeFilter === 'out') {
      // Show participants who are checked out
      filtered = filtered?.filter((p) => participantStages?.[p?.id] === 'out');
    }

    return filtered;
  }, [searchQuery, participants, activeFilter, participantStages]);

  const checkedInCount = useMemo(() =>
    Object.values(participantStages)?.filter((stage) => stage === 'in')?.length
  , [participantStages]);

  // Handle checkbox in Check-In tab - moves to In tab
  const handleCheckInToggle = async (participantId, checked) => {
    if (!activeEvent?.id) return;

    if (checked) {
      // Mark as pending transition
      setPendingTransitions((prev) => ({ ...prev, [participantId]: Date.now() }));

      // Set timeout for a short visual confirmation before moving tabs
      const timeoutId = setTimeout(async () => {
        // Move to 'in' column after delay
        setParticipantStages((prev) => ({
          ...prev,
          [participantId]: 'in'
        }));

        // Remove from pending using functional update
        setPendingTransitions((prev) => {
          const updated = { ...prev };
          delete updated?.[participantId];
          return updated;
        });

        // Remove timeout reference
        delete transitionTimeoutsRef?.current?.[participantId];

        // Update database
        try {
          await attendanceService?.checkIn(activeEvent?.id, participantId);
        } catch (error) {
          console.error('Error updating check-in:', error);
          // Revert on error
          setParticipantStages((prev) => {
            const updated = { ...prev };
            delete updated?.[participantId];
            return updated;
          });
        }
      }, TRANSITION_DELAY_MS);

      // Store timeout ID for potential cancellation
      transitionTimeoutsRef.current[participantId] = timeoutId;
    } else {
      // Cancel pending transition if unchecked during delay
      const timeoutId = transitionTimeoutsRef?.current?.[participantId];
      if (timeoutId) {
        clearTimeout(timeoutId);
        delete transitionTimeoutsRef?.current?.[participantId];
      }

      // Remove from pending
      setPendingTransitions((prev) => {
        const updated = { ...prev };
        delete updated?.[participantId];
        return updated;
      });

      // If already in 'in' stage, remove it
      if (participantStages?.[participantId] === 'in') {
        setParticipantStages((prev) => {
          const updated = { ...prev };
          delete updated?.[participantId];
          return updated;
        });

        // Remove from database
        try {
          await attendanceService?.deleteAttendanceRecord(activeEvent?.id, participantId);
        } catch (error) {
          console.error('Error deleting check-in:', error);
        }
      }
    }
  };

  // Handle checkbox in In tab - moves to Out tab
  const handleInTabToggle = async (participantId, checked) => {
    if (!activeEvent?.id) return;

    if (checked) {
      // Mark as pending transition
      setPendingTransitions((prev) => ({ ...prev, [participantId]: Date.now() }));

      // Set timeout for a short visual confirmation before moving tabs
      const timeoutId = setTimeout(async () => {
        // Move to 'out' column after delay
        setParticipantStages((prev) => ({
          ...prev,
          [participantId]: 'out'
        }));

        // Remove from pending
        setPendingTransitions((prev) => {
          const updated = { ...prev };
          delete updated?.[participantId];
          return updated;
        });

        // Remove timeout reference
        delete transitionTimeoutsRef?.current?.[participantId];

        // Update database
        try {
          await attendanceService?.checkOut(activeEvent?.id, participantId);
        } catch (error) {
          console.error('Error updating check-out:', error);
          // Revert on error
          setParticipantStages((prev) => ({
            ...prev,
            [participantId]: 'in'
          }));
        }
      }, TRANSITION_DELAY_MS);

      // Store timeout ID for potential cancellation
      transitionTimeoutsRef.current[participantId] = timeoutId;
    } else {
      // Cancel pending transition if unchecked during delay
      const timeoutId = transitionTimeoutsRef?.current?.[participantId];
      if (timeoutId) {
        clearTimeout(timeoutId);
        delete transitionTimeoutsRef?.current?.[participantId];
      }

      // Remove from pending
      setPendingTransitions((prev) => {
        const updated = { ...prev };
        delete updated?.[participantId];
        return updated;
      });

      // If already in 'out' stage, move back to 'in'
      if (participantStages?.[participantId] === 'out') {
        setParticipantStages((prev) => ({
          ...prev,
          [participantId]: 'in'
        }));

        // Update database
        try {
          await attendanceService?.uncheckOut(activeEvent?.id, participantId);
        } catch (error) {
          console.error('Error unchecking out:', error);
        }
      }
    }
  };

  const handleLogEvent = () => {
    setIsLogEventModalOpen(true);
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!activeEvent?.id) return;

    // Store previous state for potential rollback
    const previousStage = participantStages?.[participantId];

    // Optimistic update - move from 'out' to 'in'
    setParticipantStages((prev) => ({
      ...prev,
      [participantId]: 'in'
    }));

    try {
      // Update attendance record to remove check-out time
      await attendanceService?.removeCheckOut(activeEvent?.id, participantId);
      console.log(`Successfully moved participant ${participantId} from 'out' to 'in'`);
    } catch (error) {
      console.error('Error removing participant from out:', error);
      // Revert optimistic update on error - restore previous state
      setParticipantStages((prev) => ({
        ...prev,
        [participantId]: previousStage
      }));
    }
  };

  // Remove participant from "In" tab - deletes attendance record completely
  const handleRemoveFromIn = async (participantId) => {
    if (!activeEvent?.id) return;

    // Store previous state for potential rollback
    const previousStage = participantStages?.[participantId];

    // Optimistic update - remove from participantStages (moves back to check-in)
    setParticipantStages((prev) => {
      const updated = { ...prev };
      delete updated?.[participantId];
      return updated;
    });

    try {
      // Delete attendance record from database
      await attendanceService?.deleteAttendanceRecord(activeEvent?.id, participantId);
      console.log(`Successfully removed participant ${participantId} from 'in' - moved back to check-in`);
    } catch (error) {
      console.error('Error removing participant from in:', error);
      // Revert optimistic update on error - restore previous state
      setParticipantStages((prev) => ({
        ...prev,
        [participantId]: previousStage
      }));
    }
  };

  const handleAddAttendee = async (attendeeData) => {
    try {
      // Refresh participants list after adding new attendee
      await loadParticipants();
    } catch (error) {
      console.error('Error refreshing participants:', error);
    }
  };
  
  // Toggle participant details expansion
  const toggleParticipantExpansion = (participantId) => {
    setExpandedParticipants((prev) => ({
      ...prev,
      [participantId]: !prev?.[participantId]
    }));
  };

  const handleEventLogged = async () => {
    // Clear active event state
    setActiveEvent(null);
    setEventName('');
    setParticipantStages({});
    
    // Navigate to home screen
    navigate('/');
  };

  const getRowBackgroundColor = (participant) => {
    // Calculate green intensity based on time elapsed during pending transition
    const participantId = participant?.id;
    const pendingStartTime = pendingTransitions?.[participantId];
    if (!pendingStartTime) {
      return isFormMissing(participant) ? 'rgba(254, 226, 226, 0.65)' : 'transparent';
    }

    const elapsed = Date.now() - pendingStartTime;
    const progress = Math.min(elapsed / TRANSITION_DELAY_MS, 1); // 0 to 1 over the transition delay
    
    // Gradual green: from rgba(34, 197, 94, 0) to rgba(34, 197, 94, 0.3)
    const opacity = progress * 0.3;
    return `rgba(34, 197, 94, ${opacity})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading participants...</p>
        </div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/20 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-6">
          <div className="mb-4 rounded-[30px] border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Back Button */}
              <BackButton
                onClick={() => navigate('/home-dashboard')}
                className="self-start"
                aria-label="Return to dashboard"
              >
                Back
              </BackButton>

            {/* Log Event Button */}
              <Button
                onClick={handleLogEvent}
                variant="surface"
                className="h-11 rounded-full px-6 text-sm font-semibold text-slate-700"
              >
                Log Event
              </Button>

            {/* Event Name Input */}
              <div className="flex-1 lg:ml-auto lg:max-w-lg">
                <Input
                  type="text"
                  placeholder="Event Name"
                  value={eventName}
                  onChange={handleEventNameChange}
                  className="w-full border-slate-200 bg-slate-50/80 text-center font-medium"
                />
              </div>
            </div>
            </div>

          {/* Toggle Buttons */}
          <div className="mb-6 flex gap-1 rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm">
            <button
              onClick={() => setActiveFilter('check-in')}
              className={`flex-1 rounded-full px-6 py-3 font-medium transition-all ${
              activeFilter === 'check-in' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`
              }>
              Check-In
            </button>
            <button
              onClick={() => setActiveFilter('in')}
              className={`flex-1 rounded-full px-6 py-3 font-medium transition-all ${
              activeFilter === 'in' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`
              }>
              In ({checkedInCount})
            </button>
            <button
              onClick={() => setActiveFilter('out')}
              className={`flex-1 rounded-full px-6 py-3 font-medium transition-all ${
              activeFilter === 'out' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`
              }>
              Out
            </button>
          </div>
        </div>

        {/* Search Bar and Add Attendee */}
        <div className="mb-6 flex flex-col gap-3 rounded-[28px] border border-slate-200/80 bg-white/90 p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search Bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value)}
              className="w-full border-slate-200 bg-slate-50/80" />
          </div>
          <Button
            onClick={() => setIsAddAttendeeModalOpen(true)}
            variant="surface"
            className="h-11 rounded-full px-6 font-semibold text-slate-700 whitespace-nowrap">
            Add Attendee
          </Button>
        </div>

        {/* Table - Different layouts for each tab */}
        <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-sm">
          {activeFilter === 'check-in' &&
          <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 w-40">
                    Check-In
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Participant
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Emergency Contact
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Alerts
                  </th>
                  

                </tr>
              </thead>
              <tbody>
                {filteredParticipants?.map((participant) => {
                  const isExpanded = expandedParticipants?.[participant?.id];
                  const bgColor = getRowBackgroundColor(participant);
                  
                  return (
                    <React.Fragment key={participant?.id}>
                      <tr 
                        className="border-b border-slate-200 transition-colors duration-100"
                        style={{ backgroundColor: bgColor || 'transparent' }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              variant="eventAction"
                              size="action"
                              onChange={(e) => handleCheckInToggle(participant?.id, e?.target?.checked)}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleParticipantExpansion(participant?.id)}
                            className="flex w-full items-center gap-2 text-left text-sm text-slate-900 transition-colors hover:text-primary"
                          >
                            <span>{participant?.firstName} {participant?.lastName}</span>
                            <Icon 
                              name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                              size={16} 
                              className="text-gray-500"
                            />
                          </button>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-900">
                          {participant?.emergencyContactName || ''}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isFormMissing(participant) &&
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100" title={getMissingFormLabel(participant)}>
                                <Icon name="FileWarning" size={16} className="text-red-600" />
                              </div>
                            }
                            {participant?.hasAllergies &&
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100" title="Has Allergies">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2C12 2 8 6 8 10C8 12.21 9.79 14 12 14C14.21 14 16 12.21 16 10C16 6 12 2 12 2Z" fill="#D97706" />
                                  <path d="M7 10C7 10 3 12 3 15C3 16.66 4.34 18 6 18C7.66 18 9 16.66 9 15C9 12 7 10 7 10Z" fill="#D97706" />
                                  <path d="M17 10C17 10 21 12 21 15C21 16.66 19.66 18 18 18C16.34 18 15 16.66 15 15C15 12 17 10 17 10Z" fill="#D97706" />
                                  <path d="M12 14C12 14 9 16 9 19C9 20.66 10.34 22 12 22C13.66 22 15 20.66 15 19C15 16 12 14 12 14Z" fill="#D97706" />
                                  <line x1="3" y1="21" x2="21" y2="3" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </div>
                            }
                            {participant?.hasMedicalConditions &&
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100" title="Has Medical Conditions">
                                <Icon name="Heart" size={16} className="text-red-600" />
                              </div>
                            }
                            {participant?.is18OrOver &&
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100" title="18 or Over">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <text x="2" y="16" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="#DC2626">18</text>
                                  <path d="M18 8L22 4M22 4L18 0M22 4H14" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0, 8)" />
                                </svg>
                              </div>
                            }
                            {participant?.mediaConsentGiven === false &&
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100" title="No Media Consent">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="#6B7280" strokeWidth="2" fill="none" />
                                  <circle cx="12" cy="12" r="3" stroke="#6B7280" strokeWidth="2" fill="none" />
                                  <line x1="3" y1="21" x2="21" y2="3" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </div>
                            }
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="border-b border-slate-200 bg-slate-50/70">
                          <td colSpan="3" className="md:hidden px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Emergency Contact Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="Phone" size={16} className="text-blue-600" />
                                  <span>Emergency Contact</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Name: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.emergencyContactName} {participant?.emergencyContactSurname}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Phone: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactPhone || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Email: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactEmail || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Relationship: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactRelationshipToMinor || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Person to Go Home With: </span>
                                    <span className="text-gray-900 font-medium">{participant?.personToGoHomeWith || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Personal Contact Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="User" size={16} className="text-blue-600" />
                                  <span>Personal Details</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Phone: </span>
                                    <span className="text-gray-900 font-medium">{participant?.phone || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Email: </span>
                                    <span className="text-gray-900 font-medium">{participant?.email || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Age: </span>
                                    <span className="text-gray-900 font-medium">{participant?.age || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Medical & Alert Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="AlertCircle" size={16} className="text-red-600" />
                                  <span>Medical Information</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Allergies: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.hasAllergies ? (participant?.allergiesDetails || 'Yes') : 'None'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Medical Conditions: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.hasMedicalConditions ? (participant?.medicalConditionDetails || participant?.medicalNotes || 'Yes') : 'None'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Consent Information */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="FileText" size={16} className="text-green-600" />
                                  <span>Consent Information</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {isFormMissing(participant) && (
                                    <div className="flex items-center gap-2">
                                      <Icon name="FileWarning" size={14} className="text-red-600" />
                                      <span className="font-medium text-red-700">{getMissingFormLabel(participant)}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.mediaConsentGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.mediaConsentGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Media Consent</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.emergencyTreatmentConsentGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.emergencyTreatmentConsentGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Emergency Treatment Consent</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.futureContactPermissionGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.futureContactPermissionGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Future Contact Permission</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.selfSignOutPermission ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.selfSignOutPermission ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Self-Sign-Out</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td colSpan="4" className="hidden md:table-cell px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Emergency Contact Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="Phone" size={16} className="text-blue-600" />
                                  <span>Emergency Contact</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Name: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.emergencyContactName} {participant?.emergencyContactSurname}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Phone: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactPhone || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Email: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactEmail || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Relationship: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactRelationshipToMinor || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Person to Go Home With: </span>
                                    <span className="text-gray-900 font-medium">{participant?.personToGoHomeWith || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Personal Contact Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="User" size={16} className="text-blue-600" />
                                  <span>Personal Details</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Phone: </span>
                                    <span className="text-gray-900 font-medium">{participant?.phone || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Email: </span>
                                    <span className="text-gray-900 font-medium">{participant?.email || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Age: </span>
                                    <span className="text-gray-900 font-medium">{participant?.age || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Medical & Alert Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="AlertCircle" size={16} className="text-red-600" />
                                  <span>Medical Information</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Allergies: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.hasAllergies ? (participant?.allergiesDetails || 'Yes') : 'None'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Medical Conditions: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.hasMedicalConditions ? (participant?.medicalConditionDetails || participant?.medicalNotes || 'Yes') : 'None'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Consent Information */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="FileText" size={16} className="text-green-600" />
                                  <span>Consent Information</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {isFormMissing(participant) && (
                                    <div className="flex items-center gap-2">
                                      <Icon name="FileWarning" size={14} className="text-red-600" />
                                      <span className="font-medium text-red-700">{getMissingFormLabel(participant)}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.mediaConsentGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.mediaConsentGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Media Consent</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.emergencyTreatmentConsentGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.emergencyTreatmentConsentGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Emergency Treatment Consent</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.futureContactPermissionGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.futureContactPermissionGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Future Contact Permission</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.selfSignOutPermission ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.selfSignOutPermission ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Self-Sign-Out</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          }

          {activeFilter === 'in' &&
          <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 w-40">
                    Checked Out
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Participant
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Alerts
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants?.map((participant) => {
                const isPending = !!pendingTransitions?.[participant?.id];
                const isCheckedOut = participantStages?.[participant?.id] === 'out' || isPending;
                const isExpanded = expandedParticipants?.[participant?.id];
                const bgColor = getRowBackgroundColor(participant);

                return (
                  <React.Fragment key={participant?.id}>
                    <tr 
                      className="border-b border-slate-200 transition-colors duration-100"
                      style={{ backgroundColor: bgColor || 'transparent' }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <Checkbox
                          variant="eventAction"
                          checked={isCheckedOut}
                          onChange={(e) => handleInTabToggle(participant?.id, e?.target?.checked)}
                          size="action" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleParticipantExpansion(participant?.id)}
                          className="flex w-full items-center gap-2 text-left text-sm text-slate-900 transition-colors hover:text-primary"
                        >
                          <span>{participant?.firstName} {participant?.lastName}</span>
                          <Icon 
                            name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                            size={16} 
                            className="text-gray-500"
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isFormMissing(participant) &&
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100" title={getMissingFormLabel(participant)}>
                              <Icon name="FileWarning" size={16} className="text-red-600" />
                            </div>
                          }
                          {participant?.hasAllergies &&
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100" title="Has Allergies">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C12 2 8 6 8 10C8 12.21 9.79 14 12 14C14.21 14 16 12.21 16 10C16 6 12 2 12 2Z" fill="#D97706" />
                                <path d="M7 10C7 10 3 12 3 15C3 16.66 4.34 18 6 18C7.66 18 9 16.66 9 15C9 12 7 10 7 10Z" fill="#D97706" />
                                <path d="M17 10C17 10 21 12 21 15C21 16.66 19.66 18 18 18C16.34 18 15 16.66 15 15C15 12 17 10 17 10Z" fill="#D97706" />
                                <path d="M12 14C12 14 9 16 9 19C9 20.66 10.34 22 12 22C13.66 22 15 20.66 15 19C15 16 12 14 12 14Z" fill="#D97706" />
                                <line x1="3" y1="21" x2="21" y2="3" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </div>
                          }
                          {participant?.hasMedicalConditions &&
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100" title="Has Medical Conditions">
                              <Icon name="Heart" size={16} className="text-red-600" />
                            </div>
                          }
                          {participant?.is18OrOver &&
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100" title="18 or Over">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <text x="2" y="16" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="#DC2626">18</text>
                                <path d="M18 8L22 4M22 4L18 0M22 4H14" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(0, 8)" />
                              </svg>
                            </div>
                          }
                          {participant?.mediaConsentGiven === false &&
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100" title="No Media Consent">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="5" width="20" height="14" rx="2" stroke="#6B7280" strokeWidth="2" fill="none" />
                                <circle cx="12" cy="12" r="3" stroke="#6B7280" strokeWidth="2" fill="none" />
                                <line x1="3" y1="21" x2="21" y2="3" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </div>
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleRemoveFromIn(participant?.id)}
                            className="rounded-full p-2 text-red-600 transition-colors hover:bg-red-50"
                            title="Remove from event"
                          >
                            <Icon name="Trash2" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        <td colSpan="4" className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Emergency Contact Details */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon name="Phone" size={16} className="text-blue-600" />
                                <span>Emergency Contact</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-gray-600">Name: </span>
                                  <span className="text-gray-900 font-medium">
                                    {participant?.emergencyContactName} {participant?.emergencyContactSurname}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Phone: </span>
                                  <span className="text-gray-900 font-medium">{participant?.emergencyContactPhone || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Email: </span>
                                  <span className="text-gray-900 font-medium">{participant?.emergencyContactEmail || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Relationship: </span>
                                  <span className="text-gray-900 font-medium">{participant?.emergencyContactRelationshipToMinor || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Person to Go Home With: </span>
                                  <span className="text-gray-900 font-medium">{participant?.personToGoHomeWith || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Personal Contact Details */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon name="User" size={16} className="text-blue-600" />
                                <span>Personal Details</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-gray-600">Phone: </span>
                                  <span className="text-gray-900 font-medium">{participant?.phone || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Email: </span>
                                  <span className="text-gray-900 font-medium">{participant?.email || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Age: </span>
                                  <span className="text-gray-900 font-medium">{participant?.age || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Medical & Alert Details */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon name="AlertCircle" size={16} className="text-red-600" />
                                <span>Medical Information</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-gray-600">Allergies: </span>
                                  <span className="text-gray-900 font-medium">
                                    {participant?.hasAllergies ? (participant?.allergiesDetails || 'Yes') : 'None'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Medical Conditions: </span>
                                  <span className="text-gray-900 font-medium">
                                    {participant?.hasMedicalConditions ? (participant?.medicalConditionDetails || participant?.medicalNotes || 'Yes') : 'None'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Consent Information */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon name="FileText" size={16} className="text-green-600" />
                                <span>Consent Information</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                {isFormMissing(participant) && (
                                  <div className="flex items-center gap-2">
                                    <Icon name="FileWarning" size={14} className="text-red-600" />
                                    <span className="font-medium text-red-700">{getMissingFormLabel(participant)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Icon 
                                    name={participant?.mediaConsentGiven ? "CheckCircle" : "XCircle"} 
                                    size={14} 
                                    className={participant?.mediaConsentGiven ? "text-green-600" : "text-gray-400"}
                                  />
                                  <span className="text-gray-600">Media Consent</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Icon 
                                    name={participant?.emergencyTreatmentConsentGiven ? "CheckCircle" : "XCircle"} 
                                    size={14} 
                                    className={participant?.emergencyTreatmentConsentGiven ? "text-green-600" : "text-gray-400"}
                                  />
                                  <span className="text-gray-600">Emergency Treatment Consent</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Icon 
                                    name={participant?.futureContactPermissionGiven ? "CheckCircle" : "XCircle"} 
                                    size={14} 
                                    className={participant?.futureContactPermissionGiven ? "text-green-600" : "text-gray-400"}
                                  />
                                  <span className="text-gray-600">Future Contact Permission</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Icon 
                                    name={participant?.selfSignOutPermission ? "CheckCircle" : "XCircle"} 
                                    size={14} 
                                    className={participant?.selfSignOutPermission ? "text-green-600" : "text-gray-400"}
                                  />
                                  <span className="text-gray-600">Self-Sign-Out</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );

              })}
              </tbody>
            </table>
          }

          {activeFilter === 'out' &&
          <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Participant
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 w-32">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants?.map((participant) => {
                  const isExpanded = expandedParticipants?.[participant?.id];
                  const bgColor = getRowBackgroundColor(participant);
                  
                  return (
                    <React.Fragment key={participant?.id}>
                      <tr
                        className="border-b border-slate-200 transition-colors duration-100"
                        style={{ backgroundColor: bgColor || 'transparent' }}
                      >
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleParticipantExpansion(participant?.id)}
                            className="flex w-full items-center gap-2 text-left text-sm text-slate-900 transition-colors hover:text-primary"
                          >
                            <span>{participant?.firstName} {participant?.lastName}</span>
                            {isFormMissing(participant) &&
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100" title={getMissingFormLabel(participant)}>
                                <Icon name="FileWarning" size={15} className="text-red-600" />
                              </span>
                            }
                            <Icon 
                              name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                              size={16} 
                              className="text-gray-500"
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            onClick={() => handleRemoveParticipant(participant?.id)}
                            variant="surface"
                            className="h-10 rounded-full px-4 text-sm font-semibold text-slate-700"
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="border-b border-slate-200 bg-slate-50/70">
                          <td colSpan="2" className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Emergency Contact Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="Phone" size={16} className="text-blue-600" />
                                  <span>Emergency Contact</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Name: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.emergencyContactName} {participant?.emergencyContactSurname}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Phone: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactPhone || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Email: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactEmail || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Relationship: </span>
                                    <span className="text-gray-900 font-medium">{participant?.emergencyContactRelationshipToMinor || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Person to Go Home With: </span>
                                    <span className="text-gray-900 font-medium">{participant?.personToGoHomeWith || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Personal Contact Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="User" size={16} className="text-blue-600" />
                                  <span>Personal Details</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Phone: </span>
                                    <span className="text-gray-900 font-medium">{participant?.phone || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Email: </span>
                                    <span className="text-gray-900 font-medium">{participant?.email || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Age: </span>
                                    <span className="text-gray-900 font-medium">{participant?.age || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Medical & Alert Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="AlertCircle" size={16} className="text-red-600" />
                                  <span>Medical Information</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Allergies: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.hasAllergies ? (participant?.allergiesDetails || 'Yes') : 'None'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Medical Conditions: </span>
                                    <span className="text-gray-900 font-medium">
                                      {participant?.hasMedicalConditions ? (participant?.medicalConditionDetails || participant?.medicalNotes || 'Yes') : 'None'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Consent Information */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Icon name="FileText" size={16} className="text-green-600" />
                                  <span>Consent Information</span>
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {isFormMissing(participant) && (
                                    <div className="flex items-center gap-2">
                                      <Icon name="FileWarning" size={14} className="text-red-600" />
                                      <span className="font-medium text-red-700">{getMissingFormLabel(participant)}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.mediaConsentGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.mediaConsentGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Media Consent</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.emergencyTreatmentConsentGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.emergencyTreatmentConsentGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Emergency Treatment Consent</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.futureContactPermissionGiven ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.futureContactPermissionGiven ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Future Contact Permission</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon 
                                      name={participant?.selfSignOutPermission ? "CheckCircle" : "XCircle"} 
                                      size={14} 
                                      className={participant?.selfSignOutPermission ? "text-green-600" : "text-gray-400"}
                                    />
                                    <span className="text-gray-600">Self-Sign-Out</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          }
        </div>

        {error &&
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        }
      </div>
      {/* Log Event Modal */}
      <LogEventModal
        isOpen={isLogEventModalOpen}
        onClose={() => setIsLogEventModalOpen(false)}
        participants={participants}
        participantStages={participantStages}
        onRemoveParticipant={handleRemoveParticipant}
        activeEvent={activeEvent}
        onEventLogged={handleEventLogged}
      />
      {/* Add Attendee Modal */}
      <AddAttendeeModal
        isOpen={isAddAttendeeModalOpen}
        onClose={() => setIsAddAttendeeModalOpen(false)}
        onAddAttendee={handleAddAttendee}
      />
    </div>
  );

 };

export default EventCheckInInterface;
