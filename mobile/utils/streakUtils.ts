/**
 * Streak Utilities
 * 
 * Funções para gerenciar streaks (sequências de dias consecutivos)
 */

import { db } from '../services/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { checkAndAwardBadges } from '../services/gamification';

/**
 * Verifica e atualiza o streak do utilizador
 * Conta todos os dias consecutivos anteriores que têm refeições
 * Streak só quebra se passar para o próximo dia sem ter refeições no dia anterior
 */
export async function updateStreak(userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const mealsRef = collection(db, 'meals');
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return 0;
    }

    // Buscar todas as refeições do utilizador (para verificar dias consecutivos)
    const allMealsQuery = query(
      mealsRef,
      where('userId', '==', userId)
    );
    const allMealsSnapshot = await getDocs(allMealsQuery);
    
    // Criar um Set com todas as datas que têm refeições (formato: YYYY-MM-DD)
    const daysWithMeals = new Set<string>();
    allMealsSnapshot.forEach((doc) => {
      const mealData = doc.data();
      const mealDate = mealData.date?.toDate();
      if (mealDate) {
        const dateStr = mealDate.toDateString();
        daysWithMeals.add(dateStr);
      }
    });

    // Calcular streak: contar dias consecutivos desde hoje para trás
    let streak = 0;
    let currentDate = new Date(today);
    
    // Verificar se hoje tem refeições
    const todayStr = today.toDateString();
    const hasMealsToday = daysWithMeals.has(todayStr);
    
    // Se hoje tem refeições, começar a contar
    if (hasMealsToday) {
      streak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Continuar contando dias anteriores consecutivos
      while (true) {
        const dateStr = currentDate.toDateString();
        if (daysWithMeals.has(dateStr)) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          // Encontrou um dia sem refeições, parar
          break;
        }
      }
    } else {
      // Hoje não tem refeições, verificar dias anteriores
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Contar dias consecutivos anteriores
      while (true) {
        const dateStr = currentDate.toDateString();
        if (daysWithMeals.has(dateStr)) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          // Encontrou um dia sem refeições, parar
          break;
        }
      }
    }

    // Atualizar streak no perfil
    // lastStreakDate será a data do último dia com refeições no streak
    let lastStreakDate: Date | null = null;
    if (streak > 0) {
      if (hasMealsToday) {
        // Se hoje tem refeições, lastStreakDate é hoje
        lastStreakDate = new Date(today);
      } else {
        // Se hoje não tem, encontrar o último dia consecutivo com refeições
        // (que seria o primeiro dia do streak, contando de trás para frente)
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1);
        
        // Encontrar o último dia consecutivo com refeições
        for (let i = 0; i < streak; i++) {
          const dateStr = checkDate.toDateString();
          if (daysWithMeals.has(dateStr)) {
            lastStreakDate = new Date(checkDate);
            break;
          }
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    await setDoc(userRef, {
      streak: streak,
      lastStreakDate: lastStreakDate ? Timestamp.fromDate(lastStreakDate) : null,
    }, { merge: true });

    // Verificar badges relacionadas com streak (mas não mostrar modal aqui, apenas atualizar)
    // O modal será mostrado quando o utilizador adicionar uma refeição
    try {
      await checkAndAwardBadges(userId);
    } catch (error) {
      // Ignorar erros de badges silenciosamente
      console.error('Error checking badges in streak update:', error);
    }

    return streak;
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
 * Verifica e atualiza o streak após eliminar uma refeição
 * Recalcula o streak completo usando a mesma lógica de updateStreak
 */
export async function updateStreakAfterDelete(userId: string, deletedMealDate: Date): Promise<number> {
  // Simplesmente recalcular o streak completo
  return await updateStreak(userId);
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

