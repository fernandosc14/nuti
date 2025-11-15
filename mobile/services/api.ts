/**
 * API Services
 * 
 * Serviços para comunicação com APIs externas:
 * - Groq API (chat IA)
 * - Open Food Facts API (pesquisa de alimentos)
 */

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
 * Pesquisa alimentos usando Open Food Facts API
 */
export async function searchFood(query: string): Promise<FoodItem[]> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch food data');
    }

    const data = await response.json();
    
    return data.products?.map((product: any) => ({
      id: product.code || product.id || Math.random().toString(),
      name: product.product_name || 'Nome desconhecido',
      calories: Math.round(product.nutriments?.['energy-kcal_100g'] || 0),
      protein: parseFloat((product.nutriments?.proteins_100g || 0).toFixed(1)),
      carbs: parseFloat((product.nutriments?.carbohydrates_100g || 0).toFixed(1)),
      fat: parseFloat((product.nutriments?.fat_100g || 0).toFixed(1)),
      image: product.image_url,
    })).filter((item: FoodItem) => item.name && item.calories > 0) || [];
  } catch (error) {
    console.error('Error searching food:', error);
    return [];
  }
}

/**
 * Obtém alimento por código de barras usando Open Food Facts API
 */
export async function getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    return {
      id: product.code || barcode,
      name: product.product_name || 'Nome desconhecido',
      calories: Math.round(product.nutriments?.['energy-kcal_100g'] || 0),
      protein: parseFloat((product.nutriments?.proteins_100g || 0).toFixed(1)),
      carbs: parseFloat((product.nutriments?.carbohydrates_100g || 0).toFixed(1)),
      fat: parseFloat((product.nutriments?.fat_100g || 0).toFixed(1)),
      image: product.image_url,
    };
  } catch (error) {
    console.error('Error fetching food by barcode:', error);
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
  // Converter imagem para base64
  const response = await fetch(imageUri);
  const blob = await response.blob();
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
      "fatPer100g": fat_grams_per_100g
    }
  ]
}

CRITICAL NUTRITIONAL ACCURACY RULES:
- Use REALISTIC and ACCURATE nutritional values based on standard food databases
- For common foods, use these reference values per 100g:
  * Cooked white rice: ~130 kcal, 2.7g protein, 28g carbs, 0.3g fat
  * Grilled chicken breast: ~165 kcal, 31g protein, 0g carbs, 3.6g fat
  * Cooked black beans: ~132 kcal, 8.9g protein, 24g carbs, 0.5g fat
  * Cooked beef steak: ~250 kcal, 26g protein, 0g carbs, 15g fat
  * Cooked pasta: ~131 kcal, 5g protein, 25g carbs, 1.1g fat
  * French fries: ~365 kcal, 3.4g protein, 63g carbs, 17g fat
  * Fried egg: ~196 kcal, 13.6g protein, 1.1g carbs, 14.8g fat
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
          const { enhanceNutritionalValues } = await import('./foodDatabase');
          
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
  // Converter imagem para base64
  const response = await fetch(imageUri);
  const blob = await response.blob();
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
      "fatPer100g": fat_grams_per_100g
    }
  ]
}

CRITICAL NUTRITIONAL ACCURACY RULES:
- Use REALISTIC and ACCURATE nutritional values based on standard food databases
- For common foods, use these reference values per 100g:
  * Cooked white rice: ~130 kcal, 2.7g protein, 28g carbs, 0.3g fat
  * Grilled chicken breast: ~165 kcal, 31g protein, 0g carbs, 3.6g fat
  * Cooked black beans: ~132 kcal, 8.9g protein, 24g carbs, 0.5g fat
  * Cooked beef steak: ~250 kcal, 26g protein, 0g carbs, 15g fat
  * Cooked pasta: ~131 kcal, 5g protein, 25g carbs, 1.1g fat
  * French fries: ~365 kcal, 3.4g protein, 63g carbs, 17g fat
  * Fried egg: ~196 kcal, 13.6g protein, 1.1g carbs, 14.8g fat
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
    const { enhanceNutritionalValues } = await import('./foodDatabase');
    
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
        };
      }),
    };
  }
  
  throw new Error('Unable to process image. Please try again.');
}

