/**
 * API Services
 * 
 * Serviços para comunicação com APIs externas:
 * - Groq API (chat IA)
 * - Open Food Facts API (pesquisa de alimentos)
 */

import { getCache, setCache } from '../utils/cacheUtils';
import { FOOD_DATABASE, enhanceNutritionalValues } from './foodDatabase';

/**
 * Interface para itens de comida
 */
export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
  plateFoods?: PlateFoodItem[]; // Lista de alimentos quando há múltiplos no prato
  // Dados nutricionais adicionais para cálculo mais preciso do health score
  sugars?: number; // Açúcares em g/100g
  fiber?: number; // Fibra em g/100g
  sodium?: number; // Sódio em mg/100g
  saturatedFat?: number; // Gordura saturada em g/100g
  transFat?: number; // Gordura trans em g/100g
}

/**
 * Interface para alimentos individuais num prato
 */
export interface PlateFoodItem {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  weight: number; // peso em gramas
  // Dados nutricionais adicionais (opcionais)
  sugarsPer100g?: number;
  fiberPer100g?: number;
  sodiumPer100g?: number;
  saturatedFatPer100g?: number;
  transFatPer100g?: number;
}

/**
 * Interface para prato completo com múltiplos alimentos
 */
export interface PlateAnalysis {
  foods: PlateFoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

/**
 * Pesquisa alimentos através do Open Food Facts API
 * Com cache e busca local primeiro para melhor performance
 * @param query - Termo de pesquisa
 * @param language - Idioma da app ('pt', 'en', 'es', 'fr', 'de', 'it') para priorizar resultados no idioma correto
 */
export async function searchFood(query: string, language: string = 'en'): Promise<FoodItem[]> {
  try {
    const queryLower = query.toLowerCase().trim();
    
    if (!queryLower || queryLower.length < 2) {
      return [];
    }
    
    // 1. Verificar cache primeiro (TTL de 24 horas)
    // Incluir idioma na chave do cache para evitar resultados em idioma errado
    const cacheKey = `food_search_${queryLower}_${language}`;
    const cachedResults = await getCache<FoodItem[]>(cacheKey);
    if (cachedResults && cachedResults.length > 0) {
      // Aplicar deduplicação nos resultados do cache (caso tenham duplicatas antigas)
      const deduplicatedCache: FoodItem[] = [];
      const seenCache = new Set<string>();
      
      cachedResults.forEach(item => {
        const nameKey = item.name.toLowerCase().trim();
        if (!seenCache.has(nameKey)) {
          seenCache.add(nameKey);
          deduplicatedCache.push(item);
        }
      });
      
      // Se houve deduplicação, atualizar o cache
      if (deduplicatedCache.length !== cachedResults.length) {
        await setCache(cacheKey, deduplicatedCache, 24 * 60 * 60 * 1000);
      }
      
      return deduplicatedCache;
    }
    
    // 2. Buscar primeiro na base local (instantâneo)
    
    // Função para calcular similaridade
    const calculateSimilarity = (q: string, foodName: string): number => {
      const qLower = q.toLowerCase().trim();
      const nameLower = foodName.toLowerCase().trim();
      
      if (nameLower === qLower) return 1000;
      if (nameLower.startsWith(qLower)) return 800;
      if (nameLower.includes(qLower)) return 600;
      
      const queryWords = qLower.split(/\s+/).filter(w => w.length > 2);
      const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
      const commonWords = queryWords.filter(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw)));
      const wordScore = commonWords.length * 100;
      
      let charMatches = 0;
      let queryIndex = 0;
      for (let i = 0; i < nameLower.length && queryIndex < qLower.length; i++) {
        if (nameLower[i] === qLower[queryIndex]) {
          charMatches++;
          queryIndex++;
        }
      }
      const charScore = (charMatches / qLower.length) * 50;
      
      return wordScore + charScore;
    };
    
    // Detectar idioma do nome do alimento (heurística otimizada)
    // Cache de detecções para evitar recalcular
    const languageCache = new Map<string, string>();
    const detectFoodLanguage = (foodName: string): string => {
      // Verificar cache primeiro
      const cached = languageCache.get(foodName);
      if (cached) return cached;
      
      const nameLower = foodName.toLowerCase();
      let detectedLang = 'en'; // Default
      
      // Verificar acentos primeiro (mais rápido)
      if (/[àáâãéêíóôõúç]/.test(foodName)) {
        detectedLang = 'pt';
      } else {
        // Palavras-chave por idioma (verificar em ordem de probabilidade)
        const ptWords = ['queijo', 'pão', 'leite', 'ovo', 'carne', 'peixe', 'fruta', 'verdura', 'batata', 'arroz', 'massa'];
        const esWords = ['queso', 'pan', 'leche', 'huevo', 'pescado', 'patata', 'pasta'];
        const frWords = ['fromage', 'pain', 'lait', 'œuf', 'viande', 'poisson', 'pomme de terre', 'riz', 'pâtes'];
        const deWords = ['käse', 'brot', 'milch', 'ei', 'fleisch', 'fisch', 'kartoffel', 'reis', 'nudeln'];
        const itWords = ['formaggio', 'pane', 'latte', 'uovo', 'pesce', 'patata', 'riso'];
        
        if (ptWords.some(w => nameLower.includes(w))) {
          detectedLang = 'pt';
        } else if (esWords.some(w => nameLower.includes(w))) {
          detectedLang = 'es';
        } else if (frWords.some(w => nameLower.includes(w))) {
          detectedLang = 'fr';
        } else if (deWords.some(w => nameLower.includes(w))) {
          detectedLang = 'de';
        } else if (itWords.some(w => nameLower.includes(w))) {
          detectedLang = 'it';
        }
      }
      
      // Guardar no cache
      languageCache.set(foodName, detectedLang);
      return detectedLang;
    };
    
    // Prioridades: idioma da app = 1000, inglês = 500, outros = 0 (não mostrar)
    const getLanguagePriority = (foodLang: string): number => {
      if (foodLang === language) return 1000; // Idioma da app - maior prioridade
      if (foodLang === 'en') return 500;     // Inglês - segunda prioridade
      return 0;                               // Outros idiomas - não mostrar
    };
    
    // Buscar na base local e remover duplicatas exatas
    const localResultsMap = new Map<string, FoodItem>();
    const localResultsWithPriority: Array<{item: FoodItem, priority: number}> = [];
    
