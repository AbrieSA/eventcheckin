import { supabase } from '../lib/supabase';

// Throttle: prevent sending duplicate errors within 10 seconds
const recentErrors = new Map();
const THROTTLE_MS = 10000;

const shouldThrottle = (key) => {
  const now = Date.now();
  const last = recentErrors?.get(key);
  if (last && now - last < THROTTLE_MS) return true;
  recentErrors?.set(key, now);
  // Clean up old entries
  if (recentErrors?.size > 50) {
    const oldest = [...recentErrors?.entries()]?.sort((a, b) => a?.[1] - b?.[1])?.[0];
    recentErrors?.delete(oldest?.[0]);
  }
  return false;
};

export const reportError = async ({ errorType = 'Frontend Error', message, stack, context, userId }) => {
  try {
    const throttleKey = `${errorType}:${message?.substring(0, 100)}`;
    if (shouldThrottle(throttleKey)) return;

    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
    if (!supabaseUrl) return;

    // Get current user if available
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const { data: { session } } = await supabase?.auth?.getSession();
        currentUserId = session?.user?.id;
      } catch (_) {
        // ignore auth errors during error reporting
      }
    }

    const payload = {
      errorType,
      message: message || 'Unknown error',
      stack: stack || null,
      context: context || null,
      url: window.location?.href,
      timestamp: new Date()?.toISOString(),
      userId: currentUserId || null,
    };

    // Fire and forget — don't await to avoid blocking UI
    fetch(`${supabaseUrl}/functions/v1/send-error-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env?.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    })?.catch(() => {
      // Silently fail — error reporting must never cause more errors
    });
  } catch (_) {
    // Silently fail
  }
};

// Convenience helpers for specific error categories
export const reportDatabaseError = (error, context) =>
  reportError({
    errorType: 'Database Error',
    message: error?.message || String(error),
    stack: error?.stack,
    context,
  });

export const reportAuthError = (error, context) =>
  reportError({
    errorType: 'Auth Error',
    message: error?.message || String(error),
    stack: error?.stack,
    context,
  });

export const reportServiceError = (error, context) =>
  reportError({
    errorType: 'Service Error',
    message: error?.message || String(error),
    stack: error?.stack,
    context,
  });

// Initialize global error listeners
export const initGlobalErrorReporting = () => {
  // Catch unhandled JS errors
  window.addEventListener('error', (event) => {
    reportError({
      errorType: 'Unhandled JS Error',
      message: event?.message || 'Unknown error',
      stack: event?.error?.stack,
      context: `${event?.filename}:${event?.lineno}:${event?.colno}`,
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event?.reason;
    reportError({
      errorType: 'Unhandled Promise Rejection',
      message: error?.message || String(error) || 'Promise rejected',
      stack: error?.stack,
      context: 'Unhandled Promise',
    });
  });

  // Hook into ErrorBoundary via global callback
  window.__COMPONENT_ERROR__ = (error, errorInfo) => {
    reportError({
      errorType: 'React Component Error',
      message: error?.message || String(error),
      stack: error?.stack,
      context: errorInfo?.componentStack?.substring(0, 500),
    });
  };
};
