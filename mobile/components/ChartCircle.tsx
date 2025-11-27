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
import { Ionicons } from '@expo/vector-icons';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ChartCircleProps {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
}

export function ChartCircle({ consumed, goal, size = 220, strokeWidth = 24 }: ChartCircleProps) {
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
    return '#3BB273'; // Verde se dentro do limite
  };

  const color = getColor();

  return (
    <View style={styles.wrapper}>
      {/* Card */}
      <View style={[styles.container, {
        backgroundColor: 'transparent',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
      }]}>
        {/* Círculo em destaque - principal */}
        <View style={styles.circleWrapper}>
          <Svg width={size} height={size} style={styles.svgContainer}>
            {/* Círculo de fundo */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.mode === 'dark' ? '#4B5563' : '#E5E7EB'}
              strokeWidth={strokeWidth}
              fill="transparent"
              opacity={theme.mode === 'dark' ? 0.5 : 0.7}
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

          {/* Texto central - Valor consumido em destaque */}
          <View style={styles.textContainer}>
            <View style={styles.valueContainer}>
              <Text style={[styles.consumedText, { color: color }]}>{consumed}</Text>
              <Text style={[styles.kcalLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
                kcal
              </Text>
            </View>
            <View style={[styles.progressIndicator, { backgroundColor: color + '15' }]}>
              <View style={[styles.progressDot, { backgroundColor: color }]} />
              <Text style={[styles.percentageText, { color: color }]}>
                {Math.round(percentage)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Informações discretas abaixo */}
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="flag-outline" size={12} color={theme.colors.textSecondary || '#9CA3AF'} />
              <Text style={[styles.infoText, { color: theme.colors.textSecondary || '#9CA3AF' }]}>
                {goal} kcal
              </Text>
            </View>
            <View style={[styles.separator, { backgroundColor: theme.colors.border || '#E5E7EB' }]} />
            <View style={styles.infoItem}>
              <Ionicons 
                name={remaining > 0 ? "checkmark-circle-outline" : "warning-outline"} 
                size={12} 
                color={remaining > 0 ? '#3BB273' : '#EF4444'} 
              />
              <Text style={[styles.infoText, { 
                color: remaining > 0 ? '#3BB273' : '#EF4444',
                opacity: 0.8,
              }]}>
                {remaining} kcal
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  circleWrapper: {
    width: 220,
    height: 220,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  svgContainer: {
    shadowColor: '#3BB273',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  consumedText: {
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 58,
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  kcalLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.8,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoContainer: {
    width: '100%',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  separator: {
    width: 1,
    height: 16,
    opacity: 0.3,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

