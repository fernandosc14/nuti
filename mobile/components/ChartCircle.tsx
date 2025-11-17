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

export function ChartCircle({ consumed, goal, size = 170, strokeWidth = 18 }: ChartCircleProps) {
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
      {/* Header - Fora do card */}
      {/* <View style={styles.header}>
        <Text style={{ fontSize: 24, marginRight: 8 }}>🔥</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('dashboard.calories')}
        </Text>
      </View> */}

      {/* Card */}
      <View style={[styles.container, {
        backgroundColor: theme.colors.card,
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
      }]}>
        {/* Content Row: Círculo + Info */}
      <View style={styles.contentRow}>
        {/* Círculo */}
        <View style={styles.circleWrapper}>
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

        {/* Informações ao lado */}
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <View style={styles.infoHeader}>
              <Ionicons name="flag-outline" size={14} color={theme.colors.textSecondary || '#6B7280'} />
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
                {t('dashboard.caloriesGoal')}
              </Text>
            </View>
            <View style={styles.infoValueContainer}>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {goal}
              </Text>
              <Text style={[styles.infoUnit, { color: theme.colors.textSecondary || '#6B7280' }]}>
                kcal
              </Text>
            </View>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.colors.border || '#E5E7EB' }]} />
          
          <View style={styles.infoItem}>
            <View style={styles.infoHeader}>
              <Ionicons 
                name={remaining > 0 ? "checkmark-circle-outline" : "warning-outline"} 
                size={14} 
                color={remaining > 0 ? '#3BB273' : '#EF4444'} 
              />
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
                {t('dashboard.caloriesRemaining')}
              </Text>
            </View>
            <View style={styles.infoValueContainer}>
              <Text style={[styles.infoValue, { color: remaining > 0 ? '#3BB273' : '#EF4444' }]}>
                {remaining}
              </Text>
              <Text style={[styles.infoUnit, { color: theme.colors.textSecondary || '#6B7280' }]}>
                kcal
              </Text>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  container: {
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 24,
  },
  circleWrapper: {
    width: 170,
    height: 170,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consumedText: {
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
  },
  kcalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  infoItem: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
  },
  divider: {
    width: '90%',
    height: 1,
    marginVertical: 10,
    alignSelf: 'flex-start',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  infoValue: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  infoUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
});

