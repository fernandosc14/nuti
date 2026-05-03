/**
 * PremiumWelcomeModal
 * 
 * Premium welcome message that appears only once.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export function PremiumWelcomeModal() {
  const { profile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const checkPremiumWelcome = async () => {
      if (!profile) {
        return;
      }

      const currentPlan = profile.plan || 'free';

      // If the current plan is premium
      if (currentPlan === 'premium') {
        // Check if the welcome modal has already been shown
        const welcomeShown = await AsyncStorage.getItem('premium_welcome_shown');
        
        // If it hasn't been shown yet, display the modal
        if (welcomeShown !== 'true') {
          // Small delay to ensure the UI is ready
          setTimeout(() => {
            setShowModal(true);
          }, 500);
        }
      }
    };

    checkPremiumWelcome();
  }, [profile]);

  const handleClose = async () => {
    setShowModal(false);
    // Mark that the welcome modal has already been shown (only once)
    if (profile?.plan === 'premium') {
      await AsyncStorage.setItem('premium_welcome_shown', 'true');
    }
  };

  if (!showModal || !profile || profile.plan !== 'premium') {
    return null;
  }

  const closeTop = Math.max(insets.top, 16) + 12;

  return (
    <Modal
      visible={showModal}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
        {/* Close Button */}
        <TouchableOpacity
          onPress={handleClose}
          style={[styles.closeButton, {
            top: closeTop,
            backgroundColor: 'rgba(0,0,0,0.08)',
            borderColor: '#D1D5DB',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 6,
            elevation: 8,
          }]}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Ionicons name="close" size={20} color="#111827" />
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          {/* Premium Icon */}
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={styles.iconEmoji}>⭐</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('premium.welcomeTitle') || 'Bem-vindo ao Premium!'}
          </Text>

          {/* Caption */}
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary || '#9CA3AF' }]}>
            {t('premium.welcomeMessage') || 'Parabéns! Agora tens acesso a todas as funcionalidades premium.'}
          </Text>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {t('premium.feature1') || 'Chat Ilimitado'}
              </Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {t('premium.feature2') || 'Relatórios Personalizados'}
              </Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {t('premium.feature3') || 'Estatísticas Avançadas'}
              </Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {t('premium.feature4') || 'Badges Exclusivas'}
              </Text>
            </View>
          </View>

          {/* Start Button */}
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.startButton, { backgroundColor: theme.colors.primary || '#3BB273' }]}
          >
            <Text style={styles.startButtonText}>
              {t('premium.getStarted') || 'Começar'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    height: height,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 48,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  startButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

