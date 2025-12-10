/**
 * App.tsx
 * 
 * Componente principal da aplicação com navegação
 */

import React, { useEffect, useState, useRef, ErrorInfo, useCallback } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Platform, Modal, Pressable, Text, LogBox } from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { UserProvider, useUser } from './context/UserContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { UnitsProvider } from './context/UnitsContext';
import { SelectedDateProvider, useSelectedDate } from './context/SelectedDateContext';
import { AdProvider } from './context/AdContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
// Não importar OnboardingScreen diretamente - será importado dinamicamente apenas quando necessário
// Isto evita que o react-native-css-interop tente processá-lo antes do NavigationContainer estar pronto
import { DashboardScreen } from './screens/DashboardScreen';
import { AddMealScreen } from './screens/AddMealScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { EditNameScreen } from './screens/EditNameScreen';
import { EditPersonalDetailsScreen } from './screens/EditPersonalDetailsScreen';
import { EditGoalAndWeightScreen } from './screens/EditGoalAndWeightScreen';
import { EditWorkoutsPerWeekScreen } from './screens/EditWorkoutsPerWeekScreen';
import { EditDietScreen } from './screens/EditDietScreen';
import { EditCaloriesAndMacrosScreen } from './screens/EditCaloriesAndMacrosScreen';
import { AddExerciseScreen } from './screens/AddExerciseScreen';
import { UpdateWeightScreen } from './screens/UpdateWeightScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { BMIScreen } from './screens/BMIScreen';
import { PreferencesScreen } from './screens/PreferencesScreen';
import { PremiumWelcomeModal } from './components/PremiumWelcomeModal';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import './global.css';
import { initializeBadges } from './services/gamification';

// Garantir que o OAuth flow pode completar (importante para deep linking)
WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Context para controlar quando mostrar onboarding (evita usar navegação que causa pré-carregamento)
const OnboardingContext = React.createContext<{
  showOnboarding: () => void;
  hideOnboarding: () => void;
}>({ showOnboarding: () => {}, hideOnboarding: () => {} });

function AuthStack() {
  const { showOnboarding } = React.useContext(OnboardingContext);
  
  // Wrapper para WelcomeScreen que injeta showOnboarding
  const WelcomeScreenWithOnboarding = React.useCallback((props: any) => {
    return <WelcomeScreen {...props} showOnboarding={showOnboarding} />;
  }, [showOnboarding]);
  
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreenWithOnboarding} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      {/* Onboarding não está aqui para evitar pré-carregamento pelo react-native-css-interop */}
    </Stack.Navigator>
  );
}

