/**
 * API Services
 * 
 * Serviços para comunicação com APIs externas:
 * - Groq API (chat IA)
 * - Open Food Facts API (pesquisa de alimentos)
 */

import { getCache, setCache } from '../utils/cacheUtils';
import { FOOD_DATABASE, enhanceNutritionalValues } from './foodDatabase';
import type { Language } from '../context/LanguageContext';
import { db } from './firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, orderBy } from 'firebase/firestore';
import type { UserProfile } from '../context/UserContext';
import { getAgeFromDate } from '../utils/nutritionUtils';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

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
 * Verifica rate limit antes de operações pesadas (image analysis, barcode lookup)
 * Retorna { allowed: boolean, remaining: number, blockedUntil?: number }
 */
export async function checkRateLimitBeforeAnalysis(): Promise<{ allowed: boolean; remaining: number; blockedUntil?: number }> {
  try {
    const checkRateLimit = httpsCallable(functions, 'checkRateLimit');
    const response = await checkRateLimit({});
    return response.data as { allowed: boolean; remaining: number; blockedUntil?: number };
  } catch (error: any) {
    console.warn('Rate limit check failed (will allow operation):', error.message);
    // Em caso de erro, permitir operação (fail-open para melhor UX)
    return { allowed: true, remaining: 100 };
  }
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
      return null;
    }

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

    
    // Por enquanto, retornamos null - pode ser expandido no futuro
    // com outras APIs que não exigem chave ou com chaves configuráveis
    return null;
  } catch (error) {

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

      return null;
    }

    const url = `https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Nuti/1.0 (Android)',
      },
    });
    
    if (!response.ok) {

      return null;
    }

    const data = await response.json();

    
    if (data.status !== 1 || !data.product) {

      return null;
    }

    const product = data.product;

    
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

      return null;
    }
    


    // Verificar se é realmente um alimento (Open Food Facts já filtra, mas vamos garantir)
    const categories = product.categories || product.categories_tags || [];
    const categoryString = Array.isArray(categories) ? categories.join(' ') : String(categories);
    
    if (!isFoodProduct(productName, categoryString)) {

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
    

    
    // Se não tiver valores nutricionais, tentar buscar na base local pelo nome
    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {

      
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
  try {
    // Verificar rate limit antes de operação pesada
    const rateLimitCheck = await checkRateLimitBeforeAnalysis();
    if (!rateLimitCheck.allowed) {
      const blockedMinutes = rateLimitCheck.blockedUntil ? Math.ceil((rateLimitCheck.blockedUntil - Date.now()) / 60000) : 5;
      throw new Error(`Rate limit exceeded. Please try again in ${blockedMinutes} minutes.`);
    }

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
} catch (error: any) {
  console.error('[Barcode] Erro em getFoodByBarcode:', error);
  return null;
}

}

/**
 * Interface para mensagens do chat
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Interface para sugestão de refeição extraída da resposta da IA
 */
export interface ParsedMealSuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods?: Array<{
    name: string;
    weight: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  }>;
}

/**
 * Interface para sugestão de treino extraída da resposta da IA
 */
export interface ParsedExerciseSuggestion {
  name: string;
  type: 'running' | 'walking' | 'cycling' | 'swimming' | 'gym' | 'yoga' | 'pilates' | 'dance' | 'hiking' | 'tennis' | 'football' | 'basketball' | 'other';
  duration: number;
  calories: number;
}

/**
 * Interface para contexto do utilizador no chat
 */
export interface UserChatContext {
  profile: UserProfile;
  recentMeals: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    date: Date;
    foods?: Array<{
      name: string;
      weight: number;
      caloriesPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
    }>;
  }>;
  recentExercises: Array<{
    name: string;
    type: string;
    duration: number;
    calories: number;
    date: Date;
  }>;
  savedMeals: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  customExerciseTypes: Array<{
    name: string;
    caloriesPerHour?: number;
  }>;
  waterIntake: number; // ml
  todayCalories: number;
  todayProtein: number;
  todayCarbs: number;
  todayFat: number;
}

/**
 * Busca dados do utilizador para contexto do chat
 */
export async function getUserChatContext(userId: string): Promise<UserChatContext | null> {
  try {
    // Buscar perfil do utilizador
    const { doc, getDoc } = await import('firebase/firestore');
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    const profileData = userSnap.data();
    const profile: UserProfile = {
      id: userId,
      name: profileData.name || '',
      email: profileData.email || '',
      weight: profileData.weight,
      height: profileData.height,
      goal: profileData.goal,
      restrictions: profileData.restrictions || [],
      plan: profileData.plan || 'free',
      streak: profileData.streak || 0,
      badges: profileData.badges || [],
      createdAt: profileData.createdAt?.toDate() || new Date(),
      gender: profileData.gender,
      workoutsPerWeek: profileData.workoutsPerWeek,
      dateOfBirth: profileData.dateOfBirth?.toDate(),
      desiredWeight: profileData.desiredWeight,
      diet: profileData.diet,
      goalSpeed: profileData.goalSpeed,
      dailyCalorieGoal: profileData.dailyCalorieGoal,
      dailyProteinGoal: profileData.dailyProteinGoal,
      dailyCarbsGoal: profileData.dailyCarbsGoal,
      dailyFatGoal: profileData.dailyFatGoal,
      weightHistory: profileData.weightHistory?.map((entry: any) => ({
        weight: entry.weight,
        date: entry.date?.toDate() || new Date(),
      })) || [],
    };

    // Buscar refeições dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const mealsRef = collection(db, 'meals');
    const mealsQuery = query(
      mealsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(sevenDaysAgo)),
      orderBy('date', 'desc')
    );
    const mealsSnapshot = await getDocs(mealsQuery);
    
    const recentMeals: UserChatContext['recentMeals'] = [];
    mealsSnapshot.forEach((doc) => {
      const data = doc.data();
      recentMeals.push({
        name: data.name || '',
        calories: data.calories || 0,
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        fat: data.fat || 0,
        mealType: data.mealType || 'snack',
        date: data.date?.toDate() || new Date(),
        foods: data.foods || undefined,
      });
    });

    // Buscar treinos dos últimos 7 dias
    const exercisesRef = collection(db, 'exercises');
    const exercisesQuery = query(
      exercisesRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(sevenDaysAgo)),
      orderBy('date', 'desc')
    );
    const exercisesSnapshot = await getDocs(exercisesQuery);
    
    const recentExercises: UserChatContext['recentExercises'] = [];
    exercisesSnapshot.forEach((doc) => {
      const data = doc.data();
      recentExercises.push({
        name: data.name || '',
        type: data.type || 'other',
        duration: data.duration || 0,
        calories: data.calories || 0,
        date: data.date?.toDate() || new Date(),
      });
    });

    // Buscar refeições salvas
    const savedMealsRef = collection(db, 'savedMeals');
    const savedMealsQuery = query(
      savedMealsRef,
      where('userId', '==', userId)
    );
    const savedMealsSnapshot = await getDocs(savedMealsQuery);
    
    const savedMeals: UserChatContext['savedMeals'] = [];
    savedMealsSnapshot.forEach((doc) => {
      const data = doc.data();
      savedMeals.push({
        name: data.name || '',
        calories: data.calories || 0,
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        fat: data.fat || 0,
      });
    });

    // Buscar tipos de exercício customizados
    const customExerciseTypesRef = collection(db, 'customExerciseTypes');
    const customExerciseTypesQuery = query(
      customExerciseTypesRef,
      where('userId', '==', userId)
    );
    const customExerciseTypesSnapshot = await getDocs(customExerciseTypesQuery);
    
    const customExerciseTypes: UserChatContext['customExerciseTypes'] = [];
    customExerciseTypesSnapshot.forEach((doc) => {
      const data = doc.data();
      customExerciseTypes.push({
        name: data.name || '',
        caloriesPerHour: data.caloriesPerHour,
      });
    });

    // Buscar água consumida hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    const waterDocRef = doc(db, 'water', `${userId}_${dateStr}`);
    const waterDoc = await getDoc(waterDocRef);
    const waterIntake = waterDoc.exists() ? (waterDoc.data().amount || 0) : 0;

    // Calcular totais de hoje
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todayMealsQuery = query(
      mealsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(todayStart)),
      where('date', '<', Timestamp.fromDate(todayEnd))
    );
    const todayMealsSnapshot = await getDocs(todayMealsQuery);
    
    let todayCalories = 0;
    let todayProtein = 0;
    let todayCarbs = 0;
    let todayFat = 0;
    
    todayMealsSnapshot.forEach((doc) => {
      const data = doc.data();
      todayCalories += data.calories || 0;
      todayProtein += data.protein || 0;
      todayCarbs += data.carbs || 0;
      todayFat += data.fat || 0;
    });

    return {
      profile,
      recentMeals,
      recentExercises,
      savedMeals,
      customExerciseTypes,
      waterIntake,
      todayCalories,
      todayProtein,
      todayCarbs,
      todayFat,
    };
  } catch (error) {
    console.error('Error fetching user chat context:', error);
    return null;
  }
}

/**
 * Envia mensagem para Groq API e retorna resposta
 */
// Prompts do sistema em diferentes idiomas
const systemPrompts: Record<Language, string> = {
  pt: 'És um assistente nutricional simpático e útil do Nuti. Responde sempre em português de forma curta e amigável. Ajuda utilizadores com questões sobre nutrição, dietas e alimentação saudável. O teu objetivo é ser uma ajuda, não um bot.',
  en: 'You are a friendly and helpful nutritional assistant from Nuti. Always respond in English in a short and friendly way. Help users with questions about nutrition, diets, and healthy eating. Your goal is to be helpful, not a bot.',
  es: 'Eres un asistente nutricional amigable y útil de Nuti. Responde siempre en español de forma corta y amigable. Ayuda a los usuarios con preguntas sobre nutrición, dietas y alimentación saludable. Tu objetivo es ser útil, no un bot.',
  fr: 'Tu es un assistant nutritionnel amical et utile de Nuti. Réponds toujours en français de manière courte et amicale. Aide les utilisateurs avec des questions sur la nutrition, les régimes et l\'alimentation saine. Ton objectif est d\'être utile, pas un bot.',
  de: 'Du bist ein freundlicher und hilfreicher Ernährungsassistent von Nuti. Antworte immer auf Deutsch in kurzer und freundlicher Weise. Hilf Benutzern bei Fragen zu Ernährung, Diäten und gesunder Ernährung. Dein Ziel ist es, hilfreich zu sein, kein Bot.',
  it: 'Sei un assistente nutrizionale amichevole e utile di Nuti. Rispondi sempre in italiano in modo breve e amichevole. Aiuta gli utenti con domande su nutrizione, diete e alimentazione sana. Il tuo obiettivo è essere utile, non un bot.',
};

/**
 * Gera contexto do utilizador em formato de texto para o prompt do sistema
 */
function formatUserContext(context: UserChatContext, language: Language): string {
  const { profile, recentMeals, recentExercises, savedMeals, customExerciseTypes, waterIntake, todayCalories, todayProtein, todayCarbs, todayFat } = context;
  
  const age = profile.dateOfBirth ? getAgeFromDate(profile.dateOfBirth) : null;
  
  const translations: Record<Language, Record<string, string>> = {
    pt: {
      profile: 'Perfil do Utilizador',
      recentMeals: 'Refeições Recentes (últimos 7 dias)',
      recentExercises: 'Treinos Recentes (últimos 7 dias)',
      savedMeals: 'Refeições Salvas',
      customExercises: 'Tipos de Exercício Personalizados',
      today: 'Hoje',
      water: 'Água consumida hoje',
    },
    en: {
      profile: 'User Profile',
      recentMeals: 'Recent Meals (last 7 days)',
      recentExercises: 'Recent Workouts (last 7 days)',
      savedMeals: 'Saved Meals',
      customExercises: 'Custom Exercise Types',
      today: 'Today',
      water: 'Water consumed today',
    },
    es: {
      profile: 'Perfil del Usuario',
      recentMeals: 'Comidas Recientes (últimos 7 días)',
      recentExercises: 'Entrenamientos Recientes (últimos 7 días)',
      savedMeals: 'Comidas Guardadas',
      customExercises: 'Tipos de Ejercicio Personalizados',
      today: 'Hoy',
      water: 'Agua consumida hoy',
    },
    fr: {
      profile: 'Profil Utilisateur',
      recentMeals: 'Repas Récents (7 derniers jours)',
      recentExercises: 'Entraînements Récents (7 derniers jours)',
      savedMeals: 'Repas Enregistrés',
      customExercises: 'Types d\'Exercice Personnalisés',
      today: 'Aujourd\'hui',
      water: 'Eau consommée aujourd\'hui',
    },
    de: {
      profile: 'Benutzerprofil',
      recentMeals: 'Kürzliche Mahlzeiten (letzte 7 Tage)',
      recentExercises: 'Kürzliche Workouts (letzte 7 Tage)',
      savedMeals: 'Gespeicherte Mahlzeiten',
      customExercises: 'Benutzerdefinierte Übungstypen',
      today: 'Heute',
      water: 'Heute konsumiertes Wasser',
    },
    it: {
      profile: 'Profilo Utente',
      recentMeals: 'Pasti Recenti (ultimi 7 giorni)',
      recentExercises: 'Allenamenti Recenti (ultimi 7 giorni)',
      savedMeals: 'Pasti Salvati',
      customExercises: 'Tipi di Esercizio Personalizzati',
      today: 'Oggi',
      water: 'Acqua consumata oggi',
    },
  };
  
  const t = translations[language] || translations.en;
  
  let contextText = `\n\n${t.profile}:\n`;
  contextText += `- Nome: ${profile.name}\n`;
  if (age) contextText += `- Idade: ${age} anos\n`;
  if (profile.weight) contextText += `- Peso: ${profile.weight} kg\n`;
  if (profile.height) contextText += `- Altura: ${profile.height} cm\n`;
  if (profile.goal) contextText += `- Objetivo: ${profile.goal}\n`;
  if (profile.desiredWeight) contextText += `- Peso desejado: ${profile.desiredWeight} kg\n`;
  if (profile.goalSpeed) contextText += `- Rapidez: ${profile.goalSpeed} kg/semana\n`;
  if (profile.diet) contextText += `- Dieta: ${profile.diet}\n`;
  if (profile.workoutsPerWeek) contextText += `- Treinos por semana: ${profile.workoutsPerWeek}\n`;
  if (profile.dailyCalorieGoal) contextText += `- Meta de calorias diárias: ${profile.dailyCalorieGoal} kcal\n`;
  
  contextText += `\n${t.today}:\n`;
  contextText += `- Calorias: ${Math.round(todayCalories)}/${profile.dailyCalorieGoal || 'N/A'} kcal\n`;
  contextText += `- Proteína: ${Math.round(todayProtein)}g\n`;
  contextText += `- Carboidratos: ${Math.round(todayCarbs)}g\n`;
  contextText += `- Gordura: ${Math.round(todayFat)}g\n`;
  contextText += `- ${t.water}: ${waterIntake} ml\n`;
  
  if (recentMeals.length > 0) {
    contextText += `\n${t.recentMeals}:\n`;
    recentMeals.slice(0, 10).forEach((meal, idx) => {
      contextText += `${idx + 1}. ${meal.name} (${meal.mealType}): ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)}g P, ${Math.round(meal.carbs)}g C, ${Math.round(meal.fat)}g F\n`;
    });
  }
  
  if (recentExercises.length > 0) {
    contextText += `\n${t.recentExercises}:\n`;
    recentExercises.slice(0, 10).forEach((exercise, idx) => {
      contextText += `${idx + 1}. ${exercise.name} (${exercise.type}): ${exercise.duration} min, ${Math.round(exercise.calories)} kcal\n`;
    });
  }
  
  if (savedMeals.length > 0) {
    contextText += `\n${t.savedMeals}:\n`;
    savedMeals.slice(0, 10).forEach((meal, idx) => {
      contextText += `${idx + 1}. ${meal.name}: ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)}g P, ${Math.round(meal.carbs)}g C, ${Math.round(meal.fat)}g F\n`;
    });
  }
  
  if (customExerciseTypes.length > 0) {
    contextText += `\n${t.customExercises}:\n`;
    customExerciseTypes.forEach((type, idx) => {
      contextText += `${idx + 1}. ${type.name}${type.caloriesPerHour ? ` (${type.caloriesPerHour} kcal/h)` : ''}\n`;
    });
  }
  
  return contextText;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  userId: string,
  language: Language = 'en',
  userContext?: UserChatContext | null
): Promise<string> {
  try {
    const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    
    if (!groqApiKey) {
      throw new Error('Groq API key não configurada');
    }

    let systemPrompt = systemPrompts[language] || systemPrompts.en;
    
    // Adicionar contexto do utilizador ao system prompt se disponível
    if (userContext) {
      const contextText = formatUserContext(userContext, language);
      
      const contextInstructions: Record<Language, string> = {
        pt: `\n\nIMPORTANTE: Usa as informações do utilizador para dar conselhos personalizados. 

