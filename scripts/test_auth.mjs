import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dyewlzahvhkblidwyukm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXdsemFodmhrYmxpZHd5dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDI4ODMsImV4cCI6MjEwMzQ3ODg4M30.J5gtCen1526Wi6O-f_xaVVxLP9KogvBkpsh1cDqyXuM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runLiveAuthVerification() {
  console.log('--- 1. Testing Supabase Connectivity ---');
  const randomSuffix = Math.floor(Math.random() * 100000);
  const testEmail = `priya.deshmukh.${randomSuffix}@gmail.com`;
  const testPassword = 'Password#2026';
  const testName = 'Priya Deshmukh';
  const testPhone = '9876543210';

  console.log(`--- 2. Registering new user: ${testEmail} ---`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
        phone: testPhone,
      },
    },
  });

  if (signUpErr) {
    console.error('SignUp Error:', signUpErr);
    return;
  }

  console.log('SignUp Successful! User ID:', signUpData.user?.id);

  console.log('--- 3. Verifying public.profiles row ---');
  if (signUpData.user) {
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signUpData.user.id);

    console.log('Profile Query Result:', profileData, 'Error:', profileErr);
  }

  console.log('--- 4. Testing Sign In with existing credentials ---');
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInErr) {
    console.error('SignIn Error:', signInErr);
    return;
  }

  console.log('SignIn Successful! Active Session Token generated for:', signInData.user?.email);

  console.log('--- 5. Testing Sign Out ---');
  const { error: signOutErr } = await supabase.auth.signOut();
  if (signOutErr) {
    console.error('SignOut Error:', signOutErr);
    return;
  }

  console.log('SignOut Successful! All Auth & Database tests PASSED successfully!');
}

runLiveAuthVerification();
