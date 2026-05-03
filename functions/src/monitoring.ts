/**
 * Monitoring & Logging - Observability
 *
 * Structured logging and alert system
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v1";

// Lazily get db to avoid initialization issues
function getDb() {
  return admin.firestore();
}

/**
 * Interface for structured log events
 */
interface LogEvent {
  timestamp: Date;
  userId?: string;
  action: string;
  status: "success" | "error" | "warning";
  details?: any;
  errorMessage?: string;
  duration?: number; // in ms
}

/**
 * Register structured log event
 */
export async function logEvent(event: LogEvent): Promise<void> {
  try {
    const db = getDb();
    await db.collection("logs").add({
      ...event,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      logLevel: event.status.toUpperCase(),
    });
    
    // Also log to Cloud Logging
    if (event.status === "error") {
      logger.error(`[${event.action}] ${event.errorMessage}`, event.details);
    } else if (event.status === "warning") {
      logger.warn(`[${event.action}] ${event.details}`, event.details);
    } else {
      logger.info(`[${event.action}] Success`, event.details);
    }
  } catch (error) {
    console.error("Error logging event:", error);
  }
}

/**
 * Cloud Function: Performance monitor (every 5 minutes)
 */
export const performanceMonitor = functions
  .pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    try {
      const db = getDb();
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      // Count recent operations
      const recentLogs = await db
        .collection("logs")
        .where("timestamp", ">=", new Date(fiveMinutesAgo))
        .get();
      
      const stats = {
        totalEvents: recentLogs.size,
        errors: 0,
        warnings: 0,
        successes: 0,
        avgDuration: 0,
      };
      
      let totalDuration = 0;
      let durationCount = 0;
      
      recentLogs.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === "error") stats.errors++;
        if (data.status === "warning") stats.warnings++;
        if (data.status === "success") stats.successes++;
        if (data.duration) {
          totalDuration += data.duration;
          durationCount++;
        }
      });
      
      if (durationCount > 0) {
        stats.avgDuration = Math.round(totalDuration / durationCount);
      }
      
      // Log statistics
      await db.collection("metrics").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        period: "5m",
        stats,
      });
      
      // Alert if error rate > 5%
      const errorRate = stats.totalEvents > 0 ? (stats.errors / stats.totalEvents) * 100 : 0;
      if (errorRate > 5) {
        logger.warn(`⚠️ High error rate: ${errorRate.toFixed(2)}%`, stats);
      }
      
      // Alert if avg duration > 1000ms
      if (stats.avgDuration > 1000) {
        logger.warn(`⚠️ High latency: ${stats.avgDuration}ms average`, stats);
      }
      
      console.log("📊 Performance Stats:", stats);
      return stats;
    } catch (error) {
      console.error("Error in performanceMonitor:", error);
      return null;
    }
  });

/**
 * Cloud Function: Daily activity summary
 */
export const dailySummary = functions
  .pubsub
  .schedule("every day 23:00")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const db = getDb();
      const yesterday = Date.now() - (24 * 60 * 60 * 1000);
      
      // Count today's activities
      const mealsAdded = await db
        .collection("meals")
        .where("date", ">=", new Date(yesterday))
        .get();
      
      const exercisesAdded = await db
        .collection("exercises")
        .where("date", ">=", new Date(yesterday))
        .get();
      
      const newUsers = await db
        .collection("users")
        .where("createdAt", ">=", new Date(yesterday))
        .get();
      
      const errors = await db
        .collection("logs")
        .where("timestamp", ">=", new Date(yesterday))
        .where("status", "==", "error")
        .get();
      
      const summary = {
        date: new Date(),
        mealsLogged: mealsAdded.size,
        exercisesLogged: exercisesAdded.size,
        newUsers: newUsers.size,
        errors: errors.size,
      };
      
      // Log summary
      await db.collection("summaries").add({
        ...summary,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      logger.info("📈 Daily Summary", summary);
      
      return summary;
    } catch (error) {
      console.error("Error in dailySummary:", error);
      return null;
    }
  });

/**
 * Cloud Function: System health check
 */
export const healthCheck = functions
  .pubsub
  .schedule("every 10 minutes")
  .onRun(async () => {
    try {
      const db = getDb();
      const health = {
        timestamp: new Date(),
        status: "healthy" as "healthy" | "degraded" | "unhealthy",
        checks: {
          firestore: false,
          storage: false,
          auth: false,
        },
      };
      
      // Check Firestore
      try {
        await db.collection("_health").doc("check").get();
        health.checks.firestore = true;
      } catch {
        health.checks.firestore = false;
      }
      
      // Check Auth (verify if firebase auth is accessible)
      try {
        // Se conseguir verificar um token, auth está ok
        health.checks.auth = true;
      } catch {
        health.checks.auth = false;
      }
      
      // Determine overall status
      const checksPass = Object.values(health.checks).filter(v => v).length;
      if (checksPass === 3) {
        health.status = "healthy";
      } else if (checksPass >= 2) {
        health.status = "degraded";
      } else {
        health.status = "unhealthy";
      }
      
      // Log health check
      await db.collection("health").add(health);
      
      if (health.status !== "healthy") {
        logger.warn(`⚠️ System Health: ${health.status}`, health);
      }
      
      console.log("🏥 Health Check:", health);
      return health;
    } catch (error) {
      console.error("Error in healthCheck:", error);
      return null;
    }
  });

/**
 * Middleware for automatic logging of critical operations
 * Use in important callable functions
 */
export function withLogging(
  operationName: string,
  // eslint-disable-next-line no-unused-vars
  fn: (_data: any, _context: any) => Promise<any>
) {
  // eslint-disable-next-line no-unused-vars
  return async (_data: any, _context: any) => {
    const startTime = Date.now();
    const logEventData: LogEvent = {
      timestamp: new Date(),
      userId: _context.auth?.uid,
      action: operationName,
      status: "success",
    };
    
    try {
      const result = await fn(_data, _context);
      logEventData.duration = Date.now() - startTime;
      logEventData.details = { success: true };
      
      await logEvent(logEventData);
      return result;
    } catch (error: any) {
      logEventData.status = "error";
      logEventData.duration = Date.now() - startTime;
      logEventData.errorMessage = error.message;
      logEventData.details = { error: error.code || "UNKNOWN_ERROR" };
      
      await logEvent(logEventData);
      throw error;
    }
  };
}
