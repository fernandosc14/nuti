import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function BottomNav() {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-around bg-white border-t border-gray-200 p-2">
      <Pressable onPress={() => router.replace('/dashboard')} className="px-3 py-2">
        <Text className="text-sm">Dashboard</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/meals')} className="px-3 py-2">
        <Text className="text-sm">Refeições</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/profile')} className="px-3 py-2">
        <Text className="text-sm">Perfil</Text>
      </Pressable>
    </View>
  );
}
