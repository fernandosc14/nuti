/**
 * PremiumWelcomeModal
 * 
 * Modal de boas-vindas ao Premium que aparece apenas 1 vez
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
import { SafeAreaView } from 'react-native-safe-area-context';
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

  useEffect(() => {
    const checkPremiumWelcome = async () => {
      if (!profile) {
        return;
      }

      const currentPlan = profile.plan || 'free';

      // Se o plano atual é premium
      if (currentPlan === 'premium') {
        // Verificar se o modal de boas-vindas já foi mostrado
        const welcomeShown = await AsyncStorage.getItem('premium_welcome_shown');
        
        // Se ainda não foi mostrado, mostrar o modal
        if (welcomeShown !== 'true') {
          // Pequeno delay para garantir que a UI está pronta
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
    // Marcar que o modal de boas-vindas já foi mostrado (apenas uma vez)
    if (profile?.plan === 'premium') {
      await AsyncStorage.setItem('premium_welcome_shown', 'true');
    }
  };

  if (!showModal || !profile || profile.plan !== 'premium') {
    return null;
  }

  return (
    <Modal
      visible={showModal}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Botão Fechar */}
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </TouchableOpacity>

        {/* Conteúdo */}
        <View style={styles.content}>
          {/* Ícone Premium */}
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={styles.iconEmoji}>⭐</Text>
          </View>

          {/* Título */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('premium.welcomeTitle') || 'Bem-vindo ao Premium!'}
          </Text>

          {/* Subtítulo */}
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

          {/* Botão Começar */}
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
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
    padding: 8,
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

