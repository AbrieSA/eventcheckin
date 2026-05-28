import React, { useState, useEffect } from 'react';
import Input from './Input';
import Button from './Button';
import BackButton from './BackButton';
import { Checkbox } from './Checkbox';
import { attendanceService } from '../../services/attendanceService';

const ROLE_OPTIONS = [
  { value: 'participant', label: 'Participant' },
  { value: 'leader', label: 'Leader' },
  { value: 'volunteer', label: 'Volunteer' },
];

const formatDateForInput = (value) => {
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const isoDateMatch = String(value)?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch?.[1]) {
    return isoDateMatch[1];
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate?.getTime())) {
    return '';
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const LogEventModal = ({ isOpen, onClose, participants, participantStages, onRemoveParticipant, activeEvent, onEventLogged }) => {
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventCategory, setEventCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [participantLabels, setParticipantLabels] = useState({});

  const handleLabelChange = (participantId, value) => {
    setParticipantLabels(prev => ({ ...prev, [participantId]: value }));
  };

  const getDefaultParticipantLabels = () =>
    (participants || [])?.reduce((labels, participant) => {
      if (participant?.is18OrOver) {
        labels[participant.id] = 'volunteer';
      }
      return labels;
    }, {});

  // Populate form fields when modal opens with active event data
  useEffect(() => {
    if (isOpen && activeEvent) {
      setEventName(activeEvent?.eventName || '');
      // Native date inputs only render YYYY-MM-DD values.
      setEventDate(formatDateForInput(activeEvent?.eventDate));
      setEventCategory(activeEvent?.eventCategory || '');
      setNotes('');
      setError('');
      // Initialize sensible defaults once when the modal opens.
      setParticipantLabels(getDefaultParticipantLabels());
    }
  }, [isOpen, activeEvent]);

  if (!isOpen) return null;

  // Get all participants that are in 'in' or 'out' stage
  const loggedParticipants = participants?.filter(p => 
    participantStages?.[p?.id] === 'in' || participantStages?.[p?.id] === 'out'
  ) || [];

  const handleLogEvent = async () => {
    // Validate required fields
    if (!eventName?.trim()) {
      setError('Event name is required');
      return;
    }
    if (!eventDate) {
      setError('Event date is required');
      return;
    }
    if (!eventCategory?.trim()) {
      setError('Event category is required');
      return;
    }

    if (loggedParticipants?.length === 0) {
      setError('No participants to log. Please check in at least one participant.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Prepare event data
      const eventData = {
        eventName,
        eventDate,
        eventCategory,
        notes: notes?.trim() || null
      };

      // Call service to log event
      await attendanceService?.logEvent(activeEvent?.id, eventData, participantStages, participantLabels);

      // Notify parent component that event was logged successfully
      onEventLogged?.();
      
      // Close modal
      onClose();
    } catch (err) {
      console.error('Error logging event:', err);
      setError(err?.message || 'Failed to log event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-border/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        {/* Header */}
        <div className="border-b border-border/70 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <BackButton
              onClick={onClose}
              iconOnly
              className="h-11 w-11"
              aria-label="Close modal"
              disabled={loading}
            />
            <h2 className="text-xl font-semibold text-gray-900">Log Event</h2>
          </div>
        </div>

        {/* Form Fields */}
        <div className="px-6 py-6 sm:px-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <Input
                type="text"
                placeholder="Event Name"
                value={eventName}
                onChange={(e) => setEventName(e?.target?.value)}
                className="w-full border-slate-200 bg-slate-50/80"
                disabled={loading}
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="Event Date"
                value={eventDate}
                onChange={(e) => setEventDate(e?.target?.value)}
                className="w-full border-slate-200 bg-slate-50/80"
                disabled={loading}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Event Category"
                value={eventCategory}
                onChange={(e) => setEventCategory(e?.target?.value)}
                className="w-full border-slate-200 bg-slate-50/80"
                disabled={loading}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e?.target?.value)}
                className="w-full border-slate-200 bg-slate-50/80"
                disabled={loading}
              />
            </div>
          </div>

          {/* Participants Table */}
          <div className="mb-8 overflow-hidden rounded-[24px] border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700 w-32">
                    Remove
                  </th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700">
                    Participant
                  </th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700 w-44">
                    Label
                  </th>
                  <th className="px-8 py-5 text-left text-sm font-semibold text-gray-700 w-40">
                    Checked Out?
                  </th>
                </tr>
              </thead>
              <tbody>
                {loggedParticipants?.length > 0 ? (
                  loggedParticipants?.map((participant) => {
                    const isCheckedOut = participantStages?.[participant?.id] === 'out';
                    const label = participantLabels?.[participant?.id] || 'participant';

                    return (
                      <tr key={participant?.id} className="border-b border-gray-200">
                        <td className="px-8 py-5">
                          <button
                            onClick={() => onRemoveParticipant?.(participant?.id)}
                            className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={loading}
                          >
                            Remove
                          </button>
                        </td>
                        <td className="px-8 py-5 text-sm text-gray-900">
                          {participant?.firstName} {participant?.lastName}
                        </td>
                        <td className="px-8 py-5">
                          <select
                            value={label}
                            onChange={(e) => handleLabelChange(participant?.id, e.target.value)}
                            disabled={loading}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center">
                            <Checkbox
                              variant="eventStatus"
                              checked={isCheckedOut}
                              disabled
                              size="actionSm"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="px-8 py-10 text-center text-sm text-gray-500">
                      No participants checked in yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              onClick={onClose}
              variant="surface"
              className="rounded-full px-6 py-3 text-gray-700 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogEvent}
              variant="primary"
              className="rounded-full px-6 py-3 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Logging...' : 'Log Event'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogEventModal;
