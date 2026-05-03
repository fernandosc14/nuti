/**
 * AdBanner
 * 
 * Reusable component for displaying banner ads
 * For free users only
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAds } from '../context/AdContext';
import { getAdUnitId } from '../config/ads';

interface AdBannerProps {
  /**
   * Type of banner
   * - 'banner': Default banner (320x50)
   * - 'largeBanner': Large banner (320x100)
   * - 'mediumRectangle': Medium rectangle (300x250)
   */
  adSize?: 'banner' | 'largeBanner' | 'mediumRectangle';
  
  /**
   * Position of the ad
   * - 'top': Top of the screen
   * - 'bottom': Bottom of the screen
   * - 'inline': Between content
   */
  position?: 'top' | 'bottom' | 'inline';
}

export function AdBanner({
  adSize = 'banner',
  position = 'inline',
}: AdBannerProps) {
  const { isPremium, adsEnabled, isInitialized } = useAds();

  // Do not show ads for premium users or if not initialized
  if (isPremium || !adsEnabled || !isInitialized) {
    return null;
  }

  // Define banner size
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

  // Get the ad unit ID
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

