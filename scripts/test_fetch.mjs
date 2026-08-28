async function testDirectFetch() {
  const url = 'https://dyewlzahvhkblidwyukm.supabase.co/auth/v1/signup';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXdsemFodmhrYmxpZHd5dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDI4ODMsImV4cCI6MjEwMzQ3ODg4M30.J5gtCen1526Wi6O-f_xaVVxLP9KogvBkpsh1cDqyXuM';

  const testEmail = `speedtest_${Date.now()}@gmail.com`;
  console.log('Sending direct HTTP POST to Supabase Auth endpoint...');
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        data: {
          full_name: 'Speed Test User',
          phone: '9876543210',
        },
      }),
    });

    const duration = Date.now() - start;
    const json = await res.json();
    console.log(`Supabase responded in ${duration}ms with status ${res.status}:`, json);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testDirectFetch();
