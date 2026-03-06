import React, { useState } from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';

// Custom SVG Icons
const PeanutNoIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    {/* Peanut shape */}
    <path d="M8 7C6.5 7 5 8.5 5 11C5 13.5 6.5 15 8 15C8.5 15 9 14.8 9.5 14.5C9.2 13.5 9 12.5 9 11.5C9 10 9.5 8.5 10.5 7.5C9.5 7.2 8.7 7 8 7Z" fill="currentColor" opacity="0.7"/>
    <path d="M16 9C17.5 9 19 10.5 19 13C19 15.5 17.5 17 16 17C15.5 17 15 16.8 14.5 16.5C14.8 15.5 15 14.5 15 13.5C15 12 14.5 10.5 13.5 9.5C14.5 9.2 15.3 9 16 9Z" fill="currentColor" opacity="0.7"/>
    {/* Red diagonal line */}
    <line x1="4" y1="20" x2="20" y2="4" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const EighteenPlusIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    {/* Number 18 */}
    <text x="3" y="17" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="bold" fill="#ef4444">18</text>
    {/* Up arrow */}
    <path d="M19 14L19 8M19 8L16 11M19 8L22 11" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NoCameraIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    {/* Camera body */}
    <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    {/* Camera lens */}
    <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
    {/* Camera top */}
    <path d="M9 8V6C9 5.44772 9.44772 5 10 5H14C14.5523 5 15 5.44772 15 6V8" stroke="currentColor" strokeWidth="2"/>
    {/* Red diagonal line */}
    <line x1="3" y1="20" x2="21" y2="6" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const ParticipantRow = ({
  participant,
  isCheckedIn,
  checkInTime,
  onCheckInToggle,
  isAnimating
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCheckboxChange = (e) => {
    onCheckInToggle(participant?.id, e?.target?.checked);
  };

  const handleRowClick = () => {
    onCheckInToggle(participant?.id, !isCheckedIn);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <tr
        className={`
          border-b border-border transition-smooth
          ${isCheckedIn ? 'bg-success/5' : 'hover:bg-muted/30'}
          ${isAnimating ? 'animate-pulse' : ''}
        `}>

        <td className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
          <button
            onClick={handleRowClick}
            className="w-full flex items-center justify-start cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded p-2 -m-2 hover:bg-muted/50 transition-colors"
            aria-label={`Check in ${participant?.name}`}
          >
            <Checkbox
              checked={isCheckedIn}
              onChange={handleCheckboxChange}
              size="lg"
              className="w-6 h-6 pointer-events-none"
              aria-label={`Check in ${participant?.name}`}
          </button>
        </td>
        <td className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
          <div className="flex flex-col space-y-1">
            <button
              onClick={toggleExpanded}
              className="text-sm md:text-base lg:text-lg font-medium text-foreground hover:text-primary transition-colors text-left flex items-center space-x-2"
            >
              <span>{participant?.name}</span>
              <Icon 
                name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                size={16} 
                className="text-muted-foreground"
              />
            </button>
          </div>
        </td>
        <td className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
          <div className="flex flex-col space-y-1">
            <span className="text-sm md:text-base text-foreground">
              {participant?.emergencyContact?.name}
            </span>
            <span className="text-xs md:text-sm text-muted-foreground font-data">
              {participant?.emergencyContact?.phone}
            </span>
          </div>
        </td>
        <td className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
          <div className="flex items-center space-x-2">
            {participant?.hasMedicalConditions && (
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-warning/10">
                <Icon name="AlertCircle" size={16} className="text-warning md:w-5 md:h-5" />
              </div>
            )}
            {participant?.hasAllergies && (
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-warning/10">
                <PeanutNoIcon size={16} className="text-warning md:w-5 md:h-5" />
              </div>
            )}
            {participant?.is18OrOver && (
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-100">
                <EighteenPlusIcon size={16} className="text-red-600 md:w-5 md:h-5" />
              </div>
            )}
            {participant?.media_consent_given === false && (
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-100">
                <NoCameraIcon size={16} className="text-red-600 md:w-5 md:h-5" />
              </div>
            )}
            {!participant?.hasMedicalConditions && !participant?.hasAllergies && !participant?.is18OrOver && participant?.media_consent_given !== false && (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
        </td>
        <td className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
          {isCheckedIn && (
            <div className="flex items-center space-x-2 text-success">
              <Icon name="CheckCircle2" size={20} className="md:w-6 md:h-6" />
              <span className="text-xs md:text-sm font-medium">
                Checked in
              </span>
            </div>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan="5" className="px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="space-y-4">
              {/* Emergency Contact Information */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center space-x-2">
                  <Icon name="Phone" size={16} className="text-primary" />
                  <span>Emergency Contact Information</span>
                </h4>
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Name:</span> {participant?.emergencyContact?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-foreground font-data">
                    <span className="font-medium">Phone:</span> {participant?.emergencyContact?.phone || 'N/A'}
                  </p>
                  {participant?.emergencyContact?.relationship && (
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Relationship:</span> {participant?.emergencyContact?.relationship}
                    </p>
                  )}
                </div>
              </div>

              {/* Alerts and Details */}
              {(participant?.hasMedicalConditions || participant?.hasAllergies || participant?.is18OrOver || participant?.media_consent_given === false) && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center space-x-2">
                    <Icon name="AlertCircle" size={16} className="text-warning" />
                    <span>Alerts & Details</span>
                  </h4>
                  <div className="space-y-3">
                    {participant?.hasMedicalConditions && (
                      <div className="flex items-start space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/10 flex-shrink-0 mt-0.5">
                          <Icon name="AlertCircle" size={14} className="text-warning" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs md:text-sm font-medium text-foreground">Medical Conditions</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {participant?.medicalConditions}
                          </p>
                        </div>
                      </div>
                    )}
                    {participant?.hasAllergies && (
                      <div className="flex items-start space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/10 flex-shrink-0 mt-0.5">
                          <PeanutNoIcon size={14} className="text-warning" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs md:text-sm font-medium text-foreground">Allergies</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {participant?.allergies}
                          </p>
                        </div>
                      </div>
                    )}
                    {participant?.is18OrOver && (
                      <div className="flex items-start space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 flex-shrink-0 mt-0.5">
                          <EighteenPlusIcon size={14} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs md:text-sm font-medium text-foreground">18 or Over</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            This participant is 18 years or older
                          </p>
                        </div>
                      </div>
                    )}
                    {participant?.media_consent_given === false && (
                      <div className="flex items-start space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 flex-shrink-0 mt-0.5">
                          <NoCameraIcon size={14} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">No Media Consent</p>
                          <p className="text-xs text-muted-foreground">
                            Media consent not given - no photos/videos
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default ParticipantRow;