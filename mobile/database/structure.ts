/**
 * Database Structure Guide
 *
 * Complete Firestore database structure for Nuti
 */

/**
 * COLLECTION: users
 *
 * Document ID = userId (Firebase Auth UID)
 *
 * Structure:
 */
const userDocument = {
  name: "string",                    // User's name
  email: "string",                   // Email
  weight: 70,                        // Weight in kg (optional)
  height: 175,                       // Height in cm (optional)
  goal: "lose" | "maintain" | "gain", // Goal
  restrictions: ["gluten", "lactose"], // Dietary restrictions (array)
  plan: "free" | "premium",          // User's plan
  streak: 0,                         // Consecutive days
  badges: ["badge_id1", "badge_id2"], // IDs of unlocked badges
  lastStreakDate: Timestamp,         // Last date streak was updated
  createdAt: Timestamp               // Creation date
};

/**
 * COLLECTION: meals
 *
 * Document ID = auto-generated
 *
 * Structure:
 */
const mealDocument = {
  userId: "string",                   // User ID
  name: "string",                     // Food name
  calories: 250,                      // Calories
  protein: 20.5,                      // Protein in grams
  carbs: 30.0,                        // Carbohydrates in grams
  fat: 10.0,                          // Fat in grams
  image: "https://...",               // Image URL (optional)
  mealType: "breakfast" | "lunch" | "dinner" | "snack", // Meal type
  date: Timestamp                     // Date/time of the meal
};

/**
 * COLLECTION: messages
 *
 * Document ID = auto-generated
 *
 * Structure:
 */
const messageDocument = {
  userId: "string",                   // User ID
  role: "user" | "assistant",        // Message type
  content: "string",                  // Message content
  createdAt: Timestamp                 // Date/time of the message
};

/**
 * COLLECTION: badges
 *
 * Document ID = badge_id (manually defined)
 *
 * Default badges to be created:
 */
const badges = [
  {
    id: "first_meal",
    name: "First Meal",
    description: "You logged your first meal!",
    icon: "🎉",
    requirement: "first_meal"
  },
  {
    id: "streak_3",
    name: "3-Day Streak",
    description: "You kept the habit for 3 days!",
    icon: "🔥",
    requirement: "streak_3"
  },
  {
    id: "streak_7",
    name: "Perfect Week",
    description: "7 consecutive days!",
    icon: "⭐",
    requirement: "streak_7"
  },
  {
    id: "streak_30",
    name: "Perfect Month",
    description: "30 consecutive days!",
    icon: "🏆",
    requirement: "streak_30"
  },
  {
    id: "meals_10",
    name: "10 Meals",
    description: "You logged 10 meals!",
    icon: "🍽️",
    requirement: "meals_10"
  },
  {
    id: "meals_50",
    name: "50 Meals",
    description: "You logged 50 meals!",
    icon: "🎯",
    requirement: "meals_50"
  }
];

/**
 * FIRESTORE SECURITY RULES
 *
 * Copy these rules into Firebase Console > Firestore > Rules:
 */

const securityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rules for users
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Rules for meals
    match /meals/{mealId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Rules for messages
    match /messages/{messageId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Rules for badges (read-only)
    match /badges/{badgeId} {
      allow read: if request.auth != null;
      allow write: if false; // Apenas admins podem criar badges
    }
    
    // Rules for water (drank water)
    match /water/{waterId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create, update: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Rules for exercises (physical activities)
    match /exercises/{exerciseId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
`;

/**
 * COLLECTION: exercises
 *
 * Document ID = auto-generated
 *
 * Base structure:
 */
const exerciseDocument = {
  userId: "string",                   // User ID
  type: "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other", // Exercise type
  name: "string",                     // Exercise name (type or custom name)
  duration: 30,                        // Duration in minutes (required)
  date: Timestamp,                     // Exercise date
  addedAt: Timestamp,                  // Date when added

  // Type-specific fields (optional):

  // Running, Walking, Cycling, Hiking
  distance: 5.0,                       // Distance in km or mi
  distanceUnit: "km" | "mi",           // Distance unit

  // Walking
  steps: 5000,                         // Number of steps (optional)

  // Cycling
  averageSpeed: 20.0,                  // Average speed in km/h or mph
  speedUnit: "km/h" | "mph",           // Speed unit

  // Swimming
  style: "freestyle" | "backstroke" | "breaststroke" | "butterfly" | "mixed", // Swimming style

  // GYM
  trainingType: "strength" | "hypertrophy" | "cardio", // Training type

  // Yoga
  level: "beginner" | "intermediate" | "advanced", // Level
  style: "hatha" | "vinyasa" | "power" | "yin" | "ashtanga" | "bikram", // Yoga style

  // Pilates
  pilatesType: "mat" | "machine",      // Pilates type

  // Dance
  style: "zumba" | "ballet" | "salsa" | "hip-hop" | "free", // Dance style

  // Hiking
  elevationGain: 500,                  // Elevation gain in m or ft (important for MET calculation)
  elevationUnit: "m" | "ft",           // Elevation unit
  backpackWeight: 10.0,                // Backpack weight in kg or lbs (optional)
  weightUnit: "kg" | "lbs",            // Weight unit

  // Tennis
  gameType: "individual" | "doubles",  // Game type
  effectiveGameDuration: 60,           // Effective game duration in minutes (optional)

  // Football
  position: "forward" | "midfielder" | "defender" | "goalkeeper", // Position

  // Basketball
  gameType: "game" | "training",       // Game type

  // Other
  customName: "string",                // Custom exercise name (required for "other")
  perceivedIntensity: 7,                // Perceived intensity 1-10 (required for "other", optional for others)
};

/**
 * REQUIRED INDEXES
 *
 * Create these composite indexes in Firebase Console:
 *
 * Collection: meals
 * - userId (Ascending) + date (Descending)
 * - userId (Ascending) + date (Ascending) + date (Descending)
 *
 * Collection: messages
 * - userId (Ascending) + createdAt (Ascending)
 *
 * Collection: exercises
 * - userId (Ascending) + date (Ascending)
 */

export { userDocument, mealDocument, messageDocument, exerciseDocument, badges, securityRules };

