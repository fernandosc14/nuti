/**
 * BadgeNotificationModal
 * 
 * Modal animado para mostrar quando o utilizador ganha uma badge
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BadgeNotificationModalProps {
  visible: boolean;
  badge: {
    id: string;
    name: string;
    icon: string;
    description: string;
  } | null;
  onClose: () => void;
}

export function BadgeNotificationModal({ visible, badge, onClose }: BadgeNotificationModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && badge) {
      // Animação de entrada
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Fechar automaticamente após 3 segundos
      const timer = setTimeout(() => {
        handleClose();
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      // Reset animações
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, badge]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!badge) return null;

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim,
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View style={[styles.modalContainer, animatedStyle]}>
          <MotiView
            from={{ scale: 0, rotate: '-180deg' }}
            animate={{ scale: 1, rotate: '0deg' }}
            transition={{ type: 'spring', damping: 12, stiffness: 100 }}
            style={styles.badgeContainer}
          >
            {/* Gradiente de fundo */}
            <LinearGradient
              colors={['#FCD34D', '#FBBF24', '#F59E0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badgeGradient}
            >
              <View style={styles.badgeCircle}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
              </View>
            </LinearGradient>
          </MotiView>

          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('badges.earned') || 'Badge Desbloqueada!'}
            </Text>
            <Text style={[styles.badgeName, { color: theme.colors.text }]}>
              {badge.name}
            </Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary || '#9CA3AF' }]}>
              {badge.description}
            </Text>
          </View>

          {/* Botão Fechar */}
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.closeButton, { backgroundColor: theme.colors.card }]}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    marginBottom: 24,
  },
  badgeGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  badgeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeIcon: {
    fontSize: 56,
  },
  content: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});

