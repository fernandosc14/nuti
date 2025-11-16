/**
 * PremiumScreen
 * 
 * Tela de upgrade para Premium
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';

export function PremiumScreen({ navigation }: any) {
  const { profile, updateProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const handleUpgrade = async () => {
    try {
      // Simulação de pagamento
      // Em produção, integrar com Stripe ou Google Pay
      await updateProfile({ plan: 'premium' });

      Toast.show({
        type: 'success',
        text1: t('premium.welcomeTitle') || 'Welcome to Premium!',
        text2: t('premium.welcomeMessage') || 'You now have access to all premium features',
      });

      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Error',
        text2: error.message || t('premium.updateError') || 'Error updating plan',
      });
    }
  };

  const features = [
    {
      icon: '💬',
      title: t('premium.feature1') || 'Unlimited Chat',
      description: t('premium.feature1Description') || 'Ask as many questions as you want to Nuti Help',
    },
    {
      icon: '📊',
      title: t('premium.feature2') || 'Personalized Reports',
      description: t('premium.feature2Description') || 'Detailed analysis of your nutritional progress',
    },
    {
      icon: '🎯',
      title: t('premium.feature3') || 'Meal Plans',
      description: t('premium.feature3Description') || 'Receive personalized meal plans',
    },
    {
      icon: '📈',
      title: t('premium.feature4') || 'Advanced Statistics',
      description: t('premium.feature4Description') || 'Track your progress with detailed charts',
    },
    {
      icon: '🔔',
      title: t('premium.feature5') || 'Personalized Reminders',
      description: t('premium.feature5Description') || 'Receive notifications to maintain your habit',
    },
    {
      icon: '⭐',
      title: t('premium.feature6') || 'Exclusive Badges',
      description: t('premium.feature6Description') || 'Unlock special badges only for Premium',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header Fixo */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.card }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border || '#E5E7EB',
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.background,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
            flex: 1,
          }}>
            {t('premium.title') || 'Premium'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          {/* Hero Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={{ alignItems: 'center', marginBottom: 32 }}
          >
            <View style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: '#8B5CF6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              shadowColor: '#8B5CF6',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}>
              <Text style={{ fontSize: 64 }}>⭐</Text>
            </View>
            <Text style={{
              fontSize: 32,
              fontWeight: '800',
              color: theme.colors.text,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              {t('premium.unlockTitle') || 'Unlock Premium'}
            </Text>
            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
            }}>
              {t('premium.unlockDescription') || 'Full access to all features'}
            </Text>
          </MotiView>

          {/* Features */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={{ marginBottom: 32 }}
          >
            {features.map((feature, index) => (
              <MotiView
                key={index}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 150 + index * 50 }}
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <Text style={{ fontSize: 32, marginRight: 16 }}>{feature.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: 4,
                  }}>
                    {feature.title}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    lineHeight: 20,
                  }}>
                    {feature.description}
                  </Text>
                </View>
              </MotiView>
            ))}
          </MotiView>

          {/* Pricing */}
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 450 }}
            style={{
              backgroundColor: '#8B5CF6',
              borderRadius: 20,
              padding: 24,
              marginBottom: 24,
              alignItems: 'center',
              shadowColor: '#8B5CF6',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Text style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 8,
              opacity: 0.9,
            }}>
              {t('premium.specialPrice') || 'Special Price'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 48,
                fontWeight: '900',
              }}>
                9,99€
              </Text>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '600',
                marginLeft: 8,
                opacity: 0.9,
              }}>
                {t('premium.perMonth') || '/month'}
              </Text>
            </View>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 14,
              opacity: 0.9,
            }}>
              {t('premium.cancelAnytime') || 'Cancel anytime'}
            </Text>
          </MotiView>

          {/* CTA Button */}
          {profile?.plan !== 'premium' ? (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 500 }}
            >
              <TouchableOpacity
                onPress={handleUpgrade}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#8B5CF6',
                  borderRadius: 16,
                  paddingVertical: 18,
                  paddingHorizontal: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  shadowColor: '#8B5CF6',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: '700',
                }}>
                  {t('premium.activateButton') || 'Activate Premium Now'}
                </Text>
              </TouchableOpacity>
            </MotiView>
          ) : (
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 400 }}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 16,
                paddingVertical: 18,
                paddingHorizontal: 24,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                borderWidth: 2,
                borderColor: '#8B5CF6',
              }}
            >
              <Text style={{
                color: '#8B5CF6',
                fontSize: 18,
                fontWeight: '700',
              }}>
                {t('premium.alreadyPremium') || 'You are already Premium!'} ⭐
              </Text>
            </MotiView>
          )}

          {/* Terms */}
          <Text style={{
            fontSize: 12,
            color: theme.colors.textSecondary || '#9CA3AF',
            textAlign: 'center',
            lineHeight: 18,
          }}>
            {t('premium.terms') || 'By activating, you accept the terms and conditions. Payment will be processed through your App Store/Play Store account.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

