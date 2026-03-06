import React from 'react';
import Button from '../../../components/ui/Button';

const BulkActionsBar = ({ 
  checkedInCount,
  onBulkCheckOut,
  onAddParticipant,
  isProcessing 
}) => {
  const someCheckedIn = checkedInCount > 0;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
        {someCheckedIn && (
          <Button
            variant="outline"
            size="default"
            iconName="X"
            iconPosition="left"
            onClick={onBulkCheckOut}
            disabled={isProcessing}
            className="touch-target"
          >
            Clear All Check-ins
          </Button>
        )}
      </div>

      <Button
        variant="secondary"
        size="default"
        iconName="UserPlus"
        iconPosition="left"
        onClick={onAddParticipant}
        className="touch-target"
      >
        Add Participant
      </Button>
    </div>
  );
};

export default BulkActionsBar;