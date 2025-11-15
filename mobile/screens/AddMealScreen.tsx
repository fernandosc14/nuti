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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { searchFood, getFoodByBarcode, analyzeFoodImage, FoodItem } from '../services/api';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
          const analyzed = await analyzeFoodImage(imageUri, language);
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
          // Verificar se é erro de "não é comida" e usar tradução
          let errorMessage = error.message || t('addMeal.errorProcessing');
          if (error.message?.includes('does not contain food')) {
            errorMessage = t('addMeal.errorNotFood');
          }
          
          Toast.show({
            type: 'error',
            text1: t('addMeal.error'),
            text2: errorMessage,
          });
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao tirar foto',
      });
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

  // Função para fazer upload da imagem para Firebase Storage
  const uploadImageToStorage = async (imageUri: string): Promise<string | null> => {
    if (!user || !imageUri) return null;
    
    try {
      // Verificar se já é uma URL (não precisa upload)
      if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        return imageUri;
      }

      // Ler o ficheiro como blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Criar referência no Storage
      const timestamp = Date.now();
      const filename = `meals/${user.uid}/${timestamp}.jpg`;
      const storageRef = ref(storage, filename);

      // Fazer upload
      await uploadBytes(storageRef, blob);

      // Obter URL pública
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const addMeal = async (food: FoodItem) => {
    if (!user) return;

    try {
      // Fazer upload da imagem se existir
      let imageUrl = food.image || null;
      if (food.image && food.image.startsWith('file://')) {
        imageUrl = await uploadImageToStorage(food.image);
        if (!imageUrl) {
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {mealTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  onPress={() => setSelectedMealType(type.value)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedMealType === type.value
                      ? theme.colors.primary || '#3BB273'
                      : theme.colors.border || '#E5E7EB',
                    backgroundColor: selectedMealType === type.value
                      ? theme.colors.primary || '#3BB273'
                      : theme.colors.card,
                  }}
                >
                  <Text style={{
                    color: selectedMealType === type.value ? '#FFFFFF' : theme.colors.text,
                    fontWeight: '600',
                  }}>
                    {type.icon} {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
        {/* Tipo de Refeição */}
        <View className="mb-6">
          <Text className="text-gray-700 dark:text-gray-300 mb-3 font-medium">
            Tipo de Refeição
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {mealTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setSelectedMealType(type.value)}
                className={`px-4 py-3 rounded-xl border-2 ${
                  selectedMealType === type.value
                    ? 'bg-green-500 border-green-500'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <Text
                  className={`text-center ${
                    selectedMealType === type.value
                      ? 'text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type.icon} {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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

        {/* Botões de Ação */}
        <View className="mb-6 space-y-3">
          <TouchableOpacity
            onPress={handleTakePhoto}
            className="bg-gray-100 dark:bg-gray-800 rounded-xl py-4 flex-row items-center justify-center border border-gray-200 dark:border-gray-700"
          >
            <Ionicons name="camera" size={20} color="#3BB273" />
            <Text className="text-gray-900 dark:text-white font-semibold ml-2">
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
            className="bg-gray-100 dark:bg-gray-800 rounded-xl py-4 flex-row items-center justify-center border border-gray-200 dark:border-gray-700"
          >
            <Ionicons name="barcode" size={20} color="#3BB273" />
            <Text className="text-gray-900 dark:text-white font-semibold ml-2">
              📷 Ler Código de Barras
            </Text>
          </TouchableOpacity>
        </View>

        {/* Resultados da Pesquisa */}
        {foodResults.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Resultados
            </Text>
            {foodResults.map((food) => (
              <MotiView
                key={food.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300 }}
              >
                <TouchableOpacity
                  onPress={() => addMeal(food)}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-200 dark:border-gray-700"
                >
                  <View className="flex-row items-start">
                    {food.image && (
                      <Image
                        source={{ uri: food.image }}
                        className="w-16 h-16 rounded-lg mr-4"
                        resizeMode="cover"
                      />
                    )}
                    <View className="flex-1">
                      <Text className="text-gray-900 dark:text-white font-semibold text-base mb-2">
                        {food.name}
                      </Text>
                      <View className="flex-row flex-wrap gap-3 mb-3">
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                          {food.calories} kcal
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                          P: {food.protein}g
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                          C: {food.carbs}g
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                          G: {food.fat}g
                        </Text>
                      </View>
                      <TouchableOpacity className="bg-green-500 rounded-xl py-2 px-4 self-start">
                        <Text className="text-white font-semibold text-sm">
                          Adicionar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </MotiView>
            ))}
          </View>
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