    FOOD_DATABASE
      .filter(food => {
        const foodNameLower = food.name.toLowerCase().trim();
        return foodNameLower.includes(queryLower) || queryLower.includes(foodNameLower);
      })
      .forEach((food) => {
        // Normalizar nome e usar como chave para evitar duplicatas exatas
        const normalizedName = food.name.trim();
        const nameKey = normalizedName.toLowerCase();
        
        // Se já existe um resultado com exatamente o mesmo nome, ignorar
        if (!localResultsMap.has(nameKey)) {
          // Detectar idioma do nome do alimento
          const foodLang = detectFoodLanguage(normalizedName);
          const priority = getLanguagePriority(foodLang);
          
          // Apenas adicionar se for do idioma da app ou inglês
          if (priority > 0) {
            const item: FoodItem = {
              id: `local_${nameKey}`,
              name: normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1),
              calories: food.caloriesPer100g,
              protein: food.proteinPer100g,
              carbs: food.carbsPer100g,
              fat: food.fatPer100g,
              image: undefined,
            };
            
            localResultsMap.set(nameKey, item);
            localResultsWithPriority.push({ item, priority });
          }
        }
      });
    
    // Converter para array, ordenar por prioridade de idioma primeiro, depois por similaridade
    const localResults: FoodItem[] = localResultsWithPriority
      .sort((a, b) => {
        // Primeiro ordenar por prioridade de idioma (maior primeiro)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Se mesma prioridade, ordenar por similaridade
        const aSimilarity = calculateSimilarity(queryLower, a.item.name);
        const bSimilarity = calculateSimilarity(queryLower, b.item.name);
        return bSimilarity - aSimilarity;
      })
      .map(entry => entry.item)
      .slice(0, 10);
    
    // Se encontrou resultados suficientes na base local (>= 5), retornar e cachear
    if (localResults.length >= 5) {
      await setCache(cacheKey, localResults, 24 * 60 * 60 * 1000); // 24 horas - cacheKey já inclui idioma
      return localResults;
    }
    
    // 3. Se não encontrou resultados suficientes na base local, buscar na API
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,nutriments,image_url,image_small_url`
    );
    
    if (!response.ok) {
      // Se a API falhar, retornar resultados locais (mesmo que sejam poucos)
      if (localResults.length > 0) {
        await setCache(cacheKey, localResults, 24 * 60 * 60 * 1000); // cacheKey já inclui idioma
        return localResults;
      }
      throw new Error('Failed to fetch food data from Open Food Facts');
    }

    const data = await response.json();
    
    if (!data.products || data.products.length === 0) {
      // Se não encontrou no Open Food Facts, retornar resultados locais
      if (localResults.length > 0) {
        await setCache(cacheKey, localResults, 24 * 60 * 60 * 1000); // cacheKey já inclui idioma
        return localResults;
      }
      return [];
    }
    
    // Função para calcular similaridade (reutilizar a mesma lógica)
    const calculateSimilarityForAPI = (q: string, foodName: string): number => {
      const qLower = q.toLowerCase().trim();
      const nameLower = foodName.toLowerCase().trim();
      
      // Match exato
      if (nameLower === qLower) return 10000;
      
      // Remove plural/singular para comparação
      const qSingular = qLower.replace(/s$/, '');
      const nameSingular = nameLower.replace(/s$/, '');
      
      // Match exato sem plural
      if (nameSingular === qSingular || nameLower === qSingular || qLower === nameSingular) return 9000;
      
      // Começa com a query (ou singular/plural)
      if (nameLower.startsWith(qLower) || nameLower.startsWith(qSingular)) return 8000;
      if (qLower.startsWith(nameSingular)) return 7500;
      
      // Contém a query completa no início (primeira palavra)
      const nameFirstWord = nameLower.split(/\s+/)[0];
      const nameWordCount = nameLower.split(/\s+/).length;
      
      if (nameFirstWord === qLower || nameFirstWord === qSingular || qLower === nameFirstWord.replace(/s$/, '')) {
        // Se for apenas uma palavra (ex: "bananas" quando pesquisa "banana"), máxima prioridade
        if (nameWordCount === 1) {
          return 8500;
        }
        // Se tiver palavras extras, penalizar fortemente
        const extraWordsPenalty = (nameWordCount - 1) * 500;
        const lengthPenalty = Math.max(0, (nameLower.length - qLower.length) * 10);
        return 7000 - lengthPenalty - extraWordsPenalty;
      }
      
      // Contém a query completa
      if (nameLower.includes(qLower) || nameLower.includes(qSingular)) {
        // Penalizar nomes muito longos e dar bônus se for palavra única
        const wordCount = nameLower.split(/\s+/).length;
        const lengthPenalty = Math.max(0, (nameLower.length - qLower.length) * 5);
        const singleWordBonus = wordCount === 1 ? 500 : 0;
        return 6000 - lengthPenalty + singleWordBonus;
      }
      
      // Palavras em comum
      const queryWords = qLower.split(/\s+/).filter(w => w.length > 2);
      const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
      const commonWords = queryWords.filter(qw => {
        const qwSingular = qw.replace(/s$/, '');
        return nameWords.some(nw => {
          const nwSingular = nw.replace(/s$/, '');
          return nw === qw || nw === qwSingular || nwSingular === qw || nw.includes(qw) || qw.includes(nw);
        });
      });
      const wordScore = commonWords.length * 1000;
      
      // Similaridade de caracteres
      let charMatches = 0;
      let queryIndex = 0;
      for (let i = 0; i < nameLower.length && queryIndex < qLower.length; i++) {
        if (nameLower[i] === qLower[queryIndex]) {
          charMatches++;
          queryIndex++;
        }
      }
      const charScore = (charMatches / qLower.length) * 500;
      
      return wordScore + charScore;
    };
    
    // Processar produtos do Open Food Facts
    const results: FoodItem[] = [];
    const seenNames = new Set<string>();
    
    data.products.forEach((product: any) => {
      const productName = product.product_name || product.product_name_en || '';
      if (!productName || productName.trim().length === 0) return;
      
      // Extrair valores nutricionais
      const nutriments = product.nutriments || {};
      const calories = Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
      const protein = parseFloat((nutriments.proteins_100g || nutriments.proteins || 0).toFixed(1));
      const carbs = parseFloat((nutriments.carbohydrates_100g || nutriments.carbohydrates || 0).toFixed(1));
      const fat = parseFloat((nutriments.fat_100g || nutriments.fat || 0).toFixed(1));
      
      // Dados nutricionais adicionais para cálculo mais preciso do health score
      const sugars = parseFloat((nutriments.sugars_100g || nutriments.sugars || 0).toFixed(1));
      const fiber = parseFloat((nutriments.fiber_100g || nutriments.fiber || nutriments['fiber_100g'] || 0).toFixed(1));
      // Sódio: se não tiver sodium_100g, tentar converter de salt_100g (1g sal = 400mg sódio)
      const sodium = parseFloat((
        nutriments.sodium_100g || 
        nutriments.sodium || 
        (nutriments.salt_100g ? nutriments.salt_100g * 400 : 0) || 
        (nutriments.salt ? nutriments.salt * 400 : 0) || 
        0
      ).toFixed(1));
      const saturatedFat = parseFloat((nutriments['saturated-fat_100g'] || nutriments['saturated-fat'] || nutriments.saturated_fat_100g || 0).toFixed(1));
      const transFat = parseFloat((nutriments['trans-fat_100g'] || nutriments['trans-fat'] || nutriments.trans_fat_100g || 0).toFixed(1));
      
      // Filtrar produtos sem informações nutricionais básicas
      if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return;
      
      // Normalizar nome para evitar duplicados
      const normalizedName = normalizeFoodName(productName);
      // Usar nome normalizado em lowercase e trim para comparação exata
      const nameKey = normalizedName.toLowerCase().trim();
      
      // Evitar duplicados exatos
      if (seenNames.has(nameKey)) return;
      seenNames.add(nameKey);
      
      results.push({
        id: product.code || `off_${Math.random().toString(36).substr(2, 9)}`,
        name: normalizedName,
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        image: product.image_url || product.image_small_url || undefined,
        // Dados nutricionais adicionais para cálculo mais preciso do health score
        sugars: sugars > 0 ? sugars : undefined,
        fiber: fiber > 0 ? fiber : undefined,
        sodium: sodium > 0 ? sodium : undefined,
        saturatedFat: saturatedFat > 0 ? saturatedFat : undefined,
        transFat: transFat > 0 ? transFat : undefined,
      });
    });
    
    // Ordenar por similaridade do nome primeiro, depois por informações nutricionais
    results.sort((a, b) => {
      const aSimilarity = calculateSimilarityForAPI(queryLower, a.name);
      const bSimilarity = calculateSimilarityForAPI(queryLower, b.name);
      
      // Se a similaridade for muito diferente, ordenar por similaridade
      if (Math.abs(aSimilarity - bSimilarity) > 50) {
        return bSimilarity - aSimilarity;
      }
      
      // Se similaridade for parecida, ordenar por informações nutricionais
      const aNutritionScore = (a.calories > 0 ? 1 : 0) + (a.protein > 0 ? 1 : 0) + (a.carbs > 0 ? 1 : 0) + (a.fat > 0 ? 1 : 0);
      const bNutritionScore = (b.calories > 0 ? 1 : 0) + (b.protein > 0 ? 1 : 0) + (b.carbs > 0 ? 1 : 0) + (b.fat > 0 ? 1 : 0);
      return bNutritionScore - aNutritionScore;
    });
    
    // Aplicar priorização de idioma também aos resultados da API
    const apiResultsWithPriority: Array<{item: FoodItem, priority: number}> = results.map(item => {
      const itemLang = detectFoodLanguage(item.name);
      const priority = getLanguagePriority(itemLang);
      return { item, priority };
    });
    
    // Filtrar e ordenar resultados da API por prioridade de idioma
    const filteredApiResults = apiResultsWithPriority
      .filter(entry => entry.priority > 0) // Apenas idioma da app ou inglês
      .sort((a, b) => {
        // Primeiro por prioridade de idioma
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Depois por similaridade
        const aSimilarity = calculateSimilarityForAPI(queryLower, a.item.name);
        const bSimilarity = calculateSimilarityForAPI(queryLower, b.item.name);
        return bSimilarity - aSimilarity;
      })
      .map(entry => entry.item)
      .slice(0, 10);
    
    // Combinar resultados da API (já filtrados e ordenados) com resultados locais
    // Priorizar resultados locais se tiverem maior prioridade de idioma
    const combinedResults: FoodItem[] = [];
    const combinedNames = new Set<string>();
    
    // Primeiro adicionar resultados locais (já ordenados por prioridade)
    localResults.forEach(local => {
      const localNameKey = local.name.toLowerCase().trim();
      if (!combinedNames.has(localNameKey)) {
        combinedNames.add(localNameKey);
        combinedResults.push(local);
      }
    });
    
    // Depois adicionar resultados da API que não estão duplicados
    filteredApiResults.forEach(api => {
      const apiNameKey = api.name.toLowerCase().trim();
      if (!combinedNames.has(apiNameKey) && combinedResults.length < 10) {
        combinedNames.add(apiNameKey);
        combinedResults.push(api);
      }
    });
    
    // Remover duplicatas finais (caso ainda existam)
    const finalDeduplicated: FoodItem[] = [];
    const seenFinal = new Set<string>();
    
    combinedResults.forEach(item => {
      const nameKey = item.name.toLowerCase().trim();
      if (!seenFinal.has(nameKey)) {
        seenFinal.add(nameKey);
        finalDeduplicated.push(item);
      }
    });
    
    // Cachear resultados (24 horas) - usar chave com idioma
    await setCache(cacheKey, finalDeduplicated, 24 * 60 * 60 * 1000);
    
    return finalDeduplicated;
  } catch (error) {
    console.error('Error searching food:', error);
    
    // Em caso de erro, retornar resultados locais se houver
    try {
      const queryLower = query.toLowerCase().trim();
      
      // Função para calcular similaridade (mesma lógica)
      const calculateSimilarity = (q: string, foodName: string): number => {
        const qLower = q.toLowerCase().trim();
        const nameLower = foodName.toLowerCase().trim();
        
        if (nameLower === qLower) return 1000;
        if (nameLower.startsWith(qLower)) return 800;
        if (nameLower.includes(qLower)) return 600;
        
        const queryWords = qLower.split(/\s+/).filter(w => w.length > 2);
        const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
        const commonWords = queryWords.filter(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw)));
        const wordScore = commonWords.length * 100;
        
        let charMatches = 0;
        let queryIndex = 0;
        for (let i = 0; i < nameLower.length && queryIndex < qLower.length; i++) {
          if (nameLower[i] === qLower[queryIndex]) {
            charMatches++;
            queryIndex++;
          }
        }
        const charScore = (charMatches / qLower.length) * 50;
        
        return wordScore + charScore;
      };
      
      // Detectar idioma do nome do alimento (mesma lógica do try principal)
      const detectFoodLanguage = (foodName: string): string => {
        const nameLower = foodName.toLowerCase();
        if (/[àáâãéêíóôõúç]/.test(foodName) || 
            ['queijo', 'pão', 'leite', 'ovo', 'carne', 'peixe', 'fruta', 'verdura', 'batata', 'arroz', 'massa'].some(w => nameLower.includes(w))) {
          return 'pt';
        }
        if (['queso', 'pan', 'leche', 'huevo', 'carne', 'pescado', 'patata', 'arroz', 'pasta'].some(w => nameLower.includes(w))) {
          return 'es';
        }
        if (['fromage', 'pain', 'lait', 'œuf', 'viande', 'poisson', 'pomme de terre', 'riz', 'pâtes'].some(w => nameLower.includes(w))) {
          return 'fr';
        }
        if (['käse', 'brot', 'milch', 'ei', 'fleisch', 'fisch', 'kartoffel', 'reis', 'nudeln'].some(w => nameLower.includes(w))) {
          return 'de';
        }
        if (['formaggio', 'pane', 'latte', 'uovo', 'carne', 'pesce', 'patata', 'riso', 'pasta'].some(w => nameLower.includes(w))) {
          return 'it';
        }
        return 'en';
      };
      
      // Prioridades: idioma da app = 1000, inglês = 500, outros = 0 (não mostrar)
      const getLanguagePriority = (foodLang: string): number => {
        if (foodLang === language) return 1000;
        if (foodLang === 'en') return 500;
        return 0;
      };
      
      // Buscar na base local e remover duplicatas exatas
      const localResultsMap = new Map<string, FoodItem>();
      const localResultsWithPriority: Array<{item: FoodItem, priority: number}> = [];
      
      FOOD_DATABASE
        .filter(food => {
          const foodNameLower = food.name.toLowerCase().trim();
          return foodNameLower.includes(queryLower) || queryLower.includes(foodNameLower);
        })
        .forEach((food) => {
          const normalizedName = food.name.trim();
          const nameKey = normalizedName.toLowerCase();
          
          if (!localResultsMap.has(nameKey)) {
            const foodLang = detectFoodLanguage(normalizedName);
            const priority = getLanguagePriority(foodLang);
            
            // Apenas adicionar se for do idioma da app ou inglês
            if (priority > 0) {
              const item: FoodItem = {
                id: `local_${nameKey}`,
                name: normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1),
                calories: food.caloriesPer100g,
                protein: food.proteinPer100g,
                carbs: food.carbsPer100g,
                fat: food.fatPer100g,
                image: undefined,
              };
              
              localResultsMap.set(nameKey, item);
              localResultsWithPriority.push({ item, priority });
            }
          }
        });
      
      // Converter para array, ordenar por prioridade de idioma primeiro, depois por similaridade
      const localResults: FoodItem[] = localResultsWithPriority
        .sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          const aSimilarity = calculateSimilarity(queryLower, a.item.name);
          const bSimilarity = calculateSimilarity(queryLower, b.item.name);
          return bSimilarity - aSimilarity;
        })
        .map(entry => entry.item)
        .slice(0, 10);
      
      // Remover duplicatas finais (caso ainda existam)
      const finalDeduplicated: FoodItem[] = [];
      const seenFinal = new Set<string>();
      
      localResults.forEach(item => {
        const nameKey = item.name.toLowerCase().trim();
        if (!seenFinal.has(nameKey)) {
          seenFinal.add(nameKey);
          finalDeduplicated.push(item);
        }
      });
      
      // Cachear resultados locais mesmo em caso de erro
      if (finalDeduplicated.length > 0) {
        const cacheKey = `food_search_${queryLower}_${language}`;
        await setCache(cacheKey, finalDeduplicated, 24 * 60 * 60 * 1000);
      }
      
      return finalDeduplicated;
    } catch (fallbackError) {
      console.error('Error in fallback search:', fallbackError);
      return [];
    }
  }
}

/**
 * Normaliza nome de alimento para agrupar produtos similares
 * Remove marcas, tamanhos específicos, etc.
 */
function normalizeFoodName(productName: string): string {
  if (!productName || productName.trim().length === 0) {
    return productName;
  }
  
  let normalized = productName.trim();
  
  // Remover informações entre parênteses (geralmente marcas ou informações extras)
  normalized = normalized.replace(/\([^)]*\)/g, ' ');
  
  // Remover informações após vírgulas que parecem ser marcas ou descrições extras
  const commaIndex = normalized.indexOf(',');
  if (commaIndex > 0 && commaIndex < normalized.length * 0.6) {
    // Se a vírgula está na primeira metade, pode ser marca
    normalized = normalized.substring(0, commaIndex);
  }
  
  normalized = normalized.toLowerCase();
  
  // Remover marcas comuns e palavras de embalagem
  const removePatterns = [
    // Marcas conhecidas (expandida)
    /\b(nestlé|nestle|danone|activia|danio|yoplait|mimosa|aguas|continente|pingo doce|el corte inglés|mercadona|carrefour|eurospin|aldi|lidl|tesco|sainsbury|asda|waitrose|coop|migros|rewe|edeka|kaufland|penny|netto|real|globus|interspar|billa|spar|hofer|dm|rossmann|müller|marca|brand|coca.?cola|pepsi|fanta|sprite|heinz|kellogg|unilever|pesi|mondelez|mars|ferrero|nutella|milka|toblerone|kit.?kat|snickers|twix|m&m|mms)\b/gi,
    // Tamanhos e quantidades
    /\b\d+\s*(g|kg|ml|l|un|unid|unidade|unidades|pack|pct|pcs|gr|gramas|litros?|mls?|oz|fl.?oz)\b/gi,
    // Palavras de embalagem
    /\b(pack|packaging|embalagem|caixa|lata|garrafa|frasco|saqueta|pacote|unidade|unidades|unid|pcs|pct|frasco|garrafa|garrafão|garrafinha|bottle|can|box|package)\b/gi,
    // Palavras genéricas de produto
    /\b(produto|product|alimento|food|comida|bebida|drink|item)\b/gi,
    // Informações de qualidade/orgânico/etc
    /\b(organic|bio|biologique|orgânico|natural|natur|fresh|fresco|premium|extra|light|diet|zero|sem|without|sem açúcar|sem açucar|sem acucar)\b/gi,
    // Caracteres especiais e números soltos (mas manter espaços)
    /[^\w\s\u00C0-\u017F]/g, // Manter acentos
    /\b\d+\b/g,
  ];
  
  removePatterns.forEach(pattern => {
    normalized = normalized.replace(pattern, ' ');
  });
  
  // Remover espaços extras
  normalized = normalized.trim().replace(/\s+/g, ' ');
  
  // Se ficou muito curto ou vazio, tentar extrair palavra principal
  if (normalized.length < 3) {
    // Tentar pegar as primeiras palavras significativas do nome original
    const words = productName.toLowerCase().split(/\s+/);
    const stopWords = ['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'com', 'sem', 'e', 'ou', 'the', 'of', 'a', 'an'];
    const significantWords = words.filter(w => 
      w.length > 2 && !stopWords.includes(w.toLowerCase())
    );
    if (significantWords.length > 0) {
      normalized = significantWords.slice(0, 3).join(' '); // Pegar até 3 palavras significativas
    } else {
      normalized = productName; // Se não conseguiu normalizar, retornar original
    }
  }
  
  // Capitalizar primeira letra de cada palavra
  normalized = normalized
    .split(' ')
    .filter(w => w.length > 0)
    .map(word => {
      // Manter acentos e caracteres especiais
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  return normalized || productName; // Se ficou vazio, retornar original
}

/**
 * Verifica se um produto é realmente um alimento/bebida
 */
function isFoodProduct(productName: string, category?: string): boolean {
  const nameLower = productName.toLowerCase();
  const categoryLower = category?.toLowerCase() || '';
  
  // Palavras-chave que indicam que NÃO é alimento
  const nonFoodKeywords = [
    // Roupas e acessórios
    'camiseta', 't-shirt', 'tshirt', 'shirt', 'camisa', 'blusa', 'vestido', 'dress',
    'calça', 'pants', 'jeans', 'shorts', 'bermuda', 'sapato', 'shoe', 'sapatos',
    'tênis', 'sneakers', 'chinelo', 'sandal', 'bolsa', 'bag', 'mochila', 'backpack',
    'relógio', 'watch', 'óculos', 'glasses', 'oculos', 'cinto', 'belt', 'chapéu', 'hat',
    'casaco', 'jacket', 'casaco', 'coat', 'jaqueta', 'roupa', 'clothing', 'clothes',
    'moda', 'fashion', 'têxtil', 'textile',
    
    // Eletrônicos
    'smartphone', 'phone', 'telefone', 'tablet', 'laptop', 'notebook', 'computador',
    'computer', 'tv', 'televisão', 'televisao', 'monitor', 'mouse', 'teclado', 'keyboard',
    'fone', 'headphone', 'headphones', 'carregador', 'charger', 'cabo', 'cable',
    'bateria', 'battery', 'pilha', 'pilhas', 'eletrônico', 'eletronico', 'electronic',
    
    // Casa e decoração
    'sofá', 'sofa', 'cadeira', 'chair', 'mesa', 'table', 'cama', 'bed', 'travesseiro',
    'pillow', 'cortina', 'curtain', 'tapete', 'rug', 'carpet', 'lâmpada', 'lamp',
    'lampada', 'quadro', 'picture', 'frame', 'vaso', 'vase', 'decoração', 'decoration',
    
    // Livros e papelaria
    'livro', 'book', 'caderno', 'notebook', 'caneta', 'pen', 'lápis', 'pencil',
    'papel', 'paper', 'revista', 'magazine',
    
    // Brinquedos
    'brinquedo', 'toy', 'boneca', 'doll', 'carrinho', 'car', 'jogo', 'game',
    
    // Cosméticos e higiene (não alimentos)
    'shampoo', 'condicionador', 'conditioner', 'sabonete', 'soap', 'desodorante',
    'deodorant', 'perfume', 'perfume', 'creme', 'cream', 'loção', 'lotion',
    'maquiagem', 'makeup', 'batom', 'lipstick', 'esmalte', 'nail polish',
    
    // Limpeza
    'detergente', 'detergent', 'sabão', 'soap', 'limpeza', 'cleaning', 'desinfetante',
    'disinfectant', 'água sanitária', 'bleach',
    
    // Ferramentas
    'ferramenta', 'tool', 'chave', 'key', 'parafuso', 'screw', 'prego', 'nail',
    
    // Outros
    'medicamento', 'medicine', 'remédio', 'remedio', 'vitamina', 'vitamin', 'suplemento',
    'supplement', 'pet', 'animal', 'ração', 'pet food',
  ];
  
  // Se contém palavras que indicam que NÃO é alimento, retornar false
  if (nonFoodKeywords.some(keyword => nameLower.includes(keyword) || categoryLower.includes(keyword))) {
    console.log('[Barcode] Produto identificado como não-alimento:', productName);
    return false;
  }
  
  // Palavras-chave que indicam que É alimento (opcional, para reforçar)
  const foodKeywords = [
    'alimento', 'food', 'comida', 'bebida', 'drink', 'beverage',
    'nutrição', 'nutrition', 'caloria', 'calorie', 'kcal',
    'proteína', 'protein', 'carboidrato', 'carbohydrate', 'gordura', 'fat',
  ];
  
  // Se contém palavras que indicam alimento, retornar true
  if (foodKeywords.some(keyword => nameLower.includes(keyword))) {
    return true;
  }
  
  // Se não tem indicadores claros de não-alimento, assumir que pode ser alimento
  // (melhor aceitar do que rejeitar incorretamente)
  return true;
}

/**
 * Busca produto no UPCitemdb (API gratuita alternativa)
 */
async function getFoodFromUPCitemdb(barcode: string): Promise<FoodItem | null> {
  try {
    const cleanBarcode = barcode.trim().replace(/\D/g, '');
    if (!cleanBarcode || cleanBarcode.length < 8) {
      return null;
    }

    console.log('[Barcode] Tentando UPCitemdb para código:', cleanBarcode);
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`, {
      headers: {
        'User-Agent': 'Nuti/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.code !== 'OK' || !data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const productName = item.title || item.description || '';
    
    if (!productName || productName.trim().length === 0) {
      return null;
    }

    // Verificar se é realmente um alimento
    if (!isFoodProduct(productName, item.category)) {
      console.log('[Barcode] Produto não é alimento (UPCitemdb):', productName);
      return null;
    }

    console.log('[Barcode] Produto encontrado no UPCitemdb:', productName);

    // UPCitemdb não fornece valores nutricionais diretamente
    // Para código de barras, usar o nome original completo (sem normalização)
    return {
      id: cleanBarcode,
      name: productName.trim(),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      image: item.images?.[0] || undefined,
    };
  } catch (error) {
    console.log('[Barcode] Erro ao buscar no UPCitemdb:', error);
    return null;
  }
}

