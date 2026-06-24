import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = new Set(['regular_user', 'admin', 'super_admin']);

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

const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
    return jsonResponse({ success: false, error: 'Only active super admins can create users' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const email = body.email;
  const password = body.password;
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : '';
  const userRole = typeof body.userRole === 'string' && VALID_ROLES.has(body.userRole)
    ? body.userRole
    : 'regular_user';

  if (!isEmail(email) || typeof password !== 'string' || password.length < 8 || !fullName) {
    return jsonResponse({ success: false, error: 'Invalid user details' }, 400);
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    console.error('Auth user creation failed', createError);
    return jsonResponse({ success: false, error: 'Failed to create user' }, 500);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      user_role: userRole,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (profileError || !profile) {
    console.error('Profile creation failed after auth user creation', profileError);
    await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return jsonResponse({ success: false, error: 'Failed to create user profile' }, 500);
  }

  return jsonResponse({ success: true, user: profile });
});
