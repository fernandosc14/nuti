/**
 * OnboardingScreen
 * 
 * Fluxo de onboarding para novos utilizadores (antes de criar conta)
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Linking,
  Animated,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Pressable,
  Vibration,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
// import { useTheme } from '../context/ThemeContext'; // Não usado - onboarding sempre em modo escuro
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
// import * as Clipboard from 'expo-clipboard';
import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { calculateCaloriePlan } from '../utils/nutritionUtils';
import { db } from '../services/firebase';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { applyReminderPreference, loadReminderPreference, requestNotificationPermission as requestNotificationPermissionService } from '../services/notifications';

type OnboardingStep = 
  | 'gender'
  | 'workouts'
  | 'heardFrom'
  | 'triedOtherApps'
  | 'height'
  | 'weight'
  | 'age'
  | 'goal'
  | 'goalSpeed'
  | 'diet'
  | 'desiredWeight'
  | 'calorieGoal'
  | 'notifications'
  | 'createAccount';

const TOTAL_STEPS = 14;

export function OnboardingScreen({ navigation: _navigation, onClose }: { navigation?: any; onClose?: () => void }) {
  // Não usar navigation diretamente, apenas receber como prop para evitar erros
  const { signInWithGoogleNative, updateProfile, user, profile, refreshProfile, signOut } = useUser();
  const { t, language } = useLanguage();
  
  // Forçar modo escuro no onboarding
  const theme = {
    isDark: true,
    colors: {
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      textSecondary: '#94A3B8',
      primary: '#3BB273',
      border: '#334155',
      card: '#1E293B',
      error: '#EF4444',
      success: '#3BB273',
    },
  };
  
  // Não podemos acessar o contexto diretamente aqui porque o OnboardingScreen
  // é renderizado fora do NavigationContainer. Vamos usar uma prop ou callback.
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('gender');
  
  // Função helper para vibrar ao clicar em opções
  const triggerHaptic = useCallback(() => {
    try {
      // Usar Vibration API nativa (mais confiável e funciona em ambos iOS e Android)
      if (Platform.OS === 'ios') {
        // iOS: vibração mais curta
        Vibration.vibrate(10);
      } else {
        // Android: vibração leve
        Vibration.vibrate(15);
      }
    } catch (e) {
      // Se falhar, tentar expo-haptics como fallback
      try {
        if (Haptics && Haptics.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (err) {
        // Silenciosamente ignorar se não conseguir vibrar
      }
    }
  }, []);
  
  const [loading, setLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Form data
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<'none' | '1x' | '1-2x' | '2-3x' | '3-4x' | '5-6x' | 'daily' | null>(null);
  const [heardFrom, setHeardFrom] = useState<string | null>(null);
  const [triedOtherApps, setTriedOtherApps] = useState<boolean | null>(null);
  const [isImperial, setIsImperial] = useState(false);
  const [heightCm, setHeightCm] = useState(175); // Slider value em cm
  const [weightKg, setWeightKg] = useState(70); // Slider value em kg
  const [age, setAge] = useState('25');
  // Estados temporários para edição livre
  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [heightIsEmpty, setHeightIsEmpty] = useState(false);
  const [weightIsEmpty, setWeightIsEmpty] = useState(false);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain' | null>(null);
  const [goalSpeed, setGoalSpeed] = useState<number>(1.0); // kg per week (will convert to lbs if imperial)
  const [diet, setDiet] = useState<'classic' | 'pescatarian' | 'vegetarian' | 'vegan' | null>(null);
  const [desiredWeight, setDesiredWeight] = useState('');
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [mealReminderEnabled, setMealReminderEnabled] = useState(true);
  const [waterReminderEnabled, setWaterReminderEnabled] = useState(true);
  const [togglingMealReminder, setTogglingMealReminder] = useState(false);
  const [togglingWaterReminder, setTogglingWaterReminder] = useState(false);
  const [calculationSteps, setCalculationSteps] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [editingMacro, setEditingMacro] = useState<'calories' | 'protein' | 'carbs' | 'fat' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [calculatedMacros, setCalculatedMacros] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    bmr: number;
    tdee: number;
    maintenanceCalories?: number;
  } | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const switchAnim = useRef(new Animated.Value(0)).current;
  const [optionAnimations, setOptionAnimations] = useState<Animated.Value[]>([]);

  // Animar switch quando isImperial mudar
  useEffect(() => {
    Animated.spring(switchAnim, {
      toValue: isImperial ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [isImperial, switchAnim]);

  // Criar animações para opções quando o step muda
  // Usar useLayoutEffect para garantir que as animações são configuradas antes da pintura
  useLayoutEffect(() => {
    const stepsWithOptions = ['gender', 'workouts', 'heardFrom', 'triedOtherApps', 'goal', 'diet'];
    if (stepsWithOptions.includes(currentStep)) {
      let optionCount = 0;
      if (currentStep === 'gender') optionCount = 2;
      else if (currentStep === 'workouts') optionCount = 7;
      else if (currentStep === 'heardFrom') optionCount = 7;
      else if (currentStep === 'triedOtherApps') optionCount = 2;
      else if (currentStep === 'goal') optionCount = 3;
      else if (currentStep === 'diet') optionCount = 4;

      // Criar animações imediatamente com valor inicial 0 (invisível)
      // Isso garante que as opções começam invisíveis antes da animação
      const anims = Array.from({ length: optionCount }, () => new Animated.Value(0));
      setOptionAnimations(anims);

      // Usar requestAnimationFrame para garantir que começamos no próximo frame de renderização
      // Isso evita o flash porque as opções já estão com opacity 0 quando são renderizadas
      const rafId = requestAnimationFrame(() => {
        // Animar cada opção com delay escalonado
        anims.forEach((anim, index) => {
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay: index * 80,
            useNativeDriver: true,
          }).start();
        });
      });

      // Cleanup do requestAnimationFrame se o componente desmontar ou step mudar
      return () => {
        cancelAnimationFrame(rafId);
      };
    } else {
      setOptionAnimations([]);
    }
  }, [currentStep]);

  const stepIndex = {
    gender: 0,
    age: 1,
    height: 2,
    weight: 3,
    goal: 4,
    desiredWeight: 5,
    goalSpeed: 6,
    workouts: 7,
    diet: 8,
    calorieGoal: 9,
    notifications: 10,
    heardFrom: 11,
    triedOtherApps: 12,
    createAccount: 13,
  } as const;

  const calculateCalorieGoal = useCallback(() => {
    const ageNum = parseInt(age) || 25;
    const desiredWeightKgValue = (() => {
      if (goal === 'maintain') return weightKg;
      if (!desiredWeight) return weightKg;
      const parsed = parseFloat(desiredWeight);
      if (isNaN(parsed)) return weightKg;
      return isImperial ? parsed * 0.453592 : parsed;
    })();

    const goalSpeedToUse = goal === 'maintain' ? undefined : goalSpeed;

    const plan = calculateCaloriePlan({
      weightKg,
      heightCm,
      age: ageNum,
      gender,
      workoutsPerWeek,
      goal,
      desiredWeightKg: desiredWeightKgValue,
      currentWeightKg: weightKg,
      goalSpeed: goalSpeedToUse, // Só passar se não for maintain
    });

    const calories = plan.calories;
    const proteinGrams = Math.round((calories * 0.30) / 4);
    const carbsGrams = Math.round((calories * 0.40) / 4);
    const fatGrams = Math.round((calories * 0.30) / 9);

    return {
      calories,
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams,
      bmr: plan.bmr,
      tdee: plan.maintenanceCalories,
      maintenanceCalories: plan.maintenanceCalories,
    };
  }, [age, desiredWeight, gender, goal, goalSpeed, heightCm, isImperial, weightKg, workoutsPerWeek]);

  // Garantir que quando calculating muda para false, os macros estão definidos
  useEffect(() => {
    if (currentStep === 'calorieGoal' && !calculating && !calculatedMacros) {
      // Apenas calcular se não há macros e não está calculando
      // Isso é um fallback caso a animação não tenha definido os macros
      const calculated = calculateCalorieGoal();
      if (calculated) {
        setCalorieGoal(calculated.calories);
        setCalculatedMacros(calculated);
      }
    }
  }, [currentStep, calculating, calculatedMacros, calculateCalorieGoal]);

  // Verificar status de notificações quando entrar no step e pedir permissão automaticamente
  useEffect(() => {
    if (currentStep === 'notifications') {
      const checkAndRequestPermission = async () => {
          try {
          const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
          const granted = status === 'granted';

          setNotificationsEnabled(granted);
          setMealReminderEnabled(granted);
          setWaterReminderEnabled(granted);

          if (granted) {
            try {
              await applyReminderPreference('meal', true);
              await applyReminderPreference('water', true);
            } catch (error) {
              console.warn('Error applying reminder preferences:', error);
            }
          } else if (!canAskAgain) {
            Toast.show({
              type: 'info',
              text1: t('onboarding.notifications.denied'),
              text2: t('onboarding.notifications.deniedMessage'),
            });
          }
          } catch (error) {
            console.error('Error checking notification permission:', error);
            setNotificationsEnabled(false);
            setMealReminderEnabled(false);
            setWaterReminderEnabled(false);
          }
      };

      checkAndRequestPermission();
    }
  }, [currentStep]);

  // Preferências de lembretes serão carregadas/definidas quando entrar no step de notificações

  const ensureNotificationPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      setNotificationsEnabled(true);
      // Auto-enable reminders when permission is granted
      try {
        await applyReminderPreference('meal', true);
        await applyReminderPreference('water', true);
        setMealReminderEnabled(true);
        setWaterReminderEnabled(true);
      } catch (error) {
        console.warn('Error applying reminder preferences after ensure:', error);
      }
      return true;
    }
    const granted = await requestNotificationPermissionService();
    setNotificationsEnabled(granted);
    if (!granted) {
      Toast.show({
        type: 'info',
        text1: t('onboarding.notifications.denied'),
        text2: t('onboarding.notifications.deniedMessage'),
      });
    }
    return granted;
  }, [t]);

  const handleToggleReminder = useCallback(async (key: 'meal' | 'water') => {
    const isMeal = key === 'meal';
    const current = isMeal ? mealReminderEnabled : waterReminderEnabled;
    
    // Always check permission before allowing toggle
    if (!notificationsEnabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Toast.show({
          type: 'info',
          text1: t('onboarding.notifications.denied'),
          text2: t('onboarding.notifications.deniedMessage'),
        });
        return;
      }
    }
    
    const next = !current;
    if (isMeal) setTogglingMealReminder(true); else setTogglingWaterReminder(true);

    try {
      await applyReminderPreference(key, next);
      if (isMeal) setMealReminderEnabled(next); else setWaterReminderEnabled(next);
    } catch (error) {
      console.error('Erro ao aplicar lembrete', error);
      Toast.show({
        type: 'error',
        text1: t('onboarding.notifications.error'),
        text2: t('onboarding.notifications.errorMessage'),
      });
    } finally {
      if (isMeal) setTogglingMealReminder(false); else setTogglingWaterReminder(false);
    }
  }, [ensureNotificationPermission, mealReminderEnabled, notificationsEnabled, t, waterReminderEnabled]);

  const handleNext = () => {
    // Processar texto temporário antes de avançar (se houver e estiver no step correto)
    if (currentStep === 'height' && heightText !== '') {
      // Processar altura antes de avançar
      if (isImperial) {
        const cleanText = heightText.replace(/[^0-9'"]/g, '');
        let feet = 0;
        let inches = 0;
        const match1 = cleanText.match(/(\d+)'(\d+)/);
        if (match1) {
          feet = parseInt(match1[1]) || 0;
          inches = parseInt(match1[2]) || 0;
        } else {
          const num = parseInt(cleanText);
          if (!isNaN(num)) {
            if (num >= 40 && num <= 84) {
              feet = Math.floor(num / 10);
              inches = num % 10;
            } else if (num >= 4 && num <= 7) {
              feet = num;
              inches = 0;
            }
          }
        }
        if (feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
          const totalCm = feet * 30.48 + inches * 2.54;
          if (totalCm >= 120 && totalCm <= 220) {
            setHeightCm(Math.round(totalCm));
            setHeightIsEmpty(false);
            setHeightText('');
          }
        }
      } else {
        const num = parseInt(heightText.replace(/[^0-9]/g, ''));
        if (!isNaN(num) && num >= 120 && num <= 220) {
          setHeightCm(num);
          setHeightIsEmpty(false);
          setHeightText('');
        }
      }
    }
    
    if (currentStep === 'weight' && weightText !== '') {
      // Processar peso antes de avançar
      const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) {
        if (isImperial) {
          const kg = num / 2.20462;
          if (kg >= 30 && kg <= 200) {
            setWeightKg(Math.round(kg * 2) / 2);
            setWeightIsEmpty(false);
            setWeightText('');
          }
        } else {
          if (num >= 30 && num <= 200) {
            setWeightKg(Math.round(num * 2) / 2);
            setWeightIsEmpty(false);
            setWeightText('');
          }
        }
      }
    }

    const steps: OnboardingStep[] = [
      'gender',
      'age',
      'height',
      'weight',
      'goal',
      'desiredWeight',
      'goalSpeed',
      'workouts', // Precisa vir antes de calorieGoal
      'diet',
      'calorieGoal', // Precisa de workoutsPerWeek
      'notifications',
      'heardFrom',
      'triedOtherApps',
      'createAccount',
    ];

    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      let nextStep = steps[currentIndex + 1];
      
      // Se o goal é 'maintain', pular goalSpeed e desiredWeight
      if (goal === 'maintain') {
        if (nextStep === 'goalSpeed' || nextStep === 'desiredWeight') {
          // Pular para workouts (nunca pular workouts, é necessário para o cálculo)
          nextStep = 'workouts';
        }
      }
      
      // Se está a ir para calorieGoal, calcular primeiro
      if (nextStep === 'calorieGoal') {
        // Calcular imediatamente
        const calculated = calculateCalorieGoal();
        
        if (calculated) {
          // Definir os macros imediatamente
          setCalorieGoal(calculated.calories);
          setCalculatedMacros(calculated);
        }
        
        // Mostrar animação de loading
        setCalculating(true);
        setCalculationSteps([]); // Limpar steps anteriores
        setProgressPercent(0);
        progressAnim.setValue(0);
        
        // Lista de steps para mostrar
        const steps = [
          t('onboarding.calculating.step1') || 'Calculating BMR',
          t('onboarding.calculating.step2') || 'Calculating TDEE',
          t('onboarding.calculating.step3') || 'Adjusting for goal',
          t('onboarding.calculating.step4') || 'Calculating macros',
          t('onboarding.calculating.step5') || 'Finalizing plan',
        ];
        
        // Animar progress bar e steps
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            setProgressPercent(100);
            // Quando a animação terminar, apenas parar de calcular
            // Os macros já estão definidos
            setCalculating(false);
          }
        });
        
        // Atualizar percentagem durante a animação
        const listenerId = progressAnim.addListener(({ value }) => {
          setProgressPercent(Math.round(value * 100));
        });
        
        // Limpar listener quando a animação terminar
        setTimeout(() => {
          progressAnim.removeListener(listenerId);
        }, 2000);
        
        // Animar steps com delay irregular (não linear)
        // Intervalos variados para tornar a animação mais natural
        const stepDelays = [300, 500, 400, 600, 300]; // Durações irregulares em ms
        
        steps.forEach((step, index) => {
          const cumulativeDelay = stepDelays.slice(0, index + 1).reduce((sum, delay) => sum + delay, 0);
          setTimeout(() => {
            setCalculationSteps(prev => [...prev, step]);
            triggerHaptic();
          }, cumulativeDelay);
        });
      }
      
      setCurrentStep(nextStep);
    }
  };

  const handleBack = async () => {
    // Se estiver no primeiro slide (gender), fechar o onboarding e voltar para Welcome/Login
    if (currentStep === 'gender') {
      if (user) {
        try {
          await signOut();
        } catch (error) {
          console.error('Error signing out:', error);
        }
      }
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
      return;
    }

    const steps: OnboardingStep[] = [
      'gender',
      'age',
      'height',
      'weight',
      'goal',
      'desiredWeight',
      'goalSpeed',
      'workouts', // Precisa vir antes de calorieGoal
      'diet',
      'calorieGoal', // Precisa de workoutsPerWeek
      'notifications',
      'heardFrom',
      'triedOtherApps',
      'createAccount',
    ];

    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex <= 0) {
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
      return;
    }

    let prevStep = steps[currentIndex - 1];

    // Ajustar navegação para trás quando goal é maintain
    if (goal === 'maintain') {
      if (currentStep === 'workouts') {
        prevStep = 'goal';
      } else if (currentStep === 'diet') {
        prevStep = 'workouts';
      } else if (currentStep === 'calorieGoal') {
        prevStep = 'diet';
      }
    }

    setCurrentStep(prevStep);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'gender':
        return gender !== null;
      case 'workouts':
        return workoutsPerWeek !== null;
      case 'heardFrom':
        return heardFrom !== null;
      case 'triedOtherApps':
        return triedOtherApps !== null;
      case 'height':
        if (heightIsEmpty || heightCm === 0) {
          return false;
        }
        if (heightText !== '') {
          if (isImperial) {
            const cleanText = heightText.replace(/[^0-9'\"]/g, '');
            let feet = 0;
            let inches = 0;
            const match1 = cleanText.match(/(\d+)'(\d+)/);
            if (match1) {
              feet = parseInt(match1[1]) || 0;
              inches = parseInt(match1[2]) || 0;
            } else {
              const num = parseInt(cleanText);
              if (!isNaN(num)) {
                if (num >= 40 && num <= 84) {
                  feet = Math.floor(num / 10);
                  inches = num % 10;
                } else if (num >= 4 && num <= 7) {
                  feet = num;
                  inches = 0;
                }
              }
            }
            if (feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
              const totalCm = feet * 30.48 + inches * 2.54;
              return totalCm >= 120 && totalCm <= 220;
            }
            return false;
          } else {
            const num = parseInt(heightText.replace(/[^0-9]/g, ''));
            return !isNaN(num) && num >= 120 && num <= 220;
          }
        }
        return heightCm >= 120 && heightCm <= 220;
      case 'weight':
        if (weightIsEmpty || weightKg === 0) {
          return false;
        }
        if (weightText !== '') {
          const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
          if (!isNaN(num)) {
            if (isImperial) {
              const kg = num / 2.20462;
              return kg >= 30 && kg <= 200;
            } else {
              return num >= 30 && num <= 200;
            }
          }
          return false;
        }
        return weightKg >= 30 && weightKg <= 200;
      case 'age':
        return age !== '' && !isNaN(parseInt(age)) && parseInt(age) >= 18 && parseInt(age) <= 150;
      case 'goal':
        return goal !== null;
      case 'goalSpeed':
        if (goal === 'maintain') {
          return true;
        }
        return goalSpeed > 0;
      case 'diet':
        return diet !== null;
      case 'desiredWeight':
        if (goal === 'maintain') {
          return true;
        }
        if (!desiredWeight || desiredWeight === '') {
          return false;
        }
        const desiredWeightNum = parseFloat(desiredWeight);
        if (isNaN(desiredWeightNum)) {
          return false;
        }
        const currentWeight = weightKg;
        if (goal === 'gain') {
          return desiredWeightNum > currentWeight;
        } else if (goal === 'lose') {
          return desiredWeightNum < currentWeight;
        }
        return true;
      case 'calorieGoal':
        return true;
      case 'notifications':
        return true;
      case 'createAccount':
        return true;
      default:
        return true;
    }
  };


  const handleCreateAccountWithGoogle = async () => {
    // Não bloquear se o onboarding já está completo
    if (user && profile && profile.onboardingCompleted === true) {
      return;
    }
    setCreatingAccount(true);
    setLoading(true);
    try {
      // Valores já estão em métricas (sliders sempre guardam em cm e kg)
      const height = heightCm; // cm
      const weight = weightKg; // kg
      // Converter desiredWeight para kg se necessário
      let desiredWeightNum: number;
      if (isImperial) {
        desiredWeightNum = parseFloat(desiredWeight) * 0.453592; // converter lbs para kg
      } else {
        desiredWeightNum = parseFloat(desiredWeight) || weight;
      }

      // Preparar dados do onboarding ANTES de fazer login
      // Calcular dateOfBirth a partir da idade (aproximado, usando 1 de Janeiro)
      const ageNum = parseInt(age) || 25;
      const calculatedDateOfBirth = new Date(new Date().getFullYear() - ageNum, 0, 1);
      
      const onboardingData: any = {
        gender: gender || undefined,
        workoutsPerWeek: workoutsPerWeek || undefined,
        heardFrom: heardFrom || undefined,
        triedOtherApps: triedOtherApps ?? undefined,
        height,
        weight,
        dateOfBirth: Timestamp.fromDate(calculatedDateOfBirth),
        goal: goal || undefined,
        goalSpeed: goal === 'maintain' ? undefined : goalSpeed, // Só salvar se não for maintain
        diet: diet || undefined,
        // Salvar os macros editados (ou calculados)
        dailyCalorieGoal: calculatedMacros?.calories || calorieGoal || undefined,
        dailyProteinGoal: calculatedMacros?.protein || undefined,
        dailyCarbsGoal: calculatedMacros?.carbs || undefined,
        dailyFatGoal: calculatedMacros?.fat || undefined,
        desiredWeight: goal === 'maintain' ? weight : desiredWeightNum, // Se é maintain, usar o peso atual
        onboardingCompleted: true,
        shouldShowPremiumOnboarding: true, // Flag para mostrar premium onboarding
      };

      // Fazer login com Google (permitir criar conta durante onboarding)
      await signInWithGoogleNative(true);

      // Aguardar um pouco para o perfil ser criado e o onAuthStateChanged processar
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Obter o user diretamente do Firebase Auth em vez de depender do contexto
      const { getAuth } = await import('firebase/auth');
      const firebaseAuth = getAuth();
      const currentUser = firebaseAuth.currentUser;
      
      if (!currentUser) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Tentar novamente
        const retryUser = getAuth().currentUser;
        if (!retryUser) {
          throw new Error('Utilizador não está disponível após login');
        }
      }
      
      // Atualizar perfil com dados do onboarding
      await updateProfile(onboardingData);
      
      Toast.show({
        type: 'success',
        text1: 'Conta criada!',
        text2: 'Bem-vindo ao Nuti!',
      });

      // Aguardar um pouco para garantir que o perfil foi atualizado
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Forçar refresh do perfil para garantir que está atualizado
      await refreshProfile();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verificar diretamente no Firestore e garantir que está guardado
      // Reutilizar firebaseAuth já criado anteriormente
      const finalUser = firebaseAuth.currentUser;
      
      if (finalUser) {
        const userRef = doc(db, 'users', finalUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          
          if (data.onboardingCompleted !== true) {
            await setDoc(userRef, { onboardingCompleted: true }, { merge: true });
            await refreshProfile();
            await new Promise(resolve => setTimeout(resolve, 300));
          } else {
            // Se já está completo, forçar refresh uma última vez
            await refreshProfile();
          }
        }
      }
      
      // IMPORTANTE: Resetar creatingAccount e loading para permitir que o App.tsx redirecione
      // Aguardar um pouco para garantir que o perfil foi atualizado no contexto
      await new Promise(resolve => setTimeout(resolve, 500));
      setCreatingAccount(false);
      setLoading(false);
      
      // O App.tsx vai redirecionar automaticamente quando detectar onboardingCompleted = true
    } catch (error: any) {
      setCreatingAccount(false);
      setLoading(false);
      
      // Se o usuário cancelou o login, mostrar aviso amigável
      const errorMessage = error?.message || '';
      const isCancelled = errorMessage.includes('cancelled') || 
                         errorMessage.includes('canceled') || 
                         errorMessage.includes('cancel');
      
      if (isCancelled) {
        Toast.show({
          type: 'info',
          text1: 'Registration cancelled',
          text2: 'You can try again anytime',
        });
        return;
      }
      
      // Para outros erros, mostrar mensagem de erro
      console.error('❌ OnboardingScreen - Erro ao criar conta com Google:', error);
      Toast.show({
        type: 'error',
        text1: 'Error creating account',
        text2: error.message || 'Please try again',
      });
    }
  };

  // Se o user já tem onboarding completo, resetar creatingAccount e loading
  // (pode acontecer se o perfil foi carregado após criar conta)
  useEffect(() => {
    // Se o utilizador já tem conta e completou onboarding, resetar estados
    // O App.tsx vai redirecionar automaticamente
    if (user && profile && profile.onboardingCompleted === true) {
      if (creatingAccount) {
        setCreatingAccount(false);
      }
      if (loading) {
        setLoading(false);
      }
    }
  }, [user, profile, creatingAccount, loading]);
  
  // Se está a criar conta, mostrar loading
  // IMPORTANTE: Se o onboarding já está completo, NÃO mostrar loading - deixar o App.tsx redirecionar
  const isOnboardingComplete = user && profile && profile.onboardingCompleted === true;
  const shouldShowLoading = Boolean(creatingAccount && !isOnboardingComplete);
  
  // Se o onboarding está completo, não renderizar nada - o App.tsx vai redirecionar
  if (isOnboardingComplete) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3BB273" />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary || '#9CA3AF' }}>
            {t('onboarding.redirecting') || 'A redireccionar...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (shouldShowLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3BB273" />
        </View>
      </SafeAreaView>
    );
  }

  const renderProgressBar = () => {
    return (
      <View className="px-6 pt-4 pb-2">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={handleBack}
            disabled={calculating || loading || creatingAccount}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.card,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border,
              opacity: (calculating || loading || creatingAccount) ? 0.5 : 1,
            }}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, height: 4, backgroundColor: '#374151', borderRadius: 2 }}>
            <View
              style={{
                height: 4,
                backgroundColor: '#3BB273',
                borderRadius: 2,
                width: `${progressPercent}%`,
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'gender':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              👤 {t('onboarding.gender')}
            </Text>
            <Text className="text-gray-400 mb-8">
              {t('onboarding.genderDescription')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View className="space-y-4">
                {([
                  { value: 'male' as const, label: t('onboarding.gender.male') },
                  { value: 'female' as const, label: t('onboarding.gender.female') },
                ]).map((option, index) => {
                  const anim = optionAnimations[index] || new Animated.Value(0);
                  // Garantir que sempre começa invisível
                  if (!optionAnimations[index]) {
                    anim.setValue(0);
                  }
                  const opacity = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  });
                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  });
                  return (
                    <Animated.View
                      key={option.value}
                      style={{
                        opacity,
                        transform: [{ translateY }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setGender(option.value);
                        }}
                        className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                          gender === option.value
                            ? 'bg-green-500 border-green-500'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                        style={{ marginBottom: 12 }}
                      >
                        <Text
                          className={`text-lg font-semibold text-center ${
                            gender === option.value ? 'text-white' : 'text-white'
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 'workouts':
        const workoutOptions = [
          { value: 'none' as const, title: t('onboarding.workouts.none.title'), description: t('onboarding.workouts.none.description'), icon: 'bed-outline', color: '#9CA3AF' },
          { value: '1x' as const, title: t('onboarding.workouts.1x.title'), description: t('onboarding.workouts.1x.description'), icon: 'walk-outline', color: '#60A5FA' },
          { value: '1-2x' as const, title: t('onboarding.workouts.1-2x.title'), description: t('onboarding.workouts.1-2x.description'), icon: 'bicycle-outline', color: '#34D399' },
          { value: '2-3x' as const, title: t('onboarding.workouts.2-3x.title'), description: t('onboarding.workouts.2-3x.description'), icon: 'fitness-outline', color: '#3BB273' },
          { value: '3-4x' as const, title: t('onboarding.workouts.3-4x.title'), description: t('onboarding.workouts.3-4x.description'), icon: 'barbell-outline', color: '#F59E0B' },
          { value: '5-6x' as const, title: t('onboarding.workouts.5-6x.title'), description: t('onboarding.workouts.5-6x.description'), icon: 'flame-outline', color: '#EF4444' },
          { value: 'daily' as const, title: t('onboarding.workouts.daily.title'), description: t('onboarding.workouts.daily.description'), icon: 'flash-outline', color: '#8B5CF6' },
        ];
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              💪 {t('onboarding.workoutsPerWeek')}
            </Text>
            <Text className="text-gray-400 mb-6">
              {t('onboarding.workoutsPerWeekDescription')}
            </Text>
            <ScrollView 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 20 }}
            >
              <View style={{ gap: 12 }}>
                {workoutOptions.map((option, index) => {
                  const anim = optionAnimations[index] || new Animated.Value(0);
                  // Garantir que sempre começa invisível
                  if (!optionAnimations[index]) {
                    anim.setValue(0);
                  }
                  const opacity = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  });
                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  });
                  const isSelected = workoutsPerWeek === option.value;
                  return (
                    <Animated.View
                      key={option.value}
                      style={{
                        opacity,
                        transform: [{ translateY }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setWorkoutsPerWeek(option.value);
                        }}
                        style={{
                          borderRadius: 16,
                          paddingVertical: 16,
                          paddingHorizontal: 18,
                          borderWidth: isSelected ? 2.5 : 2,
                          backgroundColor: isSelected
                            ? '#3BB273'
                            : '#1F2937',
                          borderColor: isSelected
                            ? '#3BB273'
                            : '#374151',
                          shadowColor: isSelected ? '#3BB273' : '#000',
                          shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                          shadowOpacity: isSelected ? 0.2 : 0.1,
                          shadowRadius: isSelected ? 8 : 4,
                          elevation: isSelected ? 4 : 2,
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <View style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : '#374151',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 14,
                          }}>
                            <Ionicons 
                              name={option.icon as any} 
                              size={24} 
                              color={isSelected ? '#FFFFFF' : option.color} 
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 17,
                                fontWeight: '700',
                                marginBottom: 6,
                                color: isSelected
                                  ? '#FFFFFF'
                                  : theme.colors.text,
                                lineHeight: 22,
                              }}
                            >
                              {option.title}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13.5,
                                lineHeight: 19,
                                color: isSelected
                                  ? 'rgba(255, 255, 255, 0.85)'
                                  : (theme.colors.textSecondary || '#6B7280'),
                              }}
                            >
                              {option.description}
                            </Text>
                          </View>
                          {isSelected && (
                            <View style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: 8,
                            }}>
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      case 'heardFrom':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              {t('onboarding.heardFrom')}
            </Text>
            <ScrollView>
              <View className="space-y-3">
                {[
                  { name: 'Instagram', icon: 'logo-instagram' },
                  { name: 'Facebook', icon: 'logo-facebook' },
                  { name: 'TikTok', icon: 'logo-tiktok' },
                  { name: 'Youtube', icon: 'logo-youtube' },
                  { name: 'Google', icon: 'logo-google' },
                  { name: 'Friends', icon: 'people-outline' },
                  { name: 'Other', icon: 'ellipsis-horizontal-outline' },
                ].map((source, index) => {
                  const anim = optionAnimations[index] || new Animated.Value(0);
                  // Garantir que sempre começa invisível
                  if (!optionAnimations[index]) {
                    anim.setValue(0);
                  }
                  const opacity = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  });
                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  });
                  return (
                    <Animated.View
                      key={source.name}
                      style={{
                        opacity,
                        transform: [{ translateY }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setHeardFrom(source.name);
                        }}
                        className={`rounded-xl py-5 px-6 border-2 flex-row items-center mb-3 ${
                          heardFrom === source.name
                            ? 'bg-green-500 border-green-500'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                        style={{ marginBottom: 12 }}
                      >
                        <Ionicons
                          name={source.icon as any}
                          size={24}
                          color={heardFrom === source.name ? '#FFFFFF' : '#9CA3AF'}
                        />
                        <Text
                          className={`text-lg font-semibold ml-4 ${
                            heardFrom === source.name
                              ? 'text-white'
                              : 'text-white'
                          }`}
                        >
                          {source.name}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      case 'triedOtherApps':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              📱 {t('onboarding.triedOtherApps')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View className="space-y-4">
                {[
                  { value: false, label: t('onboarding.triedOtherApps.no') },
                  { value: true, label: t('onboarding.triedOtherApps.yes') },
                ].map((option, index) => {
                  const anim = optionAnimations[index] || new Animated.Value(0);
                  // Garantir que sempre começa invisível
                  if (!optionAnimations[index]) {
                    anim.setValue(0);
                  }
                  const opacity = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  });
                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  });
                  return (
                    <Animated.View
                      key={option.label}
                      style={{
                        opacity,
                        transform: [{ translateY }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setTriedOtherApps(option.value);
                        }}
                        className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                          triedOtherApps === option.value
                            ? 'bg-green-500 border-green-500'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                        style={{ marginBottom: 12 }}
                      >
                        <Text
                          className={`text-lg font-semibold text-center ${
                            triedOtherApps === option.value
                              ? 'text-white'
                              : 'text-white'
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 'height':
        // Converter altura para display
        const heightDisplay = isImperial 
          ? `${Math.floor(heightCm / 30.48)}'${Math.round((heightCm % 30.48) / 2.54)}"`
          : `${heightCm} cm`;
        
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              📏 {t('onboarding.heightQuestion')}
            </Text>
            <Text className="text-gray-400 mb-8">
              {t('onboarding.heightDescription')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {/* Unit Toggle Switch */}
              <View style={{ 
                marginBottom: 32,
                alignItems: 'center',
              }}>
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: '#374151',
                  borderRadius: 30,
                  padding: 4,
                  width: 200,
                  position: 'relative',
                }}>
                  <TouchableOpacity
                    onPress={() => setIsImperial(false)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: !isImperial 
                        ? '#FFFFFF' 
                        : '#9CA3AF',
                    }}>
                      {t('onboarding.metric') || 'Métrico'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setIsImperial(true);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isImperial 
                        ? '#FFFFFF' 
                        : '#9CA3AF',
                    }}>
                      {t('onboarding.imperial') || 'Imperial'}
                    </Text>
                  </TouchableOpacity>
                  <Animated.View style={{
                    position: 'absolute',
                    left: switchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 96], // 50% of 200px - 4px padding = 96px
                    }),
                    top: 4,
                    bottom: 4,
                    width: 96, // 48% of 200px
                    backgroundColor: '#3BB273',
                    borderRadius: 26,
                    zIndex: 1,
                  }} />
                </View>
              </View>

            {/* Display Value with +/- buttons */}
            <View className="items-center mb-8">
              <View className="flex-row items-center justify-center">
                <TouchableOpacity
                  onPress={() => {
                    // Se há texto temporário, usar esse valor primeiro
                    let currentValue = heightCm;
                    if (heightText !== '') {
                      const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                      if (!isNaN(num) && num >= 120 && num <= 220) {
                        currentValue = num;
                        setHeightCm(num);
                      }
                    }
                    // Se ainda for 0, usar padrão
                    if (currentValue === 0) currentValue = 175;
                    const newValue = Math.max(120, currentValue - 1);
                    setHeightCm(newValue);
                    setHeightIsEmpty(false);
                    setHeightText(''); // Limpar texto temporário
                  }}
                  className="bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={24} color="#3BB273" />
                </TouchableOpacity>
                
                <TextInput
                  className="text-6xl font-bold text-green-500 text-center min-w-[200px]"
                  value={heightText !== '' ? heightText : (heightIsEmpty ? '' : (isImperial ? `${Math.floor(heightCm / 30.48)}'${Math.round((heightCm % 30.48) / 2.54)}"` : `${heightCm}`))}
                  onChangeText={(text) => {
                    // Guardar texto temporário para permitir edição livre
                    setHeightText(text);
                    if (text === '') {
                      setHeightIsEmpty(true);
                    } else {
                      setHeightIsEmpty(false);
                    }
                  }}
                  onBlur={() => {
                    // Validar e atualizar quando perder o foco
                    if (heightText === '') {
                      // Se estiver vazio, manter vazio e desabilitar
                      setHeightIsEmpty(true);
                      setHeightCm(0);
                      setHeightText('');
                      return;
                    }
                    
                    let newHeightCm = 0; // Começar com 0 (inválido)
                    
                    if (isImperial) {
                      // Parse ft'in" format
                      const cleanText = heightText.replace(/[^0-9'"]/g, '');
                      let feet = 0;
                      let inches = 0;
                      
                      const match1 = cleanText.match(/(\d+)'(\d+)/);
                      if (match1) {
                        feet = parseInt(match1[1]) || 0;
                        inches = parseInt(match1[2]) || 0;
                      } else {
                        const num = parseInt(cleanText);
                        if (!isNaN(num)) {
                          if (num >= 40 && num <= 84) {
                            feet = Math.floor(num / 10);
                            inches = num % 10;
                          } else if (num >= 4 && num <= 7) {
                            feet = num;
                            inches = 0;
                          }
                        }
                      }
                      
                      if (feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
                        const totalCm = feet * 30.48 + inches * 2.54;
                        if (totalCm >= 120 && totalCm <= 220) {
                          newHeightCm = Math.round(totalCm);
                        }
                      }
                    } else {
                      // Parse cm
                      const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                      if (!isNaN(num) && num >= 120 && num <= 220) {
                        newHeightCm = num;
                      }
                    }
                    
                    // Atualizar (se inválido, fica 0 e botão desabilitado)
                    setHeightCm(newHeightCm);
                    setHeightIsEmpty(newHeightCm === 0);
                    setHeightText('');
                  }}
                  keyboardType={isImperial ? "default" : "numeric"}
                  selectTextOnFocus={false}
                />
                
                <TouchableOpacity
                  onPress={() => {
                    // Se há texto temporário, usar esse valor primeiro
                    let currentValue = heightCm;
                    if (heightText !== '') {
                      const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                      if (!isNaN(num) && num >= 120 && num <= 220) {
                        currentValue = num;
                        setHeightCm(num);
                      }
                    }
                    // Se ainda for 0, usar padrão
                    if (currentValue === 0) currentValue = 175;
                    const newValue = Math.min(220, currentValue + 1);
                    setHeightCm(newValue);
                    setHeightIsEmpty(false);
                    setHeightText(''); // Limpar texto temporário
                  }}
                  className="bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#3BB273" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-400 mt-2">
                {isImperial ? "ft'in\"" : "cm"}
              </Text>
            </View>

              {/* Slider */}
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={120}
                maximumValue={220}
                step={1}
                value={heightCm}
                onValueChange={(value) => {
                  triggerHaptic();
                  setHeightCm(Math.round(value));
                }}
                minimumTrackTintColor="#3BB273"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#3BB273"
              />

              {/* Min/Max Labels */}
              <View className="flex-row justify-between mt-2">
                <Text className="text-gray-400">
                  {isImperial ? "4'0\"" : '120 cm'}
                </Text>
                <Text className="text-gray-400">
                  {isImperial ? "7'0\"" : '220 cm'}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'weight':
        // Converter peso para display
        const weightDisplay = isImperial
          ? `${Math.round(weightKg * 2.20462)} lbs`
          : `${weightKg} kg`;
        
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              ⚖️ {t('onboarding.weightQuestion')}
            </Text>
            <Text className="text-gray-400 mb-8">
              {t('onboarding.weightDescription')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {/* Unit Toggle Switch */}
              <View style={{ 
                marginBottom: 32,
                alignItems: 'center',
              }}>
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: '#374151',
                  borderRadius: 30,
                  padding: 4,
                  width: 200,
                  position: 'relative',
                }}>
                  <TouchableOpacity
                    onPress={() => setIsImperial(false)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: !isImperial 
                        ? '#FFFFFF' 
                        : '#9CA3AF',
                    }}>
                      {t('onboarding.metric') || 'Métrico'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic();
                      setIsImperial(true);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isImperial 
                        ? '#FFFFFF' 
                        : '#9CA3AF',
                    }}>
                      {t('onboarding.imperial') || 'Imperial'}
                    </Text>
                  </TouchableOpacity>
                  <Animated.View style={{
                    position: 'absolute',
                    left: switchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 96], // 50% of 200px - 4px padding = 96px
                    }),
                    top: 4,
                    bottom: 4,
                    width: 96, // 48% of 200px
                    backgroundColor: '#3BB273',
                    borderRadius: 26,
                    zIndex: 1,
                  }} />
                </View>
              </View>

            {/* Display Value with +/- buttons */}
            <View className="items-center mb-8">
              <View className="flex-row items-center justify-center">
                <TouchableOpacity
                  onPress={() => {
                    // Se há texto temporário, usar esse valor primeiro
                    let currentValue = weightKg;
                    if (weightText !== '') {
                      const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                      if (!isNaN(num)) {
                        if (isImperial) {
                          const kg = num / 2.20462;
                          if (kg >= 30 && kg <= 200) {
                            currentValue = Math.round(kg * 2) / 2;
                            setWeightKg(currentValue);
                          }
                        } else {
                          if (num >= 30 && num <= 200) {
                            currentValue = Math.round(num * 2) / 2;
                            setWeightKg(currentValue);
                          }
                        }
                      }
                    }
                    // Se ainda for 0, usar padrão
                    if (currentValue === 0) currentValue = 70;
                    const newValue = Math.max(30, currentValue - 0.5);
                    setWeightKg(Math.round(newValue * 2) / 2);
                    setWeightIsEmpty(false);
                    setWeightText(''); // Limpar texto temporário
                  }}
                  className="bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={24} color="#3BB273" />
                </TouchableOpacity>
                
                <TextInput
                  className="text-6xl font-bold text-green-500 text-center min-w-[200px]"
                  value={weightText !== '' ? weightText : (weightIsEmpty ? '' : (isImperial ? `${Math.round(weightKg * 2.20462)}` : `${weightKg}`))}
                  onChangeText={(text) => {
                    // Guardar texto temporário para permitir edição livre
                    setWeightText(text);
                    if (text === '') {
                      setWeightIsEmpty(true);
                    } else {
                      setWeightIsEmpty(false);
                    }
                  }}
                  onBlur={() => {
                    // Validar e atualizar quando perder o foco
                    if (weightText === '') {
                      // Se estiver vazio, manter vazio e desabilitar
                      setWeightIsEmpty(true);
                      setWeightKg(0);
                      setWeightText('');
                      return;
                    }
                    
                    let newWeightKg = 0; // Começar com 0 (inválido)
                    const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                    
                    if (!isNaN(num)) {
                      if (isImperial) {
                        // Convert lbs to kg
                        const kg = num / 2.20462;
                        if (kg >= 30 && kg <= 200) {
                          newWeightKg = Math.round(kg * 2) / 2;
                        }
                      } else {
                        // Direct kg input
                        if (num >= 30 && num <= 200) {
                          newWeightKg = Math.round(num * 2) / 2;
                        }
                      }
                    }
                    
                    // Atualizar (se inválido, fica 0 e botão desabilitado)
                    setWeightKg(newWeightKg);
                    setWeightIsEmpty(newWeightKg === 0);
                    setWeightText('');
                  }}
                  keyboardType="numeric"
                  selectTextOnFocus={false}
                />
                
                <TouchableOpacity
                  onPress={() => {
                    // Se há texto temporário, usar esse valor primeiro
                    let currentValue = weightKg;
                    if (weightText !== '') {
                      const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                      if (!isNaN(num)) {
                        if (isImperial) {
                          const kg = num / 2.20462;
                          if (kg >= 30 && kg <= 200) {
                            currentValue = Math.round(kg * 2) / 2;
                            setWeightKg(currentValue);
                          }
                        } else {
                          if (num >= 30 && num <= 200) {
                            currentValue = Math.round(num * 2) / 2;
                            setWeightKg(currentValue);
                          }
                        }
                      }
                    }
                    // Se ainda for 0, usar padrão
                    if (currentValue === 0) currentValue = 70;
                    const newValue = Math.min(200, currentValue + 0.5);
                    setWeightKg(Math.round(newValue * 2) / 2);
                    setWeightIsEmpty(false);
                    setWeightText(''); // Limpar texto temporário
                  }}
                  className="bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#3BB273" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-400 mt-2">
                {isImperial ? "lbs" : "kg"}
              </Text>
            </View>

              {/* Slider */}
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={30}
                maximumValue={200}
                step={0.5}
                value={weightKg}
                onValueChange={(value) => {
                  triggerHaptic();
                  setWeightKg(Math.round(value * 2) / 2);
                }}
                minimumTrackTintColor="#3BB273"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#3BB273"
              />

              {/* Min/Max Labels */}
              <View className="flex-row justify-between mt-2">
                <Text className="text-gray-400">
                  {isImperial ? '66 lbs' : '30 kg'}
                </Text>
                <Text className="text-gray-400">
                  {isImperial ? '440 lbs' : '200 kg'}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'age':
        const ageNum = parseInt(age) || 18;
        
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              🎂 {t('onboarding.ageQuestion')}
            </Text>
            <Text className="text-gray-400 mb-8">
              {t('onboarding.ageDescription')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              {/* Display Value with +/- buttons */}
              <View className="items-center mb-8">
              <View className="flex-row items-center justify-center">
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    const newValue = Math.max(18, ageNum - 1);
                    setAge(newValue.toString());
                  }}
                  className="bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={24} color="#3BB273" />
                </TouchableOpacity>
                
                <TextInput
                  className="text-6xl font-bold text-green-500 text-center min-w-[150px]"
                  value={age}
                  onChangeText={(text) => {
                    // Apenas permitir números
                    const numericValue = text.replace(/[^0-9]/g, '');
                    if (numericValue === '' || (parseInt(numericValue) >= 18 && parseInt(numericValue) <= 150)) {
                      setAge(numericValue);
                    } else if (numericValue !== '' && parseInt(numericValue) < 18) {
                      // Se tentar meter menos de 18, definir como 18
                      setAge('18');
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                  selectTextOnFocus={false}
                />
                
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    const newValue = Math.min(150, ageNum + 1);
                    setAge(newValue.toString());
                  }}
                  className="bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#3BB273" />
                </TouchableOpacity>
              </View>
                <Text className="text-gray-400 mt-2">
                  {t('onboarding.yearsOld')}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'goal':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              🎯 {t('onboarding.goal')}
            </Text>
            <Text className="text-gray-400 mb-8">
              {t('onboarding.goalDescription')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View className="space-y-4">
                {([
                  { value: 'lose', label: t('onboarding.goal.lose') },
                  { value: 'maintain', label: t('onboarding.goal.maintain') },
                  { value: 'gain', label: t('onboarding.goal.gain') },
                ] as const).map((option, index) => {
                  const anim = optionAnimations[index] || new Animated.Value(0);
                  // Garantir que sempre começa invisível
                  if (!optionAnimations[index]) {
                    anim.setValue(0);
                  }
                  const opacity = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  });
                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  });
                  return (
                    <Animated.View
                      key={option.value}
                      style={{
                        opacity,
                        transform: [{ translateY }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setGoal(option.value);
                        }}
                        className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                          goal === option.value
                            ? 'bg-green-500 border-green-500'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                        style={{ marginBottom: 12 }}
                      >
                        <Text
                          className={`text-lg font-semibold text-center ${
                            goal === option.value
                              ? 'text-white'
                              : 'text-white'
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 'goalSpeed':
        // Se o goal é 'maintain', não mostrar este step (deve ter sido pulado)
        if (goal === 'maintain') {
          return null;
        }

        // Valores do slider em kg (sempre trabalhar em kg internamente)
        const minSpeedKg = 0.1; // 0.1 kg por semana
        const maxSpeedKg = goal === 'gain' ? 3.0 : 2.0; // Ganhar: até 3kg/semana, Perder: até 2kg/semana
        const recommendedSpeedKg = goal === 'gain' ? 0.5 : 0.5; // 0.5 kg/semana recomendado

        // Converter para display baseado na unidade
        const displaySpeed = isImperial ? goalSpeed * 2.20462 : goalSpeed;
        const displayUnit = isImperial ? 'lbs' : 'kg';
        const minDisplay = isImperial ? minSpeedKg * 2.20462 : minSpeedKg;
        const maxDisplay = isImperial ? maxSpeedKg * 2.20462 : maxSpeedKg;
        const recommendedDisplay = isImperial ? recommendedSpeedKg * 2.20462 : recommendedSpeedKg;

        // Valores para os ícones (slow, moderate, fast)
        const slowSpeed = minSpeedKg + (maxSpeedKg - minSpeedKg) * 0.2;
        const moderateSpeed = minSpeedKg + (maxSpeedKg - minSpeedKg) * 0.5;
        const fastSpeed = minSpeedKg + (maxSpeedKg - minSpeedKg) * 0.8;

        const slowDisplay = isImperial ? slowSpeed * 2.20462 : slowSpeed;
        const moderateDisplay = isImperial ? moderateSpeed * 2.20462 : moderateSpeed;
        const fastDisplay = isImperial ? fastSpeed * 2.20462 : fastSpeed;

        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              ⚡ {t('onboarding.goalSpeed.title')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8 text-left">
              {goal === 'gain' 
                ? t('onboarding.goalSpeed.descriptionGain')
                : t('onboarding.goalSpeed.descriptionLose')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: '100%', alignItems: 'center' }}>
                {/* Valor atual */}
                <Text style={{
                  fontSize: 48,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: 40,
                }}>
                  {displaySpeed.toFixed(1)} {displayUnit}
                </Text>

                {/* Slider com ícones */}
                <View style={{ width: '100%', marginBottom: 20 }}>
                  {/* Ícones acima do slider */}
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    marginBottom: 10,
                  }}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Text style={{ fontSize: 24 }}>🐌</Text>
                      <Text style={{ 
                        fontSize: 12, 
                        color: theme.colors.textSecondary,
                        marginTop: 4,
                      }}>
                        {slowDisplay.toFixed(1)} {displayUnit}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Text style={{ fontSize: 24 }}>🐸</Text>
                      <Text style={{ 
                        fontSize: 12, 
                        color: theme.colors.textSecondary,
                        marginTop: 4,
                      }}>
                        {moderateDisplay.toFixed(1)} {displayUnit}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Text style={{ fontSize: 24 }}>🐆</Text>
                      <Text style={{ 
                        fontSize: 12, 
                        color: theme.colors.textSecondary,
                        marginTop: 4,
                      }}>
                        {fastDisplay.toFixed(1)} {displayUnit}
                      </Text>
                    </View>
                  </View>

                  {/* Slider simples */}
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={minSpeedKg}
                    maximumValue={maxSpeedKg}
                    value={goalSpeed}
                    onValueChange={(value) => {
                      triggerHaptic();
                      setGoalSpeed(value);
                    }}
                    minimumTrackTintColor="#3BB273"
                    maximumTrackTintColor="#374151"
                    thumbTintColor="#3BB273"
                    step={0.1}
                  />
                </View>

                {/* Botão Recommended */}
                <TouchableOpacity
                  onPress={() => {
                    triggerHaptic();
                    setGoalSpeed(recommendedSpeedKg);
                  }}
                  style={{
                    backgroundColor: '#374151',
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 20,
                    marginTop: 10,
                  }}
                >
                  <Text style={{
                    color: theme.colors.text,
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                    {t('onboarding.goalSpeed.recommended')} ({recommendedDisplay.toFixed(1)} {displayUnit})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 'diet':
        const dietOptions = [
          { value: 'classic' as const, title: t('onboarding.diet.classic.title'), description: t('onboarding.diet.classic.description'), icon: 'restaurant-outline', color: '#3BB273' },
          { value: 'pescatarian' as const, title: t('onboarding.diet.pescatarian.title'), description: t('onboarding.diet.pescatarian.description'), icon: 'fish-outline', color: '#60A5FA' },
          { value: 'vegetarian' as const, title: t('onboarding.diet.vegetarian.title'), description: t('onboarding.diet.vegetarian.description'), icon: 'leaf-outline', color: '#34D399' },
          { value: 'vegan' as const, title: t('onboarding.diet.vegan.title'), description: t('onboarding.diet.vegan.description'), icon: 'flower-outline', color: '#A78BFA' },
        ];
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              🥗 {t('onboarding.diet.title')}
            </Text>
            <Text className="text-gray-400 mb-6">
              {t('onboarding.diet.description')}
            </Text>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ gap: 12 }}>
                {dietOptions.map((option, index) => {
                  const anim = optionAnimations[index] || new Animated.Value(0);
                  // Garantir que sempre começa invisível
                  if (!optionAnimations[index]) {
                    anim.setValue(0);
                  }
                  const opacity = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  });
                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  });
                  const isSelected = diet === option.value;
                  return (
                    <Animated.View
                      key={option.value}
                      style={{
                        opacity,
                        transform: [{ translateY }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          triggerHaptic();
                          setDiet(option.value);
                        }}
                        style={{
                          borderRadius: 16,
                          paddingVertical: 16,
                          paddingHorizontal: 18,
                          borderWidth: isSelected ? 2.5 : 2,
                          backgroundColor: isSelected
                            ? '#3BB273'
                            : '#1F2937',
                          borderColor: isSelected
                            ? '#3BB273'
                            : '#374151',
                          shadowColor: isSelected ? '#3BB273' : '#000',
                          shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                          shadowOpacity: isSelected ? 0.2 : 0.1,
                          shadowRadius: isSelected ? 8 : 4,
                          elevation: isSelected ? 4 : 2,
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <View style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : '#374151',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 14,
                          }}>
                            <Ionicons 
                              name={option.icon as any} 
                              size={24} 
                              color={isSelected ? '#FFFFFF' : option.color} 
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 17,
                                fontWeight: '700',
                                marginBottom: 6,
                                color: isSelected
                                  ? '#FFFFFF'
                                  : theme.colors.text,
                                lineHeight: 22,
                              }}
                            >
                              {option.title}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13.5,
                                lineHeight: 19,
                                color: isSelected
                                  ? 'rgba(255, 255, 255, 0.85)'
                                  : (theme.colors.textSecondary || '#6B7280'),
                              }}
                            >
                              {option.description}
                            </Text>
                          </View>
                          {isSelected && (
                            <View style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: 8,
                            }}>
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 'desiredWeight':
        // Se o goal é 'maintain', não mostrar este step (deve ter sido pulado)
        if (goal === 'maintain') {
          return null;
        }
        
        // Peso atual já está em kg (do slider)
        // IMPORTANTE: weightKg sempre guarda em kg, independente da unidade usada para input
        // Se weightKg for 0, significa que o campo está vazio (não deveria chegar aqui se validação funcionou)
        const currentWeightValue = weightKg; // kg - usar valor real
        // Converter para display baseado na unidade selecionada no momento
        const currentWeightDisplay = isImperial 
          ? (currentWeightValue * 2.20462).toFixed(1) 
          : currentWeightValue.toFixed(1);
        
        // Determinar mensagem e validação baseado no goal
        // Converter desiredWeight para kg para comparação
        let desiredWeightNumKg: number;
        if (isImperial) {
          desiredWeightNumKg = parseFloat(desiredWeight) * 0.453592; // converter lbs para kg
        } else {
          desiredWeightNumKg = parseFloat(desiredWeight);
        }
        
        let isValidWeight = false;
        let hintText = '';
        
        if (goal === 'gain') {
          isValidWeight = !isNaN(desiredWeightNumKg) && desiredWeightNumKg > currentWeightValue;
          hintText = t('onboarding.desiredWeightHintGain').replace('{weight}', currentWeightDisplay).replace('{unit}', isImperial ? 'lbs' : 'kg');
        } else if (goal === 'lose') {
          isValidWeight = !isNaN(desiredWeightNumKg) && desiredWeightNumKg < currentWeightValue;
          hintText = t('onboarding.desiredWeightHintLose').replace('{weight}', currentWeightDisplay).replace('{unit}', isImperial ? 'lbs' : 'kg');
        }
        
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-white mb-2">
              🎯 {t('onboarding.desiredWeightQuestion')}
            </Text>
            <Text className="text-gray-400 mb-2">
              {t('onboarding.currentWeight')}: {currentWeightDisplay} {isImperial ? 'lbs' : 'kg'}
            </Text>
            {hintText !== '' && (
              <Text className="text-gray-500 mb-6 text-sm">
                {hintText}
              </Text>
            )}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <TextInput
                className={`bg-gray-800 rounded-xl px-4 py-4 text-white border-2 text-2xl text-center ${
                  desiredWeight && !isValidWeight
                    ? 'border-red-500'
                    : 'border-gray-700'
                }`}
                placeholder={isImperial ? "165.0" : "75.0"}
                value={desiredWeight}
                onChangeText={(text) => {
                  // Permitir apenas números e ponto decimal
                  const numericValue = text.replace(/[^0-9.]/g, '');
                  setDesiredWeight(numericValue);
                }}
                keyboardType="numeric"
              />
              {desiredWeight && !isValidWeight && (
                <Text className="mt-2 text-center text-red-500 text-sm">
                  {goal === 'gain' 
                    ? t('onboarding.desiredWeightErrorGain').replace('{weight}', currentWeightDisplay).replace('{unit}', isImperial ? 'lbs' : 'kg')
                    : t('onboarding.desiredWeightErrorLose').replace('{weight}', currentWeightDisplay).replace('{unit}', isImperial ? 'lbs' : 'kg')
                  }
                </Text>
              )}
              <Text className="mt-2 text-center text-gray-400">
                {isImperial ? 'lbs' : 'kg'}
              </Text>
            </View>
          </View>
        );

      case 'notifications':
        const requestNotificationPermission = async () => {
          try {
            setRequestingPermission(true);
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            
            if (existingStatus !== 'granted') {
              const { status } = await Notifications.requestPermissionsAsync();
              finalStatus = status;
            }
            
            if (finalStatus === 'granted') {
              setNotificationsEnabled(true);
              // Auto-enable both reminders when permission is granted
              await applyReminderPreference('meal', true);
              await applyReminderPreference('water', true);
              setMealReminderEnabled(true);
              setWaterReminderEnabled(true);
              Toast.show({
                type: 'success',
                text1: t('onboarding.notifications.enabled'),
                text2: t('onboarding.notifications.enabledMessage'),
              });
            } else {
              setNotificationsEnabled(false);
              setMealReminderEnabled(false);
              setWaterReminderEnabled(false);
              Toast.show({
                type: 'info',
                text1: t('onboarding.notifications.denied'),
                text2: t('onboarding.notifications.deniedMessage'),
              });
            }
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: t('onboarding.notifications.error'),
              text2: t('onboarding.notifications.errorMessage'),
            });
          } finally {
            setRequestingPermission(false);
          }
        };

        return (
          <View className="flex-1 px-6">
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ alignItems: 'center', marginBottom: 48 }}>
                <View style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: '#3BB273' + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}>
                  <Ionicons 
                    name={notificationsEnabled ? "notifications" : "notifications-outline"} 
                    size={64} 
                    color="#3BB273" 
                  />
                </View>
                <Text style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: theme.colors.text,
                  marginBottom: 12,
                  textAlign: 'center',
                }}>
                  {t('onboarding.notifications.title')}
                </Text>
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  textAlign: 'center',
                  paddingHorizontal: 20,
                  lineHeight: 24,
                }}>
                  {t('onboarding.notifications.description')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={requestNotificationPermission}
                disabled={requestingPermission || notificationsEnabled}
                style={{
                  backgroundColor: notificationsEnabled 
                    ? '#10B981' 
                    : (requestingPermission ? '#9CA3AF' : '#3BB273'),
                  borderRadius: 16,
                  paddingVertical: 18,
                  paddingHorizontal: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#3BB273',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                  opacity: requestingPermission ? 0.7 : 1,
                }}
              >
                {requestingPermission ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons 
                      name={notificationsEnabled ? "checkmark-circle" : "notifications-outline"} 
                      size={24} 
                      color="#FFFFFF" 
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: '#FFFFFF',
                    }}>
                      {notificationsEnabled 
                        ? t('onboarding.notifications.enabledButton')
                        : t('onboarding.notifications.enableButton')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {notificationsEnabled && (
                <Text style={{
                  fontSize: 14,
                  color: '#10B981',
                  textAlign: 'center',
                  marginTop: 16,
                  fontWeight: '600',
                }}>
                  {t('onboarding.notifications.success')}
                </Text>
              )}

              <View style={{ marginTop: 24, gap: 8 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: theme.colors.text,
                  textAlign: 'left',
                }}>
                  {t('onboarding.notifications.remindersTitle')}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  lineHeight: 20,
                }}>
                  {t('onboarding.notifications.remindersSubtitle')}
                </Text>

                <View style={{ marginTop: 12, gap: 10 }}>
                  {[{
                    key: 'meal' as const,
                    title: t('preferences.mealReminders'),
                    icon: 'restaurant',
                    enabled: mealReminderEnabled,
                    loading: togglingMealReminder,
                  }, {
                    key: 'water' as const,
                    title: t('preferences.waterReminders'),
                    icon: 'water',
                    enabled: waterReminderEnabled,
                    loading: togglingWaterReminder,
                  }].map((reminder) => (
                    <Pressable
                      key={reminder.key}
                      onPress={() => handleToggleReminder(reminder.key)}
                      disabled={reminder.loading || !notificationsEnabled}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        borderRadius: 14,
                        backgroundColor: theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.border || '#334155',
                        opacity: notificationsEnabled ? 1 : 0.5,
                      }}
                    >
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#3BB273' + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}>
                        <Ionicons name={reminder.icon as any} size={18} color="#3BB273" />
                      </View>
                      <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
                        {reminder.title}
                      </Text>
                      {reminder.loading ? (
                        <ActivityIndicator color="#3BB273" />
                      ) : (
                        <View style={{
                          width: 46,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: reminder.enabled ? '#10B981' : (theme.colors.border || '#334155'),
                          padding: 4,
                          justifyContent: 'center',
                        }}>
                          <View style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: '#FFFFFF',
                            transform: [{ translateX: reminder.enabled ? 18 : 0 }],
                          }} />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>

                {!notificationsEnabled && (
                  <Text style={{
                    fontSize: 13,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginTop: 8,
                  }}>
                    {t('onboarding.notifications.permissionNeeded')}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleNext}
                style={{
                  marginTop: 24,
                  paddingVertical: 12,
                }}
              >
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  textAlign: 'center',
                  textDecorationLine: 'underline',
                }}>
                  {t('onboarding.notifications.skip')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'calorieGoal':
        const macros = calculatedMacros;

        if (calculating || !macros) {
          const progressWidth = progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          });

          return (
            <View className="flex-1 px-6 items-center justify-center">
              <View style={{ width: '100%', marginBottom: 32 }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: 8,
                  textAlign: 'center',
                }}>
                  {t('onboarding.calculating')}
                </Text>
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  marginBottom: 24,
                  textAlign: 'center',
                }}>
                  {t('onboarding.calculatingDescription')}
                </Text>
                
                {/* Progress Bar Container */}
                <View style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}>
                  <Animated.View style={{
                    height: '100%',
                    width: progressWidth,
                    backgroundColor: theme.colors.primary || '#3BB273',
                    borderRadius: 4,
                  }} />
                </View>
                
                {/* Percentagem */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.primary || '#3BB273',
                    textAlign: 'center',
                  }}>
                    {progressPercent}
                  </Text>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.primary || '#3BB273',
                    marginLeft: 2,
                  }}>%</Text>
                </View>
                
                {/* Checklist */}
                <View style={{ width: '100%' }}>
                  {[
                    t('onboarding.calculating.step1') || 'Calculating BMR',
                    t('onboarding.calculating.step2') || 'Calculating TDEE',
                    t('onboarding.calculating.step3') || 'Adjusting for goal',
                    t('onboarding.calculating.step4') || 'Calculating macros',
                    t('onboarding.calculating.step5') || 'Finalizing plan',
                  ].map((step, index) => {
                    const isCompleted = calculationSteps.includes(step);
                    return (
                      <View
                        key={index}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginBottom: 12,
                          opacity: isCompleted ? 1 : 0.5,
                        }}
                      >
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: isCompleted ? '#3BB273' : '#374151',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          {isCompleted && (
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          )}
                        </View>
                        <Text style={{
                          fontSize: 16,
                          color: theme.colors.text,
                          fontWeight: isCompleted ? '600' : '400',
                        }}>
                          {step}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        }

        return (
          <View className="flex-1 px-6">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 20 }}>
              <Text style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: theme.colors.text,
                marginBottom: 8,
                textAlign: 'center',
              }}>
                {t('onboarding.calorieGoal')}
              </Text>
              <Text style={{
                fontSize: 16,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 32,
                textAlign: 'center',
              }}>
                {t('onboarding.calorieGoalDescription')}
              </Text>

              {/* Calorias Principais */}
              <View style={{
                backgroundColor: '#3BB273',
                borderRadius: 24,
                padding: 32,
                marginBottom: 24,
                alignItems: 'center',
                shadowColor: '#3BB273',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
                position: 'relative',
              }}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMacro('calories');
                    setEditValue(macros.calories.toString());
                  }}
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={{
                  fontSize: 72,
                  fontWeight: '900',
                  color: '#FFFFFF',
                  marginBottom: 8,
                }}>
                  {macros.calories}
                </Text>
                <Text style={{
                  fontSize: 20,
                  color: '#FFFFFF',
                  opacity: 0.95,
                  fontWeight: '600',
                }}>
                  {t('onboarding.kcalPerDay')}
                </Text>
              </View>

              {/* Card de Estimativa de Peso */}
              {goal !== 'maintain' && (() => {
                const desiredWeightKgValue = (() => {
                  if (!desiredWeight) {
                    return weightKg;
                  }
                  const parsed = parseFloat(desiredWeight);
                  if (isNaN(parsed)) {
                    return weightKg;
                  }
                  return isImperial ? parsed * 0.453592 : parsed;
                })();

                const weightDifference = goal === 'lose' 
                  ? weightKg - desiredWeightKgValue 
                  : desiredWeightKgValue - weightKg;

                // Calcular a velocidade efetiva baseada nas calorias editadas
                // Se as calorias foram editadas, recalcular a velocidade de ganho/perda
                let effectiveGoalSpeed = goalSpeed;
                const maintenanceCalories = calculatedMacros?.maintenanceCalories || calculatedMacros?.tdee;
                if (maintenanceCalories) {
                  const currentCalories = macros.calories;
                  const calorieDifference = currentCalories - maintenanceCalories;
                  
                  // 1 kg de gordura = ~7700 kcal, então para perder/ganhar X kg/semana = X * 7700 / 7 = X * 1100 kcal/dia
                  // Portanto, velocidade = diferença calórica / 1100
                  // Para perder: déficit negativo, então velocidade é positiva
                  // Para ganhar: superávit positivo, então velocidade é positiva
                  const calculatedSpeed = Math.abs(calorieDifference) / 1100;
                  
                  // Se a diferença for significativa (mais de 50 kcal), usar a velocidade calculada
                  if (Math.abs(calorieDifference) > 50) {
                    effectiveGoalSpeed = Math.min(calculatedSpeed, goal === 'lose' ? 2.0 : 3.0); // Limitar velocidade máxima
                    effectiveGoalSpeed = Math.max(effectiveGoalSpeed, 0.1); // Velocidade mínima
                  }
                }

                if (weightDifference > 0 && effectiveGoalSpeed > 0) {
                  const weeksNeeded = Math.ceil(weightDifference / effectiveGoalSpeed);
                  const targetDate = new Date();
                  targetDate.setDate(targetDate.getDate() + (weeksNeeded * 7));
                  
                  // Mapear language para locale válido
                  const localeMap: Record<string, string> = {
                    'en': 'en-US',
                    'pt': 'pt-PT',
                    'es': 'es-ES',
                    'fr': 'fr-FR',
                    'de': 'de-DE',
                    'it': 'it-IT',
                  };
                  const locale = localeMap[language] || 'en-US';
                  
                  const formattedDate = targetDate.toLocaleDateString(
                    locale,
                    { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }
                  );

                  const currentWeightDisplay = isImperial 
                    ? Math.round(weightKg * 2.20462) 
                    : Math.round(weightKg);
                  const desiredWeightDisplay = isImperial 
                    ? Math.round(desiredWeightKgValue * 2.20462) 
                    : Math.round(desiredWeightKgValue);
                  const unit = isImperial ? 'lbs' : 'kg';

                  return (
                    <View style={{
                      backgroundColor: '#1F2937',
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 24,
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 2,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="calendar" size={20} color="#3BB273" style={{ marginRight: 8 }} />
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: theme.colors.text,
                        }}>
                          {t('onboarding.targetDate.title') || 'Estimated Target Date'}
                        </Text>
                      </View>
                      
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 4,
                          }}>
                            {t('onboarding.targetDate.date') || 'Target date'}
                          </Text>
                          <Text style={{
                            fontSize: 18,
                            fontWeight: '700',
                            color: '#3BB273',
                          }}>
                            {formattedDate}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 4,
                          }}>
                            {t('onboarding.targetDate.weeks') || 'Weeks needed'}
                          </Text>
                          <Text style={{
                            fontSize: 18,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {weeksNeeded} {t('onboarding.targetDate.weeksShort') || 'weeks'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Macros */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: 16,
                }}>
                  {t('onboarding.macros')}
                </Text>
                <View style={{ gap: 12 }}>
                  {/* Proteína */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.card,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    position: 'relative',
                  }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#EF4444' + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}>
                      <Ionicons name="nutrition" size={24} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 4,
                      }}>
                        {t('onboarding.protein')}
                      </Text>
                      <Text style={{
                        fontSize: 24,
                        fontWeight: '700',
                        color: theme.colors.text,
                      }}>
                        {macros.protein}g
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 14,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginRight: 8,
                    }}>
                      {Math.round((macros.protein * 4 / macros.calories) * 100)}%
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingMacro('protein');
                        setEditValue(macros.protein.toString());
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#374151',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary || '#9CA3AF'} />
                    </TouchableOpacity>
                  </View>

                  {/* Carboidratos */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.card,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    position: 'relative',
                  }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#10B981' + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}>
                      <Ionicons name="fast-food" size={24} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 4,
                      }}>
                        {t('onboarding.carbs')}
                      </Text>
                      <Text style={{
                        fontSize: 24,
                        fontWeight: '700',
                        color: theme.colors.text,
                      }}>
                        {macros.carbs}g
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 14,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginRight: 8,
                    }}>
                      {Math.round((macros.carbs * 4 / macros.calories) * 100)}%
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingMacro('carbs');
                        setEditValue(macros.carbs.toString());
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#374151',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary || '#9CA3AF'} />
                    </TouchableOpacity>
                  </View>

                  {/* Gordura */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.card,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    position: 'relative',
                  }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#EAB308' + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}>
                      <Ionicons name="flame" size={24} color="#EAB308" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 4,
                      }}>
                        {t('onboarding.fat')}
                      </Text>
                      <Text style={{
                        fontSize: 24,
                        fontWeight: '700',
                        color: theme.colors.text,
                      }}>
                        {macros.fat}g
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 14,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginRight: 8,
                    }}>
                      {Math.round((macros.fat * 9 / macros.calories) * 100)}%
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingMacro('fat');
                        setEditValue(macros.fat.toString());
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#374151',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary || '#9CA3AF'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Modal de Edição */}
              <Modal
                visible={editingMacro !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                  setEditingMacro(null);
                  setEditValue('');
                }}
              >
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setEditingMacro(null);
                    setEditValue('');
                  }}
                >
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{
                      width: '100%',
                      padding: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Pressable
                      onPress={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: theme.colors.card,
                        borderRadius: 20,
                        padding: 24,
                        width: '100%',
                        maxWidth: 400,
                        borderWidth: 1,
                        borderColor: theme.colors.border || '#E5E7EB',
                      }}
                    >
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: theme.colors.text,
                      marginBottom: 8,
                    }}>
                      {editingMacro === 'calories' && t('onboarding.kcalPerDay')}
                      {editingMacro === 'protein' && t('onboarding.protein')}
                      {editingMacro === 'carbs' && t('onboarding.carbs')}
                      {editingMacro === 'fat' && t('onboarding.fat')}
                    </Text>
                    <Text style={{
                      fontSize: 14,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginBottom: 16,
                    }}>
                      {editingMacro === 'calories' && 'Enter daily calories'}
                      {editingMacro === 'protein' && 'Enter protein in grams'}
                      {editingMacro === 'carbs' && 'Enter carbs in grams'}
                      {editingMacro === 'fat' && 'Enter fat in grams'}
                    </Text>
                    <TextInput
                      value={editValue}
                      onChangeText={setEditValue}
                      keyboardType="numeric"
                      style={{
                        backgroundColor: '#1F2937',
                        borderRadius: 12,
                        padding: 16,
                        fontSize: 18,
                        color: theme.colors.text,
                        borderWidth: 1,
                        borderColor: theme.colors.border || '#E5E7EB',
                        marginBottom: 20,
                      }}
                      placeholder="0"
                      placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                      autoFocus
                    />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingMacro(null);
                          setEditValue('');
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#374151',
                          borderRadius: 12,
                          padding: 16,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: theme.colors.text,
                        }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const numValue = parseFloat(editValue);
                          if (!isNaN(numValue) && numValue > 0 && calculatedMacros) {
                            const updated = { ...calculatedMacros };
                            if (editingMacro === 'calories') {
                              updated.calories = Math.round(numValue);
                            } else if (editingMacro === 'protein') {
                              updated.protein = Math.round(numValue);
                            } else if (editingMacro === 'carbs') {
                              updated.carbs = Math.round(numValue);
                            } else if (editingMacro === 'fat') {
                              updated.fat = Math.round(numValue);
                            }
                            setCalculatedMacros(updated);
                            if (editingMacro === 'calories') {
                              setCalorieGoal(updated.calories);
                            }
                            setEditingMacro(null);
                            setEditValue('');
                          }
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#3BB273',
                          borderRadius: 12,
                          padding: 16,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#FFFFFF',
                        }}>
                          Save
                        </Text>
                      </TouchableOpacity>
                    </View>
                    </Pressable>
                  </KeyboardAvoidingView>
                </Pressable>
              </Modal>

              {/* Informações Adicionais */}
              <View style={{
                backgroundColor: theme.colors.card,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
              }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: 20,
                }}>
                  {t('onboarding.metabolicInfo')}
                </Text>
                <View style={{ gap: 20 }}>
                  {/* BMR */}
                  <View>
                    <Text style={{
                      fontSize: 13,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginBottom: 8,
                    }}>
                      {t('onboarding.bmr')}
                    </Text>
                    <Text style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}>
                      {macros.bmr} <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary || '#9CA3AF' }}>kcal</Text>
                    </Text>
                  </View>
                  
                  <View style={{
                    height: 1,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                  }} />
                  
                  {/* TDEE */}
                  <View>
                    <Text style={{
                      fontSize: 13,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginBottom: 8,
                    }}>
                      {t('onboarding.tdee')}
                    </Text>
                    <Text style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}>
                      {macros.tdee} <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary || '#9CA3AF' }}>kcal</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        );

      case 'createAccount':
        return (
          <View style={{ 
            flex: 1, 
            paddingHorizontal: 0,
            backgroundColor: 'transparent',
          }}>
            <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 0, paddingBottom: 24 }}>
              <Text style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: theme.colors.text,
                marginBottom: 12,
                textAlign: 'left',
                alignSelf: 'flex-start',
              }}>
                {t('onboarding.createAccountTitle')}
              </Text>
              <View style={{
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: theme.colors.border || '#1f2937',
                paddingVertical: 20,
                paddingHorizontal: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 10,
                alignSelf: 'stretch',
                gap: 14,
                marginTop: 48,
              }}>
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <Text style={{
                    color: theme.colors.text,
                    fontSize: 20,
                    fontWeight: '800',
                    textAlign: 'center',
                  }}>
                    {t('onboarding.createAccountCta') || 'Create your account in seconds'}
                  </Text>

                  <Text style={{
                    color: theme.colors.textSecondary || '#9CA3AF',
                    fontSize: 14,
                    textAlign: 'center',
                    paddingHorizontal: 8,
                  }}>
                    {t('onboarding.privacy') || 'We never post or share without permission.'}
                  </Text>
                </View>

                {/* Google Sign-In */}
                <TouchableOpacity
                  onPress={handleCreateAccountWithGoogle}
                  disabled={loading}
                  style={{
                    backgroundColor: '#101827',
                    borderRadius: 14,
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.2,
                    borderColor: '#2f3c4f',
                    flexDirection: 'row',
                    shadowColor: '#4285F4',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.25,
                    shadowRadius: 18,
                    elevation: 8,
                  }}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#4285F4" size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={22} color="#FFFFFF" />
                      <Text style={{
                        color: '#FFFFFF',
                        fontWeight: '800',
                        marginLeft: 10,
                        fontSize: 17,
                        letterSpacing: 0.3,
                      }}>
                        {t('auth.continueWithGoogle')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed" size={14} color={theme.colors.textSecondary || '#9CA3AF'} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.textSecondary || '#9CA3AF', fontSize: 12 }}>
                    {t('onboarding.googleSecure') || 'Secure Google authentication. No password needed.'}
                  </Text>
                </View>

                {/* Consent: Terms & Privacy */}
                <View style={{ alignItems: 'center', marginTop: 10, paddingHorizontal: 8 }}>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF', textAlign: 'center' }}>
                    {(t('auth.byContinuingAgree') as string) || 'Ao continuar, concordas com os '}
                    <Text
                      style={{ fontSize: 12, color: theme.colors.primary || '#3BB273' }}
                      onPress={() => Linking.openURL('https://nuti.app/terms-and-conditions')}
                    >
                      {t('profile.settings.terms') || 'Termos e Condições'}
                    </Text>
                    {' e '}
                    <Text
                      style={{ fontSize: 12, color: theme.colors.primary || '#3BB273' }}
                      onPress={() => Linking.openURL('https://nuti.app/privacy-policy')}
                    >
                      {t('profile.settings.privacyPolicy') || 'Política de Privacidade'}
                    </Text>
                    {'.'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {renderProgressBar()}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingVertical: 32, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {renderStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      {currentStep !== 'createAccount' && (
        <View className="px-6 pb-6 pt-4 border-t border-gray-700">
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={calculating || loading || creatingAccount}
              className="flex-1 bg-gray-800 rounded-xl py-4 items-center"
              style={{ opacity: (calculating || loading || creatingAccount) ? 0.5 : 1 }}
            >
              <Text className="text-white font-semibold">
                {t('onboarding.back')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!canProceed() || loading || calculating}
              className={`flex-1 rounded-xl py-4 items-center ${
                canProceed() && !loading && !calculating
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              {loading || calculating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white font-semibold">
                  {t('onboarding.continue')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
