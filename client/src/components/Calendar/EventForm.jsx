import { useState } from 'react';
import { format, parseISO } from 'date-fns';

function EventForm({ event, selectedSlot, projects, onSave, onDelete, onClose }) {
  const getInitialDate = (date) => {
    if (!date) return '';
    return format(date instanceof Date ? date : parseISO(date), "yyyy-MM-dd'T'HH:mm");
  };

  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    project_id: event?.project_id || '',
    start_time: event
      ? getInitialDate(event.start_time)
      : getInitialDate(selectedSlot?.start),
    end_time: event?.end_time
      ? getInitialDate(event.end_time)
      : getInitialDate(selectedSlot?.end),
    all_day: event?.all_day || false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        project_id: formData.project_id || null,
        end_time: formData.end_time || null,
      };
      await onSave(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {event ? 'Edit Event' : 'New Event'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-deck-500"
                placeholder="Event title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-deck-500"
                placeholder="Event description (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Project</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-deck-500"
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="all_day"
                checked={formData.all_day}
                onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                className="w-4 h-4 text-deck-600 border-gray-300 rounded focus:ring-deck-500"
              />
              <label htmlFor="all_day" className="text-sm text-gray-700">
                All day event
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-deck-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-deck-500"
              />
            </div>

            <div className="flex justify-between pt-4">
              <div>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-deck-600 text-white rounded-lg hover:bg-deck-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EventForm;
