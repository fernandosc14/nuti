/**
 * Script to create badges in Firestore
 * 
 * Execute: node scripts/create-badges.js
 * 
 * NOTE: Requires Firebase Admin SDK or admin access to Firestore
 */

const badges = [
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

console.log('Badges to create:');
console.log(JSON.stringify(badges, null, 2));
console.log('\nTotal badges:', badges.length);
console.log('\nTo create these badges:');
console.log('1. Go to Firebase Console > Firestore');
console.log('2. Create the "badges" collection (if it doesn\'t exist)');
console.log('3. For each badge above, create a document with the specified ID');
console.log('4. Add the fields: name, description, icon, requirement');

