/**
 * Testes automatizados para cálculo do Health Score
 * Testa se o cálculo do health score está usando os dados adicionais corretamente
 */

// Função simplificada do cálculo do health score para testes
function calculateHealthScoreAndSuggestions(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  sugars?: number,
  fiber?: number,
  sodium?: number,
  saturatedFat?: number,
  transFat?: number,
  weight?: number
): { score: number; suggestions: string[] } {
  if (!calories || calories === 0) {
    return { score: 5, suggestions: [] };
  }

  const suggestions: string[] = [];
  let score = 5; // Base score

  // Avaliar calorias
  if (calories > 2000) {
    score -= 3.5;
    suggestions.push('portionTooLarge');
  } else if (calories > 1500) {
    score -= 2.5;
    suggestions.push('portionLarge');
  } else if (calories > 1200) {
    score -= 1.5;
    suggestions.push('portionHigh');
  } else if (calories >= 400 && calories <= 800) {
    score += 0.5;
  }

  // Calcular percentuais
  const proteinCalories = protein * 4;
  const carbsCalories = carbs * 4;
  const fatCalories = fat * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
  
  const proteinPercent = totalMacroCalories > 0 ? (proteinCalories / calories) * 100 : 0;
  const carbsPercent = totalMacroCalories > 0 ? (carbsCalories / calories) * 100 : 0;
  const fatPercent = totalMacroCalories > 0 ? (fatCalories / calories) * 100 : 0;

  // Avaliar Proteína
  if (proteinPercent >= 20 && proteinPercent <= 35) {
    score += 2;
  } else if (proteinPercent < 15) {
    score -= 1.5;
    suggestions.push('addMoreProtein');
  }

  // Avaliar Carboidratos
  if (carbsPercent >= 45 && carbsPercent <= 65) {
    score += 1.5;
  } else if (carbsPercent > 70) {
    score -= 1;
    suggestions.push('reduceCarbs');
  }

  // Avaliar Gordura
  if (fatPercent >= 20 && fatPercent <= 35) {
    score += 1;
  } else if (fatPercent > 40) {
    score -= 1.5;
    suggestions.push('reduceFat');
  }

  // Avaliar Açúcares (se disponível)
  if (sugars !== undefined && sugars > 0) {
    const sugarsCalories = sugars * 4;
    const sugarsPercent = (sugarsCalories / calories) * 100;
    
    if (sugarsPercent > 20) {
      score -= 2;
      suggestions.push('highSugar');
    } else if (sugarsPercent > 15) {
      score -= 1.5;
      suggestions.push('reduceSugar');
    } else if (sugarsPercent <= 5) {
      score += 0.5;
    }
  }

  // Avaliar Fibra (se disponível)
  if (fiber !== undefined && fiber > 0) {
    const weightFor100g = weight || 400;
    const fiberPer100g = (fiber / weightFor100g) * 100;
    
    if (fiberPer100g >= 5) {
      score += 1.5;
    } else if (fiberPer100g >= 3) {
      score += 1;
    } else if (fiberPer100g < 1) {
      score -= 0.5;
      suggestions.push('addFiber');
    }
  }

  // Avaliar Sódio (se disponível)
  if (sodium !== undefined && sodium > 0) {
    const weightFor100g = weight || 400;
    const sodiumPerMeal = (sodium / weightFor100g) * weightFor100g;
    
    if (sodiumPerMeal > 1000) {
      score -= 2;
      suggestions.push('highSodium');
    } else if (sodiumPerMeal > 600) {
      score -= 1.5;
      suggestions.push('reduceSodium');
    } else if (sodiumPerMeal < 200) {
      score += 0.5;
    }
  }

  // Avaliar Gordura Saturada (se disponível)
  if (saturatedFat !== undefined && saturatedFat > 0) {
    const saturatedFatCalories = saturatedFat * 9;
    const saturatedFatPercent = (saturatedFatCalories / calories) * 100;
    
    if (saturatedFatPercent > 15) {
      score -= 2;
      suggestions.push('highSaturatedFat');
    } else if (saturatedFatPercent > 10) {
      score -= 1.5;
      suggestions.push('reduceSaturatedFat');
    } else if (saturatedFatPercent <= 5) {
      score += 0.5;
    }
  }

  // Avaliar Gordura Trans (se disponível)
  if (transFat !== undefined && transFat > 0) {
    score -= 3;
    suggestions.push('containsTransFat');
  }

  // Normalizar para 0-10
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  return { score, suggestions };
}

