import React from 'react';
import Button from '../../../components/ui/Button';
import { buildCsv } from '../../../utils/csv';

const LABEL_STYLES = {
  leader: 'bg-purple-100 text-purple-700',
  volunteer: 'bg-blue-100 text-blue-700',
  participant: 'bg-gray-100 text-gray-600',
};

const LABEL_DISPLAY = {
  leader: 'Leader',
  volunteer: 'Volunteer',
  participant: 'Participant',
};

const EventDetailsModal = ({ event, onClose }) => {
  if (!event) return null;

  const handleBackdropClick = (e) => {
    if (e?.target === e?.currentTarget) {
      onClose();
    }
  };

  const handleExport = () => {
    const headers = ['Participant', 'Label', 'Checked Out?'];
    const rows = event?.attendanceRecords?.map(record => [
      `${record?.participant?.firstName || ''} ${record?.participant?.lastName || ''}`?.trim(),
      LABEL_DISPLAY[record?.label] || 'Participant',
      record?.checkedOutAt ? 'Yes' : 'No'
    ]);

    const csvContent = buildCsv(headers, rows);

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL?.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.eventName}_participants.csv`;
    document.body?.appendChild(a);
    a?.click();
    document.body?.removeChild(a);
    window.URL?.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[30px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        {/* Header with close button */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 sm:px-8">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
            Event Details
          </h2>
          <Button
            onClick={onClose}
            variant="surface"
            size="icon"
            className="rounded-full"
            iconName="X"
            aria-label="Close modal"
          />
        </div>

        {/* Event Details Section */}
        <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Event Name</label>
              <div className="text-gray-900">{event?.eventName}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Date</label>
              <div className="text-gray-900">
                {event?.eventDate ? new Date(event?.eventDate)?.toLocaleDateString('en-GB') : 'N/A'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Category</label>
              <div className="text-gray-900">{event?.category || 'N/A'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Notes</label>
              <div className="text-gray-900">{event?.notes || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Participants</h3>
          <div className="space-y-3">
            {event?.attendanceRecords?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No participants found
              </div>
            ) : (
              event?.attendanceRecords?.map((record) => {
                const label = record?.label || 'participant';
                return (
                  <div
                    key={record?.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-gray-900 font-medium">
                        {record?.participant?.firstName} {record?.participant?.lastName}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LABEL_STYLES[label] || LABEL_STYLES.participant}`}>
                        {LABEL_DISPLAY[label] || 'Participant'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Checked Out?</span>
                      <div className={`w-5 h-5 rounded ${
                        record?.checkedOutAt ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer with Export Button */}
        <div className="border-t border-slate-200 px-6 py-5 sm:px-8">
          <Button
            variant="surface"
            onClick={handleExport}
            className="w-full rounded-full"
          >
            Export List
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;
