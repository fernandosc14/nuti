/**
 * AdContext
 * 
 * Context for managing ads in the application.
 * Controls when to show ads based on the user's plan.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import mobileAds from 'react-native-google-mobile-ads';
import { useUser } from './UserContext';

interface AdContextType {
  /**
   * If the user is a premium member (they shouldn't see ads)
   */
  isPremium: boolean;
  
  /**
   * If ads are enabled
   */
  adsEnabled: boolean;
  
  /**
   * If AdMob has been initialized
   */
  isInitialized: boolean;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export function AdProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useUser();
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const isPremium = profile?.plan === 'premium';

  // Initialize AdMob
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

  // Disable ads if the user is premium
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

