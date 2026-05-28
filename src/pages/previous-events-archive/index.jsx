import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import BackButton from '../../components/ui/BackButton';
import EventDetailsModal from './components/EventDetailsModal';
import { attendanceService } from '../../services/attendanceService';

const PreviousEventsArchive = () => {
  const navigate = useNavigate();
  const [selectOption, setSelectOption] = useState('all');
  const [eventNameSearch, setEventNameSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Fetch archived events from Supabase
  useEffect(() => {
    const fetchArchivedEvents = async () => {
      try {
        setLoading(true);
        const data = await attendanceService?.getArchivedEvents();
        setEvents(data);
        setFilteredEvents(data);
      } catch (err) {
        console.error('Error fetching archived events:', err);
        setError(err?.message || 'Failed to load archived events');
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedEvents();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    // Event name search
    if (eventNameSearch) {
      filtered = filtered?.filter((event) =>
        event?.eventName?.toLowerCase()?.includes(eventNameSearch?.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered?.filter((event) =>
        event?.category?.toLowerCase()?.includes(categoryFilter?.toLowerCase())
      );
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered?.filter((event) => {
        const eventDate = new Date(event?.eventDate)?.toLocaleDateString('en-GB');
        return eventDate?.includes(dateFilter);
      });
    }

    setFilteredEvents(filtered);
  }, [eventNameSearch, categoryFilter, dateFilter, events]);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Back Button */}
      <div className="max-w-6xl mx-auto mb-4">
        <BackButton
          onClick={() => navigate('/home-dashboard')}
          className="shadow-sm"
        >
          Back
        </BackButton>
      </div>

      {/* Main Modal Container */}
      <div className="max-w-6xl mx-auto rounded-[32px] border border-slate-200/80 bg-white/92 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-semibold text-slate-900">Archived Events</h1>
          <p className="mt-2 text-sm text-slate-500">Search past events and open a cleaner event summary modal from here.</p>
        </div>
        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Event Name Search */}
          <div>
            <Input
              type="text"
              placeholder="Event name"
              value={eventNameSearch}
              onChange={(e) => setEventNameSearch(e?.target?.value)}
              className="w-full" />
          </div>

          {/* Category Filter */}
          <div>
            <Input
              type="text"
              placeholder="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e?.target?.value)}
              className="w-full" />
          </div>

          {/* Date Filter */}
          <div>
            <Input
              type="text"
              placeholder="Date..."
              value={dateFilter}
              onChange={(e) => setDateFilter(e?.target?.value)}
              className="w-full" />
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading archived events...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              {error}
            </div>
          ) : (
            <table className="w-full overflow-hidden">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Event Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Attended
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents?.length > 0 ?
                  filteredEvents?.map((event) =>
                    <tr
                      key={event?.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                      <td className="cursor-pointer py-4 px-4 text-sm font-medium text-primary underline-offset-2 hover:text-primary/80 hover:underline"
                        onClick={() => handleEventClick(event)}>
                        {event?.eventName}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {event?.eventDate ? new Date(event?.eventDate)?.toLocaleDateString('en-GB') : 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {event?.category || 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {event?.attendanceRecords?.length || 0}
                      </td>
                    </tr>
                  ) :
                  <tr>
                    <td colSpan="4" className="py-8 px-4 text-center text-sm text-gray-500">
                      No events found
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default PreviousEventsArchive;
