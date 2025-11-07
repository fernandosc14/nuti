import React from 'react';
import { View, Text, FlatList } from 'react-native';
import Card from '../components/Card';
import Button from '../components/Button';

const DUMMY = [
  { id: '1', name: 'Ovos e torrada', kcal: 420 },
  { id: '2', name: 'Almoço: frango e arroz', kcal: 680 },
  { id: '3', name: 'Snack: Iogurte', kcal: 150 },
];

export default function Meals() {
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-bold mb-4">Refeições</Text>

      <FlatList
        data={DUMMY}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-semibold">{item.name}</Text>
                <Text className="text-sm text-gray-600">{item.kcal} kcal</Text>
              </View>
              <Button variant="ghost">Detalhes</Button>
            </View>
          </Card>
        )}
      />

      <Button style={{ marginTop: 12 }}>Adicionar refeição</Button>
    </View>
  );
}
