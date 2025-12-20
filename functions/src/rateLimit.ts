/**
 * Rate Limiting - Proteger contra abuso
 * 
 * Implementa rate limiting por utilizador
 * Limite: 100 operações por minuto
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

// Get db lazily to avoid initialization issues
function getDb() {
  return admin.firestore();
}

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto em ms
const MAX_OPERATIONS = 100; // Max 100 operações por minuto

/**
 * Verificar se utilizador excedeu rate limit
 */
export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const db = getDb();
    const rateLimitRef = db.collection("rateLimits").doc(userId);
    const now = Date.now();
    
    // Usar transação para operação atômica
    return await db.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(rateLimitRef);
      const data = docSnapshot.exists ? (docSnapshot.data() || { operations: [], blockedUntil: 0 }) : { operations: [], blockedUntil: 0 };
      
      // Se está bloqueado, retornar
      if (data && data.blockedUntil && data.blockedUntil > now) {
        return { 
          allowed: false, 
          remaining: 0 
        };
      }
      
      // Limpar operações antigas (> 1 minuto)
      let recentOperations = (data.operations || []).filter(
        (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW
      );
      
      // Verificar se excedeu limite
      if (recentOperations.length >= MAX_OPERATIONS) {
        // Bloquear por 5 minutos
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
      
      // Adicionar nova operação
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
    // Em caso de erro, permitir (fail-open para melhor UX)
    return { allowed: true, remaining: MAX_OPERATIONS };
  }
}

/**
 * Cloud Function: Cleanup de registos antigos de rate limit (weekly)
 */
export const cleanupRateLimits = functions
  .pubsub
  .schedule("every sunday 02:00")
  .timeZone("UTC")
  .onRun(async () => {
    try {
      const db = getDb();
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 dias
      
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
 * Cloud Function: Monitorer de rate limits anormais
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
        // Se > 10 users bloqueados, registar alerta
        console.warn(`⚠️ RATE LIMIT ALERT: ${blockedUsers.size} users currently blocked`);
        
        // Aqui poderia enviar notificação ao admin
        // ou registar em sistema de monitoramento
      }
      
      return { blockedCount: blockedUsers.size };
    } catch (error) {
      console.error("Error in monitorRateLimits:", error);
      return { blockedCount: 0 };
    }
  });
