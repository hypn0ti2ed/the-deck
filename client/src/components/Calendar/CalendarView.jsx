import { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { eventsAPI, projectsAPI } from '../../services/api';
import EventForm from './EventForm';
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
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

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
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">Categories:</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-purple-500"></span>
          <span>Personal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-deck-500"></span>
          <span>Professional</span>
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
    </div>
  );
}

export default CalendarView;
