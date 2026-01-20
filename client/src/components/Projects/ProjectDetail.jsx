import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { projectsAPI, tasksAPI, eventsAPI } from '../../services/api';
import ProjectForm from './ProjectForm';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const res = await projectsAPI.getOne(id);
      setProject(res.data.project);
      setTasks(res.data.tasks);
      setEvents(res.data.events);
    } catch (error) {
      console.error('Failed to load project:', error);
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      await projectsAPI.update(id, data);
      setShowEditForm(false);
      loadProject();
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? All associated tasks and events will be unlinked.')) return;

    try {
      await projectsAPI.delete(id);
      navigate('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      await tasksAPI.update(taskId, { status: newStatus });
      loadProject();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deck-500"></div>
      </div>
    );
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <span className={`px-3 py-1 text-sm rounded-full status-${project.status}`}>
                {project.status}
              </span>
            </div>
            {project.description && (
              <p className="mt-2 text-gray-600">{project.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className="capitalize">{project.category}</span>
              <span>Created {format(parseISO(project.created_at), 'MMM d, yyyy')}</span>
              <span>Updated {format(parseISO(project.updated_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditForm(true)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No tasks linked to this project</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => handleTaskStatusChange(
                        task.id,
                        task.status === 'completed' ? 'pending' : 'completed'
                      )}
                      className="w-4 h-4 text-deck-600 border-gray-300 rounded focus:ring-deck-500"
                    />
                    <div>
                      <p className={`font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-gray-500">
                          Due {format(parseISO(task.due_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Events */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Events ({events.length})</h2>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events linked to this project</p>
          ) : (
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="text-sm text-gray-500">
                    {format(parseISO(event.start_time), 'MMM d, yyyy h:mm a')}
                    {event.end_time && ` - ${format(parseISO(event.end_time), 'h:mm a')}`}
                  </p>
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <ProjectForm
          project={project}
          onSave={handleSave}
          onClose={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}

export default ProjectDetail;
