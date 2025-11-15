/**
 * User Context
 * 
 * Context API para gerenciar estado global do utilizador
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
// GoogleSignin é importado dinamicamente apenas quando necessário (não disponível no Expo Go)

/**
 * Interface do perfil do utilizador
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
  workoutsPerWeek?: '0-2' | '3-6' | '6+';
  heardFrom?: string;
  triedOtherApps?: boolean;
  dateOfBirth?: Date;
  desiredWeight?: number;
  referralCode?: string;
  onboardingCompleted?: boolean;
  // Auth method
  authMethod?: 'google' | 'email';
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, onboardingData?: any) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleNative: () => Promise<void>;
  signInWithGoogleWeb: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Determinar o redirect URI correto baseado no ambiente
  // No Expo Go, precisamos usar o proxy HTTPS diretamente (não exp://)
  const slug = 'nuti'; // do app.json
  
  // Verificar se estamos no Expo Go (appOwnership === 'expo')
  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  
  // No Expo Go, o makeRedirectUri pode retornar exp:// em vez de https://auth.expo.io
  // Precisamos forçar o uso do proxy HTTPS do Expo
  let expoProxyRedirect: string;
  
  if (useProxyByDefault && isExpoGo) {
    // Forçar o uso do proxy HTTPS do Expo para Expo Go
    // O formato é: https://auth.expo.io/@anonymous/[slug]
    expoProxyRedirect = `https://auth.expo.io/@anonymous/${slug}`;
  } else if (useProxyByDefault) {
    // Tentar usar makeRedirectUri, mas se retornar exp://, usar o proxy HTTPS
    const uri = makeRedirectUri({ useProxy: true });
    if (uri.startsWith('https://')) {
      expoProxyRedirect = uri;
    } else {
      // Se retornou exp://, forçar o proxy HTTPS
      expoProxyRedirect = `https://auth.expo.io/@anonymous/${slug}`;
    }
  } else {
    // Standalone/dev-client - usar custom scheme
    expoProxyRedirect = makeRedirectUri({ scheme: 'nuti' } as any);
  }
  
  // Debug: Log redirect URI para ajudar na configuração do Google Console
  if (__DEV__) {
    console.log('🔗 Redirect URI configurado:', expoProxyRedirect);
    console.log('💡 Este URI DEVE estar no Google Cloud Console > Credentials > OAuth Client > Authorized redirect URIs');
    console.log('💡 URI completo que o Google vai receber:', expoProxyRedirect);
    console.log('🔍 Debug - isExpoGo:', isExpoGo);
    console.log('🔍 Debug - useProxyByDefault:', useProxyByDefault);
    
    // Log também o que o makeRedirectUri retorna com diferentes opções
    const testUri1 = makeRedirectUri({ useProxy: true });
    const testUri2 = makeRedirectUri({ useProxy: false, scheme: 'nuti' });
    console.log('🔍 Debug - makeRedirectUri({ useProxy: true }):', testUri1);
    console.log('🔍 Debug - makeRedirectUri({ useProxy: false, scheme: "nuti" }):', testUri2);
  }

  // Configurar Google Signin nativo quando o módulo existir (dev-client/standalone)
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
          console.log('GoogleSignin configurado (nativo).');
        } else {
          console.log('GoogleSignin módulo não disponível para configurar.');
        }
      } catch {
        // Módulo não disponível neste ambiente (por ex., Expo Go)
      }
    })();
  }, []);

  // Configurar auth request apenas se webClientId estiver disponível
  // Se não estiver, o request será null e vamos dar erro claro quando tentar usar
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

  // Processar resposta automática quando o OAuth retorna (importante para deep linking)
  useEffect(() => {
    if (response) {
      console.log('📥 OAuth Response recebida (useEffect):', { 
        type: response.type,
        hasAuthentication: !!response.authentication,
        hasParams: !!(response as any).params
      });
      
      if (response.type === 'success') {
        // Tentar obter tokens de authentication ou params
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authPayload: any = response.authentication || (response as any).params || {};
        const idToken = authPayload?.idToken || authPayload?.id_token;
        const accessToken = authPayload?.accessToken || authPayload?.access_token;

        console.log('🎫 Tokens extraídos do response:', { 
          hasIdToken: !!idToken, 
          hasAccessToken: !!accessToken,
          authPayloadKeys: Object.keys(authPayload)
        });

        if (idToken || accessToken) {
          // Processar login automaticamente quando retorna do browser
          (async () => {
            try {
              console.log('🔥 Fazendo login no Firebase com tokens do response...');
              const credential = GoogleAuthProvider.credential(idToken || undefined, accessToken || undefined);
              const userCredential = await signInWithCredential(auth, credential);
              
              // Verificar se a conta foi criada com email/password
              const userRef = doc(db, 'users', userCredential.user.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.authMethod === 'email') {
                  // Fazer logout e lançar erro
                  await firebaseSignOut(auth);
                  throw new Error('Esta conta foi criada com email e password. Por favor, usa o login com email.');
                }
                // Se não tem authMethod, atualizar para google
                if (!data.authMethod) {
                  await setDoc(userRef, { authMethod: 'google' }, { merge: true });
                }
              } else {
                // Criar perfil se não existir
                await setDoc(userRef, {
                  name: userCredential.user.displayName || '',
                  email: userCredential.user.email || '',
                  plan: 'free',
                  streak: 0,
                  badges: [],
                  createdAt: Timestamp.fromDate(new Date()),
                  authMethod: 'google',
                });
              }
              
              console.log('✅ Login Google realizado automaticamente via response!');
            } catch (error: any) {
              console.error('❌ Erro ao processar resposta automática:', error);
              console.error('❌ Detalhes do erro:', error.message, error.code);
            }
          })();
        } else {
          console.warn('⚠️ Response success mas sem tokens:', authPayload);
          console.warn('⚠️ Response completo:', JSON.stringify(response, null, 2));
        }
      } else if (response.type === 'error') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorDetails = (response as any).error;
        console.error('❌ OAuth Response error:', errorDetails);
        console.error('❌ Response completo:', JSON.stringify(response, null, 2));
      } else if (response.type === 'cancel' || response.type === 'dismiss') {
        console.log('ℹ️ OAuth cancelado ou dispensado pelo utilizador');
      }
    }
  }, [response]);

  // Google Sign-In será implementado com expo-auth-session
  // useEffect(() => {
  //   GoogleSignin.configure({
  //     webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  //   });
  // }, []);

  // Carregar perfil do utilizador
  const loadProfile = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        // IMPORTANTE: Verificar explicitamente se onboardingCompleted existe e é true
        // Se não existir ou for undefined, assumir false
        const onboardingCompleted = data.onboardingCompleted === true;
        console.log('📋 loadProfile - userId:', userId);
        console.log('📋 loadProfile - onboardingCompleted (raw do Firestore):', data.onboardingCompleted);
        console.log('📋 loadProfile - onboardingCompleted (tipo):', typeof data.onboardingCompleted);
        console.log('📋 loadProfile - onboardingCompleted (processed):', onboardingCompleted);
        console.log('📋 loadProfile - todos os campos do perfil:', Object.keys(data));
        
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
          referralCode: data.referralCode,
          onboardingCompleted: onboardingCompleted, // Garantir que é boolean (true ou false)
          // Auth method
          authMethod: data.authMethod,
        };
        
        console.log('📋 loadProfile - profile a definir com onboardingCompleted:', loadedProfile.onboardingCompleted);
        console.log('📋 loadProfile - profile completo (JSON):', JSON.stringify(loadedProfile, null, 2));
        setProfile(loadedProfile);
        
        // Verificar se o perfil foi definido corretamente
        console.log('📋 loadProfile - perfil definido no estado');
      } else {
        // Criar perfil se não existir
        // Determinar método de autenticação baseado no provider
        const authMethod = user?.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email';
        const newProfile: UserProfile = {
          id: userId,
          name: user?.displayName || '',
          email: user?.email || '',
          plan: 'free',
          streak: 0,
          badges: [],
          createdAt: new Date(),
          authMethod,
        };
        await setDoc(userRef, {
          ...newProfile,
          createdAt: Timestamp.fromDate(new Date()),
        });
        setProfile(newProfile);
      }
    } catch (error: any) {
      // Ignorar erros de permissões silenciosamente (pode ser que o utilizador não esteja autenticado)
      if (error?.code === 'permission-denied') {
        console.log('Profile: Permission denied, user may not be authenticated');
        return;
      }
      console.error('Error loading profile:', error);
    }
  };

  // Observar mudanças de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Firebase onAuthStateChanged - user:', firebaseUser?.uid);
      setUser(firebaseUser);

      try {
        if (firebaseUser) {
          console.log('Firebase onAuthStateChanged - loading profile for', firebaseUser.uid);
          await loadProfile(firebaseUser.uid);
          
          // Verificar novamente após carregar perfil
          const verifyRef = doc(db, 'users', firebaseUser.uid);
          const verifySnap = await getDoc(verifyRef);
          if (verifySnap.exists()) {
            const verifyData = verifySnap.data();
            console.log('🔍 onAuthStateChanged - verificação onboardingCompleted:', verifyData.onboardingCompleted);
          }
          
          await AsyncStorage.setItem('userId', firebaseUser.uid);
        } else {
          console.log('Firebase onAuthStateChanged - no user');
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

  // Sign in com email e password
  const signIn = async (email: string, password: string) => {
    try {
      // Verificar se a conta existe e qual o método de autenticação
      // Primeiro tentar fazer login para ver se a conta existe
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Se login funcionou, verificar método de autenticação
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.authMethod === 'google') {
          // Fazer logout e lançar erro
          await firebaseSignOut(auth);
          throw new Error('Esta conta foi criada com Google. Por favor, usa "Continuar com Google" para fazer login.');
        }
      }
    } catch (error: any) {
      // Se for erro de credenciais inválidas, verificar se a conta existe
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Email ou password incorretos. Se não tens conta, cria uma nova.');
      }
      throw new Error(error.message || 'Erro ao fazer login');
    }
  };

  // Sign up com email e password
  const signUp = async (email: string, password: string, name: string, onboardingData?: any) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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
      };
      
      // Incluir dados do onboarding se fornecidos
      // IMPORTANTE: Fazer isto ANTES de guardar, para garantir que tudo está no mesmo setDoc
      if (onboardingData) {
        console.log('✅ signUp - onboardingData recebido:', Object.keys(onboardingData));
        console.log('✅ signUp - onboardingData.onboardingCompleted:', onboardingData.onboardingCompleted);
        
        // Copiar todos os dados do onboarding, mas tratar campos especiais
        Object.keys(onboardingData).forEach(key => {
          const value = onboardingData[key];
          if (value !== undefined && value !== null) {
            // Se for Timestamp, manter como está (já está no formato correto)
            // Se for Date, converter para Timestamp
            if (value instanceof Date) {
              profileData[key] = Timestamp.fromDate(value);
            } else {
              profileData[key] = value;
            }
            console.log(`✅ signUp - Copiado ${key}:`, value, 'tipo:', typeof value);
          }
        });
      }
      
      // IMPORTANTE: Garantir que onboardingCompleted é explicitamente true (boolean)
      // Isto DEVE estar no profileData antes do setDoc para evitar race conditions
      if (onboardingData?.onboardingCompleted === true) {
        profileData.onboardingCompleted = true; // Forçar boolean true
        console.log('✅ signUp - onboardingCompleted = true FORÇADO no profileData');
      }
      
      console.log('✅ signUp - Perfil a guardar com onboardingCompleted:', profileData.onboardingCompleted);
      console.log('✅ signUp - Tipo onboardingCompleted:', typeof profileData.onboardingCompleted);
      console.log('✅ signUp - Chaves do profileData:', Object.keys(profileData));
      console.log('✅ signUp - onboardingCompleted existe no profileData?', 'onboardingCompleted' in profileData);
      console.log('✅ signUp - profileData.onboardingCompleted valor:', profileData.onboardingCompleted);
      
      // Guardar perfil no Firestore COM TUDO incluído (incluindo onboardingCompleted)
      // Isto garante que quando o onAuthStateChanged chamar loadProfile, já tem tudo
      await setDoc(userRef, profileData);
      
      console.log('✅ signUp - Perfil guardado no Firestore');
      
      // Verificar IMEDIATAMENTE se foi guardado
      const checkSnap = await getDoc(userRef);
      if (checkSnap.exists()) {
        const checkData = checkSnap.data();
        console.log('✅ signUp - VERIFICAÇÃO IMEDIATA - onboardingCompleted:', checkData.onboardingCompleted);
        console.log('✅ signUp - VERIFICAÇÃO IMEDIATA - tipo:', typeof checkData.onboardingCompleted);
        console.log('✅ signUp - VERIFICAÇÃO IMEDIATA - todas as chaves:', Object.keys(checkData));
        
        // Se não foi guardado, FORÇAR guardar
        if (checkData.onboardingCompleted !== true) {
          console.log('⚠️ signUp - onboardingCompleted NÃO foi guardado! A forçar guardar...');
          await setDoc(userRef, { onboardingCompleted: true }, { merge: true });
          
          // Verificar novamente
          const checkSnap2 = await getDoc(userRef);
          if (checkSnap2.exists()) {
            const checkData2 = checkSnap2.data();
            console.log('✅ signUp - Após correção - onboardingCompleted:', checkData2.onboardingCompleted);
          }
        }
      }
      
      // Carregar perfil imediatamente (o onAuthStateChanged também vai chamar, mas garantimos que temos os dados corretos)
      await loadProfile(user.uid);
    } catch (error: any) {
      // Se a conta já existe com Google, informar
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este email já está registado com Google. Por favor, usa "Continuar com Google" para fazer login.');
      }
      throw new Error(error.message || 'Erro ao criar conta');
    }
  };

  // Sign in com Google - tenta nativo primeiro, depois web
  const signInWithGoogle = async () => {
    // Verificar se temos configuração básica
    if (!webClientId) {
      throw new Error(
        'Google Sign-In não está configurado. Por favor, adicione EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no ficheiro .env'
      );
    }

    // Verificar se estamos no Expo Go - se sim, usar APENAS web flow
    const isExpoGo = (Constants as any)?.appOwnership === 'expo' || !(Constants as any)?.appOwnership;
    
    if (isExpoGo) {
      // No Expo Go, usar APENAS o método web (expo-auth-session)
      // Nunca tentar usar GoogleSignin nativo no Expo Go
      try {
        await signInWithGoogleWeb();
        return;
      } catch (error: any) {
        console.error('Google sign-in error (Expo Go):', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(error.message || 'Erro ao fazer login com Google');
      }
    }

    // Se não estamos no Expo Go, tentar nativo primeiro, depois web como fallback
    try {
      // Tentar login nativo primeiro (apenas em dev-client/standalone)
      try {
        await signInWithGoogleNative();
        return;
      } catch (nativeError: any) {
        // Se não for erro de "não disponível", relançar
        if (nativeError.message && !nativeError.message.includes('não está disponível')) {
          throw nativeError;
        }
        // Caso contrário, continuar para web flow
        console.log('Native Google sign-in não disponível, usando web flow');
      }

      // Web/proxy flow (funciona em Expo Go e dev-client)
      await signInWithGoogleWeb();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      // Se já é um Error com mensagem, relançar diretamente
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(error.message || 'Erro ao fazer login com Google');
    }
  };

  // Native-only Google sign-in (dev-client / standalone)
  const signInWithGoogleNative = async () => {
    // Verificar se temos client ID configurado
    if (!webClientId) {
      throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não está configurado no .env');
    }

    try {
      // Import dinâmico do GoogleSignin (não disponível no Expo Go)
      const { GoogleSignin: GS } = await import('@react-native-google-signin/google-signin');

      // Verificar se GoogleSignin está disponível
      if (!GS || typeof GS.hasPlayServices !== 'function') {
        throw new Error('GoogleSignin nativo não está disponível. Garante dev client e plugin configurado.');
      }

      // Forçar seletor de conta: garantir que não há sessão cacheada
      try {
        if (typeof GS.signOut === 'function') {
          await GS.signOut();
        }
        if (typeof GS.revokeAccess === 'function') {
          await GS.revokeAccess();
        }
      } catch {
        // Ignorar erros ao limpar sessão
      }

      // Verificar Google Play Services (Android)
      if (Platform.OS === 'android') {
        await GS.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Fazer login
      const userInfo = await GS.signIn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idTokenNative = (userInfo as any)?.idToken;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleEmail = (userInfo as any)?.user?.email;

      if (!idTokenNative) {
        throw new Error('Google Sign-In não retornou idToken');
      }
      
      // Criar credencial Firebase e fazer login
      const credentialNative = GoogleAuthProvider.credential(idTokenNative);
      const userCredential = await signInWithCredential(auth, credentialNative);
      
      // Verificar se a conta foi criada com email/password
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.authMethod === 'email') {
          // Fazer logout e lançar erro
          await firebaseSignOut(auth);
          throw new Error('Esta conta foi criada com email e password. Por favor, usa o login com email.');
        }
        // Se não tem authMethod, atualizar para google
        if (!data.authMethod) {
          await setDoc(userRef, { authMethod: 'google' }, { merge: true });
        }
      } else {
        // Criar perfil se não existir
        await setDoc(userRef, {
          name: userCredential.user.displayName || '',
          email: userCredential.user.email || '',
          plan: 'free',
          streak: 0,
          badges: [],
          createdAt: Timestamp.fromDate(new Date()),
          authMethod: 'google',
        });
      }
    } catch (error: any) {
      console.error('Native Google sign-in error:', error);
      // Se for erro relacionado com GoogleSignin não disponível, relançar com mensagem clara
      if (error?.message?.includes('null') || error?.message?.includes('undefined') || error?.code === 'MODULE_NOT_FOUND') {
        throw new Error('GoogleSignin não está disponível no Expo Go. Usa dev-client ou standalone build para login nativo.');
      }
      throw error;
    }
  };

  // Web/Expo proxy Google sign-in
  const signInWithGoogleWeb = async () => {
    // Verificar se o request está configurado
    if (!request) {
      throw new Error('Google Auth request não está configurado. Verifica EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no .env');
    }

    // Verificar se temos client ID configurado
    if (!webClientId) {
      throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não está configurado no .env');
    }

    console.log('🔐 Iniciando Google Sign-In...');
    console.log('🔗 Redirect URI:', expoProxyRedirect);
    console.log('📱 Request configurado:', !!request);
    console.log('⚠️ IMPORTANTE: Este URI DEVE estar no Google Cloud Console > Credentials > OAuth Client > Authorized redirect URIs');
    console.log('⚠️ Copia este URI EXATO e adiciona no Google Console:', expoProxyRedirect);

    // No Expo Go, o promptAsync pode não retornar imediatamente
    // A resposta será processada via useEffect quando o browser retornar
    // Mas vamos tentar esperar pela resposta também
    try {
      // Prompt usando o Expo proxy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await promptAsync({ useProxy: useProxyByDefault } as any);

      console.log('📥 Resultado do promptAsync (retornou):', { 
        type: (result as any)?.type,
        hasAuthentication: !!(result as any)?.authentication,
        hasParams: !!(result as any)?.params
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((result as any).type === 'success') {
        // Extrair tokens da resposta
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authPayload: any = (result as any).authentication || (result as any).params || {};
        const idToken = authPayload?.idToken || authPayload?.id_token;
        const accessToken = authPayload?.accessToken || authPayload?.access_token;

        console.log('🎫 Tokens recebidos:', { hasIdToken: !!idToken, hasAccessToken: !!accessToken });
        
        if (idToken || accessToken) {
          // Criar credencial Firebase e fazer login
          console.log('🔥 Fazendo login no Firebase...');
          const credential = GoogleAuthProvider.credential(idToken || undefined, accessToken || undefined);
          const userCredential = await signInWithCredential(auth, credential);
          
          // Verificar se a conta foi criada com email/password
          const userRef = doc(db, 'users', userCredential.user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.authMethod === 'email') {
              // Fazer logout e lançar erro
              await firebaseSignOut(auth);
              throw new Error('Esta conta foi criada com email e password. Por favor, usa o login com email.');
            }
            // Se não tem authMethod, atualizar para google
            if (!data.authMethod) {
              await setDoc(userRef, { authMethod: 'google' }, { merge: true });
            }
          } else {
            // Criar perfil se não existir
            await setDoc(userRef, {
              name: userCredential.user.displayName || '',
              email: userCredential.user.email || '',
              plan: 'free',
              streak: 0,
              badges: [],
              createdAt: Timestamp.fromDate(new Date()),
              authMethod: 'google',
            });
          }
          
          console.log('✅ Login Firebase realizado com sucesso!');
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
      console.log('⚠️ promptAsync não retornou success, mas pode vir via response. Aguardando...');
      
      // Se não retornou success, pode ser que a resposta venha via response (deep linking)
      // Nesse caso, o useEffect vai processar automaticamente
      // Não lançar erro aqui, deixar o useEffect processar
      
    } catch (error: any) {
      // Se for erro de cancelamento ou timeout, relançar
      if (error.message?.includes('cancel') || error.message?.includes('dismiss')) {
        throw error;
      }
      // Outros erros podem ser que a resposta venha via response
      console.log('⚠️ promptAsync erro, mas pode vir resposta via response:', error.message);
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
      console.log('⚠️ updateProfile - Nenhum utilizador disponível');
      return;
    }
    
    console.log('✅ updateProfile - Utilizando user:', currentUser.uid);

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
      
      // IMPORTANTE: Garantir que onboardingCompleted é boolean true
      if (updates.onboardingCompleted === true) {
        dataToSave.onboardingCompleted = true;
        console.log('✅ updateProfile - Forçando onboardingCompleted = true');
      } else if (updates.onboardingCompleted !== undefined && updates.onboardingCompleted !== false) {
        dataToSave.onboardingCompleted = updates.onboardingCompleted === true;
      }
      
      console.log('✅ updateProfile - dados a guardar:', dataToSave);
      console.log('✅ updateProfile - onboardingCompleted:', dataToSave.onboardingCompleted);
      
      await setDoc(userRef, dataToSave, { merge: true });
      console.log('✅ updateProfile - dados guardados no Firestore');
      
      // Verificar IMEDIATAMENTE se foi guardado
      const verifySnap = await getDoc(userRef);
      if (verifySnap.exists()) {
        const verifyData = verifySnap.data();
        console.log('✅ updateProfile - VERIFICAÇÃO IMEDIATA - onboardingCompleted:', verifyData.onboardingCompleted);
        
        // Se não foi guardado, FORÇAR guardar
        if (dataToSave.onboardingCompleted === true && verifyData.onboardingCompleted !== true) {
          console.log('⚠️ updateProfile - onboardingCompleted NÃO foi guardado! A forçar guardar...');
          await setDoc(userRef, { onboardingCompleted: true }, { merge: true });
          
          // Verificar novamente
          const verifySnap2 = await getDoc(userRef);
          if (verifySnap2.exists()) {
            const verifyData2 = verifySnap2.data();
            console.log('✅ updateProfile - Após correção - onboardingCompleted:', verifyData2.onboardingCompleted);
          }
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
      console.log('🔄 refreshProfile - a carregar perfil para user:', user.uid);
      await loadProfile(user.uid);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        loading,
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

