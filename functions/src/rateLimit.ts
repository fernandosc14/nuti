/**
 * Rate Limiting - Protect against abuse
 *
 * Implements per-user rate limiting
 * Limit: 100 operations per minute
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

// Lazily get db to avoid initialization issues
function getDb() {
  return admin.firestore();
}

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms
const MAX_OPERATIONS = 100; // Max 100 operations per minute

/**
 * Check if user exceeded rate limit
 */
export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const db = getDb();
    const rateLimitRef = db.collection("rateLimits").doc(userId);
    const now = Date.now();
    
    // Use transaction for atomic operation
    return await db.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(rateLimitRef);
      const data = docSnapshot.exists ? (docSnapshot.data() || { operations: [], blockedUntil: 0 }) : { operations: [], blockedUntil: 0 };
      
      // If user is blocked, return
      if (data && data.blockedUntil && data.blockedUntil > now) {
        return { 
          allowed: false, 
          remaining: 0 
        };
      }
      
      // Clean up old operations (> 1 minute)
      let recentOperations = (data.operations || []).filter(
        (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW
      );
      
      // Check if limit exceeded
      if (recentOperations.length >= MAX_OPERATIONS) {
        // Block for 5 minutes
        transaction.update(rateLimitRef, {
          operations: recentOperations,
          blockedUntil: now + (5 * 60 * 1000),
          lastBlock: new Date(),
        });
        
        return { 
          allowed: false, 
          remaining: 0 
        };
      }
      
      // Add new operation
      recentOperations.push(now);
      transaction.update(rateLimitRef, {
        operations: recentOperations,
        lastActivity: new Date(),
        userId: userId, // Para facilitar queries
      });
      
      return { 
        allowed: true, 
        remaining: MAX_OPERATIONS - recentOperations.length 
      };
    });
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // On error, allow (fail-open for better UX)
    return { allowed: true, remaining: MAX_OPERATIONS };
  }
}

/**
 * Cloud Function: Cleanup old rate limit records (weekly)
 */
export const cleanupRateLimits = functions
  .pubsub
  .schedule("every sunday 02:00")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const db = getDb();
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      
      const snapshot = await db
        .collection("rateLimits")
        .where("lastActivity", "<", new Date(cutoffTime))
        .get();
      
      let deleted = 0;
      for (const doc of snapshot.docs) {
        await doc.ref.delete();
        deleted++;
      }

      console.log(`Cleanup: Deleted ${deleted} old rate limit records`);

      return { deleted };
    } catch (error) {
      console.error("Error in cleanupRateLimits:", error);
      throw error;
    }
  });

/**
 * Cloud Function: Monitor abnormal rate limits
 */
export const monitorRateLimits = functions
  .pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    try {
      const db = getDb();
      const now = Date.now();
      const blockedUsers = await db
        .collection("rateLimits")
        .where("blockedUntil", ">", now)
        .get();
      
      if (blockedUsers.size > 10) {
        // If > 10 users blocked, log alert
        console.warn(`⚠️ RATE LIMIT ALERT: ${blockedUsers.size} users currently blocked`);

        // Here you could notify admin
        // or log to monitoring system
      }
      
      return { blockedCount: blockedUsers.size };
    } catch (error) {
      console.error("Error in monitorRateLimits:", error);
      return { blockedCount: 0 };
    }
  });
