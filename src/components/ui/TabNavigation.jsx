import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';

const TabNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('/event-check-in-interface');

  const tabs = [
    {
      label: 'Active Event',
      path: '/event-check-in-interface',
      icon: 'CheckCircle2'
    },
    {
      label: 'Event History',
      path: '/previous-events-archive',
      icon: 'Archive'
    }
  ];

  useEffect(() => {
    const savedTab = localStorage.getItem('eventCheckIn_activeTab');
    if (savedTab && tabs?.some(tab => tab?.path === savedTab)) {
      setActiveTab(savedTab);
      if (location?.pathname !== savedTab) {
        navigate(savedTab);
      }
    } else {
      setActiveTab(location?.pathname);
    }
  }, []);

  useEffect(() => {
    if (location?.pathname !== activeTab) {
      setActiveTab(location?.pathname);
    }
  }, [location?.pathname]);

  const handleTabChange = (path) => {
    setActiveTab(path);
    localStorage.setItem('eventCheckIn_activeTab', path);
    navigate(path);
  };

  const handleKeyDown = (e, path) => {
    if (e?.key === 'Enter' || e?.key === ' ') {
      e?.preventDefault();
      handleTabChange(path);
    }
  };

  return (
    <nav 
      className="bg-card border-b border-border shadow-sm"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-start h-16 sm:h-20">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg">
              <Icon 
                name="Calendar" 
                size={24} 
                color="var(--color-primary)" 
                className="sm:w-7 sm:h-7"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-semibold text-foreground">
              EventMe
            </h1>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          className="flex space-x-1 sm:space-x-2 border-b border-border"
          role="tablist"
        >
          {tabs?.map((tab) => {
            const isActive = activeTab === tab?.path;
            return (
              <button
                key={tab?.path}
                onClick={() => handleTabChange(tab?.path)}
                onKeyDown={(e) => handleKeyDown(e, tab?.path)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab?.path}`}
                tabIndex={isActive ? 0 : -1}
                className={`
                  flex items-center space-x-2 px-4 sm:px-6 py-3 sm:py-4
                  text-sm sm:text-base font-medium
                  border-b-2 transition-smooth
                  touch-target
                  ${isActive 
                    ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }
                  focus:outline-none focus:ring-3 focus:ring-ring focus:ring-offset-3 focus:ring-offset-background
                  active:scale-[0.97]
                `}
              >
                <Icon 
                  name={tab?.icon} 
                  size={20} 
                  className="sm:w-5 sm:h-5"
                />
                <span className="hidden sm:inline">{tab?.label}</span>
                <span className="sm:hidden">{tab?.label?.split(' ')?.[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default TabNavigation;