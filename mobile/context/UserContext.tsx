/**
 * User Context
 * 
 * Context API para gerenciar estado global do utilizador
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
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
  onboardingCompleted?: boolean;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
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
              await signInWithCredential(auth, credential);
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
        setProfile({
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
          onboardingCompleted: data.onboardingCompleted || false,
        });
      } else {
        // Criar perfil se não existir
        const newProfile: UserProfile = {
          id: userId,
          name: user?.displayName || '',
          email: user?.email || '',
          plan: 'free',
          streak: 0,
          badges: [],
          createdAt: new Date(),
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
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao fazer login');
    }
  };

  // Sign up com email e password
  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Criar perfil no Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        name,
        email,
        plan: 'free',
        streak: 0,
        badges: [],
        createdAt: Timestamp.fromDate(new Date()),
      });

      await loadProfile(user.uid);
    } catch (error: any) {
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

      if (!idTokenNative) {
        throw new Error('Google Sign-In não retornou idToken');
      }

      // Criar credencial Firebase e fazer login
      const credentialNative = GoogleAuthProvider.credential(idTokenNative);
      await signInWithCredential(auth, credentialNative);
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
          await signInWithCredential(auth, credential);
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
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, updates, { merge: true });
      await loadProfile(user.uid);
    } catch (error: any) {
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

