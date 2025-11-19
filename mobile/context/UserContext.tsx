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
  workoutsPerWeek?: 'none' | '1x' | '1-2x' | '2-3x' | '3-4x' | '5-6x' | 'daily' | '0-2' | '3-6' | '6+';
  heardFrom?: string;
  triedOtherApps?: boolean;
  dateOfBirth?: Date;
  desiredWeight?: number;
  diet?: 'classic' | 'pescatarian' | 'vegetarian' | 'vegan';
  goalSpeed?: number; // kg per week
  referralCode?: string;
  onboardingCompleted?: boolean;
  // Auth method
  authMethod?: 'google' | 'email';
  // Profile image
  profileImageUrl?: string;
  // Weight history
  weightHistory?: Array<{ weight: number; date: Date }>;
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
      if (response.type === 'success') {
        const authPayload: any = response.authentication || (response as any).params || {};
        const idToken = authPayload?.idToken || authPayload?.id_token;
        const accessToken = authPayload?.accessToken || authPayload?.access_token;

        if (idToken || accessToken) {
          (async () => {
            try {
              const credential = GoogleAuthProvider.credential(idToken || undefined, accessToken || undefined);
              const userCredential = await signInWithCredential(auth, credential);
              
              // Verificar se userCredential e user existem
              if (!userCredential?.user) {
                throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
              }
              
              const currentUser = userCredential.user;
              if (!currentUser) {
                throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
              }
              
              // Verificar se a conta foi criada com email/password
              const userRef = doc(db, 'users', currentUser.uid);
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
                  name: (currentUser?.displayName) || '',
                  email: (currentUser?.email) || '',
                  plan: 'free',
                  streak: 0,
                  badges: [],
                  createdAt: Timestamp.fromDate(new Date()),
                  authMethod: 'google',
                });
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

  // Carregar perfil do utilizador
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
          referralCode: data.referralCode,
          onboardingCompleted: onboardingCompleted, // Garantir que é boolean (true ou false)
          // Auth method
          authMethod: data.authMethod,
          // Profile image
          profileImageUrl: data.profileImageUrl,
          // Weight history
          weightHistory: data.weightHistory?.map((entry: any) => ({
            weight: entry.weight,
            date: entry.date?.toDate() || new Date(),
          })) || [],
        };
        
        setProfile(loadedProfile);
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
      if (error?.code === 'permission-denied') {
        return;
      }
      console.error('Error loading profile:', error);
    }
  };

  // Observar mudanças de autenticação
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
      
      // Verificar se userCredential e user existem
      if (!userCredential?.user) {
        throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
      }
      
      const currentUser = userCredential.user;
      if (!currentUser) {
        throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
      }
      
      // Verificar se a conta foi criada com email/password
      const userRef = doc(db, 'users', currentUser.uid);
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
          name: (currentUser?.displayName) || '',
          email: (currentUser?.email) || '',
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

    try {
      const result = await promptAsync({ useProxy: useProxyByDefault } as any);

      if ((result as any).type === 'success') {
        const authPayload: any = (result as any).authentication || (result as any).params || {};
        const idToken = authPayload?.idToken || authPayload?.id_token;
        const accessToken = authPayload?.accessToken || authPayload?.access_token;
        
        if (idToken || accessToken) {
          const credential = GoogleAuthProvider.credential(idToken || undefined, accessToken || undefined);
          const userCredential = await signInWithCredential(auth, credential);
          
          // Verificar se userCredential e user existem
          if (!userCredential?.user) {
            throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
          }
          
          const currentUser = userCredential.user;
          if (!currentUser) {
            throw new Error('Erro ao fazer login: dados do utilizador não disponíveis');
          }
          
          // Verificar se a conta foi criada com email/password
          const userRef = doc(db, 'users', currentUser.uid);
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
              name: (currentUser?.displayName) || '',
              email: (currentUser?.email) || '',
              plan: 'free',
              streak: 0,
              badges: [],
              createdAt: Timestamp.fromDate(new Date()),
              authMethod: 'google',
            });
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


