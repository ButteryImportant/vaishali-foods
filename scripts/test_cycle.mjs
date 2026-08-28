import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dyewlzahvhkblidwyukm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXdsemFodmhrYmxpZHd5dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDI4ODMsImV4cCI6MjEwMzQ3ODg4M30.J5gtCen1526Wi6O-f_xaVVxLP9KogvBkpsh1cDqyXuM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuthCycle() {
  console.log('1. Testing sign in with existing user: thepandagamergg@gmail.com');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'thepandagamergg@gmail.com',
      password: 'wrongpassword',
    });
    console.log('Wrong password result:', { data, error });
  } catch (e) {
    console.log('Caught wrong password:', e);
  }

  console.log('2. Testing sign up with fresh new user');
  const freshEmail = `test_${Date.now()}@gmail.com`;
  try {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: freshEmail,
      password: 'MyPassword123!',
      options: {
        data: {
          full_name: 'Test Customer',
          phone: '9876500000',
        },
      },
    });
    console.log('Fresh signup data:', {
      user: signUpData?.user?.id,
      session: signUpData?.session ? 'SESSION_EXISTS' : 'NO_SESSION',
      identities: signUpData?.user?.identities?.length,
      error: signUpErr
    });

    if (signUpData?.user) {
      console.log('3. Fetching profile for fresh user');
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signUpData.user.id)
        .maybeSingle();
      console.log('Profile result:', prof, profErr);
    }
  } catch (e) {
    console.log('Caught signup error:', e);
  }
  process.exit(0);
}

testAuthCycle();
