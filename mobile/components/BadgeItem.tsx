/**
 * BadgeItem Component
 * 
 * Componente para exibir uma badge desbloqueada
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from '../context/ThemeContext';

interface BadgeItemProps {
  id: string;
  name: string;
  icon: string;
  description?: string;
  earnedAt?: Date;
  size?: 'small' | 'medium' | 'large';
}

export function BadgeItem({ name, icon, description, earnedAt, size = 'medium' }: BadgeItemProps) {
  const { theme } = useTheme();

  const badgeSize = size === 'small' ? 64 : size === 'large' ? 96 : 80;
  const iconSize = size === 'small' ? 32 : size === 'large' ? 48 : 40;
  const nameFontSize = size === 'small' ? 12 : size === 'large' ? 16 : 14;
  const descriptionFontSize = size === 'small' ? 10 : 11;

  return (
    <MotiView
      from={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 15 }}
      style={styles.container}
    >
      <View
        style={[
          styles.badgeCircle,
          {
            width: badgeSize,
            height: badgeSize,
            backgroundColor: theme.isDark ? '#FCD34D' : '#FCD34D',
            shadowColor: theme.isDark ? '#FCD34D' : '#000',
          },
        ]}
      >
        <Text style={[styles.icon, { fontSize: iconSize }]}>{icon}</Text>
      </View>
      <Text
        style={[
          styles.name,
          {
            fontSize: nameFontSize,
            color: theme.colors.text,
            marginTop: 8,
          },
        ]}
      >
        {name}
      </Text>
      {description && (
        <Text
          style={[
            styles.description,
            {
              fontSize: descriptionFontSize,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginTop: 4,
            },
          ]}
        >
          {description}
        </Text>
      )}
      {earnedAt && (
        <Text
          style={[
            styles.earnedAt,
            {
              fontSize: descriptionFontSize,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginTop: 4,
            },
          ]}
        >
          {earnedAt.toLocaleDateString('pt-PT')}
        </Text>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    margin: 8,
  },
  badgeCircle: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    textAlign: 'center',
  },
  name: {
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  earnedAt: {
    textAlign: 'center',
  },
});

