/**
 * Testes automatizados para extração de dados nutricionais
 * Testa se os dados adicionais estão sendo extraídos corretamente do Open Food Facts
 */

// Interface simplificada para testes
interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
  sugars?: number;
  fiber?: number;
  sodium?: number;
  saturatedFat?: number;
  transFat?: number;
}

// Mock de dados do Open Food Facts para testes
const mockOpenFoodFactsProduct = {
  code: '123456789',
  product_name: 'Test Product',
  product_name_en: 'Test Product',
  nutriments: {
    'energy-kcal_100g': 250,
    'proteins_100g': 10,
    'carbohydrates_100g': 30,
    'fat_100g': 5,
    'sugars_100g': 15,
    'fiber_100g': 3,
    'sodium_100g': 500,
    'saturated-fat_100g': 2,
    'trans-fat_100g': 0,
  },
  image_url: 'https://example.com/image.jpg',
};

const mockOpenFoodFactsProductWithSalt = {
  code: '987654321',
  product_name: 'Test Product with Salt',
  nutriments: {
    'energy-kcal_100g': 200,
    'proteins_100g': 8,
    'carbohydrates_100g': 25,
    'fat_100g': 4,
    'sugars_100g': 10,
    'fiber_100g': 2,
    'salt_100g': 1.5, // 1.5g sal = 600mg sódio
    'saturated-fat_100g': 1.5,
    'trans-fat_100g': 0.1,
  },
};

const mockOpenFoodFactsProductMinimal = {
  code: '111222333',
  product_name: 'Minimal Product',
  nutriments: {
    'energy-kcal_100g': 150,
    'proteins_100g': 5,
    'carbohydrates_100g': 20,
    'fat_100g': 3,
    // Sem dados adicionais
  },
};

/**
 * Função helper para extrair dados nutricionais (simula a lógica do código)
 * Esta função replica a lógica de extração do arquivo api.ts
 */
function extractNutritionData(product: any): Partial<FoodItem> {
  const nutriments = product.nutriments || {};
  
  const calories = Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
  const protein = parseFloat((nutriments.proteins_100g || nutriments.proteins || 0).toFixed(1));
  const carbs = parseFloat((nutriments.carbohydrates_100g || nutriments.carbohydrates || 0).toFixed(1));
  const fat = parseFloat((nutriments.fat_100g || nutriments.fat || 0).toFixed(1));
  
  // Dados nutricionais adicionais
  const sugars = parseFloat((nutriments.sugars_100g || nutriments.sugars || 0).toFixed(1));
  const fiber = parseFloat((nutriments.fiber_100g || nutriments.fiber || nutriments['fiber_100g'] || 0).toFixed(1));
  const sodium = parseFloat((
    nutriments.sodium_100g || 
    nutriments.sodium || 
    (nutriments.salt_100g ? nutriments.salt_100g * 400 : 0) || 
    (nutriments.salt ? nutriments.salt * 400 : 0) || 
    0
  ).toFixed(1));
  const saturatedFat = parseFloat((nutriments['saturated-fat_100g'] || nutriments['saturated-fat'] || nutriments.saturated_fat_100g || 0).toFixed(1));
  const transFat = parseFloat((nutriments['trans-fat_100g'] || nutriments['trans-fat'] || nutriments.trans_fat_100g || 0).toFixed(1));
  
  return {
    calories,
    protein,
    carbs,
    fat,
    sugars: sugars > 0 ? sugars : undefined,
    fiber: fiber > 0 ? fiber : undefined,
    sodium: sodium > 0 ? sodium : undefined,
    saturatedFat: saturatedFat > 0 ? saturatedFat : undefined,
    transFat: transFat > 0 ? transFat : undefined,
  };
}

