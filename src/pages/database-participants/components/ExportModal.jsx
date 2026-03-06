import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const ExportModal = ({ participants, onClose }) => {
  // Define all available columns from participants table
  const availableColumns = [
    { key: 'firstName', label: 'First Name', dbField: 'first_name' },
    { key: 'lastName', label: 'Last Name', dbField: 'last_name' },
    { key: 'phone', label: 'Phone', dbField: 'phone' },
    { key: 'email', label: 'Email', dbField: 'email' },
    { key: 'dateOfBirth', label: 'Date of Birth', dbField: 'date_of_birth' },
    { key: 'age', label: 'Age', dbField: 'age' },
    { key: 'is18OrOver', label: 'Is 18 or Over', dbField: 'is_18_or_over' },
    { key: 'participantId', label: 'Participant ID', dbField: 'participant_id' },
    { key: 'hasAllergies', label: 'Has Allergies', dbField: 'has_allergies' },
    { key: 'allergies', label: 'Allergies List', dbField: 'allergies' },
    { key: 'allergiesDetails', label: 'Allergies Details', dbField: 'allergies_details' },
    { key: 'hasMedicalConditions', label: 'Has Medical Conditions', dbField: 'has_medical_conditions' },
    { key: 'medicalNotes', label: 'Medical Notes', dbField: 'medical_notes' },
    { key: 'medicalConditionDetails', label: 'Medical Condition Details', dbField: 'medical_condition_details' },
    { key: 'emergencyContactName', label: 'Emergency Contact Name', dbField: 'emergency_contact_name' },
    { key: 'emergencyContactSurname', label: 'Emergency Contact Surname', dbField: 'emergency_contact_surname' },
    { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', dbField: 'emergency_contact_phone' },
    { key: 'emergencyContactEmail', label: 'Emergency Contact Email', dbField: 'emergency_contact_email' },
    { key: 'emergencyContactRelationshipToMinor', label: 'Emergency Contact Relationship', dbField: 'emergency_contact_relationship_to_minor' },
    { key: 'mediaConsentGiven', label: 'Media Consent Given', dbField: 'media_consent_given' },
    { key: 'emergencyTreatmentConsentGiven', label: 'Emergency Treatment Consent', dbField: 'emergency_treatment_consent_given' },
    { key: 'futureContactPermissionGiven', label: 'Future Contact Permission', dbField: 'future_contact_permission_given' },
    { key: 'createdAt', label: 'Created At', dbField: 'created_at' }
  ];

  // Initialize with all columns unselected
  const [selectedColumns, setSelectedColumns] = useState(
    availableColumns?.reduce((acc, col) => ({ ...acc, [col?.key]: false }), {})
  );

  const handleToggleColumn = (columnKey) => {
    setSelectedColumns(prev => ({
      ...prev,
      [columnKey]: !prev?.[columnKey]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = availableColumns?.every(col => selectedColumns?.[col?.key]);
    const newState = availableColumns?.reduce(
      (acc, col) => ({ ...acc, [col?.key]: !allSelected }),
      {}
    );
    setSelectedColumns(newState);
  };

  const handleExport = () => {
    try {
      // Get selected column definitions
      const columnsToExport = availableColumns?.filter(col => selectedColumns?.[col?.key]);

      if (columnsToExport?.length === 0) {
        alert('Please select at least one column to export.');
        return;
      }

      // Create CSV headers
      const headers = columnsToExport?.map(col => col?.label);

      // Create CSV rows
      const csvRows = [
        headers?.join(','),
        ...participants?.map(participant => {
          return columnsToExport?.map(col => {
            let value = participant?.[col?.key];

            // Handle different data types
            if (value === null || value === undefined) {
              return '';
            } else if (typeof value === 'boolean') {
              return value ? 'Yes' : 'No';
            } else if (Array.isArray(value)) {
              return `"${value?.join('; ')}"`;
            } else if (typeof value === 'string' && (value?.includes(',') || value?.includes('"') || value?.includes('\n'))) {
              // Escape quotes and wrap in quotes if contains special characters
              return `"${value?.replace(/"/g, '""')}"`;
            } else if (value instanceof Date || col?.key === 'dateOfBirth' || col?.key === 'createdAt') {
              // Format dates
              return new Date(value)?.toLocaleDateString();
            } else {
              return value;
            }
          })?.join(',');
        })
      ];

      const csvContent = csvRows?.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL?.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants_export_${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
      document.body?.appendChild(a);
      a?.click();
      document.body?.removeChild(a);
      window.URL?.revokeObjectURL(url);

      // Close modal after successful export
      onClose();
    } catch (error) {
      console.error('Error exporting participants:', error);
      alert('Failed to export participants. Please try again.');
    }
  };

  const selectedCount = Object.values(selectedColumns)?.filter(Boolean)?.length;
  const allSelected = availableColumns?.every(col => selectedColumns?.[col?.key]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              What info do you want to export?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Select the columns you want to include in the CSV export
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <Icon name="X" size={24} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Export Button and Select All */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleSelectAll}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} of {availableColumns?.length} selected
            </span>
            <Button
              onClick={handleExport}
              disabled={selectedCount === 0}
              className="min-w-[120px]"
              iconName="Download"
              iconPosition="left"
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Column Selection List */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {availableColumns?.map((column) => (
              <div
                key={column?.key}
                className="flex items-center space-x-3 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <Checkbox
                  checked={selectedColumns?.[column?.key]}
                  onChange={() => handleToggleColumn(column?.key)}
                  className="flex-shrink-0"
                />
                <label
                  onClick={() => handleToggleColumn(column?.key)}
                  className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                >
                  {column?.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-8 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedCount === 0}
            iconName="Download"
            iconPosition="left"
          >
            Export {selectedCount} Column{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;