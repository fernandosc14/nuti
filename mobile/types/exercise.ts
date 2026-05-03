/**
 * Exercise Types
 *
 * Types and interfaces for different exercise types and their specific fields
 */

export type ExerciseType = 
  | 'running'
  | 'walking'
  | 'cycling'
  | 'swimming'
  | 'gym'
  | 'yoga'
  | 'pilates'
  | 'dance'
  | 'hiking'
  | 'tennis'
  | 'football'
  | 'basketball'
  | 'other';

// Base fields common to all exercises
export interface BaseExercise {
  userId: string;
  type: ExerciseType;
  name: string; // Exercise name (can be the type or a custom name)
  duration: number; // Duration in minutes (required for all)
  date: Date;
  addedAt: Date;
}

// Running
export interface RunningExercise extends BaseExercise {
  type: 'running';
  distance?: number; // km or mi
  distanceUnit?: 'km' | 'mi';
  averageHeartRate?: number; // bpm
  // Calculated: averagePace, averageSpeed
}

// Walking
export interface WalkingExercise extends BaseExercise {
  type: 'walking';
  distance?: number; // km or mi
  distanceUnit?: 'km' | 'mi';
  steps?: number; // optional
  averageHeartRate?: number; // bpm
  // Calculated: averagePace
}

// Cycling
export interface CyclingExercise extends BaseExercise {
  type: 'cycling';
  distance?: number; // km or mi
  distanceUnit?: 'km' | 'mi';
  averageSpeed?: number; // km/h or mph (if not provided, calculated)
  speedUnit?: 'km/h' | 'mph';
  averageHeartRate?: number; // bpm
  // Calculated: averageSpeed (if not provided), averagePower (advanced)
}

// Swimming
export interface SwimmingExercise extends BaseExercise {
  type: 'swimming';
  distance?: number; // meters or yards
  distanceUnit?: 'm' | 'yd';
  style?: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'mixed';
  perceivedIntensity?: number; // 1-10 (optional)
  averageHeartRate?: number; // bpm
}

// GYM (Weight Training)
export interface GymExercise extends BaseExercise {
  type: 'gym';
  trainingType?: 'strength' | 'hypertrophy' | 'cardio';
  perceivedIntensity?: number; // 1-10 (optional, but recommended)
  averageHeartRate?: number; // bpm
}

// Yoga
export interface YogaExercise extends BaseExercise {
  type: 'yoga';
  level?: 'beginner' | 'intermediate' | 'advanced';
  style?: 'hatha' | 'vinyasa' | 'power' | 'yin' | 'ashtanga' | 'bikram';
  perceivedIntensity?: number; // 1-10 (optional)
  averageHeartRate?: number; // bpm
}

// Pilates
export interface PilatesExercise extends BaseExercise {
  type: 'pilates';
  pilatesType?: 'mat' | 'machine';
  perceivedIntensity?: number; // 1-10 (optional)
  averageHeartRate?: number; // bpm
}

// Dance
export interface DanceExercise extends BaseExercise {
  type: 'dance';
  style?: 'zumba' | 'ballet' | 'salsa' | 'hip-hop' | 'free';
  perceivedIntensity?: number; // 1-10 (recommended)
  averageHeartRate?: number; // bpm
}

// Hiking
export interface HikingExercise extends BaseExercise {
  type: 'hiking';
  distance?: number; // km or mi
  distanceUnit?: 'km' | 'mi';
  elevationGain?: number; // meters or feet (essential for MET calculation)
  elevationUnit?: 'm' | 'ft';
  backpackWeight?: number; // kg or lbs (optional)
  weightUnit?: 'kg' | 'lbs';
  averageHeartRate?: number; // bpm
}

// Tennis
export interface TennisExercise extends BaseExercise {
  type: 'tennis';
  gameType?: 'individual' | 'doubles';
  effectiveGameDuration?: number; // minutes (optional)
  averageHeartRate?: number; // bpm
}

// Football
export interface FootballExercise extends BaseExercise {
  type: 'football';
  position?: 'forward' | 'midfielder' | 'defender' | 'goalkeeper';
  perceivedIntensity?: number; // 1-10 (optional)
  averageHeartRate?: number; // bpm
}

// Basketball
export interface BasketballExercise extends BaseExercise {
  type: 'basketball';
  gameType?: 'game' | 'training';
  perceivedIntensity?: number; // 1-10 (optional)
  averageHeartRate?: number; // bpm
}

// Other
export interface OtherExercise extends BaseExercise {
  type: 'other';
  customName: string; // required
  perceivedIntensity: number; // 1-10 (required for calorie estimate)
  averageHeartRate?: number; // bpm
}

// Union type for all exercise types
export type Exercise = 
  | RunningExercise
  | WalkingExercise
  | CyclingExercise
  | SwimmingExercise
  | GymExercise
  | YogaExercise
  | PilatesExercise
  | DanceExercise
  | HikingExercise
  | TennisExercise
  | FootballExercise
  | BasketballExercise
  | OtherExercise;

