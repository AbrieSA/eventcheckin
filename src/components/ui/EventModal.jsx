import React, { useEffect, useState } from 'react';
import Button from './Button';
import Input from './Input';

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const createDefaultFormData = () => ({
  eventName: '',
  eventDate: getTodayDate(),
  eventCategory: ''
});

const EventModal = ({ isOpen, onClose, onCreateEvent }) => {
  const [formData, setFormData] = useState(createDefaultFormData);

  useEffect(() => {
    if (isOpen) {
      setFormData(createDefaultFormData());
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmedEventName = formData?.eventName?.trim();
    const trimmedEventCategory = formData?.eventCategory?.trim();

    if (trimmedEventName && formData?.eventDate) {
      onCreateEvent({
        ...formData,
        eventName: trimmedEventName,
        eventCategory: trimmedEventCategory || null
      });
      // Reset form
      setFormData(createDefaultFormData());
    }
  };

  const handleCancel = () => {
    // Reset form
    setFormData(createDefaultFormData());
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
          className="w-full max-w-md rounded-[30px] border border-border/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] transform transition-all"
          onClick={(e) => e?.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 px-6 py-5 sm:px-8">
            <h2 className="text-2xl font-heading font-semibold text-foreground">
              Create New Event
            </h2>
            <Button
              onClick={handleCancel}
              variant="surface"
              size="icon"
              className="rounded-full"
              iconName="X"
              aria-label="Close modal"
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 sm:px-8">
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

                Event Category (Optional)
              </label>
              <Input
                id="eventCategory"
                type="text"
                value={formData?.eventCategory}
                onChange={(e) => handleInputChange('eventCategory', e?.target?.value)}
                placeholder="Enter event category"
                className="w-full" />

            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6">
              <Button
                type="button"
                onClick={handleCancel}
                variant="surface"
                className="rounded-full px-6 py-2.5">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="rounded-full px-6 py-2.5"
                disabled={!formData?.eventName?.trim() || !formData?.eventDate}>
                Create Event
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>);

};

export default EventModal;