/**
 * Busca produto usando API alternativa (tentativa genérica)
 * Nota: Algumas APIs podem ter limites ou exigir chaves
 */
async function getFoodFromAlternativeAPI(barcode: string): Promise<FoodItem | null> {
  try {
    const cleanBarcode = barcode.trim().replace(/\D/g, '');
    if (!cleanBarcode || cleanBarcode.length < 8) {
      return null;
    }

    // Tentar buscar em uma API alternativa simples
    // Nota: Esta é uma tentativa genérica, pode não funcionar para todos os códigos
    console.log('[Barcode] Tentando API alternativa para código:', cleanBarcode);
    
    // Por enquanto, retornamos null - pode ser expandido no futuro
    // com outras APIs que não exigem chave ou com chaves configuráveis
    return null;
  } catch (error) {
    console.log('[Barcode] Erro ao buscar em API alternativa:', error);
    return null;
  }
}

/**
 * Obtém alimento por código de barras usando Open Food Facts API
 */
async function getFoodFromOpenFoodFacts(barcode: string): Promise<FoodItem | null> {
  try {
    const cleanBarcode = barcode.trim().replace(/\D/g, ''); // Remove caracteres não numéricos
    
    if (!cleanBarcode || cleanBarcode.length < 8) {
      console.log('[Barcode] Código de barras inválido:', barcode, '->', cleanBarcode);
      return null;
    }

    console.log('[Barcode] Buscando produto com código:', cleanBarcode);
    const url = `https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`;
    console.log('[Barcode] URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Nuti/1.0 (Android)',
      },
    });
    
    if (!response.ok) {
      console.log('[Barcode] Erro na resposta HTTP:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[Barcode] Status da API:', data.status);
    
    if (data.status !== 1 || !data.product) {
      console.log('[Barcode] Produto não encontrado na base de dados do Open Food Facts');
      return null;
    }

    const product = data.product;
    console.log('[Barcode] Produto encontrado:', product.product_name || 'Sem nome');
    
    // Para código de barras, usar o nome COMPLETO sem normalização
    // Priorizar product_name completo (pode conter marca, tamanho, etc.)
    // Tentar obter nome em várias línguas, mas SEM normalizar
    let productName = product.product_name || 
                      product.product_name_en || 
                      product.product_name_pt || 
                      product.product_name_es || 
                      product.product_name_fr || 
                      product.product_name_de || 
                      product.product_name_it ||
                      product.generic_name ||
                      product.abbreviated_product_name ||
                      '';
    
    // Se product_name existe mas parece truncado, tentar usar outros campos também
    // Mas apenas para código de barras, queremos o nome mais completo possível
    if (productName && product.product_name && product.product_name.length < 20) {
      // Se o nome parece curto, tentar ver se há um nome mais completo em outros campos
      const alternativeNames = [
        product.product_name_en,
        product.product_name_pt,
        product.product_name_es,
        product.product_name_fr,
      ].filter(name => name && name.length > productName.length);
      
      if (alternativeNames.length > 0) {
        // Usar o nome mais longo disponível
        productName = alternativeNames.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        );
      }
    }
    
    // Apenas trim, SEM normalização
    productName = productName.trim();
    
    if (!productName || productName.length === 0) {
      console.log('[Barcode] Produto sem nome');
      return null;
    }
    
    console.log('[Barcode] Nome do produto (sem normalização):', productName);

    // Verificar se é realmente um alimento (Open Food Facts já filtra, mas vamos garantir)
    const categories = product.categories || product.categories_tags || [];
    const categoryString = Array.isArray(categories) ? categories.join(' ') : String(categories);
    
    if (!isFoodProduct(productName, categoryString)) {
      console.log('[Barcode] Produto não é alimento (Open Food Facts):', productName);
      return null;
    }

    // Extrair valores nutricionais (tentar várias fontes)
    const nutriments = product.nutriments || {};
    
    // Calorias - tentar várias fontes
    const calories = Math.round(
      nutriments['energy-kcal_100g'] || 
      nutriments['energy-kcal'] || 
      (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0) || // Converter kJ para kcal
      (nutriments['energy'] ? nutriments['energy'] / 4.184 : 0) ||
      0
    );
    
    // Proteína
    const protein = parseFloat((nutriments.proteins_100g || nutriments.proteins || nutriments['proteins_100g'] || 0).toFixed(1));
    
    // Carboidratos
    const carbs = parseFloat((nutriments.carbohydrates_100g || nutriments.carbohydrates || nutriments['carbohydrates_100g'] || 0).toFixed(1));
    
    // Gordura
    const fat = parseFloat((nutriments.fat_100g || nutriments.fat || nutriments['fat_100g'] || 0).toFixed(1));
    
    // Dados nutricionais adicionais para cálculo mais preciso do health score
    const sugars = parseFloat((nutriments.sugars_100g || nutriments.sugars || 0).toFixed(1));
    const fiber = parseFloat((nutriments.fiber_100g || nutriments.fiber || nutriments['fiber_100g'] || 0).toFixed(1));
    // Sódio: se não tiver sodium_100g, tentar converter de salt_100g (1g sal = 400mg sódio)
    const sodium = parseFloat((
      nutriments.sodium_100g || 
      nutriments.sodium || 
      (nutriments.salt_100g ? nutriments.salt_100g * 400 : 0) || 
      (nutriments.salt ? nutriments.salt * 400 : 0) || 
      0
    ).toFixed(1));
    const saturatedFat = parseFloat((nutriments['saturated-fat_100g'] || nutriments['saturated-fat'] || nutriments.saturated_fat_100g || 0).toFixed(1));
    const transFat = parseFloat((nutriments['trans-fat_100g'] || nutriments['trans-fat'] || nutriments.trans_fat_100g || 0).toFixed(1));
    
    console.log('[Barcode] Valores nutricionais:', { calories, protein, carbs, fat, sugars, fiber, sodium, saturatedFat, transFat });
    
    // Se não tiver valores nutricionais, tentar buscar na base local pelo nome
    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
      console.log('[Barcode] Produto sem valores nutricionais, tentando base local...');
      
      const nameLower = productName.toLowerCase();
      
      // Buscar na base local
      const localMatch = FOOD_DATABASE.find(food => {
        const foodNameLower = food.name.toLowerCase();
        return nameLower.includes(foodNameLower) || foodNameLower.includes(nameLower);
      });
      
      if (localMatch) {
        console.log('[Barcode] Encontrado na base local:', localMatch.name);
        return {
          id: product.code || cleanBarcode,
          name: productName, // Usar nome original, não normalizado
          calories: localMatch.caloriesPer100g,
          protein: localMatch.proteinPer100g,
          carbs: localMatch.carbsPer100g,
          fat: localMatch.fatPer100g,
          image: product.image_url || product.image_small_url || undefined,
          // Dados adicionais não disponíveis na base local, deixar undefined
        };
      }
      
      // Se não encontrou na base local, retornar o produto mesmo sem valores nutricionais
      // O usuário pode editar depois
      console.log('[Barcode] Produto sem valores nutricionais, retornando mesmo assim');
    }
    
    // Para código de barras, usar o nome original completo (sem normalização)
    // O usuário quer ver o nome completo do produto
    // productName já foi trimado acima, usar diretamente
    return {
      id: product.code || cleanBarcode,
      name: productName, // Nome completo sem normalização
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
      image: product.image_url || product.image_small_url || undefined,
      // Dados nutricionais adicionais para cálculo mais preciso do health score
      sugars: sugars > 0 ? sugars : undefined,
      fiber: fiber > 0 ? fiber : undefined,
      sodium: sodium > 0 ? sodium : undefined,
      saturatedFat: saturatedFat > 0 ? saturatedFat : undefined,
      transFat: transFat > 0 ? transFat : undefined,
    };
  } catch (error: any) {
    console.error('[Barcode] Erro ao buscar produto:', error);
    console.error('[Barcode] Stack:', error.stack);
    return null;
  }
}

