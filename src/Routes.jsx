import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import { useAuth } from "./contexts/AuthContext";
import NotFound from "pages/NotFound";

import PreviousEventsArchive from './pages/previous-events-archive';
import HomeDashboard from './pages/home-dashboard';
import DatabaseParticipants from './pages/database-participants';
import AuthenticationLogin from './pages/authentication-login';
import UserManagementDashboard from './pages/user-management-dashboard';
import EventMeInterface from './pages/event-check-in-interface';

// Protected Route Component - requires authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication-login" replace />;
  }

  return children;
};

// Role-Based Route Component - requires specific role
const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, userProfile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication-login" replace />;
  }

  if (!userProfile || !allowedRoles?.includes(userProfile?.user_role)) {
    return <Navigate to="/home-dashboard" replace />;
  }

  return children;
};

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Public Routes */}
        <Route path="/authentication-login" element={<AuthenticationLogin />} />
        
        {/* Protected Routes - Require Authentication */}
        <Route path="/" element={
          <ProtectedRoute>
            <HomeDashboard />
          </ProtectedRoute>
        } />
        <Route path="/home-dashboard" element={
          <ProtectedRoute>
            <HomeDashboard />
          </ProtectedRoute>
        } />
        <Route path="/event-check-in-interface" element={
          <ProtectedRoute>
            <EventMeInterface />
          </ProtectedRoute>
        } />
        
        {/* Admin-Only Routes - Require Admin or Super Admin Role */}
        <Route path="/previous-events-archive" element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <PreviousEventsArchive />
          </RoleBasedRoute>
        } />
        <Route path="/database-participants" element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <DatabaseParticipants />
          </RoleBasedRoute>
        } />
        
        {/* Super Admin-Only Routes */}
        <Route path="/user-management-dashboard" element={
          <RoleBasedRoute allowedRoles={['super_admin']}>
            <UserManagementDashboard />
          </RoleBasedRoute>
        } />
        
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
