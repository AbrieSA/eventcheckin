import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { userManagementService } from '../../../services/userManagementService';

const UserFormModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    userRole: 'regular_user'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        email: user?.email || '',
        fullName: user?.fullName || '',
        password: '',
        userRole: user?.userRole || 'regular_user'
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!formData?.email || !formData?.fullName) {
      setError('Email and full name are required');
      return;
    }

    if (!user && !formData?.password) {
      setError('Password is required for new users');
      return;
    }

    try {
      setLoading(true);

      if (user) {
        // Update existing user
        await userManagementService?.updateUser(user?.id, {
          fullName: formData?.fullName,
          userRole: formData?.userRole
        });
        alert('User updated successfully');
      } else {
        // Create new user
        await userManagementService?.createUser(formData);
        alert('User created successfully');
      }

      onSave();
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err?.message || 'Failed to save user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-border">
          <h2 className="text-xl font-heading font-bold text-foreground">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Icon name="X" size={20} color="var(--color-foreground)" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Email Address *
            </label>
            <Input
              type="email"
              value={formData?.email}
              onChange={(e) => setFormData({ ...formData, email: e?.target?.value })}
              placeholder="user@example.com"
              disabled={loading || !!user}
              className="w-full"
            />
            {user && (
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed after user creation
              </p>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Full Name *
            </label>
            <Input
              type="text"
              value={formData?.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e?.target?.value })}
              placeholder="John Doe"
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Password */}
          {!user && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Password *
              </label>
              <Input
                type="password"
                value={formData?.password}
                onChange={(e) => setFormData({ ...formData, password: e?.target?.value })}
                placeholder="Enter password"
                disabled={loading}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 6 characters
              </p>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Role *
            </label>
            <select
              value={formData?.userRole}
              onChange={(e) => setFormData({ ...formData, userRole: e?.target?.value })}
              disabled={loading}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="regular_user">Regular User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-5 py-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-border hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;