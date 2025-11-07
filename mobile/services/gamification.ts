/**
 * Gamification Service
 * 
 * Serviço para gerenciar badges e gamificação
 */

import { db } from '../services/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

/**
 * Inicializa badges padrão no Firestore
 */
export async function initializeBadges() {
  const badges: Badge[] = [
    {
      id: 'first_meal',
      name: 'Primeira Refeição',
      description: 'Registaste a tua primeira refeição!',
      icon: '🎉',
      requirement: 'first_meal',
    },
    {
      id: 'streak_3',
      name: '3 Dias Seguidos',
      description: 'Mantiveste o hábito por 3 dias!',
      icon: '🔥',
      requirement: 'streak_3',
    },
    {
      id: 'streak_7',
      name: 'Semana Perfeita',
      description: '7 dias consecutivos!',
      icon: '⭐',
      requirement: 'streak_7',
    },
    {
      id: 'streak_30',
      name: 'Mês Perfeito',
      description: '30 dias consecutivos!',
      icon: '🏆',
      requirement: 'streak_30',
    },
    {
      id: 'meals_10',
      name: '10 Refeições',
      description: 'Registaste 10 refeições!',
      icon: '🍽️',
      requirement: 'meals_10',
    },
    {
      id: 'meals_50',
      name: '50 Refeições',
      description: 'Registaste 50 refeições!',
      icon: '🎯',
      requirement: 'meals_50',
    },
  ];

  for (const badge of badges) {
    const badgeRef = doc(db, 'badges', badge.id);
    const badgeSnap = await getDoc(badgeRef);
    if (!badgeSnap.exists()) {
      await setDoc(badgeRef, badge);
    }
  }
}

/**
 * Verifica e atribui badges ao utilizador
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  try {
    // Buscar perfil do utilizador
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return [];

    const userData = userSnap.data();
    const currentBadges = userData.badges || [];
    const streak = userData.streak || 0;

    // Contar refeições totais
    const mealsRef = collection(db, 'meals');
    const mealsQuery = query(mealsRef, where('userId', '==', userId));
    const mealsSnapshot = await getDocs(mealsQuery);
    const mealCount = mealsSnapshot.size;

    // Buscar todas as badges
    const badgesRef = collection(db, 'badges');
    const badgesSnapshot = await getDocs(badgesRef);
    const allBadges = badgesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Badge[];

    const newBadges: string[] = [];

    for (const badge of allBadges) {
      // Se já tem a badge, continuar
      if (currentBadges.includes(badge.id)) continue;

      let shouldAward = false;

      switch (badge.requirement) {
        case 'first_meal':
          shouldAward = mealCount >= 1;
          break;
        case 'streak_3':
          shouldAward = streak >= 3;
          break;
        case 'streak_7':
          shouldAward = streak >= 7;
          break;
        case 'streak_30':
          shouldAward = streak >= 30;
          break;
        case 'meals_10':
          shouldAward = mealCount >= 10;
          break;
        case 'meals_50':
          shouldAward = mealCount >= 50;
          break;
      }

      if (shouldAward) {
        newBadges.push(badge.id);
      }
    }

    // Atualizar badges do utilizador
    if (newBadges.length > 0) {
      await setDoc(
        userRef,
        {
          badges: [...currentBadges, ...newBadges],
        },
        { merge: true }
      );
    }

    return newBadges;
  } catch (error) {
    console.error('Error checking badges:', error);
    return [];
  }
}

/**
 * Obtém badges do utilizador
 */
export async function getUserBadges(userId: string): Promise<Badge[]> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return [];

    const userData = userSnap.data();
    const badgeIds = userData.badges || [];

    if (badgeIds.length === 0) return [];

    const badges: Badge[] = [];

    for (const badgeId of badgeIds) {
      const badgeRef = doc(db, 'badges', badgeId);
      const badgeSnap = await getDoc(badgeRef);
      if (badgeSnap.exists()) {
        badges.push({
          id: badgeSnap.id,
          ...badgeSnap.data(),
        } as Badge);
      }
    }

    return badges;
  } catch (error) {
    console.error('Error getting user badges:', error);
    return [];
  }
}

