import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { projectsAPI, tasksAPI, eventsAPI, ideasAPI } from '../../services/api';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [projectsRes, tasksRes, eventsRes, ideasRes] = await Promise.all([
        projectsAPI.getAll({ status: 'active' }),
        tasksAPI.getAll({ status: 'pending' }),
        eventsAPI.getAll(),
        ideasAPI.getAll(),
      ]);

      setProjects(projectsRes.data.projects.slice(0, 5));
      setTasks(tasksRes.data.tasks.slice(0, 5));
      setEvents(eventsRes.data.events.filter(e => {
        const eventDate = parseISO(e.start_time);
        return eventDate >= new Date();
      }).slice(0, 5));
      setIdeas(ideasRes.data.ideas.slice(0, 3));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatEventDate = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
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
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Projects"
          value={projects.length}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
          color="bg-blue-500"
        />
        <StatCard
          title="Pending Tasks"
          value={tasks.length}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          color="bg-yellow-500"
        />
        <StatCard
          title="Upcoming Events"
          value={events.length}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          color="bg-green-500"
        />
        <StatCard
          title="Ideas"
          value={ideas.length}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Projects</h2>
            <Link to="/projects" className="text-sm text-deck-600 hover:text-deck-700">
              View all
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-sm">No active projects</p>
          ) : (
            <ul className="space-y-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="text-sm text-gray-500">{project.category}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full status-${project.status}`}>
                      {project.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Tasks</h2>
            <Link to="/tasks" className="text-sm text-deck-600 hover:text-deck-700">
              View all
            </Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending tasks</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    {task.due_date && (
                      <p className="text-sm text-gray-500">
                        Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
            <Link to="/calendar" className="text-sm text-deck-600 hover:text-deck-700">
              View calendar
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming events</p>
          ) : (
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex items-center p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0 w-12 h-12 bg-deck-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-deck-700 font-semibold text-sm">
                      {formatEventDate(event.start_time)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(event.start_time), 'h:mm a')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Ideas */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Ideas</h2>
            <Link to="/ideas" className="text-sm text-deck-600 hover:text-deck-700">
              View all
            </Link>
          </div>
          {ideas.length === 0 ? (
            <p className="text-gray-500 text-sm">No ideas yet</p>
          ) : (
            <ul className="space-y-3">
              {ideas.map((idea) => (
                <li key={idea.id} className="p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{idea.title}</p>
                      {idea.content && (
                        <p className="text-sm text-gray-500 line-clamp-2">{idea.content}</p>
                      )}
                    </div>
                    {idea.audio_path && (
                      <svg className="w-5 h-5 text-deck-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
