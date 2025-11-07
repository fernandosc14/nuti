/**
 * Utility Functions
 * 
 * Funções auxiliares para formatação e cálculos
 */

/**
 * Formata número para exibição com separador de milhares
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('pt-PT');
}

/**
 * Formata data para exibição
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formata hora para exibição
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calcula calorias restantes
 */
export function calculateRemaining(consumed: number, goal: number): number {
  return Math.max(0, goal - consumed);
}

/**
 * Calcula percentagem de progresso
 */
export function calculatePercentage(consumed: number, goal: number): number {
  return Math.min(100, Math.max(0, (consumed / goal) * 100));
}

