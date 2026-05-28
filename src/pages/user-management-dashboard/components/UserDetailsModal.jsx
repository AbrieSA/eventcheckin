import React from 'react';
import Button from '../../../components/ui/Button';

const UserDetailsModal = ({ user, onClose }) => {
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'regular_user':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'regular_user':
        return 'Regular User';
      default:
        return role;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[30px] border border-border/80 bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-5 sm:px-8">
          <h2 className="text-xl font-heading font-bold text-foreground">
            User Details
          </h2>
          <Button
            onClick={onClose}
            variant="surface"
            size="icon"
            className="rounded-full"
            iconName="X"
            aria-label="Close modal"
          />
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-6 sm:px-8">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Full Name
            </label>
            <div className="text-base text-foreground font-medium">
              {user?.fullName}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Email Address
            </label>
            <div className="text-base text-foreground">
              {user?.email}
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Role
            </label>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${getRoleBadgeColor(user?.role)}`}>
              {getRoleDisplayName(user?.role)}
            </span>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Status
            </label>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${
              user?.isActive
                ? 'bg-green-100 text-green-700 border-green-300' :'bg-red-100 text-red-700 border-red-300'
            }`}>
              {user?.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Created At */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Account Created
            </label>
            <div className="text-base text-foreground">
              {new Date(user?.createdAt)?.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          {/* Last Login */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Last Login
            </label>
            <div className="text-base text-foreground">
              {user?.lastLoginAt
                ? new Date(user?.lastLoginAt)?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Never'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border/70 px-6 py-5 sm:px-8">
          <Button
            onClick={onClose}
            variant="primary"
            className="rounded-full px-6 py-2"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
