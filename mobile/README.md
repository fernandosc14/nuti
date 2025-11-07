# nutri-mate-mobile (Expo)

This is a minimal Expo + NativeWind scaffold created to start the migration from the web app to a mobile app for Android.

Quick start (from repository root):

```powershell
cd "e:\Users\Fernando\Ambiente de Trabalho\Projetos\nuti\mobile"
npm install
npx expo start
```

Then open on Android using the Expo Dev Tools (Run on Android device/emulator) or `npm run android` after installing Android tooling.

Notes:
- This scaffold is minimal: it includes Navigation, react-query and a couple of example screens.
- Next steps: migrate UI components from `src/components` to React Native equivalents and adapt `services/` to use `@supabase/supabase-js` in React Native.

Environment variables
---------------------
This mobile app expects Supabase credentials to be provided via environment variables at runtime:

- SUPABASE_URL - your Supabase project URL
- SUPABASE_ANON_KEY - your Supabase anon/public key

For local development with Expo you can provide these in several ways. The project includes an `app.config.js` that will load a local `.env` when present (via dotenv). Recommended flow:

1. Copy `.env.example` to `.env` and fill the two Supabase values:

```powershell
cd mobile
copy .env.example .env
# edit mobile\.env and paste your SUPABASE_URL and SUPABASE_ANON_KEY
```

2. Start Expo (app.config.js reads .env and exposes the values to `Constants.expoConfig.extra`):

```powershell
npx expo start --tunnel -c
```

3. In production, use EAS secrets or your CI/CD to provide the vars.

Quick start reminder
--------------------
```powershell
cd "e:\Users\Fernando\Ambiente de Trabalho\Projetos\nuti\mobile"
npm install
npx expo start
```

Then open on Android using the Expo Dev Tools (Run on Android device/emulator) or `npm run android` after installing Android tooling.
