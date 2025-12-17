/**
 * AdContext
 * 
 * Contexto para gerenciar anúncios na aplicação
 * Controla quando mostrar ads baseado no plano do usuário
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import mobileAds from 'react-native-google-mobile-ads';
import { useUser } from './UserContext';

interface AdContextType {
  /**
   * Se o usuário é premium (não deve ver ads)
   */
  isPremium: boolean;
  
  /**
   * Se os ads estão habilitados
   */
  adsEnabled: boolean;
  
  /**
   * Se o AdMob foi inicializado
   */
  isInitialized: boolean;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export function AdProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useUser();
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const isPremium = profile?.plan === 'premium';

  // Inicializar AdMob
  useEffect(() => {
    const initializeAds = async () => {
      try {
        await mobileAds().initialize();
        setIsInitialized(true);
      } catch (error) {
        // Silence AdMob initialization errors (no logs requested)
      }
    };

    initializeAds();
  }, []);

  // Desabilitar ads se o usuário for premium
  useEffect(() => {
    setAdsEnabled(!isPremium);
  }, [isPremium]);

  return (
    <AdContext.Provider
      value={{
        isPremium,
        adsEnabled,
        isInitialized,
      }}
    >
      {children}
    </AdContext.Provider>
  );
}

export function useAds() {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAds must be used within AdProvider');
  }
  return context;
}

