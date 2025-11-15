/**
 * MealCard Component
 * 
 * Componente para exibir uma refeição em formato de card
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Coffee, Utensils, Moon, Apple } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useTheme } from '../context/ThemeContext';

interface MealCardProps {
  id: string;
  name: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  image?: string;
  time: string;
  onPress?: () => void;
  onDelete?: () => void;
}

const mealIcons = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Moon,
  snack: Apple,
};

export function MealCard({ name, calories, mealType, image, time, onPress, onDelete }: MealCardProps) {
  try {
    const themeContext = useTheme();
    let theme;
    let Icon;
    
    if (!themeContext || !themeContext.theme) {
      // Usar valores padrão se o theme não estiver disponível
      theme = {
        mode: 'light',
        colors: {
          card: '#FFFFFF',
          text: '#111827',
          textSecondary: '#9CA3AF',
          primary: '#3BB273',
          border: '#E5E7EB',
        }
      };
    } else {
      theme = themeContext.theme;
    }
    
    Icon = mealIcons[mealType] || Apple;

    return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          backgroundColor: theme?.colors?.card || '#FFFFFF',
          borderRadius: 16,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
          borderWidth: 1,
          borderColor: theme?.colors?.border || '#E5E7EB',
          overflow: 'hidden',
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              marginRight: 12,
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            backgroundColor: (theme?.colors?.primary || '#3BB273') + '15',
            borderRadius: 12,
            padding: 10,
            marginRight: 12,
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
          }}>
            {Icon && typeof Icon === 'function' ? (
              <Icon name="coffee" size={22} color={theme?.colors?.primary || '#3BB273'} />
            ) : (
              <Text style={{ fontSize: 22 }}>🍽️</Text>
            )}
          </View>
        )}

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text 
            style={{
              color: theme?.colors?.text || '#111827',
              fontWeight: '600',
              fontSize: 15,
              marginBottom: 2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name || 'Meal'}
          </Text>
          <Text style={{
            color: theme?.colors?.textSecondary || '#9CA3AF',
            fontSize: 12,
          }}>
            {time || ''}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginRight: onDelete ? 8 : 0 }}>
          <Text style={{
            color: theme?.colors?.primary || '#3BB273',
            fontWeight: '600',
            fontSize: 15,
          }}>
            {calories || 0}
          </Text>
          <Text style={{
            color: theme?.colors?.textSecondary || '#9CA3AF',
            fontSize: 10,
            marginTop: 1,
          }}>
            kcal
          </Text>
        </View>

        {onDelete && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              padding: 6,
              marginLeft: 4,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={theme?.colors?.error || '#EF4444'} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </MotiView>
  );
  } catch (error) {
    console.error('Error rendering MealCard:', error);
    return null;
  }
}

