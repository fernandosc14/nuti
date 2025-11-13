/**
 * WelcomeScreen
 * 
 * Tela inicial da aplicação com opções para começar ou fazer login
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export function WelcomeScreen({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-12">
          <View className="w-32 h-32 bg-green-500 rounded-full items-center justify-center mb-6">
            <Text className="text-6xl">🥗</Text>
          </View>
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Nuti
          </Text>
          <Text className="text-lg text-gray-500 dark:text-gray-400 text-center">
            O teu assistente nutricional
          </Text>
        </View>

        {/* Botão Get Started */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Onboarding')}
          className="bg-green-500 rounded-xl py-4 px-12 w-full items-center justify-center mb-4 shadow-lg"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-lg">Get started</Text>
        </TouchableOpacity>

        {/* Link Sign In */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          className="mt-4"
        >
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            Already registered? <Text className="text-green-500 font-semibold">Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

