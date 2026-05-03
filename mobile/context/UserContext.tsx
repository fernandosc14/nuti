/**
 * User Context
 * 
 * Context API for managing global user state.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, signInWithCredential, GoogleAuthProvider, getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
// Google Sign-In via expo-auth-session -> exchange token with Firebase
// GoogleSignin is dynamically imported only when needed (not available in Expo Go).

/**
 * Interface for the user profile
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  weight?: number;
  height?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  restrictions?: string[];
  plan: 'free' | 'premium';
  streak: number;
  badges: string[];
  createdAt: Date;
  // Onboarding fields
  gender?: 'male' | 'female' | 'other';
  workoutsPerWeek?: 'none' | '1x' | '1-2x' | '2-3x' | '3-4x' | '5-6x' | 'daily' | '0-2' | '3-6' | '6+';
  heardFrom?: string;
  triedOtherApps?: boolean;
  dateOfBirth?: Date;
  desiredWeight?: number;
  diet?: 'classic' | 'pescatarian' | 'vegetarian' | 'vegan';
  goalSpeed?: number; // kg per week
  referralCode?: string;
  onboardingCompleted?: boolean;
  shouldShowPremiumOnboarding?: boolean;
  // Auth method
  authMethod?: 'google' | 'email';
  // Profile image
  profileImageUrl?: string;
  // Weight history
  weightHistory?: Array<{ weight: number; date: Date }>;
  // Daily goals (can be manually set)
  dailyCalorieGoal?: number;
  dailyProteinGoal?: number;
  dailyCarbsGoal?: number;
  dailyFatGoal?: number;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  blockProfile: boolean;
  setBlockProfile: (block: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, onboardingData?: any) => Promise<void>;
  signInWithGoogle: (allowCreateAccount?: boolean) => Promise<void>;
  signInWithGoogleNative: (allowCreateAccount?: boolean) => Promise<void>;
  signInWithGoogleWeb: (allowCreateAccount?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockProfile, setBlockProfile] = useState(false);

  // Ensure OAuth flow can complete (expo web browser helper)
  WebBrowser.maybeCompleteAuthSession();

  // Google Auth request (expo-auth-session)
  // For Expo Go / dev we prefer the Expo proxy (web client) so Google sees the
  // web client_id and the auth.expo.io redirect. If running a standalone/dev-client
  // build we enable native clients. This avoids Google blocking when the native
  // client/package does not match the running app (Expo Go uses host.exp.exponent).
  const useProxyByDefault = Platform.OS !== 'web';

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

  // Determine the correct redirect URI based on the environment.
  // In Expo Go, we need to use the HTTPS proxy directly (not exp://).
  const slug = 'nuti'; // do app.json
  
  // Verify if we are in Expo Go (appOwnership === 'expo')
  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  
  // In Expo Go, makeRedirectUri might return exp:// instead of https://auth.expo.io
  // We need to force the use of the Expo HTTPS proxy
  let expoProxyRedirect: string;
  
  if (useProxyByDefault && isExpoGo) {
    // Force Expo to use HTTPS proxy for Expo Go.
    // The format is: https://auth.expo.io/@anonymous/[slug]
    expoProxyRedirect = `https://auth.expo.io/@anonymous/${slug}`;
  } else if (useProxyByDefault) {
    // Try to use makeRedirectUri, but if it returns exp://, use the HTTPS proxy
    const uri = makeRedirectUri({ useProxy: true });
    if (uri.startsWith('https://')) {
      expoProxyRedirect = uri;
    } else {
      // If exp:// was returned, force HTTPS proxy.
      expoProxyRedirect = `https://auth.expo.io/@anonymous/${slug}`;
    }
  } else {
    // Standalone/dev-client - usar custom scheme
    expoProxyRedirect = makeRedirectUri({ scheme: 'nuti' } as any);
  }
  

  // Configure Google Signin natively when the module is available (dev-client/standalone)
  useEffect(() => {
    (async () => {
    try {
        const mod = await import('@react-native-google-signin/google-signin');
        const GS = (mod as any)?.GoogleSignin;
        if (GS && typeof GS.configure === 'function') {
      const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
          GS.configure({
        webClientId: webId || undefined,
        offlineAccess: true,
      });
        }
      } catch {
        // This module is not available in this environment (e.g., Expo Go).
    }
    })();
  }, []);

  // Configure auth request only if webClientId is available
  // If not, the request will be null and we will show a clear error when trying to use it
  const authRequestConfig = webClientId
    ? (useProxyByDefault
    ? {
        // Use only the web client id when using the Expo proxy
        clientId: webClientId,
        webClientId: webClientId,
        redirectUri: expoProxyRedirect,
        scopes: ['profile', 'email'],
      }
    : {
        // Native flow (standalone/dev-client) - provide native client ids
        clientId: webClientId,
            iosClientId: iosClientId || undefined,
            androidClientId: androidClientId || undefined,
        webClientId: webClientId,
        redirectUri: expoProxyRedirect,
        scopes: ['profile', 'email'],
          })
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [request, response, promptAsync] = Google.useAuthRequest(authRequestConfig as any);

  // Process automatic responses when OAuth returns (important for deep linking)
  useEffect(() => {
    if (response) {
      if (response.type === 'success') {
        const authPayload: any = response.authentication || (response as any).params || {};
        const idToken = authPayload?.idToken || authPayload?.id_token;
        const accessToken = authPayload?.accessToken || authPayload?.access_token;

        if (idToken || accessToken) {
          (async () => {
            try {
              const credential = GoogleAuthProvider.credential(idToken || undefined, accessToken || undefined);
              const userCredential = await signInWithCredential(auth, credential);
              
              // Verify if userCredential and user exist
              if (!userCredential?.user) {
                throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
              }
              
              const currentUser = userCredential.user;
              if (!currentUser) {
                throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
              }
              
              // Verify if the account was created with email/password
              const userRef = doc(db, 'users', currentUser.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.authMethod === 'email') {
                  // Log out and throw an error.
                  await firebaseSignOut(auth);
                  throw new Error('Esta conta foi criada com email e password. Por favor, usa o login com email.');
                }
                // If no authMethod is present, update it to google
                if (!data.authMethod) {
                  await setDoc(userRef, { authMethod: 'google' }, { merge: true });
                }
              } else {
                // Account not registered - log out and generate error.
                await firebaseSignOut(auth);
                throw new Error('Esta conta não está registada. Por favor, cria uma conta primeiro.');
              }
            } catch (error: any) {
              console.error('❌ Erro ao processar resposta automática:', error);
            }
          })();
        }
      } else if (response.type === 'error') {
        const errorDetails = (response as any).error;
        console.error('❌ OAuth Response error:', errorDetails);
      }
    }
  }, [response]);

  // Google Sign-In será implementado com expo-auth-session
  // useEffect(() => {
  //   GoogleSignin.configure({
  //     webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  //   });
  // }, []);

  // Load user profile
  const loadProfile = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const onboardingCompleted = data.onboardingCompleted === true;
        
        const loadedProfile: UserProfile = {
          id: userId,
          name: data.name || '',
          email: data.email || '',
          weight: data.weight,
          height: data.height,
          goal: data.goal,
          restrictions: data.restrictions || [],
          plan: data.plan || 'free',
          streak: data.streak || 0,
          badges: data.badges || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          // Onboarding fields
          gender: data.gender,
          workoutsPerWeek: data.workoutsPerWeek,
          heardFrom: data.heardFrom,
          triedOtherApps: data.triedOtherApps,
          dateOfBirth: data.dateOfBirth?.toDate(),
          desiredWeight: data.desiredWeight,
          diet: data.diet,
          goalSpeed: data.goalSpeed,
          referralCode: data.referralCode,
          onboardingCompleted: onboardingCompleted, // Ensure it is a boolean (true or false)
          shouldShowPremiumOnboarding: data.shouldShowPremiumOnboarding === true,
          // Auth method
          authMethod: data.authMethod,
          // Profile image
          profileImageUrl: data.profileImageUrl,
          // Weight history
          weightHistory: data.weightHistory?.map((entry: any) => ({
            weight: entry.weight,
            date: entry.date?.toDate() || new Date(),
          })) || [],
          // Daily goals
          dailyCalorieGoal: data.dailyCalorieGoal,
          dailyProteinGoal: data.dailyProteinGoal,
          dailyCarbsGoal: data.dailyCarbsGoal,
          dailyFatGoal: data.dailyFatGoal,
        };
        
        setProfile(loadedProfile);
      } else {
        // Do not create a profile automatically - only explicit roles should create one.
        // This prevents automatic creation during sign in when the account does not exist
        setProfile(null);
      }
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        return;
      }
      console.error('Error loading profile:', error);
    }
  };

  // Observe authentication changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      try {
        if (firebaseUser) {
          await loadProfile(firebaseUser.uid);
          await AsyncStorage.setItem('userId', firebaseUser.uid);
        } else {
          setProfile(null);
          await AsyncStorage.removeItem('userId');
        }
      } catch (e) {
        console.error('Error in onAuthStateChanged handler:', e);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      // Verify if the account exists and which authentication method is used
      // First, try to sign in to see if the account exists
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // If sign in succeeded, verify the authentication method
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.authMethod === 'google') {
          // Log out and throw an error.
          await firebaseSignOut(auth);
          throw new Error('Esta conta foi criada com Google. Por favor, usa "Continuar com Google" para fazer login.');
        }
      }
    } catch (error: any) {
      // If it's an invalid credentials error, check if the account exists
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Email or password incorrect. If you don\'t have an account, create a new one.');
      }
      throw new Error(error.message || 'Error signing in');
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, name: string, onboardingData?: any) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

          // Generate a unique referral code based on userId
      const generateReferralCode = (userId: string): string => {
        const code = userId.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return code || userId.substring(0, 6).toUpperCase();
      };

      // Criar perfil no Firestore
      const userRef = doc(db, 'users', user.uid);
      const profileData: any = {
        name,
        email,
        plan: 'free',
        streak: 0,
        badges: [],
        createdAt: Timestamp.fromDate(new Date()),
        authMethod: 'email',
        referralCode: generateReferralCode(user.uid), // Automatically generate code
      };
      
      if (onboardingData) {
        Object.keys(onboardingData).forEach(key => {
          const value = onboardingData[key];
          if (value !== undefined && value !== null) {
            if (value instanceof Date) {
              profileData[key] = Timestamp.fromDate(value);
            } else {
              profileData[key] = value;
            }
          }
        });
      }
      
      if (onboardingData?.onboardingCompleted === true) {
        profileData.onboardingCompleted = true;
      }
      
      await setDoc(userRef, profileData);
      
      const checkSnap = await getDoc(userRef);
      if (checkSnap.exists()) {
        const checkData = checkSnap.data();
        if (checkData.onboardingCompleted !== true) {
          await setDoc(userRef, { onboardingCompleted: true }, { merge: true });
        }
      }
      
      // Load profile immediately (onAuthStateChanged will also call, but this ensures we have the correct data)
      await loadProfile(user.uid);
    } catch (error: any) {
      // If the account already exists with Google, inform the user
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este email já está registado com Google. Por favor, usa "Continuar com Google" para fazer login.');
      }
      throw new Error(error.message || 'Erro ao criar conta');
    }
  };

  // Google Sign-In - tries native first, then falls back to web
  const signInWithGoogle = async (allowCreateAccount: boolean = false) => {
    // Check if we have the basic configuration
    if (!webClientId) {
      throw new Error(
        'Google Sign-In não está configurado. Por favor, adicione EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no ficheiro .env'
      );
    }

    // Check if we are running in Expo Go - if so, use ONLY the web flow
    const isExpoGo = (Constants as any)?.appOwnership === 'expo' || !(Constants as any)?.appOwnership;
    
    if (isExpoGo) {
      // In Expo Go, use ONLY the web method (expo-auth-session)
      // Never attempt to use native GoogleSignin in Expo Go
      try {
        await signInWithGoogleWeb(allowCreateAccount);
        return;
      } catch (error: any) {
        console.error('Google sign-in error (Expo Go):', error);
        if (error instanceof Error) {
          throw error;
      }
        throw new Error(error.message || 'Erro ao fazer login com Google');
      }
    }

    // If not in Expo Go, try native first, then fallback to web
    try {
      // Try native login first (only in dev-client/standalone)
      try {
        await signInWithGoogleNative(allowCreateAccount);
            return;
      } catch (nativeError: any) {
        // If it's not a "not available" error, rethrow
        if (nativeError.message && !nativeError.message.includes('não está disponível')) {
          throw nativeError;
      }
        // Otherwise, continue to web flow
      }

      // Web/proxy flow (works in Expo Go and dev-client)
      await signInWithGoogleWeb();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      // If it's already an Error with a message, rethrow directly
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(error.message || 'Erro ao fazer login com Google');
    }
  };

  // Native-only Google sign-in (dev-client / standalone)
  const signInWithGoogleNative = async (allowCreateAccount: boolean = false) => {
    // Check if we have the client ID configured
    if (!webClientId) {
      throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não está configurado no .env');
    }

    try {
      // Dynamic import of GoogleSignin (not available in Expo Go)
      const { GoogleSignin: GS } = await import('@react-native-google-signin/google-signin');

      // Check if GoogleSignin is available
      if (!GS || typeof GS.hasPlayServices !== 'function') {
        throw new Error('GoogleSignin nativo não está disponível. Garante dev client e plugin configurado.');
    }

      // Force account selector: ensure there is no cached session
      try {
        if (typeof GS.signOut === 'function') {
          await GS.signOut();
        }
        if (typeof GS.revokeAccess === 'function') {
          await GS.revokeAccess();
        }
      } catch {
        // Ignore errors when clearing session
      }

      // Check Google Play Services (Android)
      if (Platform.OS === 'android') {
        await GS.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Perform login
      const userInfo = await GS.signIn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idTokenNative = (userInfo as any)?.idToken;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleUser = (userInfo as any)?.user;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleEmail = googleUser?.email;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleName = googleUser?.name || googleUser?.givenName || '';

      if (!idTokenNative) {
        throw new Error('Google Sign-In não retornou idToken');
      }

      // Create Firebase credential and sign in
      const credentialNative = GoogleAuthProvider.credential(idTokenNative);
      const userCredential = await signInWithCredential(auth, credentialNative);
      
      // Check if userCredential and user exist
      if (!userCredential?.user) {
        throw new Error('Login error: user data not available.');
      }
      
      const currentUser = userCredential.user;
      if (!currentUser) {
        throw new Error('Login error: user data not available.');
      }
      
      // Check if the account was created with email/password
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // If it already exists, block creation during onboarding and require sign in
        if (allowCreateAccount) {
          await firebaseSignOut(auth);
          throw new Error('This account already exists. Please use "Sign in" instead of creating a new account.');
        }

        const data = userSnap.data();
        if (data.authMethod === 'email') {
          await firebaseSignOut(auth);
          throw new Error('This account was created with an email and password. Please use the login with email.');
        }

        // If there is no authMethod, update to google
        if (!data.authMethod) {
          await setDoc(userRef, { authMethod: 'google' }, { merge: true });
        }
      } else {
        // If allowCreateAccount is true, create profile (used during onboarding/registration)
        if (allowCreateAccount) {
          // Use Google Sign-In data if available, otherwise use Firebase Auth data
          const userName = googleName || currentUser?.displayName || '';
          const userEmail = googleEmail || currentUser?.email || '';
          
          if (!userEmail) {
            // If we don't have an email, sign out and throw error
            await firebaseSignOut(auth);
            throw new Error('Unable to get user email from Google Sign-In.');
          }
          
          // Generate a unique referral code based on userId
          const generateReferralCode = (userId: string): string => {
            const code = userId.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
            return code || userId.substring(0, 6).toUpperCase();
          };
          
          await setDoc(userRef, {
            name: userName,
            email: userEmail,
            plan: 'free',
            streak: 0,
            badges: [],
            createdAt: Timestamp.fromDate(new Date()),
            authMethod: 'google',
            referralCode: generateReferralCode(currentUser.uid), // Automatically generate code
          });
        } else {
          // Account is not registered - sign out and throw error
          await firebaseSignOut(auth);
          throw new Error('This account is not registered. Please create an account first.');
        }
      }
    } catch (error: any) {
      console.error('Native Google sign-in error:', error);
      // If the error is related to GoogleSignin not being available, rethrow with a clear message
      if (error?.message?.includes('null') || error?.message?.includes('undefined') || error?.code === 'MODULE_NOT_FOUND') {
        throw new Error('GoogleSignin não está disponível no Expo Go. Usa dev-client ou standalone build para login nativo.');
      }
      throw error;
    }
  };

  // Web/Expo proxy Google sign-in
  const signInWithGoogleWeb = async (allowCreateAccount: boolean = false) => {
    // Verificar se o request está configurado
    if (!request) {
      throw new Error('Google Auth request não está configurado. Verifica EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no .env');
    }

    // Verificar se temos client ID configurado
    if (!webClientId) {
      throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não está configurado no .env');
    }

    try {
      const result = await promptAsync({ useProxy: useProxyByDefault } as any);

      if ((result as any).type === 'success') {
    const authPayload: any = (result as any).authentication || (result as any).params || {};
    const idToken = authPayload?.idToken || authPayload?.id_token;
    const accessToken = authPayload?.accessToken || authPayload?.access_token;

        if (idToken || accessToken) {
          const credential = GoogleAuthProvider.credential(idToken || undefined, accessToken || undefined);
          const userCredential = await signInWithCredential(auth, credential);
          
          // Check if userCredential and user exist
          if (!userCredential?.user) {
            throw new Error('Login error: user data not available.');
          }
          
          const currentUser = userCredential.user;
          if (!currentUser) {
            throw new Error('Login error: user data not available.');
          }
          
          // Check if the account was created with email/password
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            // If it already exists, block creation during onboarding and require sign in
            if (allowCreateAccount) {
              await firebaseSignOut(auth);
              throw new Error('This account already exists. Please use "Sign in" instead of creating a new account.');
            }

            const data = userSnap.data();
            if (data.authMethod === 'email') {
              await firebaseSignOut(auth);
              throw new Error('This account was created with an email and password. Please use the login with email.');
            }

            // If there is no authMethod, update to google
            if (!data.authMethod) {
              await setDoc(userRef, { authMethod: 'google' }, { merge: true });
            }
          } else {
            // If allowCreateAccount is true, create profile (used during onboarding/registration)
            if (allowCreateAccount) {
              const userName = currentUser?.displayName || '';
              const userEmail = currentUser?.email || '';
              
              if (!userEmail) {
                // If we don't have an email, sign out and throw error
                await firebaseSignOut(auth);
                throw new Error('Unable to get user email from Google Sign-In.');
              }
              
              // Generate a unique referral code based on userId
              const generateReferralCode = (userId: string): string => {
                const code = userId.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
                return code || userId.substring(0, 6).toUpperCase();
              };
              
              await setDoc(userRef, {
                name: userName,
                email: userEmail,
                plan: 'free',
                streak: 0,
                badges: [],
                createdAt: Timestamp.fromDate(new Date()),
                authMethod: 'google',
                referralCode: generateReferralCode(currentUser.uid), // Automatically generate code
              });
            } else {
              // Account is not registered - sign out and throw error
              await firebaseSignOut(auth);
              throw new Error('This account is not registered. Please create an account first.');
            }
          }
          
          return; // Sucesso, sair
        }
      }
      
      // Se chegou aqui e não foi success, verificar se foi cancelado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((result as any).type === 'cancel' || (result as any).type === 'dismiss') {
        throw new Error('Autenticação cancelada pelo utilizador');
      }
      
      // Se não foi success mas também não foi cancel, pode ser que a resposta venha via response
      // Nesse caso, o useEffect vai processar
      
      // Se não retornou success, pode ser que a resposta venha via response (deep linking)
      // Nesse caso, o useEffect vai processar automaticamente
      // Não lançar erro aqui, deixar o useEffect processar
      
    } catch (error: any) {
      // Se for erro de cancelamento ou timeout, relançar
      if (error.message?.includes('cancel') || error.message?.includes('dismiss')) {
        throw error;
      }
      // Outros erros podem ser que a resposta venha via response
      // Não relançar, deixar o useEffect processar se vier resposta
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // Tentar terminar sessão do Google nativo (se módulo existir)
      try {
        const mod = await import('@react-native-google-signin/google-signin');
        const GS = (mod as any)?.GoogleSignin;
        if (GS && typeof GS.signOut === 'function') {
          await GS.signOut();
          if (typeof GS.revokeAccess === 'function') {
            // Opcional: revogar para forçar seletor de conta no próximo login
            await GS.revokeAccess();
          }
        }
      } catch {
        // Ignorar se módulo não estiver disponível (por exemplo, Expo Go)
      }

      await firebaseSignOut(auth);
      setProfile(null);
      await AsyncStorage.removeItem('userId');
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao fazer logout');
    }
  };

  // Atualizar perfil
  const updateProfile = async (updates: Partial<UserProfile>) => {
    // Usar o user do contexto, mas se não estiver disponível, tentar obter do Firebase Auth diretamente
    let currentUser = user;
    if (!currentUser) {
      currentUser = getAuth().currentUser;
    }
    
    if (!currentUser) {
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      
      // Preparar dados para guardar
      const dataToSave: any = {};
      
      // Copiar todos os updates, tratando campos especiais
      Object.keys(updates).forEach(key => {
        const value = (updates as any)[key];
        if (value !== undefined && value !== null) {
          // Se for Date, converter para Timestamp
          if (value instanceof Date) {
            dataToSave[key] = Timestamp.fromDate(value);
          } else {
            dataToSave[key] = value;
          }
        }
      });
      
      if (updates.onboardingCompleted === true) {
        dataToSave.onboardingCompleted = true;
      } else if (updates.onboardingCompleted !== undefined && updates.onboardingCompleted !== false) {
        dataToSave.onboardingCompleted = updates.onboardingCompleted === true;
      }
      
      await setDoc(userRef, dataToSave, { merge: true });
      
      const verifySnap = await getDoc(userRef);
      if (verifySnap.exists()) {
        const verifyData = verifySnap.data();
        if (dataToSave.onboardingCompleted === true && verifyData.onboardingCompleted !== true) {
          await setDoc(userRef, { onboardingCompleted: true }, { merge: true });
        }
      }
      
      await loadProfile(currentUser.uid);
    } catch (error: any) {
      console.error('❌ updateProfile - Erro:', error);
      throw new Error(error.message || 'Erro ao atualizar perfil');
    }
  };

  // Atualizar perfil
  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.uid);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user: blockProfile ? null : user,
        profile: blockProfile ? null : profile,
        loading,
        blockProfile,
        setBlockProfile,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithGoogleNative,
        signInWithGoogleWeb,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}


