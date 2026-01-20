import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout/Layout';
import Login from './components/Layout/Login';
import Register from './components/Layout/Register';
import Dashboard from './components/Layout/Dashboard';
import ProjectList from './components/Projects/ProjectList';
import ProjectDetail from './components/Projects/ProjectDetail';
import TaskList from './components/Tasks/TaskList';
import CalendarView from './components/Calendar/CalendarView';
import IdeasList from './components/Ideas/IdeasList';
import SearchResults from './components/Search/SearchResults';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deck-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deck-500"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="ideas" element={<IdeasList />} />
          <Route path="search" element={<SearchResults />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
