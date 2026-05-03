/**
 * Exercise Utilities
 *
 * Helper functions for working with exercises
 */

import { ExerciseType, getExerciseConfigs } from '../types/exercise';

/**
 * Maps the translated exercise name to the exercise type
 */
export function getExerciseTypeFromName(translatedName: string, t: (key: string) => string): ExerciseType | null {
  const exerciseNameMap: Record<string, ExerciseType> = {
    [t('dashboard.exercise.running') || 'Corrida']: 'running',
    [t('dashboard.exercise.walking') || 'Caminhada']: 'walking',
    [t('dashboard.exercise.cycling') || 'Ciclismo']: 'cycling',
    [t('dashboard.exercise.swimming') || 'Natação']: 'swimming',
    [t('dashboard.exercise.gym') || 'Ginásio']: 'gym',
    [t('dashboard.exercise.yoga') || 'Yoga']: 'yoga',
    [t('dashboard.exercise.pilates') || 'Pilates']: 'pilates',
    [t('dashboard.exercise.dance') || 'Dança']: 'dance',
    [t('dashboard.exercise.hiking') || 'Caminhada']: 'hiking',
    [t('dashboard.exercise.tennis') || 'Ténis']: 'tennis',
    [t('dashboard.exercise.football') || 'Futebol']: 'football',
    [t('dashboard.exercise.basketball') || 'Basquetebol']: 'basketball',
    [t('dashboard.exercise.other') || 'Outro']: 'other',
  };

  return exerciseNameMap[translatedName] || null;
}

/**
 * Gets the translated name of the exercise type
 */
export function getExerciseNameFromType(type: ExerciseType, t: (key: string) => string): string {
  const exerciseTypeMap: Record<ExerciseType, string> = {
    running: t('dashboard.exercise.running') || 'Corrida',
    walking: t('dashboard.exercise.walking') || 'Caminhada',
    cycling: t('dashboard.exercise.cycling') || 'Ciclismo',
    swimming: t('dashboard.exercise.swimming') || 'Natação',
    gym: t('dashboard.exercise.gym') || 'Ginásio',
    yoga: t('dashboard.exercise.yoga') || 'Yoga',
    pilates: t('dashboard.exercise.pilates') || 'Pilates',
    dance: t('dashboard.exercise.dance') || 'Dança',
    hiking: t('dashboard.exercise.hiking') || 'Caminhada',
    tennis: t('dashboard.exercise.tennis') || 'Ténis',
    football: t('dashboard.exercise.football') || 'Futebol',
    basketball: t('dashboard.exercise.basketball') || 'Basquetebol',
    other: t('dashboard.exercise.other') || 'Outro',
  };

  return exerciseTypeMap[type];
}

/**
 * Gets the exercise configuration by type (with translation)
 */
export function getExerciseConfig(type: ExerciseType, t: (key: string) => string) {
  const configs = getExerciseConfigs(t);
  return configs[type];
}

