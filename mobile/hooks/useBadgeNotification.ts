/**
 * useBadgeNotification Hook
 *
 * Hook to manage earned badge notifications
 */

import { useState, useCallback } from 'react';
import { checkAndAwardBadges, getUserBadges, Badge } from '../services/gamification';
import { notifyBadgeUnlocked } from '../services/notifications';

export function useBadgeNotification() {
  const [showModal, setShowModal] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState<Badge | null>(null);

  const checkAndShowBadges = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        // No authenticated user; silently ignore
        return;
      }
      // Check and award badges
      const newBadgeIds = await checkAndAwardBadges(userId);
      
      if (newBadgeIds.length > 0) {
        // Fetch information for earned badges
        const allUserBadges = await getUserBadges(userId);
        const newBadges = allUserBadges.filter(badge => newBadgeIds.includes(badge.id));
        
        // Show the first earned badge (if multiple, show one at a time)
        if (newBadges.length > 0) {
          setEarnedBadge(newBadges[0]);
          setShowModal(true);
          // Trigger a local notification for the earned badge
          await notifyBadgeUnlocked(newBadges[0].name, newBadges[0].description);
        }
      } else {
        // No new badges; ignore
      }
    } catch (error: any) {
      // Ignore permission errors when not authenticated
      const msg = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      if (code === 'permission-denied' || msg.includes('insufficient permissions')) {
        return;
      }
      // Other errors: silently ignore as requested
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    // If there are more badges to show, show the next one after a delay
    // For now, just close
    setEarnedBadge(null);
  }, []);

  return {
    showModal,
    earnedBadge,
    checkAndShowBadges,
    closeModal,
  };
}

