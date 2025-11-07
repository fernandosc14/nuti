/**
 * AddMealScreen
 * 
 * Tela para adicionar refeição com pesquisa, câmera e código de barras
 */

import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { searchFood, getFoodByBarcode, FoodItem } from '../services/api';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updateStreak } from '../utils/streakUtils';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';

export function AddMealScreen({ navigation }: any) {
  const { user, refreshProfile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<
    'breakfast' | 'lunch' | 'dinner' | 'snack'
  >('breakfast');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

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
        Toast.show({
          type: 'info',
          text1: 'Em desenvolvimento',
          text2: 'Análise de imagem com IA em breve!',
        });
        // TODO: Implementar análise de imagem com IA
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao tirar foto',
      });
    }
  };

  const handleBarcodeScan = async (data: string) => {
    setShowBarcodeScanner(false);
    setLoading(true);

    try {
      const food = await getFoodByBarcode(data);
      if (food) {
        await addMeal(food);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Produto não encontrado',
          text2: 'Tenta pesquisar manualmente',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao ler código de barras',
      });
    } finally {
      setLoading(false);
    }
  };

  const addMeal = async (food: FoodItem) => {
    if (!user) return;

    try {
      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        image: food.image,
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
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao adicionar refeição',
      });
    }
  };

  if (showBarcodeScanner) {
    if (hasPermission === null) {
      return (
        <SafeAreaView className="flex-1 bg-black items-center justify-center">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="text-white mt-4">A solicitar permissão...</Text>
        </SafeAreaView>
      );
    }

    if (hasPermission === false) {
      return (
        <SafeAreaView className="flex-1 bg-black items-center justify-center px-6">
          <Ionicons name="camera-outline" size={64} color="#FFFFFF" />
          <Text className="text-white text-xl font-semibold mt-4 text-center">
            Permissão de câmera necessária
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Precisas de permitir acesso à câmera para ler códigos de barras
          </Text>
          <TouchableOpacity
            onPress={() => setShowBarcodeScanner(false)}
            className="bg-green-500 rounded-xl px-6 py-3 mt-6"
          >
            <Text className="text-white font-semibold">Voltar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-black">
        <BarCodeScanner
          onBarCodeScanned={({ data }) => handleBarcodeScan(data)}
          className="flex-1"
        />
        <View className="absolute top-6 left-6">
          <TouchableOpacity
            onPress={() => setShowBarcodeScanner(false)}
            className="bg-black/50 rounded-full p-3"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View className="absolute bottom-10 left-0 right-0 items-center">
          <View className="bg-black/50 rounded-xl px-6 py-3">
            <Text className="text-white text-center">
              Aponta a câmera para o código de barras
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#3BB273" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            Adicionar Refeição
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Pesquisa ou digitaliza um alimento
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
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
            onPress={() => setShowBarcodeScanner(true)}
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
    </SafeAreaView>
  );
}

