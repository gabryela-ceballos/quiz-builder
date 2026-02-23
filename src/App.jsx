import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Builder from './pages/Builder';
import PageBuilder from './pages/PageBuilder';
import Player from './pages/Player';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';

function AppShell() {
  const location = useLocation();
  const isPlayer = location.pathname.startsWith('/q/');

  return (
    <>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/builder/page" element={<PageBuilder />} />
        <Route path="/builder/page/:id" element={<PageBuilder />} />
        <Route path="/builder/:id" element={<Builder />} />
        <Route path="/q/:id" element={<Player />} />
        <Route path="/dashboard/:id" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
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
