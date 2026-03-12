import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import LogEventModal from '../../components/ui/LogEventModal';
import { attendanceService } from '../../services/attendanceService';
import AddAttendeeModal from '../../components/ui/AddAttendeeModal';
import { supabase } from '../../lib/supabase';


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
      filtered = filtered?.filter((p) => participantStages?.[p?.id] === 'in');
    } else if (activeFilter === 'out') {
      // Show participants who are checked out
      filtered = filtered?.filter((p) => participantStages?.[p?.id] === 'out');
    }

    return filtered;
  }, [searchQuery, participants, activeFilter, participantStages]);

  // Handle checkbox in Check-In tab - moves to In tab
  const handleCheckInToggle = async (participantId, checked) => {
    if (!activeEvent?.id) return;

    if (checked) {
      // Mark as pending transition
      setPendingTransitions((prev) => ({ ...prev, [participantId]: Date.now() }));

      // Set timeout for 2-second delay
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
      }, 2000);

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

      // Set timeout for 2-second delay
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
      }, 2000);

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

  const getRowBackgroundColor = (participantId) => {
    // Calculate green intensity based on time elapsed during pending transition
    const pendingStartTime = pendingTransitions?.[participantId];
    if (!pendingStartTime) return 'transparent';

    const elapsed = Date.now() - pendingStartTime;
    const progress = Math.min(elapsed / 2000, 1); // 0 to 1 over 2 seconds
    
    // Gradual green: from rgba(34, 197, 94, 0) to rgba(34, 197, 94, 0.3)
    const opacity = progress * 0.3;
    return `rgba(34, 197, 94, ${opacity})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading participants...</p>
        </div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-15 h-15 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors"
              aria-label="Go back">

              <Icon name="ArrowLeft" size={20} className="text-gray-600" />
            </button>

            {/* Log Event Button */}
            <Button
              onClick={handleLogEvent}
              className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors">

              Log Event
            </Button>

            {/* Event Name Input */}
            <div className="flex-1 max-w-md ml-6">
              <Input
                type="text"
                placeholder="Event Name"
                value={eventName}
                onChange={handleEventNameChange}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded text-center" />

            </div>
          </div>

          {/* Toggle Buttons */}
          <div className="flex gap-0 mb-6">
            <button
              onClick={() => setActiveFilter('check-in')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeFilter === 'check-in' ? 'bg-gray-300 text-gray-900' : 'bg-white text-gray-700 border border-gray-300'} rounded-l`
              }>
              Check-In
            </button>
            <button
              onClick={() => setActiveFilter('in')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeFilter === 'in' ? 'bg-gray-300 text-gray-900' : 'bg-white text-gray-700 border-t border-b border-gray-300'}`
              }>
              In
            </button>
            <button
              onClick={() => setActiveFilter('out')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeFilter === 'out' ? 'bg-gray-300 text-gray-900' : 'bg-white text-gray-700 border border-gray-300'} rounded-r`
              }>
              Out
            </button>
          </div>
        </div>

        {/* Search Bar and Add Attendee */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search Bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded" />

          </div>
          <Button
            onClick={() => setIsAddAttendeeModalOpen(true)}
            className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors whitespace-nowrap">

            Add Attendee
          </Button>
        </div>

        {/* Table - Different layouts for each tab */}
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
          {activeFilter === 'check-in' &&
          <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-40">
                    Check-In
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Participant
                  </th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Emergency Contact
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Alerts
                  </th>
                  

                </tr>
              </thead>
              <tbody>
                {filteredParticipants?.map((participant) => {
                  const isExpanded = expandedParticipants?.[participant?.id];
                  const bgColor = getRowBackgroundColor(participant?.id);
                  
                  return (
                    <React.Fragment key={participant?.id}>
                      <tr 
                        className="border-b border-gray-200 transition-colors duration-100"
                        style={{ backgroundColor: bgColor || 'transparent' }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              onChange={(e) => handleCheckInToggle(participant?.id, e?.target?.checked)}
                              className="w-12 h-12" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleParticipantExpansion(participant?.id)}
                            className="text-sm text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2 w-full text-left"
                          >
                            <span>{participant?.firstName} {participant?.lastName}</span>
                            <Icon 
                              name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                              size={16} 
                              className="text-gray-500"
                            />
                          </button>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-900">
                          {participant?.emergencyContactName || ''}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
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
                        <tr className="border-b border-gray-200 bg-gray-50">
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
                <tr className="border-b-2 border-gray-300">
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-40">
                    Checked Out
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Participant
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Alerts
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants?.map((participant) => {
                const isPending = !!pendingTransitions?.[participant?.id];
                const isCheckedOut = participantStages?.[participant?.id] === 'out' || isPending;
                const isExpanded = expandedParticipants?.[participant?.id];
                const bgColor = getRowBackgroundColor(participant?.id);

                return (
                  <React.Fragment key={participant?.id}>
                    <tr 
                      className="border-b border-gray-200 transition-colors duration-100"
                      style={{ backgroundColor: bgColor || 'transparent' }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <Checkbox
                          checked={isCheckedOut}
                          onChange={(e) => handleInTabToggle(participant?.id, e?.target?.checked)}
                          size="lg"
                          className="w-6 h-6" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleParticipantExpansion(participant?.id)}
                          className="text-sm text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2 w-full text-left"
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
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove from event"
                          >
                            <Icon name="Trash2" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="border-b border-gray-200 bg-gray-50">
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
                <tr className="border-b-2 border-gray-300">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Participant
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 w-32">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants?.map((participant) => {
                  const isExpanded = expandedParticipants?.[participant?.id];
                  
                  return (
                    <React.Fragment key={participant?.id}>
                      <tr className="border-b border-gray-200">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleParticipantExpansion(participant?.id)}
                            className="text-sm text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2 w-full text-left"
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
                          <Button
                            onClick={() => handleRemoveParticipant(participant?.id)}
                            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors text-sm"
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="border-b border-gray-200 bg-gray-50">
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