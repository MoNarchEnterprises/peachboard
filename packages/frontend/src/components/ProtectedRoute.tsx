import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Interface removed as allowedRoles is no longer used

// Role checking logic removed as profile is not available in context
const ProtectedRoute = () => { // Removed props
  const { session, loading } = useAuth(); // Removed profile from context destructuring

  if (loading) {
    // Show loading message while session/profile is being checked
    return <div>Loading authentication...</div>;
  }

  if (!session) {
    // User not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // Role checking logic removed

  // User is logged in and has the required role (if specified), render the child route
  return <Outlet />;
};

export default ProtectedRoute;