/**
 * Obtém alimento por código de barras usando múltiplas APIs (fallback)
 * Tenta Open Food Facts primeiro, depois UPCitemdb, depois Barcode Lookup
 */
export async function getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
  const cleanBarcode = barcode.trim().replace(/\D/g, '');
  
  if (!cleanBarcode || cleanBarcode.length < 8) {
    console.log('[Barcode] Código de barras inválido:', barcode, '->', cleanBarcode);
    return null;
  }

  console.log('[Barcode] Iniciando busca com múltiplas APIs para código:', cleanBarcode);

  // 1. Tentar Open Food Facts primeiro (melhor para valores nutricionais)
  console.log('[Barcode] Tentando Open Food Facts...');
  let result = await getFoodFromOpenFoodFacts(cleanBarcode);
  if (result) {
    // Validação adicional de segurança (mesmo que a API já tenha validado)
    if (!isFoodProduct(result.name)) {
      console.log('[Barcode] Produto rejeitado após validação final:', result.name);
      result = null;
    } else {
      console.log('[Barcode] Produto encontrado no Open Food Facts');
      return result;
    }
  }

  // 2. Tentar UPCitemdb (gratuito, sem API key)
  console.log('[Barcode] Open Food Facts não encontrou, tentando UPCitemdb...');
  result = await getFoodFromUPCitemdb(cleanBarcode);
  if (result) {
    // Validação adicional de segurança
    if (!isFoodProduct(result.name)) {
      console.log('[Barcode] Produto rejeitado após validação final:', result.name);
      result = null;
    } else {
      console.log('[Barcode] Produto encontrado no UPCitemdb');
      // Tentar buscar valores nutricionais na base local pelo nome
      if (result.calories === 0 && result.protein === 0 && result.carbs === 0 && result.fat === 0) {
        const nameLower = result.name.toLowerCase();
        const localMatch = FOOD_DATABASE.find(food => {
          const foodNameLower = food.name.toLowerCase();
          return nameLower.includes(foodNameLower) || foodNameLower.includes(nameLower);
        });
        
        if (localMatch) {
          console.log('[Barcode] Valores nutricionais encontrados na base local');
          result.calories = localMatch.caloriesPer100g;
          result.protein = localMatch.proteinPer100g;
          result.carbs = localMatch.carbsPer100g;
          result.fat = localMatch.fatPer100g;
        }
      }
      return result;
    }
  }

  // 3. Tentar API alternativa (pode ser expandida no futuro)
  console.log('[Barcode] UPCitemdb não encontrou, tentando API alternativa...');
  result = await getFoodFromAlternativeAPI(cleanBarcode);
  if (result) {
    // Validação adicional de segurança
    if (!isFoodProduct(result.name)) {
      console.log('[Barcode] Produto rejeitado após validação final:', result.name);
      result = null;
    } else {
      console.log('[Barcode] Produto encontrado na API alternativa');
      // Tentar buscar valores nutricionais na base local pelo nome
      if (result.calories === 0 && result.protein === 0 && result.carbs === 0 && result.fat === 0) {
        const nameLower = result.name.toLowerCase();
        const localMatch = FOOD_DATABASE.find(food => {
          const foodNameLower = food.name.toLowerCase();
          return nameLower.includes(foodNameLower) || foodNameLower.includes(nameLower);
        });
        
        if (localMatch) {
          console.log('[Barcode] Valores nutricionais encontrados na base local');
          result.calories = localMatch.caloriesPer100g;
          result.protein = localMatch.proteinPer100g;
          result.carbs = localMatch.carbsPer100g;
          result.fat = localMatch.fatPer100g;
        }
      }
      return result;
    }
  }

  console.log('[Barcode] Produto não encontrado em nenhuma API');
  return null;
}

