import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import './App.css';

// TODO: Implement proper authentication check for protected routes

const App: React.FC = () => {
  console.log("App component rendering..."); // Add console log
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/board/:boardId" element={<BoardPage />} />
          <Route path="/share/:shareLinkId" element={<BoardPage />} />
          {/* Add other protected routes here */}
        </Route>

        {/* Redirect root path to login (or dashboard if logged in - handled by ProtectedRoute logic) */}
        {/* Consider a more sophisticated root path handling later */}
        <Route path="/" element={<Navigate replace to="/dashboard" />} />
        {/* Optional: Add a 404 Not Found route */}
        {/* <Route path="*" element={<NotFoundPage />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
