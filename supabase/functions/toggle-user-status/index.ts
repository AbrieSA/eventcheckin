import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const createAdminClient = () =>
  createClient(
    Deno?.env?.get('SUPABASE_URL') ?? '',
    Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401);
  }

  const supabaseAdmin = createAdminClient();
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return jsonResponse({ success: false, error: 'Invalid user token' }, 401);
  }

  const { data: actorProfile, error: actorError } = await supabaseAdmin
    .from('user_profiles')
    .select('user_role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (actorError || !actorProfile || actorProfile.user_role !== 'super_admin' || actorProfile.is_active !== true) {
    return jsonResponse({ success: false, error: 'Only active super admins can change user status' }, 403);
  }

  let body: { userId?: unknown; isActive?: unknown };
  try {
    body = await req.json();
  } catch (_) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  const isActive = body.isActive;
  if (!UUID_PATTERN.test(userId) || typeof isActive !== 'boolean') {
    return jsonResponse({ success: false, error: 'Invalid userId or isActive' }, 400);
  }

  if (userId === user.id) {
    return jsonResponse({ success: false, error: 'Cannot change your own account status' }, 400);
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) {
    return jsonResponse({ success: false, error: 'Failed to verify target user' }, 500);
  }

  if (!targetProfile) {
    return jsonResponse({ success: false, error: 'User not found' }, 404);
  }

  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { ban_duration: isActive ? 'none' : '876000h' },
  );

  if (authUpdateError) {
    console.error('Auth status update failed', authUpdateError);
    return jsonResponse({ success: false, error: 'Failed to update auth user status' }, 500);
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (profileUpdateError) {
    console.error('Profile status update failed after auth status update', profileUpdateError);
    await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: isActive ? '876000h' : 'none' },
    ).catch(() => {});
    return jsonResponse({ success: false, error: 'Failed to update user status' }, 500);
  }

  return jsonResponse({
    success: true,
    message: isActive ? 'User reactivated successfully' : 'User deactivated successfully',
  });
});
