/**
 * OnboardingScreen
 * 
 * Fluxo de onboarding para novos utilizadores (antes de criar conta)
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
// import * as Clipboard from 'expo-clipboard';
import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

type OnboardingStep = 
  | 'gender'
  | 'workouts'
  | 'heardFrom'
  | 'triedOtherApps'
  | 'height'
  | 'weight'
  | 'age'
  | 'goal'
  | 'desiredWeight'
  | 'referralCode'
  | 'calorieGoal'
  | 'premium'
  | 'rateApp'
  | 'createAccount';

const TOTAL_STEPS = 14;

export function OnboardingScreen({ navigation: _navigation }: any) {
  // Não usar navigation diretamente, apenas receber como prop para evitar erros
  const { signUp, signInWithGoogleNative, updateProfile, user, profile, refreshProfile } = useUser();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('gender');
  
  const [loading, setLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Form data
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<'0-2' | '3-6' | '6+' | null>(null);
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
  const [desiredWeight, setDesiredWeight] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calculatedMacros, setCalculatedMacros] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    bmr: number;
    tdee: number;
  } | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const stepIndex = {
    gender: 0,
    workouts: 1,
    heardFrom: 2,
    triedOtherApps: 3,
    height: 4,
    weight: 5,
    age: 6,
    goal: 7,
    desiredWeight: 8,
    referralCode: 9,
    calorieGoal: 10,
    premium: 11,
    rateApp: 12,
    createAccount: 13,
  };

  const currentStepIndex = stepIndex[currentStep];
  const progress = (currentStepIndex / (TOTAL_STEPS - 1)) * 100;

  // Calcular meta de calorias e macros
  const calculateCalorieGoal = () => {
    if (!gender || !weightKg || !heightCm || !age || !goal || !workoutsPerWeek) {
      return null;
    }

    // Valores já estão em números (sliders) - sempre em métricas
    const weight = weightKg; // kg
    const height = heightCm; // cm

    // Obter idade
    const ageNum = parseInt(age) || 25;

    // Fórmula de Mifflin-St Jeor para BMR
    let bmr: number;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * ageNum + 5;
    } else {
      // female
      bmr = 10 * weight + 6.25 * height - 5 * ageNum - 161;
    }

    // Fator de atividade baseado em workouts
    let activityFactor = 1.2; // Sedentário
    if (workoutsPerWeek === '3-6') {
      activityFactor = 1.55; // Moderadamente ativo
    } else if (workoutsPerWeek === '6+') {
      activityFactor = 1.725; // Muito ativo
    }

    // TDEE (Total Daily Energy Expenditure)
    let tdee = bmr * activityFactor;

    // Ajustar baseado no objetivo
    if (goal === 'lose') {
      tdee = tdee * 0.85; // Défice de 15%
    } else if (goal === 'gain') {
      tdee = tdee * 1.15; // Superávit de 15%
    }
    // Se 'maintain', usar TDEE como está

    const calories = Math.round(tdee);

    // Calcular macros (distribuição padrão)
    // Proteína: 30% das calorias (4 kcal/g)
    const proteinGrams = Math.round((calories * 0.30) / 4);
    // Carboidratos: 40% das calorias (4 kcal/g)
    const carbsGrams = Math.round((calories * 0.40) / 4);
    // Gordura: 30% das calorias (9 kcal/g)
    const fatGrams = Math.round((calories * 0.30) / 9);

    return {
      calories,
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams,
      bmr: Math.round(bmr),
      tdee: Math.round(bmr * activityFactor),
    };
  };

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
      'workouts',
      'heardFrom',
      'triedOtherApps',
      'height',
      'weight',
      'age',
      'goal',
      'desiredWeight',
      'referralCode',
      'calorieGoal',
      'premium',
      'rateApp',
      'createAccount',
    ];

    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      let nextStep = steps[currentIndex + 1];
      
      // Se o goal é 'maintain', pular o step de desiredWeight
      if (nextStep === 'desiredWeight' && goal === 'maintain') {
        // Pular para referralCode
        nextStep = 'referralCode';
      }
      
      // Se está a ir para calorieGoal, calcular primeiro
      if (nextStep === 'calorieGoal') {
        setCalculating(true);
        setCalculatedMacros(null);
        progressAnim.setValue(0);
        
        // Animar progress bar
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }).start();
        
        // Simular cálculo com delay para mostrar animação
        setTimeout(() => {
          const calculated = calculateCalorieGoal();
          if (calculated) {
            setCalorieGoal(calculated.calories);
            setCalculatedMacros(calculated);
          }
          setCalculating(false);
        }, 2000);
      }
      
      // Atualizar o step usando função de callback para garantir atualização
      setCurrentStep((prevStep) => {
        return nextStep;
      });
    }
  };

  const handleBack = () => {
    const steps: OnboardingStep[] = [
      'gender',
      'workouts',
      'heardFrom',
      'triedOtherApps',
      'height',
      'weight',
      'age',
      'goal',
      'desiredWeight',
      'referralCode',
      'calorieGoal',
      'premium',
      'rateApp',
      'createAccount',
    ];

    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      let prevStep = steps[currentIndex - 1];
      
      // Se está em calorieGoal e o goal é 'maintain', voltar para referralCode (pular desiredWeight)
      if (currentStep === 'calorieGoal' && goal === 'maintain') {
        prevStep = 'referralCode';
      }
      // Se está em referralCode e o goal é 'maintain', voltar para goal (pular desiredWeight)
      else if (currentStep === 'referralCode' && goal === 'maintain') {
        prevStep = 'goal';
      }
      
      setCurrentStep(prevStep);
    }
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
        // Se está vazio, não permitir continuar
        if (heightIsEmpty || heightCm === 0) {
          return false;
        }
        // Se há texto temporário sendo editado, validar esse texto também
        if (heightText !== '') {
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
        // Se está vazio, não permitir continuar
        if (weightIsEmpty || weightKg === 0) {
          return false;
        }
        // Se há texto temporário sendo editado, validar esse texto também
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
      case 'desiredWeight':
        if (goal === 'maintain') {
          return true; // Não precisa validar se é maintain
        }
        if (!desiredWeight || desiredWeight === '') {
          return false;
        }
        const desiredWeightNum = parseFloat(desiredWeight);
        if (isNaN(desiredWeightNum)) {
          return false;
        }
        
        // Peso atual já está em kg (do slider)
        const currentWeight = weightKg; // kg
        
        // Validar baseado no goal
        if (goal === 'gain') {
          // Para ganhar peso, o peso desejado deve ser maior que o atual
          return desiredWeightNum > currentWeight;
        } else if (goal === 'lose') {
          // Para perder peso, o peso desejado deve ser menor que o atual
          return desiredWeightNum < currentWeight;
        }
        return true;
      case 'referralCode':
        return true; // Referral code é opcional
      case 'calorieGoal':
        return true;
      case 'premium':
        return true; // Premium é opcional
      case 'rateApp':
        return true; // Rate app é opcional
      case 'createAccount':
        return true; // Não precisa validar aqui, valida no handleCreateAccount
      default:
        return true;
    }
  };

  const handleCreateAccountWithEmail = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Toast.show({
        type: 'error',
        text1: t('onboarding.error'),
        text2: t('onboarding.errorFillAllFields'),
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: t('onboarding.error'),
        text2: t('onboarding.errorPasswordsDontMatch'),
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: t('onboarding.error'),
        text2: t('onboarding.errorPasswordTooShort'),
      });
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

      // Preparar dados do onboarding
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
        desiredWeight: goal === 'maintain' ? weight : desiredWeightNum, // Se é maintain, usar o peso atual
        referralCode: referralCode.trim() || undefined, // Referral code (opcional)
        onboardingCompleted: true,
      };

      await signUp(email.trim(), password, name.trim(), onboardingData);

      Toast.show({
        type: 'success',
        text1: 'Conta criada!',
        text2: 'Bem-vindo ao Nuti!',
      });

      // O signUp já guardou o perfil com onboardingCompleted = true
      // O onAuthStateChanged vai chamar loadProfile automaticamente
      // Aguardar um pouco para o App.tsx detectar a mudança e redirecionar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Forçar refresh uma vez para garantir que o estado está atualizado
      await refreshProfile();
    } catch (error: any) {
      setCreatingAccount(false);
      Toast.show({
        type: 'error',
        text1: 'Erro ao criar conta',
        text2: error.message || 'Erro ao criar conta',
      });
    } finally {
      setLoading(false);
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
        desiredWeight: goal === 'maintain' ? weight : desiredWeightNum, // Se é maintain, usar o peso atual
        referralCode: referralCode.trim() || undefined, // Referral code (opcional)
        onboardingCompleted: true,
      };

      // Fazer login com Google
      await signInWithGoogleNative();

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
      console.error('❌ OnboardingScreen - Erro ao criar conta com Google:', error);
      setCreatingAccount(false);
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Erro ao criar conta',
        text2: error.message || 'Erro ao criar conta com Google',
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
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
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
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3BB273" />
        </View>
      </SafeAreaView>
    );
  }

  const renderProgressBar = () => {
    return (
      <View className="px-6 pt-4 pb-2">
        <View className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
          <View
            className="h-1 bg-green-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'gender':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              👤 {t('onboarding.gender')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.genderDescription')}
            </Text>
            <View className="space-y-4">
              {([
                { value: 'male' as const, label: t('onboarding.gender.male'), emoji: '👨' },
                { value: 'female' as const, label: t('onboarding.gender.female'), emoji: '👩' },
              ]).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setGender(option.value)}
                  className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                    gender === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                  style={{ marginBottom: 12 }}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      gender === option.value ? 'text-white' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'workouts':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              💪 {t('onboarding.workoutsPerWeek')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.workoutsPerWeekDescription')}
            </Text>
            <View className="space-y-4">
              {([
                { value: '0-2' as const, label: t('onboarding.workouts.0-2'), description: t('onboarding.workouts.0-2.description'), emoji: '🏠' },
                { value: '3-6' as const, label: t('onboarding.workouts.3-6'), description: t('onboarding.workouts.3-6.description'), emoji: '💪' },
                { value: '6+' as const, label: t('onboarding.workouts.6+'), description: t('onboarding.workouts.6+.description'), emoji: '🔥' },
              ]).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setWorkoutsPerWeek(option.value)}
                  className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                    workoutsPerWeek === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                  style={{ marginBottom: 12 }}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      workoutsPerWeek === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </Text>
                  <Text
                    className={`text-sm text-center mt-1 ${
                      workoutsPerWeek === option.value
                        ? 'text-white opacity-90'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
                  { name: 'TV', icon: 'tv-outline' },
                  { name: 'Friends', icon: 'people-outline' },
                  { name: 'Other', icon: 'ellipsis-horizontal-outline' },
                ].map((source) => (
                  <TouchableOpacity
                    key={source.name}
                    onPress={() => setHeardFrom(source.name)}
                    className={`rounded-xl py-5 px-6 border-2 flex-row items-center mb-3 ${
                      heardFrom === source.name
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
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
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {source.name}
                    </Text>
                  </TouchableOpacity>
                ))}
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
            <View className="space-y-4">
              {[
                { value: false, label: t('onboarding.triedOtherApps.no') },
                { value: true, label: t('onboarding.triedOtherApps.yes') },
              ].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  onPress={() => setTriedOtherApps(option.value)}
                  className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                    triedOtherApps === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                  style={{ marginBottom: 12 }}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      triedOtherApps === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              📏 {t('onboarding.heightQuestion')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.heightDescription')}
            </Text>

            {/* Unit Toggle */}
            <View className="flex-row mb-8 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <TouchableOpacity
                onPress={() => setIsImperial(false)}
                className={`flex-1 py-3 rounded-lg ${
                  !isImperial ? 'bg-green-500' : ''
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    !isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t('onboarding.metricCm')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsImperial(true)}
                className={`flex-1 py-3 rounded-lg ${
                  isImperial ? 'bg-green-500' : ''
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t('onboarding.imperialFtIn')}
                </Text>
              </TouchableOpacity>
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
                  className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
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
                  className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#3BB273" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-500 dark:text-gray-400 mt-2">
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
              onValueChange={(value) => setHeightCm(Math.round(value))}
              minimumTrackTintColor="#3BB273"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#3BB273"
            />

            {/* Min/Max Labels */}
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-500 dark:text-gray-400">
                {isImperial ? "4'0\"" : '120 cm'}
              </Text>
              <Text className="text-gray-500 dark:text-gray-400">
                {isImperial ? "7'0\"" : '220 cm'}
              </Text>
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
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              ⚖️ {t('onboarding.weightQuestion')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.weightDescription')}
            </Text>

            {/* Unit Toggle */}
            <View className="flex-row mb-8 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <TouchableOpacity
                onPress={() => setIsImperial(false)}
                className={`flex-1 py-3 rounded-lg ${
                  !isImperial ? 'bg-green-500' : ''
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    !isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t('onboarding.metricKg')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsImperial(true)}
                className={`flex-1 py-3 rounded-lg ${
                  isImperial ? 'bg-green-500' : ''
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t('onboarding.imperialLbs')}
                </Text>
              </TouchableOpacity>
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
                  className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
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
                  className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#3BB273" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-500 dark:text-gray-400 mt-2">
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
              onValueChange={(value) => setWeightKg(Math.round(value * 2) / 2)}
              minimumTrackTintColor="#3BB273"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#3BB273"
            />

            {/* Min/Max Labels */}
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-500 dark:text-gray-400">
                {isImperial ? '66 lbs' : '30 kg'}
              </Text>
              <Text className="text-gray-500 dark:text-gray-400">
                {isImperial ? '440 lbs' : '200 kg'}
              </Text>
            </View>
          </View>
        );

      case 'age':
        const ageNum = parseInt(age) || 18;
        
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              🎂 {t('onboarding.ageQuestion')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.ageDescription')}
            </Text>

            {/* Display Value with +/- buttons */}
            <View className="items-center mb-8">
              <View className="flex-row items-center justify-center">
                <TouchableOpacity
                  onPress={() => {
                    const newValue = Math.max(18, ageNum - 1);
                    setAge(newValue.toString());
                  }}
                  className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
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
                    const newValue = Math.min(150, ageNum + 1);
                    setAge(newValue.toString());
                  }}
                  className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#3BB273" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-500 dark:text-gray-400 mt-2">
                {t('onboarding.yearsOld')}
              </Text>
            </View>
          </View>
        );

      case 'goal':
        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              🎯 {t('onboarding.goal')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.goalDescription')}
            </Text>
            <View className="space-y-4">
              {([
                { value: 'lose', label: t('onboarding.goal.lose') },
                { value: 'maintain', label: t('onboarding.goal.maintain') },
                { value: 'gain', label: t('onboarding.goal.gain') },
              ] as const).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setGoal(option.value)}
                  className={`rounded-xl py-5 px-6 border-2 mb-3 ${
                    goal === option.value
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                  style={{ marginBottom: 12 }}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      goal === option.value
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              🎯 {t('onboarding.desiredWeightQuestion')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-2">
              {t('onboarding.currentWeight')}: {currentWeightDisplay} {isImperial ? 'lbs' : 'kg'}
            </Text>
            {hintText !== '' && (
              <Text className="text-gray-400 dark:text-gray-500 mb-6 text-sm">
                {hintText}
              </Text>
            )}
            <TextInput
              className={`bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border-2 text-2xl text-center ${
                desiredWeight && !isValidWeight
                  ? 'border-red-500'
                  : 'border-gray-200 dark:border-gray-700'
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
            <Text className="mt-2 text-center text-gray-600 dark:text-gray-400">
              {isImperial ? 'lbs' : 'kg'}
            </Text>
          </View>
        );

      case 'referralCode':
        const handlePaste = async () => {
          try {
            // Tentar usar expo-clipboard se disponível, caso contrário usar fallback
            let text = '';
            try {
              const Clipboard = await import('expo-clipboard');
              text = await Clipboard.getStringAsync();
            } catch (clipboardError) {
              // Se expo-clipboard não estiver disponível, mostrar mensagem
              Toast.show({
                type: 'info',
                text1: t('onboarding.referralCode.clipboardNotAvailable'),
                text2: t('onboarding.referralCode.clipboardNotAvailableMessage'),
              });
              return;
            }
            
            if (text) {
              // Permitir apenas letras, números e hífens, em maiúsculas
              const upperText = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
              setReferralCode(upperText);
              Toast.show({
                type: 'success',
                text1: t('onboarding.referralCode.pasted'),
                text2: t('onboarding.referralCode.pastedMessage'),
              });
            } else {
              Toast.show({
                type: 'info',
                text1: t('onboarding.referralCode.empty'),
                text2: t('onboarding.referralCode.emptyMessage'),
              });
            }
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: t('onboarding.referralCode.error'),
              text2: t('onboarding.referralCode.errorMessage'),
            });
          }
        };

        return (
          <View className="flex-1 px-6">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('onboarding.referralCode')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-8">
              {t('onboarding.referralCodeQuestion')}
            </Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 text-lg text-center mr-2"
                placeholder={t('onboarding.referralCode.placeholder')}
                value={referralCode}
                onChangeText={(text) => {
                  // Permitir apenas letras, números e hífens, em maiúsculas
                  const upperText = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                  setReferralCode(upperText);
                }}
                autoCapitalize="characters"
                maxLength={20}
              />
              <TouchableOpacity
                onPress={handlePaste}
                className="bg-green-500 rounded-xl px-4 py-4 items-center justify-center"
                style={{ minWidth: 56, minHeight: 56 }}
              >
                <Ionicons name="clipboard-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text className="mt-2 text-center text-gray-400 dark:text-gray-500 text-sm">
              {t('onboarding.referralCode.skip')}
            </Text>
          </View>
        );

      case 'calorieGoal':
        const calculatedMacrosData = calculatedMacros || calculateCalorieGoal();
        const macros = calculatedMacrosData;

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
                }}>
                  <Animated.View style={{
                    height: '100%',
                    width: progressWidth,
                    backgroundColor: theme.colors.primary || '#3BB273',
                    borderRadius: 4,
                  }} />
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
              }}>
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
                    }}>
                      {Math.round((macros.protein * 4 / macros.calories) * 100)}%
                    </Text>
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
                    }}>
                      {Math.round((macros.carbs * 4 / macros.calories) * 100)}%
                    </Text>
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
                    }}>
                      {Math.round((macros.fat * 9 / macros.calories) * 100)}%
                    </Text>
                  </View>
                </View>
              </View>

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

      case 'premium':
        const handleOpenPremium = async () => {
          // TODO: Implementar compra premium
          // Por enquanto, apenas continuar
          handleNext();
        };

        const premiumFeatures = [
          { icon: 'chatbubbles', text: t('onboarding.premiumFeature1') },
          { icon: 'analytics', text: t('onboarding.premiumFeature2') },
          { icon: 'restaurant', text: t('onboarding.premiumFeature3') },
          { icon: 'trophy', text: t('onboarding.premiumFeature4') },
          { icon: 'cloud', text: t('onboarding.premiumFeature5') },
          { icon: 'shield-checkmark', text: t('onboarding.premiumFeature6') },
        ];

        const premiumColor = '#8B5CF6'; // Roxo premium
        
        return (
          <View className="flex-1 px-6">
            <View style={{ backgroundColor: premiumColor, borderRadius: 24, padding: 24, marginBottom: 24, alignItems: 'center', width: '100%' }}>
              <Ionicons name="star" size={56} color="#FFFFFF" />
              <Text className="text-3xl font-bold text-white mb-2 text-center mt-4">
                {t('onboarding.premiumTitle')}
              </Text>
              <Text className="text-lg text-white opacity-90 text-center mb-6">
                {t('onboarding.premiumDescription')}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ marginBottom: 24 }}>
                {premiumFeatures.map((feature, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.colors.card,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                    }}
                  >
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: premiumColor + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}>
                      <Ionicons name={feature.icon as any} size={24} color={premiumColor} />
                    </View>
                    <Text style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text,
                    }}>
                      {feature.text}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity
                onPress={handleOpenPremium}
                style={{
                  backgroundColor: premiumColor,
                  borderRadius: 16,
                  paddingVertical: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: premiumColor,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}>
                  {t('onboarding.premiumButton')}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handleNext}
              style={{ marginBottom: 16 }}
            >
              <Text style={{
                color: theme.colors.textSecondary || '#9CA3AF',
                textAlign: 'center',
                fontSize: 16,
              }}>
                {t('onboarding.premiumSkip')}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'rateApp':
        const handleRateApp = async () => {
          try {
            const packageName = 'com.nuti.app'; // Substituir pelo package name real
            const url = Platform.OS === 'android'
              ? `market://details?id=${packageName}`
              : `itms-apps://itunes.apple.com/app/id${packageName}`;
            
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
              await Linking.openURL(url);
            } else {
              // Fallback para web
              const webUrl = Platform.OS === 'android'
                ? `https://play.google.com/store/apps/details?id=${packageName}`
                : `https://apps.apple.com/app/id${packageName}`;
              await Linking.openURL(webUrl);
            }
          } catch (error) {
            console.error('Error opening app store:', error);
          }
          // Continuar mesmo se houver erro
          handleNext();
        };

        return (
          <View className="flex-1 px-6 items-center justify-center">
            <View style={{
              backgroundColor: '#FBBF24',
              borderRadius: 24,
              padding: 32,
              marginBottom: 32,
              alignItems: 'center',
              width: '100%',
              shadowColor: '#FBBF24',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}>
              <View style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Ionicons name="star" size={60} color="#FBBF24" />
              </View>
              <Text style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 12,
              }}>
                {t('onboarding.rateAppTitle')}
              </Text>
              <Text style={{
                fontSize: 18,
                color: '#FFFFFF',
                textAlign: 'center',
                opacity: 0.95,
                lineHeight: 24,
              }}>
                {t('onboarding.rateAppDescription')}
              </Text>
            </View>

            <View style={{
              flexDirection: 'row',
              marginBottom: 32,
              gap: 8,
            }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name="star"
                  size={40}
                  color="#FBBF24"
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleRateApp}
              style={{
                backgroundColor: '#FBBF24',
                borderRadius: 16,
                paddingVertical: 18,
                paddingHorizontal: 48,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                shadowColor: '#FBBF24',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
                flexDirection: 'row',
                gap: 8,
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={20} color="#FFFFFF" />
              <Text style={{
                color: '#FFFFFF',
                fontWeight: 'bold',
                fontSize: 18,
              }}>
                {t('onboarding.rateAppButton')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={{
                color: theme.colors.textSecondary || '#9CA3AF',
                textAlign: 'center',
                fontSize: 16,
              }}>
                {t('onboarding.rateAppSkip')}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'createAccount':
        return (
          <View style={{ 
            flex: 1, 
            paddingHorizontal: 0,
            minHeight: 500,
            backgroundColor: 'transparent',
          }}>
            <Text style={{
              fontSize: 28,
              fontWeight: 'bold',
              color: theme.colors.text,
              marginBottom: 8,
            }}>
              {t('onboarding.createAccountTitle')}
            </Text>
            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 32,
            }}>
              {t('onboarding.createAccountDescription')}
            </Text>

            {/* Google Sign-In */}
            <TouchableOpacity
              onPress={handleCreateAccountWithGoogle}
              disabled={loading}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                flexDirection: 'row',
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={{
                color: theme.colors.text,
                fontWeight: '600',
                marginLeft: 8,
                fontSize: 16,
              }}>
                  {t('auth.continueWithGoogle')}
              </Text>
            </TouchableOpacity>

            {/* Divisor */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: 24,
            }}>
              <View style={{
                flex: 1,
                height: 1,
                backgroundColor: theme.colors.border || '#E5E7EB',
              }} />
              <Text style={{
                marginHorizontal: 16,
                color: theme.colors.textSecondary || '#9CA3AF',
                fontSize: 14,
              }}>{t('auth.or')}</Text>
              <View style={{
                flex: 1,
                height: 1,
                backgroundColor: theme.colors.border || '#E5E7EB',
              }} />
            </View>

            {/* Email/Password Form */}
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{
                  color: theme.colors.text,
                  marginBottom: 8,
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                  {t('auth.name')}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    fontSize: 16,
                  }}
                  placeholder={t('auth.name')}
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View>
                <Text style={{
                  color: theme.colors.text,
                  marginBottom: 8,
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                  {t('auth.email')}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    fontSize: 16,
                  }}
                  placeholder="exemplo@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View>
                <Text style={{
                  color: theme.colors.text,
                  marginBottom: 8,
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                  {t('auth.password')}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    fontSize: 16,
                  }}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View>
                <Text style={{
                  color: theme.colors.text,
                  marginBottom: 8,
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                  {t('auth.confirmPassword')}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    fontSize: 16,
                  }}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                onPress={handleCreateAccountWithEmail}
                disabled={loading}
                style={{
                  backgroundColor: theme.colors.primary || '#3BB273',
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: '600',
                    fontSize: 18,
                  }}>{t('onboarding.createAccount')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
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
        <View className="px-6 pb-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <View className="flex-row" style={{ gap: 12 }}>
            {currentStepIndex > 0 && (
              <TouchableOpacity
                onPress={handleBack}
                className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center"
              >
                <Text className="text-gray-900 dark:text-white font-semibold">{t('onboarding.back')}</Text>
              </TouchableOpacity>
            )}
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
