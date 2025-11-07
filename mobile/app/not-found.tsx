import React from 'react';
import { View, Text } from 'react-native';
import Button from '../components/Button';
import { useRouter } from 'expo-router';

export default function NotFound() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-2xl font-bold mb-4">Página não encontrada</Text>
      <Button onPress={() => router.replace('/')}>Ir para Início</Button>
    </View>
  );
}
