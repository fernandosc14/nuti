/**
 * BadgeItem Component
 * 
 * Componente para exibir uma badge desbloqueada
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';

interface BadgeItemProps {
  id: string;
  name: string;
  icon: string;
  description?: string;
  earnedAt?: Date;
  size?: 'small' | 'medium' | 'large';
}

export function BadgeItem({ name, icon, description, earnedAt, size = 'medium' }: BadgeItemProps) {
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-20 h-20',
    large: 'w-24 h-24',
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  return (
    <MotiView
      from={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', damping: 15 }}
      className="items-center m-2"
    >
      <View
        style={{
          width: size === 'small' ? 64 : size === 'large' ? 96 : 80,
          height: size === 'small' ? 64 : size === 'large' ? 96 : 80,
          backgroundColor: '#FCD34D',
          borderRadius: 9999,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Text className="text-2xl">{icon}</Text>
      </View>
      <Text className={`${textSizes[size]} font-semibold text-gray-900 dark:text-white text-center`}>
        {name}
      </Text>
      {description && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
          {description}
        </Text>
      )}
      {earnedAt && (
        <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
          {earnedAt.toLocaleDateString('pt-PT')}
        </Text>
      )}
    </MotiView>
  );
}

