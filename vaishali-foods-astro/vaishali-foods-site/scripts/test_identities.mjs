import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dyewlzahvhkblidwyukm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXdsemFodmhrYmxpZHd5dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDI4ODMsImV4cCI6MjEwMzQ3ODg4M30.J5gtCen1526Wi6O-f_xaVVxLP9KogvBkpsh1cDqyXuM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testExistingUser() {
  // Test signing up with an already registered user
  const email = 'priya.deshmukh.86958@gmail.com';
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password#2026',
    options: {
      data: { full_name: 'Priya Deshmukh', phone: '9876543210' }
    }
  });

  console.log('Error:', error);
  console.log('User identities:', data?.user?.identities);
  console.log('Session:', data?.session);
}

testExistingUser();
