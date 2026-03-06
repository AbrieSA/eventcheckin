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
    const token = authHeader.replace('Bearer ', '')

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
      throw new Error('Unauthorized: Only super admins can delete users')
    }

    // Get the user ID to delete from request body
    const { userId } = await req?.json()
    if (!userId) {
      throw new Error('Missing userId in request body')
    }

    // Prevent self-deletion
    if (userId === user?.id) {
      throw new Error('Cannot delete your own account')
    }

    // Delete from user_profiles first (will cascade to related tables)
    const { error: profileDeleteError } = await supabaseAdmin?.from('user_profiles')?.delete()?.eq('id', userId)

    if (profileDeleteError) {
      throw new Error(`Failed to delete user profile: ${profileDeleteError.message}`)
    }

    // Delete from auth.users using admin API
    const { error: authDeleteError } = await supabaseAdmin?.auth?.admin?.deleteUser(userId)

    if (authDeleteError) {
      throw new Error(`Failed to delete auth user: ${authDeleteError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
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