export const POST = async (context) => {
  const { request } = context;
  try {
    const { username, password } = await request.json();
    
    if (username === 'vaishali' && password === 'vaishali') {
      return new Response(JSON.stringify({ success: true, token: 'vaishali-admin-token-xyz' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
