/**
 * Utility Functions
 *
 * Helper functions for formatting and calculations
 */

/**
 * Formats number for display with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('pt-PT');
}

/**
 * Formats date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formats time for display
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculates remaining calories
 */
export function calculateRemaining(consumed: number, goal: number): number {
  return Math.max(0, goal - consumed);
}

/**
 * Calculates progress percentage
 */
export function calculatePercentage(consumed: number, goal: number): number {
  return Math.min(100, Math.max(0, (consumed / goal) * 100));
}

