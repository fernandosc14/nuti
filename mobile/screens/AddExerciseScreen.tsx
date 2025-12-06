/**
 * AddExerciseScreen
 * 
 * Screen para adicionar exercícios físicos
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useSelectedDate } from '../context/SelectedDateContext';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, Timestamp, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import Toast from 'react-native-toast-message';
import { ExerciseType, getExerciseConfigs, ExerciseFieldConfig } from '../types/exercise';
import { getExerciseTypeFromName, getExerciseNameFromType } from '../utils/exerciseUtils';
import { useBadgeNotification } from '../hooks/useBadgeNotification';
import { BadgeNotificationModal } from '../components/BadgeNotificationModal';

export function AddExerciseScreen({ navigation, route }: any) {
  const { user, profile } = useUser();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { selectedDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
  const { showModal, earnedBadge, checkAndShowBadges, closeModal } = useBadgeNotification();
  const [selectedExerciseType, setSelectedExerciseType] = useState<string>('');
  const [exerciseDuration, setExerciseDuration] = useState('30');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [addingExercise, setAddingExercise] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exerciseTypeToDelete, setExerciseTypeToDelete] = useState<{id: string, name: string} | null>(null);
  const [newExerciseTypeName, setNewExerciseTypeName] = useState('');
  const [newExerciseCaloriesPerHour, setNewExerciseCaloriesPerHour] = useState('');
  const [customExerciseTypes, setCustomExerciseTypes] = useState<Array<{id: string, name: string, caloriesPerHour?: number}>>([]);
  
  // Campos dinâmicos baseados no tipo de exercício
  const [exerciseFields, setExerciseFields] = useState<Record<string, any>>({});
  
  // Calorias calculadas e editáveis
  const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);
  const [manualCalories, setManualCalories] = useState<string>('');
  const [isEditingCalories, setIsEditingCalories] = useState(false);
  const [isManuallyEdited, setIsManuallyEdited] = useState(false); // Flag para saber se foi editado manualmente

  const exerciseDate = selectedDate || new Date();

  // Carregar tipos de exercício customizados do usuário
  useEffect(() => {
    if (user) {
      loadCustomExerciseTypes();
    }
  }, [user]);

  // Pré-preencher dados se vier de uma sugestão do chat
  useEffect(() => {
    const exerciseSuggestion = route?.params?.exerciseSuggestion;
    if (exerciseSuggestion) {
      // Obter o nome traduzido do tipo de exercício
      const exerciseTypeName = getExerciseNameFromType(exerciseSuggestion.type, t);
      
      // Definir tipo de exercício
      setSelectedExerciseType(exerciseTypeName || exerciseSuggestion.type);
      
      // Definir duração
      setExerciseDuration(String(exerciseSuggestion.duration));
      
      // Definir calorias (se fornecidas)
      if (exerciseSuggestion.calories > 0) {
        setCalculatedCalories(exerciseSuggestion.calories);
        setManualCalories(String(exerciseSuggestion.calories));
        setIsEditingCalories(true);
        setIsManuallyEdited(true);
      }
      
      // Se for tipo "other", definir nome customizado
      if (exerciseSuggestion.type === 'other') {
        setCustomExerciseName(exerciseSuggestion.name);
      }
    }
  }, [route?.params?.exerciseSuggestion, t]);

  const loadCustomExerciseTypes = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'customExerciseTypes'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const types = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{id: string, name: string, caloriesPerHour?: number}>;
      setCustomExerciseTypes(types);
    } catch (error) {
      console.error('Error loading custom exercise types:', error);
    }
  };

  const confirmDeleteCustomExerciseType = (typeId: string, typeName: string) => {
    setExerciseTypeToDelete({ id: typeId, name: typeName });
    setShowDeleteModal(true);
  };

  const deleteCustomExerciseType = async () => {
    if (!user || !exerciseTypeToDelete) return;
    try {
      await deleteDoc(doc(db, 'customExerciseTypes', exerciseTypeToDelete.id));
      setCustomExerciseTypes(prev => prev.filter(t => t.id !== exerciseTypeToDelete.id));
      setShowDeleteModal(false);
      setExerciseTypeToDelete(null);
      Toast.show({
        type: 'success',
        text1: t('dashboard.exerciseTypeDeleted') || 'Tipo de exercício eliminado',
      });
    } catch (error) {
      console.error('Error deleting custom exercise type:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('dashboard.errorDeletingExerciseType') || 'Erro ao eliminar tipo de exercício',
      });
    }
  };

  // Limpar campos quando o tipo de exercício mudar
  useEffect(() => {
    setExerciseFields({});
    setCustomExerciseName('');
    setCalculatedCalories(null);
    setManualCalories('');
    setIsEditingCalories(false);
    setIsManuallyEdited(false); // Resetar flag de edição manual
  }, [selectedExerciseType]);

  // Função para calcular calorias baseada no tipo de exercício e informações
  const calculateExerciseCalories = (): number | null => {
    if (!selectedExerciseType || !exerciseDuration) return null;
    
    const duration = parseFloat(exerciseDuration) || 0;
    if (duration <= 0) return null;

    // Peso padrão se não tiver no perfil (70kg)
    const weightKg = profile?.weight || 70;
    
    let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
    if (!exerciseType) {
      exerciseType = 'other';
    }

    // Verificar se é um tipo customizado com calorias por hora definidas
    const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
    if (isCustomType) {
      const customType = customExerciseTypes.find(ct => ct.name === selectedExerciseType);
      if (customType?.caloriesPerHour) {
        return Math.round((customType.caloriesPerHour * duration) / 60);
      }
    }

    // Cálculo baseado em METs (Metabolic Equivalent of Task)
    // Fórmula: Calorias = MET × peso (kg) × tempo (horas)
    let met = 0;

    switch (exerciseType) {
      case 'running':
        // Corrida: MET varia com velocidade
        const distance = exerciseFields.distance || 0;
        if (distance > 0 && duration > 0) {
          const speedKmh = (distance / duration) * 60; // km/h
          if (speedKmh < 6.5) met = 6.0; // Corrida lenta
          else if (speedKmh < 8) met = 9.8; // Corrida moderada
          else if (speedKmh < 9.5) met = 11.5; // Corrida rápida
          else if (speedKmh < 11) met = 12.5; // Corrida muito rápida
          else met = 14.5; // Sprint
        } else {
          met = 9.8; // Default: corrida moderada
        }
        break;

      case 'walking':
        // Caminhada: MET varia com velocidade
        const walkDistance = exerciseFields.distance || 0;
        if (walkDistance > 0 && duration > 0) {
          const walkSpeedKmh = (walkDistance / duration) * 60;
          if (walkSpeedKmh < 3.2) met = 2.0; // Caminhada muito lenta
          else if (walkSpeedKmh < 4) met = 2.5; // Caminhada lenta
          else if (walkSpeedKmh < 5) met = 3.5; // Caminhada moderada
          else if (walkSpeedKmh < 6.5) met = 5.0; // Caminhada rápida
          else met = 6.0; // Caminhada muito rápida
        } else {
          met = 3.5; // Default: caminhada moderada
        }
        break;

      case 'cycling':
        // Ciclismo: MET varia com velocidade
        const cycleDistance = exerciseFields.distance || 0;
        const cycleSpeed = exerciseFields.averageSpeed || 0;
        if (cycleSpeed > 0) {
          if (cycleSpeed < 16) met = 4.0; // Ciclismo recreativo
          else if (cycleSpeed < 19) met = 6.0; // Ciclismo moderado
          else if (cycleSpeed < 22) met = 8.0; // Ciclismo vigoroso
          else if (cycleSpeed < 25) met = 10.0; // Ciclismo muito vigoroso
          else met = 12.0; // Ciclismo de competição
        } else if (cycleDistance > 0 && duration > 0) {
          const calculatedSpeed = (cycleDistance / duration) * 60;
          if (calculatedSpeed < 16) met = 4.0;
          else if (calculatedSpeed < 19) met = 6.0;
          else if (calculatedSpeed < 22) met = 8.0;
          else if (calculatedSpeed < 25) met = 10.0;
          else met = 12.0;
        } else {
          met = 6.0; // Default: ciclismo moderado
        }
        break;

      case 'swimming':
        // Natação: MET varia com estilo e intensidade
        const intensity = exerciseFields.perceivedIntensity || 5;
        const style = exerciseFields.style;
        let baseMet = 6.0;
        
        if (style === 'butterfly') baseMet = 13.8;
        else if (style === 'freestyle') {
          if (intensity <= 3) baseMet = 5.8;
          else if (intensity <= 6) baseMet = 9.8;
          else baseMet = 11.0;
        } else if (style === 'backstroke') baseMet = 9.5;
        else if (style === 'breaststroke') baseMet = 10.3;
        else {
          // Sem estilo definido, usar intensidade
          if (intensity <= 3) baseMet = 5.8;
          else if (intensity <= 6) baseMet = 8.3;
          else baseMet = 11.0;
        }
        met = baseMet;
        break;

      case 'gym':
        // Ginásio: MET varia com tipo de treino e intensidade
        const gymIntensity = exerciseFields.perceivedIntensity || 5;
        const trainingType = exerciseFields.trainingType;
        
        if (trainingType === 'cardio') {
          if (gymIntensity <= 4) met = 5.0;
          else if (gymIntensity <= 7) met = 7.0;
          else met = 9.0;
        } else if (trainingType === 'strength') {
          if (gymIntensity <= 4) met = 3.5;
          else if (gymIntensity <= 7) met = 5.0;
          else met = 6.0;
        } else if (trainingType === 'hypertrophy') {
          if (gymIntensity <= 4) met = 4.0;
          else if (gymIntensity <= 7) met = 5.5;
          else met = 6.5;
        } else {
          // Sem tipo definido, usar intensidade
          if (gymIntensity <= 4) met = 4.0;
          else if (gymIntensity <= 7) met = 6.0;
          else met = 8.0;
        }
        break;

      case 'yoga':
        // Yoga: MET varia com nível e estilo
        const yogaLevel = exerciseFields.level;
        const yogaStyle = exerciseFields.style;
        const yogaIntensity = exerciseFields.perceivedIntensity || 3;
        
        if (yogaStyle === 'power' || yogaStyle === 'ashtanga' || yogaStyle === 'bikram') {
          met = yogaIntensity <= 5 ? 3.0 : 4.0;
        } else if (yogaStyle === 'vinyasa') {
          met = yogaIntensity <= 5 ? 2.5 : 3.5;
        } else {
          met = yogaIntensity <= 5 ? 2.0 : 3.0;
        }
        break;

      case 'pilates':
        // Pilates: MET varia com tipo e intensidade
        const pilatesType = exerciseFields.pilatesType;
        const pilatesIntensity = exerciseFields.perceivedIntensity || 4;
        
        if (pilatesType === 'machine') {
          met = pilatesIntensity <= 5 ? 3.5 : 4.5;
        } else {
          met = pilatesIntensity <= 5 ? 3.0 : 4.0;
        }
        break;

      case 'dance':
        // Dança: MET varia com estilo e intensidade
        const danceStyle = exerciseFields.style;
        const danceIntensity = exerciseFields.perceivedIntensity || 5;
        
        if (danceStyle === 'zumba') {
          met = danceIntensity <= 5 ? 7.0 : 9.0;
        } else if (danceStyle === 'hip-hop') {
          met = danceIntensity <= 5 ? 6.0 : 8.0;
        } else if (danceStyle === 'salsa') {
          met = danceIntensity <= 5 ? 5.0 : 7.0;
        } else if (danceStyle === 'ballet') {
          met = danceIntensity <= 5 ? 4.5 : 6.0;
        } else {
          met = danceIntensity <= 5 ? 5.0 : 7.0;
        }
        break;

      case 'hiking':
        // Caminhada: MET varia com distância, elevação e peso da mochila
        const hikeDistance = exerciseFields.distance || 0;
        const elevationGain = exerciseFields.elevationGain || 0;
        const backpackWeight = exerciseFields.backpackWeight || 0;
        
        let baseHikeMet = 6.0;
        if (hikeDistance > 0 && duration > 0) {
          const hikeSpeed = (hikeDistance / duration) * 60;
          if (hikeSpeed < 3) baseHikeMet = 4.0;
          else if (hikeSpeed < 4) baseHikeMet = 5.0;
          else if (hikeSpeed < 5) baseHikeMet = 6.0;
          else baseHikeMet = 7.0;
        }
        
        // Ajustar para elevação (cada 100m de elevação adiciona ~0.5 MET)
        const elevationBonus = (elevationGain / 100) * 0.5;
        
        // Ajustar para peso da mochila (cada 5kg adiciona ~0.3 MET)
        const backpackBonus = (backpackWeight / 5) * 0.3;
        
        met = baseHikeMet + elevationBonus + backpackBonus;
        break;

      case 'tennis':
        // Ténis: MET varia com tipo de jogo
        const gameType = exerciseFields.gameType;
        const effectiveDuration = exerciseFields.effectiveGameDuration || duration;
        
        if (gameType === 'doubles') {
          met = 5.0;
        } else {
          met = 7.3; // Individual
        }
        // Ajustar para duração efetiva
        const actualDuration = effectiveDuration > 0 ? effectiveDuration : duration;
        return Math.round(met * weightKg * (actualDuration / 60));
        
      case 'football':
        // Futebol: MET varia com posição e intensidade
        const footballIntensity = exerciseFields.perceivedIntensity || 6;
        const position = exerciseFields.position;
        
        if (position === 'goalkeeper') {
          met = footballIntensity <= 5 ? 4.0 : 6.0;
        } else if (position === 'defender') {
          met = footballIntensity <= 5 ? 6.0 : 8.0;
        } else if (position === 'midfielder') {
          met = footballIntensity <= 5 ? 7.0 : 9.0;
        } else {
          met = footballIntensity <= 5 ? 7.5 : 9.5; // Forward
        }
        break;

      case 'basketball':
        // Basquetebol: MET varia com tipo de jogo e intensidade
        const basketballIntensity = exerciseFields.perceivedIntensity || 6;
        const basketballGameType = exerciseFields.gameType;
        
        if (basketballGameType === 'training') {
          met = basketballIntensity <= 5 ? 6.0 : 8.0;
        } else {
          met = basketballIntensity <= 5 ? 7.0 : 9.0; // Game
        }
        break;

      case 'other':
        // Outro: usar intensidade percebida
        const otherIntensity = exerciseFields.perceivedIntensity || 5;
        // Converter intensidade 1-10 para MET aproximado (2-10)
        met = 2 + (otherIntensity - 1) * (8 / 9);
        break;

      default:
        met = 5.0; // Default
    }

    // Calcular calorias: MET × peso (kg) × tempo (horas)
    const calories = met * weightKg * (duration / 60);
    return Math.round(calories);
  };

  // Calcular calorias sempre que os campos mudarem (apenas se não foi editado manualmente)
  useEffect(() => {
    if (selectedExerciseType && exerciseDuration && !isEditingCalories && !isManuallyEdited) {
      const calories = calculateExerciseCalories();
      if (calories !== null) {
        setCalculatedCalories(calories);
        setManualCalories(calories.toString());
      }
    }
  }, [selectedExerciseType, exerciseDuration, exerciseFields, profile?.weight, customExerciseTypes, isEditingCalories, isManuallyEdited]);

  const addExercise = async () => {
    if (!user || !selectedExerciseType || addingExercise) return;

    const duration = parseInt(exerciseDuration) || 0;
    if (duration <= 0) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('dashboard.invalidDuration') || 'Duração deve ser maior que 0',
      });
      return;
    }

    // Obter o tipo de exercício e validar campos obrigatórios
    let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
    
    // Se não encontrar um tipo conhecido, tratar como "other" (tipo customizado)
    if (!exerciseType) {
      exerciseType = 'other';
      // Se for um tipo customizado, usar o nome selecionado como customName
      if (!customExerciseName.trim()) {
        setCustomExerciseName(selectedExerciseType);
      }
    }

    const configs = getExerciseConfigs(t);
    const config = configs[exerciseType];

    // Verificar se é um tipo customizado criado pelo usuário
    const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);

    // Validar campos obrigatórios
    for (const requiredField of config.requiredFields) {
      if (requiredField === 'customName' && exerciseType === 'other') {
        // Não exigir customName se for um tipo customizado criado (já tem o nome)
        if (!isCustomType && !customExerciseName.trim()) {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Erro',
            text2: t('dashboard.enterExerciseName') || 'Por favor, insira o nome do exercício',
          });
          return;
        }
      } else if (requiredField === 'perceivedIntensity' && exerciseType === 'other') {
        if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Erro',
            text2: 'Por favor, insira a intensidade percebida (1-10)',
          });
          return;
        }
      } else if (requiredField === 'distance') {
        if (!exerciseFields.distance || exerciseFields.distance <= 0) {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Erro',
            text2: t('exercise.distanceRequired') || 'Por favor, insira a distância',
          });
          return;
        }
      } else if (requiredField === 'elevationGain') {
        if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Erro',
            text2: t('exercise.elevationRequired') || 'Por favor, insira o ganho de elevação',
          });
          return;
        }
      } else if (requiredField === 'perceivedIntensity') {
        if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Erro',
            text2: t('exercise.intensityRequired') || 'Por favor, insira a intensidade percebida (1-10)',
          });
          return;
        }
      }
    }

    setAddingExercise(true);
    try {
      const date = new Date(exerciseDate);
      date.setHours(0, 0, 0, 0);
      const addedAt = new Date();

      // Obter o tipo de exercício a partir do nome traduzido
      let exerciseTypeForSave = getExerciseTypeFromName(selectedExerciseType, t);
      
      // Se não encontrar um tipo conhecido, tratar como "other" (tipo customizado)
      if (!exerciseTypeForSave) {
        exerciseTypeForSave = 'other';
      }
      
      // Usar o nome personalizado se for "Outro" ou tipo customizado, senão usar o tipo selecionado
      const exerciseName = exerciseTypeForSave === 'other'
        ? (customExerciseName.trim() || selectedExerciseType)
        : selectedExerciseType;

      // Preparar dados do exercício com campos específicos
      const exerciseData: any = {
        userId: user.uid,
        type: exerciseTypeForSave || 'other',
        name: exerciseName,
        duration: duration,
        date: Timestamp.fromDate(date),
        addedAt: Timestamp.fromDate(addedAt),
        calories: calculatedCalories || 0, // Adicionar calorias calculadas ou editadas
      };
      
      // Se for tipo "other", adicionar customName (mas não se for um tipo customizado criado)
      const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
      if (exerciseTypeForSave === 'other' && !isCustomType && (customExerciseName.trim() || selectedExerciseType)) {
        exerciseData.customName = customExerciseName.trim() || selectedExerciseType;
      } else if (exerciseTypeForSave === 'other' && isCustomType) {
        // Para tipos customizados criados, usar o nome do tipo como customName
        exerciseData.customName = selectedExerciseType;
      }

      // Adicionar campos específicos do tipo de exercício
      Object.keys(exerciseFields).forEach(key => {
        const value = exerciseFields[key];
        if (value !== undefined && value !== null && value !== '') {
          exerciseData[key] = value;
        }
      });

      await addDoc(collection(db, 'exercises'), exerciseData);

      setAddingExercise(false);
      
      // Verificar e mostrar badges ganhas ANTES de navegar
      if (user) {
        await checkAndShowBadges(user.uid);
        // Aguardar um pouco para o modal aparecer antes de navegar
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      Toast.show({
        type: 'success',
        text1: t('dashboard.exerciseAdded') || 'Exercício adicionado',
        text2: `${exerciseName} - ${duration} min`,
      });
      
      // Navegar de volta - verificar se é possível fazer goBack
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Se não for possível, navegar para o Dashboard
        navigation.navigate('Dashboard');
      }
    } catch (error: any) {
      setAddingExercise(false);
      console.error('Error adding exercise:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('dashboard.exerciseError') || 'Erro ao adicionar exercício',
      });
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
          }}>
            <TouchableOpacity
              onPress={() => {
                if (selectedExerciseType) {
                  setSelectedExerciseType('');
                  setCustomExerciseName('');
                } else {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.navigate('Dashboard');
                  }
                }
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              flex: 1,
            }}>
              {t('dashboard.addExercise') || 'Adicionar Exercício'}
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 20,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {!selectedExerciseType ? (
            <>
              <View style={{ marginBottom: 24 }}>
                {[
                  { type: 'running', name: t('dashboard.exercise.running') || 'Corrida', icon: 'walk', isCustom: false },
                  { type: 'walking', name: t('dashboard.exercise.walking') || 'Caminhada', icon: 'walk-outline', isCustom: false },
                  { type: 'cycling', name: t('dashboard.exercise.cycling') || 'Ciclismo', icon: 'bicycle', isCustom: false },
                  { type: 'swimming', name: t('dashboard.exercise.swimming') || 'Natação', icon: 'water', isCustom: false },
                  { type: 'gym', name: t('dashboard.exercise.gym') || 'Ginásio', icon: 'barbell', isCustom: false },
                  { type: 'yoga', name: t('dashboard.exercise.yoga') || 'Yoga', icon: 'leaf', isCustom: false },
                  { type: 'pilates', name: t('dashboard.exercise.pilates') || 'Pilates', icon: 'body', isCustom: false },
                  { type: 'dance', name: t('dashboard.exercise.dance') || 'Dança', icon: 'musical-notes', isCustom: false },
                  { type: 'hiking', name: t('dashboard.exercise.hiking') || 'Caminhada', icon: 'trail-sign', isCustom: false },
                  { type: 'tennis', name: t('dashboard.exercise.tennis') || 'Ténis', icon: 'tennisball', isCustom: false },
                  { type: 'football', name: t('dashboard.exercise.football') || 'Futebol', icon: 'football', isCustom: false },
                  { type: 'basketball', name: t('dashboard.exercise.basketball') || 'Basquetebol', icon: 'basketball', isCustom: false },
                  { type: 'other', name: t('dashboard.exercise.other') || 'Outro', icon: 'ellipse', isCustom: false },
                ].map((exercise) => (
                  <TouchableOpacity
                    key={exercise.type}
                    onPress={() => setSelectedExerciseType(exercise.name)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      backgroundColor: theme.colors.card,
                      borderRadius: 12,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                    }}
                  >
                    <Ionicons
                      name={exercise.icon as any}
                      size={24}
                      color={theme.colors.text}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text,
                      flex: 1,
                    }}>
                      {exercise.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                
                {/* Tipos customizados do usuário */}
                {customExerciseTypes.length > 0 && (
                  <View style={{ marginTop: 24, marginBottom: 12 }}>
                    {customExerciseTypes.map((customType, index) => (
                      <TouchableOpacity
                        key={customType.id}
                        onPress={() => {
                          setSelectedExerciseType(customType.name);
                          setCustomExerciseName(customType.name);
                          // Se tiver calorias por hora, adicionar aos campos
                          if (customType.caloriesPerHour) {
                            setExerciseFields(prev => ({
                              ...prev,
                              caloriesPerHour: customType.caloriesPerHour,
                            }));
                          }
                        }}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 16,
                          paddingHorizontal: 16,
                          backgroundColor: theme.colors.card,
                          borderRadius: 12,
                          marginBottom: index < customExerciseTypes.length - 1 ? 16 : 0,
                          borderWidth: 1,
                          borderColor: theme.colors.primary || '#3BB273',
                        }}
                      >
                    <Ionicons
                      name="star"
                      size={24}
                      color={theme.colors.primary || '#3BB273'}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.text,
                      flex: 1,
                    }}>
                      {customType.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => confirmDeleteCustomExerciseType(customType.id, customType.name)}
                      activeOpacity={0.7}
                      style={{
                        padding: 8,
                        marginLeft: 8,
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#EF4444"
                      />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    ))}
                  </View>
                )}
                
                {/* Opção para criar novo tipo de exercício */}
                <View style={{ marginTop: 24, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCreateModal(true);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 18,
                      paddingHorizontal: 16,
                      backgroundColor: theme.colors.primary + '15',
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: theme.colors.primary || '#3BB273',
                      borderStyle: 'dashed',
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={28}
                      color={theme.colors.primary || '#3BB273'}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: theme.colors.primary || '#3BB273',
                      flex: 1,
                    }}>
                      {t('dashboard.createNewExerciseType') || 'Criar Novo Tipo de Exercício'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Header do Exercício Selecionado - Compacto */}
              <View style={{ 
                marginBottom: 24,
                backgroundColor: theme.colors.primary + '15',
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderWidth: 2,
                borderColor: theme.colors.primary || '#3BB273',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: theme.colors.primary || '#3BB273',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons
                      name={(() => {
                        const exercise = [
                          { name: t('dashboard.exercise.running') || 'Corrida', icon: 'walk' },
                          { name: t('dashboard.exercise.walking') || 'Caminhada', icon: 'walk-outline' },
                          { name: t('dashboard.exercise.cycling') || 'Ciclismo', icon: 'bicycle' },
                          { name: t('dashboard.exercise.swimming') || 'Natação', icon: 'water' },
                          { name: t('dashboard.exercise.gym') || 'Ginásio', icon: 'barbell' },
                          { name: t('dashboard.exercise.yoga') || 'Yoga', icon: 'leaf' },
                          { name: t('dashboard.exercise.pilates') || 'Pilates', icon: 'body' },
                          { name: t('dashboard.exercise.dance') || 'Dança', icon: 'musical-notes' },
                          { name: t('dashboard.exercise.hiking') || 'Caminhada', icon: 'trail-sign' },
                          { name: t('dashboard.exercise.tennis') || 'Ténis', icon: 'tennisball' },
                          { name: t('dashboard.exercise.football') || 'Futebol', icon: 'football' },
                          { name: t('dashboard.exercise.basketball') || 'Basquetebol', icon: 'basketball' },
                          { name: t('dashboard.exercise.other') || 'Outro', icon: 'ellipse' },
                        ].find(e => e.name === selectedExerciseType);
                        return exercise?.icon || 'ellipse';
                      })() as any}
                      size={22}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: theme.colors.text,
                    }}>
                      {selectedExerciseType}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedExerciseType('');
                      setCustomExerciseName('');
                    }}
                    activeOpacity={0.7}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.colors.primary || '#3BB273',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Seção: Informações Básicas */}
              <View style={{ marginBottom: 32 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginBottom: 16 
                }}>
                  <Ionicons 
                    name="information-circle" 
                    size={20} 
                    color={theme.colors.primary || '#3BB273'} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {t('dashboard.basicInfo') || 'Informações Básicas'}
                  </Text>
                </View>

                {/* Input de Nome do Exercício (apenas para "Outro", não para tipos customizados criados) */}
                {(() => {
                  const exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  // Mostrar input de nome apenas se for "other" e não for um tipo customizado criado
                  return (exerciseType === 'other' || !exerciseType) && !isCustomType;
                })() && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{
                      fontSize: 14,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      marginBottom: 8,
                      fontWeight: '600',
                    }}>
                      {t('dashboard.exerciseName') || 'Nome do exercício'}
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: theme.colors.primary + '30' || '#3BB27330',
                      paddingHorizontal: 16,
                    }}>
                      <Ionicons 
                        name="fitness" 
                        size={20} 
                        color={theme.colors.primary || '#3BB273'} 
                        style={{ marginRight: 12 }}
                      />
                      <TextInput
                        style={{
                          flex: 1,
                          paddingVertical: 16,
                          fontSize: 16,
                          fontWeight: '600',
                          color: theme.colors.text,
                        }}
                        value={customExerciseName}
                        onChangeText={setCustomExerciseName}
                        placeholder={t('dashboard.enterExerciseName') || 'Ex: Crossfit, Natação, etc.'}
                        placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                        autoFocus={true}
                      />
                    </View>
                  </View>
                )}

                {/* Input de Duração - Melhorado */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginBottom: 8,
                    fontWeight: '600',
                  }}>
                    {t('dashboard.duration') || 'Duração'}
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: theme.colors.primary + '30' || '#3BB27330',
                    paddingHorizontal: 16,
                  }}>
                    <Ionicons 
                      name="time-outline" 
                      size={24} 
                      color={theme.colors.primary || '#3BB273'} 
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      style={{
                        flex: 1,
                        paddingVertical: 16,
                        fontSize: 28,
                        fontWeight: '700',
                        color: theme.colors.text,
                        textAlign: 'center',
                      }}
                      value={exerciseDuration}
                      onChangeText={setExerciseDuration}
                      keyboardType="numeric"
                      placeholder="30"
                      placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                      autoFocus={true}
                    />
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: theme.colors.primary || '#3BB273',
                      marginLeft: 8,
                    }}>
                      {t('dashboard.minutes') || 'min'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Campos dinâmicos baseados no tipo de exercício */}
              {(() => {
                let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                // Se não encontrar um tipo conhecido, tratar como "other" (tipo customizado)
                if (!exerciseType) {
                  exerciseType = 'other';
                }

                const configs = getExerciseConfigs(t);
                const config = configs[exerciseType];
                if (!config) return null;
                
                // Mostrar campos obrigatórios que não são duration (já está mostrado acima)
                const requiredFieldsToShow = config.requiredFields.filter(field => 
                  field !== 'duration' && field !== 'customName' && field !== 'perceivedIntensity'
                );
                
                // Criar campos para os requiredFields que precisam ser mostrados
                const requiredFieldsConfig: ExerciseFieldConfig[] = requiredFieldsToShow.map(field => {
                  if (field === 'distance') {
                    return { 
                      label: t('exercise.field.distance'), 
                      key: 'distance', 
                      type: 'number', 
                      required: true, 
                      unit: exerciseType === 'swimming' ? 'm' : 'km' 
                    };
                  } else if (field === 'elevationGain') {
                    return { 
                      label: t('exercise.field.elevationGain'), 
                      key: 'elevationGain', 
                      type: 'number', 
                      required: true, 
                      unit: 'm' 
                    };
                  }
                  return null;
                }).filter(Boolean) as Array<{ label: string; key: string; type: 'number' | 'text' | 'select'; required: boolean; unit?: string; min?: number; max?: number }>;
                
                // Adicionar perceivedIntensity se for obrigatório
                if (config.requiredFields.includes('perceivedIntensity')) {
                  requiredFieldsConfig.push({
                    label: t('exercise.field.perceivedIntensity'),
                    key: 'perceivedIntensity',
                    type: 'number',
                    required: true,
                    min: 1,
                    max: 10,
                  });
                }
                
                const allFields = [...requiredFieldsConfig, ...config.optionalFields];
                if (allFields.length === 0) return null;

                return (
                  <View style={{ marginBottom: 24 }}>
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      marginBottom: 16 
                    }}>
                      <Ionicons 
                        name="stats-chart" 
                        size={20} 
                        color={theme.colors.primary || '#3BB273'} 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: theme.colors.text,
                      }}>
                        {t('dashboard.additionalDetails') || 'Detalhes Adicionais'}
                      </Text>
                    </View>
                    {allFields.map((field) => {
                      if (field.type === 'number') {
                        // Verificar se é campo obrigatório
                        const isRequired = config.requiredFields.includes(field.key);
                        
                        // Interface especial para Intensidade Percebida (1-10)
                        if (field.key === 'perceivedIntensity' && field.min === 1 && field.max === 10) {
                          return (
                            <View key={field.key} style={{ marginBottom: 20 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons 
                                  name="flame" 
                                  size={18} 
                                  color={theme.colors.primary || '#3BB273'} 
                                  style={{ marginRight: 6 }}
                                />
                                <Text style={{
                                  fontSize: 14,
                                  color: theme.colors.textSecondary || '#9CA3AF',
                                  fontWeight: '600',
                                }}>
                                  {field.label}
                                  {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                                </Text>
                              </View>
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                                borderRadius: 16,
                                borderWidth: 2,
                                borderColor: theme.colors.primary + '30' || '#3BB27330',
                                paddingHorizontal: 16,
                              }}>
                                <TextInput
                                  style={{
                                    flex: 1,
                                    paddingVertical: 16,
                                    fontSize: 24,
                                    fontWeight: '700',
                                    color: theme.colors.text,
                                    textAlign: 'center',
                                  }}
                                  value={exerciseFields[field.key]?.toString() || ''}
                                  onChangeText={(text) => {
                                    const numValue = parseInt(text) || 0;
                                    if (numValue >= 1 && numValue <= 10) {
                                      setExerciseFields(prev => ({
                                        ...prev,
                                        [field.key]: numValue,
                                      }));
                                    } else if (text === '') {
                                      setExerciseFields(prev => ({
                                        ...prev,
                                        [field.key]: undefined,
                                      }));
                                    }
                                  }}
                                  keyboardType="numeric"
                                  placeholder="1-10"
                                  placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                                  maxLength={2}
                                />
                                <Text style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: theme.colors.textSecondary || '#9CA3AF',
                                  marginLeft: 8,
                                }}>
                                  / 10
                                </Text>
                              </View>
                            </View>
                          );
                        }
                        
                        // Outros campos numéricos normais
                        const getIconForField = (key: string) => {
                          if (key === 'distance') return 'map-outline';
                          if (key === 'elevationGain') return 'trending-up-outline';
                          if (key === 'speed') return 'speedometer-outline';
                          if (key === 'heartRate') return 'heart-outline';
                          return 'calculator-outline';
                        };
                        
                        return (
                          <View key={field.key} style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <Ionicons 
                                name={getIconForField(field.key) as any} 
                                size={18} 
                                color={theme.colors.primary || '#3BB273'} 
                                style={{ marginRight: 6 }}
                              />
                              <Text style={{
                                fontSize: 14,
                                color: theme.colors.textSecondary || '#9CA3AF',
                                fontWeight: '600',
                              }}>
                                {field.label}
                                {(field.required || isRequired) && <Text style={{ color: '#EF4444' }}> *</Text>}
                              </Text>
                            </View>
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                              borderRadius: 16,
                              borderWidth: 2,
                              borderColor: theme.colors.primary + '30' || '#3BB27330',
                              paddingHorizontal: 16,
                            }}>
                              <TextInput
                                style={{
                                  flex: 1,
                                  paddingVertical: 16,
                                  fontSize: 20,
                                  fontWeight: '700',
                                  color: theme.colors.text,
                                  textAlign: 'center',
                                }}
                                value={exerciseFields[field.key]?.toString() || ''}
                                onChangeText={(text) => {
                                  const numValue = parseFloat(text) || 0;
                                  setExerciseFields(prev => ({
                                    ...prev,
                                    [field.key]: numValue > 0 ? numValue : undefined,
                                  }));
                                }}
                                keyboardType="numeric"
                                placeholder={field.placeholder || '0'}
                                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                              />
                              {field.unit && (
                                <Text style={{
                                  fontSize: 16,
                                  fontWeight: '600',
                                  color: theme.colors.primary || '#3BB273',
                                  marginLeft: 8,
                                }}>
                                  {field.unit}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      } else if (field.type === 'select') {
                        return (
                          <View key={field.key} style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                              <Ionicons 
                                name="list-outline" 
                                size={18} 
                                color={theme.colors.primary || '#3BB273'} 
                                style={{ marginRight: 6 }}
                              />
                              <Text style={{
                                fontSize: 14,
                                color: theme.colors.textSecondary || '#9CA3AF',
                                fontWeight: '600',
                              }}>
                                {field.label}
                                {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                              </Text>
                            </View>
                            <View style={{
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              gap: 10,
                            }}>
                              {field.options?.map((option) => (
                                <TouchableOpacity
                                  key={option.value}
                                  onPress={() => {
                                    setExerciseFields(prev => ({
                                      ...prev,
                                      [field.key]: prev[field.key] === option.value ? undefined : option.value,
                                    }));
                                  }}
                                  activeOpacity={0.7}
                                  style={{
                                    paddingVertical: 14,
                                    paddingHorizontal: 18,
                                    borderRadius: 14,
                                    backgroundColor: exerciseFields[field.key] === option.value
                                      ? theme.colors.primary || '#3BB273'
                                      : theme.isDark ? '#1F2937' : '#F9FAFB',
                                    borderWidth: 2,
                                    borderColor: exerciseFields[field.key] === option.value
                                      ? theme.colors.primary || '#3BB273'
                                      : theme.colors.border || '#E5E7EB',
                                    minWidth: 80,
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{
                                    fontSize: 15,
                                    fontWeight: '700',
                                    color: exerciseFields[field.key] === option.value
                                      ? '#FFFFFF'
                                      : theme.colors.text,
                                  }}>
                                    {option.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      } else if (field.type === 'text') {
                        return (
                          <View key={field.key} style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <Ionicons 
                                name="text-outline" 
                                size={18} 
                                color={theme.colors.primary || '#3BB273'} 
                                style={{ marginRight: 6 }}
                              />
                              <Text style={{
                                fontSize: 14,
                                color: theme.colors.textSecondary || '#9CA3AF',
                                fontWeight: '600',
                              }}>
                                {field.label}
                                {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                              </Text>
                            </View>
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                              borderRadius: 16,
                              borderWidth: 2,
                              borderColor: theme.colors.primary + '30' || '#3BB27330',
                              paddingHorizontal: 16,
                            }}>
                              <TextInput
                                style={{
                                  flex: 1,
                                  paddingVertical: 16,
                                  fontSize: 16,
                                  fontWeight: '600',
                                  color: theme.colors.text,
                                }}
                                value={exerciseFields[field.key]?.toString() || ''}
                                onChangeText={(text) => {
                                  setExerciseFields(prev => ({
                                    ...prev,
                                    [field.key]: text || undefined,
                                  }));
                                }}
                                placeholder={field.placeholder}
                                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                              />
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })}
                    
                    {/* Notas importantes */}
                    {config.notes && (
                      <View style={{
                        marginTop: 8,
                        marginBottom: 8,
                        padding: 16,
                        backgroundColor: theme.colors.primary + '10',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: theme.colors.primary + '30' || '#3BB27330',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                      }}>
                        <Ionicons 
                          name="bulb-outline" 
                          size={20} 
                          color={theme.colors.primary || '#3BB273'} 
                          style={{ marginRight: 12, marginTop: 2 }}
                        />
                        <Text style={{
                          flex: 1,
                          fontSize: 13,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          lineHeight: 18,
                        }}>
                          {config.notes}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Card de Calorias */}
              {calculatedCalories !== null && (
                <TouchableOpacity
                  activeOpacity={isEditingCalories ? 1 : 0.7}
                  onPress={() => {
                    if (!isEditingCalories) {
                      // Ativar modo de edição ao clicar no card
                      setIsEditingCalories(true);
                    }
                  }}
                  style={{
                    marginTop: 24,
                    marginBottom: 20,
                    backgroundColor: theme.colors.primary + '10',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 2,
                    borderColor: theme.colors.primary + '30' || '#3BB27330',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons 
                        name="flame" 
                        size={24} 
                        color={theme.colors.primary || '#3BB273'} 
                        style={{ marginRight: 10 }}
                      />
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: theme.colors.text,
                      }}>
                        {t('dashboard.caloriesBurned') || 'Calorias Queimadas'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isManuallyEdited && !isEditingCalories && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation(); // Evitar que o card seja clicado
                            // Voltar ao cálculo automático
                            const calories = calculateExerciseCalories();
                            if (calories !== null) {
                              setCalculatedCalories(calories);
                              setManualCalories(calories.toString());
                              setIsManuallyEdited(false);
                            }
                          }}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: theme.colors.primary + '15' || '#3BB27315',
                          }}
                        >
                          <Ionicons 
                            name="refresh-outline" 
                            size={16} 
                            color={theme.colors.primary || '#3BB273'} 
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation(); // Evitar que o card seja clicado
                          if (isEditingCalories) {
                            // Salvar o valor editado
                            const numValue = parseInt(manualCalories) || 0;
                            if (numValue > 0) {
                              setCalculatedCalories(numValue);
                              setManualCalories(numValue.toString());
                              setIsManuallyEdited(true); // Marcar como editado manualmente
                              setIsEditingCalories(false); // Fechar modo de edição
                            } else {
                              // Se o valor for 0 ou inválido, recalcular e resetar flag
                              const calories = calculateExerciseCalories();
                              if (calories !== null) {
                                setCalculatedCalories(calories);
                                setManualCalories(calories.toString());
                                setIsManuallyEdited(false); // Resetar flag
                                setIsEditingCalories(false); // Fechar modo de edição
                              }
                            }
                          } else {
                            setIsEditingCalories(true);
                          }
                        }}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: theme.colors.primary + '20' || '#3BB27320',
                        }}
                      >
                        <Ionicons 
                          name={isEditingCalories ? "checkmark" : "create-outline"} 
                          size={18} 
                          color={theme.colors.primary || '#3BB273'} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {isEditingCalories ? (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.isDark ? '#1F2937' : '#FFFFFF',
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: theme.colors.primary || '#3BB273',
                      paddingHorizontal: 16,
                    }}>
                      <TextInput
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          fontSize: 24,
                          fontWeight: '700',
                          color: theme.colors.text,
                          textAlign: 'center',
                        }}
                        value={manualCalories}
                        onChangeText={(text) => {
                          const numValue = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                          setManualCalories(numValue.toString());
                          // Atualizar calculatedCalories em tempo real durante edição
                          if (numValue > 0) {
                            setCalculatedCalories(numValue);
                          }
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                        autoFocus={true}
                      />
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: theme.colors.primary || '#3BB273',
                        marginLeft: 8,
                      }}>
                        {t('dashboard.kcal') || 'kcal'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 8,
                    }}>
                      <Text style={{
                        fontSize: 36,
                        fontWeight: '700',
                        color: theme.colors.primary || '#3BB273',
                      }}>
                        {calculatedCalories}
                      </Text>
                      <Text style={{
                        fontSize: 20,
                        fontWeight: '600',
                        color: theme.colors.textSecondary || '#9CA3AF',
                        marginLeft: 8,
                      }}>
                        {t('dashboard.kcal') || 'kcal'}
                      </Text>
                    </View>
                  )}
                  
                  {!isEditingCalories && (
                    <Text style={{
                      fontSize: 12,
                      color: theme.colors.textSecondary || '#9CA3AF',
                      textAlign: 'center',
                      marginTop: 8,
                    }}>
                      {t('dashboard.tapToEdit') || 'Toque para editar'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
          </ScrollView>

          {/* Botões Fixos */}
          <View style={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 0,
            backgroundColor: theme.colors.background,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border || '#E5E7EB',
          }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                flex: 1,
                backgroundColor: theme.colors.border || '#E5E7EB',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
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
              onPress={addExercise}
              disabled={(() => {
                if (!selectedExerciseType || addingExercise) return true;
                let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                // Se não encontrar um tipo conhecido, tratar como "other" (tipo customizado)
                if (!exerciseType) {
                  exerciseType = 'other';
                }
                
                // Verificar se é um tipo customizado criado pelo usuário
                const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                
                const configs = getExerciseConfigs(t);
                const config = configs[exerciseType];
                
                // Validar todos os campos obrigatórios
                for (const requiredField of config.requiredFields) {
                  if (requiredField === 'customName' && exerciseType === 'other') {
                    // Não exigir customName se for um tipo customizado criado (já tem o nome)
                    if (!isCustomType && !customExerciseName.trim() && !selectedExerciseType.trim()) return true;
                  } else if (requiredField === 'distance') {
                    if (!exerciseFields.distance || exerciseFields.distance <= 0) return true;
                  } else if (requiredField === 'elevationGain') {
                    if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return true;
                  } else if (requiredField === 'perceivedIntensity') {
                    if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return true;
                  }
                }
                return false;
              })()}
              style={{
                flex: 1,
                backgroundColor: (() => {
                  if (!selectedExerciseType || addingExercise) return theme.colors.border || '#E5E7EB';
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return theme.colors.border || '#E5E7EB';
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return theme.colors.border || '#E5E7EB';
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return theme.colors.border || '#E5E7EB';
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return theme.colors.border || '#E5E7EB';
                    }
                  }
                  return theme.colors.primary || '#3BB273';
                })(),
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (() => {
                  if (!selectedExerciseType || addingExercise) return 0.5;
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return 0.5;
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return 0.5;
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return 0.5;
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return 0.5;
                    }
                  }
                  return 1;
                })(),
                shadowColor: (() => {
                  if (!selectedExerciseType || addingExercise) return 'transparent';
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return 'transparent';
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return 'transparent';
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return 'transparent';
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return 'transparent';
                    }
                  }
                  return theme.colors.primary || '#3BB273';
                })(),
                shadowOffset: (() => {
                  if (!selectedExerciseType || addingExercise) return { width: 0, height: 0 };
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return { width: 0, height: 0 };
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return { width: 0, height: 0 };
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return { width: 0, height: 0 };
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return { width: 0, height: 0 };
                    }
                  }
                  return { width: 0, height: 4 };
                })(),
                shadowOpacity: (() => {
                  if (!selectedExerciseType || addingExercise) return 0;
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return 0;
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return 0;
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return 0;
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return 0;
                    }
                  }
                  return 0.3;
                })(),
                shadowRadius: (() => {
                  if (!selectedExerciseType || addingExercise) return 0;
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return 0;
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return 0;
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return 0;
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return 0;
                    }
                  }
                  return 8;
                })(),
                elevation: (() => {
                  if (!selectedExerciseType || addingExercise) return 0;
                  let exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                  if (!exerciseType) exerciseType = 'other';
                  
                  const configs = getExerciseConfigs(t);
                  const config = configs[exerciseType];
                  
                  // Verificar se é um tipo customizado criado pelo usuário
                  const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                  
                  // Validar todos os campos obrigatórios
                  for (const requiredField of config.requiredFields) {
                    if (requiredField === 'customName' && exerciseType === 'other') {
                      // Não exigir customName se for um tipo customizado criado (já tem o nome)
                      if (!isCustomType && !customExerciseName.trim()) return 0;
                    } else if (requiredField === 'distance') {
                      if (!exerciseFields.distance || exerciseFields.distance <= 0) return 0;
                    } else if (requiredField === 'elevationGain') {
                      if (!exerciseFields.elevationGain || exerciseFields.elevationGain <= 0) return 0;
                    } else if (requiredField === 'perceivedIntensity') {
                      if (!exerciseFields.perceivedIntensity || exerciseFields.perceivedIntensity < 1 || exerciseFields.perceivedIntensity > 10) return 0;
                    }
                  }
                  return 4;
                })(),
              }}
              activeOpacity={0.8}
            >
              {addingExercise ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                  {t('common.add') || 'Adicionar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal para criar novo tipo de exercício */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: theme.colors.background,
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 20,
            }}>
              {t('dashboard.createNewExerciseType') || 'Criar Novo Tipo de Exercício'}
            </Text>
            
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 16,
            }}>
              {t('dashboard.enterNewExerciseTypeName') || 'Digite o nome do novo tipo de exercício:'}
            </Text>
            
            <TextInput
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontSize: 16,
                color: theme.colors.text,
                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                marginBottom: 16,
              }}
              value={newExerciseTypeName}
              onChangeText={setNewExerciseTypeName}
              placeholder={t('dashboard.exerciseName') || 'Nome do exercício'}
              placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              autoFocus={true}
            />
            
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 8,
            }}>
              {t('dashboard.caloriesPerHour') || 'Calorias por hora (opcional):'}
            </Text>
            
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
              paddingHorizontal: 16,
              marginBottom: 20,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: theme.colors.text,
                }}
                value={newExerciseCaloriesPerHour}
                onChangeText={setNewExerciseCaloriesPerHour}
                placeholder={t('dashboard.enterCaloriesPerHour') || 'Ex: 300'}
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                keyboardType="numeric"
              />
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.textSecondary || '#9CA3AF',
                marginLeft: 8,
              }}>
                {t('dashboard.kcalPerHour') || 'kcal/h'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setNewExerciseTypeName('');
                  setNewExerciseCaloriesPerHour('');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
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
                  if (newExerciseTypeName.trim() && user) {
                    try {
                      // Salvar o tipo customizado no Firestore
                      const caloriesPerHourValue = newExerciseCaloriesPerHour.trim() 
                        ? parseFloat(newExerciseCaloriesPerHour) 
                        : undefined;
                      
                      const customTypeData: any = {
                        userId: user.uid,
                        name: newExerciseTypeName.trim(),
                        createdAt: Timestamp.fromDate(new Date()),
                      };
                      
                      if (caloriesPerHourValue && !isNaN(caloriesPerHourValue) && caloriesPerHourValue > 0) {
                        customTypeData.caloriesPerHour = caloriesPerHourValue;
                      }
                      
                      const docRef = await addDoc(collection(db, 'customExerciseTypes'), customTypeData);
                      
                      // Adicionar à lista local
                      const newType = {
                        id: docRef.id,
                        name: newExerciseTypeName.trim(),
                        caloriesPerHour: caloriesPerHourValue,
                      };
                      setCustomExerciseTypes(prev => [...prev, newType]);
                      
                      // Selecionar o tipo recém-criado
                      setSelectedExerciseType(newExerciseTypeName.trim());
                      setCustomExerciseName(newExerciseTypeName.trim());
                      
                      // Se houver calorias por hora definidas, salvar nos campos do exercício
                      if (caloriesPerHourValue) {
                        setExerciseFields(prev => ({
                          ...prev,
                          caloriesPerHour: caloriesPerHourValue,
                        }));
                      }
                      
                      setShowCreateModal(false);
                      setNewExerciseTypeName('');
                      setNewExerciseCaloriesPerHour('');
                      
                      Toast.show({
                        type: 'success',
                        text1: t('dashboard.exerciseTypeCreated') || 'Tipo de exercício criado',
                      });
                    } catch (error) {
                      console.error('Error creating custom exercise type:', error);
                      Toast.show({
                        type: 'error',
                        text1: t('common.error') || 'Erro',
                        text2: t('dashboard.errorCreatingExerciseType') || 'Erro ao criar tipo de exercício',
                      });
                    }
                  }
                }}
                disabled={!newExerciseTypeName.trim()}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: newExerciseTypeName.trim() 
                    ? theme.colors.primary || '#3BB273'
                    : theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: newExerciseTypeName.trim() ? '#FFFFFF' : theme.colors.text,
                }}>
                  {t('common.create') || 'Criar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para confirmar exclusão de tipo de exercício */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setExerciseTypeToDelete(null);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: theme.colors.background,
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 16,
            }}>
              {t('dashboard.confirmDeleteExerciseType') || 'Confirmar Eliminação'}
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 24,
              lineHeight: 22,
            }}>
              {t('dashboard.confirmDeleteExerciseTypeMessage') || 'Tem certeza que deseja eliminar o tipo de exercício'} "{exerciseTypeToDelete?.name}"? {t('dashboard.confirmDeleteExerciseTypeWarning') || 'Esta ação não pode ser desfeita.'}
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  setExerciseTypeToDelete(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
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
                onPress={deleteCustomExerciseType}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                  {t('common.delete') || 'Eliminar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

