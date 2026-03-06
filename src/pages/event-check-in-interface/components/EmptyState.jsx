import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const EmptyState = ({ 
  isSearching, 
  searchQuery, 
  onClearSearch,
  onAddParticipant 
}) => {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-12 md:py-16 lg:py-20 px-4">
        <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-muted rounded-full mb-4 md:mb-6">
          <Icon 
            name="Search" 
            size={32} 
            color="var(--color-muted-foreground)"
            className="md:w-10 md:h-10 lg:w-12 lg:h-12"
          />
        </div>
        <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-foreground mb-2">
          No Results Found
        </h3>
        <p className="text-sm md:text-base text-muted-foreground text-center mb-6 max-w-md">
          No participants match "{searchQuery}". Try adjusting your search terms.
        </p>
        <Button
          variant="outline"
          size="default"
          iconName="X"
          iconPosition="left"
          onClick={onClearSearch}
        >
          Clear Search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-16 lg:py-20 px-4">
      <div className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-primary/10 rounded-full mb-4 md:mb-6">
        <Icon 
          name="Users" 
          size={32} 
          color="var(--color-primary)"
          className="md:w-10 md:h-10 lg:w-12 lg:h-12"
        />
      </div>
      <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-foreground mb-2">
        No Participants Yet
      </h3>
      <p className="text-sm md:text-base text-muted-foreground text-center mb-6 max-w-md">
        Get started by adding participants to this event. You can add them individually or import from a list.
      </p>
      <Button
        variant="default"
        size="lg"
        iconName="UserPlus"
        iconPosition="left"
        onClick={onAddParticipant}
      >
        Add First Participant
      </Button>
    </div>
  );
};

export default EmptyState;