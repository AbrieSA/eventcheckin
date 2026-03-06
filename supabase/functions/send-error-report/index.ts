import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  // ✅ CORS preflight
  if (req?.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  try {
    const body = await req?.json();
    const { errorType, message, stack, context, url, timestamp, userId } = body;

    const RESEND_API_KEY = Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">🚨 Error Report — EventCheck</h2>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #7f1d1d; width: 140px;">Error Type:</td>
              <td style="padding: 8px 0; color: #1f2937;">${errorType || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">Timestamp:</td>
              <td style="padding: 8px 0; color: #1f2937;">${timestamp || new Date()?.toISOString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">URL:</td>
              <td style="padding: 8px 0; color: #1f2937;">${url || 'N/A'}</td>
            </tr>
            ${userId ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">User ID:</td><td style="padding: 8px 0; color: #1f2937;">${userId}</td></tr>` : ''}
            ${context ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #7f1d1d;">Context:</td><td style="padding: 8px 0; color: #1f2937;">${context}</td></tr>` : ''}
          </table>

          <div style="margin-top: 16px;">
            <p style="font-weight: bold; color: #7f1d1d; margin-bottom: 8px;">Error Message:</p>
            <div style="background: #fff; border: 1px solid #fca5a5; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 13px; color: #dc2626; white-space: pre-wrap; word-break: break-word;">${message || 'No message provided'}</div>
          </div>

          ${stack ? `
          <div style="margin-top: 16px;">
            <p style="font-weight: bold; color: #7f1d1d; margin-bottom: 8px;">Stack Trace:</p>
            <div style="background: #1f2937; color: #f9fafb; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; overflow-x: auto;">${stack}</div>
          </div>` : ''}
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 12px; text-align: center;">Sent automatically by EventCheck error monitoring</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: ["abriev@ywamships.org"],
        subject: `[EventCheck Error] ${errorType || 'Error'}: ${(message || '')?.substring(0, 80)}`,
        html: htmlBody
      })
    });

    const result = await response?.json();

    if (!response?.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
