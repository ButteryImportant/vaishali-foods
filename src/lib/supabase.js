import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  'https://dyewlzahvhkblidwyukm.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXdsemFodmhrYmxpZHd5dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDI4ODMsImV4cCI6MjEwMzQ3ODg4M30.J5gtCen1526Wi6O-f_xaVVxLP9KogvBkpsh1cDqyXuM';

/**
 * Custom fetch with strict 9-second timeout to prevent infinite button loading
 */
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  // Merge external signal if passed
  const signal = options.signal || controller.signal;

  return fetch(url, { ...options, signal }).finally(() => {
    clearTimeout(timeoutId);
  });
};

/**
 * Singleton Supabase Client with browser session persistence & network timeout
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
 * Register a new user with metadata (Full Name, Phone)
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

  if (error) {
    throw error;
  }

  // Check if user already exists (Supabase returns empty identities array to prevent email enumeration)
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('This email is already registered. Please switch to the "Sign In" tab.');
  }

  // Ensure active session is established immediately
  if (!data?.session) {
    try {
      const loginData = await signInUser({ email, password });
      return loginData;
    } catch (signInErr) {
      console.warn('Auto sign-in fallback notice:', signInErr);
    }
  }

  return data;
}

/**
 * Sign in existing user with email and password
 */
export async function signInUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out current authenticated user
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * Get active session
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }
    return session;
  } catch (err) {
    console.warn('Get session error:', err);
    return null;
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return user;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch profile details for a given user ID
 */
export async function getUserProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching profile:', error);
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Update user profile details
 */
export async function updateUserProfile(userId, updates) {
  if (!userId) throw new Error('User ID required');
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Subscribe to auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
