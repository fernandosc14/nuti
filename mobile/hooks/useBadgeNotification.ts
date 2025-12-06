/**
 * useBadgeNotification Hook
 * 
 * Hook para gerenciar notificações de badges ganhas
 */

import { useState, useCallback } from 'react';
import { checkAndAwardBadges, getUserBadges, Badge } from '../services/gamification';

export function useBadgeNotification() {
  const [showModal, setShowModal] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState<Badge | null>(null);

  const checkAndShowBadges = useCallback(async (userId: string) => {
    try {
      console.log('[BadgeNotification] Checking badges for user:', userId);
      // Verificar e atribuir badges
      const newBadgeIds = await checkAndAwardBadges(userId);
      console.log('[BadgeNotification] New badge IDs:', newBadgeIds);
      
      if (newBadgeIds.length > 0) {
        // Buscar informações das badges ganhas
        const allUserBadges = await getUserBadges(userId);
        const newBadges = allUserBadges.filter(badge => newBadgeIds.includes(badge.id));
        console.log('[BadgeNotification] New badges found:', newBadges);
        
        // Mostrar a primeira badge ganha (se houver múltiplas, mostrar uma de cada vez)
        if (newBadges.length > 0) {
          console.log('[BadgeNotification] Showing modal for badge:', newBadges[0].name);
          setEarnedBadge(newBadges[0]);
          setShowModal(true);
        }
      } else {
        console.log('[BadgeNotification] No new badges awarded');
      }
    } catch (error) {
      console.error('[BadgeNotification] Error checking badges:', error);
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    // Se houver mais badges para mostrar, mostrar a próxima após um delay
    // Por enquanto, apenas fechar
    setEarnedBadge(null);
  }, []);

  return {
    showModal,
    earnedBadge,
    checkAndShowBadges,
    closeModal,
  };
}

