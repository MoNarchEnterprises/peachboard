import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

// Import page components
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* Route for tutors accessing their board */}
        <Route path="/board/:boardId" element={<BoardPage />} />
        {/* Route for guests accessing via share link */}
        <Route path="/board/share/:shareLinkId" element={<BoardPage />} />
        {/* TODO: Add a default route, maybe redirect to login or dashboard based on auth state */}
        <Route path="/" element={<LoginPage />} /> {/* Default to login for now */}
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
