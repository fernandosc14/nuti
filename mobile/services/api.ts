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
            content: 'És o NutriBot, um assistente nutricional simpático e útil. Responde sempre em português de forma curta e amigável. Ajuda utilizadores com questões sobre nutrição, dietas e alimentação saudável.'
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

