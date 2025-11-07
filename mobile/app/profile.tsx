import React from 'react';
import { View, Text } from 'react-native';
import Card from '../components/Card';
import Button from '../components/Button';

export default function Profile() {
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-bold mb-4">Perfil</Text>

      <Card style={{ marginBottom: 12 }}>
        <Text className="text-lg font-semibold">Usuário</Text>
        <Text className="text-sm text-gray-600">email@exemplo.com</Text>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text className="text-lg font-semibold">Preferências</Text>
        <Text className="text-sm text-gray-600">Meta de calorias e outras definições.</Text>
      </Card>

      <Button variant="secondary">Editar perfil</Button>
    </View>
  );
}
