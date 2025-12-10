/**
 * PremiumScreen
 * 
 * Tela de upgrade para Premium
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
      icon: 'chatbubbles',
      iconColor: theme.colors.primary,
      title: t('premium.feature.chat') || 'Chat Coach Nuti',
      description: t('premium.feature.chatDescription') || 'Acesso ilimitado ao chat com o Coach Nuti para todas as tuas dúvidas sobre nutrição',
    },
    {
      icon: 'stats-chart',
      iconColor: '#4ECB87',
      title: t('premium.feature.progress') || 'Progress Screen',
      description: t('premium.feature.progressDescription') || 'Acompanha o teu progresso detalhado com gráficos e estatísticas avançadas',
    },
    {
      icon: 'camera',
      iconColor: '#5DD99A',
      title: t('premium.feature.photo') || 'Adicionar Refeição por Foto',
      description: t('premium.feature.photoDescription') || 'Tira uma foto da tua refeição e deixa a IA identificar automaticamente os alimentos e valores nutricionais',
    },
    {
      icon: 'barcode',
      iconColor: theme.colors.primary,
      title: t('premium.feature.barcode') || 'Adicionar Refeição por Código de Barras',
      description: t('premium.feature.barcodeDescription') || 'Escanear códigos de barras de produtos para adicionar refeições rapidamente',
    },
    {
      icon: 'close-circle',
      iconColor: '#4ECB87',
      title: t('premium.feature.noAds') || 'Sem Anúncios',
      description: t('premium.feature.noAdsDescription') || 'Experiência sem interrupções, sem anúncios publicitários',
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      {!theme.isDark && (
        <LinearGradient
          colors={[theme.colors.primary, '#F0FDF4', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          locations={[0, 0.15, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {/* Header Fixo */}
      <View style={{ backgroundColor: theme.isDark ? theme.colors.card : 'transparent' }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 18,
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
      </View>

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
            style={{ alignItems: 'center', marginBottom: 24 }}
          >
            <LinearGradient
              colors={[theme.colors.primary, '#4ECB87']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="star" size={32} color="#FFFFFF" />
            </LinearGradient>
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 4,
              textAlign: 'center',
            }}>
              {t('premium.unlockTitle') || 'Unlock Premium'}
            </Text>
            <Text style={{
              fontSize: 14,
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
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: feature.iconColor + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}>
                  <Ionicons name={feature.icon as any} size={24} color={feature.iconColor} />
                </View>
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
          >
            <LinearGradient
              colors={[theme.colors.primary, '#4ECB87', '#5DD99A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                padding: 24,
                marginBottom: 24,
                alignItems: 'center',
                shadowColor: theme.colors.primary,
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
            </LinearGradient>
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
                  borderRadius: 16,
                  marginBottom: 16,
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 8,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={[theme.colors.primary, '#4ECB87']}
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
                    {t('premium.activateButton') || 'Activate Premium Now'}
                  </Text>
                </LinearGradient>
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
                borderColor: theme.colors.primary,
              }}
            >
              <Text style={{
                color: theme.colors.primary,
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

