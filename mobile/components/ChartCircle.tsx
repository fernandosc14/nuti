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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ChartCircleProps {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
}

export function ChartCircle({ consumed, goal, size = 200, strokeWidth = 20 }: ChartCircleProps) {
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
    <View style={styles.container}>
      <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          {/* Círculo de fundo */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
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
          <Text style={styles.consumedText}>{consumed}</Text>
          <Text style={styles.goalText}>de {goal} kcal</Text>
          <Text style={styles.remainingText}>{remaining} restantes</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consumedText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
  },
  goalText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  remainingText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});

