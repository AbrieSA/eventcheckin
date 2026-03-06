import React, { useState } from 'react';
import Icon from '../AppIcon';
import Button from './Button';
import Input from './Input';

const EventModal = ({ isOpen, onClose, onCreateEvent }) => {
  const [formData, setFormData] = useState({
    eventName: '',
    eventDate: '',
    eventCategory: ''
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (formData?.eventName && formData?.eventDate && formData?.eventCategory) {
      onCreateEvent(formData);
      // Reset form
      setFormData({
        eventName: '',
        eventDate: '',
        eventCategory: ''
      });
    }
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      eventName: '',
      eventDate: '',
      eventCategory: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={handleCancel}
        aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md transform transition-all"
          onClick={(e) => e?.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-border pr-8 py-2.5">
            <h2 className="text-2xl font-heading font-semibold text-foreground">
              Create New Event
            </h2>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Close modal">

              <Icon name="X" size={20} color="var(--color-muted-foreground)" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6 py-[15px]">
            {/* Event Name */}
            <div>
              <label
                htmlFor="eventName"
                className="block text-sm font-medium text-foreground mb-3">

                Event Name
              </label>
              <Input
                id="eventName"
                type="text"
                value={formData?.eventName}
                onChange={(e) => handleInputChange('eventName', e?.target?.value)}
                placeholder="Enter event name"
                required
                className="w-full" />

            </div>

            {/* Event Date */}
            <div>
              <label
                htmlFor="eventDate"
                className="block text-sm font-medium text-foreground mb-3">

                Event Date
              </label>
              <Input
                id="eventDate"
                type="date"
                value={formData?.eventDate}
                onChange={(e) => handleInputChange('eventDate', e?.target?.value)}
                required
                className="w-full" />

            </div>

            {/* Event Category */}
            <div>
              <label
                htmlFor="eventCategory"
                className="block text-sm font-medium text-foreground mb-3">

                Event Category
              </label>
              <Input
                id="eventCategory"
                type="text"
                value={formData?.eventCategory}
                onChange={(e) => handleInputChange('eventCategory', e?.target?.value)}
                placeholder="Enter event category"
                required
                className="w-full" />

            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6">
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
                className="px-6 py-2.5">

                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="px-6 py-2.5"
                disabled={!formData?.eventName || !formData?.eventDate || !formData?.eventCategory}>

                Create Event
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>);

};

export default EventModal;