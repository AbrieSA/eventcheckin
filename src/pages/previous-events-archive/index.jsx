import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Input from '../../components/ui/Input';
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
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Back Button */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => navigate('/home-dashboard')}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
          <Icon name="ArrowLeft" size={20} color="#374151" />
        </button>
      </div>

      {/* Main Modal Container */}
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-6 sm:p-8">
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Event Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Attended
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents?.length > 0 ?
                  filteredEvents?.map((event) =>
                    <tr
                      key={event?.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-sm text-blue-600 hover:text-blue-800 cursor-pointer underline"
                        onClick={() => handleEventClick(event)}>
                        {event?.eventName}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {event?.eventDate ? new Date(event?.eventDate)?.toLocaleDateString('en-GB') : 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {event?.category || 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
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