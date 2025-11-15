/**
 * ChartCircle Component
 * 
 * Componente de gráfico circular para exibir progresso de calorias
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { calculatePercentage, calculateRemaining } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ChartCircleProps {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
}

export function ChartCircle({ consumed, goal, size = 200, strokeWidth = 20 }: ChartCircleProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const percentage = calculatePercentage(consumed, goal);
  const remaining = calculateRemaining(consumed, goal);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(percentage / 100, { duration: 1000 });
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (progress.value * circumference);
    return {
      strokeDashoffset,
    };
  });

  // Cores baseadas no progresso
  const getColor = () => {
    if (percentage >= 100) return '#EF4444'; // Vermelho se excedeu
    if (percentage >= 75) return '#3BB273'; // Verde se próximo da meta
    if (percentage >= 50) return '#F59E0B'; // Laranja se médio
    return '#3B82F6'; // Azul se baixo
  };

  const color = getColor();

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    }]}>
      {/* Título */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Text style={{ fontSize: 24 }}>🔥</Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('dashboard.calories')}
        </Text>
      </View>

      {/* Círculo */}
      <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
        <Svg width={size} height={size}>
          {/* Círculo de fundo */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.mode === 'dark' ? '#374151' : '#F3F4F6'}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Círculo de progresso */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            animatedProps={animatedProps}
          />
        </Svg>

        {/* Texto central */}
        <View style={styles.textContainer}>
          <Text style={[styles.consumedText, { color: color }]}>{consumed}</Text>
          <Text style={[styles.kcalLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
            kcal
          </Text>
          <View style={styles.progressIndicator}>
            <View style={[styles.progressDot, { backgroundColor: color }]} />
            <Text style={[styles.percentageText, { color: theme.colors.textSecondary || '#6B7280' }]}>
              {Math.round(percentage)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Informações */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
              {t('dashboard.caloriesGoal')}
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {goal} kcal
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.border || '#E5E7EB' }]} />
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
              {t('dashboard.caloriesRemaining')}
            </Text>
            <Text style={[styles.infoValue, { color: remaining > 0 ? '#3BB273' : '#EF4444' }]}>
              {remaining} kcal
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consumedText: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 56,
  },
  kcalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    width: '100%',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});

