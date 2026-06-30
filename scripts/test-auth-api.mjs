import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
function getEnv(key) {
  const m = env.match(new RegExp(`${key}=(.+)`));
  if (!m) return '';
  return m[1].replace(/^["']|["']$/g, '');
}

const apiKey = getEnv('VITE_FIREBASE_API_KEY');
console.log('API key length:', apiKey.length, 'starts with AIza:', apiKey.startsWith('AIza'));

async function signInMethods(email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, continueUri: 'http://localhost:3000' }),
    }
  );
  return res.json();
}

async function tryPassword(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return res.json();
}

for (const email of ['sudhirgupta001@gmail.com', 'dhruvn0801@gmail.com']) {
  const methods = await signInMethods(email);
  console.log(`\n${email}:`);
  console.log('  registered:', methods.registered);
  console.log('  methods:', methods.signinMethods || methods.allProviders || methods);
}

const bad = await tryPassword('sudhirgupta001@gmail.com', 'intentionally-wrong-password');
console.log('\nWrong password test:', bad.error?.message || 'unexpected success');
