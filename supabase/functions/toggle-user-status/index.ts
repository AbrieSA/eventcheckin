import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req?.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req?.headers?.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Extract the token from "Bearer <token>"
    const token = authHeader?.replace('Bearer ', '')

    // Create Supabase client with service role key (has admin privileges)
    const supabaseAdmin = createClient(
      Deno?.env?.get('SUPABASE_URL') ?? '',
      Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the JWT token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin?.auth?.getUser(token)
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token')
    }

    // Check if user is super admin
    const { data: profile, error: profileError } = await supabaseAdmin?.from('user_profiles')?.select('user_role')?.eq('id', user?.id)?.single()

    if (profileError || !profile || profile?.user_role !== 'super_admin') {
      throw new Error('Unauthorized: Only super admins can change user status')
    }

    // Get the user ID and new status from request body
    const { userId, isActive } = await req?.json()
    if (!userId || typeof isActive !== 'boolean') {
      throw new Error('Missing userId or isActive in request body')
    }

    // Prevent self-deactivation
    if (userId === user?.id) {
      throw new Error('Cannot change your own account status')
    }

    // Update user_profiles table
    const { error: profileUpdateError } = await supabaseAdmin?.from('user_profiles')?.update({ is_active: isActive })?.eq('id', userId)

    if (profileUpdateError) {
      throw new Error(`Failed to update user profile: ${profileUpdateError.message}`)
    }

    // Update auth.users using admin API to ban/unban user
    if (isActive) {
      // Reactivate user by removing ban
      const { error: authUpdateError } = await supabaseAdmin?.auth?.admin?.updateUserById(
        userId,
        { ban_duration: 'none' }
      )
      if (authUpdateError) {
        throw new Error(`Failed to reactivate auth user: ${authUpdateError.message}`)
      }
    } else {
      // Deactivate user by setting indefinite ban
      const { error: authUpdateError } = await supabaseAdmin?.auth?.admin?.updateUserById(
        userId,
        { ban_duration: '876000h' } // 100 years (effectively permanent)
      )
      if (authUpdateError) {
        throw new Error(`Failed to deactivate auth user: ${authUpdateError.message}`)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isActive ? 'User reactivated successfully' : 'User deactivated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})