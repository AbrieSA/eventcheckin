import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { attendanceService } from '../../../services/attendanceService';

const AttendanceHistoryModal = ({ participant, onClose }) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttendance();
  }, [participant?.id]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const data = await attendanceService?.getParticipantAttendance(participant?.id);
      setAttendance(data || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
      alert('Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString)?.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleExport = () => {
    if (!attendance || attendance?.length === 0) {
      alert('No attendance records to export.');
      return;
    }

    // Prepare CSV data
    const headers = ['Event Name', 'Event Date'];
    const rows = attendance?.map(record => [
      record?.event?.eventName || 'N/A',
      formatDate(record?.event?.eventDate)
    ]);

    // Create CSV content
    const csvContent = [
      headers?.join(','),
      ...rows?.map(row => row?.map(cell => `"${cell}"`)?.join(','))
    ]?.join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const participantName = `${participant?.firstName || ''}_${participant?.lastName || ''}`?.trim();
    link?.setAttribute('href', url);
    link?.setAttribute('download', `${participantName}_attendance_history.csv`);
    link.style.visibility = 'hidden';
    document.body?.appendChild(link);
    link?.click();
    document.body?.removeChild(link);
  };

  const fullName = `${participant?.firstName || ''} ${participant?.lastName || ''}`?.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-8 py-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            {fullName} - Attendance History
          </h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || attendance?.length === 0}
              iconName="Download"
            >
              Export CSV
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close"
            >
              <Icon name="X" size={20} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : attendance?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Icon name="Calendar" size={48} className="text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">No Events Attended</p>
              <p className="text-sm text-muted-foreground">This participant has not attended any events yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendance?.map((record, index) => (
                <div
                  key={record?.id || index}
                  className="bg-muted/30 border border-border rounded-lg p-5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        {record?.event?.eventName || 'Unnamed Event'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record?.event?.eventDate)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && attendance?.length > 0 && (
          <div className="sticky bottom-0 bg-card border-t border-border px-8 py-5">
            <p className="text-sm text-muted-foreground">
              Total Events Attended: <span className="font-semibold text-foreground">{attendance?.length}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceHistoryModal;