import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../AppIcon';

const GlobalHeader = () => {
  const navigate = useNavigate();
  const { signOut, userProfile } = useAuth();

  const handleSignOut = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (confirmed) {
      await signOut();
      navigate('/authentication-login');
    }
  };

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <button
            type="button"
            onClick={() => navigate('/home-dashboard')}
            className="flex items-center space-x-2 sm:space-x-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-2 hover:bg-primary/5 transition-colors"
            aria-label="Home"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 rounded-lg">
              <Icon
                name="Home"
                size={32}
                color="var(--color-primary)"
                className="h-8 w-8 shrink-0"
              />
            </div>
            <span className="text-xl sm:text-2xl font-heading font-semibold text-foreground">
              EventMe
            </span>
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
              type="button"
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
  );
};

export default GlobalHeader;