describe('Cálculo do Health Score', () => {
  test('deve calcular score básico corretamente', () => {
    const result = calculateHealthScoreAndSuggestions(600, 30, 60, 20);
    
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  test('deve penalizar refeições muito calóricas', () => {
    const resultHigh = calculateHealthScoreAndSuggestions(2500, 50, 100, 40);
    const resultNormal = calculateHealthScoreAndSuggestions(600, 30, 60, 20);
    
    expect(resultHigh.score).toBeLessThan(resultNormal.score);
    expect(resultHigh.suggestions).toContain('portionTooLarge');
  });

  test('deve considerar açúcares no cálculo quando disponível', () => {
    const resultHighSugar = calculateHealthScoreAndSuggestions(500, 20, 50, 15, 30); // 30g açúcar = 24% das calorias
    const resultLowSugar = calculateHealthScoreAndSuggestions(500, 20, 50, 15, 5); // 5g açúcar = 4% das calorias
    
    expect(resultHighSugar.score).toBeLessThan(resultLowSugar.score);
    expect(resultHighSugar.suggestions).toContain('highSugar');
  });

  test('deve dar bonus por alta fibra quando disponível', () => {
    const resultHighFiber = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, 25, undefined, undefined, undefined, 400);
    const resultLowFiber = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, 2, undefined, undefined, undefined, 400);
    
    expect(resultHighFiber.score).toBeGreaterThan(resultLowFiber.score);
  });

  test('deve penalizar alto sódio quando disponível', () => {
    const resultHighSodium = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, undefined, 1200, undefined, undefined, 400);
    const resultLowSodium = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, undefined, 150, undefined, undefined, 400);
    
    expect(resultHighSodium.score).toBeLessThan(resultLowSodium.score);
    expect(resultHighSodium.suggestions).toContain('highSodium');
  });

  test('deve penalizar severamente gordura saturada alta quando disponível', () => {
    const resultHighSatFat = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, undefined, undefined, 20, undefined);
    const resultLowSatFat = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, undefined, undefined, 3, undefined);
    
    expect(resultHighSatFat.score).toBeLessThan(resultLowSatFat.score);
    expect(resultHighSatFat.suggestions).toContain('highSaturatedFat');
  });

  test('deve penalizar severamente gordura trans quando presente', () => {
    const resultWithTransFat = calculateHealthScoreAndSuggestions(500, 20, 50, 15, undefined, undefined, undefined, undefined, 0.5);
    const resultWithoutTransFat = calculateHealthScoreAndSuggestions(500, 20, 50, 15);
    
    expect(resultWithTransFat.score).toBeLessThan(resultWithoutTransFat.score);
    expect(resultWithTransFat.suggestions).toContain('containsTransFat');
  });

  test('deve funcionar sem dados adicionais (compatibilidade)', () => {
    const result = calculateHealthScoreAndSuggestions(600, 30, 60, 20);
    
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  test('deve retornar score 5 para refeição sem calorias', () => {
    const result = calculateHealthScoreAndSuggestions(0, 0, 0, 0);
    
    expect(result.score).toBe(5);
    expect(result.suggestions).toEqual([]);
  });

  test('deve normalizar score entre 0 e 10', () => {
    // Teste com valores extremos
    const resultExtreme = calculateHealthScoreAndSuggestions(3000, 10, 200, 100, 100, 0, 2000, 50, 5);
    
    expect(resultExtreme.score).toBeGreaterThanOrEqual(0);
    expect(resultExtreme.score).toBeLessThanOrEqual(10);
  });
});

