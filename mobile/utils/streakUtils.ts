/**
 * Streak Utilities
 *
 * Functions to manage streaks (consecutive day sequences)
 */

import { db } from '../services/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { checkAndAwardBadges } from '../services/gamification';

/**
 * Checks and updates the user's streak
 * Counts all previous consecutive days that have meals
 * Streak only breaks if you move to the next day without having meals the previous day
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

    // Fetch current streak to determine how many days to fetch
    const currentStreak = userSnap.data()?.streak || 0;
    
    // Calculate how many days to fetch based on the current streak:
    // - If streak = 0: fetch 30 days (minimum)
    // - If streak > 0: fetch streak * 2 + 10 days margin (ensures we capture the full streak)
    // - Maximum of 365 days to avoid fetching unnecessary data
    const daysToFetch = currentStreak === 0 
      ? 30 
      : Math.min(currentStreak * 2 + 10, 365);
    
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysToFetch);
    startDate.setHours(0, 0, 0, 0);
    
    const allMealsQuery = query(
      mealsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(startDate))
    );
    const allMealsSnapshot = await getDocs(allMealsQuery);
    
    // Create a Set with all dates that have meals (format: YYYY-MM-DD)
    const daysWithMeals = new Set<string>();
    allMealsSnapshot.forEach((doc) => {
      const mealData = doc.data();
      const mealDate = mealData.date?.toDate();
      if (mealDate) {
        const dateStr = mealDate.toDateString();
        daysWithMeals.add(dateStr);
      }
    });

    // Calculate streak: count consecutive days from today backwards
    let streak = 0;
    let currentDate = new Date(today);
    
    // Check if today has meals
    const todayStr = today.toDateString();
    const hasMealsToday = daysWithMeals.has(todayStr);
    
    // If today has meals, start counting
    if (hasMealsToday) {
      streak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Continue counting previous consecutive days
      while (true) {
        const dateStr = currentDate.toDateString();
        if (daysWithMeals.has(dateStr)) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          // Found a day without meals, stop
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

    // Update streak in profile
    // lastStreakDate will be the date of the last day with meals in the streak
    let lastStreakDate: Date | null = null;
    if (streak > 0) {
      if (hasMealsToday) {
        // If today has meals, lastStreakDate is today
        lastStreakDate = new Date(today);
      } else {
        // If today does not, find the last consecutive day with meals
        // (which would be the first day of the streak, counting backwards)
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1);
        
        // Find the last consecutive day with meals
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

    // Check badges related to streak (but do not show modal here, just update)
    // The modal will be shown when the user adds a meal
    try {
      await checkAndAwardBadges(userId);
    } catch (error) {
      // Silently ignore badge errors
      console.error('Error checking badges in streak update:', error);
    }

    return streak;
  } catch (error: any) {
    // Silently ignore permission errors (user may not be authenticated)
    if (error?.code === 'permission-denied') {
      return 0;
    }
    console.error('Error updating streak:', error);
    return 0;
  }
}

/**
 * Checks and updates the streak after deleting a meal
 * Recalculates the full streak using the same logic as updateStreak
 */
export async function updateStreakAfterDelete(userId: string, deletedMealDate: Date): Promise<number> {
  // Simplesmente recalcular o streak completo
  return await updateStreak(userId);
}

/**
 * Gets the user's current streak
 */
export async function getStreak(userId: string): Promise<number> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    return userSnap.data()?.streak || 0;
  } catch (error: any) {
    // Silently ignore permission errors
    if (error?.code === 'permission-denied') {
      return 0;
    }
    console.error('Error getting streak:', error);
    return 0;
  }
}

