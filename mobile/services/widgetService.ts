/**
 * Widget Service
 *
 * Service to update native widget data
 */

import { Platform, NativeModules } from 'react-native';
import { updateWidgetDataIOS } from './widgetServiceIOS';

interface WidgetData {
  calories: number;
  caloriesGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  water: number;
  waterGoal: number;
}

// Interface for native Android module
interface WidgetModule {
  updateWidgetData: (data: WidgetData) => void;
}

let WidgetModule: WidgetModule | null = null;

if (Platform.OS === 'android') {
  try {
    WidgetModule = NativeModules.WidgetModule as WidgetModule;
  } catch (error) {
    console.warn('WidgetModule not available:', error);
  }
}

/**
 * Updates the widget data
 */
export function updateWidgetData(data: WidgetData): void {
  if (Platform.OS === 'android' && WidgetModule) {
    try {
      WidgetModule.updateWidgetData(data);
    } catch (error) {
      console.error('Error updating widget:', error);
    }
  } else if (Platform.OS === 'ios') {
    // iOS uses App Groups and UserDefaults
    // Forwards to iOS service (requires native implementation to persist)
    try {
      updateWidgetDataIOS(data);
    } catch (error) {
      console.error('Error updating iOS widget:', error);
    }
  }
}

/**
 * Updates widget with dashboard data
 */
export function updateWidgetFromDashboard(
  consumed: number,
  goal: number,
  macros: { protein: number; carbs: number; fat: number },
  profile: any,
  water?: { consumed: number; goal: number }
): void {
  const proteinGoal = profile?.dailyProteinGoal || Math.round((goal * 0.30) / 4);
  const carbsGoal = profile?.dailyCarbsGoal || Math.round((goal * 0.40) / 4);
  const fatGoal = profile?.dailyFatGoal || Math.round((goal * 0.30) / 9);
  const waterConsumed = water?.consumed ?? 0;
  const waterGoal = water?.goal ?? 2700;

  updateWidgetData({
    calories: Math.round(consumed),
    caloriesGoal: Math.round(goal),
    protein: Math.round(macros.protein),
    proteinGoal: Math.round(proteinGoal),
    carbs: Math.round(macros.carbs),
    carbsGoal: Math.round(carbsGoal),
    fat: Math.round(macros.fat),
    fatGoal: Math.round(fatGoal),
    water: Math.round(waterConsumed),
    waterGoal: Math.round(waterGoal),
  });
}


