import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Read Supabase credentials from Expo's extra config (app.config.js / app.json) where possible.
// Fallback to process.env if present (useful for some CI setups).
const expoExtra = (Constants && (Constants as any).expoConfig?.extra) || (Constants as any).manifest?.extra || {};

const SUPABASE_URL = (expoExtra && expoExtra.SUPABASE_URL) || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (expoExtra && expoExtra.SUPABASE_ANON_KEY) || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase credentials are not set. Set SUPABASE_URL and SUPABASE_ANON_KEY via expo extra (app.config.js) or env vars.');
}

let supabase: any;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // For React Native / Expo you may want to set fetch implementation or headers here if needed.
  });
} else {
  // Provide a lightweight stub so importing modules won't crash during development when env vars
  // are not set. Actual network calls will throw a clear error when attempted.
  const makeMissing = (name: string) => async () => {
    throw new Error(`Supabase client not configured (SUPABASE_URL missing). Called ${name}()`);
  };

  supabase = {
    from: () => ({ select: async () => { throw new Error('Supabase client not configured (SUPABASE_URL missing)'); } }),
    auth: {
      // supabase-js v2 api surface (a minimal safe subset for our app)
      signUp: makeMissing('auth.signUp'),
      signInWithPassword: makeMissing('auth.signInWithPassword'),
      signIn: makeMissing('auth.signIn'),
      signOut: makeMissing('auth.signOut'),
      // other methods can be added as needed
    }
  } as any;
}

export default supabase;
