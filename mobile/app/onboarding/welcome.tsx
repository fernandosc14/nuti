import React from 'react';
import { View, Text } from 'react-native';
import Button from '../../components/Button';
import { useRouter } from 'expo-router';

export default function WelcomeStep() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50 p-4 items-center justify-center">
      <Text className="text-2xl font-bold mb-4">Vamos começar</Text>
      <Text className="text-sm text-gray-600 mb-6">Escolha seus objetivos e preferências.</Text>
      <Button onPress={() => router.replace('/dashboard')}>Ir para Dashboard</Button>
    </View>
  );
}
