/**
 * AdBanner
 * 
 * Componente reutilizável para exibir banners de anúncios
 * Apenas para usuários free
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAds } from '../context/AdContext';
import { getAdUnitId } from '../config/ads';

interface AdBannerProps {
  /**
   * Tipo de banner
   * - 'banner': Banner padrão (320x50)
   * - 'largeBanner': Banner grande (320x100)
   * - 'mediumRectangle': Retângulo médio (300x250)
   */
  adSize?: 'banner' | 'largeBanner' | 'mediumRectangle';
  
  /**
   * Posição do ad
   * - 'top': Topo da tela
   * - 'bottom': Rodapé da tela
   * - 'inline': Entre conteúdo
   */
  position?: 'top' | 'bottom' | 'inline';
}

export function AdBanner({
  adSize = 'banner',
  position = 'inline',
}: AdBannerProps) {
  const { isPremium, adsEnabled, isInitialized } = useAds();

  // Não mostrar ads para usuários premium ou se não estiver inicializado
  if (isPremium || !adsEnabled || !isInitialized) {
    return null;
  }

  // Definir tamanho do banner
  const getBannerSize = () => {
    switch (adSize) {
      case 'banner':
        return BannerAdSize.BANNER;
      case 'largeBanner':
        return BannerAdSize.LARGE_BANNER;
      case 'mediumRectangle':
        return BannerAdSize.MEDIUM_RECTANGLE;
      default:
        return BannerAdSize.BANNER;
    }
  };

  // Obter o ID do ad unit
  const unitId = getAdUnitId(adSize === 'mediumRectangle' ? 'mediumRectangle' : 'banner');

  return (
    <View
      style={[
        styles.container,
        position === 'top' && styles.topPosition,
        position === 'bottom' && styles.bottomPosition,
        position === 'inline' && styles.inlinePosition,
      ]}
    >
      <BannerAd
        unitId={unitId}
        size={getBannerSize()}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          console.log('Ad loaded successfully');
        }}
        onAdFailedToLoad={(error) => {
          console.error('Ad failed to load:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topPosition: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  bottomPosition: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  inlinePosition: {
    paddingHorizontal: 24,
    marginVertical: 12,
  },
});

