import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { attendanceService } from '../../services/attendanceService';
import { reportError } from '../../services/errorReportingService';
import ParticipantDetailsModal from './components/ParticipantDetailsModal';
import ExportModal from './components/ExportModal';
import AttendanceHistoryModal from './components/AttendanceHistoryModal';
import AddAttendeeModal from '../../components/ui/AddAttendeeModal';
import { supabase } from '../../lib/supabase';

const DatabaseParticipants = () => {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchEvents, setSearchEvents] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [attendanceCounts, setAttendanceCounts] = useState({});
  const [selectedAttendanceParticipant, setSelectedAttendanceParticipant] = useState(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null); // null | 'sending' | 'sent' | 'failed'
  const [errorLogStatus, setErrorLogStatus] = useState(null); // null | 'downloading' | 'done' | 'failed'

  useEffect(() => {
    loadParticipants();
  }, []);

  useEffect(() => {
    filterParticipants();
  }, [searchName, searchEvents, participants]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const data = await attendanceService?.getAllParticipants();
      setParticipants(data || []);
      setFilteredParticipants(data || []);
      
      // Load attendance counts for all participants
      await loadAttendanceCounts(data || []);
    } catch (error) {
      console.error('Error loading participants:', error);
      alert('Failed to load participants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceCounts = async (participantsList) => {
    try {
      const counts = {};
      for (const participant of participantsList) {
        const attendance = await attendanceService?.getParticipantAttendance(participant?.id);
        counts[participant?.id] = attendance?.length || 0;
      }
      setAttendanceCounts(counts);
    } catch (error) {
      console.error('Error loading attendance counts:', error);
    }
  };

  const filterParticipants = () => {
    let filtered = [...participants];

    // Filter by participant name
    if (searchName?.trim()) {
      filtered = filtered?.filter((p) => {
        const fullName = `${p?.firstName || ''} ${p?.lastName || ''}`?.toLowerCase();
        return fullName?.includes(searchName?.toLowerCase());
      });
    }

    // Filter by events attended (placeholder - would need attendance records)
    if (searchEvents?.trim()) {




      // This would require joining with attendance_records table
      // For now, just a placeholder filter
    }setFilteredParticipants(filtered);};
  const handleExport = () => {
    setShowExportModal(true);
    setShowOptions(false);
  };

  const handleAddParticipant = () => {
    setShowAddParticipantModal(true);
    setShowOptions(false);
  };

  const handleParticipantAdded = async (newParticipant) => {
    // Reload participants to include the new one
    await loadParticipants();
    setShowAddParticipantModal(false);
  };

  const handleParticipantClick = (participant) => {
    setSelectedParticipant(participant);
  };

  const handleCloseModal = () => {
    setSelectedParticipant(null);
  };

  const handleUpdateParticipant = (updatedParticipant) => {
    // Update the participant in the local state
    setParticipants((prev) =>
    prev?.map((p) => p?.id === updatedParticipant?.id ? updatedParticipant : p)
    );
    setFilteredParticipants((prev) =>
    prev?.map((p) => p?.id === updatedParticipant?.id ? updatedParticipant : p)
    );
  };

  const handleDeleteParticipant = async (participantId) => {
    try {
      await attendanceService?.deleteParticipant(participantId);
      setParticipants((prev) => prev?.filter((p) => p?.id !== participantId));
      setFilteredParticipants((prev) => prev?.filter((p) => p?.id !== participantId));
    } catch (error) {
      console.error('Error deleting participant:', error);
      alert(`Failed to delete participant: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleAttendanceClick = (participant) => {
    setSelectedAttendanceParticipant(participant);
  };

  const handleCloseAttendanceModal = () => {
    setSelectedAttendanceParticipant(null);
  };

  const handleTestErrorEmail = async () => {
    setShowOptions(false);
    setTestEmailStatus('sending');
    try {
      await reportError({
        errorType: 'Test Error',
        message: 'This is a manual test error triggered from the Database page to verify error email delivery.',
        stack: 'TestError: Manual trigger\n    at handleTestErrorEmail (database-participants/index.jsx)\n    at HTMLButtonElement.onClick',
        context: 'Manual test — Database Participants page',
      });
      setTestEmailStatus('sent');
    } catch (_) {
      setTestEmailStatus('failed');
    }
    setTimeout(() => setTestEmailStatus(null), 4000);
  };

  const handleDownloadErrorLog = async () => {
    setShowOptions(false);
    setErrorLogStatus('downloading');
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo?.setMonth(oneMonthAgo?.getMonth() - 1);

      const { data, error } = await supabase?.from('audit_logs')?.select('id, table_name, record_id, action_type, change_description, changed_fields, record_name, changed_at, changed_by')?.gte('changed_at', oneMonthAgo?.toISOString())?.order('changed_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const headers = ['ID', 'Table', 'Record ID', 'Record Name', 'Action', 'Description', 'Changed Fields', 'Changed By', 'Timestamp'];
      const csvRows = rows?.map(row => [
        row?.id || '',
        row?.table_name || '',
        row?.record_id || '',
        row?.record_name || '',
        row?.action_type || '',
        (row?.change_description || '')?.replace(/"/g, '""'),
        (row?.changed_fields || '')?.replace(/"/g, '""'),
        row?.changed_by || '',
        row?.changed_at ? new Date(row.changed_at)?.toLocaleString() : '',
      ]?.map(v => `"${v}"`)?.join(','));

      const csvContent = [headers?.join(','), ...csvRows]?.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date()?.toISOString()?.slice(0, 10);
      link.href = url;
      link.download = `error-log-${dateStr}.csv`;
      document.body?.appendChild(link);
      link?.click();
      document.body?.removeChild(link);
      URL.revokeObjectURL(url);
      setErrorLogStatus('done');
      setTimeout(() => setErrorLogStatus(null), 3000);
    } catch (err) {
      console.error('Error downloading error log:', err);
      setErrorLogStatus('failed');
      setTimeout(() => setErrorLogStatus(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <button
              onClick={() => navigate('/home-dashboard')}
              className="flex items-center space-x-2 sm:space-x-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-2 hover:bg-primary/5 transition-colors"
              aria-label="Home">

              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg">
                <Icon name="Home" size={24} className="text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Database</h1>
            </button>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Search Filters and Options */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-4 sm:p-6 mb-6 pt-[15px] pb-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-4">
            {/* Participant Name Filter */}
            <div className="flex-1 w-full sm:w-auto">
              <Input
                type="text"
                label="Participant Name"
                placeholder="Search by name..."
                value={searchName}
                onChange={(e) => setSearchName(e?.target?.value)}
                className="w-full py-5" />

            </div>

            {/* Options Dropdown */}
            <div className="relative w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowOptions(!showOptions)}
                className="w-full sm:w-auto min-w-[120px] justify-between"
                iconName="ChevronDown"
                iconPosition="right">

                Options
              </Button>
              {showOptions &&
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
                  <button
                  onClick={() => {
                    handleAddParticipant();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg flex items-center space-x-3 text-gray-900 dark:text-gray-100 font-medium">
                    <Icon name="UserPlus" size={18} className="text-gray-700 dark:text-gray-300" />
                    <span className="text-base">Add Participant</span>
                  </button>
                  <button
                  onClick={() => {
                    handleExport();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3 text-gray-900 dark:text-gray-100 font-medium">

                    <Icon name="Download" size={18} className="text-gray-700 dark:text-gray-300" />
                    <span className="text-base">List export</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          {loading ?
          <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div> :
          filteredParticipants?.length === 0 ?
          <div className="flex flex-col items-center justify-center py-12 px-4">
              <Icon name="Users" size={48} className="text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">No participants found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search filters</p>
            </div> :

          <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Emergency Contact
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Events Attended
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants?.map((participant, index) => {
                  const fullName = `${participant?.firstName || ''} ${participant?.lastName || ''}`?.trim() || 'N/A';
                  const ecName = participant?.emergencyContactName || 'N/A';
                  const hasMedical = participant?.hasMedicalConditions;
                  const hasAllergies = participant?.hasAllergies;
                  const eventsCount = attendanceCounts?.[participant?.id] || 0;

                  return (
                    <tr
                      key={participant?.id || index}
                      className="border-b border-border hover:bg-muted/30 transition-colors">

                        <td className="px-4 py-4">
                          <button
                          onClick={() => handleParticipantClick(participant)}
                          className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded">

                            {fullName}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-foreground">{ecName}</span>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleAttendanceClick(participant)}
                            className="text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                          >
                            {eventsCount}
                          </button>
                        </td>
                      </tr>);

                })}
                </tbody>
              </table>
            </div>
          }
        </div>

        {/* Results Count */}
        {!loading && filteredParticipants?.length > 0 &&
        <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredParticipants?.length} of {participants?.length} participants
          </div>
        }
      </main>
      {/* Participant Details Modal */}
      {selectedParticipant &&
      <ParticipantDetailsModal
        participant={selectedParticipant}
        onClose={handleCloseModal}
        onUpdate={handleUpdateParticipant}
        onDelete={handleDeleteParticipant} />

      }
      {/* Attendance History Modal */}
      {selectedAttendanceParticipant &&
      <AttendanceHistoryModal
        participant={selectedAttendanceParticipant}
        onClose={handleCloseAttendanceModal} />
      }
      {/* Export Modal */}
      {showExportModal &&
      <ExportModal
        participants={filteredParticipants}
        onClose={() => setShowExportModal(false)} />

      }

      {/* Add Participant Modal */}
      <AddAttendeeModal
        isOpen={showAddParticipantModal}
        onClose={() => setShowAddParticipantModal(false)}
        onAddAttendee={handleParticipantAdded}
      />

      {/* Test Email Status Toast */}
      {testEmailStatus && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
          testEmailStatus === 'sending' ? 'bg-blue-600' :
          testEmailStatus === 'sent' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {testEmailStatus === 'sending' && <Icon name="Loader" size={16} className="animate-spin" />}
          {testEmailStatus === 'sent' && <Icon name="CheckCircle" size={16} />}
          {testEmailStatus === 'failed' && <Icon name="XCircle" size={16} />}
          {testEmailStatus === 'sending' && 'Sending test error email...'}
          {testEmailStatus === 'sent' && 'Test email sent to abriev@ywamships.org!'}
          {testEmailStatus === 'failed' && 'Failed to send test email. Check console.'}
        </div>
      )}
      {errorLogStatus && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg transition-all ${
          errorLogStatus === 'downloading' ? 'bg-blue-600' :
          errorLogStatus === 'done' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {errorLogStatus === 'downloading' && <Icon name="Loader" size={16} className="animate-spin" />}
          {errorLogStatus === 'done' && <Icon name="CheckCircle" size={16} />}
          {errorLogStatus === 'failed' && <Icon name="XCircle" size={16} />}
          {errorLogStatus === 'downloading' && 'Downloading error log...'}
          {errorLogStatus === 'done' && 'Error log downloaded!'}
          {errorLogStatus === 'failed' && 'Failed to download error log.'}
        </div>
      )}
    </div>
  );

};

export default DatabaseParticipants;