import { supabase } from '../lib/supabase';

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj?.map(toCamelCase);
  if (typeof obj !== 'object') return obj;

  return Object.keys(obj)?.reduce((acc, key) => {
    const camelKey = key?.replace(/_([a-z])/g, (_, letter) => letter?.toUpperCase());
    acc[camelKey] = toCamelCase(obj?.[key]);
    return acc;
  }, {});
};

export const auditLogService = {
  // Get audit logs with date range filter (Super Admin only)
  async getAuditLogs(startDate, endDate) {
    let query = supabase
      ?.from('audit_logs')
      ?.select(`
        *,
        changed_by_profile:user_profiles!audit_logs_changed_by_fkey(
          full_name,
          email
        )
      `)
      ?.order('changed_at', { ascending: false });

    // Apply date filters if provided
    if (startDate) {
      query = query?.gte('changed_at', startDate);
    }
    if (endDate) {
      // Add one day to include the entire end date
      const endDateTime = new Date(endDate);
      endDateTime?.setDate(endDateTime?.getDate() + 1);
      query = query?.lt('changed_at', endDateTime?.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return toCamelCase(data);
  },

  // Export audit logs to CSV
  async exportAuditLogsToCSV(startDate, endDate) {
    try {
      const logs = await this.getAuditLogs(startDate, endDate);

      if (!logs || logs?.length === 0) {
        throw new Error('No audit logs found for the selected date range');
      }

      // Define CSV headers - removed old_values and new_values, added record_name
      const headers = [
        'Timestamp',
        'Table',
        'Action',
        'Record ID',
        'Record Name',
        'Changed Fields',
        'Changed By',
        'Changed By Email'
      ];

      // Convert logs to CSV rows
      const rows = logs?.map(log => {
        const changedByName = log?.changedByProfile?.fullName || 'System';
        const changedByEmail = log?.changedByProfile?.email || 'N/A';
        const timestamp = new Date(log?.changedAt)?.toLocaleString();
        const recordName = log?.recordName || `ID: ${log?.recordId}`;

        return [
          timestamp,
          log?.tableName || '',
          log?.actionType || '',
          log?.recordId || '',
          recordName,
          log?.changedFields || 'N/A',
          changedByName,
          changedByEmail
        ];
      });

      // Build CSV content
      const csvContent = [
        headers?.join(','),
        ...rows?.map(row => row?.map(cell => `"${cell}"`)?.join(','))
      ]?.join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const filename = `audit_logs_${startDate || 'all'}_to_${endDate || 'now'}.csv`;
      link?.setAttribute('href', url);
      link?.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body?.appendChild(link);
      link?.click();
      document.body?.removeChild(link);

      return { success: true, count: logs?.length };
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw error;
    }
  },

  // Get audit log statistics
  async getAuditLogStatistics(startDate, endDate) {
    try {
      const logs = await this.getAuditLogs(startDate, endDate);

      if (!logs || logs?.length === 0) {
        return {
          totalLogs: 0,
          byTable: {},
          byAction: {},
          byUser: {}
        };
      }

      // Calculate statistics
      const byTable = {};
      const byAction = {};
      const byUser = {};

      logs?.forEach(log => {
        // Count by table
        byTable[log?.tableName] = (byTable?.[log?.tableName] || 0) + 1;

        // Count by action
        byAction[log?.actionType] = (byAction?.[log?.actionType] || 0) + 1;

        // Count by user
        const userName = log?.changedByProfile?.fullName || 'System';
        byUser[userName] = (byUser?.[userName] || 0) + 1;
      });

      return {
        totalLogs: logs?.length,
        byTable,
        byAction,
        byUser
      };
    } catch (error) {
      console.error('Error getting audit log statistics:', error);
      throw error;
    }
  }
};