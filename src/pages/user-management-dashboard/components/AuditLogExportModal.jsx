import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { auditLogService } from '../../../services/auditLogService';

const AuditLogExportModal = ({ onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate dates
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        setError('Start date must be before end date');
        return;
      }

      const result = await auditLogService?.exportAuditLogsToCSV(startDate, endDate);
      
      if (result?.success) {
        alert(`Successfully exported ${result?.count} audit log entries`);
        onClose();
      }
    } catch (err) {
      console.error('Error exporting audit logs:', err);
      setError(err?.message || 'Failed to export audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-border">
          <h2 className="text-xl font-heading font-bold text-foreground">
            Export Audit Logs
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            disabled={loading}
          >
            <Icon name="X" size={20} color="var(--color-foreground)" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <p className="text-sm text-muted-foreground">
            Export audit logs to CSV format. Leave dates empty to export all logs.
          </p>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Start Date (Optional)
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e?.target?.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              End Date (Optional)
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e?.target?.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-5 py-4 rounded-lg text-sm">
            <div className="flex items-start space-x-2">
              <Icon name="Info" size={16} color="#2563eb" className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">What will be exported:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Event creation, updates, and changes</li>
                  <li>User creation and profile updates</li>
                  <li>Participant detail changes</li>
                  <li>Archived event modifications</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-8 border-t border-border">
          <Button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-border text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Icon name="Loader" size={16} color="white" className="animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Icon name="Download" size={16} color="white" />
                <span>Export CSV</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogExportModal;