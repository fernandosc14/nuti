/**
 * User Context
 * 
 * Context API para gerenciar estado global do utilizador
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Google Sign-In será implementado com expo-auth-session
// import { GoogleSignin } from '@react-native-google-signin/google-signin';

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
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Observar mudanças de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await loadProfile(firebaseUser.uid);
        await AsyncStorage.setItem('userId', firebaseUser.uid);
      } else {
        setProfile(null);
        await AsyncStorage.removeItem('userId');
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

  // Sign in com Google
  const signInWithGoogle = async () => {
    try {
      // TODO: Implementar Google Sign-In com expo-auth-session
      // Por enquanto, mostra mensagem
      throw new Error('Google Sign-In será implementado em breve. Use email/password por enquanto.');
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao fazer login com Google');
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // await GoogleSignin.signOut(); // Descomentar quando Google Sign-In estiver implementado
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

