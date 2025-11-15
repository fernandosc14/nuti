/**
 * Food Database
 * 
 * Base de dados local com valores nutricionais reais de alimentos comuns
 * Usado para melhorar a precisão quando a AI não consegue valores exatos
 */

export interface FoodNutrition {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/**
 * Base de dados de alimentos comuns com valores nutricionais reais
 */
const FOOD_DATABASE: FoodNutrition[] = [
  // Grãos e Cereais
  { name: 'arroz', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  { name: 'arroz branco', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  { name: 'arroz integral', caloriesPer100g: 111, proteinPer100g: 2.6, carbsPer100g: 23, fatPer100g: 0.9 },
  { name: 'massa', caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1 },
  { name: 'pasta', caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1 },
  { name: 'batata', caloriesPer100g: 77, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1 },
  { name: 'batata frita', caloriesPer100g: 365, proteinPer100g: 3.4, carbsPer100g: 63, fatPer100g: 17 },
  { name: 'batata assada', caloriesPer100g: 93, proteinPer100g: 2.5, carbsPer100g: 21, fatPer100g: 0.1 },
  
  // Proteínas
  { name: 'frango', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { name: 'peito de frango', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { name: 'frango grelhado', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { name: 'bife', caloriesPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 15 },
  { name: 'carne', caloriesPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 15 },
  { name: 'carne grelhada', caloriesPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 15 },
  { name: 'peixe', caloriesPer100g: 206, proteinPer100g: 22, carbsPer100g: 0, fatPer100g: 12 },
  { name: 'salmão', caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
  { name: 'atum', caloriesPer100g: 144, proteinPer100g: 30, carbsPer100g: 0, fatPer100g: 1 },
  { name: 'ovo', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  { name: 'ovo frito', caloriesPer100g: 196, proteinPer100g: 13.6, carbsPer100g: 1.1, fatPer100g: 14.8 },
  { name: 'ovo cozido', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  
  // Leguminosas
  { name: 'feijão', caloriesPer100g: 132, proteinPer100g: 8.9, carbsPer100g: 24, fatPer100g: 0.5 },
  { name: 'feijão preto', caloriesPer100g: 132, proteinPer100g: 8.9, carbsPer100g: 24, fatPer100g: 0.5 },
  { name: 'feijão branco', caloriesPer100g: 127, proteinPer100g: 9.7, carbsPer100g: 23, fatPer100g: 0.6 },
  { name: 'grão de bico', caloriesPer100g: 164, proteinPer100g: 8.9, carbsPer100g: 27, fatPer100g: 2.6 },
  { name: 'lentilhas', caloriesPer100g: 116, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 0.4 },
  
  // Vegetais
  { name: 'brócolos', caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7, fatPer100g: 0.4 },
  { name: 'cenoura', caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2 },
  { name: 'espinafre', caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { name: 'couve', caloriesPer100g: 49, proteinPer100g: 4.3, carbsPer100g: 8.8, fatPer100g: 0.9 },
  
  // Frutas
  { name: 'maçã', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  { name: 'banana', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  { name: 'laranja', caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1 },
];

/**
 * Busca valores nutricionais na base de dados local
 */
export function findFoodInDatabase(foodName: string): FoodNutrition | null {
  const nameLower = foodName.toLowerCase().trim();
  
  // Busca exata primeiro
  let found = FOOD_DATABASE.find(food => 
    food.name.toLowerCase() === nameLower
  );
  
  // Se não encontrar, busca parcial
  if (!found) {
    found = FOOD_DATABASE.find(food => 
      nameLower.includes(food.name.toLowerCase()) || 
      food.name.toLowerCase().includes(nameLower)
    );
  }
  
  return found || null;
}

/**
 * Melhora os valores nutricionais usando a base de dados
 */
export function enhanceNutritionalValues(
  foodName: string,
  aiCalories: number,
  aiProtein: number,
  aiCarbs: number,
  aiFat: number
): FoodNutrition {
  const dbFood = findFoodInDatabase(foodName);
  
  if (dbFood) {
    // Se encontrou na base de dados, usar valores reais
    return dbFood;
  }
  
  // Se não encontrou, usar valores da AI mas validar se são razoáveis
  // Se os valores da AI parecem muito fora do normal, usar médias genéricas
  const isValid = aiCalories > 0 && aiCalories < 1000 && 
                   aiProtein >= 0 && aiProtein < 50 &&
                   aiCarbs >= 0 && aiCarbs < 100 &&
                   aiFat >= 0 && aiFat < 100;
  
  if (!isValid) {
    // Valores genéricos para alimentos não identificados
    return {
      name: foodName,
      caloriesPer100g: 150,
      proteinPer100g: 10,
      carbsPer100g: 20,
      fatPer100g: 5,
    };
  }
  
  return {
    name: foodName,
    caloriesPer100g: Math.round(aiCalories),
    proteinPer100g: parseFloat(aiProtein.toFixed(1)),
    carbsPer100g: parseFloat(aiCarbs.toFixed(1)),
    fatPer100g: parseFloat(aiFat.toFixed(1)),
  };
}

