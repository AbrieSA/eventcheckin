import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const field = (value: unknown, fallback: string, maxLength: number) => {
  const text = typeof value === "string" ? value : fallback;
  return text.slice(0, maxLength);
};

const getUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Authentication required" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { user: null, error: "Invalid user token" };
  }

  return { user: data.user, error: null };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { user, error: authError } = await getUser(req);
  if (authError || !user) {
    return jsonResponse({ error: authError || "Authentication required" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const errorType = field(body.errorType, "Frontend Error", 80);
  const message = field(body.message, "Unknown error", 1500);
  const stack = field(body.stack, "", 5000);
  const context = field(body.context, "", 1000);
  const url = field(body.url, "N/A", 500);
  const timestamp = field(body.timestamp, new Date().toISOString(), 80);
  const userId = user.id;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return jsonResponse({ error: "Email service is not configured" }, 500);
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">EventMe Error Report</h2>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d; width: 140px;">Error Type:</td><td style="padding: 8px 0; color: #1f2937;">${escapeHtml(errorType)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">Timestamp:</td><td style="padding: 8px 0; color: #1f2937;">${escapeHtml(timestamp)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">URL:</td><td style="padding: 8px 0; color: #1f2937;">${escapeHtml(url)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">User ID:</td><td style="padding: 8px 0; color: #1f2937;">${escapeHtml(userId)}</td></tr>
          ${context ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">Context:</td><td style="padding: 8px 0; color: #1f2937;">${escapeHtml(context)}</td></tr>` : ""}
        </table>
        <div style="margin-top: 16px;">
          <p style="font-weight: bold; color: #7f1d1d; margin-bottom: 8px;">Error Message:</p>
          <div style="background: #fff; border: 1px solid #fca5a5; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 13px; color: #dc2626; white-space: pre-wrap; word-break: break-word;">${escapeHtml(message)}</div>
        </div>
        ${stack ? `<div style="margin-top: 16px;"><p style="font-weight: bold; color: #7f1d1d; margin-bottom: 8px;">Stack Trace:</p><div style="background: #1f2937; color: #f9fafb; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; overflow-x: auto;">${escapeHtml(stack)}</div></div>` : ""}
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 12px; text-align: center;">Sent automatically by EventMe error monitoring</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: ["abriev@ywamships.org"],
        subject: `[EventMe Error] ${errorType}: ${message}`.slice(0, 120),
        html: htmlBody,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Resend API error", result);
      return jsonResponse({ error: "Failed to send error report" }, 502);
    }

    return jsonResponse({ success: true, id: result.id });
  } catch (error) {
    console.error("Error report failure", error);
    return jsonResponse({ error: "Failed to send error report" }, 500);
  }
});
