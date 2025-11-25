/**
 * MealCard Component
 * 
 * Componente para exibir uma refeição em formato de card
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
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
  healthScore?: number; // Score de saúde (0-10)
  onPress?: () => void;
  onDelete?: () => void;
}

// Ícones para cada tipo de refeição usando Ionicons
const getMealIcon = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
  switch (mealType) {
    case 'breakfast':
      return 'cafe-outline';
    case 'lunch':
      return 'restaurant-outline';
    case 'dinner':
      return 'moon-outline';
    case 'snack':
      return 'nutrition-outline';
    default:
      return 'restaurant-outline';
  }
};

export function MealCard({ name, calories, mealType, image, time, healthScore, onPress, onDelete }: MealCardProps) {
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

    // Cores diferentes apenas para ícones e calorias
    const getMealStyle = () => {
      switch (mealType) {
        case 'breakfast':
          return {
            iconBg: '#FEF3C7',
            iconColor: '#F59E0B',
            accentColor: '#F59E0B',
          };
        case 'lunch':
        case 'dinner':
          return {
            iconBg: '#D1FAE5',
            iconColor: '#3BB273',
            accentColor: '#3BB273',
          };
        case 'snack':
          return {
            iconBg: '#E9D5FF',
            iconColor: '#A855F7',
            accentColor: '#A855F7',
          };
        default:
          return {
            iconBg: (theme?.colors?.primary || '#3BB273') + '15',
            iconColor: theme?.colors?.primary || '#3BB273',
            accentColor: theme?.colors?.primary || '#3BB273',
          };
      }
    };

    const mealStyle = getMealStyle();

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
            backgroundColor: mealStyle.iconBg,
            borderRadius: 12,
            padding: 10,
            marginRight: 12,
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
          }}>
            <Ionicons 
              name={getMealIcon(mealType) as any} 
              size={22} 
              color={mealStyle.iconColor} 
            />
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
            color: mealStyle.accentColor,
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
          {/* Health Score */}
          {healthScore !== undefined && healthScore !== null && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              backgroundColor: healthScore >= 7 
                ? '#D1FAE5' 
                : healthScore >= 5 
                ? '#FEF3C7' 
                : '#FEE2E2',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
            }}>
              <Ionicons 
                name="heart" 
                size={10} 
                color={healthScore >= 7 
                  ? '#10B981' 
                  : healthScore >= 5 
                  ? '#F59E0B' 
                  : '#EF4444'} 
                style={{ marginRight: 3 }}
              />
              <Text style={{
                color: healthScore >= 7 
                  ? '#047857' 
                  : healthScore >= 5 
                  ? '#92400E' 
                  : '#991B1B',
                fontSize: 10,
                fontWeight: '600',
              }}>
                {healthScore}/10
              </Text>
            </View>
          )}
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

