/**
 * LoginScreen
 * 
 * Tela de login com email/password e Google Sign-In
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function LoginScreen({ navigation }: any) {
  const { signInWithGoogleNative } = useUser();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-4">
              <Text className="text-4xl">🥗</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Nuti
            </Text>
            <Text className="text-gray-500 dark:text-gray-400">
              {t('welcome.subtitle')}
            </Text>
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            onPress={async () => {
              setLoading(true);
              try {
                await signInWithGoogleNative();
                Toast.show({
                  type: 'success',
                  text1: t('common.success'),
                  text2: t('auth.signIn') + ' ' + t('common.success'),
                });
              } catch (error: any) {
                Toast.show({
                  type: 'error',
                  text1: t('common.error'),
                  text2: error?.message || t('common.error'),
                });
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-white dark:bg-gray-800 rounded-xl py-4 items-center justify-center border border-gray-300 dark:border-gray-700 flex-row shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text className="text-gray-900 dark:text-white font-semibold ml-2">
              {t('auth.continueWithGoogle')}
            </Text>
          </TouchableOpacity>


          {/* Link para Welcome */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500 dark:text-gray-400">
              {t('auth.noAccount')}{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
              <Text className="text-green-500 font-semibold">{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