/**
 * Interface para mensagens do chat
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Envia mensagem para Groq API e retorna resposta
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  userId: string
): Promise<string> {
  try {
    const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    
    if (!groqApiKey) {
      throw new Error('Groq API key não configurada');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: 'És um assistente nutricional simpático e útil do Nuti. Responde sempre em português de forma curta e amigável. Ajuda utilizadores com questões sobre nutrição, dietas e alimentação saudável. O teu objetivo é ser uma ajuda, não um bot.'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Erro ao comunicar com a IA');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Desculpa, não consegui gerar uma resposta.';
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    throw new Error(error.message || 'Erro ao comunicar com a IA');
  }
}

/**
 * Analisa uma imagem de comida usando IA e retorna informações nutricionais
 * 
 * Nota: A Groq API não suporta vision nativamente. Esta função usa Google Gemini
 * que suporta análise de imagens. Se não tiveres uma chave do Gemini, podes usar
 * OpenAI GPT-4 Vision ou outra API de vision.
 */
export async function analyzeFoodImage(imageUri: string, language: string = 'en'): Promise<FoodItem> {
  try {
    // Tentar usar Google Gemini primeiro (suporta vision)
    const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    
    if (geminiApiKey) {
      return await analyzeWithGemini(imageUri, geminiApiKey, language);
    }

    // Fallback: Tentar OpenAI GPT-4 Vision
    const openAiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    
    if (openAiApiKey) {
      return await analyzeWithOpenAI(imageUri, openAiApiKey, language);
    }

    // Se não tiver nenhuma chave de vision, retornar erro informativo
    throw new Error('Nenhuma API de vision configurada. Adicione EXPO_PUBLIC_GEMINI_API_KEY ou EXPO_PUBLIC_OPENAI_API_KEY no .env');
  } catch (error: any) {
    console.error('Error analyzing food image:', error);
    throw new Error(error.message || 'Erro ao analisar imagem');
  }
}

