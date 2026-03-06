import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportAuthError } from '../services/errorReportingService';

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Isolated async operations - never called from auth callbacks
  const profileOperations = {
    async load(userId) {
      if (!userId) return
      setProfileLoading(true)
      try {
        // First, update last_login_at
        await supabase?.from('user_profiles')?.update({ 
          last_login_at: new Date()?.toISOString() 
        })?.eq('id', userId)
        
        // Then fetch the updated profile
        const { data, error } = await supabase?.from('user_profiles')?.select('*')?.eq('id', userId)?.maybeSingle()
        if (!error && data) {
          setUserProfile(data)
        } else {
          console.error('Profile load error:', error)
          if (error) reportAuthError(error, 'Profile load failed for user: ' + userId);
        }
      } catch (error) {
        console.error('Profile load error:', error)
        reportAuthError(error, 'Profile load exception for user: ' + userId);
      } finally {
        setProfileLoading(false)
      }
    },

    clear() {
      setUserProfile(null)
      setProfileLoading(false)
    }
  }

  // Auth state handlers - PROTECTED from async modification
  const authStateHandlers = {
    // This handler MUST remain synchronous - Supabase requirement
    onChange: (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      if (session?.user) {
        profileOperations?.load(session?.user?.id) // Fire-and-forget
      } else {
        profileOperations?.clear()
      }
    }
  }

  useEffect(() => {
    // Initial session check with error handling
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
      authStateHandlers?.onChange(null, session)
    })?.catch((error) => {
      // Handle invalid refresh token errors
      if (error?.message?.includes('refresh_token_not_found') || 
          error?.message?.includes('Invalid Refresh Token')) {
        console.warn('Invalid session detected, clearing auth state')
        supabase?.auth?.signOut()?.catch(() => {})
        setUser(null)
        profileOperations?.clear()
        setLoading(false)
      }
    })

    // CRITICAL: This must remain synchronous
    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(
      (event, session) => {
        // Handle TOKEN_REFRESHED event errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('Token refresh failed, clearing session')
          supabase?.auth?.signOut()?.catch(() => {})
          setUser(null)
          profileOperations?.clear()
          setLoading(false)
          return
        }
        
        authStateHandlers?.onChange(event, session)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  // Auth methods
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({ email, password })
      
      if (error) {
        reportAuthError(error, 'Sign in failed');
        return { data, error }
      }
      
      // Check if user is active before allowing login
      if (data?.user) {
        const { data: profileData, error: profileError } = await supabase
          ?.from('user_profiles')
          ?.select('is_active')
          ?.eq('id', data?.user?.id)
          ?.maybeSingle()
        
        if (profileError) {
          console.error('Profile check error:', profileError)
          return { error: { message: 'Failed to verify account status. Please try again.' } }
        }
        
        if (!profileData) {
          // Sign out if no profile exists
          await supabase?.auth?.signOut()
          return { error: { message: 'Account not found. Please contact support.' } }
        }
        
        if (profileData?.is_active === false) {
          // Sign out deactivated user
          await supabase?.auth?.signOut()
          return { error: { message: 'Your account has been deactivated. Please contact an administrator.' } }
        }
        
        // Force refresh profile immediately after successful login
        await profileOperations?.load(data?.user?.id)
      }
      
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase?.auth?.signOut()
      if (!error) {
        setUser(null)
        profileOperations?.clear()
      }
      return { error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: { message: 'No user logged in' } }
    
    try {
      const { data, error } = await supabase?.from('user_profiles')?.update(updates)?.eq('id', user?.id)?.select()?.maybeSingle()
      if (!error) setUserProfile(data)
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  // Role checking methods
  const isSuperAdmin = () => {
    return userProfile?.user_role === 'super_admin'
  }

  const isAdmin = () => {
    return userProfile?.user_role === 'admin' || userProfile?.user_role === 'super_admin'
  }

  const isRegularUser = () => {
    return userProfile?.user_role === 'regular_user'
  }

  const hasRole = (role) => {
    return userProfile?.user_role === role
  }

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
    isSuperAdmin,
    isAdmin,
    isRegularUser,
    hasRole
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
