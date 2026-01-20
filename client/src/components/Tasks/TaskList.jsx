import { useState, useEffect } from 'react';
import { format, parseISO, isAfter, isBefore, startOfToday } from 'date-fns';
import { tasksAPI, projectsAPI } from '../../services/api';
import TaskForm from './TaskForm';

function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    project_id: '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.project_id) params.project_id = filters.project_id;

      const [tasksRes, projectsRes] = await Promise.all([
        tasksAPI.getAll(params),
        projectsAPI.getAll(),
      ]);

      setTasks(tasksRes.data.tasks);
      setProjects(projectsRes.data.projects);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingTask) {
        await tasksAPI.update(editingTask.id, data);
      } else {
        await tasksAPI.create(data);
      }
      setShowForm(false);
      setEditingTask(null);
      loadData();
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await tasksAPI.update(task.id, { status: newStatus });
      loadData();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || '';
  };

  const isOverdue = (task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return isBefore(parseISO(task.due_date), startOfToday());
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deck-500"></div>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={() => {
            setEditingTask(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-deck-600 text-white rounded-lg hover:bg-deck-700 transition-colors"
        >
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deck-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deck-500"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filters.project_id}
          onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deck-500"
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pending */}
        <div className="bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            Pending ({pendingTasks.length})
          </h3>
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectName={getProjectName(task.project_id)}
                isOverdue={isOverdue(task)}
                onStatusChange={handleStatusChange}
                onEdit={() => {
                  setEditingTask(task);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            In Progress ({inProgressTasks.length})
          </h3>
          <div className="space-y-3">
            {inProgressTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectName={getProjectName(task.project_id)}
                isOverdue={isOverdue(task)}
                onStatusChange={handleStatusChange}
                onEdit={() => {
                  setEditingTask(task);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectName={getProjectName(task.project_id)}
                isOverdue={false}
                onStatusChange={handleStatusChange}
                onEdit={() => {
                  setEditingTask(task);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <TaskForm
          task={editingTask}
          projects={projects}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, projectName, isOverdue, onStatusChange, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${isOverdue ? 'border-l-4 border-red-500' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{task.title}</h4>
          {projectName && (
            <p className="text-xs text-deck-600 mt-1">{projectName}</p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEdit();
                }}
                className="w-full text-left px-3 py-1 text-sm hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full text-left px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{task.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className={`px-2 py-0.5 text-xs rounded-full priority-${task.priority}`}>
          {task.priority}
        </span>
        {task.due_date && (
          <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {isOverdue ? 'Overdue: ' : 'Due: '}
            {format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-1">
        {task.status !== 'pending' && (
          <button
            onClick={() => onStatusChange(task, 'pending')}
            className="flex-1 text-xs py-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          >
            Pending
          </button>
        )}
        {task.status !== 'in-progress' && (
          <button
            onClick={() => onStatusChange(task, 'in-progress')}
            className="flex-1 text-xs py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
          >
            In Progress
          </button>
        )}
        {task.status !== 'completed' && (
          <button
            onClick={() => onStatusChange(task, 'completed')}
            className="flex-1 text-xs py-1 rounded bg-green-100 text-green-800 hover:bg-green-200"
          >
            Complete
          </button>
        )}
      </div>
    </div>
  );
}

export default TaskList;
