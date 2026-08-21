import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { attendanceService } from '../../../services/attendanceService';

const createParticipantFormData = (participant) => ({
  firstName: participant?.firstName || '',
  lastName: participant?.lastName || '',
  dateOfBirth: participant?.dateOfBirth || '',
  role: participant?.role || 'Participant',
  email: participant?.email || '',
  phone: participant?.phone || '',
  allergies: participant?.allergiesDetails || '',
  medicalConditions: participant?.medicalConditionDetails || '',
  notes: participant?.notes || '',
  medicare: participant?.medicare || '',
  ecName: participant?.emergencyContactName || '',
  ecLastName: participant?.emergencyContactSurname || '',
  ecEmail: participant?.emergencyContactEmail || '',
  ecPhone: participant?.emergencyContactPhone || '',
  relationshipToMinor: participant?.emergencyContactRelationshipToMinor || '',
  personToGoHomeWith: participant?.personToGoHomeWith || '',
  formReceived: participant?.formReceived || false,
  mediaConsent: participant?.mediaConsentGiven || false,
  futureContactConsent: participant?.futureContactPermissionGiven || false,
  emergencyTreatmentConsent: participant?.emergencyTreatmentConsentGiven || false,
  selfSignOutConsent: participant?.selfSignOutPermission || false
});

const ParticipantDetailsModal = ({
  participant,
  onClose,
  onUpdate,
  onDelete
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(() => createParticipantFormData(participant));
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
    setFormData(prev => {
      const nextFormData = {
        ...prev,
        [field]: value
      };
      return nextFormData;
    });
  };

  const handleToggleEdit = () => {
    if (isEditMode) {
      // Cancel edit - reset form data
      setFormData(createParticipantFormData(participant));
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
    setFormData(createParticipantFormData(participant));
    setIsEditMode(false);
  };

  const handleConsentChange = async (consentField, value) => {
    if (!isEditMode) return;

    setFormData(prev => {
      const nextFormData = {
        ...prev,
        [consentField]: value
      };
      return nextFormData;
    });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-border/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/70 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <h2 className="text-xl font-bold text-foreground">Attendee Details</h2>
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:flex sm:w-auto">
            <Button
              variant="surface"
              size="sm"
              className="min-w-0 text-sm"
              onClick={handleToggleEdit}
              disabled={isSaving}
            >
              <span className="sm:hidden">{isEditMode ? 'Cancel' : 'Edit'}</span>
              <span className="hidden sm:inline">{isEditMode ? 'Cancel Edit' : 'Edit Details'}</span>
            </Button>
            <Button
              variant="surfaceDanger"
              size="sm"
              className="text-sm"
              onClick={handleDeleteClick}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <Button
              onClick={onClose}
              variant="surface"
              size="icon"
              className="rounded-full"
              iconName="X"
              aria-label="Close"
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Content */}
        <div className="scrollbar-custom min-h-0 flex-1 overflow-y-auto space-y-8 px-6 py-6 sm:px-8">
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
              {renderField('Medicare', participant?.medicare, 'medicare')}

              {/* Notes */}
              <div className="md:col-span-2">
                {isEditMode ? (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1" htmlFor="participant-notes">
                      Notes <span className="font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="participant-notes"
                      value={formData?.notes || ''}
                      onChange={(e) => handleInputChange('notes', e?.target?.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      rows="3"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                    <div className="whitespace-pre-wrap px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-foreground">
                      {participant?.notes || 'None'}
                    </div>
                  </div>
                )}
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
              {/* Form Received */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="formReceived"
                  checked={formData?.formReceived}
                  onChange={(e) => handleConsentChange('formReceived', e?.target?.checked)}
                  disabled={!isEditMode}
                  className={`w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                />
                <label
                  htmlFor="formReceived"
                  className={`text-sm font-medium text-foreground flex-1 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                >
                  Form Received
                </label>
              </div>

              {/* Media Consent */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="mediaConsent"
                  checked={formData?.mediaConsent}
                  onChange={(e) => handleConsentChange('mediaConsent', e?.target?.checked)}
                  disabled={!isEditMode}
                  className={`w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                />
                <label
                  htmlFor="mediaConsent"
                  className={`text-sm font-medium text-foreground flex-1 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
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
                  disabled={!isEditMode}
                  className={`w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                />
                <label
                  htmlFor="futureContactConsent"
                  className={`text-sm font-medium text-foreground flex-1 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
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
                  disabled={!isEditMode}
                  className={`w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                />
                <label
                  htmlFor="emergencyTreatmentConsent"
                  className={`text-sm font-medium text-foreground flex-1 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
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
                  disabled={!isEditMode}
                  className={`w-4 h-4 text-primary bg-background border-border rounded focus:ring-2 focus:ring-primary ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                />
                <label
                  htmlFor="selfSignOutConsent"
                  className={`text-sm font-medium text-foreground flex-1 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
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
