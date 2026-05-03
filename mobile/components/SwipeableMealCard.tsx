/**
 * SwipeableMealCard Component
 * 
 * Component that includes MealCard with swipe functionality to delete.
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
const SWIPE_THRESHOLD = -80; // Minimum distance to activate delete.
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
    .activeOffsetX([-10, 10]) // It only activates when you drag horizontally at least 10px.
    .failOffsetY([-20, 20]) // Fail if dragging vertically more than 20px (allows scroll)
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      // It only activates when you drag horizontally at least 10px.
      const newValue = startX.value + event.translationX;
      if (newValue <= 0) {
        translateX.value = newValue;
      } else {
        // If trying to drag to the right, keep at 0
        translateX.value = 0;
      }
    })
    .onEnd(() => {
      if (translateX.value < SWIPE_THRESHOLD) {
        // If swiped enough, show delete button
        translateX.value = withSpring(-DELETE_BUTTON_WIDTH);
        runOnJS(setIsSwiped)(true);
      } else {
        // If not swiped enough, return to original position
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
    // Animate to the left before deleting
    translateX.value = withTiming(-SCREEN_WIDTH, { duration: 300 }, () => {
      runOnJS(handleDelete)();
    });
  };

  return (
    <View style={styles.container}>
      {/* Delete Button (visible when swiped) */}
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

      {/* Main Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.cardContainer, animatedCardStyle]}>
          <MealCard
            {...props}
            onDelete={undefined} // Remove the delete button from MealCard
            onPress={() => {
              // If the card is swiped, close it first
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
      
      {/* Swipe Indicator (arrow to the left) - always visible when not swiped */}
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

