import { Timestamp } from 'firebase/firestore';
import { UserProfile } from '../context/UserContext';

export type WorkoutFrequency = '0-2' | '3-6' | '6+';

export interface CaloriePlanParams {
  weightKg: number;
  heightCm: number;
  age?: number | null;
  gender?: string | null;
  workoutsPerWeek?: WorkoutFrequency | string | null;
  goal?: 'lose' | 'maintain' | 'gain' | null;
  desiredWeightKg?: number | null;
  currentWeightKg?: number | null;
}

export interface CaloriePlanResult {
  calories: number;
  bmr: number;
  maintenanceCalories: number;
  activityFactor: number;
}

const DEFAULT_WEIGHT = 70;
const DEFAULT_HEIGHT = 170;
const DEFAULT_AGE = 30;

const getActivityFactor = (value?: WorkoutFrequency | string | null) => {
  if (value === '3-6') {
    return 1.45;
  }
  if (value === '6+') {
    return 1.65;
  }
  if (value === '0-2') {
    return 1.25;
  }
  return 1.3;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const calculateCaloriePlan = (params: CaloriePlanParams): CaloriePlanResult => {
  const weight = params.weightKg && params.weightKg > 0 ? params.weightKg : DEFAULT_WEIGHT;
  const height = params.heightCm && params.heightCm > 0 ? params.heightCm : DEFAULT_HEIGHT;
  const age = params.age && params.age > 0 ? params.age : DEFAULT_AGE;
  const gender = params.gender?.toLowerCase();

  let bmr: number;
  if (gender === 'female') {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    // Média entre fórmulas masculino e feminino
    const maleBmr = 10 * weight + 6.25 * height - 5 * age + 5;
    const femaleBmr = 10 * weight + 6.25 * height - 5 * age - 161;
    bmr = (maleBmr + femaleBmr) / 2;
  }

  const activityFactor = getActivityFactor(params.workoutsPerWeek);
  const maintenanceCalories = bmr * activityFactor;

  const currentWeight = params.currentWeightKg && params.currentWeightKg > 0 ? params.currentWeightKg : weight;
  const desiredWeight = params.desiredWeightKg && params.desiredWeightKg > 0 ? params.desiredWeightKg : currentWeight;

  let adjustment = 0;
  if (params.goal === 'lose') {
    const diff = Math.max(0, currentWeight - desiredWeight);
    adjustment = -350 - Math.min(200, diff * 25);
    adjustment = Math.max(adjustment, -600);
  } else if (params.goal === 'gain') {
    const diff = Math.max(0, desiredWeight - currentWeight);
    adjustment = 250 + Math.min(200, diff * 20);
    adjustment = Math.min(adjustment, 500);
  }

  const minCalories = Math.max(1200, bmr * 0.8);
  const maxCalories = bmr * 1.3;
  const calories = clamp(maintenanceCalories + adjustment, minCalories, maxCalories);

  return {
    calories: Math.round(calories),
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(maintenanceCalories),
    activityFactor,
  };
};

export const getAgeFromDate = (value?: Date | Timestamp | string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  let date: Date | undefined;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  } else if ((value as Timestamp)?.toDate) {
    date = (value as Timestamp).toDate();
  }

  if (!date) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }

  return age;
};

export const calculateCalorieGoalFromProfile = (profile?: UserProfile | null): CaloriePlanResult | null => {
  if (!profile) {
    return null;
  }

  const age = getAgeFromDate(profile.dateOfBirth) ?? undefined;
  const params: CaloriePlanParams = {
    weightKg: profile.weight || DEFAULT_WEIGHT,
    heightCm: profile.height || DEFAULT_HEIGHT,
    age,
    gender: profile.gender,
    workoutsPerWeek: profile.workoutsPerWeek,
    goal: profile.goal || 'maintain',
    desiredWeightKg: profile.desiredWeight ?? profile.weight ?? undefined,
    currentWeightKg: profile.weight ?? undefined,
  };

  return calculateCaloriePlan(params);
};

