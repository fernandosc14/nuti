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
  const [showGoalModal, setShowGoalModal] = useState(false);
  const initialized = useRef(false);
  const goalSpeedFromProfile = useRef<number | null>(null); // Guardar o valor do perfil para comparar

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

  useEffect(() => {
    if (profile) {
      // Converter peso desejado (ou atual) de kg (Firestore) para a unidade selecionada
      const desiredWeightKg = profile.desiredWeight ?? profile.weight ?? 0;
      const weightInKg = desiredWeightKg;
      const displayWeight = units.weight === 'lb' 
        ? convertWeight(weightInKg, 'kg', 'lb')
        : weightInKg;
      
      setWeight(displayWeight > 0 ? formatWeight(displayWeight) : '');
      setGoal(profile.goal || 'maintain');
      
      // Só atualizar goalSpeed se o valor do perfil mudou (não durante edição local)
      const profileGoalSpeed = profile.goalSpeed !== undefined && profile.goalSpeed !== null 
        ? profile.goalSpeed 
        : 0.5;
      
      // Só atualizar se o valor do perfil for diferente do que está guardado
      if (goalSpeedFromProfile.current === null || goalSpeedFromProfile.current !== profileGoalSpeed) {
        setGoalSpeed(profileGoalSpeed);
        goalSpeedFromProfile.current = profileGoalSpeed;
      }
      
      setWeightText('');
      setWeightIsEmpty(false);
      if (!initialized.current) {
        initialized.current = true;
      }
    }
  }, [profile, units.weight, convertWeight]);

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

      await updateProfile({
        desiredWeight: parseFloat(finalWeight),
        goal,
        goalSpeed: goal === 'maintain' ? undefined : goalSpeed,
      });

      // Forçar refresh do profile para garantir que o Dashboard recalcula as calorias
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
                      }
                    } else {
                      if (num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG) {
                        setWeight(formatWeight(num));
                        setWeightIsEmpty(false);
                        setWeightText('');
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
              }}
              minimumTrackTintColor={theme.colors.primary || '#3BB273'}
              maximumTrackTintColor={theme.colors.border || '#E5E7EB'}
              thumbTintColor={theme.colors.primary || '#3BB273'}
            />
          </View>

          {/* Card: Objetivo */}
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
              marginBottom: 16,
            }}>
              {t('profile.goal')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowGoalModal(true)}
              activeOpacity={0.7}
              style={{
                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
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
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {goal === 'lose'
                    ? t('onboarding.goal.lose')
                    : goal === 'gain'
                    ? t('onboarding.goal.gain')
                    : t('onboarding.goal.maintain')}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
            </TouchableOpacity>
          </View>

          {/* Modal de Seleção de Goal */}
          <Modal
            visible={showGoalModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowGoalModal(false)}
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'flex-end',
              }}
              onPress={() => setShowGoalModal(false)}
            >
              <Pressable
                style={{
                  backgroundColor: theme.colors.card,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingTop: 20,
                  paddingBottom: 60,
                  maxHeight: '60%',
                }}
                onPress={(e) => e.stopPropagation()}
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
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.text,
                  paddingHorizontal: 24,
                  marginBottom: 20,
                }}>
                  {t('profile.goal') || 'Meta'}
                </Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {(['lose', 'maintain', 'gain'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => {
                        setGoal(g);
                        setShowGoalModal(false);
                      }}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 18,
                        paddingHorizontal: 24,
                        backgroundColor: goal === g
                          ? (theme.colors.primary || '#3BB273') + '20'
                          : 'transparent',
                        borderWidth: goal === g ? 0 : 0,
                        borderLeftWidth: goal === g ? 4 : 0,
                        borderLeftColor: theme.colors.primary || '#3BB273',
                      }}
                    >
                      <Text style={{
                        fontSize: 16,
                        fontWeight: goal === g ? '700' : '500',
                        color: theme.colors.text,
                        flex: 1,
                      }}>
                        {g === 'lose'
                          ? t('onboarding.goal.lose')
                          : g === 'gain'
                          ? t('onboarding.goal.gain')
                          : t('onboarding.goal.maintain')}
                      </Text>
                      {goal === g && (
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary || '#3BB273'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Card: Rapidez por Semana - Só mostrar se não for maintain */}
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

