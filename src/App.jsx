import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Builder from './pages/Builder';
import PageBuilder from './pages/PageBuilder';
import Player from './pages/Player';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Plans from './pages/Plans';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { isLoggedIn, isAdmin } from './hooks/useAuth';

function ProtectedRoute({ children, adminOnly = false }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin()) return <Navigate to="/" replace />;
  return children;
}

function AppShell() {
  const location = useLocation();

  return (
    <>
      <Routes>
        <Route path="/login" element={isLoggedIn() ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/q/:id" element={<Player />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/builder" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
        <Route path="/builder/page" element={<ProtectedRoute><PageBuilder /></ProtectedRoute>} />
        <Route path="/builder/page/:id" element={<ProtectedRoute><PageBuilder /></ProtectedRoute>} />
        <Route path="/builder/:id" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
        <Route path="/dashboard/:id" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
        <Route path="/planos" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