/**
 * Analisa imagem usando Google Gemini
 */
async function analyzeWithGemini(imageUri: string, apiKey: string, language: string = 'en'): Promise<FoodItem> {
  // Converter imagem para base64 usando XMLHttpRequest (compatível com React Native)
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Failed to load image: ${xhr.status}`));
      }
    };
    xhr.onerror = function () {
      reject(new Error('Network error while loading image'));
    };
    xhr.onabort = function () {
      reject(new Error('Image loading aborted'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', imageUri, true);
    xhr.send(null);
  });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
      resolve(base64Data);
    };
    reader.onerror = () => reject(new Error('Erro ao converter imagem'));
    reader.readAsDataURL(blob);
  });

  // Usar Gemini 2.5 Flash-Lite (mais barato e menos sobrecarregado)
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Analyze this image and determine if it contains FOOD. 

IMPORTANT: 
- If the image does NOT contain food (e.g., person, animal, object, text, etc.), respond with: {"error": "This image does not contain food. Please upload an image of food."}
- If the image contains food, identify ALL food items on the plate and respond in JSON format:

{
  "plateName": "complete plate name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
  "foods": [
    {
      "name": "individual food name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
      "estimatedWeight": estimated_weight_in_grams,
      "caloriesPer100g": calories_per_100g,
      "proteinPer100g": protein_grams_per_100g,
      "carbsPer100g": carbs_grams_per_100g,
      "fatPer100g": fat_grams_per_100g,
      "sugarsPer100g": sugars_grams_per_100g (optional, 0 if not applicable),
      "fiberPer100g": fiber_grams_per_100g (optional, 0 if not applicable),
      "sodiumPer100g": sodium_mg_per_100g (optional, 0 if not applicable),
      "saturatedFatPer100g": saturated_fat_grams_per_100g (optional, 0 if not applicable),
      "transFatPer100g": trans_fat_grams_per_100g (optional, 0 if not applicable)
    }
  ]
}

CRITICAL NUTRITIONAL ACCURACY RULES - BE CONSERVATIVE WITH CALORIES:
- Use REALISTIC and ACCURATE nutritional values from official food composition databases (USDA, TACO, etc.)
- DO NOT overestimate calories - be conservative and accurate
- For common foods, use these PRECISE reference values per 100g (cooked, unless specified):
  * Cooked white rice: 130 kcal, 2.7g protein, 28g carbs, 0.3g fat
  * Grilled chicken breast (skinless): 165 kcal, 31g protein, 0g carbs, 3.6g fat
  * Fried chicken (breaded): 239 kcal, 25g protein, 0g carbs, 13g fat
  * Cooked black beans: 132 kcal, 8.9g protein, 24g carbs, 0.5g fat
  * Cooked beef steak (lean): 250 kcal, 26g protein, 0g carbs, 15g fat
  * Cooked pasta (plain): 131 kcal, 5g protein, 25g carbs, 1.1g fat
  * French fries (homemade): 312 kcal, 3.4g protein, 41g carbs, 15g fat
  * Fried egg: 196 kcal, 13.6g protein, 1.1g carbs, 14.8g fat
  * Boiled egg: 155 kcal, 13g protein, 1.1g carbs, 11g fat
  * Raw tomato: 18 kcal, 0.9g protein, 3.9g carbs, 0.2g fat
  * Lettuce: 15 kcal, 1.4g protein, 2.9g carbs, 0.2g fat
  * Cooked potato (boiled): 87 kcal, 2g protein, 20g carbs, 0.1g fat
  * Bread (white): 265 kcal, 9g protein, 49g carbs, 3.2g fat
- For vegetables and salads, use LOW calorie values (15-30 kcal per 100g typically)
- For other foods, use scientifically accurate values from food composition databases
- "plateName" should be a descriptive name for the complete plate/meal
- Identify ALL separate food items on the plate (including side dishes like tomatoes, lettuce, onions, etc.)
- Each food item must have accurate nutritional values per 100g
- Estimate weight REALISTICALLY and DIFFERENTLY for each food based on what you ACTUALLY SEE in the image:
  * Look at the actual size/portion of each food item in the image
  * A small piece of steak might be 80g, a medium one 150g, a large one 250g
  * A small portion of rice might be 80g, a normal one 150g, a large one 200g
  * Estimate based on the VISUAL SIZE you see, not fixed values
  * DO NOT use the same weight for all foods - estimate each one individually based on its actual visual size in the image
  * Be realistic: if you see a small piece, estimate a small weight; if you see a large portion, estimate a large weight
  * IMPORTANT: When in doubt, use SMALLER weights to avoid overestimating calories
- Only respond with valid JSON, no additional text before or after.`
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64
                  }
                }
              ]
            }]
          }),
        }
      );

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extrair JSON da resposta
        let jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Unable to process image. Please try again.');
        }

        const plateData = JSON.parse(jsonMatch[0]);
        
        // Verificar se a imagem não contém comida
        if (plateData.error) {
          throw new Error('does not contain food');
        }
        
        // Se a resposta tiver a estrutura antiga (compatibilidade), converter
        if (plateData.name && !plateData.foods) {
          return {
            id: Date.now().toString(),
            name: plateData.name || 'Alimento não identificado',
            calories: Math.round(plateData.calories || 0),
            protein: parseFloat((plateData.protein || 0).toFixed(1)),
            carbs: parseFloat((plateData.carbs || 0).toFixed(1)),
            fat: parseFloat((plateData.fat || 0).toFixed(1)),
            image: imageUri,
          };
        }
        
        // Nova estrutura: múltiplos alimentos
        if (plateData.foods && Array.isArray(plateData.foods) && plateData.foods.length > 0) {
          // Retornar com a lista de alimentos
          const plateName = plateData.plateName || plateData.foods.map((f: any) => f.name).join(', ') || 'Alimento não identificado';
          
          // Melhorar valores nutricionais usando base de dados local
          return {
            id: Date.now().toString(),
            name: plateName,
            calories: 0, // Será calculado baseado nos pesos
            protein: 0,
            carbs: 0,
            fat: 0,
            image: imageUri,
            plateFoods: plateData.foods.map((f: any) => {
              const enhanced = enhanceNutritionalValues(
                f.name,
                f.caloriesPer100g || 0,
                f.proteinPer100g || 0,
                f.carbsPer100g || 0,
                f.fatPer100g || 0
              );
              
              return {
                name: f.name,
                caloriesPer100g: enhanced.caloriesPer100g,
                proteinPer100g: enhanced.proteinPer100g,
                carbsPer100g: enhanced.carbsPer100g,
                fatPer100g: enhanced.fatPer100g,
                weight: Math.round(f.estimatedWeight || 100), // usar peso estimado da AI
                // Dados nutricionais adicionais (se fornecidos pela IA)
                sugarsPer100g: f.sugarsPer100g && f.sugarsPer100g > 0 ? parseFloat(f.sugarsPer100g.toFixed(1)) : undefined,
                fiberPer100g: f.fiberPer100g && f.fiberPer100g > 0 ? parseFloat(f.fiberPer100g.toFixed(1)) : undefined,
                sodiumPer100g: f.sodiumPer100g && f.sodiumPer100g > 0 ? parseFloat(f.sodiumPer100g.toFixed(1)) : undefined,
                saturatedFatPer100g: f.saturatedFatPer100g && f.saturatedFatPer100g > 0 ? parseFloat(f.saturatedFatPer100g.toFixed(1)) : undefined,
                transFatPer100g: f.transFatPer100g && f.transFatPer100g > 0 ? parseFloat(f.transFatPer100g.toFixed(1)) : undefined,
              };
            }),
          };
        }
        
        throw new Error('Unable to process image. Please try again.');
      } else {
        const errorData = await geminiResponse.json();
        const errorMessage = errorData.error?.message || 'Error processing image. Please try again.';
        
        // Verificar se é erro de overload ou rate limit
        if (errorMessage.toLowerCase().includes('overloaded') || 
            errorMessage.toLowerCase().includes('rate limit') ||
            errorMessage.toLowerCase().includes('quota') ||
            geminiResponse.status === 429) {
          
          // Se não for a última tentativa, esperar antes de tentar novamente
          if (attempt < maxRetries - 1) {
            const waitTime = Math.pow(2, attempt) * 1000; // Backoff exponencial: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, waitTime));
            lastError = errorMessage;
            continue;
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      lastError = error.message || 'Error processing image. Please try again.';
      
      // Se for erro de overload e ainda temos tentativas, continuar
      if (error.message?.toLowerCase().includes('overloaded') && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Se não for a última tentativa e for um erro de rede, tentar novamente
      if (attempt < maxRetries - 1 && !error.message?.toLowerCase().includes('json')) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(lastError || 'Error processing image. Please try again later.');
}

/**
 * Analisa imagem usando OpenAI GPT-4 Vision
 */
async function analyzeWithOpenAI(imageUri: string, apiKey: string, language: string = 'en'): Promise<FoodItem> {
  // Converter imagem para base64 usando XMLHttpRequest (compatível com React Native)
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Failed to load image: ${xhr.status}`));
      }
    };
    xhr.onerror = function () {
      reject(new Error('Network error while loading image'));
    };
    xhr.onabort = function () {
      reject(new Error('Image loading aborted'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', imageUri, true);
    xhr.send(null);
  });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;
      resolve(base64Data);
    };
    reader.onerror = () => reject(new Error('Erro ao converter imagem'));
    reader.readAsDataURL(blob);
  });

  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // ou 'gpt-4-vision-preview' se disponível
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image and determine if it contains FOOD. 

IMPORTANT: 
- If the image does NOT contain food (e.g., person, animal, object, text, etc.), respond with: {"error": "This image does not contain food. Please upload an image of food."}
- If the image contains food, identify ALL food items on the plate and respond in JSON format:

{
  "plateName": "complete plate name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
  "foods": [
    {
      "name": "individual food name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
      "estimatedWeight": estimated_weight_in_grams,
      "caloriesPer100g": calories_per_100g,
      "proteinPer100g": protein_grams_per_100g,
      "carbsPer100g": carbs_grams_per_100g,
      "fatPer100g": fat_grams_per_100g,
      "sugarsPer100g": sugars_grams_per_100g (optional, 0 if not applicable),
      "fiberPer100g": fiber_grams_per_100g (optional, 0 if not applicable),
      "sodiumPer100g": sodium_mg_per_100g (optional, 0 if not applicable),
      "saturatedFatPer100g": saturated_fat_grams_per_100g (optional, 0 if not applicable),
      "transFatPer100g": trans_fat_grams_per_100g (optional, 0 if not applicable)
    }
  ]
}

CRITICAL NUTRITIONAL ACCURACY RULES - BE CONSERVATIVE WITH CALORIES:
- Use REALISTIC and ACCURATE nutritional values from official food composition databases (USDA, TACO, etc.)
- DO NOT overestimate calories - be conservative and accurate
- For common foods, use these PRECISE reference values per 100g (cooked, unless specified):
  * Cooked white rice: 130 kcal, 2.7g protein, 28g carbs, 0.3g fat
  * Grilled chicken breast (skinless): 165 kcal, 31g protein, 0g carbs, 3.6g fat
  * Fried chicken (breaded): 239 kcal, 25g protein, 0g carbs, 13g fat
  * Cooked black beans: 132 kcal, 8.9g protein, 24g carbs, 0.5g fat
  * Cooked beef steak (lean): 250 kcal, 26g protein, 0g carbs, 15g fat
  * Cooked pasta (plain): 131 kcal, 5g protein, 25g carbs, 1.1g fat
  * French fries (homemade): 312 kcal, 3.4g protein, 41g carbs, 15g fat
  * Fried egg: 196 kcal, 13.6g protein, 1.1g carbs, 14.8g fat
  * Boiled egg: 155 kcal, 13g protein, 1.1g carbs, 11g fat
  * Raw tomato: 18 kcal, 0.9g protein, 3.9g carbs, 0.2g fat
  * Lettuce: 15 kcal, 1.4g protein, 2.9g carbs, 0.2g fat
  * Cooked potato (boiled): 87 kcal, 2g protein, 20g carbs, 0.1g fat
  * Bread (white): 265 kcal, 9g protein, 49g carbs, 3.2g fat
- For vegetables and salads, use LOW calorie values (15-30 kcal per 100g typically)
- For other foods, use scientifically accurate values from food composition databases
- "plateName" should be a descriptive name for the complete plate/meal
- Identify ALL separate food items on the plate (including side dishes like tomatoes, lettuce, onions, etc.)
- Each food item must have accurate nutritional values per 100g
- Estimate weight REALISTICALLY and DIFFERENTLY for each food based on what you ACTUALLY SEE in the image:
  * Look at the actual size/portion of each food item in the image
  * A small piece of steak might be 80g, a medium one 150g, a large one 250g
  * A small portion of rice might be 80g, a normal one 150g, a large one 200g
  * Estimate based on the VISUAL SIZE you see, not fixed values
  * DO NOT use the same weight for all foods - estimate each one individually based on its actual visual size in the image
  * Be realistic: if you see a small piece, estimate a small weight; if you see a large portion, estimate a large weight
  * IMPORTANT: When in doubt, use SMALLER weights to avoid overestimating calories
- Only respond with valid JSON, no additional text before or after.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`
              }
            }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!openAiResponse.ok) {
    const errorData = await openAiResponse.json();
    throw new Error(errorData.error?.message || 'Erro ao analisar imagem com OpenAI');
  }

  const data = await openAiResponse.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Extrair JSON da resposta
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Resposta da IA não contém JSON válido');
  }

  const plateData = JSON.parse(jsonMatch[0]);
  
  // Verificar se a imagem não contém comida
  if (plateData.error) {
    throw new Error('does not contain food');
  }
  
  // Se a resposta tiver a estrutura antiga (compatibilidade), converter
  if (plateData.name && !plateData.foods) {
    return {
      id: Date.now().toString(),
      name: plateData.name || 'Alimento não identificado',
      calories: Math.round(plateData.calories || 0),
      protein: parseFloat((plateData.protein || 0).toFixed(1)),
      carbs: parseFloat((plateData.carbs || 0).toFixed(1)),
      fat: parseFloat((plateData.fat || 0).toFixed(1)),
      image: imageUri,
    };
  }
  
  // Nova estrutura: múltiplos alimentos
  if (plateData.foods && Array.isArray(plateData.foods) && plateData.foods.length > 0) {
    const plateName = plateData.plateName || plateData.foods.map((f: any) => f.name).join(', ') || 'Alimento não identificado';
    
    // Melhorar valores nutricionais usando base de dados local
    return {
      id: Date.now().toString(),
      name: plateName,
      calories: 0, // Será calculado baseado nos pesos
      protein: 0,
      carbs: 0,
      fat: 0,
      image: imageUri,
      plateFoods: plateData.foods.map((f: any) => {
        const enhanced = enhanceNutritionalValues(
          f.name,
          f.caloriesPer100g || 0,
          f.proteinPer100g || 0,
          f.carbsPer100g || 0,
          f.fatPer100g || 0
        );
        
        return {
          name: f.name,
          caloriesPer100g: enhanced.caloriesPer100g,
          proteinPer100g: enhanced.proteinPer100g,
          carbsPer100g: enhanced.carbsPer100g,
          fatPer100g: enhanced.fatPer100g,
          weight: Math.round(f.estimatedWeight || 100), // usar peso estimado da AI
          // Dados nutricionais adicionais (se fornecidos pela IA)
          sugarsPer100g: f.sugarsPer100g && f.sugarsPer100g > 0 ? parseFloat(f.sugarsPer100g.toFixed(1)) : undefined,
          fiberPer100g: f.fiberPer100g && f.fiberPer100g > 0 ? parseFloat(f.fiberPer100g.toFixed(1)) : undefined,
          sodiumPer100g: f.sodiumPer100g && f.sodiumPer100g > 0 ? parseFloat(f.sodiumPer100g.toFixed(1)) : undefined,
          saturatedFatPer100g: f.saturatedFatPer100g && f.saturatedFatPer100g > 0 ? parseFloat(f.saturatedFatPer100g.toFixed(1)) : undefined,
          transFatPer100g: f.transFatPer100g && f.transFatPer100g > 0 ? parseFloat(f.transFatPer100g.toFixed(1)) : undefined,
        };
      }),
    };
  }
  
  throw new Error('Unable to process image. Please try again.');
}