⚠️ REGRA CRÍTICA SOBRE A DIETA DO UTILIZADOR:
- SEMPRE respeita a dieta do utilizador (vegetariana, vegana, sem glúten, etc.)
- NUNCA sugiras ou menciones alimentos que não sejam compatíveis com a dieta do utilizador
- Se o utilizador for vegetariano, NÃO menciones carne, peixe ou outros produtos de origem animal
- Se o utilizador for vegano, NÃO menciones qualquer produto de origem animal (carne, peixe, ovos, laticínios, mel, etc.)
- Se o utilizador tiver restrições (sem glúten, sem lactose, etc.), NÃO menciones alimentos que contenham esses ingredientes
- Quando listares alimentos ou deres dicas, VERIFICA SEMPRE se cada alimento é compatível com a dieta antes de mencionar
- Se não tiveres a certeza se um alimento é compatível, NÃO o menciones
- A dieta do utilizador está indicada no contexto - USA-A SEMPRE como referência

IMPORTANTE: Só inclui blocos JSON (<NUTI_MEAL> ou <NUTI_EXERCISE>) quando estiveres a SUGERIR uma refeição ou treino específico que o utilizador possa adicionar diretamente. Para perguntas gerais, conselhos ou listas de alimentos, NÃO incluas JSON.