function AddButton() {
  let navigation: any = null;
  try {
    navigation = useNavigation();
  } catch (error: any) {
    console.error('❌ AddButton - Erro ao obter navigation:', error.message);
    return null;
  }
  
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { selectedDate } = useSelectedDate();
  const { profile } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef<TouchableOpacity>(null);
  const [buttonLayout, setButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const isPremium = profile?.plan === 'premium';
  
  const handleOption = (mode: 'camera' | 'barcode' | 'search') => {
    // Fechar menu imediatamente
    setShowMenu(false);
    
    // Se não for premium e tentar usar camera ou barcode, redirecionar para Premium
    if (!isPremium && (mode === 'camera' || mode === 'barcode')) {
      // Navegar diretamente para Premium screen (menu já foi fechado)
      requestAnimationFrame(() => {
        (navigation as any).getParent()?.navigate('Premium');
      });
      return;
    }
    
    setTimeout(() => {
      (navigation as any).getParent()?.navigate('AddMeal', { 
        mode,
        selectedDate: selectedDate ? selectedDate.toISOString() : null
      });
    }, 200);
  };

  const onButtonLayout = () => {
    buttonRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setButtonLayout({ x: pageX, y: pageY, width, height });
    });
  };
  
  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        onPress={() => {
          onButtonLayout();
          setShowMenu(true);
        }}
        onLayout={onButtonLayout}
        style={styles.addButton}
        activeOpacity={0.8}
      >
        <View style={[styles.addButtonInner, { borderColor: theme.isDark ? '#1E293B' : '#FFFFFF' }]}>
          <Ionicons name={showMenu ? "close" : "add"} size={38} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {showMenu && (
        <Modal
          visible={showMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
            onPress={() => setShowMenu(false)}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 150,
                alignSelf: 'center',
                flexDirection: 'row',
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                padding: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 8,
                gap: 8,
              }}
            >
              {/* Câmera */}
              <TouchableOpacity
                onPress={() => handleOption('camera')}
                activeOpacity={0.7}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                }}
              >
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#3B82F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* Código de Barras */}
              <TouchableOpacity
                onPress={() => handleOption('barcode')}
                activeOpacity={0.7}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                }}
              >
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#10B981',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="barcode" size={24} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* Pesquisar Alimento */}
              <TouchableOpacity
                onPress={() => handleOption('search')}
                activeOpacity={0.7}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                }}
              >
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.colors.primary || '#3BB273',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="search" size={24} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          height: 70,
          paddingBottom: 8,
          paddingTop: 6,
          paddingVertical: 0,
          marginBottom: 0,
          shadowColor: '#000000',
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 25,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: 0,
          borderWidth: 0,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
          paddingTop: 6,
          paddingBottom: 6,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 16,
          marginHorizontal: 4,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: t('nav.home') || 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={focused ? 30 : 26} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressScreen}
        options={{
          tabBarLabel: t('nav.progress') || 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "stats-chart" : "stats-chart-outline"} 
              size={focused ? 30 : 26} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="AddMealTab"
        component={View}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <AddButton />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
          },
        })}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatScreen}
        options={{
          tabBarLabel: t('nav.chat') || 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
              size={focused ? 30 : 26} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.profile') || 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={focused ? 30 : 26} 
              color={color} 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {!theme.isDark && (
        <LinearGradient
          colors={['#3BB273', '#F0FDF4', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          locations={[0, 0.15, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: !theme.isDark
          ? { backgroundColor: 'transparent' }
          : { backgroundColor: theme.colors.background },
      }}
    >
        <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="AddMeal" component={AddMealScreen} />
      <Stack.Screen name="EditName" component={EditNameScreen} />
      <Stack.Screen name="EditPersonalDetails" component={EditPersonalDetailsScreen} />
      <Stack.Screen name="EditGoalAndWeight" component={EditGoalAndWeightScreen} />
      <Stack.Screen name="EditWorkoutsPerWeek" component={EditWorkoutsPerWeekScreen} />
      <Stack.Screen name="EditDiet" component={EditDietScreen} />
      <Stack.Screen name="EditCaloriesAndMacros" component={EditCaloriesAndMacrosScreen} />
      <Stack.Screen name="AddExercise" component={AddExerciseScreen} />
      <Stack.Screen name="UpdateWeight" component={UpdateWeightScreen} />
      <Stack.Screen name="BMI" component={BMIScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
    </Stack.Navigator>
    </View>
  );
}

function RootNavigator() {
  const { user, profile, loading } = useUser();
  const { theme } = useTheme();
  
  // TODOS OS HOOKS DEVEM ESTAR NO TOPO, ANTES DE QUALQUER LÓGICA CONDICIONAL
  const [navigationReady, setNavigationReady] = useState(false);
  const [showOnboardingFromWelcome, setShowOnboardingFromWelcome] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [profileCreatedRecently, setProfileCreatedRecently] = useState(false);
  const [onboardingCancelled, setOnboardingCancelled] = useState(false);
  const [OnboardingScreenComponent, setOnboardingScreenComponent] = useState<React.ComponentType<any> | null>(null);
  
  const hideOnboarding = useCallback(() => {
    setShowOnboardingFromWelcome(false);
    setOnboardingCancelled(true); // Marcar que o utilizador cancelou o onboarding
  }, []);

  useEffect(() => {
    // Inicializar badges padrão
    // Nota: Pode falhar se as regras do Firestore não permitirem criação
    // Nesse caso, cria as badges manualmente no Firebase Console
    initializeBadges().catch((error) => {
      console.warn('[Badges] Could not initialize badges automatically. Create them manually in Firebase Console.');
      console.warn('[Badges] See scripts/create-badges.js for badge definitions.');
    });
  }, []);


  // Verificar se precisa de onboarding (apenas se já tem conta E perfil completo)
  // IMPORTANTE: Verificar explicitamente se onboardingCompleted é true
  const onboardingCompleted = profile?.onboardingCompleted === true;
  
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
  // Também não mostrar se o utilizador cancelou o onboarding
  const needsOnboarding = user && profile && !onboardingCompleted && !checkingOnboarding && !profileCreatedRecently && !isProfileRecent && !onboardingCancelled;
  
  // Resetar showOnboardingFromWelcome quando o onboarding está completo
  useEffect(() => {
    if (user && profile && onboardingCompleted === true && showOnboardingFromWelcome) {
      setShowOnboardingFromWelcome(false);
    }
  }, [user, profile, onboardingCompleted, showOnboardingFromWelcome]);
  
  // Importar OnboardingScreen dinamicamente quando necessário
  // IMPORTANTE: Não importar se o onboarding já está completo
  useEffect(() => {
    const shouldImportOnboarding = ((user && profile && needsOnboarding) || showOnboardingFromWelcome) && 
                                    !(user && profile && onboardingCompleted === true);
    if (shouldImportOnboarding) {
      // Importar dinamicamente apenas quando necessário - isto evita pré-processamento pelo react-native-css-interop
      import('./screens/OnboardingScreen').then((module) => {
        setOnboardingScreenComponent(() => module.OnboardingScreen);
      }).catch((error) => {
        console.error('❌ RootNavigator - Erro ao importar OnboardingScreen:', error);
      });
    } else if (user && profile && onboardingCompleted === true && OnboardingScreenComponent) {
      // Limpar o componente se o onboarding está completo
      setOnboardingScreenComponent(null);
    }
  }, [user, profile, needsOnboarding, showOnboardingFromWelcome, onboardingCompleted]);
  

  // Mostrar loading se:
  // 1. Está a carregar (sem user ou profile ainda)
  // 2. Está a verificar onboarding (apenas por um tempo limitado)
  // 3. Perfil foi criado recentemente (apenas por um tempo limitado)
  const shouldShowLoading = loading || 
                            (checkingOnboarding && profileCreatedRecently) || 
                            (profileCreatedRecently && isProfileRecent);
  
  if (shouldShowLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3BB273" />
      </View>
    );
  }

  // Se precisa de onboarding, renderizar diretamente (fora do NavigationContainer)
  // IMPORTANTE: Não renderizar OnboardingScreen se o onboarding já está completo ou foi cancelado
  const shouldShowOnboarding = ((user && profile && needsOnboarding) || showOnboardingFromWelcome) && 
                                !(user && profile && onboardingCompleted === true) &&
                                !onboardingCancelled;
  
  if (shouldShowOnboarding) {
    if (!OnboardingScreenComponent) {
      // Mostrar loading enquanto importa dinamicamente
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    return <OnboardingScreenComponent navigation={null} onClose={hideOnboarding} />;
  }
  
  // Caso contrário, renderizar NavigationContainer normalmente
  // IMPORTANTE: NavigationContainer deve ser renderizado mesmo se navigationReady for false
  // porque o onReady só é chamado quando o NavigationContainer é montado
  return (
    <OnboardingContext.Provider value={{
      showOnboarding: () => {
        setShowOnboardingFromWelcome(true);
        setOnboardingCancelled(false); // Resetar o estado de cancelamento quando o utilizador quer começar novamente
      },
      hideOnboarding: hideOnboarding,
    }}>
      <NavigationContainer
        theme={{
          dark: theme.isDark,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.card,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.primary,
          },
        }}
               onReady={() => {
                 setNavigationReady(true);
               }}
      >
        {user && profile && (onboardingCompleted || onboardingCancelled) ? (
          // User autenticado e onboarding completo ou cancelado - mostrar AppStack
          <AppStack />
        ) : (
          // Sem user ou onboarding não completo - mostrar AuthStack
          <AuthStack />
        )}
      </NavigationContainer>
    </OnboardingContext.Provider>
  );
}

const styles = StyleSheet.create({
  addButton: {
    top: -32,
    justifyContent: 'center',
    alignItems: 'center',
    width: 68,
    height: 68,
  },
  addButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#3BB273',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3BB273',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        // iOS shadow
      },
      android: {
        // Android elevation já está acima
      },
    }),
  },
});

// Error Boundary para capturar erros de navegação
class NavigationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('❌ NavigationErrorBoundary - Erro capturado:', error.message);
    console.error('❌ NavigationErrorBoundary - Stack:', error.stack);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ NavigationErrorBoundary - componentDidCatch:', error.message);
    console.error('❌ NavigationErrorBoundary - errorInfo:', JSON.stringify(errorInfo, null, 2));
  }

  render() {
    if (this.state.hasError && this.state.error) {
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 1000);
    }
    return this.props.children;
  }
}

// Componente para configurar StatusBar baseado no tema
function StatusBarConfig() {
  const { theme } = useTheme();
  // Sempre usar texto claro (branco) para ser visível no gradiente verde quando app está em modo claro
  return <StatusBar style="light" />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <UnitsProvider>
              <SelectedDateProvider>
                <UserProvider>
                  <AdProvider>
                    <StatusBarConfig />
                    <NavigationErrorBoundary>
                      <RootNavigator />
                    </NavigationErrorBoundary>
                    <PremiumWelcomeModal />
                    <Toast />
                  </AdProvider>
                </UserProvider>
              </SelectedDateProvider>
            </UnitsProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

