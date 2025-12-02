/**
 * EditGoalAndWeightScreen
 * 
 * Tela para editar o objetivo (goal) e peso atual (current weight)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnits } from '../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Slider from '@react-native-community/slider';
import { calculateCalorieGoalFromProfile } from '../utils/nutritionUtils';

export function EditGoalAndWeightScreen({ navigation }: any) {
  const { profile, updateProfile, refreshProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { units, convertWeight } = useUnits();
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [goalSpeed, setGoalSpeed] = useState<number>(0.5); // kg per week
  const [loading, setLoading] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [weightIsEmpty, setWeightIsEmpty] = useState(false);
  const initialized = useRef(false);
  const goalSpeedFromProfile = useRef<number | null>(null); // Guardar o valor do perfil para comparar

  // Função para calcular o objetivo automaticamente baseado no peso desejado vs peso atual
  const calculateGoalFromWeight = (desiredWeightKg: number, currentWeightKg: number): 'lose' | 'maintain' | 'gain' => {
    const diff = desiredWeightKg - currentWeightKg;
    const threshold = 0.5; // 0.5kg de diferença para considerar "maintain"
    
    if (Math.abs(diff) <= threshold) {
      return 'maintain';
    } else if (diff < 0) {
      return 'lose';
    } else {
      return 'gain';
    }
  };

  // Função para calcular peso recomendado baseado no IMC saudável (18.5-25)
  const calculateRecommendedWeight = (): number | null => {
    if (!profile?.height || profile.height <= 0) {
      return null;
    }

    const heightMeters = profile.height / 100; // Converter cm para metros
    // IMC saudável: 18.5 a 25
    // IMC = peso / (altura^2)
    // peso = IMC * (altura^2)
    
    // Usar IMC médio de 22 (meio do intervalo saudável)
    const idealBMI = 22;
    const recommendedWeightKg = idealBMI * (heightMeters * heightMeters);
    
    return recommendedWeightKg;
  };

  const recommendedWeight = calculateRecommendedWeight();

  // Função para formatar peso com 1 casa decimal (arredondar corretamente)
  const formatWeight = (value: number): string => {
    // Arredondar para 1 casa decimal
    const rounded = Math.round(value * 10) / 10;
    return rounded.toFixed(1);
  };

  // Valores mínimos e máximos
  const MIN_WEIGHT_KG = 30;
  const MAX_WEIGHT_KG = 200;
  const MIN_WEIGHT_LB = Math.round(convertWeight(MIN_WEIGHT_KG, 'kg', 'lb'));
  const MAX_WEIGHT_LB = Math.round(convertWeight(MAX_WEIGHT_KG, 'kg', 'lb'));

  // Guardar a unidade anterior para detectar mudanças
  const previousUnit = useRef(units.weight);

  useEffect(() => {
    if (profile && !initialized.current) {
      // Inicialização inicial - só executar uma vez
      const desiredWeightKg = profile.desiredWeight ?? profile.weight ?? 0;
      const currentWeightKg = profile.weight ?? 0;
      const weightInKg = desiredWeightKg;
      const displayWeight = units.weight === 'lb' 
        ? convertWeight(weightInKg, 'kg', 'lb')
        : weightInKg;
      
      setWeight(displayWeight > 0 ? formatWeight(displayWeight) : '');
      
      // Calcular objetivo automaticamente baseado no peso desejado vs atual
      if (currentWeightKg > 0 && desiredWeightKg > 0) {
        const autoGoal = calculateGoalFromWeight(desiredWeightKg, currentWeightKg);
        setGoal(autoGoal);
      } else {
        setGoal(profile.goal || 'maintain');
      }
      
      const profileGoalSpeed = profile.goalSpeed !== undefined && profile.goalSpeed !== null 
        ? profile.goalSpeed 
        : 0.5;
      
      setGoalSpeed(profileGoalSpeed);
      goalSpeedFromProfile.current = profileGoalSpeed;
      
      setWeightText('');
      setWeightIsEmpty(false);
      initialized.current = true;
      previousUnit.current = units.weight;
    }
  }, [profile, convertWeight]);

  // Separar useEffect para mudanças de unidade (só converter o valor atual, não resetar)
  useEffect(() => {
    if (profile && initialized.current && weight && previousUnit.current !== units.weight) {
      // Se a unidade mudou, converter o valor atual para a nova unidade
      const currentWeightValue = parseFloat(weight);
      if (!isNaN(currentWeightValue)) {
        // Converter o valor atual de kg para a nova unidade
        // Primeiro, converter o valor atual da unidade antiga para kg
        const currentWeightKg = previousUnit.current === 'lb' 
          ? convertWeight(currentWeightValue, 'lb', 'kg')
          : currentWeightValue;
        
        // Depois, converter de kg para a nova unidade
        const newDisplayWeight = units.weight === 'lb'
          ? convertWeight(currentWeightKg, 'kg', 'lb')
          : currentWeightKg;
        
        setWeight(formatWeight(newDisplayWeight));
      }
      previousUnit.current = units.weight;
    }
  }, [units.weight, weight, profile, convertWeight]);

  const handleSave = async () => {
    if (!weight) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.fillAllFields') || 'Por favor, preencha todos os campos',
      });
      return;
    }

    // Obter peso atual em kg
    const currentWeightKg = profile?.weight || 0;
    
    setLoading(true);
    try {
      let finalWeight = weight;
      let desiredWeightKg = 0;
      
      if (weightText !== '') {
        const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
          if (units.weight === 'lb') {
            // Converter de lb para kg antes de guardar (guardar valor exato, sem arredondar)
            const kg = convertWeight(num, 'lb', 'kg');
            if (kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) {
              desiredWeightKg = kg;
              finalWeight = kg.toString(); // Guardar valor exato
            }
          } else {
            // Já está em kg (guardar valor exato)
            if (num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG) {
              desiredWeightKg = num;
              finalWeight = num.toString();
            }
          }
        }
      } else if (weight) {
        // Se não há weightText mas há weight, converter se necessário
        const weightNum = parseFloat(weight);
        if (!isNaN(weightNum)) {
          if (units.weight === 'lb') {
            // Converter de lb para kg antes de guardar (guardar valor exato)
            const kg = convertWeight(weightNum, 'lb', 'kg');
            desiredWeightKg = kg;
            finalWeight = kg.toString(); // Guardar valor exato
          } else {
            desiredWeightKg = weightNum;
            finalWeight = weightNum.toString(); // Guardar valor exato
          }
        }
      }

      // Validação baseada no goal
      if (currentWeightKg > 0) {
        if (goal === 'maintain') {
          // Manter: não deixar fugir mais de 5kg para cima ou para baixo
          const diff = Math.abs(desiredWeightKg - currentWeightKg);
          if (diff > 5) {
            setLoading(false);
            const maxAllowed = currentWeightKg + 5;
            const minAllowed = currentWeightKg - 5;
            const displayMax = units.weight === 'lb' 
              ? formatWeight(convertWeight(maxAllowed, 'kg', 'lb'))
              : formatWeight(maxAllowed);
            const displayMin = units.weight === 'lb'
              ? formatWeight(convertWeight(minAllowed, 'kg', 'lb'))
              : formatWeight(minAllowed);
            Toast.show({
              type: 'error',
              text1: t('common.error') || 'Erro',
              text2: `Para manter o peso, deve estar entre ${displayMin} e ${displayMax} ${units.weight}`,
            });
            return;
          }
        } else if (goal === 'gain') {
          // Ganhar: não deixar meter menos do que tem
          if (desiredWeightKg < currentWeightKg) {
            setLoading(false);
            const displayCurrent = units.weight === 'lb'
              ? formatWeight(convertWeight(currentWeightKg, 'kg', 'lb'))
              : formatWeight(currentWeightKg);
            Toast.show({
              type: 'error',
              text1: t('common.error') || 'Erro',
              text2: `Para ganhar peso, deve ser maior que o peso atual (${displayCurrent} ${units.weight})`,
            });
            return;
          }
        } else if (goal === 'lose') {
          // Perder: não deixar meter mais do que tem
          if (desiredWeightKg > currentWeightKg) {
            setLoading(false);
            const displayCurrent = units.weight === 'lb'
              ? formatWeight(convertWeight(currentWeightKg, 'kg', 'lb'))
              : formatWeight(currentWeightKg);
            Toast.show({
              type: 'error',
              text1: t('common.error') || 'Erro',
              text2: `Para perder peso, deve ser menor que o peso atual (${displayCurrent} ${units.weight})`,
            });
            return;
          }
        }
      }

      // Recalcular calorias e macros baseado nos novos valores (incluindo goalSpeed)
      // Criar um perfil temporário com os novos valores para calcular
      const tempProfile = {
        ...profile,
        goal,
        goalSpeed: goal === 'maintain' ? undefined : goalSpeed,
        desiredWeight: parseFloat(finalWeight),
      } as any;
      
      const calculatedPlan = calculateCalorieGoalFromProfile(tempProfile);
      
      // Preparar dados para atualizar
      const updateData: any = {
        desiredWeight: parseFloat(finalWeight),
        goal,
        goalSpeed: goal === 'maintain' ? undefined : goalSpeed,
      };

      // Se conseguiu calcular, adicionar também as calorias e macros recalculadas
      if (calculatedPlan) {
        const calculatedCalories = calculatedPlan.calories;
        const calculatedProtein = Math.round((calculatedCalories * 0.30) / 4);
        const calculatedCarbs = Math.round((calculatedCalories * 0.40) / 4);
        const calculatedFat = Math.round((calculatedCalories * 0.30) / 9);

        updateData.dailyCalorieGoal = calculatedCalories;
        updateData.dailyProteinGoal = calculatedProtein;
        updateData.dailyCarbsGoal = calculatedCarbs;
        updateData.dailyFatGoal = calculatedFat;
      }

      // Atualizar tudo de uma vez
      await updateProfile(updateData);

      // Forçar refresh do profile para garantir que tudo está atualizado
      await refreshProfile();

      setLoading(false);
      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Sucesso',
        text2: t('profile.detailsUpdated') || 'Detalhes atualizados com sucesso',
      });
      // Pequeno delay para garantir que o Toast seja visível
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error: any) {
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('profile.updateError') || 'Erro ao atualizar detalhes',
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={{
            fontSize: 28,
            fontWeight: '700',
            color: theme.colors.text,
            flex: 1,
            textAlign: 'center',
            marginRight: 40,
          }}>
            {t('profile.goal') || 'Meta'}
          </Text>
        </View>

        {/* Conteúdo */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 0, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Card: Peso Desejado */}
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: theme.colors.text,
              }}>
                {t('profile.desiredWeight') || 'Peso desejado'}
              </Text>
              <View style={{
                backgroundColor: (theme.colors.primary || '#3BB273') + '15',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: theme.colors.primary || '#3BB273',
                  textTransform: 'uppercase',
                }}>
                  {units.weight}
                </Text>
              </View>
            </View>
            {/* Input de peso com botões +/- */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: 16,
              paddingVertical: 20,
            }}>
              <TouchableOpacity
                onPress={() => {
                  let currentValue = parseFloat(weight) || (units.weight === 'lb' ? MIN_WEIGHT_LB + (MAX_WEIGHT_LB - MIN_WEIGHT_LB) / 2 : 70);
                  if (weightText !== '') {
                    const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num)) {
                      if (units.weight === 'lb') {
                        const kg = convertWeight(num, 'lb', 'kg');
                        if (kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) {
                          const displayKg = convertWeight(kg, 'kg', units.weight);
                          currentValue = parseFloat(displayKg.toFixed(1));
                          setWeight(formatWeight(currentValue));
                        }
                      } else {
                        if (num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG) {
                          currentValue = parseFloat(num.toFixed(1));
                          setWeight(formatWeight(currentValue));
                        }
                      }
                    }
                  }
                  // Converter limites para a unidade atual
                  const minValue = units.weight === 'lb' ? MIN_WEIGHT_LB : MIN_WEIGHT_KG;
                  const maxValue = units.weight === 'lb' ? MAX_WEIGHT_LB : MAX_WEIGHT_KG;
                  const step = units.weight === 'lb' ? 1 : 0.5;
                  const newValue = Math.max(minValue, parseFloat((currentValue - step).toFixed(1)));
                  setWeight(formatWeight(newValue));
                  setWeightText('');
                  
                  // Atualizar objetivo automaticamente
                  if (profile?.weight) {
                    const newValueKg = units.weight === 'lb' ? convertWeight(newValue, 'lb', 'kg') : newValue;
                    const autoGoal = calculateGoalFromWeight(newValueKg, profile.weight);
                    setGoal(autoGoal);
                  }
                }}
                activeOpacity={0.7}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.isDark ? '#374151' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name="remove" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              
              <View style={{ alignItems: 'center', minWidth: 140 }}>
                <TextInput
                  style={{
                    fontSize: 42,
                    fontWeight: '700',
                    color: theme.colors.primary || '#3BB273',
                    textAlign: 'center',
                    minWidth: 120,
                  }}
                value={weightText !== '' ? weightText : (weightIsEmpty ? '' : weight)}
                onChangeText={(text) => {
                  setWeightText(text);
                  if (text === '') {
                    setWeightIsEmpty(true);
                  } else {
                    setWeightIsEmpty(false);
                  }
                }}
                onBlur={() => {
                  if (weightText === '') {
                    setWeightIsEmpty(true);
                    return;
                  }
                  const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                  if (!isNaN(num)) {
                    if (units.weight === 'lb') {
                      const kg = convertWeight(num, 'lb', 'kg');
                      if (kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) {
                        const displayKg = convertWeight(kg, 'kg', units.weight);
                        setWeight(formatWeight(displayKg));
                        setWeightIsEmpty(false);
                        setWeightText('');
                        
                        // Atualizar objetivo automaticamente
                        if (profile?.weight) {
                          const autoGoal = calculateGoalFromWeight(kg, profile.weight);
                          setGoal(autoGoal);
                        }
                      }
                    } else {
                      if (num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG) {
                        setWeight(formatWeight(num));
                        setWeightIsEmpty(false);
                        setWeightText('');
                        
                        // Atualizar objetivo automaticamente
                        if (profile?.weight) {
                          const autoGoal = calculateGoalFromWeight(num, profile.weight);
                          setGoal(autoGoal);
                        }
                      }
                    }
                  }
                }}
                  keyboardType="numeric"
                  selectTextOnFocus={false}
                />
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  marginTop: 4,
                }}>
                  {units.weight}
                </Text>
              </View>
              
              <TouchableOpacity
                onPress={() => {
                  let currentValue = parseFloat(weight) || (units.weight === 'lb' ? MIN_WEIGHT_LB + (MAX_WEIGHT_LB - MIN_WEIGHT_LB) / 2 : 70);
                  if (weightText !== '') {
                    const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num)) {
                      if (units.weight === 'lb') {
                        const kg = convertWeight(num, 'lb', 'kg');
                        if (kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) {
                          const displayKg = convertWeight(kg, 'kg', units.weight);
                          currentValue = parseFloat(displayKg.toFixed(1));
                          setWeight(formatWeight(currentValue));
                        }
                      } else {
                        if (num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG) {
                          currentValue = parseFloat(num.toFixed(1));
                          setWeight(formatWeight(currentValue));
                        }
                      }
                    }
                  }
                  // Converter limites para a unidade atual
                  const minValue = units.weight === 'lb' ? MIN_WEIGHT_LB : MIN_WEIGHT_KG;
                  const maxValue = units.weight === 'lb' ? MAX_WEIGHT_LB : MAX_WEIGHT_KG;
                  const step = units.weight === 'lb' ? 1 : 0.5;
                  const newValue = Math.min(maxValue, parseFloat((currentValue + step).toFixed(1)));
                  setWeight(formatWeight(newValue));
                  setWeightText('');
                  
                  // Atualizar objetivo automaticamente
                  if (profile?.weight) {
                    const newValueKg = units.weight === 'lb' ? convertWeight(newValue, 'lb', 'kg') : newValue;
                    const autoGoal = calculateGoalFromWeight(newValueKg, profile.weight);
                    setGoal(autoGoal);
                  }
                }}
                activeOpacity={0.7}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.isDark ? '#374151' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 16,
                }}
              >
                <Ionicons name="add" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Slider */}
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={units.weight === 'lb' ? MIN_WEIGHT_LB : MIN_WEIGHT_KG}
              maximumValue={units.weight === 'lb' ? MAX_WEIGHT_LB : MAX_WEIGHT_KG}
              step={units.weight === 'lb' ? 1 : 0.5}
              value={parseFloat(weight) || (units.weight === 'lb' ? MIN_WEIGHT_LB + (MAX_WEIGHT_LB - MIN_WEIGHT_LB) / 2 : 70)}
              onValueChange={(value) => {
                setWeight(formatWeight(value));
                setWeightText('');
                setWeightIsEmpty(false);
                
                // Atualizar objetivo automaticamente
                if (profile?.weight) {
                  const newValueKg = units.weight === 'lb' ? convertWeight(value, 'lb', 'kg') : value;
                  const autoGoal = calculateGoalFromWeight(newValueKg, profile.weight);
                  setGoal(autoGoal);
                }
              }}
              minimumTrackTintColor={theme.colors.primary || '#3BB273'}
              maximumTrackTintColor={theme.colors.border || '#E5E7EB'}
              thumbTintColor={theme.colors.primary || '#3BB273'}
            />
          </View>

          {/* Card: Peso Recomendado */}
          {recommendedWeight && (
            <TouchableOpacity
              onPress={() => {
                // Definir o peso recomendado
                const displayWeight = units.weight === 'lb' 
                  ? convertWeight(recommendedWeight, 'kg', 'lb')
                  : recommendedWeight;
                
                setWeight(formatWeight(displayWeight));
                setWeightText('');
                setWeightIsEmpty(false);
                
                // Atualizar objetivo automaticamente
                if (profile?.weight) {
                  const autoGoal = calculateGoalFromWeight(recommendedWeight, profile.weight);
                  setGoal(autoGoal);
                }
              }}
              activeOpacity={0.7}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons 
                    name="bulb-outline" 
                    size={20} 
                    color={theme.colors.primary || '#3BB273'} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text,
                  }}>
                    {t('profile.recommendedWeight') || 'Peso Recomendado'}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 13,
                  color: theme.colors.textSecondary || '#6B7280',
                  marginTop: 4,
                }}>
                  {t('profile.recommendedWeightDescription') || 'Baseado no teu IMC saudável (18.5-25)'}
                </Text>
              </View>
              <View style={{
                alignItems: 'flex-end',
                marginLeft: 12,
              }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.primary || '#3BB273',
                }}>
                  {units.weight === 'lb' 
                    ? formatWeight(convertWeight(recommendedWeight, 'kg', 'lb'))
                    : formatWeight(recommendedWeight)}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: theme.colors.textSecondary || '#6B7280',
                  marginTop: 2,
                }}>
                  {units.weight}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Card: Rapidez por Semana */}
          {goal !== 'maintain' && (
            <View style={{
              backgroundColor: theme.colors.card,
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                {t('onboarding.goalSpeed.title') || 'Rapidez por semana'}
              </Text>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#6B7280',
                marginBottom: 24,
                lineHeight: 20,
              }}>
                {goal === 'gain' 
                  ? t('onboarding.goalSpeed.descriptionGain') || 'Quanto peso queres ganhar por semana?'
                  : t('onboarding.goalSpeed.descriptionLose') || 'Quanto peso queres perder por semana?'}
              </Text>

              {/* Valor atual destacado */}
              <View style={{ 
                alignItems: 'center', 
                marginBottom: 24,
                paddingVertical: 20,
                backgroundColor: (theme.colors.primary || '#3BB273') + '10',
                borderRadius: 12,
              }}>
                <Text style={{
                  fontSize: 42,
                  fontWeight: '700',
                  color: theme.colors.primary || '#3BB273',
                  marginBottom: 4,
                }}>
                  {(units.weight === 'lb' ? goalSpeed * 2.20462 : goalSpeed).toFixed(1)} {units.weight === 'lb' ? 'lbs' : 'kg'}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.colors.textSecondary || '#6B7280',
                  fontWeight: '500',
                }}>
                  {t('onboarding.goalSpeed.perWeek') || 'por semana'}
                </Text>
              </View>

              {/* Slider */}
              <View style={{ marginBottom: 16 }}>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0.1}
                  maximumValue={goal === 'gain' ? 3.0 : 2.0}
                  value={goalSpeed}
                  onValueChange={(value) => {
                    setGoalSpeed(value);
                  }}
                  minimumTrackTintColor={theme.colors.primary || '#3BB273'}
                  maximumTrackTintColor={theme.isDark ? '#374151' : '#E5E7EB'}
                  thumbTintColor={theme.colors.primary || '#3BB273'}
                  step={0.1}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#6B7280', fontWeight: '500' }}>
                    {(units.weight === 'lb' ? 0.1 * 2.20462 : 0.1).toFixed(1)} {units.weight === 'lb' ? 'lbs' : 'kg'}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary || '#6B7280', fontWeight: '500' }}>
                    {(units.weight === 'lb' ? (goal === 'gain' ? 3.0 : 2.0) * 2.20462 : (goal === 'gain' ? 3.0 : 2.0)).toFixed(1)} {units.weight === 'lb' ? 'lbs' : 'kg'}
                  </Text>
                </View>
              </View>

              {/* Texto informativo sobre limites */}
              <Text style={{
                fontSize: 12,
                color: theme.colors.textSecondary || '#6B7280',
                marginTop: 8,
                marginBottom: 16,
                lineHeight: 16,
                textAlign: 'center',
                fontStyle: 'italic',
              }}>
                {t('onboarding.goalSpeed.safetyNote') || 'Para a tua segurança, o ajuste calórico real pode ser limitado para garantir uma ingestão diária segura, mesmo que velocidades mais altas sejam selecionadas.'}
              </Text>

              {/* Botão Recommended */}
              <TouchableOpacity
                onPress={() => {
                  setGoalSpeed(0.5);
                }}
                activeOpacity={0.7}
                style={{
                  backgroundColor: theme.isDark ? '#374151' : '#F3F4F6',
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: theme.colors.text,
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  {t('onboarding.goalSpeed.recommended') || 'Recomendado'} ({(units.weight === 'lb' ? 0.5 * 2.20462 : 0.5).toFixed(1)} {units.weight === 'lb' ? 'lbs' : 'kg'})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Botão Salvar */}
        <View style={{
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'ios' ? 20 : 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border || '#E5E7EB',
        }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !weight}
            activeOpacity={0.7}
            style={{
              backgroundColor: (loading || !weight)
                ? theme.colors.border || '#E5E7EB'
                : theme.colors.primary || '#3BB273',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (loading || !weight) ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: (loading || !weight)
                  ? theme.colors.textSecondary || '#9CA3AF'
                  : '#FFFFFF',
              }}>
                {t('profile.save') || 'Salvar'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

