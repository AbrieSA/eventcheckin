import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from './Button';
import Input from './Input';
import { attendanceService } from '../../services/attendanceService';

const AddAttendeeModal = ({ isOpen, onClose, onAddAttendee }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    allergies: '',
    medicalConditions: '',
    medicare: '',
    ecName: '',
    ecLastName: '',
    ecEmail: '',
    ecPhone: '',
    relationshipToMinor: '',
    date: '',
    mediaConsent: false,
    futureContactConsent: false,
    emergencyTreatmentConsent: false
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Prefill date with current date when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date()?.toISOString()?.split('T')?.[0];
      setFormData(prev => ({
        ...prev,
        date: today
      }));
      // Reset errors when modal opens
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors?.[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields validation - only first name, last name, date of birth
    if (!formData?.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData?.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData?.dateOfBirth?.trim()) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }

    // Optional email validation - only if provided
    if (formData?.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Emergency contact validation - only first name and last name required
    if (!formData?.ecName?.trim()) {
      newErrors.ecName = 'Emergency contact name is required';
    }
    if (!formData?.ecLastName?.trim()) {
      newErrors.ecLastName = 'Emergency contact last name is required';
    }
    if (!formData?.ecPhone?.trim()) {
      newErrors.ecPhone = 'Emergency contact phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Save to Supabase
      const newParticipant = await attendanceService?.createParticipant(formData);
      
      // Call parent callback if provided
      onAddAttendee?.(newParticipant);
      
      // Close modal and reset form
      handleClose();
    } catch (error) {
      console.error('Error creating participant:', error);
      setSubmitError(error?.message || 'Failed to add attendee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      allergies: '',
      medicalConditions: '',
      medicare: '',
      ecName: '',
      ecLastName: '',
      ecEmail: '',
      ecPhone: '',
      relationshipToMinor: '',
      date: '',
      mediaConsent: false,
      futureContactConsent: false,
      emergencyTreatmentConsent: false
    });
    setErrors({});
    setSubmitError(null);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all"
          onClick={(e) => e?.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Add Attendee</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-label="Close modal"
            >
              <Icon name="X" size={20} color="#6B7280" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Error Message */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-md flex items-start gap-2">
                <Icon name="AlertCircle" size={20} color="#B91C1C" className="flex-shrink-0 mt-0.5" />
                <span className="text-sm">{submitError}</span>
              </div>
            )}

            {/* Attendee Details Section */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-5">Attendee Details</h3>
              
              {/* First Name & Last Name Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="firstName"
                    value={formData?.firstName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors?.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter first name"
                  />
                  {errors?.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors?.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="lastName"
                    value={formData?.lastName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors?.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter last name"
                  />
                  {errors?.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors?.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email & Phone Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData?.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors?.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter email"
                  />
                  {errors?.email && (
                    <p className="text-red-500 text-xs mt-1">{errors?.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData?.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone"
                  />
                </div>
              </div>

              {/* Date of Birth Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    name="dateOfBirth"
                    value={formData?.dateOfBirth}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors?.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Date of Birth"
                  />
                  {errors?.dateOfBirth && (
                    <p className="text-red-500 text-xs mt-1">{errors?.dateOfBirth}</p>
                  )}
                </div>
              </div>

              {/* Allergies & Medical Conditions Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allergies
                  </label>
                  <Input
                    type="text"
                    name="allergies"
                    value={formData?.allergies}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Allergies"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medical Conditions
                  </label>
                  <Input
                    type="text"
                    name="medicalConditions"
                    value={formData?.medicalConditions}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Conditions"
                  />
                </div>
              </div>

              {/* Medicare Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medicare
                  </label>
                  <Input
                    type="text"
                    name="medicare"
                    value={formData?.medicare}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Medicare"
                  />
                </div>
              </div>
            </div>

            {/* Guardian/Parent/EC Details Section */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-5">Guardian/Parent/EC Details</h3>
              
              {/* EC Name & EC Last Name Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EC Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="ecName"
                    value={formData?.ecName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors?.ecName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter EC name"
                  />
                  {errors?.ecName && (
                    <p className="text-red-500 text-xs mt-1">{errors?.ecName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EC Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="ecLastName"
                    value={formData?.ecLastName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors?.ecLastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter EC last name"
                  />
                  {errors?.ecLastName && (
                    <p className="text-red-500 text-xs mt-1">{errors?.ecLastName}</p>
                  )}
                </div>
              </div>

              {/* EC Email & EC Phone Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EC Email
                  </label>
                  <Input
                    type="email"
                    name="ecEmail"
                    value={formData?.ecEmail}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter EC email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EC Phone <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    name="ecPhone"
                    value={formData?.ecPhone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter EC phone"
                  />
                  {errors?.ecPhone && (
                    <p className="text-red-500 text-xs mt-1">{errors?.ecPhone}</p>
                  )}
                </div>
              </div>

              {/* Relationship to Minor & Date Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship to minor
                  </label>
                  <Input
                    type="text"
                    name="relationshipToMinor"
                    value={formData?.relationshipToMinor}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter relationship"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <Input
                    type="date"
                    name="date"
                    value={formData?.date}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Consent Details Section */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-5">Consent Details</h3>
              <div className="space-y-3">
                {/* Media Consent */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="mediaConsent"
                    name="mediaConsent"
                    checked={formData?.mediaConsent}
                    onChange={(e) => handleChange({ target: { name: 'mediaConsent', value: e?.target?.checked } })}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  />
                  <label
                    htmlFor="mediaConsent"
                    className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
                  >
                    Media consent
                  </label>
                </div>

                {/* Future Contact Consent */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="futureContactConsent"
                    name="futureContactConsent"
                    checked={formData?.futureContactConsent}
                    onChange={(e) => handleChange({ target: { name: 'futureContactConsent', value: e?.target?.checked } })}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  />
                  <label
                    htmlFor="futureContactConsent"
                    className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
                  >
                    Future contact consent
                  </label>
                </div>

                {/* Emergency Treatment Consent */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="emergencyTreatmentConsent"
                    name="emergencyTreatmentConsent"
                    checked={formData?.emergencyTreatmentConsent}
                    onChange={(e) => handleChange({ target: { name: 'emergencyTreatmentConsent', value: e?.target?.checked } })}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  />
                  <label
                    htmlFor="emergencyTreatmentConsent"
                    className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
                  >
                    Emergency treatment consent
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Icon name="Loader2" size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Attendee'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddAttendeeModal;