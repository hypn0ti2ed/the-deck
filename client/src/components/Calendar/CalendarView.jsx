import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { eventsAPI, projectsAPI, calendarsAPI } from '../../services/api';
import EventForm from './EventForm';
import CalendarSettings from './CalendarSettings';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function CalendarView() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    loadData();
    // Check for OAuth callback
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setShowSettings(true);
    }
    if (error) {
      alert(`Failed to connect ${error.replace('_', ' ')}`);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [eventsRes, projectsRes] = await Promise.all([
        eventsAPI.getAll(),
        projectsAPI.getAll(),
      ]);

      const formattedEvents = eventsRes.data.events.map((event) => ({
        ...event,
        start: parseISO(event.start_time),
        end: event.end_time ? parseISO(event.end_time) : parseISO(event.start_time),
        allDay: Boolean(event.all_day),
      }));

      setEvents(formattedEvents);
      setProjects(projectsRes.data.projects);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = useCallback(({ start, end }) => {
    setSelectedSlot({ start, end });
    setEditingEvent(null);
    setShowForm(true);
  }, []);

  const handleSelectEvent = useCallback((event) => {
    // Don't allow editing synced events
    if (event.source && event.source !== 'local') {
      return;
    }
    setEditingEvent(event);
    setSelectedSlot(null);
    setShowForm(true);
  }, []);

  const handleSave = async (data) => {
    try {
      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, data);
      } else {
        await eventsAPI.create(data);
      }
      setShowForm(false);
      setEditingEvent(null);
      setSelectedSlot(null);
      loadData();
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventsAPI.delete(editingEvent.id);
      setShowForm(false);
      setEditingEvent(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const eventStyleGetter = (event) => {
    // Different colors for synced calendars
    if (event.source === 'google') {
      return {
        style: {
          backgroundColor: '#ea4335',
          borderRadius: '4px',
          opacity: 0.9,
          color: 'white',
          border: 'none',
        },
      };
    }
    if (event.source === 'outlook') {
      return {
        style: {
          backgroundColor: '#0078d4',
          borderRadius: '4px',
          opacity: 0.9,
          color: 'white',
          border: 'none',
        },
      };
    }

    const project = projects.find((p) => p.id === event.project_id);
    let backgroundColor = '#0ea5e9'; // deck-500

    if (project) {
      const colors = {
        personal: '#8b5cf6', // purple
        professional: '#0ea5e9', // blue
        academic: '#10b981', // green
      };
      backgroundColor = colors[project.category] || backgroundColor;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
      },
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deck-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Sync Settings
          </button>
          <button
            onClick={() => {
              setEditingEvent(null);
              setSelectedSlot({ start: new Date(), end: new Date() });
              setShowForm(true);
            }}
            className="px-4 py-2 bg-deck-600 text-white rounded-lg hover:bg-deck-700 transition-colors"
          >
            New Event
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4" style={{ height: 'calc(100vh - 220px)' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
          popup
          tooltipAccessor={(event) => event.description || event.title}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-gray-500">Sources:</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-deck-500"></span>
          <span>Local</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          <span>Google</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-600"></span>
          <span>Outlook</span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">Categories:</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-purple-500"></span>
          <span>Personal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500"></span>
          <span>Academic</span>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <EventForm
          event={editingEvent}
          selectedSlot={selectedSlot}
          projects={projects}
          onSave={handleSave}
          onDelete={editingEvent ? handleDelete : null}
          onClose={() => {
            setShowForm(false);
            setEditingEvent(null);
            setSelectedSlot(null);
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <CalendarSettings
          onClose={() => setShowSettings(false)}
          onSync={loadData}
        />
      )}
    </div>
  );
}

export default CalendarView;
