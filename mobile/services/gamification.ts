/**
 * Gamification Service
 *
 * Service to manage badges and gamification
 */

import { db } from '../services/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { calculateCalorieGoalFromProfile } from '../utils/nutritionUtils';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

/**
 * Initializes default badges in Firestore
 * NOTE: This function requires the user to be authenticated
 * due to Firestore security rules
 */
export async function initializeBadges() {
  // Check if there is an authenticated user
  // If not, badges must be created manually or via Cloud Function
  try {
    const badges: Badge[] = [
    {
      id: 'first_meal',
      name: 'First Meal',
      description: 'You logged your first meal!',
      icon: '🎉',
      requirement: 'first_meal',
    },
    {
      id: 'streak_3',
      name: '3 Day Streak',
      description: 'You maintained the habit for 3 days!',
      icon: '🔥',
      requirement: 'streak_3',
    },
    {
      id: 'streak_7',
      name: 'Perfect Week',
      description: '7 consecutive days!',
      icon: '⭐',
      requirement: 'streak_7',
    },
    {
      id: 'streak_30',
      name: 'Perfect Month',
      description: '30 consecutive days!',
      icon: '🏆',
      requirement: 'streak_30',
    },
    {
      id: 'streak_100',
      name: 'Centurion',
      description: '100 consecutive days!',
      icon: '💎',
      requirement: 'streak_100',
    },
    {
      id: 'meals_10',
      name: '10 Meals',
      description: 'You logged 10 meals!',
      icon: '🍽️',
      requirement: 'meals_10',
    },
    {
      id: 'meals_50',
      name: '50 Meals',
      description: 'You logged 50 meals!',
      icon: '🎯',
      requirement: 'meals_50',
    },
    {
      id: 'meals_100',
      name: '100 Meals',
      description: 'You logged 100 meals!',
      icon: '🌟',
      requirement: 'meals_100',
    },
    {
      id: 'meals_500',
      name: '500 Meals',
      description: 'You logged 500 meals!',
      icon: '👑',
      requirement: 'meals_500',
    },
    {
      id: 'first_exercise',
      name: 'First Exercise',
      description: 'You logged your first exercise!',
      icon: '💪',
      requirement: 'first_exercise',
    },
    {
      id: 'exercises_10',
      name: '10 Exercises',
      description: 'You logged 10 exercises!',
      icon: '🏋️',
      requirement: 'exercises_10',
    },
    {
      id: 'exercises_50',
      name: '50 Exercises',
      description: 'You logged 50 exercises!',
      icon: '🏅',
      requirement: 'exercises_50',
    },
    {
      id: 'water_week',
      name: 'Hydrated Week',
      description: 'You drank water for 7 consecutive days!',
      icon: '💧',
      requirement: 'water_week',
    },
    {
      id: 'goal_achieved',
      name: 'Goal Achieved',
      description: 'You reached your calorie goal!',
      icon: '🎯',
      requirement: 'goal_achieved',
    },
  ];

  let createdCount = 0;
  let existingCount = 0;

  for (const badge of badges) {
    try {
      const badgeRef = doc(db, 'badges', badge.id);
      const badgeSnap = await getDoc(badgeRef);
      if (!badgeSnap.exists()) {
        await setDoc(badgeRef, badge);
        createdCount++;
      } else {
        existingCount++;
      }
    } catch (error) {
      // Silently fail - badges can be created manually if needed
    }
  }
  } catch (error: any) {
    // Silently fail - badges can be created manually if needed
  }
}