// Field configuration for each exercise type
export interface ExerciseFieldConfig {
  label: string;
  key: string;
  type: 'number' | 'text' | 'select';
  required: boolean;
  unit?: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface ExerciseTypeConfig {
  type: ExerciseType;
  icon: string;
  requiredFields: string[];
  optionalFields: ExerciseFieldConfig[];
  notes?: string;
}

// Function to get translated configurations
export function getExerciseConfigs(t: (key: string) => string): Record<ExerciseType, ExerciseTypeConfig> {
  return {
  running: {
    type: 'running',
    icon: 'walk',
    requiredFields: ['duration', 'distance'],
    optionalFields: [
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.running'),
  },
  walking: {
    type: 'walking',
    icon: 'walk-outline',
    requiredFields: ['duration', 'distance'],
    optionalFields: [
      { label: t('exercise.field.steps'), key: 'steps', type: 'number', required: false },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.walking'),
  },
  cycling: {
    type: 'cycling',
    icon: 'bicycle',
    requiredFields: ['duration', 'distance'],
    optionalFields: [
      { label: t('exercise.field.averageSpeed'), key: 'averageSpeed', type: 'number', required: false, unit: 'km/h' },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.cycling'),
  },
  swimming: {
    type: 'swimming',
    icon: 'water',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      { label: t('exercise.field.distance'), key: 'distance', type: 'number', required: false, unit: 'm' },
      {
        label: t('exercise.field.style'),
        key: 'style',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.swimming.freestyle'), value: 'freestyle' },
          { label: t('exercise.swimming.backstroke'), value: 'backstroke' },
          { label: t('exercise.swimming.breaststroke'), value: 'breaststroke' },
          { label: t('exercise.swimming.butterfly'), value: 'butterfly' },
          { label: t('exercise.swimming.mixed'), value: 'mixed' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.swimming'),
  },
  gym: {
    type: 'gym',
    icon: 'barbell',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      {
        label: t('exercise.field.trainingType'),
        key: 'trainingType',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.gym.strength'), value: 'strength' },
          { label: t('exercise.gym.hypertrophy'), value: 'hypertrophy' },
          { label: t('exercise.gym.cardio'), value: 'cardio' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.gym'),
  },
  yoga: {
    type: 'yoga',
    icon: 'leaf',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      {
        label: t('exercise.field.level'),
        key: 'level',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.yoga.beginner'), value: 'beginner' },
          { label: t('exercise.yoga.intermediate'), value: 'intermediate' },
          { label: t('exercise.yoga.advanced'), value: 'advanced' },
        ],
      },
      {
        label: t('exercise.field.style'),
        key: 'style',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.yoga.hatha'), value: 'hatha' },
          { label: t('exercise.yoga.vinyasa'), value: 'vinyasa' },
          { label: t('exercise.yoga.power'), value: 'power' },
          { label: t('exercise.yoga.yin'), value: 'yin' },
          { label: t('exercise.yoga.ashtanga'), value: 'ashtanga' },
          { label: t('exercise.yoga.bikram'), value: 'bikram' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.yoga'),
  },
  pilates: {
    type: 'pilates',
    icon: 'body',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      {
        label: t('exercise.field.pilatesType'),
        key: 'pilatesType',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.pilates.mat'), value: 'mat' },
          { label: t('exercise.pilates.machine'), value: 'machine' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.pilates'),
  },
  dance: {
    type: 'dance',
    icon: 'musical-notes',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      {
        label: t('exercise.field.style'),
        key: 'style',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.dance.zumba'), value: 'zumba' },
          { label: t('exercise.dance.ballet'), value: 'ballet' },
          { label: t('exercise.dance.salsa'), value: 'salsa' },
          { label: t('exercise.dance.hipHop'), value: 'hip-hop' },
          { label: t('exercise.dance.free'), value: 'free' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.dance'),
  },
  hiking: {
    type: 'hiking',
    icon: 'trail-sign',
    requiredFields: ['duration', 'distance', 'elevationGain'],
    optionalFields: [
      { label: t('exercise.field.backpackWeight'), key: 'backpackWeight', type: 'number', required: false, unit: 'kg' },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.hiking'),
  },
  tennis: {
    type: 'tennis',
    icon: 'tennisball',
    requiredFields: ['duration'],
    optionalFields: [
      {
        label: t('exercise.field.gameType'),
        key: 'gameType',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.tennis.individual'), value: 'individual' },
          { label: t('exercise.tennis.doubles'), value: 'doubles' },
        ],
      },
      { label: t('exercise.field.effectiveGameDuration'), key: 'effectiveGameDuration', type: 'number', required: false, unit: 'min' },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.tennis'),
  },
  football: {
    type: 'football',
    icon: 'football',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      {
        label: t('exercise.field.position'),
        key: 'position',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.football.forward'), value: 'forward' },
          { label: t('exercise.football.midfielder'), value: 'midfielder' },
          { label: t('exercise.football.defender'), value: 'defender' },
          { label: t('exercise.football.goalkeeper'), value: 'goalkeeper' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.football'),
  },
  basketball: {
    type: 'basketball',
    icon: 'basketball',
    requiredFields: ['duration', 'perceivedIntensity'],
    optionalFields: [
      {
        label: t('exercise.field.gameType'),
        key: 'gameType',
        type: 'select',
        required: false,
        options: [
          { label: t('exercise.basketball.game'), value: 'game' },
          { label: t('exercise.basketball.training'), value: 'training' },
        ],
      },
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.basketball'),
  },
  other: {
    type: 'other',
    icon: 'ellipse',
    requiredFields: ['duration', 'customName', 'perceivedIntensity'],
    optionalFields: [
      { label: t('exercise.field.averageHeartRate'), key: 'averageHeartRate', type: 'number', required: false, unit: 'bpm' },
    ],
    notes: t('exercise.notes.other'),
  },
  };
}
