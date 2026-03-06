import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const EmptyState = ({ onReset }) => {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-8 md:p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-muted rounded-full mx-auto mb-4 md:mb-6">
          <Icon 
            name="Archive" 
            size={32} 
            color="var(--color-muted-foreground)"
            className="md:w-10 md:h-10"
          />
        </div>
        <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
          No Events Found
        </h3>
        <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">
          No events match your current filter criteria. Try adjusting your filters or reset them to see all events.
        </p>
        <Button
          variant="outline"
          iconName="RotateCcw"
          iconPosition="left"
          onClick={onReset}
        >
          Reset Filters
        </Button>
      </div>
    </div>
  );
};

export default EmptyState;