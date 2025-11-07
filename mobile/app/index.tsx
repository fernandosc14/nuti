import React from 'react';
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function Home() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">Nutri Mate (mobile)</Text>
      <Button title="Ir para Auth" onPress={() => router.push('/auth')} />
      <View style={{ height: 8 }} />
      <Button title="Testar estilos" onPress={() => router.push('/test-style')} />
    </View>
  );
}
