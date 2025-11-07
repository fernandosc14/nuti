import React from 'react';
import { View, Text, Button } from 'react-native';

export default function HomeScreen({ navigation }: any) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-bold">Nutri Mate (mobile)</Text>
      <Button title="Go to Auth" onPress={() => navigation.navigate('Auth')} />
    </View>
  );
}
