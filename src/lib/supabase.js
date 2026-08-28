import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  'https://dyewlzahvhkblidwyukm.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXdsemFodmhrYmxpZHd5dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDI4ODMsImV4cCI6MjEwMzQ3ODg4M30.J5gtCen1526Wi6O-f_xaVVxLP9KogvBkpsh1cDqyXuM';

/**
 * Custom fetch with 15-second hard timeout.
 * Uses AbortSignal.any() to respect BOTH the internal Supabase signal
 * AND our timeout signal — whichever fires first wins.
 */
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out after 15s')), 15000);

  // AbortSignal.any() = abort if EITHER signal fires (our timeout OR Supabase's internal signal)
  const signals = [controller.signal];
  if (options.signal) signals.push(options.signal);
  const combined = signals.length > 1
    ? (AbortSignal.any ? AbortSignal.any(signals) : controller.signal)
    : controller.signal;

  return fetch(url, { ...options, signal: combined }).finally(() => {
    clearTimeout(timeoutId);
  });
};

/**
 * Singleton Supabase client
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

/**
 * Register a new user with metadata (Full Name, Phone).
 * Does NOT attempt a follow-up sign-in — Supabase auto-confirms and returns
 * a session when email confirmation is disabled.
 */
export async function signUpUser({ email, password, fullName, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
      },
    },
  });

  if (error) throw error;

  // Empty identities = email already registered (Supabase hides this to prevent enumeration)
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('EMAIL_EXISTS');
  }

  return data;
}

/**
 * Sign in existing user with email and password
 */
export async function signInUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get active session (reads from localStorage, no network call)
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
  }
}

/**
 * Fetch profile from public.profiles table
 */
export async function getUserProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Update profile
 */
export async function updateUserProfile(userId, updates) {
  if (!userId) throw new Error('User ID required');
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Auth state change listener
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