FORMATAÇÃO DE TEXTO:
- Quando listares alimentos, coloca cada alimento em **negrito** e organiza em lista
- Quando mencionares calorias, valores numéricos importantes ou dados do utilizador (peso, altura, objetivo, etc.), coloca em **negrito**
- Quando mencionares a dieta do utilizador (ex: "vegetariana", "vegana", "sem glúten"), coloca em **negrito** para destacar que não te esqueceste desse fator
- Usa listas organizadas quando apropriado (ex: "• **Alimento 1**\n• **Alimento 2**")

QUANDO SUGERIRES UMA REFEIÇÃO:
1. Menciona as calorias já ingeridas hoje de forma natural:
   - Se tiver 0 calorias: NÃO menciones "0 kcal" ou números. Diz algo natural como "Ainda não registaste nenhuma refeição hoje" ou "Começaste o dia sem registar refeições"
   - Se tiver calorias: menciona de forma natural (ex: "Já consumiste 1200/2000 kcal hoje" ou "Estás em 1200 das 2000 kcal diárias")
2. Se não tiver ingerido suficiente, destaca isso em **negrito** (ex: "**Ainda faltam 800 kcal para atingires o teu objetivo**")
3. Inclui o nome da refeição em **negrito** logo no início
4. Organiza a mensagem em 2-3 parágrafos bem estruturados, com uma linha em branco entre cada parágrafo
5. IMPORTANTE: Quando incluires alimentos no JSON, usa sempre os valores nutricionais do alimento COZINHADO/PREPARADO, não cru. Por exemplo:
   - Arroz cozinhado: ~130 kcal/100g (não arroz cru: ~350 kcal/100g)
   - Frango grelhado: ~165 kcal/100g (não frango cru: ~165 kcal/100g, mas o peso muda ao cozinhar)
   - Massa cozinhada: ~130 kcal/100g (não massa crua: ~350 kcal/100g)
   - O peso no JSON deve ser o peso do alimento já cozinhado/preparado
6. Inclui um bloco JSON no final com os dados

QUANDO SUGERIRES UM TREINO:
1. Se o utilizador tiver 0 calorias consumidas: NÃO menciones "0 kcal" ou números. Diz algo natural como "Ainda não registaste nenhuma refeição hoje" ou simplesmente não menciones as calorias
2. Se tiver calorias: menciona de forma natural se for relevante
3. Inclui o nome do treino em **negrito** logo no início
4. Organiza a mensagem em 2-3 parágrafos bem estruturados, com uma linha em branco entre cada parágrafo
5. Inclui um bloco JSON no final com os dados

Formato da resposta:

Para REFEIÇÕES:
<NUTI_MEAL>
{
  "name": "Nome da refeição",
  "calories": número_de_calorias,
  "protein": proteína_em_gramas,
  "carbs": carboidratos_em_gramas,
  "fat": gordura_em_gramas,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "foods": [
    {
      "name": "Nome do alimento (cozinhado/preparado)",
      "weight": peso_em_gramas_do_alimento_cozinhado,
      "caloriesPer100g": calorias_por_100g_do_alimento_cozinhado,
      "proteinPer100g": proteína_por_100g_do_alimento_cozinhado,
      "carbsPer100g": carboidratos_por_100g_do_alimento_cozinhado,
      "fatPer100g": gordura_por_100g_do_alimento_cozinhado
    }
  ]
}
IMPORTANTE: Todos os valores nutricionais e pesos devem ser do alimento COZINHADO/PREPARADO, não cru.
</NUTI_MEAL>

Para TREINOS:
<NUTI_EXERCISE>
{
  "name": "Nome do treino",
  "type": "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other",
  "duration": duração_em_minutos,
  "calories": calorias_queimadas_estimadas
}
</NUTI_EXERCISE>

Exemplo de resposta para refeição:

**Nome da Refeição**

[Mensagem sobre calorias: se 0 kcal, diz algo natural como "Ainda não registaste nenhuma refeição hoje" SEM mencionar "0 kcal". Se tiver calorias, menciona de forma natural. Se insuficiente: **Ainda faltam ZZZ kcal para atingires o teu objetivo diário.**]

Primeiro parágrafo: Descrição da refeição e benefícios nutricionais.

Segundo parágrafo: Informações sobre como esta refeição se encaixa no teu plano diário.

<NUTI_MEAL>...</NUTI_MEAL>

Exemplo de resposta para treino:

**Nome do Treino**

[Mensagem sobre calorias: se 0 kcal, NÃO menciones "0 kcal". Diz algo natural como "Ainda não registaste nenhuma refeição hoje" ou simplesmente não menciones as calorias. Se tiver calorias, menciona apenas se for relevante.]

Primeiro parágrafo: Descrição do treino e benefícios.

Segundo parágrafo: Informações sobre como este treino se encaixa no teu plano.

<NUTI_EXERCISE>...</NUTI_EXERCISE>

Exemplo de resposta para lista de alimentos:

**Alimentos Ricos em Calorias**

Considerando a tua dieta **vegetariana** e o teu objetivo de **ganhar peso**, aqui estão alguns alimentos ricos em calorias:

• **Abacate** - **250 kcal/100g**, rico em gorduras saudáveis
• **Frutos secos** - **600-700 kcal/100g**, excelente fonte de proteína e gordura
• **Azeite** - **900 kcal/100g**, perfeito para adicionar calorias saudáveis
• **Quinoa cozinhada** - **120 kcal/100g**, rico em proteína e carboidratos (nota: valores para quinoa cozinhada, não crua)

IMPORTANTE: Quando mencionares valores nutricionais, indica sempre se são para o alimento cru ou cozinhado. Prefere sempre valores do alimento cozinhado/preparado quando aplicável.

Estes alimentos são ideais para a tua dieta **vegetariana** e vão ajudar-te a atingir o teu objetivo de **ganhar peso**.`,
        en: `\n\nIMPORTANT: Use user information for personalized advice.

⚠️ CRITICAL RULE ABOUT USER'S DIET:
- ALWAYS respect the user's diet (vegetarian, vegan, gluten-free, etc.)
- NEVER suggest or mention foods that are not compatible with the user's diet
- If the user is vegetarian, do NOT mention meat, fish, or other animal products
- If the user is vegan, do NOT mention any animal products (meat, fish, eggs, dairy, honey, etc.)
- If the user has restrictions (gluten-free, lactose-free, etc.), do NOT mention foods containing those ingredients
- When listing foods or giving tips, ALWAYS check if each food is compatible with the diet before mentioning
- If you're not sure if a food is compatible, do NOT mention it
- The user's diet is indicated in the context - ALWAYS use it as a reference

IMPORTANT: Only include JSON blocks (<NUTI_MEAL> or <NUTI_EXERCISE>) when SUGGESTING a specific meal or workout that the user can add directly. For general questions, advice, or food lists, do NOT include JSON.

TEXT FORMATTING:
- When listing foods, put each food in **bold** and organize in a list
- When mentioning calories, important numeric values, or user data (weight, height, goal, etc.), put in **bold**
- When mentioning the user's diet (e.g., "vegetarian", "vegan", "gluten-free"), put in **bold** to highlight that you haven't forgotten this factor
- Use organized lists when appropriate (e.g., "• **Food 1**\n• **Food 2**")

WHEN SUGGESTING A MEAL:
1. Mention calories already consumed today in a natural way:
   - If 0 calories: say something like "You haven't logged any meals today yet" or "You started the day without logging any meals"
   - If has calories: mention naturally (e.g., "You've consumed 1200/2000 kcal today" or "You're at 1200 out of 2000 daily kcal")
2. If insufficient, highlight this in **bold** (e.g., "**You still need 800 kcal to reach your daily goal**")
3. Include the meal name in **bold** at the beginning
4. Organize the message in 2-3 well-structured paragraphs, with a blank line between each paragraph
5. IMPORTANT: When including foods in JSON, always use nutritional values for COOKED/PREPARED foods, not raw. For example:
   - Cooked rice: ~130 kcal/100g (not raw rice: ~350 kcal/100g)
   - Grilled chicken: ~165 kcal/100g (weight changes when cooked)
   - Cooked pasta: ~130 kcal/100g (not raw pasta: ~350 kcal/100g)
   - The weight in JSON should be the weight of the food already cooked/prepared
6. Include a JSON block at the end with the data

Response format:

For MEALS:
<NUTI_MEAL>
{
  "name": "Meal name",
  "calories": number_of_calories,
  "protein": protein_in_grams,
  "carbs": carbs_in_grams,
  "fat": fat_in_grams,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "foods": [
    {
      "name": "Food name",
      "weight": weight_in_grams,
      "caloriesPer100g": calories_per_100g,
      "proteinPer100g": protein_per_100g,
      "carbsPer100g": carbs_per_100g,
      "fatPer100g": fat_per_100g
    }
  ]
}
</NUTI_MEAL>

For WORKOUTS:
<NUTI_EXERCISE>
{
  "name": "Workout name",
  "type": "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other",
  "duration": duration_in_minutes,
  "calories": estimated_calories_burned
}
</NUTI_EXERCISE>

Example response for meal:

**Meal Name**

[Calories message: if 0 kcal, say something natural like "You haven't logged any meals today yet". If has calories, mention naturally. If insufficient: **You still need ZZZ kcal to reach your daily goal.**]

