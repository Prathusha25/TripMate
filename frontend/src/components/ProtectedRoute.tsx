import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        {/* Loading Spinner */}
        <div className="w-10 h-10 border-4 border-slate-700 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium animate-pulse-subtle">Securing connection...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login, saving the original requested page path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
export default ProtectedRoute;
