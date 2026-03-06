import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import EventModal from '../../components/ui/EventModal';
import { attendanceService } from '../../services/attendanceService';

const HomeDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isSuperAdmin, signOut, userProfile, profileLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/authentication-login');
    }
  }, [isAuthenticated, navigate]);

  // Load active event on mount
  useEffect(() => {
    loadActiveEvent();
  }, []);

  const loadActiveEvent = async () => {
    try {
      setLoading(true);
      const event = await attendanceService?.getActiveEvent();
      setActiveEvent(event);
    } catch (error) {
      console.error('Error loading active event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEventCreated = async (eventData) => {
    try {
      // Create active event in database
      const newEvent = await attendanceService?.createActiveEvent(eventData);
      setActiveEvent(newEvent);
      // Close modal
      setIsModalOpen(false);
      // Navigate to check-in screen
      window.location.href = '/event-check-in-interface';
    } catch (error) {
      console.error('Error creating active event:', error);
      alert('Failed to create event. Please try again.');
    }
  };

  const handleGoToActiveEvent = () => {
    window.location.href = '/event-check-in-interface';
  };

  const handleCancelEvent = async () => {
    if (!activeEvent) return;

    const confirmed = window.confirm(
      `Are you sure you want to cancel "${activeEvent?.eventName}"? This will delete the event without archiving it.`
    );

    if (confirmed) {
      try {
        await attendanceService?.cancelActiveEvent(activeEvent?.id);
        setActiveEvent(null);
        alert('Event cancelled successfully.');
      } catch (error) {
        console.error('Error cancelling event:', error);
        alert('Failed to cancel event. Please try again.');
      }
    }
  };

  const handleDatabase = () => {
    window.location.href = '/database-participants';
  };

  const handleArchivedEvents = () => {
    window.location.href = '/previous-events-archive';
  };

  const handleUserManagement = () => {
    window.location.href = '/user-management-dashboard';
  };

  const handleSignOut = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (confirmed) {
      await signOut();
      navigate('/authentication-login');
    }
  };

  // Check if user profile is loaded and has admin role
  const showAdminButtons = userProfile && !profileLoading && isAdmin();
  // Check if user profile is loaded and has super admin role
  const showSuperAdminButtons = userProfile && !profileLoading && isSuperAdmin();

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Home Logo and Sign Out */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <button
              onClick={() => navigate('/home-dashboard')}
              className="flex items-center space-x-2 sm:space-x-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-2 hover:bg-primary/5 transition-colors"
              aria-label="Home"
            >
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg">
                <Icon 
                  name="Home" 
                  size={25} 
                  color="var(--color-primary)" 
                  className="sm:w-9 sm:h-9"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-semibold text-foreground">
                EventMe
              </h1>
            </button>
            <div className="flex items-center space-x-4">
              {userProfile && (
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-foreground">{userProfile?.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.user_role === 'super_admin' ? 'Super Admin' : userProfile?.user_role === 'admin' ? 'Admin' : 'User'}
                  </div>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <Icon name="LogOut" size={20} color="#ef4444" />
                <span className="text-sm font-medium text-red-600 hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Floating Buttons */}
      <main className="flex items-center justify-center min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-5rem)] px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {loading || profileLoading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : activeEvent ? (
            // Active Event Buttons
            <>
              {/* Go to Active Event Button */}
              <button
                onClick={handleGoToActiveEvent}
                className="w-full bg-card hover:bg-card/80 border-2 border-border hover:border-primary shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl p-8 group focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-[0.98]"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 bg-primary/10 group-hover:bg-primary/20 rounded-full transition-colors">
                    <Icon 
                      name="Calendar" 
                      size={32} 
                      color="var(--color-primary)"
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors block">
                      Go to Active Event
                    </span>
                    <span className="text-sm text-muted-foreground mt-1 block">
                      {activeEvent?.eventName}
                    </span>
                  </div>
                </div>
              </button>

              {/* Cancel Event Button */}
              <button
                onClick={handleCancelEvent}
                className="w-full bg-red-50 hover:bg-red-100 border-2 border-red-300 hover:border-red-500 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl p-8 group focus:outline-none focus:ring-4 focus:ring-red-300 active:scale-[0.98]"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 bg-red-100 group-hover:bg-red-200 rounded-full transition-colors">
                    <Icon 
                      name="X" 
                      size={32} 
                      color="#ef4444"
                    />
                  </div>
                  <span className="text-xl font-semibold text-red-600 group-hover:text-red-700 transition-colors">
                    Cancel Event
                  </span>
                </div>
              </button>
            </>
          ) : (
            // Create New Event Button
            <button
              onClick={handleCreateEvent}
              className="w-full bg-card hover:bg-card/80 border-2 border-border hover:border-primary shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl p-8 group focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-[0.98]"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-primary/10 group-hover:bg-primary/20 rounded-full transition-colors">
                  <Icon 
                    name="Plus" 
                    size={32} 
                    color="var(--color-primary)"
                  />
                </div>
                <span className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  Create New Event
                </span>
              </div>
            </button>
          )}

          {/* Database Button - Admin and Super Admin Only */}
          {showAdminButtons && (
            <button
              onClick={handleDatabase}
              className="w-full bg-card hover:bg-card/80 border-2 border-border hover:border-primary shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl p-8 group focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-[0.98]"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-secondary/10 group-hover:bg-secondary/20 rounded-full transition-colors">
                  <Icon 
                    name="Database" 
                    size={32} 
                    color="var(--color-secondary)"
                  />
                </div>
                <span className="text-xl font-semibold text-foreground group-hover:text-secondary transition-colors">
                  Database
                </span>
              </div>
            </button>
          )}

          {/* Archived Events Button - Admin and Super Admin Only */}
          {showAdminButtons && (
            <button
              onClick={handleArchivedEvents}
              className="w-full bg-card hover:bg-card/80 border-2 border-border hover:border-accent shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl p-8 group focus:outline-none focus:ring-4 focus:ring-accent/30 active:scale-[0.98]"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-accent/10 group-hover:bg-accent/20 rounded-full transition-colors">
                  <Icon 
                    name="Archive" 
                    size={32} 
                    color="var(--color-accent)"
                  />
                </div>
                <span className="text-xl font-semibold text-foreground group-hover:text-accent transition-colors">
                  Archived Events
                </span>
              </div>
            </button>
          )}

          {/* User Management Button - Super Admin Only */}
          {showSuperAdminButtons && (
            <button
              onClick={handleUserManagement}
              className="w-full bg-card hover:bg-card/80 border-2 border-border hover:border-purple-500 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl p-8 group focus:outline-none focus:ring-4 focus:ring-purple-300 active:scale-[0.98]"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-purple-100 group-hover:bg-purple-200 rounded-full transition-colors">
                  <Icon 
                    name="Users" 
                    size={32} 
                    color="#9333ea"
                  />
                </div>
                <span className="text-xl font-semibold text-foreground group-hover:text-purple-600 transition-colors">
                  User Management
                </span>
              </div>
            </button>
          )}
        </div>
      </main>

      {/* Event Creation Modal */}
      <EventModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCreateEvent={handleEventCreated}
      />
    </div>
  );
};

export default HomeDashboard;