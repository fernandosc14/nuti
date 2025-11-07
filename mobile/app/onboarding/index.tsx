import React from 'react';
import { View, Text } from 'react-native';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { useRouter } from 'expo-router';

export default function OnboardingIndex() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50 p-4 items-center justify-center">
      <Card style={{ width: '100%', maxWidth: 560 }}>
        <Text className="text-2xl font-bold mb-2">Bem-vindo ao Onboarding</Text>
        <Text className="text-sm text-gray-600 mb-4">Algumas perguntas rápidas para configurar sua conta.</Text>
        <Button onPress={() => router.push('/onboarding/welcome')}>Começar</Button>
      </Card>
    </View>
  );
}
