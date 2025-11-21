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

export function AddExerciseScreen({ navigation }: any) {
  const { user } = useUser();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { selectedDate } = useSelectedDate();
  const insets = useSafeAreaInsets();
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

  const exerciseDate = selectedDate || new Date();

  // Carregar tipos de exercício customizados do usuário
  useEffect(() => {
    if (user) {
      loadCustomExerciseTypes();
    }
  }, [user]);

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
  }, [selectedExerciseType]);

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
      Toast.show({
        type: 'success',
        text1: t('dashboard.exerciseAdded') || 'Exercício adicionado',
        text2: `${exerciseName} - ${duration} min`,
      });
      navigation.goBack();
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
                  navigation.goBack();
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
                  { name: t('dashboard.exercise.running') || 'Corrida', icon: 'walk', isCustom: false },
                  { name: t('dashboard.exercise.walking') || 'Caminhada', icon: 'walk-outline', isCustom: false },
                  { name: t('dashboard.exercise.cycling') || 'Ciclismo', icon: 'bicycle', isCustom: false },
                  { name: t('dashboard.exercise.swimming') || 'Natação', icon: 'water', isCustom: false },
                  { name: t('dashboard.exercise.gym') || 'Ginásio', icon: 'barbell', isCustom: false },
                  { name: t('dashboard.exercise.yoga') || 'Yoga', icon: 'leaf', isCustom: false },
                  { name: t('dashboard.exercise.pilates') || 'Pilates', icon: 'body', isCustom: false },
                  { name: t('dashboard.exercise.dance') || 'Dança', icon: 'musical-notes', isCustom: false },
                  { name: t('dashboard.exercise.hiking') || 'Caminhada', icon: 'trail-sign', isCustom: false },
                  { name: t('dashboard.exercise.tennis') || 'Ténis', icon: 'tennisball', isCustom: false },
                  { name: t('dashboard.exercise.football') || 'Futebol', icon: 'football', isCustom: false },
                  { name: t('dashboard.exercise.basketball') || 'Basquetebol', icon: 'basketball', isCustom: false },
                  { name: t('dashboard.exercise.other') || 'Outro', icon: 'ellipse', isCustom: false },
                ].map((exercise) => (
                  <TouchableOpacity
                    key={exercise.name}
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
              {/* Exercício Selecionado */}
              <View style={{ marginBottom: 24 }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedExerciseType('');
                    setCustomExerciseName('');
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 18,
                    paddingHorizontal: 20,
                    backgroundColor: theme.colors.primary + '20',
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: theme.colors.primary || '#3BB273',
                  }}
                >
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
                    size={28}
                    color={theme.colors.primary || '#3BB273'}
                    style={{ marginRight: 16 }}
                  />
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.colors.primary || '#3BB273',
                    flex: 1,
                  }}>
                    {selectedExerciseType}
                  </Text>
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
                </TouchableOpacity>
              </View>

              {/* Input de Nome do Exercício (apenas para "Outro", não para tipos customizados criados) */}
              {(() => {
                const exerciseType = getExerciseTypeFromName(selectedExerciseType, t);
                // Verificar se é um tipo customizado criado pelo usuário
                const isCustomType = customExerciseTypes.some(ct => ct.name === selectedExerciseType);
                // Mostrar input de nome apenas se for "other" e não for um tipo customizado criado
                return (exerciseType === 'other' || !exerciseType) && !isCustomType;
              })() && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{
                    fontSize: 16,
                    color: theme.colors.text,
                    marginBottom: 12,
                    fontWeight: '700',
                  }}>
                    {t('dashboard.exerciseName') || 'Nome do exercício'}
                  </Text>
                  <TextInput
                    style={{
                      paddingVertical: 18,
                      paddingHorizontal: 20,
                      fontSize: 18,
                      fontWeight: '600',
                      color: theme.colors.text,
                      backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                    }}
                    value={customExerciseName}
                    onChangeText={setCustomExerciseName}
                    placeholder={t('dashboard.enterExerciseName') || 'Ex: Crossfit, Natação, etc.'}
                    placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
                    autoFocus={true}
                  />
                </View>
              )}

              {/* Input de Duração */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.text,
                  marginBottom: 12,
                  fontWeight: '700',
                }}>
                  {t('dashboard.duration') || 'Duração (minutos)'}
                </Text>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  paddingHorizontal: 20,
                }}>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 18,
                      fontSize: 24,
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
                    fontSize: 18,
                    fontWeight: '600',
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginLeft: 8,
                  }}>
                    {t('dashboard.minutes') || 'min'}
                  </Text>
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
                  <>
                    {allFields.map((field) => {
                      if (field.type === 'number') {
                        // Verificar se é campo obrigatório
                        const isRequired = config.requiredFields.includes(field.key);
                        
                        // Interface especial para Intensidade Percebida (1-10)
                        if (field.key === 'perceivedIntensity' && field.min === 1 && field.max === 10) {
                          return (
                            <View key={field.key} style={{ marginBottom: 24 }}>
                              <Text style={{
                                fontSize: 16,
                                color: theme.colors.text,
                                marginBottom: 12,
                                fontWeight: '700',
                              }}>
                                {field.label}
                                {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                              </Text>
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: theme.colors.border || '#E5E7EB',
                                paddingHorizontal: 20,
                              }}>
                                <TextInput
                                  style={{
                                    flex: 1,
                                    paddingVertical: 18,
                                    fontSize: 18,
                                    fontWeight: '600',
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
                              </View>
                            </View>
                          );
                        }
                        
                        // Outros campos numéricos normais
                        return (
                          <View key={field.key} style={{ marginBottom: 24 }}>
                            <Text style={{
                              fontSize: 16,
                              color: theme.colors.text,
                              marginBottom: 12,
                              fontWeight: '700',
                            }}>
                              {field.label}
                              {(field.required || isRequired) && <Text style={{ color: '#EF4444' }}> *</Text>}
                            </Text>
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: theme.colors.border || '#E5E7EB',
                              paddingHorizontal: 20,
                            }}>
                              <TextInput
                                style={{
                                  flex: 1,
                                  paddingVertical: 18,
                                  fontSize: 18,
                                  fontWeight: '600',
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
                                  color: theme.colors.textSecondary || '#9CA3AF',
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
                          <View key={field.key} style={{ marginBottom: 24 }}>
                            <Text style={{
                              fontSize: 16,
                              color: theme.colors.text,
                              marginBottom: 12,
                              fontWeight: '700',
                            }}>
                              {field.label}
                              {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                            </Text>
                            <View style={{
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              gap: 8,
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
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 12,
                                    backgroundColor: exerciseFields[field.key] === option.value
                                      ? theme.colors.primary || '#3BB273'
                                      : theme.isDark ? '#1F2937' : '#F9FAFB',
                                    borderWidth: 1,
                                    borderColor: exerciseFields[field.key] === option.value
                                      ? theme.colors.primary || '#3BB273'
                                      : theme.colors.border || '#E5E7EB',
                                  }}
                                >
                                  <Text style={{
                                    fontSize: 14,
                                    fontWeight: '600',
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
                          <View key={field.key} style={{ marginBottom: 24 }}>
                            <Text style={{
                              fontSize: 16,
                              color: theme.colors.text,
                              marginBottom: 12,
                              fontWeight: '700',
                            }}>
                              {field.label}
                              {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                            </Text>
                            <TextInput
                              style={{
                                paddingVertical: 18,
                                paddingHorizontal: 20,
                                fontSize: 18,
                                fontWeight: '600',
                                color: theme.colors.text,
                                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: theme.colors.border || '#E5E7EB',
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
                        );
                      }
                      return null;
                    })}
                    
                    {/* Notas importantes */}
                    {config.notes && (
                      <View style={{
                        marginBottom: 24,
                        padding: 16,
                        backgroundColor: theme.colors.primary + '10',
                        borderRadius: 12,
                        borderLeftWidth: 4,
                        borderLeftColor: theme.colors.primary || '#3BB273',
                      }}>
                        <Text style={{
                          fontSize: 13,
                          color: theme.colors.textSecondary || '#9CA3AF',
                          lineHeight: 18,
                        }}>
                          💡 {config.notes}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
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
    </SafeAreaView>
  );
}