First paragraph: Description of the meal and nutritional benefits.

Second paragraph: Information on how this meal fits into your daily plan.

<NUTI_MEAL>...</NUTI_MEAL>

Example response for food list:

**High-Calorie Foods**

Considering your **vegetarian** diet and your goal to **gain weight**, here are some high-calorie foods:

• **Avocado** - **250 kcal/100g**, rich in healthy fats
• **Nuts** - **600-700 kcal/100g**, excellent source of protein and fat
• **Olive oil** - **900 kcal/100g**, perfect for adding healthy calories
• **Quinoa** - **368 kcal/100g**, rich in protein and carbohydrates

These foods are ideal for your **vegetarian** diet and will help you achieve your goal to **gain weight**.

Example response for workout:

**Workout Name**

[Calories message: if 0 kcal, do NOT mention "0 kcal". Say something natural like "You haven't logged any meals today yet" or simply don't mention calories. If has calories, mention only if relevant.]

First paragraph: Description of the workout and benefits.

Second paragraph: Information on how this workout fits into your plan.

<NUTI_EXERCISE>...</NUTI_EXERCISE>`,
        es: `\n\nIMPORTANTE: Usa la información del usuario para consejos personalizados.

⚠️ REGLA CRÍTICA SOBRE LA DIETA DEL USUARIO:
- SIEMPRE respeta la dieta del usuario (vegetariana, vegana, sin gluten, etc.)
- NUNCA sugieras o menciones alimentos que no sean compatibles con la dieta del usuario
- Si el usuario es vegetariano, NO menciones carne, pescado u otros productos de origen animal
- Si el usuario es vegano, NO menciones ningún producto de origen animal (carne, pescado, huevos, lácteos, miel, etc.)
- Si el usuario tiene restricciones (sin gluten, sin lactosa, etc.), NO menciones alimentos que contengan esos ingredientes
- Al listar alimentos o dar consejos, SIEMPRE verifica si cada alimento es compatible con la dieta antes de mencionarlo
- Si no estás seguro de si un alimento es compatible, NO lo menciones
- La dieta del usuario está indicada en el contexto - ÚSALA SIEMPRE como referencia

IMPORTANTE: Solo incluye bloques JSON (<NUTI_MEAL> o <NUTI_EXERCISE>) cuando estés SUGIRIENDO una comida o entrenamiento específico que el usuario pueda agregar directamente. Para preguntas generales, consejos o listas de alimentos, NO incluyas JSON.

FORMATO DE TEXTO:
- Al listar alimentos, pon cada alimento en **negrita** y organízalos en lista
- Al mencionar calorías, valores numéricos importantes o datos del usuario (peso, altura, objetivo, etc.), pon en **negrita**
- Al mencionar la dieta del usuario (ej: "vegetariana", "vegana", "sin gluten"), pon en **negrita** para destacar que no te has olvidado de ese factor
- Usa listas organizadas cuando sea apropiado (ej: "• **Alimento 1**\n• **Alimento 2**")

CUANDO SUGIERAS UNA COMIDA:
1. Menciona las calorías ya consumidas hoy de forma natural:
   - Si tiene 0 calorías: di algo como "Aún no has registrado ninguna comida hoy" o "Empezaste el día sin registrar comidas"
   - Si tiene calorías: menciona de forma natural (ej: "Ya has consumido 1200/2000 kcal hoy" o "Estás en 1200 de las 2000 kcal diarias")
2. Si no has consumido suficiente, destaca esto en **negrita** (ej: "**Aún te faltan 800 kcal para alcanzar tu objetivo**")
3. Incluye el nombre de la comida en **negrita** al inicio
4. Organiza el mensaje en 2-3 párrafos bien estructurados, con una línea en blanco entre cada párrafo
5. IMPORTANTE: Cuando incluyas alimentos en el JSON, usa siempre los valores nutricionales del alimento COCINADO/PREPARADO, no crudo. Por ejemplo:
   - Arroz cocido: ~130 kcal/100g (no arroz crudo: ~350 kcal/100g)
   - Pollo a la parrilla: ~165 kcal/100g (el peso cambia al cocinar)
   - Pasta cocida: ~130 kcal/100g (no pasta cruda: ~350 kcal/100g)
   - El peso en el JSON debe ser el peso del alimento ya cocinado/preparado
6. Incluye un bloque JSON al final con los datos

CUANDO SUGIERAS UN ENTRENAMIENTO:
1. Si el usuario tiene 0 calorías consumidas: NO menciones "0 kcal". Di algo natural como "Aún no has registrado ninguna comida hoy" o simplemente no menciones las calorías
2. Si tiene calorías: menciona de forma natural si es relevante
3. Incluye el nombre del entrenamiento en **negrita** al inicio
4. Organiza el mensaje en 2-3 párrafos bien estructurados, con una línea en blanco entre cada párrafo
5. Incluye un bloque JSON al final con los datos

Formato de la respuesta:

Para COMIDAS:
<NUTI_MEAL>
{
  "name": "Nombre de la comida",
  "calories": número_de_calorías,
  "protein": proteína_en_gramos,
  "carbs": carbohidratos_en_gramos,
  "fat": grasa_en_gramos,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "foods": [
    {
      "name": "Nombre del alimento",
      "weight": peso_en_gramos,
      "caloriesPer100g": calorías_por_100g,
      "proteinPer100g": proteína_por_100g,
      "carbsPer100g": carbohidratos_por_100g,
      "fatPer100g": grasa_por_100g
    }
  ]
}
</NUTI_MEAL>

Para ENTRENAMIENTOS:
<NUTI_EXERCISE>
{
  "name": "Nombre del entrenamiento",
  "type": "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other",
  "duration": duración_en_minutos,
  "calories": calorías_quemadas_estimadas
}
</NUTI_EXERCISE>

Ejemplo de respuesta para comida:

**Nombre de la Comida**

[Mensaje sobre calorías: si 0 kcal, di algo natural como "Aún no has registrado ninguna comida hoy". Si tiene calorías, menciona de forma natural. Si insuficiente: **Aún te faltan ZZZ kcal para alcanzar tu objetivo diario.**]

Primer párrafo: Descripción de la comida y beneficios nutricionales.

Segundo párrafo: Información sobre cómo esta comida encaja en tu plan diario.

<NUTI_MEAL>...</NUTI_MEAL>

Ejemplo de respuesta para entrenamiento:

**Nombre del Entrenamiento**

[Mensaje sobre calorías: si 0 kcal, NO menciones "0 kcal". Di algo natural como "Aún no has registrado ninguna comida hoy" o simplemente no menciones las calorías. Si tiene calorías, menciona solo si es relevante.]

Primer párrafo: Descripción del entrenamiento y beneficios.

Segundo párrafo: Información sobre cómo este entrenamiento encaja en tu plan.

<NUTI_EXERCISE>...</NUTI_EXERCISE>

Ejemplo de respuesta para lista de alimentos:

**Alimentos Ricos en Calorías**

Considerando tu dieta **vegetariana** y tu objetivo de **ganar peso**, aquí tienes algunos alimentos ricos en calorías:

• **Aguacate** - **250 kcal/100g**, rico en grasas saludables
• **Frutos secos** - **600-700 kcal/100g**, excelente fuente de proteína y grasa
• **Aceite de oliva** - **900 kcal/100g**, perfecto para añadir calorías saludables
• **Quinoa cocida** - **120 kcal/100g**, rica en proteína y carbohidratos (nota: valores para quinoa cocida, no cruda)

IMPORTANTE: Cuando menciones valores nutricionales, indica siempre si son para el alimento crudo o cocido. Prefiere siempre valores del alimento cocido/preparado cuando sea aplicable.

Estos alimentos son ideales para tu dieta **vegetariana** y te ayudarán a alcanzar tu objetivo de **ganar peso**.`,
        fr: `\n\nIMPORTANT: Utilisez les informations de l'utilisateur pour des conseils personnalisés.

⚠️ RÈGLE CRITIQUE SUR LE RÉGIME ALIMENTAIRE DE L'UTILISATEUR:
- TOUJOURS respecter le régime alimentaire de l'utilisateur (végétarien, végan, sans gluten, etc.)
- NE JAMAIS suggérer ou mentionner des aliments qui ne sont pas compatibles avec le régime de l'utilisateur
- Si l'utilisateur est végétarien, NE PAS mentionner la viande, le poisson ou d'autres produits d'origine animale
- Si l'utilisateur est végan, NE PAS mentionner aucun produit d'origine animale (viande, poisson, œufs, produits laitiers, miel, etc.)
- Si l'utilisateur a des restrictions (sans gluten, sans lactose, etc.), NE PAS mentionner des aliments contenant ces ingrédients
- Lors de la liste des aliments ou des conseils, TOUJOURS vérifier si chaque aliment est compatible avec le régime avant de le mentionner
- Si vous n'êtes pas sûr qu'un aliment soit compatible, NE PAS le mentionner
- Le régime de l'utilisateur est indiqué dans le contexte - UTILISEZ-LE TOUJOURS comme référence

⚠️ RÈGLE CRITIQUE SUR LE RÉGIME ALIMENTAIRE DE L'UTILISATEUR:
- TOUJOURS respecter le régime alimentaire de l'utilisateur (végétarien, végan, sans gluten, etc.)
- NE JAMAIS suggérer ou mentionner des aliments qui ne sont pas compatibles avec le régime de l'utilisateur
- Si l'utilisateur est végétarien, NE PAS mentionner la viande, le poisson ou d'autres produits d'origine animale
- Si l'utilisateur est végan, NE PAS mentionner aucun produit d'origine animale (viande, poisson, œufs, produits laitiers, miel, etc.)
- Si l'utilisateur a des restrictions (sans gluten, sans lactose, etc.), NE PAS mentionner des aliments contenant ces ingrédients
- Lors de la liste des aliments ou des conseils, TOUJOURS vérifier si chaque aliment est compatible avec le régime avant de le mentionner
- Si vous n'êtes pas sûr qu'un aliment soit compatible, NE PAS le mentionner
- Le régime de l'utilisateur est indiqué dans le contexte - UTILISEZ-LE TOUJOURS comme référence

IMPORTANT: N'incluez des blocs JSON (<NUTI_MEAL> ou <NUTI_EXERCISE>) que lorsque vous SUGGÉREZ un repas ou un entraînement spécifique que l'utilisateur peut ajouter directement. Pour les questions générales, conseils ou listes d'aliments, N'incluez PAS de JSON.

FORMATAGE DE TEXTE:
- Lors de la liste des aliments, mettez chaque aliment en **gras** et organisez en liste
- Lors de la mention des calories, valeurs numériques importantes ou données de l'utilisateur (poids, taille, objectif, etc.), mettez en **gras**
- Lors de la mention du régime de l'utilisateur (ex: "végétarien", "végan", "sans gluten"), mettez en **gras** pour souligner que vous n'avez pas oublié ce facteur
- Utilisez des listes organisées lorsque approprié (ex: "• **Aliment 1**\n• **Aliment 2**")

LORSQUE VOUS SUGGÉREZ UN REPAS:
1. Mentionnez les calories déjà consommées aujourd'hui de manière naturelle:
   - Si 0 calories: dites quelque chose comme "Vous n'avez pas encore enregistré de repas aujourd'hui" ou "Vous avez commencé la journée sans enregistrer de repas"
   - Si a des calories: mentionnez naturellement (ex: "Vous avez déjà consommé 1200/2000 kcal aujourd'hui" ou "Vous êtes à 1200 sur 2000 kcal quotidiennes")
2. Si insuffisant, mettez cela en **gras** (ex: "**Il vous manque encore 800 kcal pour atteindre votre objectif**")
3. Incluez le nom du repas en **gras** au début
4. Organisez le message en 2-3 paragraphes bien structurés, avec une ligne vide entre chaque paragraphe
5. IMPORTANT: Lors de l'inclusion d'aliments dans le JSON, utilisez toujours les valeurs nutritionnelles des aliments CUITS/PRÉPARÉS, pas crus. Par exemple:
   - Riz cuit: ~130 kcal/100g (pas riz cru: ~350 kcal/100g)
   - Poulet grillé: ~165 kcal/100g (le poids change à la cuisson)
   - Pâtes cuites: ~130 kcal/100g (pas pâtes crues: ~350 kcal/100g)
   - Le poids dans le JSON doit être le poids de l'aliment déjà cuit/préparé
6. Incluez un bloc JSON à la fin avec les données

LORSQUE VOUS SUGGÉREZ UN ENTRAÎNEMENT:
1. Si l'utilisateur a 0 calories consommées: NE mentionnez PAS "0 kcal". Dites quelque chose de naturel comme "Vous n'avez pas encore enregistré de repas aujourd'hui" ou ne mentionnez simplement pas les calories
2. Si a des calories: mentionnez de manière naturelle si pertinent
3. Incluez le nom de l'entraînement en **gras** au début
4. Organisez le message en 2-3 paragraphes bien structurés, avec une ligne vide entre chaque paragraphe
5. Incluez un bloc JSON à la fin avec les données

Format de la réponse:

Pour les REPAS:
<NUTI_MEAL>
{
  "name": "Nom du repas",
  "calories": nombre_de_calories,
  "protein": protéines_en_grammes,
  "carbs": glucides_en_grammes,
  "fat": graisses_en_grammes,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "foods": [
    {
      "name": "Nom de l'aliment",
      "weight": poids_en_grammes,
      "caloriesPer100g": calories_par_100g,
      "proteinPer100g": protéines_par_100g,
      "carbsPer100g": glucides_par_100g,
      "fatPer100g": graisses_par_100g
    }
  ]
}
</NUTI_MEAL>

Pour les ENTRENAMENTS:
<NUTI_EXERCISE>
{
  "name": "Nom de l'entraînement",
  "type": "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other",
  "duration": durée_en_minutes,
  "calories": calories_brûlées_estimées
}
</NUTI_EXERCISE>

Exemple de réponse pour repas:

**Nom du Repas**

[Message sur les calories: si 0 kcal, dites quelque chose de naturel comme "Vous n'avez pas encore enregistré de repas aujourd'hui". Si a des calories, mentionnez naturellement. Si insuffisant: **Il vous manque encore ZZZ kcal pour atteindre votre objectif quotidien.**]

Premier paragraphe: Description du repas et avantages nutritionnels.

Deuxième paragraphe: Informations sur la façon dont ce repas s'intègre dans votre plan quotidien.

<NUTI_MEAL>...</NUTI_MEAL>

Exemple de réponse pour entraînement:

**Nom de l'Entraînement**

[Message sur les calories: si 0 kcal, NE mentionnez PAS "0 kcal". Dites quelque chose de naturel comme "Vous n'avez pas encore enregistré de repas aujourd'hui" ou ne mentionnez simplement pas les calories. Si a des calories, mentionnez uniquement si pertinent.]

Premier paragraphe: Description de l'entraînement et avantages.

Deuxième paragraphe: Informations sur la façon dont cet entraînement s'intègre dans votre plan.

<NUTI_EXERCISE>...</NUTI_EXERCISE>

Exemple de réponse pour liste d'aliments:

**Aliments Riches en Calories**

En tenant compte de votre régime **végétarien** et de votre objectif de **prendre du poids**, voici quelques aliments riches en calories:

• **Avocat** - **250 kcal/100g**, riche en graisses saines
• **Fruits secs** - **600-700 kcal/100g**, excellente source de protéines et de graisses
• **Huile d'olive** - **900 kcal/100g**, parfait pour ajouter des calories saines
• **Quinoa cuite** - **120 kcal/100g**, riche en protéines et glucides (note: valeurs pour quinoa cuite, pas crue)

IMPORTANT: Lors de la mention des valeurs nutritionnelles, indiquez toujours si elles sont pour l'aliment cru ou cuit. Préférez toujours les valeurs de l'aliment cuit/préparé lorsque applicable.

Ces aliments sont idéaux pour votre régime **végétarien** et vous aideront à atteindre votre objectif de **prendre du poids**.`,
        de: `\n\nWICHTIG: Verwenden Sie Benutzerinformationen für personalisierte Ratschläge.

⚠️ KRITISCHE REGEL ÜBER DIE ERNÄHRUNG DES BENUTZERS:
- IMMER die Ernährung des Benutzers respektieren (vegetarisch, vegan, glutenfrei, etc.)
- NIEMALS Lebensmittel vorschlagen oder erwähnen, die nicht mit der Ernährung des Benutzers kompatibel sind
- Wenn der Benutzer Vegetarier ist, KEIN Fleisch, Fisch oder andere tierische Produkte erwähnen
- Wenn der Benutzer Veganer ist, KEINE tierischen Produkte erwähnen (Fleisch, Fisch, Eier, Milchprodukte, Honig, etc.)
- Wenn der Benutzer Einschränkungen hat (glutenfrei, laktosefrei, etc.), KEINE Lebensmittel erwähnen, die diese Zutaten enthalten
- Beim Auflisten von Lebensmitteln oder beim Geben von Tipps IMMER prüfen, ob jedes Lebensmittel mit der Ernährung kompatibel ist, bevor es erwähnt wird
- Wenn Sie sich nicht sicher sind, ob ein Lebensmittel kompatibel ist, es NICHT erwähnen
- Die Ernährung des Benutzers ist im Kontext angegeben - VERWENDEN SIE SIE IMMER als Referenz

WICHTIG: Fügen Sie JSON-Blöcke (<NUTI_MEAL> oder <NUTI_EXERCISE>) nur ein, wenn Sie eine spezifische Mahlzeit oder ein Workout VORSCHLAGEN, das der Benutzer direkt hinzufügen kann. Für allgemeine Fragen, Ratschläge oder Lebensmittellisten fügen Sie KEIN JSON ein.

TEXTFORMATIERUNG:
- Beim Auflisten von Lebensmitteln setzen Sie jedes Lebensmittel in **Fettdruck** und organisieren Sie es in einer Liste
- Beim Erwähnen von Kalorien, wichtigen numerischen Werten oder Benutzerdaten (Gewicht, Größe, Ziel, etc.) setzen Sie in **Fettdruck**
- Beim Erwähnen der Ernährung des Benutzers (z.B. "vegetarisch", "vegan", "glutenfrei") setzen Sie in **Fettdruck**, um hervorzuheben, dass Sie diesen Faktor nicht vergessen haben
- Verwenden Sie organisierte Listen, wenn angemessen (z.B. "• **Lebensmittel 1**\n• **Lebensmittel 2**")

WENN SIE EINE MAHLZEIT VORSCHLAGEN:
1. Erwähnen Sie die heute bereits verbrauchten Kalorien auf natürliche Weise:
   - Wenn 0 Kalorien: sagen Sie etwas wie "Sie haben heute noch keine Mahlzeiten protokolliert" oder "Sie haben den Tag ohne Protokollierung von Mahlzeiten begonnen"
   - Wenn Kalorien vorhanden: erwähnen Sie natürlich (z.B. "Sie haben heute bereits 1200/2000 kcal verbraucht" oder "Sie sind bei 1200 von 2000 täglichen kcal")
2. Wenn unzureichend, heben Sie dies in **Fettdruck** hervor (z.B. "**Sie benötigen noch 800 kcal, um Ihr Tagesziel zu erreichen**")
3. Fügen Sie den Namen der Mahlzeit in **Fettdruck** am Anfang hinzu
4. Organisieren Sie die Nachricht in 2-3 gut strukturierten Absätzen, mit einer leeren Zeile zwischen jedem Absatz
5. WICHTIG: Beim Einbeziehen von Lebensmitteln in JSON verwenden Sie immer die Nährwerte von GEKOCHTEN/ZUBEREITETEN Lebensmitteln, nicht roh. Zum Beispiel:
   - Gekochter Reis: ~130 kcal/100g (nicht roher Reis: ~350 kcal/100g)
   - Gegrilltes Huhn: ~165 kcal/100g (Gewicht ändert sich beim Kochen)
   - Gekochte Nudeln: ~130 kcal/100g (nicht rohe Nudeln: ~350 kcal/100g)
   - Das Gewicht im JSON sollte das Gewicht des bereits gekochten/zubreiteten Lebensmittels sein
6. Fügen Sie am Ende einen JSON-Block mit den Daten hinzu

WENN SIE EIN WORKOUT VORSCHLAGEN:
1. Wenn der Benutzer 0 verbrauchte Kalorien hat: erwähnen Sie NICHT "0 kcal". Sagen Sie etwas Natürliches wie "Sie haben heute noch keine Mahlzeiten protokolliert" oder erwähnen Sie einfach nicht die Kalorien
2. Wenn Kalorien vorhanden: erwähnen Sie natürlich, wenn relevant
3. Fügen Sie den Namen des Workouts in **Fettdruck** am Anfang hinzu
4. Organisieren Sie die Nachricht in 2-3 gut strukturierten Absätzen, mit einer leeren Zeile zwischen jedem Absatz
5. Fügen Sie am Ende einen JSON-Block mit den Daten hinzu

Antwortformat:

Für MAHLZEITEN:
<NUTI_MEAL>
{
  "name": "Name der Mahlzeit",
  "calories": anzahl_der_kalorien,
  "protein": protein_in_gramm,
  "carbs": kohlenhydrate_in_gramm,
  "fat": fett_in_gramm,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "foods": [
    {
      "name": "Name des Lebensmittels",
      "weight": gewicht_in_gramm,
      "caloriesPer100g": kalorien_pro_100g,
      "proteinPer100g": protein_pro_100g,
      "carbsPer100g": kohlenhydrate_pro_100g,
      "fatPer100g": fett_pro_100g
    }
  ]
}
</NUTI_MEAL>

Für WORKOUTS:
<NUTI_EXERCISE>
{
  "name": "Name des Workouts",
  "type": "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other",
  "duration": dauer_in_minuten,
  "calories": geschätzte_verbrannte_kalorien
}
</NUTI_EXERCISE>

Beispielantwort für Mahlzeit:

**Name der Mahlzeit**

Sie haben heute bereits X/YYYY kcal verbraucht. [Wenn unzureichend: **Sie benötigen noch ZZZ kcal, um Ihr Tagesziel zu erreichen.**]

Erster Absatz: Beschreibung der Mahlzeit und Nährwertvorteile.

Zweiter Absatz: Informationen darüber, wie diese Mahlzeit in Ihren Tagesplan passt.

<NUTI_MEAL>...</NUTI_MEAL>

Beispielantwort für Workout:

**Name des Workouts**

[Kaloriennachricht: wenn 0 kcal, erwähnen Sie NICHT "0 kcal". Sagen Sie etwas Natürliches wie "Sie haben heute noch keine Mahlzeiten protokolliert" oder erwähnen Sie einfach nicht die Kalorien. Wenn Kalorien vorhanden, erwähnen Sie nur, wenn relevant.]

Erster Absatz: Beschreibung des Workouts und Vorteile.

Zweiter Absatz: Informationen darüber, wie dieses Workout in Ihren Plan passt.

<NUTI_EXERCISE>...</NUTI_EXERCISE>

Beispielantwort für Lebensmittelliste:

**Kalorienreiche Lebensmittel**

Unter Berücksichtigung Ihrer **vegetarischen** Ernährung und Ihres Ziels, **Gewicht zuzunehmen**, hier sind einige kalorienreiche Lebensmittel:

• **Avocado** - **250 kcal/100g**, reich an gesunden Fetten
• **Nüsse** - **600-700 kcal/100g**, ausgezeichnete Quelle für Protein und Fett
• **Olivenöl** - **900 kcal/100g**, perfekt zum Hinzufügen gesunder Kalorien
• **Gekochte Quinoa** - **120 kcal/100g**, reich an Protein und Kohlenhydraten (Hinweis: Werte für gekochte Quinoa, nicht roh)

WICHTIG: Beim Erwähnen von Nährwerten geben Sie immer an, ob sie für das rohe oder gekochte Lebensmittel sind. Bevorzugen Sie immer Werte des gekochten/zubreiteten Lebensmittels, wenn anwendbar.

Diese Lebensmittel sind ideal für Ihre **vegetarische** Ernährung und helfen Ihnen, Ihr Ziel zu erreichen, **Gewicht zuzunehmen**.`,
        it: `\n\nIMPORTANTE: Hai accesso alle seguenti informazioni dell'utente. Usale per dare consigli personalizzati e precisi. Quando suggerisci ricette, considera la dieta dell'utente e le calorie già consumate oggi. Quando suggerisci allenamenti, considera i tipi di esercizio che l'utente ha già salvato.

⚠️ REGOLA CRITICA SULLA DIETA DELL'UTENTE:
- RISPETTA SEMPRE la dieta dell'utente (vegetariana, vegana, senza glutine, etc.)
- NON suggerire o menzionare MAI alimenti che non sono compatibili con la dieta dell'utente
- Se l'utente è vegetariano, NON menzionare carne, pesce o altri prodotti di origine animale
- Se l'utente è vegano, NON menzionare alcun prodotto di origine animale (carne, pesce, uova, latticini, miele, etc.)
- Se l'utente ha restrizioni (senza glutine, senza lattosio, etc.), NON menzionare alimenti che contengono questi ingredienti
- Quando elenchi alimenti o dai consigli, VERIFICA SEMPRE se ogni alimento è compatibile con la dieta prima di menzionarlo
- Se non sei sicuro che un alimento sia compatibile, NON menzionarlo
- La dieta dell'utente è indicata nel contesto - USALA SEMPRE come riferimento

QUANDO SUGGERISCI UN PASTO O UN ALLENAMENTO, includi un blocco JSON strutturato alla fine della tua risposta con i dati. Formato:

Per i PASTI:
<NUTI_MEAL>
{
  "name": "Nome del pasto",
  "calories": numero_di_calorie,
  "protein": proteine_in_grammi,
  "carbs": carboidrati_in_grammi,
  "fat": grassi_in_grammi,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "foods": [
    {
      "name": "Nome dell'alimento (cotto/preparato)",
      "weight": peso_in_grammi_dell_alimento_cotto,
      "caloriesPer100g": calorie_per_100g_dell_alimento_cotto,
      "proteinPer100g": proteine_per_100g_dell_alimento_cotto,
      "carbsPer100g": carboidrati_per_100g_dell_alimento_cotto,
      "fatPer100g": grassi_per_100g_dell_alimento_cotto
    }
  ]
}
IMPORTANTE: Tutti i valori nutrizionali e i pesi devono essere dell'alimento COTTO/PREPARATO, non crudo.
</NUTI_MEAL>

Per gli ALLENAMENTI:
<NUTI_EXERCISE>
{
  "name": "Nome dell'allenamento",
  "type": "running" | "walking" | "cycling" | "swimming" | "gym" | "yoga" | "pilates" | "dance" | "hiking" | "tennis" | "football" | "basketball" | "other",
  "duration": durata_in_minuti,
  "calories": calorie_bruciate_stimate
}
</NUTI_EXERCISE>

Esempio di risposta per pasto:

**Nome del Pasto**

[Messaggio sulle calorie: se 0 kcal, di qualcosa di naturale come "Non hai ancora registrato nessun pasto oggi" SENZA menzionare "0 kcal". Se ha calorie, menziona in modo naturale. Se insufficiente: **Ti mancano ancora ZZZ kcal per raggiungere il tuo obiettivo giornaliero.**]

Primo paragrafo: Descrizione del pasto e benefici nutrizionali.

Secondo paragrafo: Informazioni su come questo pasto si adatta al tuo piano giornaliero.

<NUTI_MEAL>...</NUTI_MEAL>

Esempio di risposta per allenamento:

**Nome dell'Allenamento**

[Messaggio sulle calorie: se 0 kcal, NON menzionare "0 kcal". Di qualcosa di naturale come "Non hai ancora registrato nessun pasto oggi" o semplicemente non menzionare le calorie. Se ha calorie, menziona solo se rilevante.]

Primo paragrafo: Descrizione dell'allenamento e benefici.

Secondo paragrafo: Informazioni su come questo allenamento si adatta al tuo piano.

<NUTI_EXERCISE>...</NUTI_EXERCISE>

Esempio di risposta per lista di alimenti:

**Alimenti Ricchi di Calorie**

Considerando la tua dieta **vegetariana** e il tuo obiettivo di **aumentare di peso**, ecco alcuni alimenti ricchi di calorie:

• **Avocado** - **250 kcal/100g**, ricco di grassi sani
• **Frutta secca** - **600-700 kcal/100g**, eccellente fonte di proteine e grassi
• **Olio d'oliva** - **900 kcal/100g**, perfetto per aggiungere calorie sane
• **Quinoa cotta** - **120 kcal/100g**, ricca di proteine e carboidrati (nota: valori per quinoa cotta, non cruda)

IMPORTANTE: Quando menzioni valori nutrizionali, indica sempre se sono per l'alimento crudo o cotto. Preferisci sempre valori dell'alimento cotto/preparato quando applicabile.

Questi alimenti sono ideali per la tua dieta **vegetariana** e ti aiuteranno a raggiungere il tuo obiettivo di **aumentare di peso**.`,
      };
      
      systemPrompt += contextInstructions[language] || contextInstructions.en;
      systemPrompt += contextText;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1000, // Aumentado para permitir respostas mais detalhadas
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
 * Transcreve áudio para texto usando Groq API (Whisper)
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  try {
    const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
    
    if (!groqApiKey) {
      throw new Error('Groq API key não configurada');
    }

    // Converter URI para FormData (React Native)
    const formData = new FormData();
    
    // Formato correto para React Native
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as any);
    
    formData.append('model', 'whisper-large-v3');
    // Não especificar language para transcrever no idioma original (não traduzir)

    const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        // Não definir Content-Type - o fetch vai definir automaticamente com boundary
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorData = await transcriptionResponse.json().catch(() => ({ error: { message: 'Erro desconhecido' } }));
      throw new Error(errorData.error?.message || 'Erro ao transcrever áudio');
    }

    const data = await transcriptionResponse.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    throw new Error(error.message || 'Erro ao transcrever áudio');
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
    // Verificar rate limit antes de operação pesada
    const rateLimitCheck = await checkRateLimitBeforeAnalysis();
    if (!rateLimitCheck.allowed) {
      const blockedMinutes = rateLimitCheck.blockedUntil ? Math.ceil((rateLimitCheck.blockedUntil - Date.now()) / 60000) : 5;
      throw new Error(`Rate limit exceeded. Please try again in ${blockedMinutes} minutes. (${rateLimitCheck.remaining} operations remaining)`);
    }
    
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

### IDENTITY & GOAL:
You are the Nuti AI Vision Engine. Your goal is to identify food items and provide highly accurate nutritional estimates based on standard serving sizes and visual density.

### STEP 1: VALIDATION
- If the image does NOT contain food (e.g., person, object, text, blurry mess), respond ONLY with: {"error": "This image does not contain food. Please upload a clear photo of your meal."}

### STEP 2: NUTRITIONAL ANALYSIS RULES
- LANGUAGE: Provide "plateName" and "name" in ${language === 'pt' ? 'Portuguese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'it' ? 'Italian' : 'English'}.
- CONSERVATIVE ESTIMATION: When in doubt, use standard portions. Do not overestimate.
- SCALE & CROPPING: If the image is cropped or lacks a reference (like cutlery), assume a standard 26cm dinner plate and apply "Standard Adult Servings":
    * Proteins (meat/fish/eggs): 120g-150g
    * Carbs (rice/pasta/bread): 150g-200g
    * Beans/legumes: 100g-130g
    * Vegetables/salad: 50g-80g
    * Sauces/condiments: 20g-30g
- HIDDEN FATS: If food looks shiny, fried, or has visible oil, increase "fatPer100g" to account for cooking oils/butter/dressing.
- PRECISION ANCHORS (Reference values per 100g cooked, unless specified):
    * Arroz Branco (white rice): 130 kcal, 2.7g protein, 28g carbs, 0.3g fat, 0.4g fiber
    * Frango Grelhado (grilled chicken): 165 kcal, 31g protein, 0g carbs, 3.6g fat, 0g fiber
    * Frango Frito (fried chicken): 239 kcal, 25g protein, 8g carbs, 13g fat, 0g fiber
    * Feijão Preto (black beans): 132 kcal, 8.9g protein, 24g carbs, 0.5g fat, 7.5g fiber
    * Carne Bovina Magra (lean beef): 250 kcal, 26g protein, 0g carbs, 15g fat, 0g fiber
    * Carne Bovina Gorda (fatty beef): 291 kcal, 26g protein, 0g carbs, 20g fat, 0g fiber
    * Massa Cozida (cooked pasta): 131 kcal, 5g protein, 25g carbs, 1.1g fat, 1.8g fiber
    * Batata Frita (french fries): 312 kcal, 3.4g protein, 41g carbs, 15g fat, 3.8g fiber
    * Ovo Frito (fried egg): 196 kcal, 13.6g protein, 1.1g carbs, 14.8g fat, 0g fiber
    * Ovo Cozido (boiled egg): 155 kcal, 13g protein, 1.1g carbs, 11g fat, 0g fiber
    * Tomate Cru (raw tomato): 18 kcal, 0.9g protein, 3.9g carbs, 0.2g fat, 1.2g fiber
    * Alface (lettuce): 15 kcal, 1.4g protein, 2.9g carbs, 0.2g fat, 1.3g fiber
    * Batata Cozida (boiled potato): 87 kcal, 2g protein, 20g carbs, 0.1g fat, 1.8g fiber
    * Pão Branco (white bread): 265 kcal, 9g protein, 49g carbs, 3.2g fat, 2.7g fiber
- For vegetables and salads, use LOW calorie values (15-30 kcal per 100g typically).
- For other foods not listed, use scientifically accurate values from USDA or TACO food composition databases.

### STEP 3: WEIGHT ESTIMATION RULES
- Estimate weight REALISTICALLY and INDIVIDUALLY for each food based on what you ACTUALLY SEE:
  * Small portion of rice: 80-100g | Normal: 150-180g | Large: 200-250g
  * Small piece of meat: 80-100g | Normal: 120-150g | Large: 180-250g
  * Vegetables/salad: Usually 50-100g depending on volume
  * DO NOT use the same weight for all items - vary based on VISUAL SIZE
  * If image is cropped tight or lacks reference, assume standard servings (see Step 2)
  * CONSERVATIVE BIAS: When in doubt, use SMALLER weights to avoid overestimating calories

### STEP 4: OUTPUT FORMAT
Respond ONLY with valid JSON (no markdown blocks, no extra text):

{
  "plateName": "Nome descritivo completo do prato",
  "totalEstimatedCalories": total_sum_of_all_foods,
  "foods": [
    {
      "name": "Nome do alimento individual",
      "estimatedWeight": weight_in_grams,
      "caloriesPer100g": kcal,
      "proteinPer100g": g,
      "carbsPer100g": g,
      "fatPer100g": g,
      "fiberPer100g": g,
      "sugarsPer100g": g (optional, 0 if not applicable),
      "sodiumPer100g": mg (optional, 0 if not applicable),
      "saturatedFatPer100g": g (optional, 0 if not applicable),
      "transFatPer100g": g (optional, 0 if not applicable),
      "confidenceLevel": "high/medium/low"
    }
  ]
}

### CRITICAL CONSTRAINTS:
1. NO markdown code blocks - return raw JSON only (no triple backticks).
2. Every separate item (rice, steak, tomato, sauce, etc.) must be its own object in the "foods" array.
3. If an item is a complex mix, break it down into components OR use verified average values for that specific dish.
4. "confidenceLevel" should be:
   - "high": Clear image, standard portions, recognizable foods
   - "medium": Slightly blurry or cropped, but identifiable
   - "low": Very cropped, blurry, unusual angle, or hard to identify
5. "totalEstimatedCalories" = sum of (estimatedWeight × caloriesPer100g ÷ 100) for all foods.
6. Only respond with valid JSON, no additional text before or after.`
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

/**
 * Adiciona uma refeição através do chat
 * Esta função é chamada quando a IA sugere uma refeição e o utilizador quer adicioná-la
 */
export async function addMealFromChat(
  userId: string,
  mealName: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack',
  foods?: Array<{
    name: string;
    weight: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  }>
): Promise<string> {
  try {
    const mealDate = new Date();
    const addedAt = new Date();

    const mealData: any = {
      userId,
      name: mealName,
      calories: Math.round(calories),
      protein: parseFloat(protein.toFixed(1)),
      carbs: parseFloat(carbs.toFixed(1)),
      fat: parseFloat(fat.toFixed(1)),
      mealType,
      date: Timestamp.fromDate(mealDate),
      addedAt: Timestamp.fromDate(addedAt),
    };

    if (foods && foods.length > 0) {
      mealData.foods = foods;
    }

    const docRef = await addDoc(collection(db, 'meals'), mealData);
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding meal from chat:', error);
    throw new Error(error.message || 'Erro ao adicionar refeição');
  }
}

/**
 * Adiciona um treino através do chat
 * Esta função é chamada quando a IA sugere um treino e o utilizador quer adicioná-lo
 */
export async function addExerciseFromChat(
  userId: string,
  exerciseName: string,
  exerciseType: string,
  duration: number,
  calories: number = 0,
  date?: Date,
  additionalFields?: Record<string, any>
): Promise<string> {
  try {
    const exerciseDate = date || new Date();
    exerciseDate.setHours(0, 0, 0, 0);
    const addedAt = new Date();

    const exerciseData: any = {
      userId,
      type: exerciseType,
      name: exerciseName,
      duration: Math.round(duration),
      calories: Math.round(calories),
      date: Timestamp.fromDate(exerciseDate),
      addedAt: Timestamp.fromDate(addedAt),
    };

    // Adicionar campos adicionais se fornecidos
    if (additionalFields) {
      Object.keys(additionalFields).forEach(key => {
        const value = additionalFields[key];
        if (value !== undefined && value !== null && value !== '') {
          exerciseData[key] = value;
        }
      });
    }

    const docRef = await addDoc(collection(db, 'exercises'), exerciseData);
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding exercise from chat:', error);
    throw new Error(error.message || 'Erro ao adicionar treino');
  }
}

/**
 * Extrai sugestão de refeição da resposta da IA
 */
export function parseMealSuggestion(response: string): ParsedMealSuggestion | null {
  try {
    // Procurar por <NUTI_MEAL>...</NUTI_MEAL> (case-insensitive, multiline)
    const mealMatch = response.match(/<NUTI_MEAL>([\s\S]*?)<\/NUTI_MEAL>/i);
    if (!mealMatch) {
      return null;
    }

    let jsonStr = mealMatch[1].trim();
    
    // Remover markdown code blocks se existirem
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Limpar texto antes e depois do JSON (caso a IA tenha adicionado explicações)
    // Procurar pelo primeiro { e último }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      // Se não encontrar chaves, tentar procurar por JSON em qualquer lugar
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        return null;
      }
    } else {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
    
    // Limpar caracteres problemáticos comuns
    // Remover BOM e outros caracteres invisíveis no início
    jsonStr = jsonStr.replace(/^\uFEFF/, '').replace(/^[\u200B-\u200D\uFEFF]/, '');
    
    // Remover comentários de linha se existirem (não são válidos em JSON)
    jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
    
    // CORREÇÃO CRÍTICA: Remover unidades (g, kg, ml, l, kcal, cal) dos valores numéricos
    // A IA pode retornar "40g" em vez de 40, o que invalida o JSON
    // Padrão 1: ": 40g," ou ": 40g}" -> ": 40," ou ": 40}"
    jsonStr = jsonStr.replace(/:\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)\s*([,}])/gi, ':$1$3');
    // Padrão 2: Valores em arrays ou no meio de objetos: "100g," ou "100g}" -> "100," ou "100}"
    jsonStr = jsonStr.replace(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)\s*([,}\]])/gi, '$1$3');
    // Padrão 3: Valores no final de linhas (antes de quebra de linha): "40g\n" -> "40\n"
    jsonStr = jsonStr.replace(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)\s*(\n)/gi, '$1$3');
    // Padrão 4: Valores seguidos de espaço e depois vírgula/chave (caso mais comum): "100g ," -> "100 ,"
    jsonStr = jsonStr.replace(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)\s+([,}])/gi, '$1$3');
    // Padrão 5: Qualquer número seguido de unidade (fallback mais agressivo)
    jsonStr = jsonStr.replace(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)(?=\s*[,}\n])/gi, '$1');
    
    // Tentar parsear o JSON
    let mealData: any;
    try {
      mealData = JSON.parse(jsonStr);
    } catch (parseError: any) {
      // Tentar corrigir problemas comuns
      // Remover trailing commas antes de }
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      
      // Tentar novamente
        try {
          mealData = JSON.parse(jsonStr);
        } catch (secondError: any) {
          // Última tentativa: procurar por qualquer JSON válido no texto
        const jsonMatches = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
        if (jsonMatches && jsonMatches.length > 0) {
            try {
              mealData = JSON.parse(jsonMatches[0]);
            } catch (thirdError) {
              return null;
            }
        } else {
          return null;
        }
      }
    }

    // Validar campos obrigatórios
    if (!mealData.name || typeof mealData.calories !== 'number' || !mealData.mealType) {
      return null;
    }

    return {
      name: String(mealData.name).trim(),
      calories: Math.round(Number(mealData.calories) || 0),
      protein: parseFloat((Number(mealData.protein) || 0).toFixed(1)),
      carbs: parseFloat((Number(mealData.carbs) || 0).toFixed(1)),
      fat: parseFloat((Number(mealData.fat) || 0).toFixed(1)),
      mealType: mealData.mealType,
      foods: mealData.foods || undefined,
    };
  } catch (error) {
    console.error('Error parsing meal suggestion:', error);
    return null;
  }
}

