import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { userManagementService } from '../../services/userManagementService';
import UserFormModal from './components/UserFormModal';
import UserDetailsModal from './components/UserDetailsModal';
import AuditLogExportModal from './components/AuditLogExportModal';

const UserManagementDashboard = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statistics, setStatistics] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAuditLogModal, setShowAuditLogModal] = useState(false);

  // Redirect if not super admin
  useEffect(() => {
    if (!authLoading && !isSuperAdmin()) {
      navigate('/home-dashboard');
    }
  }, [isSuperAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin()) {
      loadUsers();
      loadStatistics();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, roleFilter, statusFilter, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userManagementService?.getAllUsers();
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await userManagementService?.getUserStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm?.trim()) {
      filtered = filtered?.filter((user) => {
        const fullName = user?.fullName?.toLowerCase() || '';
        const email = user?.email?.toLowerCase() || '';
        const search = searchTerm?.toLowerCase();
        return fullName?.includes(search) || email?.includes(search);
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered?.filter((user) => user?.userRole === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered?.filter((user) => user?.isActive === isActive);
    }

    setFilteredUsers(filtered);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setShowAddModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowAddModal(true);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm('Are you sure you want to delete this user? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await userManagementService?.deleteUser(userId);
      alert('User deleted successfully.');
      loadUsers();
      loadStatistics();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'reactivate';
    const confirmed = window.confirm(
      `Are you sure you want to ${action} this user? ${!currentStatus ? 'They will be able to log in again.' : 'They will not be able to log in.'}`
    );
    if (!confirmed) return;

    try {
      await userManagementService?.toggleUserStatus(userId, !currentStatus);
      alert(`User ${action}d successfully.`);
      loadUsers();
      loadStatistics();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert(error?.message || 'Failed to update user status. Please try again.');
    }
  };

  const handleUserSaved = () => {
    setShowAddModal(false);
    setSelectedUser(null);
    loadUsers();
    loadStatistics();
  };

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <button
              onClick={() => navigate('/home-dashboard')}
              className="flex items-center space-x-2 sm:space-x-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg p-2 hover:bg-primary/5 transition-colors"
            >
              <Icon name="ArrowLeft" size={24} color="var(--color-primary)" />
              <span className="text-lg font-semibold text-foreground">Back to Dashboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            User Management
          </h1>
        </div>

        {/* Filters and Actions */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value)}
                className="w-full"
              />
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e?.target?.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="regular_user">Regular User</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e?.target?.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Add User Button */}
          <div className="mt-4">
            <Button
              onClick={handleAddUser}
              className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              <Icon name="Plus" size={20} color="white" className="inline mr-2" />
              Add New User
            </Button>
            <Button
              onClick={() => setShowAuditLogModal(true)}
              className="ml-3 bg-secondary hover:bg-secondary/90 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              <Icon name="FileText" size={20} color="white" className="inline mr-2" />
              Export Audit Logs
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers?.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers?.map((user) => (
                    <tr key={user?.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-foreground">{user?.fullName}</div>
                          <div className="text-sm text-muted-foreground">{user?.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeColor(user?.userRole)}`}>
                          {getRoleDisplayName(user?.userRole)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(user?.id, user?.isActive)}
                          className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${
                            user?.isActive
                              ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' :'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                          } transition-colors`}
                        >
                          {user?.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {user?.lastLoginAt ? new Date(user?.lastLoginAt)?.toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Icon name="Eye" size={18} color="var(--color-foreground)" />
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Icon name="Edit" size={18} color="var(--color-primary)" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user?.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Icon name="Trash2" size={18} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <UserFormModal
          user={selectedUser}
          onClose={() => {
            setShowAddModal(false);
            setSelectedUser(null);
          }}
          onSave={handleUserSaved}
        />
      )}

      {showDetailsModal && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {showAuditLogModal && (
        <AuditLogExportModal
          onClose={() => setShowAuditLogModal(false)}
        />
      )}
    </div>
  );
};

export default UserManagementDashboard;