/**
 * DashboardScreen
 * 
 * Tela principal com gráfico circular, streak, badges e lista de refeições
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { ChartCircle } from '../components/ChartCircle';
import { MealCard } from '../components/MealCard';
import { BadgeItem } from '../components/BadgeItem';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updateStreak } from '../utils/streakUtils';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';

interface Meal {
  id: string;
  name: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  image?: string;
  date: Date;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: Date;
}

export function DashboardScreen({ navigation }: any) {
  const { user, profile, refreshProfile } = useUser();
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    }
  }, [user, profile]);

  const loadDashboardData = async () => {
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

      // Calcular meta de calorias baseada no perfil
      if (profile?.weight && profile?.height) {
        const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * 30 + 5;
        const goalMultiplier =
          profile.goal === 'lose' ? 0.8 : profile.goal === 'gain' ? 1.2 : 1;
        setGoal(Math.round(bmr * 1.5 * goalMultiplier));
      }

      // Verificar novamente antes de query
      if (!user || user.uid !== currentUserId) {
        return;
      }

      // Buscar refeições de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mealsRef = collection(db, 'meals');
      const q = query(
        mealsRef,
        where('userId', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<', Timestamp.fromDate(tomorrow))
      );

      const snapshot = await getDocs(q);
      
      // Verificar novamente após query
      if (!user || user.uid !== currentUserId) {
        return;
      }

      const mealsData: Meal[] = [];
      let totalCalories = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        mealsData.push({
          id: doc.id,
          name: data.name,
          calories: data.calories,
          mealType: data.mealType || 'snack',
          image: data.image,
          date: data.date?.toDate() || new Date(),
        });
        totalCalories += data.calories;
      });

      // Verificar novamente antes de setState
      if (!user || user.uid !== currentUserId) {
        return;
      }

      setMeals(mealsData.sort((a, b) => b.date.getTime() - a.date.getTime()));
      setConsumed(totalCalories);

      // Buscar badges
      if (profile?.badges && profile.badges.length > 0) {
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
        }
      }

      // Verificar antes de atualizar streak
      if (user && user.uid === currentUserId) {
        await updateStreak(user.uid);
        await refreshProfile();
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
        text1: 'Erro',
        text2: 'Erro ao carregar dados',
      });
    } finally {
      // Só atualizar loading se ainda for o mesmo user
      if (user && user.uid === currentUserId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    if (!user) return;
    setRefreshing(true);
    loadDashboardData();
  };

  // Se não houver user, não renderizar nada (navegação vai redirecionar)
  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3BB273" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-6 py-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                Olá, {profile?.name || 'Utilizador'}! 👋
              </Text>
              <Text className="text-gray-500 dark:text-gray-400">
                Como está a correr o teu dia?
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
            >
              <Ionicons name="person" size={20} color="#3BB273" />
            </TouchableOpacity>
          </View>

          {/* Streak */}
          {profile && profile.streak > 0 && (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 300 }}
              className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900 dark:to-red-900 rounded-2xl p-4 mb-6 flex-row items-center"
              style={{
                backgroundColor: '#FED7AA',
              }}
            >
              <Ionicons name="flame" size={32} color="#F97316" />
              <View className="ml-4 flex-1">
                <Text className="font-bold text-gray-900 dark:text-white text-lg">
                  {profile.streak} dias consecutivos!
                </Text>
                <Text className="text-gray-600 dark:text-gray-300 text-sm">
                  Continua assim! 🔥
                </Text>
              </View>
            </MotiView>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="trophy" size={20} color="#3BB273" />
                <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                  Badges Recentes
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {badges.map((badge) => (
                  <BadgeItem key={badge.id} {...badge} size="small" />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Gráfico Circular */}
          <View className="mb-6">
            <ChartCircle consumed={consumed} goal={goal} />
          </View>

          {/* Refeições de Hoje */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Refeições de Hoje
            </Text>
            {meals.length === 0 ? (
              <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 items-center">
                <Text className="text-gray-500 dark:text-gray-400 text-center mb-2">
                  Ainda não registaste refeições hoje.
                </Text>
                <Text className="text-sm text-gray-400 dark:text-gray-500 text-center">
                  Adiciona a tua primeira refeição! 🍽️
                </Text>
              </View>
            ) : (
              meals.map((meal) => (
                <MealCard
                  key={meal.id}
                  {...meal}
                  time={meal.date.toLocaleTimeString('pt-PT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              ))
            )}
          </View>

          {/* Premium Banner */}
          {profile?.plan === 'free' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Premium')}
              className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-4 mb-6"
            >
              <View className="flex-row items-center">
                <Ionicons name="star" size={24} color="#FFFFFF" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-semibold text-base">
                    ✨ Atualiza para Premium
                  </Text>
                  <Text className="text-white/90 text-sm">
                    Chat IA ilimitado e relatórios personalizados!
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Botão Flutuante */}
      <TouchableOpacity
        onPress={() => navigation.navigate('AddMeal')}
        className="absolute bottom-6 right-6 w-16 h-16 bg-green-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 8 }}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

