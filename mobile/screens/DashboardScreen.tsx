/**
 * DashboardScreen
 * 
 * Tela principal com gráfico circular, streak, badges e lista de refeições
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useSelectedDate } from '../context/SelectedDateContext';
import { ChartCircle } from '../components/ChartCircle';
import { MealCard } from '../components/MealCard';
import { BadgeItem } from '../components/BadgeItem';
import { PremiumPromoCard } from '../components/PremiumPromoCard';
import { useBadgeNotification } from '../hooks/useBadgeNotification';
import { BadgeNotificationModal } from '../components/BadgeNotificationModal';
import { AdBanner } from '../components/AdBanner';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, Timestamp, doc, deleteDoc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updateStreak, updateStreakAfterDelete } from '../utils/streakUtils';
import { calculateCalorieGoalFromProfile } from '../utils/nutritionUtils';
import { getCache, setCache, removeCache } from '../utils/cacheUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { updateWidgetFromDashboard } from '../services/widgetService';
import { MotiView } from 'moti';
import { Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');
const WATER_SLIDE_PADDING = 24; // Padding direito do slide da água

interface Meal {
  id: string;
  name: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  image?: string;
  date: Date;
  addedAt?: Date | null; // Data de quando foi realmente adicionada
  protein?: number;
  carbs?: number;
  fat?: number;
  healthScore?: number; // Score de saúde (0-10)
  foods?: Array<{
    name: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    weight: number;
    quantity?: number;
  }>; // Lista de alimentos individuais da refeição
}

// Badge interface moved to ProgressScreen

interface Exercise {
  id: string;
  name: string;
  duration: number; // em minutos
  date: Date;
  addedAt?: Date | null;
  calories?: number; // calorias queimadas
}

// Função para calcular Health Score (0-10)
const calculateHealthScore = (meal: Meal): number => {
  if (!meal.calories || meal.calories === 0) return 5; // Score neutro se não houver dados
  
  const protein = meal.protein || 0;
  const carbs = meal.carbs || 0;
  const fat = meal.fat || 0;
  const calories = meal.calories;
  
  // Calcular proporções
  const totalMacros = protein + carbs + fat;
  if (totalMacros === 0) return 5;
  
  const proteinRatio = protein / totalMacros;
  const carbsRatio = carbs / totalMacros;
  const fatRatio = fat / totalMacros;
  
  let score = 5; // Base score
  
  // Proteína: idealmente 20-35% das calorias (1g proteína = 4 kcal)
  const proteinCalories = protein * 4;
  const proteinPercent = (proteinCalories / calories) * 100;
  if (proteinPercent >= 20 && proteinPercent <= 35) {
    score += 2; // Bom
  } else if (proteinPercent >= 15 && proteinPercent < 20) {
    score += 1; // Moderado
  } else if (proteinPercent > 35) {
    score += 1.5; // Muito bom
  } else if (proteinPercent < 10) {
    score -= 1.5; // Baixo
  }
  
  // Carboidratos: idealmente 45-65% das calorias (1g carb = 4 kcal)
  const carbsCalories = carbs * 4;
  const carbsPercent = (carbsCalories / calories) * 100;
  if (carbsPercent >= 45 && carbsPercent <= 65) {
    score += 1.5; // Bom
  } else if (carbsPercent > 70) {
    score -= 1; // Muito alto
  } else if (carbsPercent < 30) {
    score -= 0.5; // Muito baixo
  }
  
  // Gordura: idealmente 20-35% das calorias (1g gordura = 9 kcal)
  const fatCalories = fat * 9;
  const fatPercent = (fatCalories / calories) * 100;
  if (fatPercent >= 20 && fatPercent <= 35) {
    score += 1; // Bom
  } else if (fatPercent > 40) {
    score -= 1.5; // Muito alto
  } else if (fatPercent < 15) {
    score -= 0.5; // Muito baixo
  }
  
  // Ajustar para escala 0-10
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  
  return score;
};

export function DashboardScreen({ navigation }: any) {
  const { user, profile, refreshProfile, updateProfile } = useUser();
  const { t, language } = useLanguage();
  const { showModal, earnedBadge, checkAndShowBadges, closeModal } = useBadgeNotification();
  // Badges moved to ProgressScreen
  const { theme } = useTheme();
  const { setSelectedDate: setContextSelectedDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
  const [logoError, setLogoError] = useState(false);
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [meals, setMeals] = useState<Meal[]>([]);
  // Badges moved to ProgressScreen - removed state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [macros, setMacros] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showFoodsDropdown, setShowFoodsDropdown] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const [showDeleteExerciseModal, setShowDeleteExerciseModal] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<{id: string, name: string} | null>(null);
  const [waterIntake, setWaterIntake] = useState(0); // em ml
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showEditWaterModal, setShowEditWaterModal] = useState(false);
  const [waterAmount, setWaterAmount] = useState('250');
  const [editWaterAmount, setEditWaterAmount] = useState('0');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMacroIndex, setCurrentMacroIndex] = useState(0);
  const [todayMealCount, setTodayMealCount] = useState(0);
  const [steps, setSteps] = useState(0);
  const [daysWithMeals, setDaysWithMeals] = useState<Set<string>>(new Set()); // Armazena datas que têm refeições (formato: YYYY-MM-DD)
  const macroScrollViewRef = useRef<ScrollView>(null);
  const [showEditCaloriesModal, setShowEditCaloriesModal] = useState(false);
  const [caloriesBurned, setCaloriesBurned] = useState(0); // Calorias queimadas pelos exercícios
  const [showEditProteinModal, setShowEditProteinModal] = useState(false);
  const [showEditCarbsModal, setShowEditCarbsModal] = useState(false);
  const [showEditFatModal, setShowEditFatModal] = useState(false);
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [last7DaysWithMeals, setLast7DaysWithMeals] = useState<Set<string>>(new Set());
  const [checkingStreakModal, setCheckingStreakModal] = useState(false);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [lastUpdateDate, setLastUpdateDate] = useState<string>(new Date().toDateString());

  // Detectar mudança de dia e atualizar widgets
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const currentDateStr = new Date().toDateString();
        
        // Se mudou de dia desde a última atualização
        if (currentDateStr !== lastUpdateDate) {
          setLastUpdateDate(currentDateStr);
          
          // Resetar widgets para novo dia (valores a zeros)
          if (profile) {
            updateWidgetFromDashboard(0, goal, { protein: 0, carbs: 0, fat: 0 }, profile, { consumed: 0, goal: profile?.dailyWaterGoal || 2700 });
          }
          
          // Recarregar dados do novo dia
          if (user && profile) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentSelectedDate = new Date(selectedDate);
            currentSelectedDate.setHours(0, 0, 0, 0);
            
            // Se estava a ver hoje, recarregar
            if (currentSelectedDate.getTime() <= today.getTime()) {
              setSelectedDate(new Date()); // Atualizar para novo dia
            }
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [lastUpdateDate, profile, goal, user, selectedDate]);

  useEffect(() => {
    // Se não houver user, limpar estado e não carregar dados
    if (!user) {
      setLoading(false);
      setMeals([]);
      // Badges moved to ProgressScreen
      setConsumed(0);
      return;
    }

    // Só carregar dados se houver user e profile
    if (user && profile) {
      // Paralelizar carregamento inicial
      Promise.all([
        loadDashboardData(),
        loadDaysWithMeals(), // Carregar quais dias têm refeições
      ]).catch(err => {
        console.error('Error loading dashboard data:', err);
      });
    }
  }, [user, profile, selectedDate]);

  // Recarregar quando a tela recebe foco (quando volta de adicionar refeição, editar objetivo, etc)
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile) {
        // Usar cache primeiro (não forçar refresh imediatamente)
        // Só fazer refresh forçado se o utilizador fizer pull-to-refresh
        // Paralelizar para melhor performance
        Promise.all([
          loadDashboardData(false),
          loadDaysWithMeals(),
        ]).catch(err => {
          console.error('Error refreshing dashboard data:', err);
        });
      }
    }, [user, profile, selectedDate])
  );

  // Atualizar contexto quando a data selecionada mudar
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);
    
    // Se a data selecionada for hoje, limpar o contexto (usar data atual)
    // Se for um dia anterior, atualizar o contexto
    if (selectedDateNormalized.getTime() === today.getTime()) {
      setContextSelectedDate(null);
    } else {
      setContextSelectedDate(selectedDate);
    }
  }, [selectedDate, setContextSelectedDate]);

  // Recalcular calorias líquidas sempre que meals ou caloriesBurned mudarem
  useEffect(() => {
    const mealsCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
    const netCalories = mealsCalories - caloriesBurned;
    setConsumed(Math.max(0, netCalories)); // Não permitir valores negativos

    // Atualizar widget com dados atuais incluindo água
    if (profile) {
      updateWidgetFromDashboard(netCalories, goal, macros, profile, { consumed: waterIntake, goal: profile?.dailyWaterGoal || 2700 });
    }

    // Verificar se atingiu meta de calorias (apenas uma vez por dia)
    if (user && profile && netCalories >= goal && goal > 0) {
      const checkGoalBadge = async () => {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const lastCheckKey = `goal_badge_check_${user.uid}_${todayStr}`;
          const lastCheck = await AsyncStorage.getItem(lastCheckKey);
          
          if (!lastCheck) {
            // Ainda não verificou hoje, verificar badges
            await checkAndShowBadges(user.uid);
            await AsyncStorage.setItem(lastCheckKey, 'true');
          }
        } catch (error) {
          console.error('Error checking goal badge:', error);
        }
      };
      
      checkGoalBadge();
    }
  }, [meals, caloriesBurned, goal, macros, user, profile, checkAndShowBadges, waterIntake]);


  const loadDashboardData = async (forceRefresh: boolean = false) => {
    // Verificar user antes de qualquer operação
    if (!user || !profile) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Guardar uid para verificar depois se ainda é o mesmo user
    const currentUserId = user.uid;

    try {
      // Verificar novamente antes de aceder ao Firestore
      if (!user || user.uid !== currentUserId) {
        return;
      }

      // Calcular meta de calorias baseada no perfil com fórmula precisa
      // Se houver dailyCalorieGoal no perfil, usar esse valor, senão calcular
      if ((profile as any).dailyCalorieGoal) {
        setGoal((profile as any).dailyCalorieGoal);
      } else {
        const caloriePlan = calculateCalorieGoalFromProfile(profile);
        if (caloriePlan?.calories) {
          setGoal(caloriePlan.calories);
        }
      }

      // Verificar novamente antes de query
      if (!user || user.uid !== currentUserId) {
        return;
      }

      // Buscar refeições do dia selecionado
      const selectedDay = new Date(selectedDate);
      selectedDay.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDay);
      nextDay.setDate(nextDay.getDate() + 1);

      // Buscar do Firestore
      const mealsRef = collection(db, 'meals');
      const q = query(
        mealsRef,
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(selectedDay)),
        where('date', '<', Timestamp.fromDate(nextDay))
      );

      const snapshot = await getDocs(q);
      
      // Verificar novamente após query
      if (!user || user.uid !== currentUserId) {
        return;
      }

      const mealsData: Meal[] = [];
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Garantir que a data seja convertida corretamente do Timestamp
        const mealDate = data.date?.toDate ? data.date.toDate() : (data.date instanceof Date ? data.date : new Date(data.date));
        // Converter addedAt de Timestamp para Date se existir
        const addedAt = data.addedAt?.toDate ? data.addedAt.toDate() : (data.addedAt instanceof Date ? data.addedAt : (data.addedAt ? new Date(data.addedAt) : null));
        mealsData.push({
          id: doc.id,
          name: data.name,
          calories: data.calories,
          mealType: data.mealType || 'snack',
          image: data.image,
          date: mealDate,
          addedAt: addedAt,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          healthScore: data.healthScore,
          foods: data.foods || undefined, // Lista de alimentos individuais (se existir)
        });
        totalCalories += data.calories || 0;
        totalProtein += data.protein || 0;
        totalCarbs += data.carbs || 0;
        totalFat += data.fat || 0;
      });

      // Verificar novamente antes de setState
      if (!user || user.uid !== currentUserId) {
        return;
      }

      // Verificar antes de atualizar streak (só se for o dia atual)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDayNormalized = new Date(selectedDate);
      selectedDayNormalized.setHours(0, 0, 0, 0);
      
      // Carregar exercícios ANTES de atualizar meals para evitar flash visual
      // Carregar exercícios e outros dados em paralelo
      let exercisesPromise: Promise<void>;
      let waterPromise: Promise<void>;
      let stepsPromise: Promise<void>;
      
      if (selectedDayNormalized.getTime() === today.getTime()) {
        // Se for hoje, incluir updateStreak e refreshProfile
        const todayMealCountValue = mealsData.length;
        setTodayMealCount(todayMealCountValue);
        
        exercisesPromise = loadExercises(selectedDay);
        waterPromise = loadWaterIntake(selectedDay);
        stepsPromise = loadSteps(selectedDay);
        
        // Aguardar exercícios primeiro (mais importante para evitar flash)
        await exercisesPromise;
        
        // Depois atualizar meals e macros (agora que exercícios já estão carregados)
        const sortedMeals = mealsData.sort((a, b) => b.date.getTime() - a.date.getTime());
        setMeals(sortedMeals);
        setMacros({
          protein: Math.round(totalProtein),
          carbs: Math.round(totalCarbs),
          fat: Math.round(totalFat),
        });
        
        // Continuar com outras operações em paralelo
        await Promise.all([
          waterPromise,
          stepsPromise,
          updateStreak(user.uid),
        ]);
        
        await refreshProfile();
        
        // Verificar se deve mostrar o modal do streak automaticamente (não bloquear)
        checkAndShowStreakModal(todayMealCountValue).catch(err => {
          console.error('Error checking streak modal:', err);
        });
      } else {
        // Se não for hoje, carregar exercícios primeiro
        exercisesPromise = loadExercises(selectedDay);
        waterPromise = loadWaterIntake(selectedDay);
        stepsPromise = loadSteps(selectedDay);
        
        // Aguardar exercícios primeiro
        await exercisesPromise;
        
        // Depois atualizar meals e macros
        const sortedMeals = mealsData.sort((a, b) => b.date.getTime() - a.date.getTime());
        setMeals(sortedMeals);
        setMacros({
          protein: Math.round(totalProtein),
          carbs: Math.round(totalCarbs),
          fat: Math.round(totalFat),
        });
        
        // Continuar com outras operações
        setTodayMealCount(mealsData.length);
        await Promise.all([
          waterPromise,
          stepsPromise,
        ]);
      }
    } catch (error: any) {
      // Se for erro de permissões e não houver user, ignorar silenciosamente (logout em progresso)
      if (!user || error?.code === 'permission-denied') {
        // Logout em progresso, ignorar erro silenciosamente
        return;
      }
      console.error('Error loading dashboard:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('common.error'),
      });
    } finally {
      // Só atualizar loading se ainda for o mesmo user
      if (user && user.uid === currentUserId) {
      setLoading(false);
      setRefreshing(false);
    }
    }
  };

  // Função para verificar e mostrar o modal do streak automaticamente
  const checkAndShowStreakModal = async (todayMealCount: number) => {
    if (!user || checkingStreakModal) return;
    
    try {
      setCheckingStreakModal(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toDateString();
      
      // Verificar se já mostrou o modal hoje (usar cache primeiro)
      const lastShownKey = `streakModalShown_${user.uid}`;
      const lastShownDate = await getCache<string>(lastShownKey);
      
      // Só mostrar se:
      // 1. Não tiver refeições hoje (todayMealCount === 0)
      // 2. Ainda não tiver mostrado hoje (lastShownDate !== todayStr)
      // 3. O modal não estiver já visível
      if (todayMealCount === 0 && lastShownDate !== todayStr && !showStreakModal) {
        // Salvar no cache ANTES de fazer query para evitar múltiplas chamadas
        await setCache(lastShownKey, todayStr);
        
        // Tentar usar cache de daysWithMeals primeiro (já foi carregado)
        const cacheKey = `daysWithMeals_${user.uid}`;
        const cachedDays = await getCache<string[]>(cacheKey);
        
        if (cachedDays && cachedDays.length > 0) {
          // Converter cache para formato do modal (dateString)
          const daysWithMealsSet = new Set<string>();
          cachedDays.forEach(dateKey => {
            // Converter YYYY-MM-DD para Date e depois para dateString
            const [year, month, day] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            daysWithMealsSet.add(date.toDateString());
          });
          setLast7DaysWithMeals(daysWithMealsSet);
          
          setTimeout(() => {
            setShowStreakModal(true);
            setCheckingStreakModal(false);
          }, 500);
        } else {
          // Se não houver cache, buscar do Firestore
          const sixDaysAgo = new Date(today);
          sixDaysAgo.setDate(sixDaysAgo.getDate() - 5); // Últimos 6 dias (incluindo hoje)
          
          const mealsRef = collection(db, 'meals');
          const q = query(
            mealsRef,
            where('userId', '==', user.uid),
            where('date', '>=', Timestamp.fromDate(sixDaysAgo)),
            where('date', '<', Timestamp.fromDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
          );
          
          const snapshot = await getDocs(q);
          const daysWithMealsSet = new Set<string>();
          
          snapshot.forEach((doc) => {
            const mealData = doc.data();
            const mealDate = mealData.date?.toDate();
            if (mealDate) {
              const dateStr = mealDate.toDateString();
              daysWithMealsSet.add(dateStr);
            }
          });
          
          setLast7DaysWithMeals(daysWithMealsSet);
          
          setTimeout(() => {
            setShowStreakModal(true);
            setCheckingStreakModal(false);
          }, 500);
        }
      } else {
        setCheckingStreakModal(false);
      }
    } catch (error) {
      console.error('Error checking streak modal:', error);
      setCheckingStreakModal(false);
    }
  };

  const handleDeleteMeal = (mealId: string) => {
    setMealToDelete(mealId);
    setShowDeleteModal(true);
  };

  const handleDeleteExercise = (exerciseId: string, exerciseName: string) => {
    setExerciseToDelete({ id: exerciseId, name: exerciseName });
    setShowDeleteExerciseModal(true);
  };

  const loadExercises = async (date: Date = selectedDate, forceRefresh: boolean = false) => {
    if (!user) {
      setExercises([]);
      return;
    }

    const currentUserId = user.uid;

    try {
      const selectedDay = new Date(date);
      selectedDay.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDay);
      nextDay.setDate(nextDay.getDate() + 1);

      const exercisesRef = collection(db, 'exercises');
      const q = query(
        exercisesRef,
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(selectedDay)),
        where('date', '<', Timestamp.fromDate(nextDay))
      );

      const snapshot = await getDocs(q);

      if (!user || user.uid !== currentUserId) {
        return;
      }

      const exercisesData: Exercise[] = [];
      let totalCaloriesBurned = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const exerciseDate = data.date?.toDate ? data.date.toDate() : (data.date instanceof Date ? data.date : new Date(data.date));
        const addedAt = data.addedAt?.toDate ? data.addedAt.toDate() : (data.addedAt instanceof Date ? data.addedAt : (data.addedAt ? new Date(data.addedAt) : null));
        exercisesData.push({
          id: doc.id,
          name: data.name,
          duration: data.duration || 0,
          date: exerciseDate,
          addedAt: addedAt,
          calories: data.calories || 0, // Adicionar calorias ao objeto Exercise
        });
        // Somar calorias queimadas do exercício
        totalCaloriesBurned += data.calories || 0;
      });

      if (user && user.uid === currentUserId) {
        const sortedExercises = exercisesData.sort((a, b) => b.date.getTime() - a.date.getTime());
        setExercises(sortedExercises);
        setCaloriesBurned(totalCaloriesBurned);
        // O useEffect vai recalcular as calorias líquidas automaticamente
      }
    } catch (error: any) {
      if (!user || error?.code === 'permission-denied') {
        return;
      }
      console.error('Error loading exercises:', error);
    }
  };

  const loadSteps = async (date: Date = selectedDate) => {
    // Verificar user antes de qualquer operação
    if (!user) {
      setSteps(0);
      return;
    }

    // Guardar uid para verificar depois
    const currentUserId = user.uid;

    try {
      // Verificar novamente antes de aceder ao Firestore
      if (!user || user.uid !== currentUserId) {
        setSteps(0);
        return;
      }

      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const stepsDocRef = doc(db, 'steps', `${user.uid}_${dateStr}`);
      const stepsDoc = await getDoc(stepsDocRef);

      // Verificar novamente após query
      if (!user || user.uid !== currentUserId) {
        setSteps(0);
        return;
      }

      if (stepsDoc.exists()) {
        const data = stepsDoc.data();
        setSteps(data.count || 0);
      } else {
        setSteps(0);
      }
    } catch (error: any) {
      // Se for erro de permissões ou não houver user, ignorar silenciosamente (logout em progresso)
      if (!user || error?.code === 'permission-denied') {
        setSteps(0);
        return;
      }
      console.error('Error loading steps:', error);
      setSteps(0);
    }
  };

  // Carregar quais dias dos últimos 5 dias têm refeições (usar cache - dados históricos não mudam)
  const loadDaysWithMeals = async () => {
    if (!user) {
      setDaysWithMeals(new Set());
      return;
    }

    const currentUserId = user.uid;
    const cacheKey = `daysWithMeals_${currentUserId}`;

    try {
      if (!user || user.uid !== currentUserId) {
        return;
      }

      // Tentar cache primeiro
      const cachedDays = await getCache<string[]>(cacheKey);
      if (cachedDays && cachedDays.length >= 0) {
        setDaysWithMeals(new Set(cachedDays));
        return;
      }

      // Se não houver cache, buscar do Firestore
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Buscar refeições dos últimos 5 dias (4 anteriores + hoje)
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 4);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(0, 0, 0, 0);

      const mealsRef = collection(db, 'meals');
      const q = query(
        mealsRef,
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<', Timestamp.fromDate(endDate))
      );

      const snapshot = await getDocs(q);
      
      if (!user || user.uid !== currentUserId) {
        return;
      }

      const daysSet = new Set<string>();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date) {
          const mealDate = data.date.toDate();
          // Normalizar para meia-noite no timezone local
          mealDate.setHours(0, 0, 0, 0);
          const dateKey = `${mealDate.getFullYear()}-${String(mealDate.getMonth() + 1).padStart(2, '0')}-${String(mealDate.getDate()).padStart(2, '0')}`;
          daysSet.add(dateKey);
        }
      });

      setDaysWithMeals(daysSet);
      // Guardar no cache (TTL padrão de 5 minutos)
      await setCache(cacheKey, Array.from(daysSet));
    } catch (error) {
      console.error('Error loading days with meals:', error);
      setDaysWithMeals(new Set());
    }
  };

  const loadWaterIntake = async (date: Date = selectedDate, forceRefresh: boolean = false) => {
    // Verificar user antes de qualquer operação
    if (!user) {
      setWaterIntake(0);
      return;
    }

    // Guardar uid para verificar depois
    const currentUserId = user.uid;

    try {
      // Verificar novamente antes de aceder ao Firestore
      if (!user || user.uid !== currentUserId) {
        setWaterIntake(0);
        return;
      }

      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const waterDocRef = doc(db, 'water', `${user.uid}_${dateStr}`);
      const waterDoc = await getDoc(waterDocRef);

      // Verificar novamente após query
      if (!user || user.uid !== currentUserId) {
        setWaterIntake(0);
        return;
      }

      if (waterDoc.exists()) {
        const data = waterDoc.data();
        const amount = data.amount || 0;
        setWaterIntake(amount);
      } else {
        setWaterIntake(0);
      }
    } catch (error: any) {
      // Se for erro de permissões ou não houver user, ignorar silenciosamente (logout em progresso)
      if (!user || error?.code === 'permission-denied') {
        setWaterIntake(0);
        return;
      }
      console.error('Error loading water intake:', error);
      setWaterIntake(0);
    }
  };

  const addWater = async () => {
    if (!user) return;

    const amount = parseInt(waterAmount) || 0;
    if (amount <= 0) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('dashboard.waterInvalidAmount'),
      });
      return;
    }

    try {
      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const waterDocRef = doc(db, 'water', `${user.uid}_${dateStr}`);
      const waterDoc = await getDoc(waterDocRef);

      let newAmount = amount;
      if (waterDoc.exists()) {
        const currentAmount = waterDoc.data().amount || 0;
        newAmount = currentAmount + amount;
      }

      await setDoc(waterDocRef, {
        userId: user.uid,
        date: Timestamp.fromDate(targetDate),
        amount: newAmount,
        updatedAt: Timestamp.now(),
      });

      // Recarregar água para a data selecionada
      await loadWaterIntake(selectedDate, true);
      setShowWaterModal(false);
      setWaterAmount('250');

      // Atualizar widget com dados atuais incluindo água
      if (profile) {
        updateWidgetFromDashboard(consumed, goal, macros, profile, { consumed: newAmount, goal: profile?.dailyWaterGoal || 2700 });
      }

      // Verificar e mostrar badges ganhas (pode ganhar badge de água)
      await checkAndShowBadges(user.uid);

      Toast.show({
        type: 'success',
        text1: t('dashboard.waterAdded'),
        text2: `${amount}ml ${t('dashboard.waterAddedMessage')}`,
      });
    } catch (error) {
      console.error('Error adding water:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('dashboard.waterError'),
      });
    }
  };

  const editWater = async () => {
    if (!user) return;

    const amount = parseInt(editWaterAmount) || 0;
    if (amount < 0) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('dashboard.waterInvalidAmount'),
      });
      return;
    }

    try {
      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const waterDocRef = doc(db, 'water', `${user.uid}_${dateStr}`);

      if (amount === 0) {
        // Se a quantidade for 0, eliminar o documento
        await deleteDoc(waterDocRef);
        setWaterIntake(0);
      } else {
        await setDoc(waterDocRef, {
          userId: user.uid,
          date: Timestamp.fromDate(targetDate),
          amount: amount,
          updatedAt: Timestamp.now(),
        }, { merge: true });
        setWaterIntake(amount);
      }

      // Recarregar água para a data selecionada
      await loadWaterIntake(selectedDate, true);
      setShowEditWaterModal(false);
      setEditWaterAmount('0');

      // Atualizar widget com dados atuais incluindo água
      if (profile) {
        updateWidgetFromDashboard(consumed, goal, macros, profile, { consumed: amount, goal: profile?.dailyWaterGoal || 2700 });
      }

      Toast.show({
        type: 'success',
        text1: t('dashboard.waterUpdated'),
        text2: amount === 0 
          ? t('dashboard.waterDeleted') 
          : `${amount}ml ${t('dashboard.waterUpdatedMessage')}`,
      });
    } catch (error) {
      console.error('Error editing water:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('dashboard.waterError'),
      });
    }
  };

  const confirmDeleteMeal = async () => {
    if (!mealToDelete || isDeletingMeal) return;
    
    setIsDeletingMeal(true);
    
    try {
      // Buscar a refeição antes de eliminá-la para obter a data
      const mealRef = doc(db, 'meals', mealToDelete);
      const mealSnap = await getDoc(mealRef);
      
      let deletedMealDate: Date | null = null;
      let deletedMealCalories = 0;
      let deletedMealProtein = 0;
      let deletedMealCarbs = 0;
      let deletedMealFat = 0;
      
      if (mealSnap.exists()) {
        const mealData = mealSnap.data();
        deletedMealDate = mealData.date?.toDate() || null;
        deletedMealCalories = mealData.calories || 0;
        deletedMealProtein = mealData.protein || 0;
        deletedMealCarbs = mealData.carbs || 0;
        deletedMealFat = mealData.fat || 0;
      }
      
      // Remover imediatamente do estado local (otimistic update)
      setMeals(prevMeals => prevMeals.filter(meal => meal.id !== mealToDelete));
      
      // Atualizar totais imediatamente
      setConsumed(prev => Math.max(0, prev - deletedMealCalories));
      setMacros(prev => ({
        protein: Math.max(0, prev.protein - deletedMealProtein),
        carbs: Math.max(0, prev.carbs - deletedMealCarbs),
        fat: Math.max(0, prev.fat - deletedMealFat),
      }));
      
      // Fechar modais imediatamente
      setShowDeleteModal(false);
      setShowMealModal(false);
      setMealToDelete(null);
      
      // Eliminar do Firestore
      await deleteDoc(mealRef);
      
      // Invalidar cache (rápido, não bloquear)
      if (user) {
        const daysWithMealsCacheKey = `daysWithMeals_${user.uid}`;
        removeCache(daysWithMealsCacheKey).catch(() => {});
      }
      
      // Mostrar toast de sucesso imediatamente
      Toast.show({
        type: 'success',
        text1: t('dashboard.mealDeleted'),
        text2: t('dashboard.mealDeletedMessage'),
      });
      
      // Executar operações pesadas em background (não bloquear UI)
      if (user) {
        Promise.all([
          deletedMealDate ? updateStreakAfterDelete(user.uid, deletedMealDate) : Promise.resolve(0),
          updateStreak(user.uid),
          refreshProfile(),
        ]).then(() => {
          // Recarregar dados em background para sincronizar
          loadDashboardData(true).catch(() => {});
          loadDaysWithMeals().catch(() => {});
        }).catch(err => {
          console.error('Error updating streak/profile after delete:', err);
          // Recarregar dados mesmo em caso de erro para garantir sincronização
          loadDashboardData(true).catch(() => {});
          loadDaysWithMeals().catch(() => {});
        });
      }
    } catch (error: any) {
      console.error('Error deleting meal:', error);
      
      // Em caso de erro, recarregar dados para restaurar estado
      if (user) {
        loadDashboardData(true).catch(() => {});
      }
      
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('dashboard.deleteMealError'),
      });
    } finally {
      setIsDeletingMeal(false);
    }
  };

  const onRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    // Forçar refresh (ignorar cache)
    await loadDashboardData(true);
    await loadDaysWithMeals(); // Atualizar quais dias têm refeições
    await loadExercises(selectedDate, true);
    await loadWaterIntake(selectedDate, true);
  };

  // Se não houver user, não renderizar nada (navegação vai redirecionar)
  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary || '#3BB273'} />
      </SafeAreaView>
    );
  }

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '🌅';
    if (hour >= 12 && hour < 18) return '☀️';
    if (hour >= 18 && hour < 22) return '🌆';
    return '🌙';
  };

  // Obter primeiro nome do usuário
  const getFirstName = () => {
    if (!profile?.name) return '';
    const nameParts = profile.name.trim().split(' ');
    return nameParts[0] || '';
  };

  // Frases de motivação
  const getMotivationalMessage = () => {
    const messages = [
      t('dashboard.motivation.keepGoing') || 'Keep going, you\'re doing great!',
      t('dashboard.motivation.oneStep') || 'One step at a time!',
      t('dashboard.motivation.youGotThis') || 'You\'ve got this!',
      t('dashboard.motivation.stayStrong') || 'Stay strong and focused!',
      t('dashboard.motivation.progress') || 'Every day is progress!',
      t('dashboard.motivation.believe') || 'Believe in yourself!',
    ];
    // Usar o dia do mês para variar a mensagem
    const dayOfMonth = new Date().getDate();
    return messages[dayOfMonth % messages.length];
  };

  const backgroundStyle = !theme?.isDark 
    ? { flex: 1 } 
    : { flex: 1, backgroundColor: theme?.colors?.background || '#FFFFFF' };

  return (
    <View style={backgroundStyle}>
      {!theme?.isDark && (
        <LinearGradient
          colors={['#F0FDF4', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {theme?.isDark && (
        <LinearGradient
          colors={['#1A2E1F', theme.colors.background || '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
        />
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.colors.primary || '#3BB273'}
            colors={[theme.colors.primary || '#3BB273']}
          />
        }
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <View style={{
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: 24,
            }}>
              <View style={{ flex: 1 }}>
                {/* Saudação personalizada */}
                <View style={{ justifyContent: 'center' }}>
                  <Text 
                      style={{
                        fontSize: 24,
                      fontWeight: '700',
                      color: theme.colors.text,
                      marginBottom: 4,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t('dashboard.greeting', { name: getFirstName() || 'there' })}
                  </Text>
                  <Text 
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: theme.colors.textSecondary || '#9CA3AF',
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {getMotivationalMessage()}
                  </Text>
                </View>
          </View>

              {/* Badges: Streak, Water e Badges/Conquistas */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                {/* Streak Badge */}
                {profile && (
                  <TouchableOpacity
                    onPress={async () => {
                      // Buscar refeições dos últimos 6 dias para mostrar no modal
                      if (user) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const sixDaysAgo = new Date(today);
                        sixDaysAgo.setDate(sixDaysAgo.getDate() - 5); // Últimos 6 dias (incluindo hoje)
                        
                        const mealsRef = collection(db, 'meals');
                        const q = query(
                          mealsRef,
                          where('userId', '==', user.uid),
                          where('date', '>=', Timestamp.fromDate(sixDaysAgo)),
                          where('date', '<', Timestamp.fromDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
                        );
                        
                        const snapshot = await getDocs(q);
                        const daysWithMealsSet = new Set<string>();
                        
                        snapshot.forEach((doc) => {
                          const mealData = doc.data();
                          const mealDate = mealData.date?.toDate();
                          if (mealDate) {
                            const dateStr = mealDate.toDateString();
                            daysWithMealsSet.add(dateStr);
                          }
                        });
                        
                        setLast7DaysWithMeals(daysWithMealsSet);
                        setShowStreakModal(true);
                      }
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: profile.streak > 0
                        ? (theme.isDark ? '#1F2937' : '#FEF3C7')
                        : (theme.colors.card || '#FFFFFF'),
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: profile.streak > 0 ? 0 : 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                      shadowColor: profile.streak > 0 ? '#F97316' : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: profile.streak > 0 ? (theme.isDark ? 0.2 : 0.1) : 0,
                      shadowRadius: 4,
                      elevation: profile.streak > 0 ? 2 : 0,
                    }}>
                    <Ionicons 
                      name="flame" 
                      size={16} 
                      color={profile.streak > 0 ? "#F97316" : (theme.colors.textSecondary || '#9CA3AF')} 
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: profile.streak > 0 
                        ? (theme.isDark ? "#FFFFFF" : "#92400E") 
                        : (theme.colors.text || '#000000'),
                    }}>
                      {profile.streak || 0}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Water Badge */}
                <TouchableOpacity
                  onPress={() => {
                    setEditWaterAmount(waterIntake.toString());
                    setShowEditWaterModal(true);
                  }}
                  activeOpacity={0.7}
              style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: waterIntake > 0
                      ? (theme.isDark ? '#1F2937' : '#DBEAFE')
                      : (theme.colors.card || '#FFFFFF'),
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: waterIntake > 0 ? 0 : 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    shadowColor: waterIntake > 0 ? '#3B82F6' : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: waterIntake > 0 ? (theme.isDark ? 0.2 : 0.1) : 0,
                    shadowRadius: 4,
                    elevation: waterIntake > 0 ? 2 : 0,
              }}
            >
                  <Ionicons 
                    name="water" 
                    size={16} 
                    color={waterIntake > 0 ? "#3B82F6" : (theme.colors.textSecondary || '#9CA3AF')} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: waterIntake > 0 
                      ? (theme.isDark ? "#FFFFFF" : "#1E40AF") 
                      : (theme.colors.text || '#000000'),
                  }}>
                    {waterIntake > 0 ? `${(waterIntake / 1000).toFixed(1)}L` : '0.0L'}
                </Text>
            </TouchableOpacity>
              </View>
              </View>
            </MotiView>


          {/* Calendar Selector */}
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={{ marginBottom: 20 }}
          >
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 16,
            }}>
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const selectedDateNormalized = new Date(selectedDate);
                selectedDateNormalized.setHours(0, 0, 0, 0);
                
                const days = [];
                const startOffset = -4; // Mostrar 4 dias anteriores
                const endOffset = 0; // Até hoje
                
                // Gerar dias: 4 anteriores + hoje
                for (let i = startOffset; i <= endOffset; i++) {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  date.setHours(0, 0, 0, 0);
                  
                  const isToday = date.getTime() === today.getTime();
                  const isSelected = date.getTime() === selectedDateNormalized.getTime();
                  const isPastDay = !isToday;
                  
                  // Verificar se este dia tem refeições
                  // date já está normalizado (setHours(0,0,0,0) foi chamado acima)
                  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  const hasMeals = daysWithMeals.has(dateKey);
                  
                  const dayName = date.toLocaleDateString(
                    language === 'pt' ? 'pt-PT' :
                    language === 'es' ? 'es-ES' :
                    language === 'fr' ? 'fr-FR' :
                    language === 'de' ? 'de-DE' :
                    language === 'it' ? 'it-IT' : 'en-US',
                    { weekday: 'short' }
                  );
                  
                  const dayNumber = date.getDate();
                  
                  // Determinar cor e estilo do border para dias anteriores
                  let borderColor = theme.colors.border || '#E5E7EB';
                  let borderStyle: 'solid' | 'dashed' = 'dashed';
                  
                  if (isPastDay) {
                    if (hasMeals) {
                      // Dia anterior com refeições: verde sólido sutil
                      borderColor = '#3BB27350'; // Verde com ~31% de opacidade
                      borderStyle = 'solid';
                    } else {
                      // Dia anterior sem refeições: vermelho tracejado sutil
                      borderColor = '#EF444450'; // Vermelho com ~31% de opacidade
                      borderStyle = 'dashed';
                    }
                  }
                  
                  days.push(
            <TouchableOpacity
                      key={date.toISOString()}
                      onPress={() => setSelectedDate(date)}
                      activeOpacity={0.7}
                      style={{
                        alignItems: 'center',
                        marginHorizontal: 4,
                        paddingVertical: 14,
                        paddingHorizontal: 10,
                        borderRadius: 20,
                        backgroundColor: isSelected
                          ? theme.colors.card
                          : isToday && !isSelected
                          ? theme.colors.primary + '08' || '#3BB27308'
                          : 'transparent',
                        minWidth: 64,
                        borderWidth: isToday && !isSelected ? 1.5 : 0,
                        borderColor: isToday && !isSelected
                          ? theme.colors.primary + '30' || '#3BB27330'
                          : 'transparent',
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: isSelected ? '700' : isToday ? '700' : '500',
                        color: isSelected
                          ? theme.colors.text
                          : isToday
                          ? theme.colors.primary || '#3BB273'
                          : theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {dayName}
                      </Text>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        borderWidth: isSelected ? 3 : isToday ? 2.5 : 1.5,
                        borderColor: isSelected
                          ? theme.colors.primary || '#3BB273'
                          : isToday
                          ? theme.colors.primary || '#3BB273'
                          : borderColor,
                        borderStyle: isSelected || isToday ? 'solid' : borderStyle,
                        backgroundColor: isSelected
                          ? theme.colors.primary || '#3BB273'
                          : isToday
                          ? (theme.colors.primary || '#3BB273') + '20'
                          : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: isSelected || isToday ? (theme.colors.primary || '#3BB273') : 'transparent',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSelected || isToday ? 0.3 : 0,
                        shadowRadius: 4,
                        elevation: isSelected || isToday ? 3 : 0,
                      }}>
                        <Text style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: isSelected
                            ? '#FFFFFF'
                            : isToday
                            ? theme.colors.primary || '#3BB273'
                            : theme.colors.textSecondary || '#9CA3AF',
                        }}>
                          {dayNumber}
                        </Text>
                      </View>
            </TouchableOpacity>
                  );
                }
                
                return days;
              })()}
          </View>
          </MotiView>

          {/* Gráfico Circular */}
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 200 }}
            style={{ marginTop: -24, marginBottom: 24 }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setEditCalories(goal.toString());
                setShowEditCaloriesModal(true);
              }}
            >
            <ChartCircle consumed={consumed} goal={goal} />
            </TouchableOpacity>
          </MotiView>

          {/* Premium Promo Card */}
          <PremiumPromoCard
            variant="compact"
            fullWidth={true}
            onPress={() => navigation.navigate('Premium')}
          />

          {/* Ad Banner - Entre Premium Card e Macros */}
          <AdBanner
            adSize="banner"
            position="inline"
          />

          {/* Macros Cards com Swipe */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 250 }}
            style={{ marginBottom: 24 }}
          >
            <ScrollView
              ref={macroScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const cardWidth = screenWidth;
                const offset = event.nativeEvent.contentOffset.x;
                const maxOffset = screenWidth; // Máximo: apenas 2 slides (0 e 1)
                
                // Se passou do limite, corrigir suavemente após um pequeno delay
                if (offset > maxOffset + 1) {
                  // Usar setTimeout para dar tempo ao momentum natural terminar
                  setTimeout(() => {
                    macroScrollViewRef.current?.scrollTo({ 
                      x: maxOffset, 
                      animated: true 
                    });
                  }, 50);
                  setCurrentMacroIndex(1);
                  return;
                }
                
                const clampedOffset = Math.min(maxOffset, Math.max(0, offset));
                const index = Math.round(clampedOffset / cardWidth);
                setCurrentMacroIndex(Math.min(1, Math.max(0, index)));
              }}
              onScrollEndDrag={(event) => {
                const offset = event.nativeEvent.contentOffset.x;
                const maxOffset = screenWidth;
                
                // Se está tentando arrastar além do limite, aplicar correção suave
                if (offset > maxOffset) {
                  setTimeout(() => {
                    macroScrollViewRef.current?.scrollTo({ 
                      x: maxOffset, 
                      animated: true 
                    });
                  }, 100);
                }
              }}
              contentContainerStyle={{ width: screenWidth * 2, flexDirection: 'row', paddingBottom: 8 }}
              decelerationRate={0.9}
              snapToInterval={screenWidth}
              snapToAlignment="start"
              bounces={false}
              scrollEnabled={true}
              overScrollMode="never"
            >
              {/* Slide 1: Proteína, Carboidratos, Gordura */}
              <View style={{
                width: screenWidth,
                flexDirection: 'row',
                paddingLeft: 0,
                paddingRight: 24,
                paddingBottom: 4,
                alignItems: 'flex-start',
              }}>
                  {/* Proteína */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const proteinGoal = (profile as any)?.dailyProteinGoal || Math.round((goal * 0.30) / 4);
                      setEditProtein(proteinGoal.toString());
                      setShowEditProteinModal(true);
                    }}
              style={{
                      width: Math.floor((screenWidth - 48 - 24) / 3),
                      backgroundColor: theme.colors.card,
                      borderRadius: 20,
                      padding: 16,
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: theme.isDark ? 0.1 : 0.05,
                      shadowRadius: 4,
                      elevation: theme.isDark ? 2 : 1,
                      overflow: 'visible',
                    }}
                  >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="nutrition" size={24} color="#EF4444" />
                  </View>
                  <Text style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: theme.colors.text,
                    marginBottom: 4,
                  }}>
                    {macros.protein}g
                </Text>
                  <Text style={{
                    fontSize: 12,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    fontWeight: '600',
                  }}>
                    {t('dashboard.protein')}
                </Text>
          </TouchableOpacity>

                  {/* Carboidratos */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const carbsGoal = (profile as any)?.dailyCarbsGoal || Math.round((goal * 0.40) / 4);
                      setEditCarbs(carbsGoal.toString());
                      setShowEditCarbsModal(true);
                    }}
                    style={{
                      width: Math.floor((screenWidth - 48 - 24) / 3),
                      marginLeft: 12,
                      backgroundColor: theme.colors.card,
                      borderRadius: 20,
                      padding: 16,
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: theme.isDark ? 0.1 : 0.05,
                      shadowRadius: 4,
                      elevation: theme.isDark ? 2 : 1,
                      overflow: 'visible',
                    }}
                  >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#D1FAE5',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="fast-food" size={24} color="#10B981" />
              </View>
                  <Text style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: theme.colors.text,
                    marginBottom: 4,
                  }}>
                    {macros.carbs}g
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    fontWeight: '600',
                  }}>
                    {t('dashboard.carbs')}
                </Text>
              </TouchableOpacity>

                  {/* Gordura */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const fatGoal = (profile as any)?.dailyFatGoal || Math.round((goal * 0.30) / 9);
                      setEditFat(fatGoal.toString());
                      setShowEditFatModal(true);
                    }}
                    style={{
                      width: Math.floor((screenWidth - 48 - 24) / 3),
                      marginLeft: 12,
                      backgroundColor: theme.colors.card,
                      borderRadius: 20,
                      padding: 16,
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: theme.isDark ? 0.1 : 0.05,
                      shadowRadius: 4,
                      elevation: theme.isDark ? 2 : 1,
                      overflow: 'visible',
                    }}
                  >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FEF9C3',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="flame" size={24} color="#EAB308" />
            </View>
                  <Text style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: theme.colors.text,
                    marginBottom: 4,
                  }}>
                    {macros.fat}g
                </Text>
                  <Text style={{
                    fontSize: 12,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    fontWeight: '600',
                  }}>
                    {t('dashboard.fat')}
                  </Text>
                  </TouchableOpacity>
              </View>

              {/* Slide 2: Água */}
              <View style={{
                width: screenWidth,
                paddingLeft: 0,
                paddingRight: 24,
                overflow: 'hidden',
                backgroundColor: 'transparent',
              }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  width: Math.floor(screenWidth - WATER_SLIDE_PADDING - WATER_SLIDE_PADDING),
                  backgroundColor: 'transparent',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#3B82F6' + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="water" size={22} color="#3B82F6" />
            </View>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}>
                      {t('dashboard.water')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEditWaterAmount(waterIntake.toString());
                      setShowEditWaterModal(true);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                    }}
                  >
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: '#3B82F6',
                      marginRight: 6,
                    }}>
                      {waterIntake}ml
                    </Text>
                    <Ionicons name="create-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setShowWaterModal(true)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: '#3B82F6',
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5,
                    width: Math.floor(screenWidth - WATER_SLIDE_PADDING - WATER_SLIDE_PADDING),
                    maxWidth: Math.floor(screenWidth - 24 - 24),
                  }}
                >
                  <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: '700',
                    fontSize: 16,
                    marginLeft: 8,
                  }}>
                    {t('dashboard.addWater')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Indicadores de Paginação */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 12,
              gap: 6,
            }}>
              {[0, 1].map((index) => (
                <View
                  key={index}
                  style={{
                    width: currentMacroIndex === index ? 8 : 6,
                    height: currentMacroIndex === index ? 8 : 6,
                    borderRadius: currentMacroIndex === index ? 4 : 3,
                    backgroundColor: currentMacroIndex === index
                      ? theme.colors.primary || '#3BB273'
                      : theme.colors.textSecondary || '#9CA3AF',
                    opacity: currentMacroIndex === index ? 1 : 0.4,
                  }}
                />
              ))}
          </View>
          </MotiView>

          {/* Refeições de Hoje */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 300 }}
            style={{ marginBottom: 24 }}
          >
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginBottom: 16 
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="fast-food-outline" size={22} color={theme.colors.primary || '#3BB273'} />
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: theme.colors.text,
              }}>
                {t('dashboard.mealsToday')}
            </Text>
            </View>
            {meals.length === 0 ? (
              <View style={{
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                padding: 32,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: theme.colors.border || '#E5E7EB',
                borderStyle: 'dashed',
              }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme.colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Ionicons 
                    name="restaurant-outline" 
                    size={32} 
                    color={theme.colors.primary || '#3BB273'} 
                  />
                </View>
                <Text style={{
                  color: theme.colors.textSecondary || '#9CA3AF',
                  fontSize: 16,
                  textAlign: 'center',
                  marginBottom: 8,
                  fontWeight: '600',
                }}>
                  {t('dashboard.noMeals')}
                </Text>
                <Text style={{
                  color: theme.colors.textSecondary || '#9CA3AF',
                  fontSize: 14,
                  textAlign: 'center',
                }}>
                  {t('dashboard.addFirstMeal')}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {meals
                  .filter(meal => meal && meal.id && meal.name) // Filtrar meals inválidos
                  .map((meal, index) => (
                    <MotiView
                  key={meal.id}
                      from={{ opacity: 0, translateX: -20 }}
                      animate={{ opacity: 1, translateX: 0 }}
                      transition={{ type: 'timing', duration: 300, delay: index * 100 }}
                    >
                      <MealCard
                        id={meal.id}
                        name={meal.name || 'Meal'}
                        calories={meal.calories || 0}
                        mealType={meal.mealType || 'snack'}
                        image={meal.image}
                        healthScore={meal.healthScore}
                        time={(() => {
                          // Sempre usar a data real da refeição armazenada
                          if (!meal.date) return '';
                          
                          // Garantir que meal.date é um objeto Date válido
                          let mealDate: Date;
                          if (meal.date instanceof Date) {
                            mealDate = meal.date;
                          } else if (typeof meal.date === 'string' || typeof meal.date === 'number') {
                            mealDate = new Date(meal.date);
                          } else {
                            return '';
                          }
                          
                          // Verificar se a data é válida
                          if (isNaN(mealDate.getTime())) {
                            return '';
                          }
                          
                          // Sempre mostrar a data de quando foi realmente adicionada (addedAt) + hora da refeição
                          // Isso mostra quando a refeição foi realmente adicionada, não para que dia foi adicionada
                          const locale = language === 'pt' ? 'pt-PT' : 
                                        language === 'es' ? 'es-ES' : 
                                        language === 'fr' ? 'fr-FR' : 
                                        language === 'de' ? 'de-DE' : 
                                        language === 'it' ? 'it-IT' : 'en-US';
                          
                          // Usar addedAt se disponível (quando foi realmente adicionada)
                          // Se não existir addedAt, usar date (para refeições antigas)
                          let dateToShow: Date;
                          if (meal.addedAt && meal.addedAt instanceof Date && !isNaN(meal.addedAt.getTime())) {
                            dateToShow = meal.addedAt;
                          } else if (meal.addedAt && (typeof meal.addedAt === 'string' || typeof meal.addedAt === 'number')) {
                            dateToShow = new Date(meal.addedAt);
                            if (isNaN(dateToShow.getTime())) {
                              dateToShow = mealDate;
                            }
                          } else {
                            dateToShow = mealDate;
                          }
                          
                          // Garantir que dateToShow é válido
                          if (!dateToShow || !(dateToShow instanceof Date) || isNaN(dateToShow.getTime())) {
                            return '';
                          }
                          
                          const dateStr = dateToShow.toLocaleDateString(locale, {
                            day: '2-digit',
                            month: '2-digit',
                          });
                          
                          const timeStr = mealDate.toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                          });
                          
                          return `${dateStr} ${timeStr}`;
                        })()}
                        onPress={() => {
                          setSelectedMeal(meal);
                          setShowFoodsDropdown(false);
                          setShowMealModal(true);
                        }}
                        onDelete={() => handleDeleteMeal(meal.id)}
                />
                    </MotiView>
                  ))}
          </View>
            )}
          </MotiView>

          {/* Ad Banner - Entre Refeições e Exercícios */}
          <AdBanner
            adSize="mediumRectangle"
            position="inline"
          />

          {/* Exercícios de Hoje */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 350 }}
            style={{ marginTop: 32, marginBottom: 24 }}
          >
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 16 
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="fitness-outline" size={22} color={theme.colors.primary || '#3BB273'} />
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: theme.colors.text,
                flex: 1,
              }}>
                {t('dashboard.exercisesToday') || 'Exercícios de Hoje'}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AddExercise')}
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme.colors.primary || '#3BB273',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {exercises.length === 0 ? (
              <View style={{
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                padding: 32,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: theme.colors.border || '#E5E7EB',
                borderStyle: 'dashed',
              }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme.colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Ionicons 
                    name="fitness-outline" 
                    size={32} 
                    color={theme.colors.primary || '#3BB273'} 
                  />
                </View>
                <Text style={{
                  color: theme.colors.textSecondary || '#9CA3AF',
                  fontSize: 16,
                  textAlign: 'center',
                  marginBottom: 8,
                  fontWeight: '600',
                }}>
                  {t('dashboard.noExercises') || 'Ainda não registaste exercícios hoje'}
                </Text>
                <Text style={{
                  color: theme.colors.textSecondary || '#9CA3AF',
                  fontSize: 14,
                  textAlign: 'center',
                }}>
                  {t('dashboard.addFirstExercise') || 'Adiciona o teu primeiro exercício!'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {exercises.map((exercise) => (
                  <MotiView
                    key={exercise.id}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 300, delay: 0 }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedExercise(exercise);
                        setShowExerciseModal(true);
                      }}
                      activeOpacity={0.7}
                      style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: 16,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                      }}
                    >
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: theme.colors.primary + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}>
                        <Ionicons name="fitness" size={24} color={theme.colors.primary || '#3BB273'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: theme.colors.text,
                          marginBottom: 4,
                        }}>
                          {exercise.name}
                        </Text>
                        <Text style={{
                          fontSize: 14,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          fontWeight: '600',
                        }}>
                          {exercise.duration} {t('dashboard.minutes') || 'min'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteExercise(exercise.id, exercise.name);
                        }}
                        activeOpacity={0.7}
                        style={{
                          padding: 8,
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </MotiView>
                ))}
              </View>
            )}
          </MotiView>
          </View>
      </ScrollView>

      {/* Modal de Detalhes da Refeição */}
      <Modal
        visible={showMealModal}
        transparent={true}
        animationType="slide"
          onRequestClose={() => {
            setShowMealModal(false);
            setShowFoodsDropdown(false);
          }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowMealModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom, 20),
              paddingHorizontal: 20,
              maxHeight: '85%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {selectedMeal && (
              <>
                {/* Handle bar */}
                <View style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 2,
                  marginBottom: 20,
                }} />

                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.colors.text,
                    flex: 1,
                  }} numberOfLines={2}>
                    {selectedMeal.name}
                  </Text>
            <TouchableOpacity
                    onPress={() => {
                      setShowMealModal(false);
                      setShowFoodsDropdown(false);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 12,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color={theme.colors.text} />
      </TouchableOpacity>
                </View>

                {/* Imagem abaixo do título */}
                  {selectedMeal.image && (
                    <View style={{
                      marginBottom: 16,
                      borderRadius: 16,
                      overflow: 'hidden',
                    }}>
                      <Image
                        source={{ uri: selectedMeal.image }}
                        style={{
                          width: '100%',
                        height: 180,
                        }}
                        resizeMode="cover"
                      />
                    </View>
                  )}

                {/* Informações */}
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: '100%' }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >

                  {/* Calorias - Card destacado */}
                  <View style={{
                    backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons 
                        name="flame-outline" 
                        size={20} 
                        color={theme.isDark ? '#4ADE80' : '#16A34A'} 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={{
                        fontSize: 13,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {t('dashboard.calories') || 'Calorias'}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 28,
                      color: theme.colors.text,
                      fontWeight: '700',
                    }}>
                      {selectedMeal.calories} <Text style={{ fontSize: 18, fontWeight: '500' }}>kcal</Text>
                    </Text>
                  </View>

                  {/* Alimentos - Dropdown */}
                  {selectedMeal.foods && selectedMeal.foods.length > 0 && (
                    <View style={{
                      backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                      borderRadius: 16,
                      marginBottom: 16,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                    }}>
                      <TouchableOpacity
                        onPress={() => setShowFoodsDropdown(!showFoodsDropdown)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 18,
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Ionicons 
                            name="restaurant-outline" 
                            size={20} 
                            color={theme.isDark ? '#60A5FA' : '#3B82F6'} 
                            style={{ marginRight: 10 }}
                          />
                          <Text style={{
                            fontSize: 16,
                            color: theme.colors.text,
                            fontWeight: '700',
                          }}>
                            {t('dashboard.foods') || 'Alimentos'} <Text style={{ fontWeight: '500', color: theme.colors.textSecondary }}>({selectedMeal.foods.length})</Text>
                          </Text>
                        </View>
                        <Ionicons 
                          name={showFoodsDropdown ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color={theme.colors.textSecondary || '#9CA3AF'} 
                        />
                      </TouchableOpacity>
                      
                      {showFoodsDropdown && (
                        <View style={{
                          paddingHorizontal: 18,
                          paddingBottom: 18,
                          gap: 10,
                          borderTopWidth: 1,
                          borderTopColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                          paddingTop: 16,
                        }}>
                          {selectedMeal.foods.map((food, index) => {
                            const multiplier = (food.weight / 100) * (food.quantity || 1);
                            const foodCalories = Math.round(food.caloriesPer100g * multiplier);
                            return (
                              <View
                                key={index}
                                style={{
                                  backgroundColor: theme.isDark ? '#0F172A' : '#FFFFFF',
                                  borderRadius: 12,
                                  padding: 14,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderWidth: 1,
                                  borderColor: theme.isDark ? '#1E2937' : '#F1F5F9',
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={{
                                    fontSize: 15,
                                    color: theme.colors.text,
                                    fontWeight: '600',
                                    marginBottom: 6,
                                  }}>
                                    {food.name}
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons 
                                      name="scale-outline" 
                                      size={14} 
                                      color={theme.colors.textSecondary || '#9CA3AF'} 
                                      style={{ marginRight: 6 }}
                                    />
                                    <Text style={{
                                      fontSize: 12,
                                      color: theme.colors.textSecondary || '#9CA3AF',
                                    }}>
                                      {food.weight}g {food.quantity && food.quantity > 1 ? `× ${food.quantity}` : ''}
                                    </Text>
                                  </View>
                                </View>
                                <View style={{
                                  backgroundColor: theme.isDark ? '#1E3A2A' : '#F0FDF4',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                }}>
                                  <Text style={{
                                    fontSize: 13,
                                    color: theme.isDark ? '#4ADE80' : '#16A34A',
                                    fontWeight: '700',
                                  }}>
                                    {foodCalories} kcal
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Informações Gerais */}
                  <View style={{ gap: 12, marginBottom: 20 }}>
                    {/* Tipo de Refeição e Data/Hora lado a lado */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {/* Tipo de Refeição */}
                      <View style={{
                        flex: 1,
                        backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                        borderRadius: 16,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <Ionicons 
                            name="time-outline" 
                            size={18} 
                            color={theme.isDark ? '#A78BFA' : '#8B5CF6'} 
                            style={{ marginRight: 8 }}
                          />
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}>
                            {t('dashboard.mealType') || 'Tipo de Refeição'}
                          </Text>
                        </View>
                        <Text style={{
                          fontSize: 16,
                          color: theme.colors.text,
                          fontWeight: '700',
                        }}>
                          {selectedMeal.mealType === 'breakfast' ? '🌅 ' + t('addMeal.breakfast') :
                           selectedMeal.mealType === 'lunch' ? '🍽️ ' + t('addMeal.lunch') :
                           selectedMeal.mealType === 'dinner' ? '🌙 ' + t('addMeal.dinner') :
                           '🍎 ' + t('addMeal.snack')}
                        </Text>
                      </View>

                      {/* Data e Hora */}
                      <View style={{
                        flex: 1,
                        backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                        borderRadius: 16,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <Ionicons 
                            name="calendar-outline" 
                            size={18} 
                            color={theme.isDark ? '#FBBF24' : '#F59E0B'} 
                            style={{ marginRight: 8 }}
                          />
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}>
                            {t('dashboard.dateTime') || 'Data e Hora'}
                          </Text>
                        </View>
                        <Text style={{
                          fontSize: 14,
                          color: theme.colors.text,
                          fontWeight: '600',
                          lineHeight: 20,
                        }}>
                          {selectedMeal.date && selectedMeal.date instanceof Date && !isNaN(selectedMeal.date.getTime()) 
                            ? `${selectedMeal.date.toLocaleDateString('pt-PT', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}\n${selectedMeal.date.toLocaleTimeString('pt-PT', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ''}
                        </Text>
                      </View>
                    </View>
              </View>

                  {/* Health Score */}
                  {selectedMeal.calories && selectedMeal.calories > 0 && (
                    <View style={{
                      backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                      borderRadius: 16,
                      padding: 18,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: theme.isDark ? '#1F2937' : '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Ionicons name="heart" size={22} color={theme.isDark ? '#EC4899' : '#DB2777'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}>
                            {t('dashboard.healthScore') || 'Health score'}
                          </Text>
                          <Text style={{
                            fontSize: 24,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {calculateHealthScore(selectedMeal)}<Text style={{ fontSize: 16, fontWeight: '500' }}>/10</Text>
                          </Text>
                        </View>
                    </View>
                      {/* Progress Bar */}
                      <View style={{
                        height: 10,
                        backgroundColor: theme.isDark ? '#0F172A' : '#E2E8F0',
                        borderRadius: 5,
                        overflow: 'hidden',
                      }}>
                        <View style={{
                          height: '100%',
                          width: `${(calculateHealthScore(selectedMeal) / 10) * 100}%`,
                          backgroundColor: calculateHealthScore(selectedMeal) >= 7 
                            ? '#10B981' 
                            : calculateHealthScore(selectedMeal) >= 5 
                            ? '#F59E0B' 
                            : '#EF4444',
                          borderRadius: 5,
                        }} />
                      </View>
                    </View>
                  )}

                    {/* Macros */}
                    {(selectedMeal.protein !== undefined || selectedMeal.carbs !== undefined || selectedMeal.fat !== undefined) && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{
                        fontSize: 16,
                          color: theme.colors.text,
                          marginBottom: 12,
                          fontWeight: '700',
                        }}>
                        {t('dashboard.macros') || 'Macronutrientes'}
                        </Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                          {selectedMeal.protein !== undefined && (
                            <View style={{
                              flex: 1,
                              backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                            borderRadius: 16,
                            padding: 16,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                            }}>
                            <Ionicons name="nutrition" size={22} color="#EF4444" />
                              <Text style={{
                              fontSize: 24,
                                fontWeight: '800',
                                color: theme.colors.text,
                              marginTop: 8,
                              }}>
                                {Math.round(selectedMeal.protein)}g
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: theme.colors.textSecondary || '#9CA3AF',
                              marginTop: 4,
                                fontWeight: '600',
                              }}>
                              {t('dashboard.protein') || 'Proteína'}
                              </Text>
                            </View>
                          )}
                          {selectedMeal.carbs !== undefined && (
                            <View style={{
                              flex: 1,
                              backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                            borderRadius: 16,
                            padding: 16,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                            }}>
                            <Ionicons name="fast-food" size={22} color="#10B981" />
                              <Text style={{
                              fontSize: 24,
                                fontWeight: '800',
                                color: theme.colors.text,
                              marginTop: 8,
                              }}>
                                {Math.round(selectedMeal.carbs)}g
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: theme.colors.textSecondary || '#9CA3AF',
                              marginTop: 4,
                                fontWeight: '600',
                              }}>
                              {t('dashboard.carbs') || 'Carboidratos'}
                              </Text>
                            </View>
                          )}
                          {selectedMeal.fat !== undefined && (
                            <View style={{
                              flex: 1,
                              backgroundColor: theme.isDark ? '#1E2937' : '#F8FAFC',
                            borderRadius: 16,
                            padding: 16,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: theme.isDark ? '#2D3A4A' : '#E2E8F0',
                            }}>
                            <Ionicons name="flame" size={22} color="#F59E0B" />
                              <Text style={{
                              fontSize: 24,
                                fontWeight: '800',
                                color: theme.colors.text,
                              marginTop: 8,
                              }}>
                                {Math.round(selectedMeal.fat)}g
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: theme.colors.textSecondary || '#9CA3AF',
                              marginTop: 4,
                                fontWeight: '600',
                              }}>
                              {t('dashboard.fat') || 'Gordura'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Botão Eliminar */}
                    <TouchableOpacity
                      onPress={() => {
                        setShowMealModal(false);
                        setTimeout(() => {
                          handleDeleteMeal(selectedMeal.id);
                        }, 300);
                      }}
                      style={{
                      backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                        borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      marginTop: 8,
                      borderWidth: 1.5,
                      borderColor: '#EF4444',
                      }}
                    activeOpacity={0.7}
                    >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                      <Text style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#EF4444',
                      }}>
                      {t('common.delete') || 'Eliminar'}
                      </Text>
            </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Confirmação de Eliminação */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setMealToDelete(null);
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
            setShowDeleteModal(false);
            setMealToDelete(null);
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Ícone de Aviso */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="trash" size={32} color="#EF4444" />
        </View>

            {/* Título */}
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('dashboard.deleteMeal')}
            </Text>

            {/* Mensagem */}
            <Text style={{
              fontSize: 15,
              color: theme.colors.textSecondary || '#6B7280',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}>
              {t('dashboard.deleteMealConfirm')}
            </Text>

            {/* Botões */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              {/* Botão Cancelar */}
      <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  setMealToDelete(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('common.cancel')}
                </Text>
      </TouchableOpacity>

              {/* Botão Eliminar */}
              <TouchableOpacity
                onPress={confirmDeleteMeal}
                disabled={isDeletingMeal}
                style={{
                  flex: 1,
                  backgroundColor: isDeletingMeal ? '#EF444480' : '#EF4444',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: isDeletingMeal ? 0.7 : 1,
                }}
                activeOpacity={0.8}
              >
                {isDeletingMeal && (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                )}
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}>
                  {isDeletingMeal ? (t('common.deleting') || 'Deleting...') : t('dashboard.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Confirmação de Eliminação de Exercício */}
      <Modal
        visible={showDeleteExerciseModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteExerciseModal(false);
          setExerciseToDelete(null);
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
            setShowDeleteExerciseModal(false);
            setExerciseToDelete(null);
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Ícone de Aviso */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="trash" size={32} color="#EF4444" />
            </View>

            {/* Título */}
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('dashboard.deleteExercise') || 'Eliminar Exercício'}
            </Text>

            {/* Mensagem */}
            <Text style={{
              fontSize: 15,
              color: theme.colors.textSecondary || '#6B7280',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}>
              {t('dashboard.deleteExerciseConfirm') || 'Tem certeza que deseja eliminar o exercício'} "{exerciseToDelete?.name}"? {t('dashboard.deleteExerciseWarning') || 'Esta ação não pode ser desfeita.'}
            </Text>

            {/* Botões */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              {/* Botão Cancelar */}
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteExerciseModal(false);
                  setExerciseToDelete(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              {/* Botão Eliminar */}
              <TouchableOpacity
                onPress={async () => {
                  if (!exerciseToDelete) return;
                  
                  try {
                    await deleteDoc(doc(db, 'exercises', exerciseToDelete.id));
                    await loadExercises(selectedDate);
                    setShowDeleteExerciseModal(false);
                    setExerciseToDelete(null);
                    Toast.show({
                      type: 'success',
                      text1: t('dashboard.exerciseDeleted') || 'Exercício eliminado',
                    });
                  } catch (error: any) {
                    Toast.show({
                      type: 'error',
                      text1: t('common.error') || 'Erro',
                      text2: t('dashboard.exerciseDeleteError') || 'Erro ao eliminar exercício',
                    });
                  }
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#EF4444',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}>
                  {t('common.delete') || 'Eliminar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Detalhes do Exercício */}
      <Modal
        visible={showExerciseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExerciseModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowExerciseModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 20,
              paddingHorizontal: 20,
              width: '100%',
              maxHeight: '85%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {selectedExercise && (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Handle bar */}
                <View style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 2,
                  marginBottom: 20,
                }} />

                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: theme.colors.primary + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="fitness" size={24} color={theme.colors.primary || '#3BB273'} />
                    </View>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: theme.colors.text,
                      flex: 1,
                    }} numberOfLines={2}>
                      {selectedExercise.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowExerciseModal(false)}
                    style={{
                      padding: 8,
                      marginLeft: 12,
                    }}
                  >
                    <Ionicons name="close" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Informações */}
                <View style={{ gap: 16 }}>
                  {/* Duração */}
                  <View style={{
                    backgroundColor: theme.colors.primary + '10',
                    borderRadius: 16,
                    padding: 16,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons 
                        name="time-outline" 
                        size={20} 
                        color={theme.colors.primary || '#3BB273'} 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: theme.colors.textSecondary || '#9CA3AF',
                      }}>
                        {t('dashboard.duration') || 'Duração'}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}>
                      {selectedExercise.duration} {t('dashboard.minutes') || 'min'}
                    </Text>
                  </View>

                  {/* Calorias Queimadas */}
                  {selectedExercise.calories && selectedExercise.calories > 0 && (
                    <View style={{
                      backgroundColor: theme.colors.primary + '10',
                      borderRadius: 16,
                      padding: 16,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons 
                          name="flame" 
                          size={20} 
                          color={theme.colors.primary || '#3BB273'} 
                          style={{ marginRight: 8 }}
                        />
                        <Text style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: theme.colors.textSecondary || '#9CA3AF',
                        }}>
                          {t('dashboard.caloriesBurned') || 'Calorias Queimadas'}
                        </Text>
                      </View>
                      <Text style={{
                        fontSize: 24,
                        fontWeight: '700',
                        color: theme.colors.primary || '#3BB273',
                      }}>
                        {selectedExercise.calories} {t('dashboard.kcal') || 'kcal'}
                      </Text>
                    </View>
                  )}

                  {/* Data */}
                  <View style={{
                    backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 0,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons 
                        name="calendar-outline" 
                        size={20} 
                        color={theme.colors.textSecondary || '#9CA3AF'} 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: theme.colors.textSecondary || '#9CA3AF',
                      }}>
                        {t('dashboard.dateTime') || 'Data e Hora'}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text,
                    }}>
                      {selectedExercise.date.toLocaleDateString(
                        language === 'pt' ? 'pt-PT' : 
                        language === 'es' ? 'es-ES' : 
                        language === 'fr' ? 'fr-FR' : 
                        language === 'de' ? 'de-DE' : 
                        language === 'it' ? 'it-IT' : 'en-US',
                        { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }
                      )}
                    </Text>
                  </View>
                </View>

                {/* Botão Eliminar */}
                <TouchableOpacity
                  onPress={() => {
                    setShowExerciseModal(false);
                    setTimeout(() => {
                      handleDeleteExercise(selectedExercise.id, selectedExercise.name);
                    }, 300);
                  }}
                  style={{
                    marginTop: 8,
                    marginBottom: 20,
                    backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: '#EF4444',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: '#EF4444',
                  }}>
                    {t('common.delete') || 'Eliminar'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Adicionar Água */}
      <Modal
        visible={showWaterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWaterModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowWaterModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Ícone de Água */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#DBEAFE',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="water" size={32} color="#3B82F6" />
            </View>

            {/* Título */}
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('dashboard.addWater')}
            </Text>

            {/* Botões de Quantidade Rápida */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.textSecondary || '#6B7280',
                marginBottom: 8,
              }}>
                {t('dashboard.waterAmount')} (ml)
              </Text>
              <View style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 12,
              }}>
                {[250, 500, 750, 1000].map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    onPress={() => setWaterAmount(amount.toString())}
                    style={{
                      flex: 1,
                      backgroundColor: waterAmount === amount.toString() 
                        ? '#3B82F6' 
                        : theme.colors.border || '#E5E7EB',
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: waterAmount === amount.toString() 
                        ? '#FFFFFF' 
                        : theme.colors.text,
                    }}>
                      {amount}ml
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{
                backgroundColor: theme.colors.border || '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  flex: 1,
                }}>
                  {waterAmount}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#6B7280',
                }}>
                  ml
                </Text>
              </View>
            </View>

            {/* Botões */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              {/* Botão Cancelar */}
              <TouchableOpacity
                onPress={() => {
                  setShowWaterModal(false);
                  setWaterAmount('250');
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              {/* Botão Adicionar */}
              <TouchableOpacity
                onPress={addWater}
                style={{
                  flex: 1,
                  backgroundColor: '#3B82F6',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}>
                  {t('dashboard.add')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Editar Água */}
      <Modal
        visible={showEditWaterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditWaterModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowEditWaterModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Ícone de Água */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#DBEAFE',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="water" size={32} color="#3B82F6" />
            </View>

            {/* Título */}
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('dashboard.editWater')}
            </Text>

            {/* Input de Quantidade Total */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.textSecondary || '#6B7280',
                marginBottom: 8,
              }}>
                {t('dashboard.waterTotal')} (ml)
              </Text>
              <TextInput
                value={editWaterAmount}
                onChangeText={setEditWaterAmount}
                keyboardType="numeric"
                style={{
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary || '#6B7280'}
              />
            </View>

            {/* Botões */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              {/* Botão Cancelar */}
              <TouchableOpacity
                onPress={() => {
                  setShowEditWaterModal(false);
                  setEditWaterAmount('0');
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              {/* Botão Guardar */}
              <TouchableOpacity
                onPress={editWater}
                style={{
                  flex: 1,
                  backgroundColor: '#3B82F6',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}>
                  {t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Editar Calorias */}
      <Modal
        visible={showEditCaloriesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditCaloriesModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
            onPress={() => setShowEditCaloriesModal(false)}
          >
            <View style={{ width: '100%', maxWidth: 400 }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 24,
                padding: 28,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="flame" size={28} color="#EF4444" />
                  </View>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {t('dashboard.calories') || 'Calories'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowEditCaloriesModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                {t('dashboard.editCaloriesDescription') || 'Change your daily calorie goal'}
              </Text>
              <View style={{
                marginBottom: 24,
              }}>
                <TextInput
                  style={{
                    backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                    borderRadius: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 18,
                    fontSize: 36,
                    fontWeight: '800',
                    color: theme.colors.text,
                    textAlign: 'center',
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                  }}
                  value={editCalories}
                  onChangeText={setEditCalories}
                  keyboardType="numeric"
                  placeholder="2000"
                  placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                  autoFocus
                />
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  textAlign: 'center',
                  marginTop: 12,
                  fontWeight: '700',
                }}>
                  kcal
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowEditCaloriesModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {t('common.cancel') || 'Cancelar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const calories = parseInt(editCalories) || 0;
                    if (calories < 1200 || calories > 5000) {
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: t('dashboard.invalidCalories') || 'Calorias devem estar entre 1200 e 5000',
                      });
                      return;
                    }
                    setSavingGoals(true);
                    try {
                      await updateProfile({
                        dailyCalorieGoal: calories,
                      } as any);
                      await refreshProfile();
                      setGoal(calories);
                      setShowEditCaloriesModal(false);
                      setSavingGoals(false);
                      Toast.show({
                        type: 'success',
                        text1: t('profile.updateSuccess') || 'Sucesso',
                        text2: t('dashboard.goalsUpdated') || 'Metas atualizadas com sucesso',
                      });
                    } catch (error: any) {
                      setSavingGoals(false);
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: error.message || t('profile.updateError') || 'Erro ao atualizar metas',
                      });
                    }
                  }}
                  disabled={savingGoals}
                  style={{
                    flex: 1,
                    backgroundColor: savingGoals
                      ? theme.colors.border || '#E5E7EB'
                      : '#EF4444',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: savingGoals ? 0.5 : 1,
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                >
                  {savingGoals ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#FFFFFF',
                    }}>
                      {t('common.save') || 'Guardar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Editar Proteína */}
      <Modal
        visible={showEditProteinModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditProteinModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
            onPress={() => setShowEditProteinModal(false)}
          >
            <View style={{ width: '100%', maxWidth: 400 }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 24,
                padding: 28,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="nutrition" size={28} color="#EF4444" />
                  </View>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {t('dashboard.protein') || 'Proteína'}
                  </Text>
                </View>
            <TouchableOpacity
                  onPress={() => setShowEditProteinModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                {t('dashboard.editProteinDescription') || 'Change your daily protein goal'}
                  </Text>
              <View style={{
                marginBottom: 24,
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  paddingHorizontal: 16,
                }}>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 18,
                      fontSize: 32,
                      fontWeight: '800',
                      color: theme.colors.text,
                      textAlign: 'center',
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                    }}
                    value={editProtein}
                    onChangeText={setEditProtein}
                    keyboardType="numeric"
                    placeholder="150"
                    placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                    autoFocus
                  />
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginLeft: 8,
                  }}>
                    g
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowEditProteinModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {t('common.cancel') || 'Cancelar'}
                  </Text>
            </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const protein = parseInt(editProtein) || 0;
                    setSavingGoals(true);
                    try {
                      await updateProfile({
                        dailyProteinGoal: protein,
                      } as any);
                      await refreshProfile();
                      setShowEditProteinModal(false);
                      setSavingGoals(false);
                      Toast.show({
                        type: 'success',
                        text1: t('profile.updateSuccess') || 'Sucesso',
                        text2: t('dashboard.goalsUpdated') || 'Metas atualizadas com sucesso',
                      });
                    } catch (error: any) {
                      setSavingGoals(false);
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: error.message || t('profile.updateError') || 'Erro ao atualizar metas',
                      });
                    }
                  }}
                  disabled={savingGoals}
                  style={{
                    flex: 1,
                    backgroundColor: savingGoals
                      ? theme.colors.border || '#E5E7EB'
                      : '#EF4444',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: savingGoals ? 0.5 : 1,
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                >
                  {savingGoals ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#FFFFFF',
                    }}>
                      {t('common.save') || 'Guardar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Editar Carboidratos */}
      <Modal
        visible={showEditCarbsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditCarbsModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
            onPress={() => setShowEditCarbsModal(false)}
          >
            <View style={{ width: '100%', maxWidth: 400 }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 24,
                padding: 28,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#D1FAE5',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="fast-food" size={28} color="#10B981" />
              </View>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {t('dashboard.carbs') || 'Carboidratos'}
                  </Text>
                </View>
      <TouchableOpacity
                  onPress={() => setShowEditCarbsModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color={theme.colors.text} />
      </TouchableOpacity>
              </View>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                {t('dashboard.editCarbsDescription') || 'Change your daily carbs goal'}
              </Text>
              <View style={{
                marginBottom: 24,
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  paddingHorizontal: 16,
                }}>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 18,
                      fontSize: 32,
                      fontWeight: '800',
                      color: theme.colors.text,
                      textAlign: 'center',
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                    }}
                    value={editCarbs}
                    onChangeText={setEditCarbs}
                    keyboardType="numeric"
                    placeholder="200"
                    placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                    autoFocus
                  />
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginLeft: 8,
                  }}>
                    g
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowEditCarbsModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {t('common.cancel') || 'Cancelar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const carbs = parseInt(editCarbs) || 0;
                    setSavingGoals(true);
                    try {
                      await updateProfile({
                        dailyCarbsGoal: carbs,
                      } as any);
                      await refreshProfile();
                      setShowEditCarbsModal(false);
                      setSavingGoals(false);
                      Toast.show({
                        type: 'success',
                        text1: t('profile.updateSuccess') || 'Sucesso',
                        text2: t('dashboard.goalsUpdated') || 'Metas atualizadas com sucesso',
                      });
                    } catch (error: any) {
                      setSavingGoals(false);
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: error.message || t('profile.updateError') || 'Erro ao atualizar metas',
                      });
                    }
                  }}
                  disabled={savingGoals}
                  style={{
                    flex: 1,
                    backgroundColor: savingGoals
                      ? theme.colors.border || '#E5E7EB'
                      : '#10B981',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: savingGoals ? 0.5 : 1,
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                >
                  {savingGoals ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#FFFFFF',
                    }}>
                      {t('common.save') || 'Guardar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Editar Gordura */}
      <Modal
        visible={showEditFatModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditFatModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
            onPress={() => setShowEditFatModal(false)}
          >
            <View style={{ width: '100%', maxWidth: 400 }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 24,
                padding: 28,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#FEF9C3',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="flame" size={28} color="#EAB308" />
                  </View>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {t('dashboard.fat') || 'Gordura'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowEditFatModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                {t('dashboard.editFatDescription') || 'Change your daily fat goal'}
              </Text>
              <View style={{
                marginBottom: 24,
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  paddingHorizontal: 16,
                }}>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 18,
                      fontSize: 32,
                      fontWeight: '800',
                      color: theme.colors.text,
                      textAlign: 'center',
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                    }}
                    value={editFat}
                    onChangeText={setEditFat}
                    keyboardType="numeric"
                    placeholder="67"
                    placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                    autoFocus
                  />
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginLeft: 8,
                  }}>
                    g
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowEditFatModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {t('common.cancel') || 'Cancelar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const fat = parseInt(editFat) || 0;
                    setSavingGoals(true);
                    try {
                      await updateProfile({
                        dailyFatGoal: fat,
                      } as any);
                      await refreshProfile();
                      setShowEditFatModal(false);
                      setSavingGoals(false);
                      Toast.show({
                        type: 'success',
                        text1: t('profile.updateSuccess') || 'Sucesso',
                        text2: t('dashboard.goalsUpdated') || 'Metas atualizadas com sucesso',
                      });
                    } catch (error: any) {
                      setSavingGoals(false);
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: error.message || t('profile.updateError') || 'Erro ao atualizar metas',
                      });
                    }
                  }}
                  disabled={savingGoals}
                  style={{
                    flex: 1,
                    backgroundColor: savingGoals
                      ? theme.colors.border || '#E5E7EB'
                      : '#EAB308',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: savingGoals ? 0.5 : 1,
                    shadowColor: '#EAB308',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  activeOpacity={0.8}
                >
                  {savingGoals ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#FFFFFF',
                    }}>
                      {t('common.save') || 'Guardar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Streak Modal */}
      <Modal
        visible={showStreakModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStreakModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={async () => {
            // Marcar que já mostrou o modal hoje
            if (user) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const todayStr = today.toDateString();
              const lastShownKey = `streakModalShown_${user.uid}`;
              await setCache(lastShownKey, todayStr);
            }
            setShowStreakModal(false);
          }}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              backgroundColor: theme.colors.background || '#FFFFFF',
              borderRadius: 32,
              padding: 0,
              width: screenWidth - 40,
              maxWidth: 420,
              alignItems: 'center',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <Pressable
              style={{ width: '100%' }}
              onPress={(e) => e.stopPropagation()}
            >
            {/* Background gradient decorativo - mais sutil e elegante */}
            <LinearGradient
              colors={[
                theme.isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
                theme.isDark ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.04)',
                'transparent'
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 140,
              }}
            />

            {/* Header com ícone de flame e número - posicionado no topo direito */}
            <MotiView
              from={{ opacity: 0, translateX: 20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 200 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                width: '100%',
                paddingTop: 24,
                paddingRight: 24,
                paddingBottom: 8,
              }}
            >
              <LinearGradient
                colors={['#F97316', '#FB923C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 24,
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Ionicons name="flame" size={18} color="#FFFFFF" />
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                  {profile?.streak || 0}
                </Text>
              </LinearGradient>
            </MotiView>

            {/* Conteúdo principal */}
            <View style={{
              paddingHorizontal: 32,
              paddingBottom: 32,
              alignItems: 'center',
              width: '100%',
            }}>
              {/* Número grande do streak com gradiente */}
              <MotiView
                from={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 100 }}
                style={{
                  marginBottom: 12,
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={['#16A34A', '#22C55E', '#4ADE80']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#16A34A',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <Text style={{
                    fontSize: 56,
                    fontWeight: '900',
                    color: '#FFFFFF',
                    textShadowColor: 'rgba(0, 0, 0, 0.1)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 4,
                  }}>
                    {profile?.streak || 0}
                  </Text>
                </LinearGradient>
              </MotiView>

              {/* "Day Streak!" */}
              <MotiView
                from={{ opacity: 0, translateY: -10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 500, delay: 300 }}
              >
                <Text style={{
                  fontSize: 24,
                  fontWeight: '800',
                  color: '#16A34A',
                  marginBottom: 32,
                  letterSpacing: 0.5,
                }}>
                  {t('dashboard.streakModal.title') || 'Day Streak!'}
                </Text>
              </MotiView>

              {/* Container para centralizar as bolinhas e o card */}
              <View style={{
                width: '100%',
                alignItems: 'center',
                marginBottom: 28,
              }}>
                {/* Últimos 6 dias - melhorado e centralizado */}
                <View style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                }}>
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dayLabels = [
                      t('dashboard.streakModal.daySun') || 'S',
                      t('dashboard.streakModal.dayMon') || 'M',
                      t('dashboard.streakModal.dayTue') || 'T',
                      t('dashboard.streakModal.dayWed') || 'W',
                      t('dashboard.streakModal.dayThu') || 'T',
                      t('dashboard.streakModal.dayFri') || 'F',
                      t('dashboard.streakModal.daySat') || 'S',
                    ];
                    
                    return Array.from({ length: 6 }, (_, i) => {
                      const checkDate = new Date(today);
                      checkDate.setDate(checkDate.getDate() - (5 - i)); // Do mais antigo (5 dias atrás) até hoje
                      const dateStr = checkDate.toDateString();
                      const hasMeal = last7DaysWithMeals.has(dateStr);
                      const dayOfWeek = checkDate.getDay();
                      const label = dayLabels[dayOfWeek];
                      
                      return (
                        <MotiView
                          key={i}
                          from={{ opacity: 0, scale: 0.3, translateY: 20 }}
                          animate={{ opacity: 1, scale: 1, translateY: 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 400 + (i * 80) }}
                          style={{ alignItems: 'center', gap: 6 }}
                        >
                          <Text style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 2,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}>
                            {label}
                          </Text>
                          <MotiView
                            from={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 300, delay: 500 + (i * 80) }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: hasMeal ? '#16A34A' : (theme.isDark ? '#374151' : '#F3F4F6'),
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: hasMeal ? 2 : 0,
                              borderColor: hasMeal ? '#22C55E' : 'transparent',
                              shadowColor: hasMeal ? '#16A34A' : 'transparent',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: hasMeal ? 0.3 : 0,
                              shadowRadius: 4,
                              elevation: hasMeal ? 3 : 0,
                            }}
                          >
                            {hasMeal && (
                              <MotiView
                                from={{ scale: 0, rotate: '-180deg' }}
                                animate={{ scale: 1, rotate: '0deg' }}
                                transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 600 + (i * 80) }}
                              >
                                <Ionicons name="checkmark" size={22} color="#FFFFFF" style={{ fontWeight: 'bold' }} />
                              </MotiView>
                            )}
                          </MotiView>
                        </MotiView>
                      );
                    });
                  })()}
                </View>

                {/* Dica com ícone - mesma largura das bolinhas */}
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 1000 }}
                  style={{
                    backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                    borderRadius: 16,
                    padding: 16,
                    width: '100%',
                    maxWidth: 320, // Largura aproximada das 6 bolinhas + gaps
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                  }}
                >
                  <MotiView
                    from={{ scale: 0, rotate: '-180deg' }}
                    animate={{ scale: 1, rotate: '0deg' }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 1100 }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="bulb" size={18} color="#F59E0B" />
                  </MotiView>
                  <Text style={{
                    fontSize: 13,
                    color: theme.colors.textSecondary || '#6B7280',
                    textAlign: 'left',
                    flex: 1,
                    lineHeight: 18,
                  }}>
                    {t('dashboard.streakModal.tip') || 'Tip: Skipping a day resets your streak. Don\'t forget tomorrow!'}
                  </Text>
                </MotiView>
              </View>

              {/* Botão Continue melhorado */}
              <MotiView
                from={{ opacity: 0, scale: 0.9, translateY: 10 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 1200 }}
                style={{
                  width: '100%',
                }}
              >
                <TouchableOpacity
                  onPress={async () => {
                    // Marcar que já mostrou o modal hoje
                    if (user) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const todayStr = today.toDateString();
                      const lastShownKey = `streakModalShown_${user.uid}`;
                      await setCache(lastShownKey, todayStr);
                    }
                    setShowStreakModal(false);
                  }}
                  style={{
                    width: '100%',
                    borderRadius: 18,
                    paddingVertical: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#16A34A', '#22C55E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 18,
                    }}
                  />
                  <Text style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: '#FFFFFF',
                    letterSpacing: 0.5,
                  }}>
                    {t('dashboard.streakModal.continue') || 'Continue'}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            </View>
            </Pressable>
          </MotiView>
        </Pressable>
      </Modal>

      {/* Badge Notification Modal */}
      <BadgeNotificationModal
        visible={showModal}
        badge={earnedBadge}
        onClose={closeModal}
      />
    </View>
  );
}

