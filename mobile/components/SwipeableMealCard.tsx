/**
 * SwipeableMealCard Component
 * 
 * Componente que envolve MealCard com funcionalidade de swipe para eliminar
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MealCard } from './MealCard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface SwipeableMealCardProps {
  id: string;
  name: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  image?: string;
  time: string;
  onPress?: () => void;
  onDelete?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = -80; // Distância mínima para ativar o delete
const DELETE_BUTTON_WIDTH = 80;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function SwipeableMealCard(props: SwipeableMealCardProps) {
  const { theme } = useTheme();
  const translateX = useSharedValue(0);
  const [isSwiped, setIsSwiped] = React.useState(false);

  const handleDelete = () => {
    if (props.onDelete) {
      props.onDelete();
    }
  };

  const startX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Só ativa quando arrastar horizontalmente pelo menos 10px
    .failOffsetY([-20, 20]) // Falha se arrastar verticalmente mais de 20px (permite scroll)
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // Só permite arrastar para a esquerda (valores negativos)
      const newValue = startX.value + event.translationX;
      if (newValue <= 0) {
        translateX.value = newValue;
      } else {
        // Se tentar arrastar para a direita, manter em 0
        translateX.value = 0;
      }
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        // Se arrastou o suficiente, mostrar botão de delete
        translateX.value = withSpring(-DELETE_BUTTON_WIDTH);
        runOnJS(setIsSwiped)(true);
      } else {
        // Se não arrastou o suficiente, voltar à posição original
        translateX.value = withSpring(0);
        runOnJS(setIsSwiped)(false);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const animatedDeleteButtonStyle = useAnimatedStyle(() => {
    const opacity = translateX.value < -10 ? 1 : 0;
    return {
      opacity: withTiming(opacity, { duration: 200 }),
    };
  });

  const handleDeletePress = () => {
    // Animar para fora da tela antes de eliminar
    translateX.value = withTiming(-SCREEN_WIDTH, { duration: 300 }, () => {
      runOnJS(handleDelete)();
    });
  };

  return (
    <View style={styles.container}>
      {/* Botão de eliminar (visível quando arrastado) */}
      <Animated.View
        style={[
          styles.deleteButton,
          animatedDeleteButtonStyle,
        ]}
      >
        <AnimatedTouchableOpacity
          onPress={handleDeletePress}
          style={styles.deleteButtonInner}
          activeOpacity={0.7}
        >
          <Ionicons name="trash" size={16} color={theme?.colors?.error || '#EF4444'} />
        </AnimatedTouchableOpacity>
      </Animated.View>

      {/* Card principal */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.cardContainer, animatedCardStyle]}>
          <MealCard
            {...props}
            onDelete={undefined} // Remover o botão de delete do MealCard
            onPress={() => {
              // Se o card estiver arrastado, fechar primeiro
              if (isSwiped) {
                translateX.value = withSpring(0);
                setIsSwiped(false);
              } else if (props.onPress) {
                props.onPress();
              }
            }}
          />
        </Animated.View>
      </GestureDetector>
      
      {/* Indicador de swipe (seta para a esquerda) - sempre visível quando não arrastado */}
      {!isSwiped && (
        <View style={styles.swipeIndicator}>
          <Ionicons name="chevron-back" size={12} color={theme?.colors?.textSecondary || '#9CA3AF'} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 12,
    overflow: 'hidden',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  deleteButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  cardContainer: {
    backgroundColor: 'transparent',
  },
  swipeIndicator: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});

