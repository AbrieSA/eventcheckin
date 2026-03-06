import React from 'react';


const AttendanceProgress = ({ checkedInCount, totalParticipants }) => {
  const percentage = totalParticipants > 0 ?
  Math.round(checkedInCount / totalParticipants * 100) :
  0;

  const remainingCount = totalParticipants - checkedInCount;

  return;

































































};

export default AttendanceProgress;