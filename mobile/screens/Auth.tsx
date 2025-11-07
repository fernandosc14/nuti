import React from 'react';
import { View, Text, Button } from 'react-native';

export default function AuthScreen({ navigation }: any) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-bold">Auth Screen</Text>
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}
