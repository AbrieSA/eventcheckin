import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import Input from './Input';
import Button from './Button';
import { Checkbox } from './Checkbox';
import { attendanceService } from '../../services/attendanceService';

const ROLE_OPTIONS = [
  { value: 'participant', label: 'Participant' },
  { value: 'leader', label: 'Leader' },
  { value: 'volunteer', label: 'Volunteer' },
];

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

  // Populate form fields when modal opens with active event data
  useEffect(() => {
    if (isOpen && activeEvent) {
      setEventName(activeEvent?.eventName || '');
      setEventDate(activeEvent?.eventDate || '');
      setEventCategory(activeEvent?.eventCategory || '');
      setNotes('');
      setError('');
      setParticipantLabels({});
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
      await attendanceService?.logEvent(activeEvent?.id, eventData, participantStages);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-8 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors"
              aria-label="Close modal"
              disabled={loading}
            >
              <Icon name="ArrowLeft" size={20} className="text-gray-600" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">Log Event</h2>
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-8">
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
                className="w-full px-4 py-3 border-2 border-gray-300 rounded"
                disabled={loading}
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="Event Date"
                value={eventDate}
                onChange={(e) => setEventDate(e?.target?.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded"
                disabled={loading}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Event Category"
                value={eventCategory}
                onChange={(e) => setEventCategory(e?.target?.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded"
                disabled={loading}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e?.target?.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded"
                disabled={loading}
              />
            </div>
          </div>

          {/* Participants Table */}
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
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
                            className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                              checked={isCheckedOut}
                              disabled
                              className="w-6 h-6"
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
              className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogEvent}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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