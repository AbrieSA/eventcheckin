import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { attendanceService } from '../../../services/attendanceService';

const ParticipantDetailsModal = ({ participant, onClose, onUpdate, onDelete }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: participant?.firstName || '',
    lastName: participant?.lastName || '',
    dateOfBirth: participant?.dateOfBirth || '',
    role: participant?.role || 'Participant',
    email: participant?.email || '',
    phone: participant?.phone || '',
    allergies: participant?.allergiesDetails || '',
    medicalConditions: participant?.medicalConditionDetails || '',
    ecName: participant?.emergencyContactName || '',
    ecLastName: participant?.emergencyContactSurname || '',
    ecEmail: participant?.emergencyContactEmail || '',
    ecPhone: participant?.emergencyContactPhone || '',
    relationshipToMinor: participant?.emergencyContactRelationshipToMinor || '',
    personToGoHomeWith: participant?.personToGoHomeWith || '',
    mediaConsent: participant?.mediaConsentGiven || false,
    futureContactConsent: participant?.futureContactPermissionGiven || false,
    emergencyTreatmentConsent: participant?.emergencyTreatmentConsentGiven || false,
    selfSignOutConsent: participant?.selfSignOutPermission || false
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!participant) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString)?.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleToggleEdit = () => {
    if (isEditMode) {
      // Cancel edit - reset form data
      setFormData({
        firstName: participant?.firstName || '',
        lastName: participant?.lastName || '',
        dateOfBirth: participant?.dateOfBirth || '',
        role: participant?.role || 'Participant',
        email: participant?.email || '',
        phone: participant?.phone || '',
        allergies: participant?.allergiesDetails || '',
        medicalConditions: participant?.medicalConditionDetails || '',
        ecName: participant?.emergencyContactName || '',
        ecLastName: participant?.emergencyContactSurname || '',
        ecEmail: participant?.emergencyContactEmail || '',
        ecPhone: participant?.emergencyContactPhone || '',
        relationshipToMinor: participant?.emergencyContactRelationshipToMinor || '',
        personToGoHomeWith: participant?.personToGoHomeWith || '',
        mediaConsent: participant?.mediaConsentGiven || false,
        futureContactConsent: participant?.futureContactPermissionGiven || false,
        emergencyTreatmentConsent: participant?.emergencyTreatmentConsentGiven || false,
        selfSignOutConsent: participant?.selfSignOutPermission || false
      });
    }
    setIsEditMode(!isEditMode);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updatedParticipant = await attendanceService?.updateParticipant(
        participant?.id,
        formData
      );
      
      // Call onUpdate callback if provided
      if (onUpdate) {
        onUpdate(updatedParticipant);
      }
      
      // Close the modal after successful save so it shows fresh data when reopened
      setIsEditMode(false);
      onClose();
    } catch (error) {
      console.error('Error updating participant:', error);
      alert(`Failed to update participant: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      firstName: participant?.firstName || '',
      lastName: participant?.lastName || '',
      dateOfBirth: participant?.dateOfBirth || '',
      role: participant?.role || 'Participant',
      email: participant?.email || '',
      phone: participant?.phone || '',
      allergies: participant?.allergiesDetails || '',
      medicalConditions: participant?.medicalConditionDetails || '',
      ecName: participant?.emergencyContactName || '',
      ecLastName: participant?.emergencyContactSurname || '',
      ecEmail: participant?.emergencyContactEmail || '',
      ecPhone: participant?.emergencyContactPhone || '',
      relationshipToMinor: participant?.emergencyContactRelationshipToMinor || '',
      personToGoHomeWith: participant?.personToGoHomeWith || '',
      mediaConsent: participant?.mediaConsentGiven || false,
      futureContactConsent: participant?.futureContactPermissionGiven || false,
      emergencyTreatmentConsent: participant?.emergencyTreatmentConsentGiven || false,
      selfSignOutConsent: participant?.selfSignOutPermission || false
    });
    setIsEditMode(false);
  };

  const handleConsentChange = async (consentField, value) => {
    try {
      // Update local state immediately for responsive UI
      setFormData(prev => ({
        ...prev,
        [consentField]: value
      }));

      // Update database
      const updatedParticipant = await attendanceService?.updateParticipantConsent(
        participant?.id,
        consentField,
        value
      );

      // Call onUpdate callback if provided
      if (onUpdate) {
        onUpdate(updatedParticipant);
      }
    } catch (error) {
      console.error('Error updating consent:', error);
      alert(`Failed to update consent: ${error?.message || 'Unknown error'}`);
      // Revert local state on error
      setFormData(prev => ({
        ...prev,
        [consentField]: !value
      }));
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      if (onDelete) {
        await onDelete(participant?.id);
      }
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      // Error is handled by parent (index.jsx)
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const renderField = (label, value, field, type = 'text') => {
    if (isEditMode) {
      return (
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {label}
          </label>
          <input
            type={type}
            value={formData?.[field] || ''}
            onChange={(e) => handleInputChange(field, e?.target?.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          {label}
        </label>
        <div className="px-4 py-3 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
          {value || 'N/A'}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-8 py-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Attendee Details</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={handleToggleEdit}
              disabled={isSaving}
            >
              {isEditMode ? 'Cancel Edit' : 'Edit Details Toggle'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-sm text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
              onClick={handleDeleteClick}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close"
              disabled={isSaving}
            >
              <Icon name="X" size={20} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8 space-y-8">
          {/* Attendee Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-5">Attendee Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              {renderField('First Name', participant?.firstName, 'firstName')}

              {/* Last Name */}
              {renderField('Last Name', participant?.lastName, 'lastName')}

              {/* Date of Birth */}
              {renderField('Date of Birth', formatDate(participant?.dateOfBirth), 'dateOfBirth', 'date')}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Role
                </label>
                {isEditMode ? (
                  <div className="relative">
                    <select
                      value={formData?.role || 'Participant'}
                      onChange={(e) => handleInputChange('role', e?.target?.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
                    >
                      <option value="Participant">Participant</option>
                      <option value="Volunteer">Volunteer</option>
                      <option value="Leader">Leader</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
                    {participant?.role || 'Participant'}
                  </div>
                )}
              </div>

              {/* Email */}
              {renderField('Email', participant?.email, 'email', 'email')}

              {/* Phone */}
              {renderField('Phone', participant?.phone, 'phone', 'tel')}

              {/* Allergies */}
              {renderField('Allergies', participant?.allergiesDetails || 'None', 'allergies')}

              {/* Medical Conditions */}
              <div className="md:col-span-2">
                {isEditMode ? (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Medical Conditions
                    </label>
                    <textarea
                      value={formData?.medicalConditions || ''}
                      onChange={(e) => handleInputChange('medicalConditions', e?.target?.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      rows="3"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Medical Conditions
                    </label>
                    <div className="px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
                      {participant?.medicalConditionDetails || 'None'}
                    </div>
                  </div>
                )}
              </div>

              {/* Medicare */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Medicare
                </label>
                <div className="px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
                  N/A
                </div>
              </div>
            </div>
          </div>

          {/* Guardian/Parent/EC Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Guardian/Parent/EC Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* EC Name */}
              {renderField('EC Name', participant?.emergencyContactName, 'ecName')}

              {/* EC Last Name */}
              {renderField('EC Last Name', participant?.emergencyContactSurname, 'ecLastName')}

              {/* EC Email */}
              {renderField('EC Email', participant?.emergencyContactEmail, 'ecEmail', 'email')}

              {/* EC Phone */}
              {renderField('EC Phone', participant?.emergencyContactPhone, 'ecPhone', 'tel')}

              {/* Relationship to minor */}
              {renderField('Relationship to minor', participant?.emergencyContactRelationshipToMinor, 'relationshipToMinor')}

              {/* Name of person they can go home with */}
              <div className="md:col-span-2">
                {isEditMode ? (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Name of person they can go home with
                    </label>
                    <input
                      type="text"
                      value={formData?.personToGoHomeWith || ''}
                      onChange={(e) => handleInputChange('personToGoHomeWith', e?.target?.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter name"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Name of person they can go home with
                    </label>
                    <div className="px-4 py-3 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
                      {participant?.personToGoHomeWith || 'N/A'}
                    </div>
                  </div>
                )}
              </div>

              {/* Date created */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Date created
                </label>
                <div className="px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
                  {formatDate(participant?.createdAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Consent Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Consent Details</h3>
            <div className="space-y-3">
              {/* Media Consent */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="mediaConsent"
                  checked={formData?.mediaConsent}
                  onChange={(e) => handleConsentChange('mediaConsent', e?.target?.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="mediaConsent"
                  className="text-sm font-medium text-foreground cursor-pointer flex-1"
                >
                  Media consent
                </label>
              </div>

              {/* Future Contact Consent */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="futureContactConsent"
                  checked={formData?.futureContactConsent}
                  onChange={(e) => handleConsentChange('futureContactConsent', e?.target?.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="futureContactConsent"
                  className="text-sm font-medium text-foreground cursor-pointer flex-1"
                >
                  Future contact consent
                </label>
              </div>

              {/* Emergency Treatment Consent */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="emergencyTreatmentConsent"
                  checked={formData?.emergencyTreatmentConsent}
                  onChange={(e) => handleConsentChange('emergencyTreatmentConsent', e?.target?.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="emergencyTreatmentConsent"
                  className="text-sm font-medium text-foreground cursor-pointer flex-1"
                >
                  Emergency treatment consent
                </label>
              </div>

              {/* Permission to self-sign out */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="selfSignOutConsent"
                  checked={formData?.selfSignOutConsent}
                  onChange={(e) => handleConsentChange('selfSignOutConsent', e?.target?.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="selfSignOutConsent"
                  className="text-sm font-medium text-foreground cursor-pointer flex-1"
                >
                  Permission to self-sign out
                </label>
              </div>
            </div>
          </div>

          {/* Save/Cancel Buttons in Edit Mode */}
          {isEditMode && (
            <div className="flex justify-end space-x-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60">
          <div className="bg-card rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Participant</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-medium text-foreground">{participant?.firstName} {participant?.lastName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white border-0"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantDetailsModal;