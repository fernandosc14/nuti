/**
 * PremiumScreen
 * 
 * Tela de upgrade para Premium
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function PremiumScreen({ navigation }: any) {
  const { profile, updateProfile } = useUser();

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
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#3BB273" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Premium
          </Text>
        </View>

        <View className="px-6 py-6">
          {/* Hero Section */}
          <View className="items-center mb-8">
            <View className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full items-center justify-center mb-6">
              <Text className="text-6xl">⭐</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Desbloqueia o Premium
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center">
              Acesso completo a todas as funcionalidades
            </Text>
          </View>

          {/* Features */}
          <View className="mb-8">
            {features.map((feature, index) => (
              <View
                key={index}
                className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-4 flex-row items-start"
              >
                <Text className="text-3xl mr-4">{feature.icon}</Text>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-400 text-sm">
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing */}
          <View className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 mb-6">
            <View className="items-center">
              <Text className="text-white text-sm mb-2">Preço Especial</Text>
              <View className="flex-row items-baseline mb-2">
                <Text className="text-white text-4xl font-bold">9,99€</Text>
                <Text className="text-white/80 text-lg ml-2">/mês</Text>
              </View>
              <Text className="text-white/90 text-sm">
                Cancela quando quiseres
              </Text>
            </View>
          </View>

          {/* CTA Button */}
          {profile?.plan !== 'premium' ? (
            <TouchableOpacity
              onPress={handleUpgrade}
              className="bg-green-500 rounded-xl py-4 items-center mb-4 shadow-lg"
            >
              <Text className="text-white font-semibold text-lg">
                Ativar Premium Agora
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-xl py-4 items-center mb-4">
              <Text className="text-gray-700 dark:text-gray-300 font-semibold text-lg">
                Já és Premium! ⭐
              </Text>
            </View>
          )}

          {/* Terms */}
          <Text className="text-gray-500 dark:text-gray-400 text-xs text-center">
            Ao ativar, aceitas os termos e condições. O pagamento será processado
            através da tua conta da App Store/Play Store.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

