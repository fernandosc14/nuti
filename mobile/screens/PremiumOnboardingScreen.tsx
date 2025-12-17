/**
 * PremiumOnboardingScreen
 * 
 * Screen que aparece uma única vez após criar conta, oferecendo premium trial
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function PremiumOnboardingScreen({ navigation }: { navigation: any }) {
  const { updateProfile, refreshProfile } = useUser();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [loading, setLoading] = useState(false);

  // Fechar a screen de premium (mesmo comportamento do "Maybe later")
  const handleClose = async () => {
    if (loading) return;
    await handleSkip();
  };

  const handleStartTrial = async () => {
    // TODO: implementar compra premium
    try {
      setLoading(true);
      
      // Remover flag para não mostrar esta screen novamente
      await updateProfile({ shouldShowPremiumOnboarding: false });
      await refreshProfile();
      
      setLoading(false);
      
      Toast.show({
        type: 'success',
        text1: t('onboarding.welcomeMessage') || 'Welcome!',
        text2: t('onboarding.readyToStart') || "You're all set!",
      });
      
      // Navegar para dashboard (o App.tsx vai fazer isso automaticamente)
    } catch (error) {
      console.error('Error starting trial:', error);
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      
      // Remover flag para não mostrar esta screen novamente
      await updateProfile({ shouldShowPremiumOnboarding: false });
      await refreshProfile();
      
      setLoading(false);
      // Ir direto para o dashboard para evitar ficar preso nesta tela
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (error) {
      console.error('Error skipping:', error);
      setLoading(false);
    }
  };

  const premiumColorPrimary = theme.colors.primary;
  const premiumColorSecondary = '#4ECB87';

  const premiumFeatures = [
    {
      icon: 'chatbubbles',
      title: t('premium.feature.chat') || t('onboarding.premiumFeature1'),
      description: t('premium.feature.chatDescription'),
      color: theme.colors.primary,
    },
    {
      icon: 'stats-chart',
      title: t('premium.feature.progress') || t('onboarding.premiumFeature2'),
      description: t('premium.feature.progressDescription'),
      color: '#4ECB87',
    },
    {
      icon: 'camera',
      title: t('premium.feature.photo') || t('onboarding.premiumFeature3'),
      description: t('premium.feature.photoDescription'),
      color: '#5DD99A',
    },
    {
      icon: 'barcode',
      title: t('premium.feature.barcode') || t('onboarding.premiumFeature4'),
      description: t('premium.feature.barcodeDescription'),
      color: theme.colors.primary,
    },
    {
      icon: 'close-circle',
      title: t('premium.feature.noAds') || t('onboarding.premiumFeature5'),
      description: t('premium.feature.noAdsDescription'),
      color: '#4ECB87',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Botão Close (X) no topo-direito */}
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            zIndex: 50,
          }}
        >
          <TouchableOpacity
            onPress={handleClose}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('premium.close') || 'Close'}
            activeOpacity={0.8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.isDark ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.9)',
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 4,
            }}
          >
            <Ionicons name="close" size={20} color={theme.isDark ? '#FFFFFF' : '#111827'} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}
        >
          {/* Header */}
          <Text style={{
            fontSize: 28,
            fontWeight: '900',
            color: theme.colors.text,
            textAlign: 'center',
            marginBottom: 6,
          }}>
            {t('onboarding.premiumTitle')} ⭐
          </Text>
          <Text style={{
            fontSize: 15,
            color: theme.colors.textSecondary || '#9CA3AF',
            textAlign: 'center',
            marginBottom: 20,
            lineHeight: 22,
          }}>
            {t('premium.trialNoCommitment') || 'Try free for 3 days, no commitment'}
          </Text>

          {/* Plan selection */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 12 }}>
              {t('premium.choosePlan') || 'Choose your plan'}
            </Text>

            <View style={{ gap: 12 }}>
              {([
                {
                  key: 'yearly' as const,
                  title: t('premium.yearly') || 'Yearly',
                  price: '39,99€',
                  period: t('premium.perYear') || '/year',
                  subtitle: t('premium.onlyPerMonth') || 'Only 3.33€/month',
                  badge: t('premium.bestValue') || 'BEST VALUE',
                  badgeColor: '#F59E0B',
                },
                {
                  key: 'monthly' as const,
                  title: t('premium.monthly') || 'Monthly',
                  price: '7,99€',
                  period: t('premium.perMonth') || '/month',
                  subtitle: t('premium.cancelAnytime') || 'Cancel anytime',
                  badge: null,
                  badgeColor: null,
                },
              ]).map((plan) => {
                const active = selectedPlan === plan.key;
                return (
                  <Pressable
                    key={plan.key}
                    onPress={() => setSelectedPlan(plan.key)}
                    style={{
                      borderRadius: 16,
                      borderWidth: active ? 3 : 2,
                      borderColor: active ? premiumColorPrimary : theme.colors.border || '#E5E7EB',
                      backgroundColor: theme.colors.card,
                      padding: 16,
                      shadowColor: active ? premiumColorPrimary : '#000',
                      shadowOffset: { width: 0, height: active ? 4 : 2 },
                      shadowOpacity: active ? 0.2 : 0.08,
                      shadowRadius: active ? 8 : 6,
                      elevation: active ? 5 : 3,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text }}>{plan.title}</Text>
                          {plan.badge && (
                            <View style={{
                              backgroundColor: plan.badgeColor || premiumColorPrimary,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 8,
                            }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 }}>{plan.badge}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                          <Text style={{ fontSize: 26, fontWeight: '900', color: theme.colors.text }}>{plan.price}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary || '#9CA3AF', marginLeft: 4 }}>{plan.period}</Text>
                        </View>
                        <Text style={{ fontSize: 13.5, color: theme.colors.textSecondary || '#9CA3AF' }}>{plan.subtitle}</Text>
                      </View>
                      <View style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        borderWidth: 2,
                        borderColor: active ? premiumColorPrimary : theme.colors.border || '#E5E7EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? premiumColorPrimary : 'transparent',
                      }}>
                        {active && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{
              fontSize: 12,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
              marginTop: 10,
            }}>
              ✓ {t('premium.freeTrialDays') || '3 days free'} · {t('premium.noPaymentNow') || 'No payment now'}
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleStartTrial}
            disabled={loading}
            activeOpacity={0.85}
            style={{
              borderRadius: 16,
              marginBottom: 12,
              shadowColor: premiumColorPrimary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 14,
              elevation: 9,
              overflow: 'hidden',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <LinearGradient
              colors={[premiumColorPrimary, premiumColorSecondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 18,
                paddingHorizontal: 24,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '700',
              }}>
                {t('premium.startTrial') || 'Try Now'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            disabled={loading}
            style={{
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <Text style={{
              color: theme.colors.textSecondary || '#9CA3AF',
              fontSize: 16,
              fontWeight: '600',
            }}>
              {t('premium.skip') || 'Maybe later'}
            </Text>
          </TouchableOpacity>

          <Text style={{
            color: theme.colors.textSecondary || '#9CA3AF',
            textAlign: 'center',
            fontSize: 12.5,
            marginBottom: 32,
            lineHeight: 18,
            paddingHorizontal: 8,
          }}>
            {t('premium.billingNotice') || 'No charge today. After 3 days, 39.99€/year (~3.33€/month) or 7.99€/month. Cancel anytime.'}
          </Text>

          {/* Features */}
          <View style={{ gap: 12, marginBottom: 12 }}>
            {premiumFeatures.map((feature, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: feature.color + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}>
                  <Ionicons name={feature.icon as any} size={22} color={feature.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: 4,
                  }}>
                    {feature.title}
                  </Text>
                  {!!feature.description && (
                    <Text style={{
                      fontSize: 13.5,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      lineHeight: 20,
                    }}>
                      {feature.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