/**
 * Analisa uma descrição de comida usando IA e retorna informações nutricionais ajustadas
 */
export async function analyzeFoodDescription(
  description: string,
  currentFoods: PlateFoodItem[],
  language: string = 'en'
): Promise<FoodItem> {
  try {
    // Tentar usar Google Gemini primeiro
    const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    
    if (geminiApiKey) {
      return await analyzeDescriptionWithGemini(description, currentFoods, geminiApiKey, language);
    }

    // Fallback: Tentar OpenAI
    const openAiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    
    if (openAiApiKey) {
      return await analyzeDescriptionWithOpenAI(description, currentFoods, openAiApiKey, language);
    }

    throw new Error('Nenhuma API configurada');
  } catch (error: any) {
    console.error('Error analyzing food description:', error);
    throw new Error(error.message || 'Erro ao analisar descrição');
  }
}

/**
 * Analisa descrição usando Google Gemini
 */
async function analyzeDescriptionWithGemini(
  description: string,
  currentFoods: PlateFoodItem[],
  apiKey: string,
  language: string = 'en'
): Promise<FoodItem> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const currentFoodsText = currentFoods.map(f => 
        `- ${f.name}: ${f.weight}g (${f.caloriesPer100g} kcal/100g, ${f.proteinPer100g}g proteína, ${f.carbsPer100g}g carboidratos, ${f.fatPer100g}g gordura)`
      ).join('\n');

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Based on the user's description and the current food analysis, adjust the food items and nutritional values.

