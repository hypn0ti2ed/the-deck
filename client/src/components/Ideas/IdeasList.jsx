import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ideasAPI } from '../../services/api';
import IdeaForm from './IdeaForm';
import AudioPlayer from './AudioPlayer';

function IdeasList() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    loadIdeas();
  }, [categoryFilter]);

  const loadIdeas = async () => {
    try {
      const params = categoryFilter ? { category: categoryFilter } : {};
      const res = await ideasAPI.getAll(params);
      setIdeas(res.data.ideas);
    } catch (error) {
      console.error('Failed to load ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingIdea) {
        await ideasAPI.update(editingIdea.id, data);
      } else {
        await ideasAPI.create(data);
      }
      setShowForm(false);
      setEditingIdea(null);
      loadIdeas();
    } catch (error) {
      console.error('Failed to save idea:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this idea?')) return;

    try {
      await ideasAPI.delete(id);
      loadIdeas();
    } catch (error) {
      console.error('Failed to delete idea:', error);
    }
  };

  // Get unique categories from ideas
  const categories = [...new Set(ideas.map((i) => i.category).filter(Boolean))];

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
        <h1 className="text-2xl font-bold text-gray-900">Ideas</h1>
        <button
          onClick={() => {
            setEditingIdea(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-deck-600 text-white rounded-lg hover:bg-deck-700 transition-colors"
        >
          New Idea
        </button>
      </div>

      {/* Filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 rounded-full text-sm ${
              !categoryFilter
                ? 'bg-deck-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`px-3 py-1 rounded-full text-sm ${
                categoryFilter === category
                  ? 'bg-deck-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Ideas Grid */}
      {ideas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No ideas yet</h3>
          <p className="mt-1 text-sm text-gray-500">Start capturing your thoughts and ideas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onEdit={() => {
                setEditingIdea(idea);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(idea.id)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <IdeaForm
          idea={editingIdea}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingIdea(null);
          }}
        />
      )}
    </div>
  );
}

function IdeaCard({ idea, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{idea.title}</h3>
            {idea.category && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                {idea.category}
              </span>
            )}
          </div>
          <div className="flex gap-1 ml-2">
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {idea.content && (
          <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{idea.content}</p>
        )}

        {idea.audio_path && (
          <div className="mt-4">
            <AudioPlayer ideaId={idea.id} />
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          {format(parseISO(idea.created_at), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );
}

export default IdeasList;
