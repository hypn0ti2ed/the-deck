import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { searchAPI } from '../../services/api';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const res = await searchAPI.search(query);
      setResults(res.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!query) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Enter a search query to find projects, tasks, events, and ideas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deck-500"></div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const { projects, tasks, events, ideas } = results.results;
  const hasResults = results.total > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Results</h1>
        <p className="text-gray-500 mt-1">
          Found {results.total} result{results.total !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>

      {!hasResults ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Projects */}
          {projects.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Projects ({projects.length})
              </h2>
              <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{project.description}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full status-${project.status}`}>
                        {project.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Tasks ({tasks.length})
              </h2>
              <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                {tasks.map((task) => (
                  <Link
                    key={task.id}
                    to="/tasks"
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full priority-${task.priority}`}>
                          {task.priority}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full status-${task.status}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Events */}
          {events.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Events ({events.length})
              </h2>
              <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    to="/calendar"
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{event.description}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(parseISO(event.start_time), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Ideas */}
          {ideas.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Ideas ({ideas.length})
              </h2>
              <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
                {ideas.map((idea) => (
                  <Link
                    key={idea.id}
                    to="/ideas"
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{idea.title}</h3>
                        {idea.category && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                            {idea.category}
                          </span>
                        )}
                      </div>
                      {idea.content && (
                        <p className="text-sm text-gray-500 line-clamp-1 mt-1">{idea.content}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
