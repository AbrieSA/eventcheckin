import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';

const StatusIndicator = ({
  attendanceCount = 0,
  totalParticipants = 0,
  isOnline = true,
  isSyncing = false,
  lastSyncTime = null
}) => {
  const [connectionStatus, setConnectionStatus] = useState(isOnline);
  const [syncStatus, setSyncStatus] = useState(isSyncing);

  useEffect(() => {
    setConnectionStatus(isOnline);
  }, [isOnline]);

  useEffect(() => {
    setSyncStatus(isSyncing);
  }, [isSyncing]);

  const attendancePercentage = totalParticipants > 0 ?
  Math.round(attendanceCount / totalParticipants * 100) :
  0;

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';

    const now = new Date();
    const syncDate = new Date(lastSyncTime);
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return syncDate?.toLocaleDateString();
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 px-4 py-3 bg-card border border-border rounded-lg shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded-lg">
          <Icon
            name="Users"
            size={20}
            color="var(--color-success)" />

        </div>
        <div className="flex flex-col">
          


          <div className="flex items-baseline space-x-2">
            <span className="text-lg sm:text-xl font-semibold font-data text-foreground">
              {attendanceCount}
            </span>
            


            


          </div>
        </div>
      </div>

      <div className="hidden sm:block w-px h-10 bg-border"></div>

      <div className="flex items-center space-x-4">
        










        {syncStatus &&
        <div className="flex items-center space-x-2">
            <Icon
            name="RefreshCw"
            size={16}
            color="var(--color-primary)"
            className="animate-spin" />

            <span className="text-sm font-caption text-primary">
              Syncing...
            </span>
          </div>
        }

        {!syncStatus && lastSyncTime &&
        <div className="flex items-center space-x-2">
            




            


          </div>
        }
      </div>
    </div>);

};

export default StatusIndicator;