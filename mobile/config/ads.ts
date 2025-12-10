/**
 * Ads Configuration
 * 
 * Configuração centralizada para anúncios
 */

import { Platform } from 'react-native';

// IDs dos ad units do Google AdMob (Test IDs)
// Substituir pelos IDs reais quando a conta AdMob for criada
export const AD_UNIT_IDS = {
  // Android
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111', // Test ID
    largeBanner: 'ca-app-pub-3940256099942544/6300978111', // Test ID
    mediumRectangle: 'ca-app-pub-3940256099942544/6300978111', // Test ID
    interstitial: 'ca-app-pub-3940256099942544/1033173712', // Test ID
  },
  // iOS
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716', // Test ID
    largeBanner: 'ca-app-pub-3940256099942544/2934735716', // Test ID
    mediumRectangle: 'ca-app-pub-3940256099942544/4411468910', // Test ID
    interstitial: 'ca-app-pub-3940256099942544/4411468910', // Test ID
  },
};

/**
 * Obter o ID do ad unit baseado na plataforma
 */
export function getAdUnitId(type: 'banner' | 'largeBanner' | 'mediumRectangle' | 'interstitial'): string {
  const platformIds = Platform.OS === 'ios' ? AD_UNIT_IDS.ios : AD_UNIT_IDS.android;
  return platformIds[type];
}

