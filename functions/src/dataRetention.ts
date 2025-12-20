/**
 * Data Retention Policy - GDPR Compliance
 * 
 * Políticas de retenção automática de dados
 * - Meals: 2 anos
 * - Messages: 1 hora
 * - Exercises: 2 anos
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

// Get db lazily to avoid initialization issues
function getDb() {
  return admin.firestore();
}

// Períodos de retenção em ms
const RETENTION_PERIODS = {
  meals: 2 * 365 * 24 * 60 * 60 * 1000,        // 2 anos
  messages: 1 * 60 * 60 * 1000,                // 1 hora
  exercises: 2 * 365 * 24 * 60 * 60 * 1000,    // 2 anos
  water: 1 * 365 * 24 * 60 * 60 * 1000,        // 1 ano
  steps: 1 * 365 * 24 * 60 * 60 * 1000,        // 1 ano
};

/**
 * Cloud Function: Cleanup de mensagens antigas (cada 15 minutos)
 * Remove mensagens com `createdAt` mais antigas que 1 hora
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
 * Cloud Function: Cleanup de dados antigos (diário, 3 AM UTC)
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
        .limit(500) // Batch em 500 por vez
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
 * Cloud Function: Right to be forgotten (apagar conta do utilizador)
 * Endpoint: DELETE /deleteUserData/{userId}
 */
export const deleteUserData = functions.https.onCall(async (data, context) => {
  try {
    // Verificar autenticação
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }
    
    const userId = context.auth.uid;
    const requestingUserId = data.userId;
    
    // Apenas o próprio utilizador pode apagar seus dados
    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError("permission-denied", "Cannot delete another user's data");
    }
    
    console.log(`🗑️ Deleting all data for user: ${userId}`);
    
    const db = getDb();
    const batch = db.batch();
    
    // Apagar meals
    const meals = await db.collection("meals").where("userId", "==", userId).get();
    meals.docs.forEach(doc => batch.delete(doc.ref));
    
    // Apagar exercises
    const exercises = await db.collection("exercises").where("userId", "==", userId).get();
    exercises.docs.forEach(doc => batch.delete(doc.ref));
    
    // Apagar messages
    const messages = await db.collection("messages").where("userId", "==", userId).get();
    messages.docs.forEach(doc => batch.delete(doc.ref));
    
    // Apagar savedMeals
    const savedMeals = await db.collection("savedMeals").where("userId", "==", userId).get();
    savedMeals.docs.forEach(doc => batch.delete(doc.ref));
    
    // Apagar water
    const water = await db.collection("water").where("userId", "==", userId).get();
    water.docs.forEach(doc => batch.delete(doc.ref));
    
    // Apagar steps
    const steps = await db.collection("steps").where("userId", "==", userId).get();
    steps.docs.forEach(doc => batch.delete(doc.ref));
    
    // Apagar user document
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
 * Cloud Function: Exportar dados do utilizador (GDPR - Right to portability)
 * Endpoint: GET /exportUserData/{userId}
 */
export const exportUserData = functions.https.onCall(async (data, context) => {
  try {
    // Verificar autenticação
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User not authenticated");
    }
    
    const userId = context.auth.uid;
    const requestingUserId = data.userId;
    
    // Apenas o próprio utilizador pode exportar seus dados
    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError("permission-denied", "Cannot export another user's data");
    }
    
    console.log(`📥 Exporting data for user: ${userId}`);
    
    const db = getDb();
    const exportData: any = {};
    
    // Exportar user profile
    const userDoc = await db.collection("users").doc(userId).get();
    exportData.profile = userDoc.exists ? userDoc.data() : null;
    
    // Exportar meals
    const meals = await db.collection("meals").where("userId", "==", userId).get();
    exportData.meals = meals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Exportar exercises
    const exercises = await db.collection("exercises").where("userId", "==", userId).get();
    exportData.exercises = exercises.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Exportar savedMeals
    const savedMeals = await db.collection("savedMeals").where("userId", "==", userId).get();
    exportData.savedMeals = savedMeals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Exportar messages
    const messages = await db.collection("messages").where("userId", "==", userId).get();
    exportData.messages = messages.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Não exportar water/steps (dados sensíveis diários, manter privado)
    
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
