/**
 * Exercise Types
 * 
 * Tipos e interfaces para os diferentes tipos de exercícios e seus campos específicos
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

// Campos base comuns a todos os exercícios
export interface BaseExercise {
  userId: string;
  type: ExerciseType;
  name: string; // Nome do exercício (pode ser o tipo ou nome customizado)
  duration: number; // Duração em minutos (obrigatório para todos)
  date: Date;
  addedAt: Date;
}

// Running (Corrida)
export interface RunningExercise extends BaseExercise {
  type: 'running';
  distance?: number; // km ou mi
  distanceUnit?: 'km' | 'mi';
  averageHeartRate?: number; // bpm
  // Calculados: averagePace, averageSpeed
}

// Walking (Caminhada)
export interface WalkingExercise extends BaseExercise {
  type: 'walking';
  distance?: number; // km ou mi
  distanceUnit?: 'km' | 'mi';
  steps?: number; // opcional
  averageHeartRate?: number; // bpm
  // Calculados: averagePace
}

// Cycling (Bicicleta)
export interface CyclingExercise extends BaseExercise {
  type: 'cycling';
  distance?: number; // km ou mi
  distanceUnit?: 'km' | 'mi';
  averageSpeed?: number; // km/h ou mph (se não fornecido, calculado)
  speedUnit?: 'km/h' | 'mph';
  averageHeartRate?: number; // bpm
  // Calculados: averageSpeed (se não fornecido), averagePower (avançado)
}

// Swimming (Natação)
export interface SwimmingExercise extends BaseExercise {
  type: 'swimming';
  distance?: number; // metros ou jardas
  distanceUnit?: 'm' | 'yd';
  style?: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'mixed';
  perceivedIntensity?: number; // 1-10 (opcional)
  averageHeartRate?: number; // bpm
}

// GYM (Treino com Pesos)
export interface GymExercise extends BaseExercise {
  type: 'gym';
  trainingType?: 'strength' | 'hypertrophy' | 'cardio';
  perceivedIntensity?: number; // 1-10 (opcional, mas recomendado)
  averageHeartRate?: number; // bpm
}

// Yoga
export interface YogaExercise extends BaseExercise {
  type: 'yoga';
  level?: 'beginner' | 'intermediate' | 'advanced';
  style?: 'hatha' | 'vinyasa' | 'power' | 'yin' | 'ashtanga' | 'bikram';
  perceivedIntensity?: number; // 1-10 (opcional)
  averageHeartRate?: number; // bpm
}

// Pilates
export interface PilatesExercise extends BaseExercise {
  type: 'pilates';
  pilatesType?: 'mat' | 'machine';
  perceivedIntensity?: number; // 1-10 (opcional)
  averageHeartRate?: number; // bpm
}

// Dance (Dança)
export interface DanceExercise extends BaseExercise {
  type: 'dance';
  style?: 'zumba' | 'ballet' | 'salsa' | 'hip-hop' | 'free';
  perceivedIntensity?: number; // 1-10 (recomendado)
  averageHeartRate?: number; // bpm
}

// Hiking (Caminhada)
export interface HikingExercise extends BaseExercise {
  type: 'hiking';
  distance?: number; // km ou mi
  distanceUnit?: 'km' | 'mi';
  elevationGain?: number; // metros ou pés (essencial para cálculo MET)
  elevationUnit?: 'm' | 'ft';
  backpackWeight?: number; // kg ou lbs (opcional)
  weightUnit?: 'kg' | 'lbs';
  averageHeartRate?: number; // bpm
}

// Tennis (Ténis)
export interface TennisExercise extends BaseExercise {
  type: 'tennis';
  gameType?: 'individual' | 'doubles';
  effectiveGameDuration?: number; // minutos (opcional)
  averageHeartRate?: number; // bpm
}

// Football (Futebol)
export interface FootballExercise extends BaseExercise {
  type: 'football';
  position?: 'forward' | 'midfielder' | 'defender' | 'goalkeeper';
  perceivedIntensity?: number; // 1-10 (opcional)
  averageHeartRate?: number; // bpm
}

// Basketball (Basquetebol)
export interface BasketballExercise extends BaseExercise {
  type: 'basketball';
  gameType?: 'game' | 'training';
  perceivedIntensity?: number; // 1-10 (opcional)
  averageHeartRate?: number; // bpm
}

// Other (Outro)
export interface OtherExercise extends BaseExercise {
  type: 'other';
  customName: string; // obrigatório
  perceivedIntensity: number; // 1-10 (obrigatório para estimativa calórica)
  averageHeartRate?: number; // bpm
}

// Union type para todos os tipos de exercícios
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

// Configuração de campos para cada tipo de exercício
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

// Função para obter configurações traduzidas
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
