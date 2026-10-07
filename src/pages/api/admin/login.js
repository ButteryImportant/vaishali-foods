import { getAdminConfig, getEnv, json } from '../../../lib/admin-auth.js';

export const POST = async (context) => {
  const { request } = context;
  const env = getEnv(context);
  const { username: validUser, password: validPass, token } = getAdminConfig(env);

  try {
    const { username, password } = await request.json();

    if (username === validUser && password === validPass) {
      return json({ success: true, token });
    }

    return json({ success: false, error: 'Invalid credentials' }, 401);
  } catch (err) {
    return json({ success: false, error: 'Invalid request.' }, 400);
  }
};
