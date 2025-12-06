/**
 * Firebase Configuration and Services
 * 
 * Configuração do Firebase para autenticação e Firestore
 */

import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração do Firebase
// IMPORTANTE: Substitua estas variáveis pelas suas credenciais do Firebase
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "your-app-id"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Auth com persistência usando AsyncStorage
// Isto garante que o estado de autenticação persiste entre sessões
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// NOTE:
// - By default we keep memory persistence (getAuth(app)) so the app bundles
//   cleanly inside Expo/Metro.
// - If you want session persistence on React Native (so auth survives app
//   restarts) you need to run in an environment that supports the
//   firebase/auth/react-native entrypoint (usually a dev-client or a bare
//   workflow). That requires installing @react-native-async-storage/async-storage
//   and then initializing auth with getReactNativePersistence. This project
//   previously attempted to auto-enable that at runtime but Metro attempted
//   to statically resolve the RN-specific firebase entry and bundling failed.
// - If you'd like, I can switch this project to a dev-client flow and enable
//   persistence properly (I can add the code and instructions).

// Exportar outros serviços
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Log para debug
console.log('=== Firebase Configuration ===');
console.log('Project ID:', firebaseConfig.projectId);
console.log('============================');

export default app;

