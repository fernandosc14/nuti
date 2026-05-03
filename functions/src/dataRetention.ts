/**
 * Data Retention Policy - GDPR Compliance
 *
 * Automatic data retention policies
 * - Meals: 2 years
 * - Messages: 1 hour
 * - Exercises: 2 years
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

// Lazily get db to avoid initialization issues
function getDb() {
  return admin.firestore();
}

// Retention periods in ms
const RETENTION_PERIODS = {
  meals: 2 * 365 * 24 * 60 * 60 * 1000,        // 2 years
  messages: 1 * 60 * 60 * 1000,                // 1 hour
  exercises: 2 * 365 * 24 * 60 * 60 * 1000,    // 2 years
  water: 1 * 365 * 24 * 60 * 60 * 1000,        // 1 year
  steps: 1 * 365 * 24 * 60 * 60 * 1000,        // 1 year
};

/**
 * Cloud Function: Cleanup old messages (every 15 minutes)
 * Removes messages with `createdAt` older than 1 hour
 */
export const cleanupOldMessages = functions
  .pubsub
  .schedule("every 15 minutes")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const db = getDb();
      const now = Date.now();
      let deleted = 0;

      const oldMessages = await db
        .collection("messages")
        .where("createdAt", "<", new Date(now - RETENTION_PERIODS.messages))
        .limit(500)
        .get();

      for (const doc of oldMessages.docs) {
        await doc.ref.delete();
        deleted++;
      }

      console.log("🧹 Messages cleanup (<= 1h) deleted:", deleted);
      return { deleted };
    } catch (error) {
      console.error("Error in cleanupOldMessages:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Cleanup old data (daily, 3 AM UTC)
 */
export const cleanupOldData = functions
  .pubsub
  .schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const db = getDb();
      const results = {
        meals: 0,
        messages: 0,
        exercises: 0,
        water: 0,
        steps: 0,
      };
      
      const now = Date.now();
      
      // Cleanup Meals
      const oldMeals = await db
        .collection("meals")
        .where("date", "<", new Date(now - RETENTION_PERIODS.meals))
        .limit(500) // Batch in 500 per run
        .get();
      
      for (const doc of oldMeals.docs) {
        await doc.ref.delete();
        results.meals++;
      }
      
      // Cleanup Messages
      const oldMessages = await db
        .collection("messages")
        .where("createdAt", "<", new Date(now - RETENTION_PERIODS.messages))
        .limit(500)
        .get();
      
      for (const doc of oldMessages.docs) {
        await doc.ref.delete();
        results.messages++;
      }
      
      // Cleanup Exercises
      const oldExercises = await db
        .collection("exercises")
        .where("date", "<", new Date(now - RETENTION_PERIODS.exercises))
        .limit(500)
        .get();
      
      for (const doc of oldExercises.docs) {
        await doc.ref.delete();
        results.exercises++;
      }
      
      // Cleanup Water
      const oldWater = await db
        .collection("water")
        .where("date", "<", new Date(now - RETENTION_PERIODS.water))
        .limit(500)
        .get();
      
      for (const doc of oldWater.docs) {
        await doc.ref.delete();
        results.water++;
      }
      
      // Cleanup Steps
      const oldSteps = await db
        .collection("steps")
        .where("date", "<", new Date(now - RETENTION_PERIODS.steps))
        .limit(500)
        .get();
      
      for (const doc of oldSteps.docs) {
        await doc.ref.delete();
        results.steps++;
      }
      
      console.log("📊 Data Cleanup Results:", results);
      
      return results;
    } catch (error) {
      console.error("Error in cleanupOldData:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Right to be forgotten (delete user account)
 * Endpoint: DELETE /deleteUserData/{userId}
 */
export const deleteUserData = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }
    
    const userId = context.auth.uid;
    const requestingUserId = data.userId;
    
    // Only the user themselves can delete their data
    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError("permission-denied", "Cannot delete another user's data");
    }
    
    console.log(`🗑️ Deleting all data for user: ${userId}`);
    
    const db = getDb();
    const batch = db.batch();
    
    // Delete meals
    const meals = await db.collection("meals").where("userId", "==", userId).get();
    meals.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete exercises
    const exercises = await db.collection("exercises").where("userId", "==", userId).get();
    exercises.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete messages
    const messages = await db.collection("messages").where("userId", "==", userId).get();
    messages.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete savedMeals
    const savedMeals = await db.collection("savedMeals").where("userId", "==", userId).get();
    savedMeals.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete water
    const water = await db.collection("water").where("userId", "==", userId).get();
    water.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete steps
    const steps = await db.collection("steps").where("userId", "==", userId).get();
    steps.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete user document
    batch.delete(db.collection("users").doc(userId));
    
    // Commit batch
    await batch.commit();
    
    console.log(`✅ User data deleted: ${userId}`);
    
    return {
      success: true,
      message: "All user data has been permanently deleted",
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Error in deleteUserData:", error);
    throw error;
  }
});

/**
 * Cloud Function: Export user data (GDPR - Right to portability)
 * Endpoint: GET /exportUserData/{userId}
 */
export const exportUserData = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }
    
    const userId = context.auth.uid;
    const requestingUserId = data.userId;
    
    // Only the user themselves can export their data
    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError("permission-denied", "Cannot export another user's data");
    }
    
    console.log(`📥 Exporting data for user: ${userId}`);
    
    const db = getDb();
    const exportData: any = {};
    
    // Export user profile
    const userDoc = await db.collection("users").doc(userId).get();
    exportData.profile = userDoc.exists ? userDoc.data() : null;
    
    // Export meals
    const meals = await db.collection("meals").where("userId", "==", userId).get();
    exportData.meals = meals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Export exercises
    const exercises = await db.collection("exercises").where("userId", "==", userId).get();
    exportData.exercises = exercises.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Export savedMeals
    const savedMeals = await db.collection("savedMeals").where("userId", "==", userId).get();
    exportData.savedMeals = savedMeals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Export messages
    const messages = await db.collection("messages").where("userId", "==", userId).get();
    exportData.messages = messages.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Do not export water/steps (sensitive daily data, keep private)
    
    console.log(`✅ User data exported: ${userId}`);
    
    return {
      success: true,
      data: exportData,
      exportedAt: new Date(),
      note: "This data is exported in JSON format. Keep it safe as it contains personal information.",
    };
  } catch (error) {
    console.error("Error in exportUserData:", error);
    throw error;
  }
});
