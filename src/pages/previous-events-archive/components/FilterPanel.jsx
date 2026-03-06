import React from 'react';





const FilterPanel = ({
  filters,
  onFilterChange,
  onReset,
  resultsCount
}) => {
  const eventTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'conference', label: 'Conference' },
  { value: 'training', label: 'Training' },
  { value: 'meetup', label: 'Meetup' }];


  const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }];


  const attendanceOptions = [
  { value: 'all', label: 'All Attendance' },
  { value: 'high', label: 'High (&gt; 80%)' },
  { value: 'medium', label: 'Medium (50-80%)' },
  { value: 'low', label: 'Low (&lt; 50%)' }];


  return;







































































};

export default FilterPanel;