/**
 * AddMealScreen
 * 
 * Tela para adicionar refeição com pesquisa, câmera e código de barras
 */

import React, { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { searchFood, getFoodByBarcode, analyzeFoodImage, analyzeFoodDescription, FoodItem } from '../services/api';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
// Removido: import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// Usando base64 em vez de Firebase Storage (solução gratuita)
import { updateStreak } from '../utils/streakUtils';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';

export function AddMealScreen({ navigation, route }: any) {
  const { user, refreshProfile } = useUser();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const mode = route?.params?.mode || 'search';
  const [searchQuery, setSearchQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
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
  }>>([]);
  const [foodDescription, setFoodDescription] = useState('');
  const [analyzingDescription, setAnalyzingDescription] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState<Array<{
    id: string;
    name: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    weight: number; // peso em gramas
  }>>([]);

  const mealTypes = [
    { value: 'breakfast', label: 'Pequeno-almoço', icon: '☕' },
    { value: 'lunch', label: 'Almoço', icon: '🍽️' },
    { value: 'dinner', label: 'Jantar', icon: '🌙' },
    { value: 'snack', label: 'Lanche', icon: '🍎' },
  ] as const;

  // Solicitar permissões
  React.useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus === 'granted');
    })();
  }, []);

  // Se o modo for 'camera', abrir câmera automaticamente
  React.useEffect(() => {
    if (mode === 'camera') {
      handleTakePhoto();
    } else if (mode === 'barcode') {
      // TODO: Implementar scanner de código de barras
      Toast.show({
        type: 'info',
        text1: 'Funcionalidade em desenvolvimento',
        text2: 'Scanner de código de barras em breve!',
      });
    }
  }, [mode]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const results = await searchFood(searchQuery);
      setFoodResults(results);
      if (results.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'Nenhum resultado',
          text2: 'Tenta pesquisar com outros termos',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao pesquisar alimentos',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
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
        }
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      console.error('Error details:', error.message);
      
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao tirar foto. Tente novamente.',
      });
      setLoading(false);
    }
  };

  // Barcode scanning temporarily disabled to avoid native build issues.
  const handleBarcodeScan = async (_data: string) => {
    Toast.show({
      type: 'info',
      text1: 'Funcionalidade temporariamente desativada',
      text2: 'Ler código de barras foi desativado para esta versão.',
    });
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
    // Verificar se já existe na lista
    const exists = selectedFoods.find(f => f.id === food.id);
    if (exists) {
      Toast.show({
        type: 'info',
        text1: 'Alimento já adicionado',
        text2: 'Este alimento já está na lista',
      });
      return;
    }

    // Adicionar à lista com peso padrão de 100g
    setSelectedFoods([...selectedFoods, {
      id: food.id,
      name: food.name,
      caloriesPer100g: food.calories,
      proteinPer100g: food.protein,
      carbsPer100g: food.carbs,
      fatPer100g: food.fat,
      weight: 100,
    }]);

    Toast.show({
      type: 'success',
      text1: 'Adicionado',
      text2: `${food.name} adicionado à lista`,
    });
  };

  // Remover alimento da lista
  const removeFoodFromList = (id: string) => {
    setSelectedFoods(selectedFoods.filter(f => f.id !== id));
  };

  // Atualizar peso de um alimento
  const updateFoodWeight = (id: string, weight: number) => {
    setSelectedFoods(selectedFoods.map(f => 
      f.id === id ? { ...f, weight: Math.max(0, weight) } : f
    ));
  };

  // Calcular totais da lista
  const calculateTotals = () => {
    return selectedFoods.reduce((acc, food) => {
      const multiplier = food.weight / 100;
      return {
        calories: acc.calories + Math.round(food.caloriesPer100g * multiplier),
        protein: acc.protein + parseFloat((food.proteinPer100g * multiplier).toFixed(1)),
        carbs: acc.carbs + parseFloat((food.carbsPer100g * multiplier).toFixed(1)),
        fat: acc.fat + parseFloat((food.fatPer100g * multiplier).toFixed(1)),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // Adicionar todos os alimentos como uma refeição
  const addMealFromList = async () => {
    if (!user || selectedFoods.length === 0) return;

    try {
      const totals = calculateTotals();
      const mealName = selectedFoods.length === 1 
        ? selectedFoods[0].name 
        : selectedFoods.map(f => f.name).join(', ');

      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: mealName,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        image: null,
        mealType: selectedMealType,
        date: Timestamp.now(),
      });

      // Atualizar streak
      await updateStreak(user.uid);
      await refreshProfile();

      Toast.show({
        type: 'success',
        text1: 'Refeição adicionada!',
        text2: `${selectedFoods.length} alimento(s) adicionado(s) ao teu diário`,
      });

      // Limpar lista e voltar
      setSelectedFoods([]);
      navigation.goBack();
    } catch (error: any) {
      console.error('Error adding meal:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao adicionar refeição',
      });
    }
  };

  // Função antiga mantida para compatibilidade (usada apenas na edição de comida analisada)
  const addMeal = async (food: FoodItem) => {
    if (!user) return;

    try {
      // Converter imagem para base64 se existir
      let imageUrl = food.image || null;
      if (food.image && food.image.startsWith('file://')) {
        imageUrl = await convertImageToBase64(food.image);
        if (!imageUrl) {
          console.warn('Failed to convert image to base64, continuing without image');
        }
      }

      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        image: imageUrl,
        mealType: selectedMealType,
        date: Timestamp.now(),
      });

      // Atualizar streak
      await updateStreak(user.uid);
      await refreshProfile();

      Toast.show({
        type: 'success',
        text1: 'Refeição adicionada!',
        text2: `${food.name} foi adicionado ao teu diário`,
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Error adding meal:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Não foi possível adicionar a refeição',
      });
    }
  };

  const handleSaveEditedFood = () => {
    if (!editingFood) return;
    addMeal(editingFood);
  };

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
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border || '#E5E7EB',
        }}>
          <TouchableOpacity onPress={() => {
            setEditingFood(null);
            setCapturedImage(null);
            setAnalyzedFood(null);
            setFoodWeight(100);
            setNutritionPer100g(null);
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

          {/* Formulário Editável */}
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
            {/* Nome */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                {t('addMeal.foodName')}
              </Text>
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
                        {t('addMeal.weight')} (g):
                      </Text>
                      <TextInput
                        value={food.weight.toString()}
                        onChangeText={(text) => {
                          const weight = parseFloat(text) || 0;
                          const updatedFoods = [...plateFoods];
                          updatedFoods[index] = { ...food, weight };
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
                        placeholder="100"
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
                          };
                        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
                        
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
                  {editingFood.calories} kcal
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
                    {Math.round(editingFood.protein)}g
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
                    {Math.round(editingFood.carbs)}g
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
                    {Math.round(editingFood.fat)}g
                  </Text>
                </View>
              </View>
            </View>

            {/* Botão Salvar */}
            <TouchableOpacity
              onPress={handleSaveEditedFood}
              style={{
                backgroundColor: theme.colors.primary || '#3BB273',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '700',
              }}>
                {t('addMeal.saveMeal')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
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
             t('addMeal.barcodeDescription')}
          </Text>
        </View>
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
            {t('addMeal.analyzing')}
          </Text>
        </View>
      ) : (
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
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
        </View>

        {/* Pesquisa */}
        <View className="mb-6">
          <View className="flex-row gap-2">
            <View className="flex-1 relative">
              <Ionicons
                name="search"
                size={20}
                color="#9CA3AF"
                style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}
              />
              <TextInput
                className="bg-gray-100 dark:bg-gray-800 rounded-xl px-12 py-4 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                placeholder="Pesquisar alimento..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={loading}
              className="bg-green-500 rounded-xl px-6 py-4 items-center justify-center"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="search" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Botões de Ação - apenas se não for modo pesquisa */}
        {mode !== 'search' && (
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              onPress={handleTakePhoto}
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
              <Ionicons name="camera" size={20} color={theme.colors.primary || '#3BB273'} />
              <Text style={{
                color: theme.colors.text,
                fontWeight: '600',
                marginLeft: 8,
                fontSize: 16,
              }}>
                📸 Tirar Foto
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Toast.show({
                  type: 'info',
                  text1: 'Funcionalidade temporariamente desativada',
                  text2: 'Ler código de barras foi desativado para esta versão.',
                });
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
              }}
            >
              <Ionicons name="barcode" size={20} color={theme.colors.primary || '#3BB273'} />
              <Text style={{
                color: theme.colors.text,
                fontWeight: '600',
                marginLeft: 8,
                fontSize: 16,
              }}>
                📷 Ler Código de Barras
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Resultados da Pesquisa */}
        {foodResults.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 16,
            }}>
              {t('addMeal.results') || 'Resultados'}
            </Text>
            {foodResults.map((food) => (
              <MotiView
                key={food.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300 }}
              >
                <TouchableOpacity
                  onPress={() => addFoodToList(food)}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                          {food.calories} kcal/100g
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          P: {food.protein}g
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          C: {food.carbs}g
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#9CA3AF' }}>
                          G: {food.fat}g
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={{
                        backgroundColor: theme.colors.primary || '#3BB273',
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        marginLeft: 12,
                      }}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
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
              const multiplier = food.weight / 100;
              const calories = Math.round(food.caloriesPer100g * multiplier);
              const protein = parseFloat((food.proteinPer100g * multiplier).toFixed(1));
              const carbs = parseFloat((food.carbsPer100g * multiplier).toFixed(1));
              const fat = parseFloat((food.fatPer100g * multiplier).toFixed(1));

              return (
                <View
                  key={food.id}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border || '#E5E7EB',
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
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{
                      fontSize: 13,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      flex: 1,
                    }}>
                      {t('addMeal.weight')} (g):
                    </Text>
                    <TextInput
                      value={food.weight.toString()}
                      onChangeText={(text) => {
                        const weight = parseFloat(text) || 0;
                        updateFoodWeight(food.id, weight);
                      }}
                      keyboardType="numeric"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 14,
                        color: theme.colors.text,
                        borderWidth: 1,
                        borderColor: theme.colors.border || '#E5E7EB',
                        width: 100,
                        textAlign: 'right',
                      }}
                      placeholder="100"
                      placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                    />
                  </View>
                </View>
              );
            })}

            {/* Totais */}
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

            {/* Botão Adicionar Refeição */}
            <TouchableOpacity
              onPress={addMealFromList}
              style={{
                backgroundColor: theme.colors.primary || '#3BB273',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '700',
              }}>
                {t('addMeal.addMeal') || 'Adicionar Refeição'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

