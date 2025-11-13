/**
 * App.tsx
 * 
 * Componente principal da aplicação com navegação
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { UserProvider, useUser } from './context/UserContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { AddMealScreen } from './screens/AddMealScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import Toast from 'react-native-toast-message';
import './global.css';
import { initializeBadges } from './services/gamification';

// Garantir que o OAuth flow pode completar (importante para deep linking)
WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="AddMeal" component={AddMealScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, profile, loading } = useUser();

  useEffect(() => {
    // Inicializar badges padrão
    initializeBadges();
  }, []);

  // Debug: Log do estado atual (sempre chamado, não condicional)
  useEffect(() => {
    if (!loading) {
      console.log('🔍 RootNavigator - user:', user?.uid || 'null');
      console.log('🔍 RootNavigator - profile:', profile ? 'exists' : 'null');
      console.log('🔍 RootNavigator - onboardingCompleted:', profile?.onboardingCompleted);
    }
  }, [user, profile, loading]);

  // Verificar se precisa de onboarding (apenas se já tem conta E perfil completo)
  // IMPORTANTE: Verificar explicitamente se onboardingCompleted é true
  const onboardingCompleted = profile?.onboardingCompleted === true;
  
  // Se o perfil existe mas não tem onboardingCompleted, pode estar a ser criado
  // Verificar se o perfil foi criado recentemente (dentro dos últimos 5 segundos)
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [profileCreatedRecently, setProfileCreatedRecently] = useState(false);
  
  // Verificar imediatamente quando o perfil é carregado
  // Calcular se deve mostrar loading ANTES do useEffect para evitar flash
  const shouldCheckOnboarding = user && profile && profile.onboardingCompleted === undefined;
  const isProfileRecent = shouldCheckOnboarding && profile?.createdAt ? 
    ((new Date().getTime() - new Date(profile.createdAt).getTime()) / 1000 < 5) : 
    false;
  
  useEffect(() => {
    if (user && profile) {
      // Se o perfil existe mas onboardingCompleted é undefined, pode estar a ser criado
      if (profile.onboardingCompleted === undefined) {
        // Verificar se o perfil foi criado recentemente
        const createdAt = profile.createdAt;
        let isRecent = false;
        
        if (createdAt) {
          const now = new Date();
          const created = new Date(createdAt);
          const diffSeconds = (now.getTime() - created.getTime()) / 1000;
          
          // Se foi criado há menos de 5 segundos, considerar que está a ser criado
          isRecent = diffSeconds < 5;
        }
        
        // Se é recente ou não tem createdAt, considerar que está a ser criado
        if (isRecent || !createdAt) {
          // Definir imediatamente para evitar flash
          setProfileCreatedRecently(true);
          setCheckingOnboarding(true);
          // Aguardar mais tempo para garantir que o onboardingCompleted é guardado
          const timer = setTimeout(() => {
            setProfileCreatedRecently(false);
            setCheckingOnboarding(false);
          }, 3000);
          return () => clearTimeout(timer);
        } else {
          // Se não é recente, aguardar um pouco
          setCheckingOnboarding(true);
          const timer = setTimeout(() => {
            setCheckingOnboarding(false);
          }, 2000);
          return () => clearTimeout(timer);
        }
      } else {
        setCheckingOnboarding(false);
        setProfileCreatedRecently(false);
      }
    } else {
      setCheckingOnboarding(false);
      setProfileCreatedRecently(false);
    }
  }, [user, profile]);
  
  // Não mostrar onboarding se está a verificar ou se o perfil foi criado recentemente
  // Usar também o cálculo síncrono para evitar flash
  const needsOnboarding = user && profile && !onboardingCompleted && !checkingOnboarding && !profileCreatedRecently && !isProfileRecent;
  
  // Debug logs (sempre chamado, não condicional)
  useEffect(() => {
    if (!loading) {
      console.log('🔍 App.tsx - user:', user?.uid || 'null');
      console.log('🔍 App.tsx - profile:', profile ? 'exists' : 'null');
      console.log('🔍 App.tsx - onboardingCompleted (raw):', profile?.onboardingCompleted);
      console.log('🔍 App.tsx - onboardingCompleted (processed):', onboardingCompleted);
      console.log('🔍 App.tsx - checkingOnboarding:', checkingOnboarding);
      console.log('🔍 App.tsx - needsOnboarding:', needsOnboarding);
      console.log('🔍 App.tsx - vai mostrar:', user && profile ? (needsOnboarding ? 'Onboarding' : 'AppStack') : 'AuthStack');
    }
  }, [user, profile, loading, needsOnboarding, onboardingCompleted, checkingOnboarding]);

  // Mostrar loading se:
  // 1. Está a carregar
  // 2. Está a verificar onboarding
  // 3. Perfil foi criado recentemente
  // 4. Perfil existe mas onboardingCompleted é undefined (pode estar a ser criado)
  const shouldShowLoading = loading || 
                            checkingOnboarding || 
                            profileCreatedRecently || 
                            isProfileRecent ||
                            (user && profile && profile.onboardingCompleted === undefined);
  
  if (shouldShowLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3BB273" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user && profile ? (
        needsOnboarding ? (
          // Se o utilizador já tem conta mas precisa de onboarding, mostrar onboarding
          // (isto só acontece se o utilizador fez login e o perfil indica que precisa)
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </Stack.Navigator>
        ) : (
          <AppStack />
        )
      ) : (
        // Sempre começar na WelcomeScreen quando não há user autenticado
        // ou quando há user mas sem perfil (estado inconsistente)
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <StatusBar style="auto" />
      <RootNavigator />
      <Toast />
    </UserProvider>
  );
}

