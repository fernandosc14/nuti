import React from 'react';
import { View, Text } from 'react-native';
import Button from '../components/Button';
import { useEffect } from 'react';

// runtime debug: log whether react-native-css-interop runtime is available
import * as RNInterop from 'react-native-css-interop';
import { useRouter } from 'expo-router';

export default function TestStyle() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <Text className="text-xl font-bold mb-4">Teste de estilos NativeWind</Text>

      <View className="bg-red-500 p-6 rounded-lg mb-4">
        <Text className="text-white">Se isto estiver estilizado, o NativeWind está a funcionar</Text>
      </View>

      <View className="bg-blue-500 p-6 rounded-lg mb-4">
        <Text className="text-white">Box azul</Text>
      </View>

      <Button onPress={() => router.back()}>Voltar</Button>
    </View>
  );
}

// Log presence of runtime API to Metro so we can debug why className isn't applying
try {
  // some APIs are only present on native runtime
  // eslint-disable-next-line no-console
  console.log('react-native-css-interop API keys:', Object.keys(RNInterop || {}));
} catch (e) {
  // eslint-disable-next-line no-console
  console.log('react-native-css-interop not available at runtime', e && e.message);
}
