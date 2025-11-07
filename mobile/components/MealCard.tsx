/**
 * MealCard Component
 * 
 * Componente para exibir uma refeição em formato de card
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Coffee, Utensils, Moon, Apple } from '@expo/vector-icons';
import { MotiView } from 'moti';

interface MealCardProps {
  id: string;
  name: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  image?: string;
  time: string;
  onPress?: () => void;
}

const mealIcons = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Moon,
  snack: Apple,
};

export function MealCard({ name, calories, mealType, image, time, onPress }: MealCardProps) {
  const Icon = mealIcons[mealType] || Apple;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <TouchableOpacity
        onPress={onPress}
        className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex-row items-center mb-3 shadow-sm border border-gray-200 dark:border-gray-700"
        activeOpacity={0.7}
      >
        <View className="bg-green-100 dark:bg-green-900 rounded-xl p-3 mr-4">
          <Icon name="coffee" size={24} color="#3BB273" />
        </View>

        {image && (
          <Image
            source={{ uri: image }}
            className="w-16 h-16 rounded-lg mr-4"
            resizeMode="cover"
          />
        )}

        <View className="flex-1">
          <Text className="text-gray-900 dark:text-white font-semibold text-base mb-1">
            {name}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            {time}
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-green-600 dark:text-green-400 font-bold text-lg">
            {calories}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-xs">
            kcal
          </Text>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}

