/**
 * Streak Utilities
 * 
 * Funções para gerenciar streaks (sequências de dias consecutivos)
 */

import { db } from '../services/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Verifica e atualiza o streak do utilizador
 * Streak aumenta se o utilizador registou ≥3 refeições no dia
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

    // Se tem ≥3 refeições hoje, atualizar streak
    if (mealCount >= 3) {
      // Buscar perfil do utilizador
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const lastStreakDate = userData.lastStreakDate?.toDate();
        const currentStreak = userData.streak || 0;

        // Verificar se já atualizou hoje
        const todayStr = today.toDateString();
        const lastStreakStr = lastStreakDate?.toDateString();

        if (lastStreakStr !== todayStr) {
          // Verificar se foi ontem (continua streak) ou outro dia (reset)
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toDateString();

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
      }
    }

    // Buscar streak atual
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    return userSnap.data()?.streak || 0;
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

