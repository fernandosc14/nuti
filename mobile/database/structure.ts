/**
 * Database Structure Guide
 * 
 * Estrutura completa da base de dados Firestore para o Nuti
 */

/**
 * COLEÇÃO: users
 * 
 * Documento ID = userId (UID do Firebase Auth)
 * 
 * Estrutura:
 */
const userDocument = {
  name: "string",                    // Nome do utilizador
  email: "string",                    // Email
  weight: 70,                        // Peso em kg (opcional)
  height: 175,                       // Altura em cm (opcional)
  goal: "lose" | "maintain" | "gain", // Objetivo
  restrictions: ["gluten", "lactose"], // Restrições alimentares (array)
  plan: "free" | "premium",          // Plano do utilizador
  streak: 0,                         // Dias consecutivos
  badges: ["badge_id1", "badge_id2"], // IDs das badges desbloqueadas
  lastStreakDate: Timestamp,         // Última data que atualizou streak
  createdAt: Timestamp              // Data de criação
};

/**
 * COLEÇÃO: meals
 * 
 * Documento ID = auto-gerado
 * 
 * Estrutura:
 */
const mealDocument = {
  userId: "string",                   // ID do utilizador
  name: "string",                     // Nome do alimento
  calories: 250,                     // Calorias
  protein: 20.5,                     // Proteína em gramas
  carbs: 30.0,                       // Carboidratos em gramas
  fat: 10.0,                         // Gordura em gramas
  image: "https://...",              // URL da imagem (opcional)
  mealType: "breakfast" | "lunch" | "dinner" | "snack", // Tipo de refeição
  date: Timestamp                    // Data/hora da refeição
};

/**
 * COLEÇÃO: messages
 * 
 * Documento ID = auto-gerado
 * 
 * Estrutura:
 */
const messageDocument = {
  userId: "string",                   // ID do utilizador
  role: "user" | "assistant",        // Tipo de mensagem
  content: "string",                 // Conteúdo da mensagem
  createdAt: Timestamp              // Data/hora da mensagem
};

/**
 * COLEÇÃO: badges
 * 
 * Documento ID = badge_id (definido manualmente)
 * 
 * Badges padrão que devem ser criadas:
 */
const badges = [
  {
    id: "first_meal",
    name: "Primeira Refeição",
    description: "Registaste a tua primeira refeição!",
    icon: "🎉",
    requirement: "first_meal"
  },
  {
    id: "streak_3",
    name: "3 Dias Seguidos",
    description: "Mantiveste o hábito por 3 dias!",
    icon: "🔥",
    requirement: "streak_3"
  },
  {
    id: "streak_7",
    name: "Semana Perfeita",
    description: "7 dias consecutivos!",
    icon: "⭐",
    requirement: "streak_7"
  },
  {
    id: "streak_30",
    name: "Mês Perfeito",
    description: "30 dias consecutivos!",
    icon: "🏆",
    requirement: "streak_30"
  },
  {
    id: "meals_10",
    name: "10 Refeições",
    description: "Registaste 10 refeições!",
    icon: "🍽️",
    requirement: "meals_10"
  },
  {
    id: "meals_50",
    name: "50 Refeições",
    description: "Registaste 50 refeições!",
    icon: "🎯",
    requirement: "meals_50"
  }
];

/**
 * REGRAS DE SEGURANÇA DO FIRESTORE
 * 
 * Colete estas regras no Firebase Console > Firestore > Rules:
 */

const securityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para users
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regras para meals
    match /meals/{mealId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Regras para messages
    match /messages/{messageId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Regras para badges (apenas leitura)
    match /badges/{badgeId} {
      allow read: if request.auth != null;
      allow write: if false; // Apenas admins podem criar badges
    }
    
    // Regras para water (água bebida)
    match /water/{waterId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create, update: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Regras para exercises (exercícios físicos)
    match /exercises/{exerciseId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
`;

/**
 * COLEÇÃO: exercises
 * 
 * Documento ID = auto-gerado
 * 
 * Estrutura base:
 */
const exerciseDocument = {
  userId: "string",                   // ID do utilizador
  type: "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other", // Tipo de exercício
  name: "string",                     // Nome do exercício (tipo ou nome customizado)
  duration: 30,                       // Duração em minutos (obrigatório)
  date: Timestamp,                    // Data do exercício
  addedAt: Timestamp,                 // Data de quando foi adicionado
  
  // Campos específicos por tipo (opcionais):
  
  // Running, Walking, Cycling, Hiking
  distance: 5.0,                      // Distância em km ou mi
  distanceUnit: "km" | "mi",          // Unidade de distância
  
  // Walking
  steps: 5000,                        // Número de passos (opcional)
  
  // Cycling
  averageSpeed: 20.0,                 // Velocidade média em km/h ou mph
  speedUnit: "km/h" | "mph",          // Unidade de velocidade
  
  // Swimming
  style: "freestyle" | "backstroke" | "breaststroke" | "butterfly" | "mixed", // Estilo de natação
  
  // GYM
  trainingType: "strength" | "hypertrophy" | "cardio", // Tipo de treino
  
  // Yoga
  level: "beginner" | "intermediate" | "advanced", // Nível
  style: "hatha" | "vinyasa" | "power" | "yin" | "ashtanga" | "bikram", // Estilo de yoga
  
  // Pilates
  pilatesType: "mat" | "machine",     // Tipo de pilates
  
  // Dance
  style: "zumba" | "ballet" | "salsa" | "hip-hop" | "free", // Estilo de dança
  
  // Hiking
  elevationGain: 500,                 // Ganho de elevação em m ou ft (essencial para cálculo MET)
  elevationUnit: "m" | "ft",          // Unidade de elevação
  backpackWeight: 10.0,               // Peso da mochila em kg ou lbs (opcional)
  weightUnit: "kg" | "lbs",           // Unidade de peso
  
  // Tennis
  gameType: "individual" | "doubles", // Tipo de jogo
  effectiveGameDuration: 60,          // Duração efetiva do jogo em minutos (opcional)
  
  // Football
  position: "forward" | "midfielder" | "defender" | "goalkeeper", // Posição
  
  // Basketball
  gameType: "game" | "training",      // Tipo de jogo
  
  // Other
  customName: "string",                // Nome customizado do exercício (obrigatório para "other")
  perceivedIntensity: 7,              // Intensidade percebida 1-10 (obrigatório para "other", opcional para outros)
};

/**
 * ÍNDICES NECESSÁRIOS
 * 
 * Criar estes índices compostos no Firebase Console:
 * 
 * Coleção: meals
 * - userId (Ascending) + date (Descending)
 * - userId (Ascending) + date (Ascending) + date (Descending)
 * 
 * Coleção: messages
 * - userId (Ascending) + createdAt (Ascending)
 * 
 * Coleção: exercises
 * - userId (Ascending) + date (Ascending)
 */

export { userDocument, mealDocument, messageDocument, exerciseDocument, badges, securityRules };

