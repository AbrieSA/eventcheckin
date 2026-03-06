import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const EventCard = ({ event, onViewDetails, onExport, onDuplicate }) => {
  const attendancePercentage = event?.totalParticipants > 0 ?
  Math.round(event?.attendanceCount / event?.totalParticipants * 100) :
  0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success border-success/20';
      case 'cancelled':
        return 'bg-error/10 text-error border-error/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-smooth p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-1">
                {event?.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Icon name="Calendar" size={16} />
                  <span>{formatDate(event?.date)}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  
                  
                </div>
              </div>
            </div>
            


          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            









            <div className="bg-success/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="CheckCircle2" size={16} color="var(--color-success)" />
                <span className="text-xs text-muted-foreground">Attended</span>
              </div>
              <p className="text-xl md:text-2xl font-semibold font-data text-success">
                {event?.attendanceCount}
              </p>
            </div>

            









            








          </div>
        </div>

        <div className="flex lg:flex-col gap-2 lg:gap-3">
          <Button
            variant="outline"
            size="sm"
            iconName="Eye"
            iconPosition="left"
            onClick={() => onViewDetails(event)}
            className="flex-1 lg:flex-none lg:w-full">

            <span className="hidden sm:inline">View Details</span>
            <span className="sm:hidden">Details</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconName="Download"
            iconPosition="left"
            onClick={() => onExport(event)}
            className="flex-1 lg:flex-none lg:w-full">

            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden">Export</span>
          </Button>
          










        </div>
      </div>
    </div>);

};

export default EventCard;