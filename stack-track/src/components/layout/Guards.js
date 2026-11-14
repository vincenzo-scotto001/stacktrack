import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader, ErrorState } from '../ui/States';

/** Pages that need a signed-in player. */
export function RequireAuth() {
  const { session, loading, profileError } = useAuth();
  const location = useLocation();
  if (session === undefined) return <PageLoader />;
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (profileError) {
    return (
      <div className="page page-narrow">
        <ErrorState error={profileError} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (loading) return <PageLoader />;
  return <Outlet />;
}

/** Landing and auth pages: signed-in players go straight to their dashboard. */
export function PublicOnly() {
  const { session, recovering } = useAuth();
  const location = useLocation();
  if (session === undefined) return <PageLoader />;
  if (session && !recovering) return <Navigate to={location.state?.from || '/dashboard'} replace />;
  return <Outlet />;
}
