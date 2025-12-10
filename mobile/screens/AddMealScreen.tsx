/**
 * AddMealScreen
 * 
 * Tela para adicionar refeição com pesquisa, câmera e código de barras
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { searchFood, getFoodByBarcode, analyzeFoodImage, analyzeFoodDescription, FoodItem } from '../services/api';
import { collection, addDoc, Timestamp, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
// Removido: import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// Usando base64 em vez de Firebase Storage (solução gratuita)
import { updateStreak } from '../utils/streakUtils';
import { removeCache } from '../utils/cacheUtils';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useBadgeNotification } from '../hooks/useBadgeNotification';
import { BadgeNotificationModal } from '../components/BadgeNotificationModal';
import { AdBanner } from '../components/AdBanner';

// Função melhorada para calcular Health Score e gerar sugestões
const calculateHealthScoreAndSuggestions = (
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  // Dados nutricionais adicionais (opcionais)
  sugars?: number,
  fiber?: number,
  sodium?: number,
  saturatedFat?: number,
  transFat?: number,
  weight?: number // Peso total da refeição em gramas (para calcular por 100g)
): { score: number; suggestions: string[] } => {
  if (!calories || calories === 0) {
    return { score: 5, suggestions: [] };
  }

  const suggestions: string[] = [];
  let score = 5; // Base score
  
  // Calcular valores por 100g se o peso estiver disponível
  const weightFor100g = weight || 400; // Usar peso fornecido ou estimativa de 400g
  const caloriesPer100g = (calories / weightFor100g) * 100;

  // PENALIZAÇÃO POR CALORIAS ABSOLUTAS (muito importante!)
  // Uma refeição saudável geralmente tem 400-800 kcal
  // 800-1200 kcal é aceitável mas alto
  // >1200 kcal é excessivo para uma única refeição
  if (calories > 2000) {
    score -= 3.5; // Penalização severa para refeições muito grandes
    suggestions.push('addMeal.suggestion.portionTooLarge');
  } else if (calories > 1500) {
    score -= 2.5;
    suggestions.push('addMeal.suggestion.portionLarge');
  } else if (calories > 1200) {
    score -= 1.5;
    suggestions.push('addMeal.suggestion.portionHigh');
  } else if (calories > 800) {
    score -= 0.5; // Leve penalização
  } else if (calories >= 400 && calories <= 800) {
    score += 0.5; // Bonus para refeições de tamanho ideal
  } else if (calories < 200) {
    score -= 0.5; // Muito pequeno pode não ser suficiente
  }

  // Calcular percentuais de cada macro
  const proteinCalories = protein * 4;
  const carbsCalories = carbs * 4;
  const fatCalories = fat * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
  
  const proteinPercent = totalMacroCalories > 0 ? (proteinCalories / calories) * 100 : 0;
  const carbsPercent = totalMacroCalories > 0 ? (carbsCalories / calories) * 100 : 0;
  const fatPercent = totalMacroCalories > 0 ? (fatCalories / calories) * 100 : 0;

  // Avaliar Proteína (ideal: 20-35% das calorias)
  if (proteinPercent >= 20 && proteinPercent <= 35) {
    score += 2;
  } else if (proteinPercent >= 15 && proteinPercent < 20) {
    score += 1;
    suggestions.push('addMeal.suggestion.addProtein');
  } else if (proteinPercent > 35) {
    score += 1.5;
  } else if (proteinPercent < 15) {
    score -= 1.5;
    suggestions.push('addMeal.suggestion.addMoreProtein');
  }

  // Avaliar Carboidratos (ideal: 45-65% das calorias)
  if (carbsPercent >= 45 && carbsPercent <= 65) {
    score += 1.5;
  } else if (carbsPercent > 70) {
    score -= 1;
    suggestions.push('addMeal.suggestion.reduceCarbs');
  } else if (carbsPercent < 30) {
    score -= 0.5;
    if (proteinPercent < 20) {
      suggestions.push('addMeal.suggestion.balanceMacros');
    }
  }

  // Avaliar Gordura (ideal: 20-35% das calorias)
  if (fatPercent >= 20 && fatPercent <= 35) {
    score += 1;
  } else if (fatPercent > 40) {
    score -= 1.5;
    suggestions.push('addMeal.suggestion.reduceFat');
  } else if (fatPercent < 15) {
    score -= 0.5;
    suggestions.push('addMeal.suggestion.addHealthyFats');
  }

  // Avaliar densidade calórica (calorias por 100g)
  if (caloriesPer100g > 400) {
    score -= 2; // Penalização maior para densidade muito alta
    if (!suggestions.includes('addMeal.suggestion.addVegetables')) {
      suggestions.push('addMeal.suggestion.addVegetables');
    }
  } else if (caloriesPer100g > 300) {
    score -= 1.5; // Penalização aumentada
    if (!suggestions.includes('addMeal.suggestion.addVegetables')) {
      suggestions.push('addMeal.suggestion.addVegetables');
    }
  } else if (caloriesPer100g < 100) {
    score += 0.5;
  }

  // AVALIAR AÇÚCARES (se disponível)
  // OMS recomenda <10% das calorias de açúcares livres (ideal <5%)
  if (sugars !== undefined && sugars > 0) {
    const sugarsCalories = sugars * 4; // 1g açúcar = 4 kcal
    const sugarsPercent = (sugarsCalories / calories) * 100;
    
    if (sugarsPercent > 20) {
      score -= 2; // Penalização severa para muito açúcar
      suggestions.push('addMeal.suggestion.highSugar');
    } else if (sugarsPercent > 15) {
      score -= 1.5;
      suggestions.push('addMeal.suggestion.reduceSugar');
    } else if (sugarsPercent > 10) {
      score -= 1;
    } else if (sugarsPercent <= 5) {
      score += 0.5; // Bonus para baixo açúcar
    }
  }

  // AVALIAR FIBRA (se disponível)
  // Recomendação: 25-30g por dia, ideal ~5-8g por refeição
  if (fiber !== undefined && fiber > 0) {
    const fiberPer100g = (fiber / weightFor100g) * 100;
    
    if (fiberPer100g >= 5) {
      score += 1.5; // Bonus significativo para alta fibra
    } else if (fiberPer100g >= 3) {
      score += 1;
    } else if (fiberPer100g < 1) {
      score -= 0.5; // Penalização para baixa fibra
      if (!suggestions.includes('addMeal.suggestion.addFiber')) {
        suggestions.push('addMeal.suggestion.addFiber');
      }
    }
  }

  // AVALIAR SÓDIO (se disponível)
  // OMS recomenda <2g sódio/dia (<5g sal/dia), ideal <400mg por refeição
  if (sodium !== undefined && sodium > 0) {
    const sodiumPer100g = (sodium / weightFor100g) * 100;
    const sodiumPerMeal = (sodium / weightFor100g) * weightFor100g;
    
    if (sodiumPerMeal > 1000) { // >1g sódio por refeição
      score -= 2; // Penalização severa
      suggestions.push('addMeal.suggestion.highSodium');
    } else if (sodiumPerMeal > 600) {
      score -= 1.5;
      suggestions.push('addMeal.suggestion.reduceSodium');
    } else if (sodiumPerMeal < 200) {
      score += 0.5; // Bonus para baixo sódio
    }
  }

  // AVALIAR GORDURA SATURADA (se disponível)
  // OMS recomenda <10% das calorias de gordura saturada
  if (saturatedFat !== undefined && saturatedFat > 0) {
    const saturatedFatCalories = saturatedFat * 9; // 1g gordura = 9 kcal
    const saturatedFatPercent = (saturatedFatCalories / calories) * 100;
    
    if (saturatedFatPercent > 15) {
      score -= 2; // Penalização severa
      suggestions.push('addMeal.suggestion.highSaturatedFat');
    } else if (saturatedFatPercent > 10) {
      score -= 1.5;
      suggestions.push('addMeal.suggestion.reduceSaturatedFat');
    } else if (saturatedFatPercent <= 5) {
      score += 0.5; // Bonus para baixa gordura saturada
    }
  }

  // AVALIAR GORDURA TRANS (se disponível)
  // Qualquer quantidade de gordura trans é prejudicial
  if (transFat !== undefined && transFat > 0) {
    score -= 3; // Penalização muito severa
    suggestions.push('addMeal.suggestion.containsTransFat');
  }

  // Normalizar para 0-10
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  return { score, suggestions };
};

export function AddMealScreen({ navigation, route }: any) {
  const { user, refreshProfile, profile } = useUser();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { units } = useUnits();
  const { showModal, earnedBadge, checkAndShowBadges, closeModal } = useBadgeNotification();
  const insets = useSafeAreaInsets();
  const mode = route?.params?.mode || 'search';
  const selectedDateParam = route?.params?.selectedDate;
  
  const isPremium = profile?.plan === 'premium';
  
  // Verificar se o usuário é premium quando tentar usar camera ou barcode
  useEffect(() => {
    if ((mode === 'camera' || mode === 'barcode') && !isPremium) {
      // Redirecionar para modo search
      navigation.setParams({ mode: 'search' });
      // Navegar diretamente para Premium screen
      navigation.navigate('Premium');
    }
  }, [mode, isPremium]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<
    'breakfast' | 'lunch' | 'dinner' | 'snack'
  >('breakfast');
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);

  // Detectar tipo de refeição baseado na hora do dia
  useEffect(() => {
    const hour = new Date().getHours();
    let defaultMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
    
    if (hour >= 5 && hour < 11) {
      defaultMealType = 'breakfast'; // Pequeno-almoço: 5h - 11h
    } else if (hour >= 11 && hour < 15) {
      defaultMealType = 'lunch'; // Almoço: 11h - 15h
    } else if (hour >= 15 && hour < 19) {
      defaultMealType = 'snack'; // Lanche: 15h - 19h
    } else {
      defaultMealType = 'dinner'; // Jantar: 19h - 5h
    }
    
    setSelectedMealType(defaultMealType);
  }, []);

  // Pré-preencher dados se vier de uma sugestão do chat
  useEffect(() => {
    const mealSuggestion = route?.params?.mealSuggestion;
    if (mealSuggestion) {
      // Definir nome da refeição
      setMealName(mealSuggestion.name);
      
      // Definir tipo de refeição
      setSelectedMealType(mealSuggestion.mealType);
      
      // Se houver alimentos na sugestão, adicionar à lista
      if (mealSuggestion.foods && mealSuggestion.foods.length > 0) {
        const foodsToAdd = mealSuggestion.foods.map((food: any, index: number) => ({
          id: `suggestion_${Date.now()}_${index}`,
          name: food.name,
          caloriesPer100g: food.caloriesPer100g || 0,
          proteinPer100g: food.proteinPer100g || 0,
          carbsPer100g: food.carbsPer100g || 0,
          fatPer100g: food.fatPer100g || 0,
          weight: food.weight || 100,
          quantity: 1,
          sugarsPer100g: food.sugarsPer100g,
          fiberPer100g: food.fiberPer100g,
          sodiumPer100g: food.sodiumPer100g,
          saturatedFatPer100g: food.saturatedFatPer100g,
          transFatPer100g: food.transFatPer100g,
        }));
        setSelectedFoods(foodsToAdd);
      } else {
        // Se não houver alimentos individuais, criar um alimento genérico com os totais
        const genericFood = {
          id: `suggestion_${Date.now()}`,
          name: mealSuggestion.name,
          caloriesPer100g: mealSuggestion.calories,
          proteinPer100g: mealSuggestion.protein,
          carbsPer100g: mealSuggestion.carbs,
          fatPer100g: mealSuggestion.fat,
          weight: 100, // Peso padrão, o utilizador pode ajustar
          quantity: 1,
        };
        setSelectedFoods([genericFood]);
      }
    }
  }, [route?.params?.mealSuggestion]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [analyzedFood, setAnalyzedFood] = useState<FoodItem | null>(null);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [plateFoods, setPlateFoods] = useState<Array<{
    name: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    weight: number;
    // Dados nutricionais adicionais
    sugarsPer100g?: number;
    fiberPer100g?: number;
    sodiumPer100g?: number;
    saturatedFatPer100g?: number;
    transFatPer100g?: number;
  }>>([]);
  const [foodDescription, setFoodDescription] = useState('');
  const [analyzingDescription, setAnalyzingDescription] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addingMeal, setAddingMeal] = useState(false);
  const isCameraActiveRef = useRef(false); // Ref para rastrear se a câmera está ativa (não causa re-render)
  const isProcessingRef = useRef(false); // Ref para rastrear se está processando (não causa re-render)
  const [selectedFoods, setSelectedFoods] = useState<Array<{
    id: string;
    name: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    weight: number; // peso em gramas
    quantity?: number; // quantidade de porções
    // Dados nutricionais adicionais
    sugarsPer100g?: number;
    fiberPer100g?: number;
    sodiumPer100g?: number;
    saturatedFatPer100g?: number;
    transFatPer100g?: number;
  }>>([]);
  const [mealName, setMealName] = useState('');
  const [savedMeals, setSavedMeals] = useState<Array<{
    id: string;
    name: string;
    foods: typeof selectedFoods;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    icon?: string; // Ícone personalizado
    createdAt: any;
    lastUsed?: any;
  }>>([]);
  const [showSavedMealsModal, setShowSavedMealsModal] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [loadingSavedMeals, setLoadingSavedMeals] = useState(false);
  const [editingSavedMeal, setEditingSavedMeal] = useState<typeof savedMeals[0] | null>(null);
  const [editingSavedMealFoods, setEditingSavedMealFoods] = useState<typeof selectedFoods>([]);
  const [editingSavedMealName, setEditingSavedMealName] = useState<string>('');
  const [selectedIcon, setSelectedIcon] = useState<string>('bookmark');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [originalSavedMeal, setOriginalSavedMeal] = useState<typeof savedMeals[0] | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const mealTypes = [
    { value: 'breakfast', label: t('addMeal.breakfast'), icon: '☕' },
    { value: 'lunch', label: t('addMeal.lunch'), icon: '🍽️' },
    { value: 'dinner', label: t('addMeal.dinner'), icon: '🌙' },
    { value: 'snack', label: t('addMeal.snack'), icon: '🍎' },
  ] as const;

  // Solicitar permissões
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  React.useEffect(() => {
    if (cameraPermission) {
      setHasPermission(cameraPermission.granted);
    }
  }, [cameraPermission]);

  // Limpar estado quando a tela perde o foco (volta para trás)
  // Usar ref para verificar selectedFoods sem causar re-renders
  const selectedFoodsRef = useRef(selectedFoods);
  useEffect(() => {
    selectedFoodsRef.current = selectedFoods;
  }, [selectedFoods]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // NUNCA limpar estado se:
        // 1. A câmera estiver ativa (verificar ref primeiro - mais confiável)
        // 2. Estiver a processar algo (análise de imagem, etc)
        // 3. Estiver a analisar uma imagem (loading)
        // 4. Houver uma imagem capturada ou alimento sendo editado
        // 5. Houver alimentos selecionados (NUNCA limpar selectedFoods aqui - só limpar quando realmente sair da tela)
        // 
        // IMPORTANTE: Verificar refs PRIMEIRO antes de qualquer outra coisa
        // porque quando a câmera nativa abre, o componente pode perder o foco
        // e os estados podem não estar atualizados ainda
        if (isCameraActiveRef.current || isProcessingRef.current) {
          console.log('[AddMeal] Cleanup bloqueado: câmera ativa ou processando');
          return;
        }
        
        // Verificar estados também (mas refs têm prioridade)
        if (loading || capturedImage || editingFood) {
          console.log('[AddMeal] Cleanup bloqueado: loading, capturedImage ou editingFood');
          return;
        }
        
        // NUNCA limpar selectedFoods no useFocusEffect - isso interfere com a adição de múltiplos alimentos
        // Apenas limpar outros estados quando sair da tela
        if (selectedFoodsRef.current.length > 0) {
          // Limpar apenas outros estados, mas manter selectedFoods
          setEditingFood(null);
          setCapturedImage(null);
          setAnalyzedFood(null);
          setQuantity(1);
          setPlateFoods([]);
          return;
        }
        
        // Limpar estado quando sair da tela (apenas se não houver processamento em curso e não houver alimentos selecionados)
        setEditingFood(null);
        setCapturedImage(null);
        setAnalyzedFood(null);
        setQuantity(1);
        setPlateFoods([]);
        setSelectedFoods([]);
      };
    }, [loading, capturedImage, editingFood])
  );

  // Se o modo for 'camera', abrir câmera automaticamente (apenas se premium)
  React.useEffect(() => {
    if (!isPremium && (mode === 'camera' || mode === 'barcode')) {
      // Se não for premium, não fazer nada aqui - o outro useEffect já trata isso
      return;
    }
    
    if (mode === 'camera' && isPremium) {
      // Setar flag ANTES de abrir a câmera para prevenir cleanup prematuro
      isCameraActiveRef.current = true;
      // Pequeno delay para garantir que a flag foi setada antes de qualquer cleanup
      setTimeout(() => {
      handleTakePhoto();
      }, 100);
    } else if (mode === 'barcode' && isPremium) {
      // Modo código de barras - abrir scanner de câmera
      if (cameraPermission?.granted) {
        setShowBarcodeScanner(true);
        setScanned(false);
      } else if (cameraPermission && !cameraPermission.granted) {
        // Solicitar permissão automaticamente
        requestCameraPermission();
      }
    }
  }, [mode, cameraPermission, isPremium]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setIsSearching(true);
    try {
      const results = await searchFood(searchQuery, language);
      setFoodResults(results);
      if (results.length === 0) {
        Toast.show({
          type: 'info',
          text1: t('addMeal.noResults') || 'No results',
          text2: t('addMeal.tryOtherTerms') || 'Try searching with other terms',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: t('addMeal.searchError') || 'Error searching food',
      });
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      isCameraActiveRef.current = true; // Marcar que a câmera está ativa (usar ref, não state)
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        isCameraActiveRef.current = false;
        Alert.alert('Permissão necessária', 'Precisas de permitir acesso à câmera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setCapturedImage(imageUri);
        setLoading(true);
        setIsSearching(false); // Não é pesquisa, é análise de imagem
        isProcessingRef.current = true; // Marcar que está processando

        try {
          // Analisar imagem com IA
          console.log('Starting food image analysis, URI:', imageUri);
          const analyzed = await analyzeFoodImage(imageUri, language);
          console.log('Food image analysis completed');
          setAnalyzedFood(analyzed);
          
          if (analyzed.plateFoods && analyzed.plateFoods.length > 0) {
            setPlateFoods(analyzed.plateFoods);
            
            // Calcular totais iniciais
            const totals = analyzed.plateFoods.reduce((acc, food) => {
              const multiplier = food.weight / 100;
              return {
                calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
                protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
                carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
                fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
                // Dados nutricionais adicionais
                sugars: acc.sugars + (food.sugarsPer100g ? parseFloat((food.sugarsPer100g * multiplier).toFixed(1)) : 0),
                fiber: acc.fiber + (food.fiberPer100g ? parseFloat((food.fiberPer100g * multiplier).toFixed(1)) : 0),
                sodium: acc.sodium + (food.sodiumPer100g ? parseFloat((food.sodiumPer100g * multiplier).toFixed(1)) : 0),
                saturatedFat: acc.saturatedFat + (food.saturatedFatPer100g ? parseFloat((food.saturatedFatPer100g * multiplier).toFixed(1)) : 0),
                transFat: acc.transFat + (food.transFatPer100g ? parseFloat((food.transFatPer100g * multiplier).toFixed(1)) : 0),
                totalWeight: acc.totalWeight + food.weight,
              };
            }, { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, fiber: 0, sodium: 0, saturatedFat: 0, transFat: 0, totalWeight: 0 });
            
            setEditingFood({
              ...analyzed,
              image: imageUri,
              calories: totals.calories,
              protein: totals.protein,
              carbs: totals.carbs,
              fat: totals.fat,
            });
          } else {
            // Alimento único ou múltiplos no nome (compatibilidade com formato antigo)
            // Verificar se o nome contém múltiplos alimentos separados por vírgulas
            const nameParts = analyzed.name.split(',').map(part => part.trim()).filter(part => part.length > 0);
            
            if (nameParts.length > 1) {
              // Múltiplos alimentos no nome - dividir valores nutricionais proporcionalmente
              
              // Dividir valores nutricionais igualmente entre os alimentos
              const foodsPerItem = {
                caloriesPer100g: Math.round(analyzed.calories / nameParts.length),
                proteinPer100g: parseFloat((analyzed.protein / nameParts.length).toFixed(1)),
                carbsPer100g: parseFloat((analyzed.carbs / nameParts.length).toFixed(1)),
                fatPer100g: parseFloat((analyzed.fat / nameParts.length).toFixed(1)),
              };
              
              const multipleFoods = nameParts.map(name => ({
                name: name,
                ...foodsPerItem,
                weight: 100,
              }));
              
              setPlateFoods(multipleFoods);
              
              // Calcular totais iniciais
              const totals = multipleFoods.reduce((acc, food) => {
                const multiplier = food.weight / 100;
                return {
                  calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
                  protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
                  carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
                  fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
                };
              }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
              
              setEditingFood({
                ...analyzed,
                image: imageUri,
                calories: totals.calories,
                protein: totals.protein,
                carbs: totals.carbs,
                fat: totals.fat,
              });
            } else {
              // Alimento único
              const singleFood = {
                name: analyzed.name,
                caloriesPer100g: analyzed.calories,
                proteinPer100g: analyzed.protein,
                carbsPer100g: analyzed.carbs,
                fatPer100g: analyzed.fat,
                weight: 100,
              };
              
              setPlateFoods([singleFood]);
              
              setEditingFood({
                ...analyzed,
                image: imageUri,
              });
            }
          }
        } catch (error: any) {
          console.error('Error analyzing food image:', error);
          console.error('Error details:', error.message);
          
          // Verificar se é erro de "não é comida" e usar tradução
          let errorMessage = error.message || t('addMeal.errorProcessing') || 'Erro ao processar imagem';
          if (error.message?.includes('does not contain food')) {
            errorMessage = t('addMeal.errorNotFood') || 'Esta imagem não contém comida. Por favor, tire uma foto de comida.';
          } else if (error.message?.includes('Nenhuma API')) {
            errorMessage = 'API de análise de imagem não configurada. Configure EXPO_PUBLIC_GEMINI_API_KEY ou EXPO_PUBLIC_OPENAI_API_KEY no .env';
          }
          
          Toast.show({
            type: 'error',
            text1: t('addMeal.error') || 'Erro',
            text2: errorMessage,
          });
        } finally {
          setLoading(false);
          isCameraActiveRef.current = false; // Resetar flag após processar a imagem
          isProcessingRef.current = false; // Marcar que terminou o processamento
        }
      } else {
        // Usuário cancelou - resetar flag
        isCameraActiveRef.current = false;
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      console.error('Error details:', error.message);
      
      isCameraActiveRef.current = false; // Resetar flag em caso de erro
      isProcessingRef.current = false; // Resetar flag de processamento
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.cameraError') || 'Error taking photo. Please try again.',
      });
      setLoading(false);
    }
  };

  // Processar código de barras escaneado ou inserido manualmente
  const processBarcode = async (barcode: string) => {
    if (!barcode.trim()) {
      return;
    }

    const cleanBarcode = barcode.trim();
    console.log('[AddMeal] Processando código de barras:', cleanBarcode);

    setLoading(true);
    setIsSearching(false); // Não é pesquisa, é código de barras
    setScanned(true);
    setShowBarcodeScanner(false);
    
    try {
      const food = await getFoodByBarcode(cleanBarcode);
      
      if (!food) {
        Toast.show({
          type: 'error',
          text1: t('common.error') || 'Erro',
          text2: t('addMeal.barcodeNotFound') || `Produto não encontrado na base de dados.\nCódigo: ${cleanBarcode}\nTente pesquisar pelo nome do produto.`,
          visibilityTime: 5000,
        });
        setLoading(false);
        // Permitir escanear novamente
        setScanned(false);
        return;
      }

      // Verificar limite de 5 alimentos antes de adicionar
      if (selectedFoods.length >= 5) {
        Toast.show({
          type: 'info',
          text1: t('addMeal.maxFoodsReached') || 'Limite atingido',
          text2: t('addMeal.maxFoodsMessage') || 'Podes adicionar no máximo 5 alimentos por refeição',
        });
        setLoading(false);
        setScanned(false);
        return;
      }

      // Adicionar o alimento encontrado à lista de alimentos selecionados
      // Criar ID único para cada alimento adicionado (mesmo alimento pode ser adicionado múltiplas vezes)
      const uniqueId = `${food.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const foodToAdd = {
        id: uniqueId,
        name: food.name,
        caloriesPer100g: food.calories || 0,
        proteinPer100g: food.protein || 0,
        carbsPer100g: food.carbs || 0,
        fatPer100g: food.fat || 0,
        weight: 100, // Peso padrão: 100g
        quantity: 1, // Quantidade padrão: 1 porção
        // Dados nutricionais adicionais (se disponíveis)
        sugarsPer100g: food.sugars,
        fiberPer100g: food.fiber,
        sodiumPer100g: food.sodium,
        saturatedFatPer100g: food.saturatedFat,
        transFatPer100g: food.transFat,
      };

      setSelectedFoods(prevFoods => [...prevFoods, foodToAdd]);
      setBarcodeInput(''); // Limpar input após adicionar
      
      Toast.show({
        type: 'success',
        text1: t('addMeal.productFound') || 'Produto encontrado',
        text2: `${food.name} ${t('addMeal.addedToList') || 'adicionado à lista'}`,
      });
    } catch (error: any) {
      console.error('Error searching barcode:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('addMeal.barcodeError') || 'Erro ao buscar produto',
      });
      // Permitir escanear novamente
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  // Buscar alimento por código de barras usando Open Food Facts (input manual)
  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('addMeal.barcodeEmpty') || 'Por favor, insira um código de barras',
      });
      return;
    }

    await processBarcode(barcodeInput.trim());
  };

  // Handler para quando o código de barras é escaneado pela câmera
  const handleBarCodeScanned = ({ data }: { data: string; type: string }) => {
    if (!scanned && data) {
      processBarcode(data);
    }
  };

  // Converter imagem para base64 (solução gratuita sem Firebase Storage)
  // Usa XMLHttpRequest que funciona melhor no React Native
  const uriToBase64 = async (uri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result as string;
              if (base64String) {
                resolve(base64String);
              } else {
                reject(new Error('Falha ao converter blob para base64'));
              }
            };
            reader.onerror = () => {
              reject(new Error('Erro ao ler o blob'));
            };
            reader.readAsDataURL(xhr.response);
          } catch (readError: any) {
            reject(new Error('Erro ao processar resposta: ' + readError.message));
          }
        } else {
          reject(new Error(`Falha ao carregar imagem: status ${xhr.status}`));
        }
      };
      
      xhr.onerror = function () {
        reject(new Error('Erro de rede ao carregar imagem'));
      };
      
      xhr.onabort = function () {
        reject(new Error('Carregamento da imagem cancelado'));
      };
      
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  // Converter imagem para base64 e retornar como string
  const convertImageToBase64 = async (imageUri: string): Promise<string | null> => {
    if (!user || !imageUri) return null;
    
    try {
      // Verificar se já é uma URL (não precisa conversão)
      if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        return imageUri;
      }

      // Se já é base64, retornar diretamente
      if (imageUri.startsWith('data:')) {
        return imageUri;
      }

      // Converter para base64
      const base64String = await uriToBase64(imageUri);
      return base64String;
    } catch (error: any) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  };

  // Adicionar alimento à lista de selecionados
  const addFoodToList = (food: FoodItem) => {
    // Verificar limite de 5 alimentos antes de adicionar
    if (selectedFoods.length >= 5) {
      Toast.show({
        type: 'info',
        text1: t('addMeal.maxFoodsReached') || 'Limite atingido',
        text2: t('addMeal.maxFoodsMessage') || 'Podes adicionar no máximo 5 alimentos por refeição',
      });
      return;
    }

    // Criar ID único para cada alimento adicionado (mesmo alimento pode ser adicionado múltiplas vezes)
    const uniqueId = `${food.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newFood = {
      id: uniqueId,
      name: food.name,
      caloriesPer100g: food.calories,
      proteinPer100g: food.protein,
      carbsPer100g: food.carbs,
      fatPer100g: food.fat,
      weight: 100, // Peso padrão: 100g
      quantity: 1, // Quantidade padrão: 1 porção
      // Dados nutricionais adicionais (se disponíveis)
      sugarsPer100g: food.sugars,
      fiberPer100g: food.fiber,
      sodiumPer100g: food.sodium,
      saturatedFatPer100g: food.saturatedFat,
      transFatPer100g: food.transFat,
    };
    
    // Adicionar à lista com peso padrão de 100g e quantidade 1
    setSelectedFoods(prevFoods => [...prevFoods, newFood]);

    // Limpar resultados da pesquisa e campo de pesquisa para permitir nova pesquisa
    setFoodResults([]);
    setSearchQuery('');

    Toast.show({
      type: 'success',
      text1: t('addMeal.added') || 'Added',
      text2: t('addMeal.foodAddedToList', { food: food.name }) || `${food.name} added to list`,
    });
  };

  // Remover alimento da lista
  const removeFoodFromList = (id: string) => {
    setSelectedFoods(prevFoods => prevFoods.filter(f => f.id !== id));
  };

  // Converter gramas para onças (para exibição)
  const gramsToOunces = (grams: number): number => {
    return grams / 28.3495;
  };

  // Converter onças para gramas (para armazenamento)
  const ouncesToGrams = (ounces: number): number => {
    return ounces * 28.3495;
  };

  // Obter unidade apropriada para o alimento (sempre g ou oz, nunca ml)
  const getFoodUnit = (foodName: string): string => {
    return units.weight === 'lb' ? 'oz' : 'g';
  };

  // Formatar peso para exibição (g ou oz)
  const formatFoodWeight = (weightInGrams: number, foodName?: string): string => {
    if (units.weight === 'lb') {
      // Se unidade é libras, mostrar em onças
      const ounces = gramsToOunces(weightInGrams);
      return (Math.round(ounces * 10) / 10).toString(); // Arredondar para 1 casa decimal
    } else {
      // Se unidade é kg, mostrar em gramas
      return Math.round(weightInGrams).toString();
    }
  };

  // Atualizar peso de um alimento
  const updateFoodWeight = (id: string, weight: number) => {
    setSelectedFoods(prevFoods => prevFoods.map(f => {
      if (f.id === id) {
        // Converter conforme unidade (sempre em gramas ou onças)
        const weightInGrams = units.weight === 'lb' ? ouncesToGrams(weight) : weight;
        return { ...f, weight: Math.max(0, weightInGrams) };
      }
      return f;
    }));
  };

  // Calcular totais dos plateFoods (para refeições por foto)
  const calculatePlateFoodsTotals = () => {
    if (plateFoods.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, fiber: 0, sodium: 0, saturatedFat: 0, transFat: 0, totalWeight: 0 };
    }
    
    return plateFoods.reduce((acc, food) => {
      const multiplier = food.weight / 100;
      return {
        calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
        protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
        carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
        fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
        // Dados nutricionais adicionais
        sugars: acc.sugars + (food.sugarsPer100g ? parseFloat((food.sugarsPer100g * multiplier).toFixed(1)) : 0),
        fiber: acc.fiber + (food.fiberPer100g ? parseFloat((food.fiberPer100g * multiplier).toFixed(1)) : 0),
        sodium: acc.sodium + (food.sodiumPer100g ? parseFloat((food.sodiumPer100g * multiplier).toFixed(1)) : 0),
        saturatedFat: acc.saturatedFat + (food.saturatedFatPer100g ? parseFloat((food.saturatedFatPer100g * multiplier).toFixed(1)) : 0),
        transFat: acc.transFat + (food.transFatPer100g ? parseFloat((food.transFatPer100g * multiplier).toFixed(1)) : 0),
        totalWeight: acc.totalWeight + food.weight,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, fiber: 0, sodium: 0, saturatedFat: 0, transFat: 0, totalWeight: 0 });
  };

  // Helper para calcular health score considerando plateFoods quando disponível
  const getHealthScoreData = () => {
    if (plateFoods.length > 0) {
      const totals = calculatePlateFoodsTotals();
      return calculateHealthScoreAndSuggestions(
        totals.calories * quantity,
        totals.protein * quantity,
        totals.carbs * quantity,
        totals.fat * quantity,
        totals.sugars > 0 ? totals.sugars * quantity : undefined,
        totals.fiber > 0 ? totals.fiber * quantity : undefined,
        totals.sodium > 0 ? totals.sodium * quantity : undefined,
        totals.saturatedFat > 0 ? totals.saturatedFat * quantity : undefined,
        totals.transFat > 0 ? totals.transFat * quantity : undefined,
        totals.totalWeight > 0 ? totals.totalWeight * quantity : undefined
      );
    }
    // Caso contrário, usar dados básicos do editingFood
    if (!editingFood) {
      return { score: 5, suggestions: [] };
    }
    return calculateHealthScoreAndSuggestions(
      editingFood.calories * quantity,
      editingFood.protein * quantity,
      editingFood.carbs * quantity,
      editingFood.fat * quantity
    );
  };

  // Calcular totais da lista
  const calculateTotals = () => {
    return selectedFoods.reduce((acc, food) => {
      const multiplier = (food.weight / 100) * (food.quantity || 1);
      return {
        calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
        protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
        carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
        fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
        // Dados nutricionais adicionais
        sugars: acc.sugars + (food.sugarsPer100g ? parseFloat((food.sugarsPer100g * multiplier).toFixed(1)) : 0),
        fiber: acc.fiber + (food.fiberPer100g ? parseFloat((food.fiberPer100g * multiplier).toFixed(1)) : 0),
        sodium: acc.sodium + (food.sodiumPer100g ? parseFloat((food.sodiumPer100g * multiplier).toFixed(1)) : 0),
        saturatedFat: acc.saturatedFat + (food.saturatedFatPer100g ? parseFloat((food.saturatedFatPer100g * multiplier).toFixed(1)) : 0),
        transFat: acc.transFat + (food.transFatPer100g ? parseFloat((food.transFatPer100g * multiplier).toFixed(1)) : 0),
        totalWeight: acc.totalWeight + food.weight * (food.quantity || 1),
      };
    }, { 
      calories: 0, 
      protein: 0, 
      carbs: 0, 
      fat: 0,
      sugars: 0,
      fiber: 0,
      sodium: 0,
      saturatedFat: 0,
      transFat: 0,
      totalWeight: 0,
    });
  };

  // Adicionar todos os alimentos como uma refeição
  const addMealFromList = async () => {
    if (!user || selectedFoods.length === 0 || addingMeal) return; // Prevenir múltiplos cliques

    setAddingMeal(true);
    try {
      const totals = calculateTotals();
      // Usar nome da refeição se fornecido, senão gerar automaticamente
      const finalMealName = mealName.trim() || (selectedFoods.length === 1 
        ? selectedFoods[0].name 
        : selectedFoods.map(f => f.name).join(', '));

      // Usar data selecionada se disponível, senão usar data atual
      // Se houver data selecionada, usar essa data mas manter a hora atual
      let mealDate: Date;
      if (selectedDateParam) {
        const selectedDate = new Date(selectedDateParam);
        const now = new Date();
        // Usar a data selecionada mas com a hora atual
        mealDate = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds()
        );
      } else {
        mealDate = new Date();
      }

      // Sempre salvar também a data de quando foi adicionada (hoje)
      const addedAt = new Date();
      
      // Calcular Health Score com dados adicionais
      const healthScore = calculateHealthScoreAndSuggestions(
        totals.calories,
        totals.protein,
        totals.carbs,
        totals.fat,
        totals.sugars > 0 ? totals.sugars : undefined,
        totals.fiber > 0 ? totals.fiber : undefined,
        totals.sodium > 0 ? totals.sodium : undefined,
        totals.saturatedFat > 0 ? totals.saturatedFat : undefined,
        totals.transFat > 0 ? totals.transFat : undefined,
        totals.totalWeight > 0 ? totals.totalWeight : undefined
      ).score;
      
      // Preparar lista de alimentos para salvar
      const foodsToSave = selectedFoods.map(food => ({
        name: food.name,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        weight: food.weight,
        quantity: food.quantity || 1,
      }));
      
      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: finalMealName,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        image: null,
        mealType: selectedMealType,
        healthScore: healthScore,
        date: Timestamp.fromDate(mealDate), // Data para qual a refeição foi adicionada (dia selecionado)
        addedAt: Timestamp.fromDate(addedAt), // Data de quando foi realmente adicionada (hoje)
        foods: foodsToSave, // Lista de alimentos individuais
        // Dados nutricionais adicionais (opcionais, apenas se disponíveis)
        ...(totals.sugars > 0 && { sugars: totals.sugars }),
        ...(totals.fiber > 0 && { fiber: totals.fiber }),
        ...(totals.sodium > 0 && { sodium: totals.sodium }),
        ...(totals.saturatedFat > 0 && { saturatedFat: totals.saturatedFat }),
        ...(totals.transFat > 0 && { transFat: totals.transFat }),
      });

      // Invalidar cache (rápido, não bloquear)
      const daysWithMealsCacheKey = `daysWithMeals_${user.uid}`;
      removeCache(daysWithMealsCacheKey).catch(() => {});

      // Mostrar toast e navegar IMEDIATAMENTE (não esperar pelo resto)
      Toast.show({
        type: 'success',
        text1: t('addMeal.mealAdded') || 'Meal added!',
        text2: t('addMeal.foodsAddedToDiary', { count: selectedFoods.length }) || `${selectedFoods.length} food(s) added to your diary`,
      });

      // Limpar lista e voltar IMEDIATAMENTE
      setSelectedFoods([]);
      navigation.goBack();

      // Executar operações pesadas em background (não bloquear navegação)
      Promise.all([
        updateStreak(user.uid),
        refreshProfile(),
      ]).then(() => {
        // Verificar badges após streak e profile atualizados
        checkAndShowBadges(user.uid).catch(err => {
          console.error('Error checking badges:', err);
        });
      }).catch(err => {
        console.error('Error updating streak/profile:', err);
      });
    } catch (error: any) {
      console.error('Error adding meal:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.mealAddError') || 'Error adding meal',
      });
      setAddingMeal(false); // Permitir tentar novamente em caso de erro
    }
  };

  // Função antiga mantida para compatibilidade (usada apenas na edição de comida analisada)
  const addMeal = async (food: FoodItem) => {
    if (!user || addingMeal) return; // Prevenir múltiplos cliques

    setAddingMeal(true);
    try {
      // Converter imagem para base64 se existir
      let imageUrl = food.image || null;
      if (food.image && food.image.startsWith('file://')) {
        imageUrl = await convertImageToBase64(food.image);
        if (!imageUrl) {
          console.warn('Failed to convert image to base64, continuing without image');
        }
      }

      // Usar data selecionada se disponível, senão usar data atual
      // Se houver data selecionada, usar essa data mas manter a hora atual
      let mealDate: Date;
      if (selectedDateParam) {
        const selectedDate = new Date(selectedDateParam);
        const now = new Date();
        // Usar a data selecionada mas com a hora atual
        mealDate = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds()
        );
      } else {
        mealDate = new Date();
      }

      // Sempre salvar também a data de quando foi adicionada (hoje)
      const addedAt = new Date();
      
      // Calcular Health Score com dados adicionais se disponíveis
      const healthScore = calculateHealthScoreAndSuggestions(
        Math.round(food.calories * quantity),
        parseFloat((food.protein * quantity).toFixed(1)),
        parseFloat((food.carbs * quantity).toFixed(1)),
        parseFloat((food.fat * quantity).toFixed(1)),
        food.sugars ? food.sugars * quantity : undefined,
        food.fiber ? food.fiber * quantity : undefined,
        food.sodium ? food.sodium * quantity : undefined,
        food.saturatedFat ? food.saturatedFat * quantity : undefined,
        food.transFat ? food.transFat * quantity : undefined
      ).score;

      // Preparar lista de alimentos para salvar (foto - apenas um alimento)
      const foodsToSave = [{
        name: food.name,
        caloriesPer100g: food.calories,
        proteinPer100g: food.protein,
        carbsPer100g: food.carbs,
        fatPer100g: food.fat,
        weight: 100, // Por padrão, assume 100g quando adicionado via foto
        quantity: quantity,
      }];
      
      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: food.name,
        calories: Math.round(food.calories * quantity),
        protein: parseFloat((food.protein * quantity).toFixed(1)),
        carbs: parseFloat((food.carbs * quantity).toFixed(1)),
        fat: parseFloat((food.fat * quantity).toFixed(1)),
        image: imageUrl,
        mealType: selectedMealType,
        healthScore: healthScore,
        date: Timestamp.fromDate(mealDate), // Data para qual a refeição foi adicionada (dia selecionado)
        addedAt: Timestamp.fromDate(addedAt), // Data de quando foi realmente adicionada (hoje)
        foods: foodsToSave, // Lista de alimentos individuais
      });

      // Invalidar cache (rápido, não bloquear)
      const daysWithMealsCacheKey = `daysWithMeals_${user.uid}`;
      removeCache(daysWithMealsCacheKey).catch(() => {});

      // Mostrar toast e navegar IMEDIATAMENTE (não esperar pelo resto)
      Toast.show({
        type: 'success',
        text1: t('addMeal.mealAdded') || 'Meal added!',
        text2: t('addMeal.foodAddedToDiary', { food: food.name }) || `${food.name} was added to your diary`,
      });

      navigation.goBack();

      // Executar operações pesadas em background (não bloquear navegação)
      Promise.all([
        updateStreak(user.uid),
        refreshProfile(),
      ]).then(() => {
        // Verificar badges após streak e profile atualizados
        checkAndShowBadges(user.uid).catch(err => {
          console.error('Error checking badges:', err);
        });
      }).catch(err => {
        console.error('Error updating streak/profile:', err);
      });
    } catch (error: any) {
      console.error('Error adding meal:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.couldNotAddMeal') || 'Could not add meal',
      });
      setAddingMeal(false); // Permitir tentar novamente em caso de erro
    }
  };

  const handleSaveEditedFood = () => {
    if (!editingFood || addingMeal) return; // Prevenir múltiplos cliques
    
    // Se houver plateFoods, calcular totais incluindo dados adicionais
    if (plateFoods.length > 0) {
      const totals = calculatePlateFoodsTotals();
      const foodWithQuantity = {
        ...editingFood,
        calories: totals.calories * quantity,
        protein: totals.protein * quantity,
        carbs: totals.carbs * quantity,
        fat: totals.fat * quantity,
        // Dados nutricionais adicionais
        sugars: totals.sugars > 0 ? totals.sugars * quantity : undefined,
        fiber: totals.fiber > 0 ? totals.fiber * quantity : undefined,
        sodium: totals.sodium > 0 ? totals.sodium * quantity : undefined,
        saturatedFat: totals.saturatedFat > 0 ? totals.saturatedFat * quantity : undefined,
        transFat: totals.transFat > 0 ? totals.transFat * quantity : undefined,
        healthScore: getHealthScoreData().score,
      };
      addMeal(foodWithQuantity);
    } else {
      // Caso contrário, usar dados básicos do editingFood
      const foodWithQuantity = {
        ...editingFood,
        calories: editingFood.calories * quantity,
        protein: editingFood.protein * quantity,
        carbs: editingFood.carbs * quantity,
        fat: editingFood.fat * quantity,
        healthScore: getHealthScoreData().score,
      };
      addMeal(foodWithQuantity);
    }
  };

  // Carregar refeições guardadas
  const loadSavedMeals = async () => {
    if (!user) return;
    
    setLoadingSavedMeals(true);
    try {
      const q = query(
        collection(db, 'savedMeals'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const meals: any[] = [];
      querySnapshot.forEach((doc) => {
        meals.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      // Ordenar por última utilização (mais recente primeiro) ou data de criação
      meals.sort((a, b) => {
        const aDate = a.lastUsed?.toMillis() || a.createdAt?.toMillis() || 0;
        const bDate = b.lastUsed?.toMillis() || b.createdAt?.toMillis() || 0;
        return bDate - aDate;
      });
      setSavedMeals(meals);
    } catch (error: any) {
      console.error('Error loading saved meals:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.couldNotLoadSavedMeals') || 'Could not load saved meals',
      });
    } finally {
      setLoadingSavedMeals(false);
    }
  };

  // Função auxiliar para remover campos undefined de um objeto
  const removeUndefinedFields = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedFields(item));
    } else if (obj !== null && typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = removeUndefinedFields(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  };

  // Guardar refeição como template
  const saveMealTemplate = async () => {
    if (!user || selectedFoods.length === 0 || savingMeal) return;

    // Verificar se já existe um nome
    const finalMealName = mealName.trim();
    if (!finalMealName) {
      Toast.show({
        type: 'info',
        text1: t('addMeal.mealNameRequired') || 'Nome da refeição necessário',
        text2: t('addMeal.pleaseEnterMealName') || 'Por favor, insira um nome para a refeição',
      });
      return;
    }

    setSavingMeal(true);
    try {
      // Limpar campos undefined dos alimentos antes de salvar
      const cleanedFoods = removeUndefinedFields(selectedFoods);
      
      await addDoc(collection(db, 'savedMeals'), {
        userId: user.uid,
        name: finalMealName,
        foods: cleanedFoods,
        mealType: selectedMealType,
        icon: 'bookmark', // Ícone padrão
        createdAt: Timestamp.now(),
      });

      Toast.show({
        type: 'success',
        text1: t('addMeal.mealSaved') || 'Refeição guardada!',
        text2: t('addMeal.mealSavedMessage') || 'A refeição foi guardada com sucesso',
      });

      // Recarregar lista de refeições guardadas
      await loadSavedMeals();
    } catch (error: any) {
      console.error('Error saving meal:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.couldNotSaveMeal') || 'Could not save meal',
      });
    } finally {
      setSavingMeal(false);
    }
  };

  // Guardar refeição da foto como template
  const savePhotoMealTemplate = async () => {
    if (!user || !editingFood || savingMeal) return;

    // Converter plateFoods ou editingFood para formato de foods
    let foodsToSave: typeof selectedFoods = [];
    
    if (plateFoods.length > 0) {
      foodsToSave = plateFoods.map((food, index) => {
        const foodObj: any = {
          id: `photo_${index}_${Date.now()}`,
          name: food.name,
          caloriesPer100g: food.caloriesPer100g,
          proteinPer100g: food.proteinPer100g,
          carbsPer100g: food.carbsPer100g,
          fatPer100g: food.fatPer100g,
          weight: food.weight,
          quantity: 1,
        };
        // Adicionar apenas campos que não são undefined
        if (food.sugarsPer100g !== undefined) foodObj.sugarsPer100g = food.sugarsPer100g;
        if (food.fiberPer100g !== undefined) foodObj.fiberPer100g = food.fiberPer100g;
        if (food.sodiumPer100g !== undefined) foodObj.sodiumPer100g = food.sodiumPer100g;
        if (food.saturatedFatPer100g !== undefined) foodObj.saturatedFatPer100g = food.saturatedFatPer100g;
        if (food.transFatPer100g !== undefined) foodObj.transFatPer100g = food.transFatPer100g;
        return foodObj;
      });
    } else {
      foodsToSave = [{
        id: `photo_${Date.now()}`,
        name: editingFood.name,
        caloriesPer100g: editingFood.calories,
        proteinPer100g: editingFood.protein,
        carbsPer100g: editingFood.carbs,
        fatPer100g: editingFood.fat,
        weight: 100,
        quantity: 1,
      }];
    }

    // Usar nome do editingFood ou gerar um nome padrão
    const finalMealName = editingFood.name || t('addMeal.photoMeal') || 'Refeição da foto';

    setSavingMeal(true);
    try {
      // Limpar campos undefined dos alimentos antes de salvar
      const cleanedFoods = removeUndefinedFields(foodsToSave);
      
      await addDoc(collection(db, 'savedMeals'), {
        userId: user.uid,
        name: finalMealName,
        foods: cleanedFoods,
        mealType: selectedMealType,
        icon: 'bookmark', // Ícone padrão
        createdAt: Timestamp.now(),
      });

      Toast.show({
        type: 'success',
        text1: t('addMeal.mealSaved') || 'Refeição guardada!',
        text2: t('addMeal.mealSavedMessage') || 'A refeição foi guardada com sucesso',
      });

      // Recarregar lista de refeições guardadas
      await loadSavedMeals();
    } catch (error: any) {
      console.error('Error saving meal:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.couldNotSaveMeal') || 'Could not save meal',
      });
    } finally {
      setSavingMeal(false);
    }
  };

  // Adicionar refeição guardada rapidamente
  // Abrir tela de edição de refeição guardada
  const openEditSavedMeal = (savedMeal: typeof savedMeals[0]) => {
    // Criar cópia dos alimentos para edição
    const foodsCopy = savedMeal.foods.map(food => ({ ...food }));
    setEditingSavedMealFoods(foodsCopy);
    setEditingSavedMeal(savedMeal);
    setEditingSavedMealName(savedMeal.name); // Definir nome para edição
    setSelectedMealType(savedMeal.mealType); // Definir tipo de refeição
    setSelectedIcon(savedMeal.icon || 'bookmark'); // Definir ícone (ou padrão)
    // Guardar estado original para comparar alterações
    setOriginalSavedMeal({
      ...savedMeal,
      foods: foodsCopy,
    });
    setShowSavedMealsModal(false);
  };

  // Verificar se houve alterações
  const hasChanges = () => {
    if (!editingSavedMeal || !originalSavedMeal) return false;
    
    // Comparar nome
    if (editingSavedMealName.trim() !== originalSavedMeal.name) return true;
    
    // Comparar ícone
    if (selectedIcon !== (originalSavedMeal.icon || 'bookmark')) return true;
    
    // Comparar tipo de refeição
    if (selectedMealType !== originalSavedMeal.mealType) return true;
    
    // Comparar alimentos (quantidade e estrutura)
    if (editingSavedMealFoods.length !== originalSavedMeal.foods.length) return true;
    
    // Comparar cada alimento
    for (let i = 0; i < editingSavedMealFoods.length; i++) {
      const current = editingSavedMealFoods[i];
      const original = originalSavedMeal.foods[i];
      
      if (!original) return true;
      
      if (current.id !== original.id ||
          current.name !== original.name ||
          current.quantity !== original.quantity ||
          current.weight !== original.weight ||
          current.caloriesPer100g !== original.caloriesPer100g ||
          current.proteinPer100g !== original.proteinPer100g ||
          current.carbsPer100g !== original.carbsPer100g ||
          current.fatPer100g !== original.fatPer100g) {
        return true;
      }
    }
    
    return false;
  };

  // Ícones disponíveis para escolher (relacionados a comida, refeições e hora da refeição)
  const availableIcons = [
    { name: 'breakfast', icon: '🌅', label: 'Breakfast' },
    { name: 'sunrise', icon: '🌄', label: 'Sunrise' },
    { name: 'coffee', icon: '☕', label: 'Coffee' },
    { name: 'croissant', icon: '🥐', label: 'Croissant' },
    { name: 'bread', icon: '🍞', label: 'Bread' },
    { name: 'egg', icon: '🥚', label: 'Egg' },
    { name: 'pancakes', icon: '🥞', label: 'Pancakes' },
    { name: 'lunch', icon: '🍽️', label: 'Lunch' },
    { name: 'plate', icon: '🍲', label: 'Plate' },
    { name: 'bowl', icon: '🥣', label: 'Bowl' },
    { name: 'rice', icon: '🍚', label: 'Rice' },
    { name: 'pasta', icon: '🍝', label: 'Pasta' },
    { name: 'sandwich', icon: '🥪', label: 'Sandwich' },
    { name: 'burger', icon: '🍔', label: 'Burger' },
    { name: 'pizza', icon: '🍕', label: 'Pizza' },
    { name: 'taco', icon: '🌮', label: 'Taco' },
    { name: 'salad', icon: '🥗', label: 'Salad' },
    { name: 'soup', icon: '🍜', label: 'Soup' },
    { name: 'dinner', icon: '🌙', label: 'Dinner' },
    { name: 'moon', icon: '🌛', label: 'Moon' },
    { name: 'steak', icon: '🥩', label: 'Steak' },
    { name: 'chicken', icon: '🍗', label: 'Chicken' },
    { name: 'fish', icon: '🐟', label: 'Fish' },
    { name: 'shrimp', icon: '🦐', label: 'Shrimp' },
    { name: 'snack', icon: '🍿', label: 'Snack' },
    { name: 'cookie', icon: '🍪', label: 'Cookie' },
    { name: 'cake', icon: '🎂', label: 'Cake' },
    { name: 'apple', icon: '🍎', label: 'Apple' },
    { name: 'banana', icon: '🍌', label: 'Banana' },
    { name: 'orange', icon: '🍊', label: 'Orange' },
    { name: 'strawberry', icon: '🍓', label: 'Strawberry' },
    { name: 'grapes', icon: '🍇', label: 'Grapes' },
    { name: 'watermelon', icon: '🍉', label: 'Watermelon' },
    { name: 'pineapple', icon: '🍍', label: 'Pineapple' },
    { name: 'avocado', icon: '🥑', label: 'Avocado' },
    { name: 'tomato', icon: '🍅', label: 'Tomato' },
    { name: 'carrot', icon: '🥕', label: 'Carrot' },
    { name: 'broccoli', icon: '🥦', label: 'Broccoli' },
    { name: 'corn', icon: '🌽', label: 'Corn' },
    { name: 'pepper', icon: '🌶️', label: 'Pepper' },
    { name: 'mushroom', icon: '🍄', label: 'Mushroom' },
    { name: 'cheese', icon: '🧀', label: 'Cheese' },
    { name: 'milk', icon: '🥛', label: 'Milk' },
    { name: 'yogurt', icon: '🥤', label: 'Yogurt' },
    { name: 'icecream', icon: '🍦', label: 'Ice Cream' },
    { name: 'donut', icon: '🍩', label: 'Donut' },
    { name: 'pretzel', icon: '🥨', label: 'Pretzel' },
    { name: 'bagel', icon: '🥯', label: 'Bagel' },
    { name: 'muffin', icon: '🧁', label: 'Muffin' },
  ];

  // Função para obter o ícone do Ionicons baseado no nome
  const getIoniconName = (iconName: string): string => {
    const iconMap: Record<string, string> = {
      'bookmark': 'bookmark',
      'heart': 'heart',
      'star': 'star',
      'fire': 'flame',
      'trophy': 'trophy',
      'diamond': 'diamond',
      'rocket': 'rocket',
      'sun': 'sunny',
      'moon': 'moon',
      'leaf': 'leaf',
      'apple': 'nutrition',
      'pizza': 'pizza',
    };
    return iconMap[iconName] || 'bookmark';
  };

  // Adicionar alimento à refeição guardada em edição
  const addFoodToSavedMeal = (food: FoodItem) => {
    // Verificar limite de 5 alimentos
    if (editingSavedMealFoods.length >= 5) {
      Toast.show({
        type: 'info',
        text1: t('addMeal.maxFoodsReached') || 'Limite atingido',
        text2: t('addMeal.maxFoodsMessage') || 'Podes adicionar no máximo 5 alimentos por refeição',
      });
      return;
    }

    const uniqueId = `${food.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const foodToAdd = {
      id: uniqueId,
      name: food.name,
      caloriesPer100g: food.calories || 0,
      proteinPer100g: food.protein || 0,
      carbsPer100g: food.carbs || 0,
      fatPer100g: food.fat || 0,
      weight: 100,
      quantity: 1,
      sugarsPer100g: food.sugars,
      fiberPer100g: food.fiber,
      sodiumPer100g: food.sodium,
      saturatedFatPer100g: food.saturatedFat,
      transFatPer100g: food.transFat,
    };

    setEditingSavedMealFoods(prevFoods => [...prevFoods, foodToAdd]);
    
    Toast.show({
      type: 'success',
      text1: t('addMeal.added') || 'Added',
      text2: t('addMeal.foodAddedToList', { food: food.name }) || `${food.name} added to list`,
    });
  };

  // Guardar alterações na refeição guardada (sem adicionar ao diário)
  const saveSavedMealChanges = async () => {
    if (!user || !editingSavedMeal || savingChanges) return;

    // Validar nome
    const finalMealName = editingSavedMealName.trim();
    if (!finalMealName) {
      Toast.show({
        type: 'info',
        text1: t('addMeal.mealNameRequired') || 'Nome da refeição necessário',
        text2: t('addMeal.pleaseEnterMealName') || 'Por favor, insira um nome para a refeição',
      });
      return;
    }

    setSavingChanges(true);
    try {
      // Limpar campos undefined dos alimentos antes de salvar
      const cleanedFoods = removeUndefinedFields(editingSavedMealFoods);
      
      // Atualizar refeição guardada
      await updateDoc(doc(db, 'savedMeals', editingSavedMeal.id), {
        name: finalMealName,
        foods: cleanedFoods,
        mealType: selectedMealType,
        icon: selectedIcon,
        updatedAt: Timestamp.now(),
      });

      // Recarregar lista de refeições guardadas
      await loadSavedMeals();
      
      // Atualizar estado original
      setOriginalSavedMeal({
        ...editingSavedMeal,
        name: finalMealName,
        foods: cleanedFoods,
        mealType: selectedMealType,
        icon: selectedIcon,
      });
      
      // Fechar tela de edição e voltar para lista de refeições guardadas
      setEditingSavedMeal(null);
      setEditingSavedMealFoods([]);
      setEditingSavedMealName('');
      setSelectedIcon('bookmark');
      setShowSavedMealsModal(true);
    } catch (error: any) {
      console.error('Error saving changes:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Erro',
        text2: error.message || t('addMeal.couldNotSaveChanges') || 'Não foi possível guardar as alterações',
      });
    } finally {
      setSavingChanges(false);
    }
  };

  // Adicionar refeição guardada editada
  const addSavedMeal = async () => {
    if (!user || !editingSavedMeal || editingSavedMealFoods.length === 0 || addingMeal) return;

    setAddingMeal(true);
    try {
      // Atualizar lastUsed, nome, ícone e alimentos se foram alterados
      const finalMealName = editingSavedMealName.trim() || editingSavedMeal.name;
      const cleanedFoods = removeUndefinedFields(editingSavedMealFoods);
      
      await updateDoc(doc(db, 'savedMeals', editingSavedMeal.id), {
        name: finalMealName,
        foods: cleanedFoods,
        mealType: selectedMealType,
        icon: selectedIcon,
        lastUsed: Timestamp.now(),
      });

      // Adicionar alimentos da refeição guardada (usando versão editada)
      const totals = editingSavedMealFoods.reduce((acc, food) => {
        const multiplier = (food.weight / 100) * (food.quantity || 1);
        return {
          calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
          protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
          carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
          fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
          sugars: acc.sugars + (food.sugarsPer100g ? parseFloat((food.sugarsPer100g * multiplier).toFixed(1)) : 0),
          fiber: acc.fiber + (food.fiberPer100g ? parseFloat((food.fiberPer100g * multiplier).toFixed(1)) : 0),
          sodium: acc.sodium + (food.sodiumPer100g ? parseFloat((food.sodiumPer100g * multiplier).toFixed(1)) : 0),
          saturatedFat: acc.saturatedFat + (food.saturatedFatPer100g ? parseFloat((food.saturatedFatPer100g * multiplier).toFixed(1)) : 0),
          transFat: acc.transFat + (food.transFatPer100g ? parseFloat((food.transFatPer100g * multiplier).toFixed(1)) : 0),
          totalWeight: acc.totalWeight + food.weight * (food.quantity || 1),
        };
      }, { 
        calories: 0, 
        protein: 0, 
        carbs: 0, 
        fat: 0,
        sugars: 0,
        fiber: 0,
        sodium: 0,
        saturatedFat: 0,
        transFat: 0,
        totalWeight: 0,
      });

      // Calcular Health Score
      const healthScore = calculateHealthScoreAndSuggestions(
        totals.calories,
        totals.protein,
        totals.carbs,
        totals.fat,
        totals.sugars > 0 ? totals.sugars : undefined,
        totals.fiber > 0 ? totals.fiber : undefined,
        totals.sodium > 0 ? totals.sodium : undefined,
        totals.saturatedFat > 0 ? totals.saturatedFat : undefined,
        totals.transFat > 0 ? totals.transFat : undefined,
        totals.totalWeight > 0 ? totals.totalWeight : undefined
      ).score;

      // Usar data selecionada se disponível
      let mealDate: Date;
      if (selectedDateParam) {
        mealDate = new Date(selectedDateParam);
      } else {
        mealDate = new Date();
      }
      const addedAt = new Date();

      // Preparar lista de alimentos para salvar (refeição guardada)
      const foodsToSave = editingSavedMealFoods.map(food => ({
        name: food.name,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        weight: food.weight,
        quantity: food.quantity || 1,
      }));

      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: finalMealName,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        image: null,
        mealType: selectedMealType,
        healthScore: healthScore,
        date: Timestamp.fromDate(mealDate),
        addedAt: Timestamp.fromDate(addedAt),
        foods: foodsToSave, // Lista de alimentos individuais
        ...(totals.sugars > 0 && { sugars: totals.sugars }),
        ...(totals.fiber > 0 && { fiber: totals.fiber }),
        ...(totals.sodium > 0 && { sodium: totals.sodium }),
        ...(totals.saturatedFat > 0 && { saturatedFat: totals.saturatedFat }),
        ...(totals.transFat > 0 && { transFat: totals.transFat }),
      });

      // Invalidar cache (rápido, não bloquear)
      const daysWithMealsCacheKey = `daysWithMeals_${user.uid}`;
      removeCache(daysWithMealsCacheKey).catch(() => {});

      // Mostrar toast e navegar IMEDIATAMENTE (não esperar pelo resto)
      Toast.show({
        type: 'success',
        text1: t('addMeal.mealAdded') || 'Meal added!',
        text2: (t('addMeal.savedMealAdded') || '{name} was added to your diary').replace('{name}', finalMealName),
      });

      // Fechar tela de edição e voltar IMEDIATAMENTE
      setEditingSavedMeal(null);
      setEditingSavedMealFoods([]);
      setEditingSavedMealName('');
      setSelectedIcon('bookmark');
      navigation.goBack();

      // Executar operações pesadas em background (não bloquear navegação)
      Promise.all([
        updateStreak(user.uid),
        refreshProfile(),
      ]).then(() => {
        // Verificar badges após streak e profile atualizados
        checkAndShowBadges(user.uid).catch(err => {
          console.error('Error checking badges:', err);
        });
      }).catch(err => {
        console.error('Error updating streak/profile:', err);
      });
    } catch (error: any) {
      console.error('Error adding saved meal:', error);
      Toast.show({
        type: 'error',
        text1: t('addMeal.error') || 'Error',
        text2: error.message || t('addMeal.couldNotAddMeal') || 'Could not add meal',
      });
    } finally {
      setAddingMeal(false);
    }
  };

  // Carregar refeições guardadas quando o modal abrir
  useEffect(() => {
    if (showSavedMealsModal && user) {
      loadSavedMeals();
    }
  }, [showSavedMealsModal, user]);

  // Garantir que plateFoods sempre tem pelo menos um item quando editingFood existe
  useEffect(() => {
    if (editingFood && capturedImage && plateFoods.length === 0) {
      const singleFood = {
        name: editingFood.name,
        caloriesPer100g: editingFood.calories,
        proteinPer100g: editingFood.protein,
        carbsPer100g: editingFood.carbs,
        fatPer100g: editingFood.fat,
        weight: 100,
      };
      setPlateFoods([singleFood]);
    }
  }, [editingFood, capturedImage, plateFoods.length]);

  // Note: barcode scanning UI has been removed temporarily.

  // Se estiver a editar alimento analisado
  if (editingFood && capturedImage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {!theme?.isDark && (
          <LinearGradient
            colors={['#F0FDF4', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        {theme?.isDark && (
          <LinearGradient
            colors={['#1A2E1F', theme.colors.background || '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
          />
        )}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 0,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border || '#E5E7EB',
        }}>
          <TouchableOpacity onPress={() => {
            try {
            setEditingFood(null);
            setCapturedImage(null);
            setAnalyzedFood(null);
              setQuantity(1);
              setPlateFoods([]);
            } catch (error) {
              console.error('Error resetting state:', error);
            }
          }} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary || '#3BB273'} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
            }}>
              {t('addMeal.editFood')}
            </Text>
            <Text style={{
              fontSize: 13,
              color: theme.colors.textSecondary || '#9CA3AF',
            }}>
              {t('addMeal.editFoodDescription')}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
          {/* Imagem */}
          {capturedImage && (
            <View style={{
              marginBottom: 24,
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: theme.colors.card,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <Image
                source={{ uri: capturedImage }}
                style={{ width: '100%', height: 250 }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Tipo de Refeição - Select Melhorado */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: 12,
            }}>
              {t('addMeal.mealType')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowMealTypeModal(true)}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 20, marginRight: 12 }}>
                  {mealTypes.find(t => t.value === selectedMealType)?.icon}
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {mealTypes.find(t => t.value === selectedMealType)?.label}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
            </TouchableOpacity>

            {/* Modal de Seleção */}
            <Modal
              visible={showMealTypeModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowMealTypeModal(false)}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  justifyContent: 'flex-end',
                }}
                activeOpacity={1}
                onPress={() => setShowMealTypeModal(false)}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.background,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingTop: 20,
                    paddingBottom: 40,
                    paddingHorizontal: 24,
                  }}
                  onStartShouldSetResponder={() => true}
                >
                  {/* Handle Bar */}
                  <View style={{
                    width: 40,
                    height: 4,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 2,
                    alignSelf: 'center',
                    marginBottom: 20,
                  }} />

                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: 20,
                  }}>
                    {t('addMeal.selectMealType') || 'Selecionar Tipo de Refeição'}
                  </Text>

                  {mealTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        setSelectedMealType(type.value);
                        setShowMealTypeModal(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: selectedMealType === type.value
                          ? theme.colors.primary + '20'
                          : 'transparent',
                        marginBottom: 8,
                        borderWidth: selectedMealType === type.value ? 2 : 0,
                        borderColor: theme.colors.primary || '#3BB273',
                      }}
                    >
                      <Text style={{ fontSize: 24, marginRight: 16 }}>
                        {type.icon}
                      </Text>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: selectedMealType === type.value ? '700' : '500',
                        color: theme.colors.text,
                        flex: 1,
                      }}>
                        {type.label}
                      </Text>
                      {selectedMealType === type.value && (
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

          {/* Formulário Editável - Aparece quando está editando um alimento */}
          {editingFood && (
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}>
            {/* Nome e Quantidade */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                {t('addMeal.foodName')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput
                value={editingFood.name}
                onChangeText={(text) => {
                  setEditingFood({ ...editingFood, name: text });
                  // Se houver múltiplos alimentos, atualizar o nome também
                  if (plateFoods.length > 0) {
                    // O nome pode ser editado manualmente, mas não vamos atualizar os alimentos individuais
                  }
                }}
                style={{
                    flex: 1,
                  backgroundColor: theme.colors.background,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: theme.colors.text,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
                placeholder={t('addMeal.foodNamePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              />
                {/* Seletor de Quantidade */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                }}>
                  <TouchableOpacity
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={20} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                    minWidth: 30,
                    textAlign: 'center',
                  }}>
                    {quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setQuantity(quantity + 1)}
                    style={{
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Tipo de Refeição - Movido para baixo do nome */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                {t('addMeal.mealType')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowMealTypeModal(true)}
                style={{
                  backgroundColor: theme.colors.background,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>
                    {mealTypes.find(t => t.value === selectedMealType)?.icon}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {mealTypes.find(t => t.value === selectedMealType)?.label}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            {/* Alimentos do Prato */}
            {plateFoods && plateFoods.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.colors.text,
                  marginBottom: 12,
                }}>
                  {t('addMeal.plateFoods')}
                </Text>
                
                {plateFoods.map((food, index) => (
                  <View key={index} style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                  }}>
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: theme.colors.text,
                      marginBottom: 8,
                    }}>
                      {food.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{
                        fontSize: 13,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        flex: 1,
                      }}>
                        {t('addMeal.weight')} ({getFoodUnit(food.name)}):
                      </Text>
                      <TextInput
                        value={formatFoodWeight(food.weight, food.name).toString()}
                        onChangeText={(text) => {
                          const num = parseFloat(text) || 0;
                          // Converter conforme unidade
                          const weightInGrams = units.weight === 'lb' ? ouncesToGrams(num) : num;
                          const updatedFoods = [...plateFoods];
                          updatedFoods[index] = { ...food, weight: weightInGrams };
                          setPlateFoods(updatedFoods);
                          
                          // Recalcular totais
                          const totals = updatedFoods.reduce((acc, f) => {
                            const multiplier = f.weight / 100;
                            return {
                              calories: acc.calories + Math.round(f.caloriesPer100g * multiplier),
                              protein: acc.protein + parseFloat((f.proteinPer100g * multiplier).toFixed(1)),
                              carbs: acc.carbs + parseFloat((f.carbsPer100g * multiplier).toFixed(1)),
                              fat: acc.fat + parseFloat((f.fatPer100g * multiplier).toFixed(1)),
                            };
                          }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
                          
                          setEditingFood({
                            ...editingFood!,
                            calories: totals.calories,
                            protein: totals.protein,
                            carbs: totals.carbs,
                            fat: totals.fat,
                          });
                        }}
                        keyboardType="numeric"
                        style={{
                          backgroundColor: theme.colors.card,
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 15,
                          color: theme.colors.text,
                          borderWidth: 1,
                          borderColor: theme.colors.border || '#E5E7EB',
                          width: 100,
                          textAlign: 'right',
                        }}
                        placeholder={units.weight === 'lb' ? "3.5" : "100"}
                        placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Campo de Descrição para Ajustar com IA */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                {t('addMeal.adjustDescription') || 'Ajustar com descrição'}
              </Text>
              <Text style={{
                fontSize: 12,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 8,
              }}>
                {t('addMeal.adjustDescriptionHint') || 'Descreva alimentos que faltam, erros ou detalhes que não foram detectados na imagem'}
              </Text>
              <TextInput
                value={foodDescription}
                onChangeText={setFoodDescription}
                placeholder={t('addMeal.adjustDescriptionPlaceholder') || 'Ex: Tem também batata frita, o arroz está mais cozido, falta salada...'}
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: theme.colors.background,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  color: theme.colors.text,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />
              {foodDescription.trim().length > 0 && (
                <TouchableOpacity
                  onPress={async () => {
                    if (!foodDescription.trim() || analyzingDescription) return;
                    
                    setAnalyzingDescription(true);
                    try {
                      const analyzed = await analyzeFoodDescription(
                        foodDescription,
                        plateFoods.length > 0 ? plateFoods : [{
                          name: editingFood.name,
                          caloriesPer100g: editingFood.calories,
                          proteinPer100g: editingFood.protein,
                          carbsPer100g: editingFood.carbs,
                          fatPer100g: editingFood.fat,
                          weight: 100,
                        }],
                        language
                      );
                      
                      if (analyzed.plateFoods && analyzed.plateFoods.length > 0) {
                        setPlateFoods(analyzed.plateFoods);
                        
                        const totals = analyzed.plateFoods.reduce((acc, f) => {
                          const multiplier = f.weight / 100;
                          return {
                            calories: acc.calories + Math.round(f.caloriesPer100g * multiplier),
                            protein: acc.protein + parseFloat((f.proteinPer100g * multiplier).toFixed(1)),
                            carbs: acc.carbs + parseFloat((f.carbsPer100g * multiplier).toFixed(1)),
                            fat: acc.fat + parseFloat((f.fatPer100g * multiplier).toFixed(1)),
                            // Dados nutricionais adicionais
                            sugars: acc.sugars + (f.sugarsPer100g ? parseFloat((f.sugarsPer100g * multiplier).toFixed(1)) : 0),
                            fiber: acc.fiber + (f.fiberPer100g ? parseFloat((f.fiberPer100g * multiplier).toFixed(1)) : 0),
                            sodium: acc.sodium + (f.sodiumPer100g ? parseFloat((f.sodiumPer100g * multiplier).toFixed(1)) : 0),
                            saturatedFat: acc.saturatedFat + (f.saturatedFatPer100g ? parseFloat((f.saturatedFatPer100g * multiplier).toFixed(1)) : 0),
                            transFat: acc.transFat + (f.transFatPer100g ? parseFloat((f.transFatPer100g * multiplier).toFixed(1)) : 0),
                            totalWeight: acc.totalWeight + f.weight,
                          };
                        }, { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, fiber: 0, sodium: 0, saturatedFat: 0, transFat: 0, totalWeight: 0 });
                        
                        setEditingFood({
                          ...editingFood,
                          name: analyzed.name,
                          calories: totals.calories,
                          protein: totals.protein,
                          carbs: totals.carbs,
                          fat: totals.fat,
                        });
                        
                        setFoodDescription('');
                        
                        Toast.show({
                          type: 'success',
                          text1: t('addMeal.adjustSuccess') || 'Sucesso',
                          text2: t('addMeal.adjustSuccessMessage') || 'Alimentos ajustados com sucesso',
                        });
                      }
                    } catch (error: any) {
                      console.error('Error analyzing description:', error);
                      Toast.show({
                        type: 'error',
                        text1: t('addMeal.error') || 'Erro',
                        text2: error.message || t('addMeal.adjustError') || 'Erro ao ajustar alimentos',
                      });
                    } finally {
                      setAnalyzingDescription(false);
                    }
                  }}
                  disabled={analyzingDescription || !foodDescription.trim()}
                  style={{
                    backgroundColor: analyzingDescription || !foodDescription.trim()
                      ? theme.colors.border || '#E5E7EB'
                      : theme.colors.primary || '#3BB273',
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    marginTop: 12,
                    opacity: analyzingDescription || !foodDescription.trim() ? 0.5 : 1,
                  }}
                >
                  {analyzingDescription ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      {t('addMeal.adjustButton') || 'Ajustar'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Valores Nutricionais Calculados (apenas leitura) */}
            <View style={{
              backgroundColor: theme.colors.primary + '10',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 12,
              }}>
                {t('addMeal.nutritionalValues')}
              </Text>
              
              {/* Calorias */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{
                  fontSize: 12,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  marginBottom: 4,
                }}>
                  {t('addMeal.calories')}
                </Text>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.primary || '#3BB273',
                }}>
                  {Math.round(editingFood.calories * quantity)} kcal
                </Text>
              </View>

              {/* Macros */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Proteína */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 11,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginBottom: 4,
                  }}>
                    {t('addMeal.protein')}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {Math.round(editingFood.protein * quantity)}g
                  </Text>
                </View>
                {/* Carboidratos */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 11,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginBottom: 4,
                  }}>
                    {t('addMeal.carbs')}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {Math.round(editingFood.carbs * quantity)}g
                  </Text>
                </View>
                {/* Gordura */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 11,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginBottom: 4,
                  }}>
                    {t('addMeal.fat')}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {Math.round(editingFood.fat * quantity)}g
                  </Text>
                </View>
              </View>
            </View>

            {/* Health Score */}
            {editingFood.calories && editingFood.calories > 0 && (
              <View style={{
                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: '#FCE7F3',
                alignItems: 'center',
                justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="heart-outline" size={20} color="#EC4899" />
                  </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                    color: theme.colors.text,
                    flex: 1,
              }}>
                    {t('dashboard.healthScore') || 'Health score'}
              </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {getHealthScoreData().score}/10
                  </Text>
          </View>
                {/* Progress Bar */}
      <View style={{
                  height: 8,
                  backgroundColor: theme.isDark ? '#374151' : '#E5E7EB',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}>
                  <View style={{
                    height: '100%',
                    width: `${(getHealthScoreData().score / 10) * 100}%`,
                    backgroundColor: getHealthScoreData().score >= 7 
                      ? '#10B981' 
                      : getHealthScoreData().score >= 5 
                      ? '#F59E0B' 
                      : '#EF4444',
                    borderRadius: 4,
                  }} />
                </View>
                {/* Sugestões de Melhorias */}
                {getHealthScoreData().suggestions.length > 0 && (
                  <View style={{
                    backgroundColor: theme.isDark ? '#111827' : '#FFFFFF',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#374151' : '#E5E7EB',
                  }}>
          <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
            color: theme.colors.text,
                      marginBottom: 8,
          }}>
                      {t('addMeal.improvementSuggestions') || 'Sugestões de melhorias:'}
          </Text>
                    {getHealthScoreData().suggestions.map((suggestion, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                        <Ionicons name="bulb-outline" size={16} color="#F59E0B" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={{
                          fontSize: 12,
            color: theme.colors.textSecondary || '#9CA3AF',
                          flex: 1,
          }}>
                          {t(suggestion) || suggestion}
          </Text>
        </View>
                    ))}
      </View>
                )}
              </View>
            )}

            {/* Botões Salvar e Guardar */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={savePhotoMealTemplate}
                disabled={savingMeal}
                activeOpacity={savingMeal ? 1 : 0.7}
                style={{
          flex: 1,
                  backgroundColor: savingMeal 
                    ? (theme.colors.textSecondary || '#9CA3AF') + '80' 
                    : theme.isDark ? '#374151' : '#E5E7EB',
                  borderRadius: 16,
                  paddingVertical: 16,
          alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                {savingMeal && (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                )}
                <Ionicons 
                  name="bookmark-outline" 
                  size={20} 
                  color={savingMeal ? theme.colors.textSecondary || '#9CA3AF' : theme.colors.text} 
                />
          <Text style={{
                  color: savingMeal ? theme.colors.textSecondary || '#9CA3AF' : theme.colors.text,
            fontSize: 16,
                  fontWeight: '700',
          }}>
                  {savingMeal ? t('addMeal.saving') : t('addMeal.saveTemplate')}
          </Text>
              </TouchableOpacity>
          <TouchableOpacity
                onPress={handleSaveEditedFood}
                disabled={addingMeal}
                activeOpacity={addingMeal ? 1 : 0.7}
            style={{
                  flex: 1,
                  backgroundColor: addingMeal 
                    ? (theme.colors.primary || '#3BB273') + '80' 
                    : theme.colors.primary || '#3BB273',
                  borderRadius: 16,
                  paddingVertical: 16,
              alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                {addingMeal && (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                )}
              <Text style={{
                  color: '#FFFFFF',
                fontSize: 16,
                  fontWeight: '700',
              }}>
                  {addingMeal ? t('addMeal.adding') : t('addMeal.saveMeal')}
              </Text>
          </TouchableOpacity>
            </View>
          </View>
          )}
        </ScrollView>

        {/* Modal de Seleção de Tipo de Refeição - Para modo camera */}
          <Modal
            visible={showMealTypeModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowMealTypeModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'flex-end',
              }}
              activeOpacity={1}
              onPress={() => setShowMealTypeModal(false)}
            >
              <View
                style={{
                  backgroundColor: theme.colors.background,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingTop: 20,
                  paddingBottom: 60,
                  paddingHorizontal: 24,
                }}
                onStartShouldSetResponder={() => true}
              >
                {/* Handle Bar */}
                <View style={{
                  width: 40,
                  height: 4,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 20,
                }} />

                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: 20,
                }}>
                  {t('addMeal.selectMealType') || 'Selecionar Tipo de Refeição'}
                </Text>

                {mealTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => {
                      setSelectedMealType(type.value);
                      setShowMealTypeModal(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: selectedMealType === type.value
                        ? theme.colors.primary + '20'
                        : 'transparent',
                      marginBottom: 8,
                      borderWidth: selectedMealType === type.value ? 2 : 0,
                      borderColor: theme.colors.primary || '#3BB273',
                    }}
                  >
                    <Text style={{ fontSize: 24, marginRight: 16 }}>
                      {type.icon}
                    </Text>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: selectedMealType === type.value ? '700' : '500',
                      color: theme.colors.text,
                      flex: 1,
                    }}>
                      {type.label}
                    </Text>
                    {selectedMealType === type.value && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {!theme?.isDark && (
        <LinearGradient
          colors={['#F0FDF4', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 0,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border || '#E5E7EB',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary || '#3BB273'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
          }}>
            {t('addMeal.title')}
          </Text>
          <Text style={{
            fontSize: 13,
            color: theme.colors.textSecondary || '#9CA3AF',
          }}>
            {mode === 'search' ? t('addMeal.searchDescription') : 
             mode === 'camera' ? t('addMeal.cameraDescription') : 
             mode === 'confirm' ? (t('addMeal.confirmDescription') || 'Confirma e edita a refeição sugerida') :
             t('addMeal.barcodeDescription')}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => setShowSavedMealsModal(true)} 
          style={{ 
            padding: 8,
          }}
        >
          <Ionicons name="bookmark" size={24} color={theme.colors.primary || '#3BB273'} />
        </TouchableOpacity>
        </View>

      {loading ? (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <ActivityIndicator size="large" color={theme.colors.primary || '#3BB273'} />
          <Text style={{
            marginTop: 16,
            color: theme.colors.textSecondary || '#9CA3AF',
            fontSize: 16,
          }}>
            {isSearching ? (t('addMeal.searching') || 'Searching...') : (t('addMeal.analyzing') || 'Analyzing image...')}
          </Text>
        </View>
      ) : (
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>

        {/* Pesquisa ou Código de Barras */}
        {mode === 'search' ? (
          <View style={{ marginBottom: 24 }}>
            <View style={{ 
              flexDirection: 'row', 
              gap: 12,
              alignItems: 'center',
            }}>
              <View style={{ 
                flex: 1, 
                position: 'relative',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: theme.isDark ? 0.3 : 0.1,
                shadowRadius: 8,
                elevation: 3,
              }}>
                <Ionicons
                  name="search"
                  size={22}
                  color={theme.colors.primary || '#3BB273'}
                  style={{ position: 'absolute', left: 16, top: 16, zIndex: 1 }}
                />
                <TextInput
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 16,
                    paddingLeft: 50,
                    paddingRight: 16,
                    paddingVertical: 16,
                    color: theme.colors.text,
                    borderWidth: 2,
                    borderColor: searchQuery ? (theme.colors.primary || '#3BB273') : (theme.colors.border || '#E5E7EB'),
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                  placeholder={t('addMeal.searchPlaceholder') || 'Pesquisar alimento...'}
                  placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity
                onPress={handleSearch}
                disabled={loading || !searchQuery.trim()}
                style={{
                  backgroundColor: loading || !searchQuery.trim() 
                    ? (theme.colors.textSecondary || '#9CA3AF')
                    : (theme.colors.primary || '#3BB273'),
                  borderRadius: 16,
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loading || !searchQuery.trim() ? 0.6 : 1,
                  shadowColor: theme.colors.primary || '#3BB273',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="search" size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : mode === 'barcode' ? (
          <View style={{ marginBottom: 24 }}>
            {/* Scanner de Código de Barras */}
            {showBarcodeScanner && cameraPermission?.granted ? (
              <View style={{ 
                height: 400,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: theme.colors.primary || '#3BB273',
                marginBottom: 16,
                position: 'relative',
              }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
                  }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                {/* Overlay com posicionamento absoluto */}
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingBottom: 20,
                }}>
                  <View style={{
                    width: '80%',
                    height: 200,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    borderRadius: 12,
                    backgroundColor: 'transparent',
                  }} />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '600',
                    marginTop: 16,
                    textAlign: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}>
                    {t('addMeal.scanBarcode') || 'Aponte a câmera para o código de barras'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowBarcodeScanner(false);
                      setScanned(false);
                    }}
                    style={{
                      marginTop: 16,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                    }}>
                      {t('common.cancel') || 'Cancelar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  if (!cameraPermission?.granted) {
                    const result = await requestCameraPermission();
                    if (!result.granted) {
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: t('profile.cameraPermissionRequired') || 'Permissão de câmera necessária',
                      });
                      return;
                    }
                  }
                  setShowBarcodeScanner(true);
                  setScanned(false);
                }}
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  marginBottom: 12,
                }}
              >
                <Ionicons name="barcode" size={20} color={theme.colors.primary || '#3BB273'} />
                <Text style={{
                  color: theme.colors.text,
                  fontWeight: '600',
                  marginLeft: 8,
                  fontSize: 16,
                }}>
                  📷 {t('addMeal.scanBarcode') || 'Escanear Código de Barras'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Input Manual de Código de Barras */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, position: 'relative' }}>
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={theme.colors.textSecondary || '#9CA3AF'}
                  style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}
                />
                <TextInput
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    paddingLeft: 44,
                    paddingRight: 12,
                    paddingVertical: 14,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    fontSize: 16,
                  }}
                  placeholder={t('addMeal.barcodePlaceholder') || 'Ou digite o código de barras...'}
                  placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  onSubmitEditing={handleBarcodeSearch}
                  returnKeyType="search"
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                onPress={handleBarcodeSearch}
                disabled={loading}
                style={{
                  backgroundColor: theme.colors.primary || '#3BB273',
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="search" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Botão de Câmera - apenas se for modo camera */}
        {mode === 'camera' && (
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              activeOpacity={0.8}
              style={{
                backgroundColor: theme.colors.primary || '#3BB273',
                borderRadius: 20,
                paddingVertical: 20,
                paddingHorizontal: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: theme.colors.primary || '#3BB273',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="camera" size={28} color="#FFFFFF" />
              </View>
              <Text style={{
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: 18,
              }}>
                {t('addMeal.camera') || 'Tirar Foto'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sugestões de Alimentos Populares - Aparece apenas quando não está editando e não há resultados */}
        {mode === 'search' && !editingFood && !selectedFoods.length && foodResults.length === 0 && !loading && !isSearching && (() => {
          // Mapeamento de alimentos populares em todos os idiomas
          const popularFoods = [
            { pt: 'arroz', en: 'rice', es: 'arroz', fr: 'riz', de: 'reis', it: 'riso' },
            { pt: 'frango', en: 'chicken', es: 'pollo', fr: 'poulet', de: 'huhn', it: 'pollo' },
            { pt: 'batata', en: 'potato', es: 'patata', fr: 'pomme de terre', de: 'kartoffel', it: 'patata' },
            { pt: 'ovo', en: 'egg', es: 'huevo', fr: 'œuf', de: 'ei', it: 'uovo' },
            { pt: 'banana', en: 'banana', es: 'plátano', fr: 'banane', de: 'banane', it: 'banana' },
            { pt: 'pão', en: 'bread', es: 'pan', fr: 'pain', de: 'brot', it: 'pane' },
          ];
          
          const getFoodName = (food: typeof popularFoods[0]) => {
            const langMap: Record<string, keyof typeof popularFoods[0]> = {
              'pt': 'pt',
              'en': 'en',
              'es': 'es',
              'fr': 'fr',
              'de': 'de',
              'it': 'it',
            };
            const langKey = langMap[language] || 'en';
            return food[langKey] || food.en;
          };
          
          return (
            <>
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: 16,
                }}>
                  {t('addMeal.popularFoods') || 'Alimentos Populares'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {popularFoods.map((food) => {
                    const foodName = getFoodName(food);
                    return (
                      <TouchableOpacity
                        key={food.pt}
                        onPress={() => {
                          setSearchQuery(foodName);
                          handleSearch();
                        }}
                        style={{
                          backgroundColor: theme.colors.card,
                          borderRadius: 16,
                          paddingHorizontal: 20,
                          paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                          minWidth: 100,
                }}
              >
                <Text style={{
                  fontSize: 16,
                          fontWeight: '600',
                          color: theme.colors.text,
                          textAlign: 'center',
                }}>
                          {foodName.charAt(0).toUpperCase() + foodName.slice(1)}
                </Text>
              </TouchableOpacity>
                    );
                  })}
            </View>
                <View style={{
                  marginTop: 24,
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="bulb-outline" size={20} color={theme.colors.primary || '#3BB273'} />
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: theme.colors.text,
                      marginLeft: 8,
                    }}>
                      {t('addMeal.searchTip') || 'Dica de Pesquisa'}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    lineHeight: 20,
                  }}>
                    {t('addMeal.searchTipMessage') || 'Pesquise por nome do alimento, tipo de comida ou ingrediente. Podes pesquisar em qualquer idioma!'}
                  </Text>
                </View>
              </View>
              {/* Ad Banner - Abaixo do card de pesquisa */}
              <AdBanner
                adSize="banner"
                position="inline"
              />
            </>
          );
        })()}

        {/* Resultados da Pesquisa */}
        {foodResults.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
            <Text style={{
                fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
            }}>
              {t('addMeal.results') || 'Resultados'}
            </Text>
              <View style={{
                backgroundColor: theme.colors.primary + '20',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.colors.primary || '#3BB273',
                }}>
                  {foodResults.length}
                </Text>
              </View>
            </View>
            {foodResults.map((food, index) => (
              <MotiView
                key={food.id}
                from={{ opacity: 0, translateY: 20, scale: 0.95 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ 
                  type: 'timing', 
                  duration: 300,
                  delay: index * 50,
                }}
              >
                <TouchableOpacity
                  onPress={() => addFoodToList(food)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: theme.isDark ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: theme.colors.text,
                        marginBottom: 8,
                        lineHeight: 22,
                      }}>
                        {food.name}
                      </Text>
                      
                      {/* Badges de macros */}
                      <View style={{ 
                        flexDirection: 'row', 
                        flexWrap: 'wrap', 
                        gap: 8,
                        marginBottom: 12,
                      }}>
                        <View style={{
                          backgroundColor: theme.isDark ? '#78350F' : '#FEF3C7',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '600',
                            color: theme.isDark ? '#FCD34D' : '#92400E',
                          }}>
                            {t('addMeal.calories') || 'Calories'}: {food.calories} kcal
                        </Text>
                        </View>
                        <View style={{
                          backgroundColor: theme.isDark ? '#1E3A8A' : '#DBEAFE',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '600',
                            color: theme.isDark ? '#93C5FD' : '#1E40AF',
                          }}>
                            {t('addMeal.protein') || 'Protein'}: {food.protein}g
                        </Text>
                        </View>
                        <View style={{
                          backgroundColor: theme.isDark ? '#831843' : '#FCE7F3',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '600',
                            color: theme.isDark ? '#F9A8D4' : '#9F1239',
                          }}>
                            {t('addMeal.carbs') || 'Carbs'}: {food.carbs}g
                        </Text>
                        </View>
                        <View style={{
                          backgroundColor: theme.isDark ? '#581C87' : '#F3E8FF',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}>
                          <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '600',
                            color: theme.isDark ? '#C4B5FD' : '#6B21A8',
                          }}>
                            {t('addMeal.fat') || 'Fat'}: {food.fat}g
                        </Text>
                      </View>
                    </View>
                      
                      <Text style={{
                        fontSize: 12,
                        color: theme.colors.textSecondary || '#9CA3AF',
                      }}>
                        {units.weight === 'lb' ? '3.5oz' : '100g'}
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        addFoodToList(food);
                      }}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: theme.colors.primary || '#3BB273',
                        borderRadius: 12,
                        width: 44,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 12,
                        shadowColor: theme.colors.primary || '#3BB273',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Ionicons name="add" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </MotiView>
            ))}
          </View>
        )}

        {/* Lista de Alimentos Selecionados */}
        {selectedFoods.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            {/* Nome da Refeição - Aparece apenas quando há alimentos selecionados */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 12,
              }}>
                {t('addMeal.mealName') || 'Nome da Refeição'}
              </Text>
              <TextInput
                style={{
                  backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#FFFFFF'),
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.border || (theme.isDark ? '#374151' : '#E5E7EB'),
                  fontSize: 16,
                  color: theme.colors.text,
                }}
                placeholder={t('addMeal.mealNamePlaceholder') || 'Ex: Almoço, Jantar, Lanche...'}
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                value={mealName}
                onChangeText={setMealName}
              />
            </View>

            {/* Tipo de Refeição */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 12,
              }}>
                {t('addMeal.mealType')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowMealTypeModal(true)}
                style={{
                  backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#FFFFFF'),
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.border || (theme.isDark ? '#374151' : '#E5E7EB'),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>
                    {mealTypes.find(t => t.value === selectedMealType)?.icon}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {mealTypes.find(t => t.value === selectedMealType)?.label}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: theme.colors.text,
              }}>
                {t('addMeal.selectedFoods') || 'Alimentos Selecionados'}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFoods([])}
                style={{ padding: 4 }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            {selectedFoods.map((food, index) => {
              const multiplier = (food.weight / 100) * (food.quantity || 1);
              const calories = Math.round(food.caloriesPer100g * multiplier);
              const protein = parseFloat((food.proteinPer100g * multiplier).toFixed(1));
              const carbs = parseFloat((food.carbsPer100g * multiplier).toFixed(1));
              const fat = parseFloat((food.fatPer100g * multiplier).toFixed(1));

              return (
                <View
                  key={food.id}
                  style={{
                    backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#FFFFFF'),
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border || (theme.isDark ? '#374151' : '#E5E7EB'),
                    shadowColor: theme.isDark ? '#000000' : '#000000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: theme.isDark ? 0.2 : 0.05,
                    shadowRadius: 2,
                    elevation: theme.isDark ? 0 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: theme.colors.text,
                        marginBottom: 8,
                      }}>
                        {food.name}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          {calories} kcal
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          P: {protein}g
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          C: {carbs}g
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          G: {fat}g
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeFoodFromList(food.id)}
                      style={{ padding: 4, marginLeft: 8 }}
                    >
                      <Ionicons name="close-circle" size={24} color={theme.colors.textSecondary || '#9CA3AF'} />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Quantidade e Peso */}
                  <View style={{ 
                    backgroundColor: theme.isDark ? '#0F172A' : '#F9FAFB',
                    borderRadius: 12,
                    padding: 12,
                    gap: 12,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#334155' : '#E5E7EB',
                  }}>
                    {/* Quantidade */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{
                      fontSize: 13,
                      color: theme.colors.textSecondary || '#9CA3AF',
                        fontWeight: '500',
                      }}>
                        {t('addMeal.quantity') || 'Quantidade'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 110 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedFoods(prevFoods => prevFoods.map(f => 
                              f.id === food.id 
                                ? { ...f, quantity: Math.max(1, (f.quantity || 1) - 1) }
                                : f
                            ));
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: theme.colors.background,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: theme.colors.border || '#E5E7EB',
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={18} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: theme.colors.text,
                          minWidth: 30,
                          textAlign: 'center',
                        }}>
                          {food.quantity || 1}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            if ((food.quantity || 1) < 10) {
                              setSelectedFoods(prevFoods => prevFoods.map(f => 
                                f.id === food.id 
                                  ? { ...f, quantity: (f.quantity || 1) + 1 }
                                  : f
                              ));
                            }
                          }}
                          disabled={(food.quantity || 1) >= 10}
                          style={{
                            width: 32,
                            height: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: theme.colors.background,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: theme.colors.border || '#E5E7EB',
                            opacity: (food.quantity || 1) >= 10 ? 0.5 : 1,
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={18} color={theme.colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Peso */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{
                        fontSize: 13,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        fontWeight: '500',
                      }}>
                        {t('addMeal.weight')} ({getFoodUnit(food.name)})
                    </Text>
                    <TextInput
                      value={formatFoodWeight(food.weight, food.name).toString()}
                      onChangeText={(text) => {
                        const weight = parseFloat(text) || 0;
                        updateFoodWeight(food.id, weight);
                      }}
                      keyboardType="numeric"
                      style={{
                        backgroundColor: theme.colors.background,
                          borderWidth: 1,
                          borderColor: theme.colors.border || '#E5E7EB',
                        borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        fontSize: 14,
                        color: theme.colors.text,
                          width: 110,
                        textAlign: 'right',
                      }}
                      placeholder={units.weight === 'lb' ? "3.5" : "100"}
                      placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                    />
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Totais */}
            {/* Health Score para lista de alimentos */}
            {selectedFoods.length > 0 && (() => {
              const totals = calculateTotals();
              const healthScoreData = calculateHealthScoreAndSuggestions(
                totals.calories,
                totals.protein,
                totals.carbs,
                totals.fat,
                totals.sugars > 0 ? totals.sugars : undefined,
                totals.fiber > 0 ? totals.fiber : undefined,
                totals.sodium > 0 ? totals.sodium : undefined,
                totals.saturatedFat > 0 ? totals.saturatedFat : undefined,
                totals.transFat > 0 ? totals.transFat : undefined,
                totals.totalWeight > 0 ? totals.totalWeight : undefined
              );
              return (
                <View style={{
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: '#FCE7F3',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="heart-outline" size={20} color="#EC4899" />
                    </View>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: theme.colors.text,
                      flex: 1,
                    }}>
                      {t('dashboard.healthScore') || 'Health score'}
                    </Text>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}>
                      {healthScoreData.score}/10
                    </Text>
                  </View>
                  {/* Progress Bar */}
                  <View style={{
                    height: 8,
                    backgroundColor: theme.isDark ? '#374151' : '#E5E7EB',
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginBottom: healthScoreData.suggestions.length > 0 ? 12 : 0,
                  }}>
                    <View style={{
                      height: '100%',
                      width: `${(healthScoreData.score / 10) * 100}%`,
                      backgroundColor: healthScoreData.score >= 7 
                        ? '#10B981' 
                        : healthScoreData.score >= 5 
                        ? '#F59E0B' 
                        : '#EF4444',
                      borderRadius: 4,
                    }} />
                  </View>
                  {/* Sugestões de Melhorias */}
                  {healthScoreData.suggestions.length > 0 && (
                    <View style={{
                      backgroundColor: theme.isDark ? '#111827' : '#FFFFFF',
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: theme.isDark ? '#374151' : '#E5E7EB',
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: theme.colors.text,
                        marginBottom: 8,
                      }}>
                        {t('addMeal.improvementSuggestions') || 'Sugestões de melhorias:'}
                      </Text>
                      {healthScoreData.suggestions.map((suggestion, index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                          <Ionicons name="bulb-outline" size={16} color="#F59E0B" style={{ marginRight: 8, marginTop: 2 }} />
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            flex: 1,
                          }}>
                            {t(suggestion) || suggestion}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {selectedFoods.length > 0 && (
              <View style={{
                backgroundColor: theme.colors.primary + '10',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.colors.text,
                  marginBottom: 12,
                }}>
                  {t('addMeal.total') || 'Total'}
                </Text>
                {(() => {
                  const totals = calculateTotals();
                  return (
                    <>
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{
                          fontSize: 12,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          marginBottom: 4,
                        }}>
                          {t('addMeal.calories')}
                        </Text>
                        <Text style={{
                          fontSize: 20,
                          fontWeight: '700',
                          color: theme.colors.primary || '#3BB273',
                        }}>
                          {totals.calories} kcal
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 4,
                          }}>
                            {t('addMeal.protein')}
                          </Text>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {Math.round(totals.protein)}g
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 4,
                          }}>
                            {t('addMeal.carbs')}
                          </Text>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {Math.round(totals.carbs)}g
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 4,
                          }}>
                            {t('addMeal.fat')}
                          </Text>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {Math.round(totals.fat)}g
                          </Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>
            )}

            {/* Botões Guardar e Adicionar Refeição */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={saveMealTemplate}
                disabled={savingMeal || selectedFoods.length === 0}
                activeOpacity={(savingMeal || selectedFoods.length === 0) ? 1 : 0.7}
                style={{
                  flex: 1,
                  backgroundColor: (savingMeal || selectedFoods.length === 0)
                    ? (theme.colors.textSecondary || '#9CA3AF') + '80' 
                    : theme.isDark ? '#374151' : '#E5E7EB',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                {savingMeal && (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                )}
                <Ionicons 
                  name="bookmark-outline" 
                  size={20} 
                  color={(savingMeal || selectedFoods.length === 0) ? theme.colors.textSecondary || '#9CA3AF' : theme.colors.text} 
                />
                <Text style={{
                  color: (savingMeal || selectedFoods.length === 0) ? theme.colors.textSecondary || '#9CA3AF' : theme.colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                }}>
                  {savingMeal ? t('addMeal.saving') : t('addMeal.saveTemplate')}
                </Text>
              </TouchableOpacity>
            <TouchableOpacity
              onPress={addMealFromList}
              disabled={addingMeal || selectedFoods.length === 0}
              activeOpacity={addingMeal ? 1 : 0.7}
              style={{
                  flex: 1,
                backgroundColor: (addingMeal || selectedFoods.length === 0)
                  ? (theme.colors.primary || '#3BB273') + '80'
                  : theme.colors.primary || '#3BB273',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {addingMeal && (
                <ActivityIndicator size="small" color="#FFFFFF" />
              )}
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '700',
              }}>
                {addingMeal ? t('addMeal.adding') : t('addMeal.addMeal')}
              </Text>
            </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      )}

      {/* Modal de Refeições Guardadas */}
      <Modal
        visible={showSavedMealsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSavedMealsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View style={{
            flex: 1,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 20,
            paddingBottom: Math.max(20, 20),
            overflow: 'hidden',
          }}>
            {!theme.isDark && (
              <LinearGradient
                colors={['#F0FDF4', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            )}
            {theme.isDark && (
              <LinearGradient
                colors={['#0F1A14', theme.colors.background || '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            )}
            {/* Header do Modal */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border || '#E5E7EB',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.text,
                }}>
                  {t('addMeal.savedMeals') || 'Refeições Guardadas'}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  marginTop: 4,
                }}>
                  {t('addMeal.savedMealsDescription') || 'Adicione rapidamente refeições que guardou anteriormente'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSavedMealsModal(false)}
                style={{ padding: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Lista de Refeições Guardadas */}
            <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
              {loadingSavedMeals ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color={theme.colors.primary || '#3BB273'} />
                </View>
              ) : savedMeals.length === 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                  <Ionicons name="bookmark-outline" size={64} color={theme.colors.textSecondary || '#9CA3AF'} />
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                    marginTop: 16,
                    marginBottom: 8,
                  }}>
                    {t('addMeal.noSavedMeals') || 'Nenhuma refeição guardada'}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    textAlign: 'center',
                  }}>
                    {t('addMeal.noSavedMealsDescription') || 'Guarde refeições para adicioná-las rapidamente mais tarde'}
                  </Text>
                </View>
              ) : (
                savedMeals.map((meal) => {
                  const totals = meal.foods.reduce((acc, food) => {
                    const multiplier = (food.weight / 100) * (food.quantity || 1);
                    return {
                      calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
                      protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
                      carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
                      fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
                    };
                  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

                  return (
                    <TouchableOpacity
                      key={meal.id}
                      onPress={() => openEditSavedMeal(meal)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: theme.colors.border || '#E5E7EB',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: theme.colors.primary + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          {availableIcons.find(i => i.name === (meal.icon || 'bookmark')) ? (
                            <Text style={{ fontSize: 24 }}>
                              {availableIcons.find(i => i.name === (meal.icon || 'bookmark'))?.icon}
                            </Text>
                          ) : (
                            <Ionicons name="bookmark" size={24} color={theme.colors.primary || '#3BB273'} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: theme.colors.text,
                            marginBottom: 4,
                          }}>
                            {meal.name}
                          </Text>
                          <Text style={{
                            fontSize: 12,
                            color: theme.colors.textSecondary || '#9CA3AF',
                          }}>
                            {meal.foods.length} {meal.foods.length === 1 ? t('addMeal.food') || 'alimento' : t('addMeal.foods') || 'alimentos'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => openEditSavedMeal(meal)}
                          style={{
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: theme.colors.primary || '#3BB273',
                          }}
                        >
                          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                        <View>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 2,
                          }}>
                            {t('addMeal.calories')}
                          </Text>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: theme.colors.primary || '#3BB273',
                          }}>
                            {totals.calories} kcal
                          </Text>
                        </View>
                        <View>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 2,
                          }}>
                            {t('addMeal.protein')}
                          </Text>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {Math.round(totals.protein)}g
                          </Text>
                        </View>
                        <View>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 2,
                          }}>
                            {t('addMeal.carbs')}
                          </Text>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {Math.round(totals.carbs)}g
                          </Text>
                        </View>
                        <View>
                          <Text style={{
                            fontSize: 11,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            marginBottom: 2,
                          }}>
                            {t('addMeal.fat')}
                          </Text>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: theme.colors.text,
                          }}>
                            {Math.round(totals.fat)}g
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
    </SafeAreaView>
      </Modal>

      {/* Modal de Edição de Refeição Guardada */}
      {editingSavedMeal && (
        <Modal
          visible={editingSavedMeal !== null}
          transparent={false}
          animationType="slide"
          onRequestClose={() => {
            // Voltar para lista de refeições guardadas
            setEditingSavedMeal(null);
            setEditingSavedMealFoods([]);
            setEditingSavedMealName('');
            setSelectedIcon('bookmark');
            setOriginalSavedMeal(null);
            setShowSavedMealsModal(true);
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            {!theme?.isDark && (
              <LinearGradient
                colors={['#F0FDF4', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            )}
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border || '#E5E7EB',
            }}>
              <TouchableOpacity
                onPress={() => {
                  // Voltar para lista de refeições guardadas
                  setEditingSavedMeal(null);
                  setEditingSavedMealFoods([]);
                  setEditingSavedMealName('');
                  setSelectedIcon('bookmark');
                  setOriginalSavedMeal(null);
                  setShowSavedMealsModal(true);
                }}
                style={{ marginRight: 16 }}
              >
                <Ionicons name="arrow-back" size={24} color={theme.colors.primary || '#3BB273'} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.text,
                }}>
                  {editingSavedMealName || editingSavedMeal.name}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.colors.textSecondary || '#9CA3AF',
                }}>
                  {t('addMeal.editSavedMeal') || 'Editar e adicionar refeição'}
                </Text>
              </View>
              {/* Botão de Salvar (aparece apenas quando há alterações) */}
              {hasChanges() && (
                <TouchableOpacity
                  onPress={saveSavedMealChanges}
                  disabled={savingChanges}
                  style={{ padding: 8, marginRight: 8 }}
                >
                  {savingChanges ? (
                    <ActivityIndicator size="small" color={theme.colors.primary || '#3BB273'} />
                  ) : (
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (!editingSavedMeal || !user) return;
                  setShowDeleteConfirmModal(true);
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="trash-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
              {/* Nome da Refeição */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  marginBottom: 12,
                }}>
                  {t('addMeal.mealName') || 'Nome da Refeição'}
                </Text>
                <TextInput
                  value={editingSavedMealName}
                  onChangeText={setEditingSavedMealName}
                  placeholder={t('addMeal.mealNamePlaceholder') || 'Nome da refeição'}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    fontSize: 16,
                    color: theme.colors.text,
                  }}
                  placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                />
              </View>

              {/* Tipo de Refeição */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  marginBottom: 12,
                }}>
                  {t('addMeal.mealType')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowMealTypeModal(true)}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 20, marginRight: 12 }}>
                      {mealTypes.find(t => t.value === selectedMealType)?.icon}
                    </Text>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text,
                    }}>
                      {mealTypes.find(t => t.value === selectedMealType)?.label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
                </TouchableOpacity>
              </View>

              {/* Ícone Personalizado */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  marginBottom: 12,
                }}>
                  {t('addMeal.customIcon') || 'Ícone'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowIconPicker(true)}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: theme.colors.primary + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      {availableIcons.find(i => i.name === selectedIcon) ? (
                        <Text style={{ fontSize: 24 }}>
                          {availableIcons.find(i => i.name === selectedIcon)?.icon}
                        </Text>
                      ) : (
                        <Ionicons name="bookmark" size={20} color={theme.colors.primary || '#3BB273'} />
                      )}
                    </View>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text,
                    }}>
                      {availableIcons.find(i => i.name === selectedIcon)?.label || t('addMeal.customIcon') || 'Ícone'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
                </TouchableOpacity>
              </View>

              {/* Lista de Alimentos */}
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {t('addMeal.selectedFoods') || 'Alimentos'}
                  </Text>
                </View>
                {editingSavedMealFoods.map((food) => {
                  const calories = Math.round(food.caloriesPer100g * (food.weight / 100) * (food.quantity || 1));
                  const protein = parseFloat((food.proteinPer100g * (food.weight / 100) * (food.quantity || 1)).toFixed(1));
                  const carbs = parseFloat((food.carbsPer100g * (food.weight / 100) * (food.quantity || 1)).toFixed(1));
                  const fat = parseFloat((food.fatPer100g * (food.weight / 100) * (food.quantity || 1)).toFixed(1));

                  return (
                    <View
                      key={food.id}
                      style={{
                        backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: theme.colors.border || '#E5E7EB',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: theme.colors.text,
                            marginBottom: 4,
                          }}>
                            {food.name}
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                              {calories} kcal
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                              P: {protein}g
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                              C: {carbs}g
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                              G: {fat}g
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingSavedMealFoods(prevFoods => prevFoods.filter(f => f.id !== food.id));
                          }}
                          style={{ padding: 4, marginLeft: 8 }}
                        >
                          <Ionicons name="close-circle" size={24} color={theme.colors.textSecondary || '#9CA3AF'} />
                        </TouchableOpacity>
                      </View>
                      {/* Quantidade e Peso */}
                      <View style={{ 
                        backgroundColor: theme.isDark ? '#0F172A' : '#E2E8F0',
                        borderRadius: 12,
                        padding: 12,
                        gap: 12,
                        borderWidth: 1,
                        borderColor: theme.isDark ? '#334155' : '#CBD5E1',
                      }}>
                        {/* Quantidade */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{
                            fontSize: 13,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            fontWeight: '500',
                          }}>
                            {t('addMeal.quantity') || 'Quantidade'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 110 }}>
                            <TouchableOpacity
                              onPress={() => {
                                if ((food.quantity || 1) > 1) {
                                  setEditingSavedMealFoods(prevFoods => prevFoods.map(f =>
                                    f.id === food.id ? { ...f, quantity: (f.quantity || 1) - 1 } : f
                                  ));
                                }
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme.colors.background,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: theme.colors.border || '#E5E7EB',
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="remove" size={18} color={theme.colors.text} />
                            </TouchableOpacity>
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: theme.colors.text,
                              minWidth: 30,
                              textAlign: 'center',
                            }}>
                              {food.quantity || 1}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                if ((food.quantity || 1) < 10) {
                                  setEditingSavedMealFoods(prevFoods => prevFoods.map(f =>
                                    f.id === food.id ? { ...f, quantity: (f.quantity || 1) + 1 } : f
                                  ));
                                }
                              }}
                              disabled={(food.quantity || 1) >= 10}
                              style={{
                                width: 32,
                                height: 32,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: theme.colors.background,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: theme.colors.border || '#E5E7EB',
                                opacity: (food.quantity || 1) >= 10 ? 0.5 : 1,
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="add" size={18} color={theme.colors.text} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        
                        {/* Peso */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{
                            fontSize: 13,
                            color: theme.colors.textSecondary || '#9CA3AF',
                            fontWeight: '500',
                          }}>
                            {t('addMeal.weight')} ({getFoodUnit(food.name)})
                          </Text>
                          <TextInput
                            value={formatFoodWeight(food.weight, food.name).toString()}
                            onChangeText={(text) => {
                              const num = parseFloat(text) || 0;
                              // Converter conforme unidade
                              const weightInGrams = units.weight === 'lb' ? ouncesToGrams(num) : num;
                              if (weightInGrams > 0) {
                                setEditingSavedMealFoods(prevFoods => prevFoods.map(f =>
                                  f.id === food.id ? { ...f, weight: weightInGrams } : f
                                ));
                              }
                            }}
                            keyboardType="numeric"
                            style={{
                              backgroundColor: theme.colors.background,
                              borderWidth: 1,
                              borderColor: theme.colors.border || '#E5E7EB',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              fontSize: 14,
                              color: theme.colors.text,
                              width: 110,
                              textAlign: 'right',
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Totais */}
              {editingSavedMealFoods.length > 0 && (() => {
                const totals = editingSavedMealFoods.reduce((acc, food) => {
                  const multiplier = (food.weight / 100) * (food.quantity || 1);
                  return {
                    calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
                    protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
                    carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
                    fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
                  };
                }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

                return (
                  <View style={{
                    backgroundColor: theme.colors.primary + '10',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: theme.colors.text,
                      marginBottom: 12,
                    }}>
                      {t('addMeal.total') || 'Total'}
                    </Text>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{
                        fontSize: 12,
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginBottom: 4,
                      }}>
                        {t('addMeal.calories')}
                      </Text>
                      <Text style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: theme.colors.primary || '#3BB273',
                      }}>
                        {totals.calories} kcal
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 11,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          marginBottom: 4,
                        }}>
                          {t('addMeal.protein')}
                        </Text>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: theme.colors.text,
                        }}>
                          {Math.round(totals.protein)}g
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 11,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          marginBottom: 4,
                        }}>
                          {t('addMeal.carbs')}
                        </Text>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: theme.colors.text,
                        }}>
                          {Math.round(totals.carbs)}g
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 11,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          marginBottom: 4,
                        }}>
                          {t('addMeal.fat')}
                        </Text>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: theme.colors.text,
                        }}>
                          {Math.round(totals.fat)}g
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Botão Adicionar */}
              <TouchableOpacity
                onPress={addSavedMeal}
                disabled={addingMeal || editingSavedMealFoods.length === 0}
                activeOpacity={addingMeal ? 1 : 0.7}
                style={{
                  backgroundColor: (addingMeal || editingSavedMealFoods.length === 0)
                    ? (theme.colors.primary || '#3BB273') + '80'
                    : theme.colors.primary || '#3BB273',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                {addingMeal && (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                )}
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                }}>
                  {addingMeal ? t('addMeal.adding') : t('addMeal.addMeal')}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal de Seleção de Ícone */}
            <Modal
              visible={showIconPicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowIconPicker(false)}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  justifyContent: 'flex-end',
                }}
                activeOpacity={1}
                onPress={() => setShowIconPicker(false)}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.background,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingTop: 12,
                    paddingBottom: Math.max(insets.bottom, 20),
                    maxHeight: '80%',
                  }}
                  onStartShouldSetResponder={() => true}
                >
                  {/* Handle Bar */}
                  <View style={{
                    width: 40,
                    height: 4,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 2,
                    alignSelf: 'center',
                    marginBottom: 20,
                  }} />

                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: 20,
                    paddingHorizontal: 24,
                  }}>
                    {t('addMeal.selectIcon') || 'Selecionar Ícone'}
                  </Text>

                  <ScrollView 
                    contentContainerStyle={{
                      paddingHorizontal: 24,
                      paddingBottom: 20,
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 12,
                      justifyContent: 'center',
                    }}
                    showsVerticalScrollIndicator={false}
                  >
                    {availableIcons.map((icon) => (
                      <TouchableOpacity
                        key={icon.name}
                        onPress={() => {
                          setSelectedIcon(icon.name);
                          setShowIconPicker(false);
                        }}
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 12,
                          backgroundColor: selectedIcon === icon.name
                            ? theme.colors.primary + '20'
                            : theme.isDark ? '#1F2937' : '#F9FAFB',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: selectedIcon === icon.name ? 2 : 1,
                          borderColor: selectedIcon === icon.name
                            ? theme.colors.primary || '#3BB273'
                            : theme.colors.border || '#E5E7EB',
                        }}
                      >
                        <Text style={{ fontSize: 32 }}>
                          {icon.icon}
                        </Text>
                        {selectedIcon === icon.name && (
                          <View style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: theme.colors.primary || '#3BB273',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Modal de Confirmação de Eliminação */}
            <Modal
              visible={showDeleteConfirmModal}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowDeleteConfirmModal(false)}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={1}
                onPress={() => setShowDeleteConfirmModal(false)}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: 20,
                    width: '85%',
                    maxWidth: 400,
                    padding: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                  onStartShouldSetResponder={() => true}
                >
                  {/* Ícone de Aviso */}
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    marginBottom: 20,
                  }}>
                    <Ionicons name="trash-outline" size={32} color="#EF4444" />
                  </View>

                  {/* Título */}
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: theme.colors.text,
                    textAlign: 'center',
                    marginBottom: 12,
                  }}>
                    {t('addMeal.deleteSavedMeal') || 'Eliminar refeição guardada'}
                  </Text>

                  {/* Mensagem */}
                  <Text style={{
                    fontSize: 15,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    textAlign: 'center',
                    marginBottom: 24,
                    lineHeight: 22,
                  }}>
                    {t('addMeal.deleteSavedMealConfirm') || 'Tens a certeza que queres eliminar esta refeição guardada?'}
                  </Text>

                  {/* Botões */}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setShowDeleteConfirmModal(false)}
                      style={{
                        flex: 1,
                        backgroundColor: theme.isDark ? '#1F2937' : '#F3F4F6',
                        borderRadius: 12,
                        paddingVertical: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: theme.colors.text,
                      }}>
                        {t('common.cancel') || 'Cancelar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!editingSavedMeal || !user) return;
                        setShowDeleteConfirmModal(false);
                        try {
                          await deleteDoc(doc(db, 'savedMeals', editingSavedMeal.id));
                          Toast.show({
                            type: 'success',
                            text1: t('addMeal.savedMealDeleted') || 'Refeição eliminada',
                            text2: t('addMeal.savedMealDeletedMessage') || 'A refeição guardada foi eliminada com sucesso',
                          });
                          setEditingSavedMeal(null);
                          setEditingSavedMealFoods([]);
                          setEditingSavedMealName('');
                          setSelectedIcon('bookmark');
                          setOriginalSavedMeal(null);
                          // Recarregar lista de refeições guardadas
                          await loadSavedMeals();
                          // Voltar para lista de refeições guardadas
                          setShowSavedMealsModal(true);
                        } catch (error: any) {
                          console.error('Error deleting saved meal:', error);
                          Toast.show({
                            type: 'error',
                            text1: t('addMeal.error') || 'Erro',
                            text2: error.message || t('addMeal.couldNotDeleteSavedMeal') || 'Não foi possível eliminar a refeição',
                          });
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: '#EF4444',
                        borderRadius: 12,
                        paddingVertical: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#FFFFFF',
                      }}>
                        {t('common.delete') || 'Eliminar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Modal de Seleção de Tipo de Refeição (dentro do modal de edição) */}
            <Modal
              visible={showMealTypeModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowMealTypeModal(false)}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  justifyContent: 'flex-end',
                }}
                activeOpacity={1}
                onPress={() => setShowMealTypeModal(false)}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.background,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingTop: 20,
                    paddingBottom: 40,
                    paddingHorizontal: 24,
                  }}
                  onStartShouldSetResponder={() => true}
                >
                  {/* Handle Bar */}
                  <View style={{
                    width: 40,
                    height: 4,
                    backgroundColor: theme.colors.border || '#E5E7EB',
                    borderRadius: 2,
                    alignSelf: 'center',
                    marginBottom: 20,
                  }} />

                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.text,
                    marginBottom: 20,
                  }}>
                    {t('addMeal.selectMealType') || 'Selecionar Tipo de Refeição'}
                  </Text>

                  {mealTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => {
                        setSelectedMealType(type.value);
                        setShowMealTypeModal(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: selectedMealType === type.value
                          ? theme.colors.primary + '20'
                          : 'transparent',
                        marginBottom: 8,
                        borderWidth: selectedMealType === type.value ? 2 : 0,
                        borderColor: theme.colors.primary || '#3BB273',
                      }}
                    >
                      <Text style={{ fontSize: 24, marginRight: 16 }}>
                        {type.icon}
                      </Text>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: selectedMealType === type.value ? '700' : '500',
                        color: theme.colors.text,
                        flex: 1,
                      }}>
                        {type.label}
                      </Text>
                      {selectedMealType === type.value && (
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          </SafeAreaView>
        </Modal>
      )}

      {/* Modal de Seleção de Tipo de Refeição - Para modo search/barcode */}
      <Modal
        visible={showMealTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMealTypeModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setShowMealTypeModal(false)}
        >
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 20,
              paddingBottom: 60,
              paddingHorizontal: 24,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle Bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 20,
            }} />

            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 20,
            }}>
              {t('addMeal.selectMealType') || 'Selecionar Tipo de Refeição'}
            </Text>

            {mealTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => {
                  setSelectedMealType(type.value);
                  setShowMealTypeModal(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: selectedMealType === type.value
                    ? theme.colors.primary + '20'
                    : 'transparent',
                  marginBottom: 8,
                  borderWidth: selectedMealType === type.value ? 2 : 0,
                  borderColor: theme.colors.primary || '#3BB273',
                }}
              >
                <Text style={{ fontSize: 24, marginRight: 16 }}>
                  {type.icon}
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontWeight: selectedMealType === type.value ? '700' : '500',
                  color: theme.colors.text,
                  flex: 1,
                }}>
                  {type.label}
                </Text>
                {selectedMealType === type.value && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Badge Notification Modal */}
      <BadgeNotificationModal
        visible={showModal}
        badge={earnedBadge}
        onClose={closeModal}
      />
    </SafeAreaView>
  );
}

