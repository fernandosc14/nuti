/**
 * useBadgeNotification Hook
 * 
 * Hook para gerenciar notificações de badges ganhas
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
        // Sem utilizador autenticado; ignorar silenciosamente
        return;
      }
      // Verificar e atribuir badges
      const newBadgeIds = await checkAndAwardBadges(userId);
      
      if (newBadgeIds.length > 0) {
        // Buscar informações das badges ganhas
        const allUserBadges = await getUserBadges(userId);
        const newBadges = allUserBadges.filter(badge => newBadgeIds.includes(badge.id));
        
        // Mostrar a primeira badge ganha (se houver múltiplas, mostrar uma de cada vez)
        if (newBadges.length > 0) {
          setEarnedBadge(newBadges[0]);
          setShowModal(true);
          // Disparar uma notificação local para o badge ganho
          await notifyBadgeUnlocked(newBadges[0].name, newBadges[0].description);
        }
      } else {
        // Sem novas badges; ignorar
      }
    } catch (error: any) {
      // Ignorar erros de permissão quando não autenticado
      const msg = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      if (code === 'permission-denied' || msg.includes('insufficient permissions')) {
        return;
      }
      // Outros erros: silenciar conforme pedido
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

