import React, { useState, useEffect } from 'react';
import Select from './Select';


const EventSelector = ({ 
  eventList = [], 
  selectedEvent = null, 
  onEventChange,
  loading = false 
}) => {
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);

  useEffect(() => {
    const savedEventId = localStorage.getItem('eventCheckIn_selectedEvent');
    
    if (eventList && eventList?.length > 0) {
      const formattedEvents = eventList?.map(event => ({
        value: event?.id,
        label: event?.name,
        description: event?.date ? new Date(event.date)?.toLocaleDateString() : null,
        disabled: event?.status === 'completed'
      }));
      
      setEvents(formattedEvents);

      if (savedEventId) {
        const savedEvent = formattedEvents?.find(e => e?.value === savedEventId);
        if (savedEvent) {
          setCurrentEvent(savedEvent?.value);
          if (onEventChange) {
            onEventChange(eventList?.find(e => e?.id === savedEvent?.value));
          }
        }
      } else if (selectedEvent) {
        setCurrentEvent(selectedEvent?.id);
      }
    }
  }, [eventList, selectedEvent]);

  const handleEventChange = (value) => {
    setCurrentEvent(value);
    localStorage.setItem('eventCheckIn_selectedEvent', value);
    
    if (onEventChange) {
      const selectedEventData = eventList?.find(event => event?.id === value);
      onEventChange(selectedEventData);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-3 px-4 py-3 bg-muted/50 rounded-lg animate-pulse">
        <div className="w-5 h-5 bg-muted rounded"></div>
        <div className="h-4 bg-muted rounded w-32"></div>
      </div>
    );
  }

  return (
    <div className="w-full sm:w-auto">
      <Select
        label="Current Event"
        placeholder="Select an event"
        options={events}
        value={currentEvent}
        onChange={handleEventChange}
        searchable={events?.length > 5}
        clearable={false}
        required
        className="min-w-[280px] sm:min-w-[320px]"
      />
    </div>
  );
};

export default EventSelector;