import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import GlobalHeader from '../../components/ui/GlobalHeader';
import EventModal from '../../components/ui/EventModal';
import { attendanceService } from '../../services/attendanceService';

const HomeDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isSuperAdmin, userProfile, profileLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCancelConfirmation, setIsCancelConfirmation] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

  useEffect(() => {
    setIsCancelConfirmation(false);
    setIsCancelling(false);
  }, [activeEvent?.id]);

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
    if (!isAdmin()) return;
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
    if (!isAdmin()) return;
    if (!activeEvent) return;
    if (isCancelling) return;

    if (!isCancelConfirmation) {
      setIsCancelConfirmation(true);
      return;
    }

    try {
      setIsCancelling(true);
      await attendanceService?.cancelActiveEvent(activeEvent?.id);
      setActiveEvent(null);
    } catch (error) {
      console.error('Error cancelling event:', error);
      setIsCancelConfirmation(false);
      setIsCancelling(false);
      alert('Failed to cancel event. Please try again.');
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

  // Check if user profile is loaded and has admin role
  const showAdminButtons = userProfile && !profileLoading && isAdmin();
  // Check if user profile is loaded and has super admin role
  const showSuperAdminButtons = userProfile && !profileLoading && isSuperAdmin();

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader />

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

              {/* Cancel Event Button - Admin and Super Admin Only */}
              {showAdminButtons && (
                <button
                  onClick={handleCancelEvent}
                  disabled={isCancelling}
                  aria-label={isCancelConfirmation ? `Confirm cancellation of ${activeEvent?.eventName}` : `Cancel ${activeEvent?.eventName}`}
                  className={`flex min-h-[96px] w-full items-center justify-center border-2 shadow-lg transition-all duration-200 rounded-2xl px-6 py-3 group focus:outline-none focus:ring-4 focus:ring-red-300 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${
                    isCancelConfirmation
                      ? 'bg-red-600 hover:bg-red-700 border-red-700 hover:border-red-800 hover:shadow-xl'
                      : 'bg-red-50 hover:bg-red-100 border-red-300 hover:border-red-500 hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${isCancelConfirmation ? 'bg-white/20 group-hover:bg-white/25' : 'bg-red-100 group-hover:bg-red-200'}`}>
                      <Icon
                        name={isCancelConfirmation ? 'AlertTriangle' : 'X'}
                        size={20}
                        color={isCancelConfirmation ? '#ffffff' : '#ef4444'}
                      />
                    </div>
                    <span className={`text-base font-semibold transition-colors ${isCancelConfirmation ? 'text-white' : 'text-red-600 group-hover:text-red-700'}`}>
                      {isCancelling ? 'Cancelling Event…' : isCancelConfirmation ? 'Confirm Cancellation' : 'Cancel Event'}
                    </span>
                  </div>
                </button>
              )}
            </>
          ) : showAdminButtons ? (
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
          ) : (
            <div className="w-full bg-card border-2 border-border shadow-lg rounded-2xl p-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-full">
                  <Icon
                    name="CalendarOff"
                    size={32}
                    color="var(--color-muted-foreground)"
                  />
                </div>
                <span className="text-xl font-semibold text-foreground">
                  No Active Event
                </span>
              </div>
            </div>
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
