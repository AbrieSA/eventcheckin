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
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase?.auth?.signUp({
        email: userData?.email,
        password: userData?.password,
        options: {
          data: {
            full_name: userData?.fullName,
            role: userData?.userRole || 'regular_user'
          }
        }
      });

      if (authError) throw authError;

      // Return the created user profile (trigger creates it automatically)
      if (authData?.user) {
        // Wait a moment for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: profileData, error: profileError } = await supabase
          ?.from('user_profiles')
          ?.select('*')
          ?.eq('id', authData?.user?.id)
          ?.maybeSingle();

        if (profileError) throw profileError;
        return toCamelCase(profileData);
      }

      return null;
    } catch (error) {
      throw error;
    }
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
    // Get current session (don't refresh, use existing valid session)
    const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('No valid session found. Please log in again.');
    }

    const response = await fetch(
      `${import.meta.env?.VITE_SUPABASE_URL}/functions/v1/delete-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      }
    );

    const result = await response?.json();

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to delete user');
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
    // Validate and get fresh user token (this will refresh if needed)
    const { data: { user }, error: userError } = await supabase?.auth?.getUser();
    
    if (userError || !user) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Get the current session with validated token
    const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('No valid session found. Please log in again.');
    }

    const response = await fetch(
      `${import.meta.env?.VITE_SUPABASE_URL}/functions/v1/toggle-user-status`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, isActive }),
      }
    );

    const result = await response?.json();

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to update user status');
    }

    return { success: true };
  }
};