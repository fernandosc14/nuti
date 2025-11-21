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
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, Timestamp, doc, deleteDoc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updateStreak } from '../utils/streakUtils';
import { calculateCalorieGoalFromProfile } from '../utils/nutritionUtils';
import { getCache, setCache, removeCache } from '../utils/cacheUtils';
import Toast from 'react-native-toast-message';
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
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: Date;
}

interface Exercise {
  id: string;
  name: string;
  duration: number; // em minutos
  date: Date;
  addedAt?: Date | null;
}

export function DashboardScreen({ navigation }: any) {
  const { user, profile, refreshProfile, updateProfile } = useUser();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { setSelectedDate: setContextSelectedDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
  const [logoError, setLogoError] = useState(false);
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [macros, setMacros] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
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
  const [showEditProteinModal, setShowEditProteinModal] = useState(false);
  const [showEditCarbsModal, setShowEditCarbsModal] = useState(false);
  const [showEditFatModal, setShowEditFatModal] = useState(false);
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    // Se não houver user, limpar estado e não carregar dados
    if (!user) {
      setLoading(false);
      setMeals([]);
      setBadges([]);
      setConsumed(0);
      return;
    }

    // Só carregar dados se houver user e profile
    if (user && profile) {
      loadDashboardData();
      loadDaysWithMeals(); // Carregar quais dias têm refeições
      loadExercises(selectedDate);
    }
  }, [user, profile, selectedDate]);

  // Recarregar quando a tela recebe foco (quando volta de adicionar refeição, editar objetivo, etc)
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile) {
        // Usar cache primeiro (não forçar refresh imediatamente)
        // Só fazer refresh forçado se o utilizador fizer pull-to-refresh
        loadDashboardData(false);
        loadDaysWithMeals();
        loadExercises(selectedDate, false);
      }
    }, [user, profile])
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

      const sortedMeals = mealsData.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setMeals(sortedMeals);
      setConsumed(totalCalories);
      setMacros({
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
      });


      // Buscar badges (usar cache - badges raramente mudam)
      if (profile?.badges && profile.badges.length > 0) {
        const badgesCacheKey = `badges_${currentUserId}`;
        
        // Tentar cache primeiro
        if (!forceRefresh) {
          const cachedBadges = await getCache<Badge[]>(badgesCacheKey);
          if (cachedBadges && cachedBadges.length > 0) {
            if (user && user.uid === currentUserId) {
              setBadges(cachedBadges);
            }
          } else {
            // Se não houver cache, buscar do Firestore
            const badgesRef = collection(db, 'badges');
            const badgesData: Badge[] = [];

            for (const badgeId of profile.badges.slice(0, 3)) {
              // Verificar antes de cada query
              if (!user || user.uid !== currentUserId) {
                return;
              }

              const badgeDoc = await getDocs(
                query(badgesRef, where('__name__', '==', badgeId))
              );
              if (!badgeDoc.empty) {
                const badgeData = badgeDoc.docs[0].data();
                badgesData.push({
                  id: badgeId,
                  name: badgeData.name,
                  icon: badgeData.icon,
                  description: badgeData.description,
                });
              }
            }

            // Verificar antes de setState
            if (user && user.uid === currentUserId) {
              setBadges(badgesData);
              // Guardar no cache (TTL padrão de 5 minutos é suficiente para badges)
              await setCache(badgesCacheKey, badgesData);
            }
          }
        } else {
          // Se for refresh forçado, buscar do Firestore
          const badgesRef = collection(db, 'badges');
          const badgesData: Badge[] = [];

          for (const badgeId of profile.badges.slice(0, 3)) {
            // Verificar antes de cada query
            if (!user || user.uid !== currentUserId) {
              return;
            }

            const badgeDoc = await getDocs(
              query(badgesRef, where('__name__', '==', badgeId))
            );
            if (!badgeDoc.empty) {
              const badgeData = badgeDoc.docs[0].data();
              badgesData.push({
                id: badgeId,
                name: badgeData.name,
                icon: badgeData.icon,
                description: badgeData.description,
              });
            }
          }

          // Verificar antes de setState
          if (user && user.uid === currentUserId) {
            setBadges(badgesData);
            // Atualizar cache
            await setCache(badgesCacheKey, badgesData);
          }
        }
      }

      // Carregar água do dia selecionado (só se ainda houver user)
      if (user && user.uid === currentUserId) {
        await loadWaterIntake(selectedDay);
        await loadSteps(selectedDay);
        await loadExercises(selectedDay);
      }

      // Verificar antes de atualizar streak (só se for o dia atual)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDayNormalized = new Date(selectedDate);
      selectedDayNormalized.setHours(0, 0, 0, 0);
      
      if (user && user.uid === currentUserId) {
        if (selectedDayNormalized.getTime() === today.getTime()) {
          // Contar refeições de hoje para mostrar no streak
          const todayMealsRef = collection(db, 'meals');
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const todayMealsQuery = query(
            todayMealsRef,
            where('userId', '==', user.uid),
            where('date', '>=', Timestamp.fromDate(today)),
            where('date', '<', Timestamp.fromDate(tomorrow))
          );
          const todayMealsSnapshot = await getDocs(todayMealsQuery);
          setTodayMealCount(todayMealsSnapshot.size);
          
      await updateStreak(user.uid);
      await refreshProfile();
        } else {
          // Se não for hoje, usar o número de refeições do dia selecionado
          setTodayMealCount(mealsData.length);
        }
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

  const handleDeleteMeal = (mealId: string) => {
    setMealToDelete(mealId);
    setShowDeleteModal(true);
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
        });
      });

      if (user && user.uid === currentUserId) {
        const sortedExercises = exercisesData.sort((a, b) => b.date.getTime() - a.date.getTime());
        setExercises(sortedExercises);
        
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const waterDocRef = doc(db, 'water', `${user.uid}_${dateStr}`);
      const waterDoc = await getDoc(waterDocRef);

      let newAmount = amount;
      if (waterDoc.exists()) {
        const currentAmount = waterDoc.data().amount || 0;
        newAmount = currentAmount + amount;
      }

      await setDoc(waterDocRef, {
        userId: user.uid,
        date: Timestamp.fromDate(today),
        amount: newAmount,
        updatedAt: Timestamp.now(),
      });

      setWaterIntake(newAmount);
      setShowWaterModal(false);
      setWaterAmount('250');

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const waterDocRef = doc(db, 'water', `${user.uid}_${dateStr}`);

      if (amount === 0) {
        // Se a quantidade for 0, eliminar o documento
        await deleteDoc(waterDocRef);
        setWaterIntake(0);
      } else {
        await setDoc(waterDocRef, {
          userId: user.uid,
          date: Timestamp.fromDate(today),
          amount: amount,
          updatedAt: Timestamp.now(),
        });
        setWaterIntake(amount);
      }

      setShowEditWaterModal(false);
      setEditWaterAmount('0');

      Toast.show({
        type: 'success',
        text1: t('dashboard.waterUpdated'),
        text2: t('dashboard.waterUpdatedMessage'),
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
    if (!mealToDelete) return;
    
    try {
      const mealRef = doc(db, 'meals', mealToDelete);
      await deleteDoc(mealRef);
      
      // Fechar modais
      setShowDeleteModal(false);
      setShowMealModal(false);
      setMealToDelete(null);
      
      // Invalidar cache de daysWithMeals (pode ter mudado)
      if (user) {
        const daysWithMealsCacheKey = `daysWithMeals_${user.uid}`;
        await removeCache(daysWithMealsCacheKey);
      }
      
      // Recarregar dados para atualizar totais e macros (forçar refresh)
      await loadDashboardData(true);
      await loadDaysWithMeals(); // Atualizar quais dias têm refeições
      
      Toast.show({
        type: 'success',
        text1: t('dashboard.mealDeleted'),
        text2: t('dashboard.mealDeletedMessage'),
      });
    } catch (error: any) {
      console.error('Error deleting meal:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('dashboard.deleteMealError'),
      });
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

  const backgroundStyle = !theme?.isDark 
    ? { flex: 1 } 
    : { flex: 1, backgroundColor: theme?.colors?.background || '#FFFFFF' };

  return (
    <View style={backgroundStyle}>
      {!theme?.isDark && (
        <LinearGradient
          colors={['#FFFFFF', '#F0FDF4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
              alignItems: 'flex-end',
              marginBottom: 24,
            }}>
              <View style={{ flex: 1 }}>
                {/* Logo - muda conforme o tema */}
                <View style={{ height: 55, justifyContent: 'center', width: 55 }}>
                  {!logoError ? (
                    <Image
                      source={theme.isDark ? require('../assets/logo-b.png') : require('../assets/logo-n.png')}
                      style={{
                        width: 55,
                        height: 55,
                        resizeMode: 'contain',
                      }}
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <View style={{
                      width: 45,
                      height: 45,
                      borderRadius: 22.5,
                      backgroundColor: theme.colors.primary || '#3BB273',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: '#FFFFFF',
                      }}>N</Text>
                    </View>
                  )}
                </View>
          </View>

              {/* Badges: Streak e Steps */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                {/* Streak Badge */}
                {profile && (
                  <View style={{
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
                  </View>
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
                
                {/* Steps Badge */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: steps > 0
                    ? (theme.isDark ? '#1F2937' : '#374151')
                    : (theme.colors.card || '#FFFFFF'),
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: steps > 0 ? 0 : 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}>
                  <Ionicons 
                    name="walk" 
                    size={16} 
                    color={steps > 0 ? "#3BB273" : (theme.colors.textSecondary || '#9CA3AF')} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: steps > 0 ? "#FFFFFF" : (theme.colors.text || '#000000'),
                  }}>
                    {steps > 0 ? steps.toLocaleString() : '0'}
              </Text>
            </View>
                
                {/* Badges/Conquistas Badge */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: badges.length > 0
                    ? (theme.isDark ? '#1F2937' : '#374151')
                    : (theme.colors.card || '#FFFFFF'),
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: badges.length > 0 ? 0 : 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}>
                  <Ionicons 
                    name="trophy" 
                    size={16} 
                    color={badges.length > 0 ? "#F59E0B" : (theme.colors.textSecondary || '#9CA3AF')} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: badges.length > 0 ? "#FFFFFF" : (theme.colors.text || '#000000'),
                  }}>
                    {badges.length}
                  </Text>
                </View>
              </View>
              </View>
            </MotiView>

          {/* Badges */}
          {badges.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateX: -20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 100 }}
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
                  <Ionicons name="trophy" size={22} color={theme.colors.primary || '#3BB273'} />
                </View>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.text,
                }}>
                  {t('dashboard.badges')}
                </Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {badges.map((badge, index) => (
                  <MotiView
                    key={badge.id}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'timing', duration: 300, delay: index * 100 }}
                  >
                    <BadgeItem {...badge} size="small" />
                  </MotiView>
                ))}
              </ScrollView>
            </MotiView>
          )}

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

          {/* Premium Promo Card */}
          <PremiumPromoCard
            variant="compact"
            fullWidth={true}
            onPress={() => navigation.navigate('Premium')}
          />

          {/* Gráfico Circular */}
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 200 }}
            style={{ marginBottom: 24 }}
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
                          setShowMealModal(true);
                        }}
                        onDelete={() => handleDeleteMeal(meal.id)}
                />
                    </MotiView>
                  ))}
          </View>
            )}
          </MotiView>

          {/* Exercícios de Hoje */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 350 }}
            style={{ marginBottom: 24 }}
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
                    <View style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: 16,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                    }}>
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
                        onPress={async () => {
                          try {
                            await deleteDoc(doc(db, 'exercises', exercise.id));
                            await loadExercises(selectedDate);
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
                        activeOpacity={0.7}
                        style={{
                          padding: 8,
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
                      </TouchableOpacity>
                    </View>
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
        onRequestClose={() => setShowMealModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowMealModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 30,
              paddingTop: 20,
              paddingBottom: 20,
              paddingHorizontal: 20,
              width: '90%',
              maxHeight: '80%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {selectedMeal && (
              <>
                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: theme.colors.text,
                    flex: 1,
                  }} numberOfLines={2}>
                    {selectedMeal.name}
                  </Text>
            <TouchableOpacity
                    onPress={() => setShowMealModal(false)}
                    style={{
                      padding: 8,
                      marginLeft: 12,
                    }}
                  >
                    <Ionicons name="close" size={24} color={theme.colors.text} />
      </TouchableOpacity>
                </View>

                {/* Informações */}
                <View>
                  {/* Imagem */}
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
                          height: 150,
                        }}
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  <View style={{ gap: 14 }}>
                    {/* Tipo de Refeição */}
                    <View>
                      <Text style={{
                        fontSize: 13,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 6,
                        fontWeight: '600',
                      }}>
                        {t('dashboard.mealType')}
                  </Text>
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
                    <View>
                      <Text style={{
                        fontSize: 13,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 6,
                        fontWeight: '600',
                      }}>
                        {t('dashboard.dateTime')}
                      </Text>
                      <Text style={{
                        fontSize: 16,
                        color: theme.colors.text,
                        fontWeight: '700',
                      }}>
                        {selectedMeal.date && selectedMeal.date instanceof Date && !isNaN(selectedMeal.date.getTime()) 
                          ? `${selectedMeal.date.toLocaleDateString('pt-PT', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })} às ${selectedMeal.date.toLocaleTimeString('pt-PT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''}
                      </Text>
              </View>

                    {/* Calorias */}
                    <View style={{
                      backgroundColor: theme.colors.primary + '20',
                      borderRadius: 14,
                      padding: 12,
                    }}>
                      <Text style={{
                        fontSize: 28,
                        color: theme.colors.primary || '#3BB273',
                        fontWeight: '800',
                      }}>
                        {selectedMeal.calories} kcal
                      </Text>
                    </View>

                    {/* Macros */}
                    {(selectedMeal.protein !== undefined || selectedMeal.carbs !== undefined || selectedMeal.fat !== undefined) && (
                      <View>
                        <Text style={{
                          fontSize: 14,
                          color: theme.colors.text,
                          marginBottom: 12,
                          fontWeight: '700',
                        }}>
                          {t('dashboard.macros')}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {selectedMeal.protein !== undefined && (
                            <View style={{
                              flex: 1,
                              backgroundColor: '#FEE2E2',
                              borderRadius: 14,
                              padding: 12,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: '#FECACA',
                            }}>
                              <Ionicons name="nutrition" size={20} color="#EF4444" />
                              <Text style={{
                                fontSize: 20,
                                fontWeight: '800',
                                color: '#EF4444',
                                marginTop: 6,
                              }}>
                                {Math.round(selectedMeal.protein)}g
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: '#991B1B',
                                marginTop: 3,
                                fontWeight: '600',
                              }}>
                                {t('dashboard.protein')}
                              </Text>
                            </View>
                          )}
                          {selectedMeal.carbs !== undefined && (
                            <View style={{
                              flex: 1,
                              backgroundColor: '#D1FAE5',
                              borderRadius: 14,
                              padding: 12,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                            }}>
                              <Ionicons name="fast-food" size={20} color="#10B981" />
                              <Text style={{
                                fontSize: 20,
                                fontWeight: '800',
                                color: '#10B981',
                                marginTop: 6,
                              }}>
                                {Math.round(selectedMeal.carbs)}g
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: '#047857',
                                marginTop: 3,
                                fontWeight: '600',
                              }}>
                                {t('dashboard.carbs')}
                              </Text>
                            </View>
                          )}
                          {selectedMeal.fat !== undefined && (
                            <View style={{
                              flex: 1,
                              backgroundColor: '#FEF9C3',
                              borderRadius: 14,
                              padding: 12,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: '#FDE68A',
                            }}>
                              <Ionicons name="flame" size={20} color="#EAB308" />
                              <Text style={{
                                fontSize: 20,
                                fontWeight: '800',
                                color: '#EAB308',
                                marginTop: 6,
                              }}>
                                {Math.round(selectedMeal.fat)}g
                              </Text>
                              <Text style={{
                                fontSize: 12,
                                color: '#A16207',
                                marginTop: 3,
                                fontWeight: '600',
                              }}>
                                {t('dashboard.fat')}
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
                        backgroundColor: '#FEE2E2',
                        borderRadius: 14,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4,
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      <Text style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#EF4444',
                        marginLeft: 8,
                      }}>
                        {t('dashboard.delete')}
                      </Text>
            </TouchableOpacity>
                  </View>
                </View>
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
                  {t('dashboard.delete')}
                </Text>
              </TouchableOpacity>
            </View>
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
    </View>
  );
}

