import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import Card from '../components/Card';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold">Dashboard</Text>
        <Avatar fallback="U" />
      </View>

      <Card style={{ marginBottom: 12 }}>
        <Text className="text-lg font-semibold mb-2">Bem-vindo de volta</Text>
        <Text className="text-sm text-gray-600">Aqui estão os seus dados de hoje.</Text>
        <View className="mt-3">
          <Button onPress={() => router.push('/meals')}>Ver refeições</Button>
        </View>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text className="text-lg font-semibold mb-2">Progresso de calorias</Text>
        <Text className="text-sm text-gray-600">Progresso do dia e metas</Text>
      </Card>

      <Card>
        <Text className="text-lg font-semibold mb-2">Sugestões</Text>
        <Text className="text-sm text-gray-600">Dicas rápidas para hoje.</Text>
      </Card>
    </ScrollView>
  );
}
