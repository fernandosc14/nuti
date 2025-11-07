// app.config.js — loads environment variables from .env (when present) and
// exposes them via expo.extra so Constants.expoConfig.extra works in the app.
try {
  // dotenv is optional; if not installed, this will be a no-op.
  // It is executed in the Node process that starts Metro / Expo CLI.
  // eslint-disable-next-line global-require
  require('dotenv').config();
} catch (e) {
  // ignore if dotenv is not installed
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export default ({ config }) => ({
  ...config,
  name: config.name || 'nutri-mate-mobile',
  slug: config.slug || 'nutri-mate-mobile',
  version: config.version || '1.0.0',
  extra: {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  },
  // recommend a scheme for Linking — adjust if you use a custom one
  scheme: process.env.EXPO_SCHEME || 'nutrimatemobile',
});
