import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import BackButton from '../../components/ui/BackButton';
import EventDetailsModal from './components/EventDetailsModal';
import { attendanceService } from '../../services/attendanceService';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const TREND_SERIES = {
  participants: { label: 'Participants', key: 'participantCount' },
  nonParticipants: { label: 'Non-participants', key: 'nonParticipantCount' },
  combined: { label: 'Combined', key: 'combinedCount' }
};

const formatTrendDate = (value) => new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short'
}).format(new Date(value));

const AttendanceTrendTooltip = ({ active, payload, label, seriesLabel }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-slate-800">{formatTrendDate(label)}</p>
      <p className="mt-1 text-slate-600">{seriesLabel}: <span className="font-semibold text-emerald-700">{payload[0]?.value}</span></p>
    </div>
  );
};

const PreviousEventsArchive = () => {
  const navigate = useNavigate();
  const [selectOption, setSelectOption] = useState('all');
  const [eventNameSearch, setEventNameSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(null);
  const [trendSeries, setTrendSeries] = useState('combined');

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

  // Load the chart separately so a trend query failure never hides the archive table.
  useEffect(() => {
    const fetchAttendanceTrend = async () => {
      try {
        setTrendLoading(true);
        setTrendError(null);
        setAttendanceTrend(await attendanceService?.getArchivedAttendanceTrend());
      } catch (err) {
        console.error('Error fetching archived attendance trend:', err);
        setTrendError('Attendance trend is unavailable right now.');
      } finally {
        setTrendLoading(false);
      }
    };

    fetchAttendanceTrend();
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

    // Date filter
    if (dateFilter) {
      filtered = filtered?.filter((event) => {
        const eventDate = new Date(event?.eventDate)?.toLocaleDateString('en-GB');
        return eventDate?.includes(dateFilter);
      });
    }

    setFilteredEvents(filtered);
  }, [eventNameSearch, dateFilter, events]);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  const activeTrend = TREND_SERIES[trendSeries];
  const trendYAxisMax = attendanceTrend.reduce(
    (max, event) => Math.max(max, Number(event?.combinedCount) || 0),
    0
  ) + 10;

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
        </div>
        <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-6" aria-labelledby="attendance-trend-title">
          <h2 id="attendance-trend-title" className="sr-only">Attendance trend</h2>
          <div className="flex justify-end">
            <div className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 sm:w-auto" role="group" aria-label="Attendance series">
              {Object.entries(TREND_SERIES).map(([value, option]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTrendSeries(value)}
                  aria-pressed={trendSeries === value}
                  className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 sm:flex-none ${
                    trendSeries === value
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {trendLoading ? (
            <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-100" aria-label="Loading attendance trend" />
          ) : trendError ? (
            <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{trendError}</p>
          ) : attendanceTrend?.length === 0 ? (
            <p className="mt-6 rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500">No archived attendance data to chart yet.</p>
          ) : (
            <>
              <div className="sr-only" aria-live="polite">
                <table aria-label={`${activeTrend.label} attendance by archived event`}>
                  <caption>{`${activeTrend.label} attendance for the last ${attendanceTrend.length} archived event${attendanceTrend.length === 1 ? '' : 's'}`}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">{activeTrend.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceTrend.map((event) => (
                      <tr key={event.id}>
                        <td>{formatTrendDate(event.eventDate)}</td>
                        <td>{event[activeTrend.key]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 h-[19.2rem] min-w-0 sm:h-[24rem] lg:h-[28.8rem]" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrend} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="archivedAttendanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 3" />
                    <XAxis dataKey="eventDate" tickFormatter={formatTrendDate} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis domain={[0, trendYAxisMax]} allowDecimals={false} tickCount={6} tick={{ fill: '#334155', fontSize: 14, fontWeight: 400 }} axisLine={false} tickLine={false} tickMargin={10} width={52} />
                    <Tooltip content={<AttendanceTrendTooltip seriesLabel={activeTrend.label} />} labelFormatter={formatTrendDate} />
                    <Area type="monotone" dataKey={activeTrend.key} name={activeTrend.label} stroke="#047857" strokeWidth={3} fill="url(#archivedAttendanceFill)" dot={{ r: 4, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
        {/* Filters Row */}
        <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2">
          {/* Event Name Search */}
          <div>
            <Input
              type="text"
              placeholder="Event name"
              value={eventNameSearch}
              onChange={(e) => setEventNameSearch(e?.target?.value)}
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
                        {event?.attendanceRecords?.length || 0}
                      </td>
                    </tr>
                  ) :
                  <tr>
                    <td colSpan="3" className="py-8 px-4 text-center text-sm text-gray-500">
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
