/**
 * RegisterScreen
 * 
 * Tela de registo com email/password e Google Sign-In
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function RegisterScreen({ navigation }: any) {
  const { signUp, signInWithGoogleNative } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Por favor, preencha todos os campos',
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'As passwords não coincidem',
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'A password deve ter pelo menos 6 caracteres',
      });
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      Toast.show({
        type: 'success',
        text1: 'Conta criada!',
        text2: 'Bem-vindo ao Nuti!',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao criar conta',
        text2: error.message || 'Erro ao criar conta',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    try {
      await signInWithGoogleNative();
      Toast.show({
        type: 'success',
        text1: 'Conta criada!',
        text2: 'Bem-vindo ao Nuti!',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao criar conta',
        text2: error.message || 'Erro ao criar conta com Google',
      });
    } finally {
      setLoading(false);
    }
  };

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
              Criar Conta
            </Text>
            <Text className="text-gray-500 dark:text-gray-400">
              Junta-te ao Nuti hoje
            </Text>
          </View>

          {/* Formulário */}
          <View className="space-y-4 mb-6">
            <View>
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Nome
              </Text>
              <TextInput
                className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                placeholder="O teu nome"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View>
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Email
              </Text>
              <TextInput
                className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                placeholder="exemplo@email.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View>
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Password
              </Text>
              <View className="relative">
                <TextInput
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Confirmar Password
              </Text>
              <View className="relative">
                <TextInput
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-4"
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Botão Registro */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className="bg-green-500 rounded-xl py-4 items-center justify-center mb-4 shadow-lg"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-semibold text-lg">Criar Conta</Text>
            )}
          </TouchableOpacity>

          {/* Divisor */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
            <Text className="mx-4 text-gray-500 dark:text-gray-400">ou</Text>
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            onPress={handleGoogleRegister}
            disabled={loading}
            className="bg-white dark:bg-gray-800 rounded-xl py-4 items-center justify-center border border-gray-300 dark:border-gray-700 flex-row shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text className="text-gray-900 dark:text-white font-semibold ml-2">
              Continuar com Google
            </Text>
          </TouchableOpacity>

          {/* Link para Login */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500 dark:text-gray-400">
              Já tens conta?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-green-500 font-semibold">Entrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