/**
 * Extrai sugestão de treino da resposta da IA
 */
export function parseExerciseSuggestion(response: string): ParsedExerciseSuggestion | null {
  try {
    // Procurar por <NUTI_EXERCISE>...</NUTI_EXERCISE> (case-insensitive, multiline)
    const exerciseMatch = response.match(/<NUTI_EXERCISE>([\s\S]*?)<\/NUTI_EXERCISE>/i);
    if (!exerciseMatch) {
      return null;
    }

    let jsonStr = exerciseMatch[1].trim();
    
    // Remover markdown code blocks se existirem
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Limpar texto antes e depois do JSON (caso a IA tenha adicionado explicações)
    // Procurar pelo primeiro { e último }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      // Se não encontrar chaves, tentar procurar por JSON em qualquer lugar
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        return null;
      }
    } else {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
    
    // Limpar caracteres problemáticos comuns
    // Remover BOM e outros caracteres invisíveis no início
    jsonStr = jsonStr.replace(/^\uFEFF/, '').replace(/^[\u200B-\u200D\uFEFF]/, '');
    
    // Remover comentários de linha se existirem (não são válidos em JSON)
    jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
    
    // CORREÇÃO CRÍTICA: Remover unidades (g, kg, ml, l, kcal, cal) dos valores numéricos
    // A IA pode retornar "40g" em vez de 40, o que invalida o JSON
    jsonStr = jsonStr.replace(/:\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)\s*([,}])/gi, ':$1$3');
    jsonStr = jsonStr.replace(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|kcal|cal)\s*([,}\]])/gi, '$1$3');
    
    // Tentar parsear o JSON
    let exerciseData: any;
    try {
      exerciseData = JSON.parse(jsonStr);
    } catch (parseError: any) {
      // Tentar corrigir problemas comuns
      // Remover trailing commas antes de }
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      
      // Tentar novamente
        try {
          exerciseData = JSON.parse(jsonStr);
        } catch (secondError: any) {
          // Última tentativa: procurar por qualquer JSON válido no texto
        const jsonMatches = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
        if (jsonMatches && jsonMatches.length > 0) {
          try {
            exerciseData = JSON.parse(jsonMatches[0]);
          } catch (thirdError) {
            return null;
        }
        } else {
          return null;
        }
      }
    }

    // Validar campos obrigatórios
    if (!exerciseData.name || typeof exerciseData.duration !== 'number' || !exerciseData.type) {
      return null;
    }

    return {
      name: String(exerciseData.name).trim(),
      type: exerciseData.type,
      duration: Math.round(Number(exerciseData.duration) || 0),
      calories: Math.round(Number(exerciseData.calories) || 0),
    };
  } catch (error) {
    console.error('Error parsing exercise suggestion:', error);
    return null;
  }
}

/**
 * Remove blocos de sugestão da resposta da IA para exibição
 */
export function cleanResponseForDisplay(response: string): string {
  // Remover blocos <NUTI_MEAL> e <NUTI_EXERCISE> (case-insensitive, multiline)
  // Estes blocos já foram parseados antes de chamar esta função
  let cleaned = response
    .replace(/<NUTI_MEAL>[\s\S]*?<\/NUTI_MEAL>/gi, '')
    .replace(/<NUTI_EXERCISE>[\s\S]*?<\/NUTI_EXERCISE>/gi, '');
  
  // Normalizar quebras de linha: manter uma linha vazia entre parágrafos
  // Remover múltiplas quebras de linha consecutivas (mais de 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remover espaços no final de cada linha
  cleaned = cleaned.replace(/\s+$/gm, '');
  
  // Remover espaços em branco no início e fim
  cleaned = cleaned.trim();
  
  // Remover linhas vazias no final do texto
  cleaned = cleaned.replace(/\n+$/, '');
  
  return cleaned;
}

