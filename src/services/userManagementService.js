import { supabase } from '../lib/supabase';

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj?.map(toCamelCase);
  if (typeof obj !== 'object') return obj;

  return Object.keys(obj)?.reduce((acc, key) => {
    const camelKey = key?.replace(/_([a-z])/g, (_, letter) => letter?.toUpperCase());
    acc[camelKey] = toCamelCase(obj?.[key]);
    return acc;
  }, {});
};

// Helper function to convert camelCase to snake_case
const toSnakeCase = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj?.map(toSnakeCase);
  if (typeof obj !== 'object') return obj;

  return Object.keys(obj)?.reduce((acc, key) => {
    const snakeKey = key?.replace(/[A-Z]/g, (letter) => `_${letter?.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj?.[key]);
    return acc;
  }, {});
};

export const userManagementService = {
  // Get all users (Super Admin only)
  async getAllUsers() {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('*')
      ?.order('created_at', { ascending: false });

    if (error) throw error;
    return toCamelCase(data);
  },

  // Get user by ID
  async getUserById(userId) {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('*')
      ?.eq('id', userId)
      ?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Create new user (Super Admin only)
  async createUser(userData) {
    const { data, error } = await supabase?.functions?.invoke('create-user', {
      body: {
        email: userData?.email,
        password: userData?.password,
        fullName: userData?.fullName,
        userRole: userData?.userRole || 'regular_user'
      },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || 'Failed to create user');
    }

    return toCamelCase(data?.user);
  },

  // Update user profile (Super Admin only)
  async updateUser(userId, updates) {
    const snakeCaseUpdates = toSnakeCase(updates);
    
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.update(snakeCaseUpdates)
      ?.eq('id', userId)
      ?.select()
      ?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Delete user (Super Admin only)
  async deleteUser(userId) {
    const { data, error } = await supabase?.functions?.invoke('delete-user', {
      body: { userId },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete user');
    }

    return { success: true };
  },

  // Get user statistics
  async getUserStatistics() {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('user_role, is_active');

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      active: data?.filter(u => u?.is_active)?.length || 0,
      superAdmins: data?.filter(u => u?.user_role === 'super_admin')?.length || 0,
      admins: data?.filter(u => u?.user_role === 'admin')?.length || 0,
      regularUsers: data?.filter(u => u?.user_role === 'regular_user')?.length || 0
    };

    return stats;
  },

  // Toggle user status (Super Admin only)
  async toggleUserStatus(userId, isActive) {
    const { data, error } = await supabase?.functions?.invoke('toggle-user-status', {
      body: { userId, isActive },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || 'Failed to update user status');
    }

    return { success: true };
  }
};
