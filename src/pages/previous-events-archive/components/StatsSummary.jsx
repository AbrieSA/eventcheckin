import React from 'react';


const StatsSummary = ({ stats }) => {
  const statCards = [
  {
    icon: 'Calendar',
    label: 'Total Events',
    value: stats?.totalEvents,
    color: 'primary',
    bgColor: 'bg-primary/10'
  },
  {
    icon: 'Users',
    label: 'Total Participants',
    value: stats?.totalParticipants,
    color: 'secondary',
    bgColor: 'bg-secondary/10'
  },
  {
    icon: 'TrendingUp',
    label: 'Avg Attendance',
    value: `${stats?.averageAttendance}%`,
    color: 'success',
    bgColor: 'bg-success/10'
  },
  {
    icon: 'Award',
    label: 'Engagement Score',
    value: stats?.engagementScore,
    color: 'accent',
    bgColor: 'bg-accent/10'
  }];


  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {statCards?.map((stat, index) => {}




















      )}
    </div>);

};

export default StatsSummary;