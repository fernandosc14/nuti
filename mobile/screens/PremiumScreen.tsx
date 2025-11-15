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
        text1: 'Bem-vindo ao Premium!',
        text2: 'Agora tens acesso a todas as funcionalidades',
      });

      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao atualizar plano',
      });
    }
  };

  const features = [
    {
      icon: '🤖',
      title: 'Chat IA Ilimitado',
      description: 'Faz quantas perguntas quiseres à Ajuda Nuti',
    },
    {
      icon: '📊',
      title: 'Relatórios Personalizados',
      description: 'Análise detalhada do teu progresso nutricional',
    },
    {
      icon: '🎯',
      title: 'Planos de Refeições',
      description: 'Recebe planos de refeições personalizados',
    },
    {
      icon: '📈',
      title: 'Estatísticas Avançadas',
      description: 'Acompanha o teu progresso com gráficos detalhados',
    },
    {
      icon: '🔔',
      title: 'Lembretes Personalizados',
      description: 'Recebe notificações para manter o teu hábito',
    },
    {
      icon: '⭐',
      title: 'Badges Exclusivas',
      description: 'Desbloqueia badges especiais apenas para Premium',
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
          paddingVertical: 16,
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
            Premium
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
              Desbloqueia o Premium
            </Text>
            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
            }}>
              Acesso completo a todas as funcionalidades
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
              Preço Especial
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
                /mês
              </Text>
            </View>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 14,
              opacity: 0.9,
            }}>
              Cancela quando quiseres
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
                  Ativar Premium Agora
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
                Já és Premium! ⭐
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
            Ao ativar, aceitas os termos e condições. O pagamento será processado
            através da tua conta da App Store/Play Store.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