/**
 * Checks and awards badges to the user
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  try {
    // Ensure badges are initialized (now allowed by temporary rules)
    try {
      await initializeBadges();
    } catch (error) {
      // Continuar mesmo se houver erro na inicialização
    }
    
    // Fetch user profile
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return [];
    }

    const userData = userSnap.data();
    const currentBadges = userData.badges || [];
    const streak = userData.streak || 0;

    // Parallelize queries that do not depend on each other
    const mealsRef = collection(db, 'meals');
    const exercisesRef = collection(db, 'exercises');
    const waterRef = collection(db, 'water');
    
    const [mealsSnapshot, exercisesSnapshot, waterSnapshot] = await Promise.all([
      getDocs(query(mealsRef, where('userId', '==', userId))),
      getDocs(query(exercisesRef, where('userId', '==', userId))),
      getDocs(query(waterRef, where('userId', '==', userId))),
    ]);
    
    const mealCount = mealsSnapshot.size;
    const exerciseCount = exercisesSnapshot.size;
    
    // Create a Set with dates that have water (format: YYYY-MM-DD)
    const daysWithWater = new Set<string>();
    waterSnapshot.forEach((doc) => {
      const waterData = doc.data();
      const waterDate = waterData.date?.toDate();
      if (waterDate && waterData.amount > 0) {
        const dateStr = waterDate.toISOString().split('T')[0]; // YYYY-MM-DD
        daysWithWater.add(dateStr);
      }
    });

    // Calculate water streak (consecutive days with water)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let waterStreak = 0;
    let currentDate = new Date(today);
    
    // Check if today has water
    const todayStr = today.toISOString().split('T')[0];
    const hasWaterToday = daysWithWater.has(todayStr);
    
    if (hasWaterToday) {
      waterStreak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Continue counting previous consecutive days
      while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (daysWithWater.has(dateStr)) {
          waterStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      // Hoje não tem água, verificar dias anteriores
      currentDate.setDate(currentDate.getDate() - 1);
      
      while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (daysWithWater.has(dateStr)) {
          waterStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Check if calorie goal was reached today
    const caloriePlan = calculateCalorieGoalFromProfile(userData as any);
    const calorieGoal = (userData as any).dailyCalorieGoal || caloriePlan?.calories || 2000;
    
    // Fetch today's meals and badges in parallel
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    const badgesRef = collection(db, 'badges');
    
    const [todayMealsSnapshot, badgesSnapshot] = await Promise.all([
      getDocs(query(
        mealsRef,
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(todayStart)),
        where('date', '<=', Timestamp.fromDate(todayEnd))
      )),
      getDocs(badgesRef),
    ]);
    
    let todayCalories = 0;
    todayMealsSnapshot.forEach((doc) => {
      const mealData = doc.data();
      todayCalories += mealData.calories || 0;
    });
    
    const goalAchieved = todayCalories >= calorieGoal;
    const allBadges = badgesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Badge[];

    const newBadges: string[] = [];

    for (const badge of allBadges) {
      // If the user already has the badge, continue
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
        case 'streak_100':
          shouldAward = streak >= 100;
          break;
        case 'meals_10':
          shouldAward = mealCount >= 10;
          break;
        case 'meals_50':
          shouldAward = mealCount >= 50;
          break;
        case 'meals_100':
          shouldAward = mealCount >= 100;
          break;
        case 'meals_500':
          shouldAward = mealCount >= 500;
          break;
        case 'first_exercise':
          shouldAward = exerciseCount >= 1;
          break;
        case 'exercises_10':
          shouldAward = exerciseCount >= 10;
          break;
        case 'exercises_50':
          shouldAward = exerciseCount >= 50;
          break;
        case 'water_week':
          shouldAward = waterStreak >= 7;
          break;
        case 'goal_achieved':
          shouldAward = goalAchieved;
          break;
      }

      if (shouldAward) {
        newBadges.push(badge.id);
      }
    }

    // Update user badges
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
    // Ignore permission errors when not authenticated
    const msg = String((error as any)?.message || '').toLowerCase();
    const code = String((error as any)?.code || '').toLowerCase();
    if (code === 'permission-denied' || msg.includes('insufficient permissions')) {
      return [];
    }
    // Silently ignore other errors as requested
    return [];
  }
}

/**
 * Gets user badges
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
    // Ignore permission errors when not authenticated
    const msg = String((error as any)?.message || '').toLowerCase();
    const code = String((error as any)?.code || '').toLowerCase();
    if (code === 'permission-denied' || msg.includes('insufficient permissions')) {
      return [];
    }
    // Silently ignore other errors as requested
    return [];
  }
}