CURRENT FOOD ANALYSIS:
${currentFoodsText}

USER DESCRIPTION:
"${description}"

Based on this description, update the food items list. The description may:
- Add missing foods that weren't detected
- Remove foods that don't exist
- Correct food names
- Adjust weights/portions
- Add details about preparation method (fried, grilled, etc.) that affects nutrition

Respond in JSON format:
{
  "plateName": "complete plate name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
  "foods": [
    {
      "name": "individual food name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
      "estimatedWeight": estimated_weight_in_grams,
      "caloriesPer100g": calories_per_100g,
      "proteinPer100g": protein_grams_per_100g,
      "carbsPer100g": carbs_grams_per_100g,
      "fatPer100g": fat_grams_per_100g
    }
  ]
}

CRITICAL NUTRITIONAL ACCURACY RULES - BE CONSERVATIVE WITH CALORIES:
- Use REALISTIC and ACCURATE nutritional values from official food composition databases (USDA, TACO, etc.)
- DO NOT overestimate calories - be conservative and accurate
- For common foods, use these PRECISE reference values per 100g (cooked, unless specified):
  * Cooked white rice: 130 kcal, 2.7g protein, 28g carbs, 0.3g fat
  * Grilled chicken breast (skinless): 165 kcal, 31g protein, 0g carbs, 3.6g fat
  * Fried chicken (breaded): 239 kcal, 25g protein, 0g carbs, 13g fat
  * Cooked black beans: 132 kcal, 8.9g protein, 24g carbs, 0.5g fat
  * Cooked beef steak (lean): 250 kcal, 26g protein, 0g carbs, 15g fat
  * Cooked pasta (plain): 131 kcal, 5g protein, 25g carbs, 1.1g fat
  * French fries (homemade): 312 kcal, 3.4g protein, 41g carbs, 15g fat
  * Fried egg: 196 kcal, 13.6g protein, 1.1g carbs, 14.8g fat
  * Boiled egg: 155 kcal, 13g protein, 1.1g carbs, 11g fat
  * Raw tomato: 18 kcal, 0.9g protein, 3.9g carbs, 0.2g fat
  * Lettuce: 15 kcal, 1.4g protein, 2.9g carbs, 0.2g fat
  * Cooked potato (boiled): 87 kcal, 2g protein, 20g carbs, 0.1g fat
  * Bread (white): 265 kcal, 9g protein, 49g carbs, 3.2g fat
- IMPORTANT: When adjusting, maintain or REDUCE calories if the description suggests smaller portions or less caloric foods
- Only ADD calories if the description explicitly mentions additional high-calorie foods
- For vegetables and salads, use LOW calorie values (15-30 kcal per 100g typically)
- Estimate weight REALISTICALLY - don't overestimate portions
- If description says "small portion", use smaller weights (50-80g). If "large portion", use 150-200g
- Only respond with valid JSON, no additional text before or after.`
              }]
            }]
          }),
        }
      );

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        let jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Unable to process description. Please try again.');
        }

        const plateData = JSON.parse(jsonMatch[0]);
        
        if (plateData.foods && Array.isArray(plateData.foods) && plateData.foods.length > 0) {
          const plateName = plateData.plateName || plateData.foods.map((f: any) => f.name).join(', ') || 'Alimento não identificado';
          
          const { enhanceNutritionalValues } = await import('./foodDatabase');
          
          return {
            id: Date.now().toString(),
            name: plateName,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            plateFoods: plateData.foods.map((f: any) => {
              const enhanced = enhanceNutritionalValues(
                f.name,
                f.caloriesPer100g || 0,
                f.proteinPer100g || 0,
                f.carbsPer100g || 0,
                f.fatPer100g || 0
              );
              
              return {
                name: f.name,
                caloriesPer100g: enhanced.caloriesPer100g,
                proteinPer100g: enhanced.proteinPer100g,
                carbsPer100g: enhanced.carbsPer100g,
                fatPer100g: enhanced.fatPer100g,
                weight: Math.round(f.estimatedWeight || 100),
              };
            }),
          };
        }
        
        throw new Error('Unable to process description. Please try again.');
      } else {
        const errorData = await geminiResponse.json();
        const errorMessage = errorData.error?.message || 'Error processing description.';
        
        if ((errorMessage.toLowerCase().includes('overloaded') || 
             errorMessage.toLowerCase().includes('rate limit') ||
             geminiResponse.status === 429) && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = errorMessage;
          continue;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      lastError = error.message || 'Error processing description.';
      
      if (error.message?.toLowerCase().includes('overloaded') && attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (attempt < maxRetries - 1 && !error.message?.toLowerCase().includes('json')) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(lastError || 'Error processing description. Please try again later.');
}

/**
 * Analisa descrição usando OpenAI
 */
async function analyzeDescriptionWithOpenAI(
  description: string,
  currentFoods: PlateFoodItem[],
  apiKey: string,
  language: string = 'en'
): Promise<FoodItem> {
  const currentFoodsText = currentFoods.map(f => 
    `- ${f.name}: ${f.weight}g (${f.caloriesPer100g} kcal/100g, ${f.proteinPer100g}g proteína, ${f.carbsPer100g}g carboidratos, ${f.fatPer100g}g gordura)`
  ).join('\n');

  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Based on the user's description and the current food analysis, adjust the food items and nutritional values.

CURRENT FOOD ANALYSIS:
${currentFoodsText}

USER DESCRIPTION:
"${description}"

Based on this description, update the food items list. Respond in JSON format:
{
  "plateName": "complete plate name in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}",
  "foods": [
    {
      "name": "individual food name",
      "estimatedWeight": estimated_weight_in_grams,
      "caloriesPer100g": calories_per_100g,
      "proteinPer100g": protein_grams_per_100g,
      "carbsPer100g": carbs_grams_per_100g,
      "fatPer100g": fat_grams_per_100g
    }
  ]
}

CRITICAL: Use PRECISE nutritional values from food databases. Be CONSERVATIVE with calories - don't overestimate.
- For vegetables: 15-30 kcal/100g typically
- For cooked grains: 100-150 kcal/100g
- For lean proteins: 150-200 kcal/100g
- For fried foods: add 30-50% more calories than grilled/boiled versions
- Estimate weights realistically based on description
- Only respond with valid JSON.`
      }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!openAiResponse.ok) {
    const errorData = await openAiResponse.json();
    throw new Error(errorData.error?.message || 'Erro ao analisar descrição');
  }

  const data = await openAiResponse.json();
  const content = data.choices[0]?.message?.content || '';
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Resposta da IA não contém JSON válido');
  }

  const plateData = JSON.parse(jsonMatch[0]);
  
  if (plateData.foods && Array.isArray(plateData.foods) && plateData.foods.length > 0) {
    const plateName = plateData.plateName || plateData.foods.map((f: any) => f.name).join(', ') || 'Alimento não identificado';
    
    const { enhanceNutritionalValues } = await import('./foodDatabase');
    
    return {
      id: Date.now().toString(),
      name: plateName,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      plateFoods: plateData.foods.map((f: any) => {
        const enhanced = enhanceNutritionalValues(
          f.name,
          f.caloriesPer100g || 0,
          f.proteinPer100g || 0,
          f.carbsPer100g || 0,
          f.fatPer100g || 0
        );
        
        return {
          name: f.name,
          caloriesPer100g: enhanced.caloriesPer100g,
          proteinPer100g: enhanced.proteinPer100g,
          carbsPer100g: enhanced.carbsPer100g,
          fatPer100g: enhanced.fatPer100g,
          weight: Math.round(f.estimatedWeight || 100),
        };
      }),
    };
  }
  
  throw new Error('Unable to process description. Please try again.');
}