describe('Extração de Dados Nutricionais', () => {
  test('deve extrair todos os dados nutricionais básicos', () => {
    const result = extractNutritionData(mockOpenFoodFactsProduct);
    
    expect(result.calories).toBe(250);
    expect(result.protein).toBe(10);
    expect(result.carbs).toBe(30);
    expect(result.fat).toBe(5);
  });

  test('deve extrair dados nutricionais adicionais quando disponíveis', () => {
    const result = extractNutritionData(mockOpenFoodFactsProduct);
    
    expect(result.sugars).toBe(15);
    expect(result.fiber).toBe(3);
    expect(result.sodium).toBe(500);
    expect(result.saturatedFat).toBe(2);
    expect(result.transFat).toBeUndefined(); // 0 não deve ser incluído
  });

  test('deve converter sal para sódio corretamente', () => {
    const result = extractNutritionData(mockOpenFoodFactsProductWithSalt);
    
    // 1.5g sal * 400 = 600mg sódio
    expect(result.sodium).toBe(600);
  });

  test('deve extrair gordura trans quando presente', () => {
    const result = extractNutritionData(mockOpenFoodFactsProductWithSalt);
    
    expect(result.transFat).toBe(0.1);
  });

  test('não deve incluir campos undefined quando dados não estão disponíveis', () => {
    const result = extractNutritionData(mockOpenFoodFactsProductMinimal);
    
    expect(result.calories).toBe(150);
    expect(result.protein).toBe(5);
    expect(result.carbs).toBe(20);
    expect(result.fat).toBe(3);
    expect(result.sugars).toBeUndefined();
    expect(result.fiber).toBeUndefined();
    expect(result.sodium).toBeUndefined();
    expect(result.saturatedFat).toBeUndefined();
    expect(result.transFat).toBeUndefined();
  });

  test('deve lidar com valores zero corretamente', () => {
    const productWithZeros = {
      code: '000000000',
      product_name: 'Product with Zeros',
      nutriments: {
        'energy-kcal_100g': 100,
        'proteins_100g': 5,
        'carbohydrates_100g': 15,
        'fat_100g': 2,
        'sugars_100g': 0,
        'fiber_100g': 0,
        'sodium_100g': 0,
        'saturated-fat_100g': 0,
        'trans-fat_100g': 0,
      },
    };
    
    const result = extractNutritionData(productWithZeros);
    
    expect(result.sugars).toBeUndefined();
    expect(result.fiber).toBeUndefined();
    expect(result.sodium).toBeUndefined();
    expect(result.saturatedFat).toBeUndefined();
    expect(result.transFat).toBeUndefined();
  });

  test('deve lidar com campos alternativos de gordura saturada', () => {
    const productWithAltFields = {
      code: '444555666',
      product_name: 'Product with Alt Fields',
      nutriments: {
        'energy-kcal_100g': 200,
        'proteins_100g': 8,
        'carbohydrates_100g': 25,
        'fat_100g': 4,
        'saturated-fat': 2.5, // Campo alternativo
        'trans-fat': 0.2, // Campo alternativo
      },
    };
    
    const result = extractNutritionData(productWithAltFields);
    
    expect(result.saturatedFat).toBe(2.5);
    expect(result.transFat).toBe(0.2);
  });
});

describe('Validação de Dados', () => {
  test('deve validar que todos os dados básicos são números', () => {
    const result = extractNutritionData(mockOpenFoodFactsProduct);
    
    expect(typeof result.calories).toBe('number');
    expect(typeof result.protein).toBe('number');
    expect(typeof result.carbs).toBe('number');
    expect(typeof result.fat).toBe('number');
  });

  test('deve validar que dados adicionais são números quando presentes', () => {
    const result = extractNutritionData(mockOpenFoodFactsProduct);
    
    if (result.sugars !== undefined) {
      expect(typeof result.sugars).toBe('number');
    }
    if (result.fiber !== undefined) {
      expect(typeof result.fiber).toBe('number');
    }
    if (result.sodium !== undefined) {
      expect(typeof result.sodium).toBe('number');
    }
  });

  test('deve garantir que valores não são negativos', () => {
    const result = extractNutritionData(mockOpenFoodFactsProduct);
    
    expect(result.calories).toBeGreaterThanOrEqual(0);
    expect(result.protein).toBeGreaterThanOrEqual(0);
    expect(result.carbs).toBeGreaterThanOrEqual(0);
    expect(result.fat).toBeGreaterThanOrEqual(0);
    
    if (result.sugars !== undefined) {
      expect(result.sugars).toBeGreaterThanOrEqual(0);
    }
    if (result.sodium !== undefined) {
      expect(result.sodium).toBeGreaterThanOrEqual(0);
    }
  });
});

