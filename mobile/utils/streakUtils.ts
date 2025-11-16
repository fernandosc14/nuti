/**
 * Streak Utilities
 * 
 * Funções para gerenciar streaks (sequências de dias consecutivos)
 */

import { db } from '../services/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Verifica e atualiza o streak do utilizador
 * Streak aumenta se o utilizador registou ≥1 refeição no dia
 */
export async function updateStreak(userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Contar refeições de hoje
    const mealsRef = collection(db, 'meals');
    const q = query(
      mealsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(today)),
      where('date', '<', Timestamp.fromDate(tomorrow))
    );

    const snapshot = await getDocs(q);
    const mealCount = snapshot.size;

    // Buscar perfil do utilizador
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return 0;
    }

    const userData = userSnap.data();
    const lastStreakDate = userData.lastStreakDate?.toDate();
    const currentStreak = userData.streak || 0;

    const todayStr = today.toDateString();
    const lastStreakStr = lastStreakDate?.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // Se tem ≥1 refeição hoje, atualizar streak
    if (mealCount >= 1) {
      // Verificar se já atualizou hoje
      if (lastStreakStr !== todayStr) {
        // Verificar se foi ontem (continua streak) ou outro dia (reset)
        let newStreak = 1;
        if (lastStreakStr === yesterdayStr) {
          // Continua streak
          newStreak = currentStreak + 1;
        }

        await setDoc(userRef, {
          streak: newStreak,
          lastStreakDate: Timestamp.fromDate(today),
        }, { merge: true });

        return newStreak;
      }

      return currentStreak;
    } else {
      // Se tem <1 refeição hoje, verificar se perdeu o streak
      // Se o último streak foi há mais de 1 dia, resetar para 0
      if (lastStreakStr && lastStreakStr !== todayStr && lastStreakStr !== yesterdayStr) {
        // Perdeu o streak (último streak foi há 2+ dias)
        await setDoc(userRef, {
          streak: 0,
        }, { merge: true });
        return 0;
      }
    }

    // Retornar streak atual
    return currentStreak;
  } catch (error: any) {
    // Ignorar erros de permissões silenciosamente (pode ser que o utilizador não esteja autenticado)
    if (error?.code === 'permission-denied') {
      return 0;
    }
    console.error('Error updating streak:', error);
    return 0;
  }
}

/**
 * Obtém o streak atual do utilizador
 */
export async function getStreak(userId: string): Promise<number> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    return userSnap.data()?.streak || 0;
  } catch (error: any) {
    // Ignorar erros de permissões silenciosamente
    if (error?.code === 'permission-denied') {
      return 0;
    }
    console.error('Error getting streak:', error);
    return 0;
  }
}

