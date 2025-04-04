import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';
import './App.css'; // Keep existing App CSS if needed

// TODO: Implement proper authentication check for protected routes

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* TODO: Protect dashboard route */}
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* TODO: Protect board route */}
        <Route path="/board/:boardId" element={<BoardPage />} />
        {/* Redirect root path to login for now */}
        <Route path="/" element={<Navigate replace to="/login" />} />
        {/* Optional: Add a 404 Not Found route */}
        {/* <Route path="*" element={<NotFoundPage />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
