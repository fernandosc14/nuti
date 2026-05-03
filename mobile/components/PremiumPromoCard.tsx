/**
 * PremiumPromoCard
 * 
 * Promotional card to promote the Premium upgrade.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

interface PremiumPromoCardProps {
  onPress?: () => void;
  variant?: 'default' | 'compact';
  fullWidth?: boolean;
}

export function PremiumPromoCard({ onPress, variant = 'default', fullWidth = false }: PremiumPromoCardProps) {
  const { profile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const accent = theme.colors.primary || '#3BB273';

  // Don't show if already premium
  if (profile?.plan === 'premium') {
    return null;
  }

  if (variant === 'compact') {
    return (
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={[
            styles.compactCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border || '#E5E7EB',
              marginHorizontal: fullWidth ? 0 : 24,
              width: fullWidth ? '100%' : undefined,
              shadowColor: accent,
            },
          ]}
        >
          {/* Removed left accent bar per request */}
          <View style={styles.compactContent}>
            <View style={[styles.compactIconContainer, { backgroundColor: accent + '22' }]}> 
              <Ionicons name="sparkles" size={20} color={accent} />
            </View>
            <View style={styles.compactTextContainer}>
              <Text style={[styles.compactTitle, { color: theme.colors.text }]}>
                {t('premium.promoTitle') || 'Desbloqueia Premium'}
              </Text>
              <Text style={[styles.compactSubtitle, { color: theme.colors.textSecondary || '#9CA3AF' }]}>
                {t('premium.trialNoCommitment') || 'Experimenta grátis por 3 dias'}
              </Text>
            </View>
            <View style={[styles.compactCta, { backgroundColor: accent }]}> 
              <Text style={styles.compactCtaText}>{t('premium.startTrial') || 'Experimenta agora'}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  }

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}
      >
        {/* Subtle background gradient */}
        <View style={[styles.gradientOverlay, { backgroundColor: '#8B5CF6' + '10' }]} />
        
        <View style={styles.content}>
          {/* Premium icon */}
          <View style={[styles.iconContainer, { backgroundColor: '#8B5CF6' + '20' }]}>
            <Text style={styles.iconEmoji}>⭐</Text>
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('premium.promoTitle') || 'Desbloqueia Premium'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary || '#9CA3AF' }]}>
              {t('premium.promoDescription') || 'Acesso completo a todas as funcionalidades premium'}
            </Text>
          </View>

          {/* Amazing features */}
          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {t('premium.feature1') || 'Chat Ilimitado'}
              </Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {t('premium.feature2') || 'Relatórios Personalizados'}
              </Text>
            </View>
          </View>

          {/* Button */}
          <View style={[styles.button, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.buttonText}>
              {t('premium.upgradeButton') || 'Atualizar Agora'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    marginVertical: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  iconEmoji: {
    fontSize: 32,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Compact variant
  compactCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactTextContainer: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  compactSubtitle: {
    fontSize: 12,
  },
  compactCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  compactCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});

