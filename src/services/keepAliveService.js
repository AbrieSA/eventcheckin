import { supabase } from '../lib/supabase';

const PING_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const LAST_PING_KEY = 'supabase_last_ping';

/**
 * Performs a lightweight query to Supabase to keep the account active
 */
const performPing = async () => {
  try {
    // Lightweight query - just check if we can connect
    const { error } = await supabase?.from('user_profiles')?.select('id')?.limit(1);
    
    if (error) {
      console.warn('Keep-alive ping failed:', error?.message);
      return false;
    }
    
    // Update last ping timestamp
    localStorage.setItem(LAST_PING_KEY, Date.now()?.toString());
    console.log('Keep-alive ping successful');
    return true;
  } catch (error) {
    console.warn('Keep-alive ping error:', error);
    return false;
  }
};

/**
 * Checks if a ping is needed and performs it if necessary
 */
const checkAndPing = async () => {
  const lastPingStr = localStorage.getItem(LAST_PING_KEY);
  const now = Date.now();
  
  if (!lastPingStr) {
    // First time - perform ping
    await performPing();
    return;
  }
  
  const lastPing = parseInt(lastPingStr, 10);
  const timeSinceLastPing = now - lastPing;
  
  if (timeSinceLastPing >= PING_INTERVAL_MS) {
    // 3 days have passed - perform ping
    await performPing();
  }
};

/**
 * Initializes the keep-alive service
 * Should be called once when the app starts
 */
export const initializeKeepAlive = () => {
  // Perform initial check
  checkAndPing();
  
  // Set up periodic check every hour to see if ping is needed
  // (This is more efficient than checking every second)
  const checkInterval = 60 * 60 * 1000; // 1 hour
  const intervalId = setInterval(checkAndPing, checkInterval);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};

export default {
  initializeKeepAlive,
  performPing,
};