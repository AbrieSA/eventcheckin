import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { attendanceService } from '../../services/attendanceService';
import { reportError } from '../../services/errorReportingService';
import ParticipantDetailsModal from './components/ParticipantDetailsModal';
import ExportModal from './components/ExportModal';
import ImportUpdateModal from './components/ImportUpdateModal';
import AttendanceHistoryModal from './components/AttendanceHistoryModal';
import AddAttendeeModal from '../../components/ui/AddAttendeeModal';
import { supabase } from '../../lib/supabase';
import { buildCsv } from '../../utils/csv';
import { getSearchMatchRank } from '../../utils/searchRanking';

const DatabaseParticipants = () => {
  const initialDatabaseCache = attendanceService?.getParticipantDatabaseCache();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState(() => initialDatabaseCache?.participants || []);
  const [filteredParticipants, setFilteredParticipants] = useState(() => initialDatabaseCache?.participants || []);
  const [loading, setLoading] = useState(() => !initialDatabaseCache);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hasSnapshot, setHasSnapshot] = useState(() => !!initialDatabaseCache);
  const [searchName, setSearchName] = useState('');
  const [searchEvents, setSearchEvents] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportUpdateModal, setShowImportUpdateModal] = useState(false);
  const [attendanceCounts, setAttendanceCounts] = useState(() => initialDatabaseCache?.attendanceCounts || {});
  const [selectedAttendanceParticipant, setSelectedAttendanceParticipant] = useState(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null); // null | 'sending' | 'sent' | 'failed'
  const [errorLogStatus, setErrorLogStatus] = useState(null); // null | 'downloading' | 'done' | 'failed'
  const [sortConfig, setSortConfig] = useState(null);

  useEffect(() => {
    loadParticipants({ background: !!initialDatabaseCache });
  }, []);

  useEffect(() => {
    filterParticipants();
  }, [searchName, searchEvents, participants, attendanceCounts, sortConfig]);

  const loadParticipants = async ({ background = hasSnapshot } = {}) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const snapshot = await attendanceService?.refreshParticipantDatabaseCache();
      const nextParticipants = snapshot?.participants || [];

      setParticipants(nextParticipants);
      setFilteredParticipants(nextParticipants);
      setAttendanceCounts(snapshot?.attendanceCounts || {});
      setHasSnapshot(true);
      return true;
    } catch (error) {
      console.error('Error loading participants:', error);
      setLoadError(error);
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterParticipants = () => {
    let filtered = [...participants];
    const normalizedSearchName = searchName?.trim().toLocaleLowerCase();

    // Filter by participant name
    if (normalizedSearchName) {
      filtered = filtered?.filter((p) => {
        const fullName = `${p?.firstName || ''} ${p?.lastName || ''}`?.toLocaleLowerCase();
        return fullName?.includes(normalizedSearchName);
      });
    }

    // Filter by events attended (placeholder - would need attendance records)
    if (searchEvents?.trim()) {




      // This would require joining with attendance_records table
      // For now, just a placeholder filter
    }

    if (normalizedSearchName || sortConfig) {
      const direction = sortConfig?.direction === 'asc' ? 1 : -1;
      filtered.sort((firstParticipant, secondParticipant) => {
        if (normalizedSearchName) {
          const rankComparison = getSearchMatchRank(normalizedSearchName, [firstParticipant?.firstName, firstParticipant?.lastName])
            - getSearchMatchRank(normalizedSearchName, [secondParticipant?.firstName, secondParticipant?.lastName]);
          if (rankComparison !== 0) return rankComparison;
        }

        const firstName = `${firstParticipant?.firstName || ''} ${firstParticipant?.lastName || ''}`?.trim();
        const secondName = `${secondParticipant?.firstName || ''} ${secondParticipant?.lastName || ''}`?.trim();
        const firstValue = sortConfig?.key === 'events'
          ? Number(attendanceCounts?.[firstParticipant?.id] || 0)
          : firstName;
        const secondValue = sortConfig?.key === 'events'
          ? Number(attendanceCounts?.[secondParticipant?.id] || 0)
          : secondName;
        const comparison = typeof firstValue === 'number'
          ? firstValue - secondValue
          : firstValue.localeCompare(secondValue, undefined, { sensitivity: 'base' });

        if (comparison !== 0) return comparison * (sortConfig ? direction : 1);

        const nameComparison = firstName.localeCompare(secondName, undefined, { sensitivity: 'base' });
        if (nameComparison !== 0) return nameComparison;

        return String(firstParticipant?.id || '').localeCompare(String(secondParticipant?.id || ''));
      });
    }

    setFilteredParticipants(filtered);
  };

  const handleSort = (key) => {
    setSortConfig((currentSort) => {
      const isParticipantSort = key === 'participant';
      const initialDirection = isParticipantSort ? 'asc' : 'desc';
      const toggledDirection = currentSort?.direction === 'asc' ? 'desc' : 'asc';

      return {
        key,
        direction: currentSort?.key === key ? toggledDirection : initialDirection
      };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig?.direction === 'asc' ? 'ArrowUp' : 'ArrowDown';
  };
  const handleExport = () => {
    setShowExportModal(true);
    setShowOptions(false);
  };

  const handleAddParticipant = () => {
    setShowAddParticipantModal(true);
    setShowOptions(false);
  };

  const handleImportUpdate = () => {
    setShowImportUpdateModal(true);
    setShowOptions(false);
  };

  const handleParticipantAdded = async (newParticipant) => {
    // Reload participants to include the new one
    await loadParticipants({ background: true });
    setShowAddParticipantModal(false);
  };

  const handleParticipantImport = async () => {
    const refreshed = await loadParticipants({ background: true });
    if (!refreshed) throw new Error('Participant list refresh failed.');
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
    setSelectedParticipant((prev) => prev?.id === updatedParticipant?.id ? updatedParticipant : prev);
    loadParticipants({ background: true });
  };

  const handleDeleteParticipant = async (participantId) => {
    try {
      await attendanceService?.deleteParticipant(participantId);
      setParticipants((prev) => prev?.filter((p) => p?.id !== participantId));
      setFilteredParticipants((prev) => prev?.filter((p) => p?.id !== participantId));
      await loadParticipants({ background: true });
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
        row?.change_description || '',
        row?.changed_fields || '',
        row?.changed_by || '',
        row?.changed_at ? new Date(row.changed_at)?.toLocaleString() : '',
      ]);

      const csvContent = buildCsv(headers, csvRows);
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

              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 rounded-lg">
                <Icon name="Home" size={32} className="h-8 w-8 shrink-0 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Database</h1>
            </button>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Search Filters and Options */}
        <div className="mb-6 rounded-[28px] border border-border/80 bg-card/95 p-4 pt-[15px] pb-0 shadow-sm backdrop-blur-sm sm:p-6">
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
                className="w-full sm:w-auto min-w-[120px] justify-between text-foreground hover:text-foreground focus-visible:text-foreground"
                iconName="ChevronDown"
                iconPosition="right">

                Options
              </Button>
              {showOptions &&
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
                  <button
                  onClick={() => {
                    handleAddParticipant();
                  }}
                  className="flex w-full items-center space-x-3 rounded-t-2xl px-4 py-3 text-left font-medium text-gray-900 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:bg-gray-100 focus-visible:text-gray-900 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus-visible:bg-gray-700 dark:focus-visible:text-gray-100">
                    <Icon name="UserPlus" size={18} className="text-gray-900 dark:text-gray-100" />
                    <span className="text-base">Add Participant</span>
                  </button>
                  <button
                  onClick={handleImportUpdate}
                  className="flex w-full items-center space-x-3 px-4 py-3 text-left font-medium text-gray-900 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:bg-gray-100 focus-visible:text-gray-900 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus-visible:bg-gray-700 dark:focus-visible:text-gray-100">
                    <Icon name="Upload" size={18} className="text-gray-900 dark:text-gray-100" />
                    <span className="text-base">Import updates</span>
                  </button>
                  <button
                  onClick={() => {
                    handleExport();
                  }}
                  className="flex w-full items-center space-x-3 rounded-b-2xl px-4 py-3 text-left font-medium text-gray-900 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:bg-gray-100 focus-visible:text-gray-900 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus-visible:bg-gray-700 dark:focus-visible:text-gray-100">

                    <Icon name="Download" size={18} className="text-gray-900 dark:text-gray-100" />
                    <span className="text-base">List export</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        {loadError &&
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icon name="AlertCircle" size={20} className="mt-0.5 shrink-0" />
              <p className="text-sm">
                {hasSnapshot ?
                'Could not refresh the database. Showing the latest data saved in this app session.' :
                'Failed to load participants. Check your connection and try again.'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => loadParticipants({ background: hasSnapshot })}
              className="shrink-0">
              Retry
            </Button>
          </div>
        }

        {refreshing &&
        <div role="status" className="mb-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <Icon name="Loader2" size={16} className="animate-spin" />
            <span>Refreshing database...</span>
          </div>
        }

        {/* Participants Table */}
        <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card/95 shadow-sm">
          {loading ?
          <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div> :
          loadError && !hasSnapshot ?
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <Icon name="WifiOff" size={48} className="mb-4 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium text-foreground">Participant data is unavailable</p>
              <p className="text-sm text-muted-foreground">Use Retry above to load the database again.</p>
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
                    <th
                      scope="col"
                      aria-sort={sortConfig?.key === 'participant' ? (sortConfig?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      <button
                        type="button"
                        onClick={() => handleSort('participant')}
                        className="inline-flex items-center gap-1 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort participants ${sortConfig?.key === 'participant' && sortConfig?.direction === 'asc' ? 'Z to A' : 'A to Z'}`}>
                        Participant
                        {getSortIndicator('participant') && <Icon name={getSortIndicator('participant')} size={16} aria-hidden="true" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      Emergency Contact
                    </th>
                    <th
                      scope="col"
                      aria-sort={sortConfig?.key === 'events' ? (sortConfig?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                      <button
                        type="button"
                        onClick={() => handleSort('events')}
                        className="inline-flex items-center gap-1 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort events attended ${sortConfig?.key === 'events' && sortConfig?.direction === 'desc' ? 'lowest to highest' : 'highest to lowest'}`}>
                        Events Attended
                        {getSortIndicator('events') && <Icon name={getSortIndicator('events')} size={16} aria-hidden="true" />}
                      </button>
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
        key={selectedParticipant?.id}
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

      {showImportUpdateModal && (
        <ImportUpdateModal
          onClose={() => setShowImportUpdateModal(false)}
          onImported={handleParticipantImport}
        />
      )}

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
