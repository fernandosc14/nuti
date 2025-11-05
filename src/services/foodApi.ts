export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
}

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
