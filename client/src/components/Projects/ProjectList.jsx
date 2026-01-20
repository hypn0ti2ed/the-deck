import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { projectsAPI } from '../../services/api';
import ProjectForm from './ProjectForm';

function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [filters, setFilters] = useState({ category: '', status: '' });

  useEffect(() => {
    loadProjects();
  }, [filters]);

  const loadProjects = async () => {
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;

      const res = await projectsAPI.getAll(params);
      setProjects(res.data.projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingProject) {
        await projectsAPI.update(editingProject.id, data);
      } else {
        await projectsAPI.create(data);
      }
      setShowForm(false);
      setEditingProject(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await projectsAPI.delete(id);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
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
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => {
            setEditingProject(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-deck-600 text-white rounded-lg hover:bg-deck-700 transition-colors"
        >
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deck-500"
        >
          <option value="">All Categories</option>
          <option value="personal">Personal</option>
          <option value="professional">Professional</option>
          <option value="academic">Academic</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-deck-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on-hold">On Hold</option>
        </select>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <Link to={`/projects/${project.id}`} className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-deck-600">
                      {project.name}
                    </h3>
                  </Link>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {project.description && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{project.description}</p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500 capitalize">{project.category}</span>
                  <span className={`px-2 py-1 text-xs rounded-full status-${project.status}`}>
                    {project.status}
                  </span>
                </div>

                <p className="mt-3 text-xs text-gray-400">
                  Updated {format(parseISO(project.updated_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ProjectForm
          project={editingProject}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}

export default ProjectList;
