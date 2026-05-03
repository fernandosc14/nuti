import { Timestamp } from 'firebase/firestore';
import { UserProfile } from '../context/UserContext';

export type WorkoutFrequency = 'none' | '1x' | '1-2x' | '2-3x' | '3-4x' | '5-6x' | 'daily' | '0-2' | '3-6' | '6+';

export interface CaloriePlanParams {
  weightKg: number;
  heightCm: number;
  age?: number | null;
  gender?: string | null;
  workoutsPerWeek?: WorkoutFrequency | string | null;
  goal?: 'lose' | 'maintain' | 'gain' | null;
  desiredWeightKg?: number | null;
  currentWeightKg?: number | null;
  goalSpeed?: number | null; // kg per week
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
  // Novos valores baseados em TDEE (Total Daily Energy Expenditure)
  // Alinhados com as descrições detalhadas de cada nível de atividade
  if (value === 'none') {
    return 1.2; // Sedentário - Não treino nada
  }
  if (value === '1x') {
    return 1.3; // Muito leve - 1 vez por semana, apenas cardio e/ou força leve
  }
  if (value === '1-2x') {
    return 1.375; // Leve - 1-2 vezes por semana, treino de força e/ou cardio leve a moderado
  }
  if (value === '2-3x') {
    return 1.45; // Moderado - 2-3 vezes por semana, combinando cardio e/ou treino de força moderado
  }
  if (value === '3-4x') {
    return 1.55; // Ativo - 3-4 vezes por semana, treino consistente de força e/ou cardio
  }
  if (value === '5-6x') {
    return 1.725; // Muito ativo - 5-6 vezes por semana, treino intenso de força e/ou cardio
  }
  if (value === 'daily') {
    return 1.9; // Extremamente ativo - Todos os dias, sessões variadas de cardio e/ou força
  }
  // Valores antigos (compatibilidade)
  if (value === '3-6') {
    return 1.55; // Mapear para 3-4x (moderado-ativo)
  }
  if (value === '6+') {
    return 1.725; // Mapear para 5-6x (muito ativo)
  }
  if (value === '0-2') {
    return 1.3; // Mapear para 1x (muito leve)
  }
  return 1.3; // Default: muito leve
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
    // Se goalSpeed está definido, usar para calcular o déficit calórico
    // 1 kg de gordura = ~7700 kcal, então para perder X kg/semana = X * 7700 / 7 = X * 1100 kcal/dia de déficit
    if (params.goalSpeed && params.goalSpeed > 0) {
      adjustment = -params.goalSpeed * 1100; // Déficit baseado na velocidade
      // Limitar a um déficit máximo razoável (máx 2.5 kg/semana = -2750 kcal/dia, mas limitamos a -1000)
      adjustment = Math.max(adjustment, -1000);
    } else {
      // Fallback para o cálculo antigo se goalSpeed não estiver definido
      const diff = Math.max(0, currentWeight - desiredWeight);
      adjustment = -350 - Math.min(200, diff * 25);
      adjustment = Math.max(adjustment, -600);
    }
  } else if (params.goal === 'gain') {
    // Se goalSpeed está definido, usar para calcular o superávit calórico
    // Para ganhar X kg/semana = X * 7700 / 7 = X * 1100 kcal/dia de superávit
    if (params.goalSpeed && params.goalSpeed > 0) {
      adjustment = params.goalSpeed * 1100; // Superávit baseado na velocidade
      // Limitar a um superávit máximo razoável (máx 3 kg/semana = 3300 kcal/dia, mas limitamos a 1000)
      adjustment = Math.min(adjustment, 1000);
    } else {
      // Fallback para o cálculo antigo se goalSpeed não estiver definido
      const diff = Math.max(0, desiredWeight - currentWeight);
      adjustment = 250 + Math.min(200, diff * 20);
      adjustment = Math.min(adjustment, 500);
    }
  }

  const minCalories = Math.max(1200, bmr * 0.8);
  // Aumentar o limite máximo para permitir ajustes maiores baseados no goalSpeed
  const maxCalories = bmr * 1.5; // Aumentado de 1.3 para 1.5 para permitir mais flexibilidade
  const caloriesBeforeClamp = maintenanceCalories + adjustment;
  const calories = clamp(caloriesBeforeClamp, minCalories, maxCalories);

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
    goalSpeed: profile.goal === 'maintain' ? undefined : profile.goalSpeed, // Only pass if not maintain
  };

  return calculateCaloriePlan(params);
};

