import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: string[]; // Optional array of allowed roles
}

// Added role checking back
const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => { // Removed React.FC, added props
  const { session, profile, loading } = useAuth(); // Get profile from context

  if (loading) {
    // Show loading message while session/profile is being checked
    return <div>Loading authentication...</div>;
  }

  if (!session) {
    // User not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // Check role if allowedRoles are specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!profile) {
      // Profile still loading or doesn't exist
      // This might happen briefly due to async fetch.
      // Showing loading might be better than immediate unauthorized.
      console.warn("Protected route: Profile not yet loaded for role check.");
      // Option 1: Show loading (might flash briefly)
      return <div>Loading profile...</div>;
      // Option 2: Redirect (could cause loop if profile fetch fails)
      // return <Navigate to="/login" replace />;
      // Option 3: Show unauthorized (might show prematurely)
      // return <div>Unauthorized: Profile not available.</div>;
    }

    if (!allowedRoles.includes(profile.role)) {
      // User role not allowed
      console.warn(`Protected route: User role "${profile.role}" not in allowed roles [${allowedRoles.join(', ')}]`);
      // Redirect to dashboard (or a dedicated unauthorized page)
       return <Navigate to="/dashboard" replace />; // Redirecting to dashboard as a safe default
      // Or show message:
      // return <div>Unauthorized: Insufficient permissions.</div>;
    }
     console.log(`Protected route: User role "${profile.role}" is allowed.`);
  }

  // User is logged in and has the required role (if specified), render the child route
  return <Outlet />;
};

export default ProtectedRoute;