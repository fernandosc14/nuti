/**
 * EditPersonalDetailsScreen
 * 
 * Tela para editar os detalhes pessoais (peso, altura, objetivo)
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnits } from '../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Slider from '@react-native-community/slider';

export function EditPersonalDetailsScreen({ navigation }: any) {
  const { profile, updateProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { units, convertWeight, convertHeight, formatHeight, parseHeight } = useUnits();
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [weightIsEmpty, setWeightIsEmpty] = useState(false);
  const [heightIsEmpty, setHeightIsEmpty] = useState(false);
  const initialized = useRef(false);

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
  
  // Valores mínimos e máximos de altura
  const MIN_HEIGHT_CM = 120;
  const MAX_HEIGHT_CM = 220;
  const MIN_HEIGHT_IN = Math.round(convertHeight(MIN_HEIGHT_CM, 'cm', 'in'));
  const MAX_HEIGHT_IN = Math.round(convertHeight(MAX_HEIGHT_CM, 'cm', 'in'));

  useEffect(() => {
    if (profile && !initialized.current) {
      // Converter peso de kg (Firestore) para a unidade selecionada
      const weightInKg = profile.weight || 0;
      const displayWeight = units.weight === 'lb' 
        ? convertWeight(weightInKg, 'kg', 'lb')
        : weightInKg;
      
      setWeight(displayWeight > 0 ? formatWeight(displayWeight) : '');
      
      // Converter altura de cm (Firestore) para a unidade selecionada
      const heightInCm = profile.height || 175;
      if (units.height === 'in') {
        // Converter para ft'in" formato
        const inches = convertHeight(heightInCm, 'cm', 'in');
        const feet = Math.floor(inches / 12);
        const remainingInches = Math.round(inches % 12);
        setHeight(`${feet}'${remainingInches}"`);
      } else {
        setHeight(Math.round(heightInCm).toString());
      }
      
      setWeightText('');
      setHeightText('');
      setWeightIsEmpty(false);
      setHeightIsEmpty(false);
      initialized.current = true;
    }
  }, [profile, units.weight, units.height, convertWeight, convertHeight]);

  const handleSave = async () => {
    if (!weight || !height) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.fillAllFields') || 'Por favor, preencha todos os campos',
      });
      return;
    }

    setLoading(true);
    try {
      let finalWeight = weight;
      let finalHeight = height;
      
      if (weightText !== '') {
        const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
          if (units.weight === 'lb') {
            // Converter de lb para kg antes de guardar (guardar valor exato, sem arredondar)
            const kg = convertWeight(num, 'lb', 'kg');
            if (kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) {
              finalWeight = kg.toString(); // Guardar valor exato
            }
          } else {
            // Já está em kg (guardar valor exato)
            if (num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG) {
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
            finalWeight = kg.toString(); // Guardar valor exato
          } else {
            finalWeight = weightNum.toString(); // Guardar valor exato
          }
        }
      }
      
      if (heightText !== '') {
        // Converter altura da unidade selecionada para cm
        const heightInCm = parseHeight(heightText, units.height);
        if (heightInCm >= 120 && heightInCm <= 220) {
          finalHeight = heightInCm.toString();
        }
      } else if (height) {
        // Se não há heightText mas há height, converter se necessário
        if (units.height === 'in') {
          // Converter de ft'in" para cm
          const heightInCm = parseHeight(height, 'in');
          finalHeight = heightInCm.toString();
        } else {
          // Já está em cm
          const heightNum = parseFloat(height);
          if (!isNaN(heightNum) && heightNum >= 120 && heightNum <= 220) {
            finalHeight = heightNum.toString();
          }
        }
      }

      await updateProfile({
        weight: parseFloat(finalWeight),
        height: parseFloat(finalHeight),
      });

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 20,
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
            {t('profile.personalDetails') || 'Detalhes pessoais'}
          </Text>
        </View>

        {/* Conteúdo */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Peso com slider */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('profile.weight')}
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.primary || '#3BB273',
              }}>
                {units.weight}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
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
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="remove" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              
              <TextInput
                style={{
                  fontSize: 32,
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
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 12,
                }}
              >
                <Ionicons name="add" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={{
              textAlign: 'center',
              fontSize: 12,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 8,
            }}>
              {units.weight}
            </Text>
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

          {/* Altura com slider */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('profile.height')}
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.primary || '#3BB273',
              }}>
                {units.height === 'cm' ? 'cm' : "ft'in"}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  let currentValueCm = 175;
                  if (heightText !== '') {
                    currentValueCm = parseHeight(heightText, units.height);
                  } else if (height) {
                    if (units.height === 'in') {
                      currentValueCm = parseHeight(height, 'in');
                    } else {
                      currentValueCm = parseFloat(height) || 175;
                    }
                  }
                  
                  // Decrementar (em cm)
                  const newValueCm = Math.max(MIN_HEIGHT_CM, currentValueCm - 1);
                  
                  // Converter de volta para a unidade selecionada
                  if (units.height === 'in') {
                    const inches = convertHeight(newValueCm, 'cm', 'in');
                    const feet = Math.floor(inches / 12);
                    const remainingInches = Math.round(inches % 12);
                    setHeight(`${feet}'${remainingInches}"`);
                  } else {
                    setHeight(Math.round(newValueCm).toString());
                  }
                  setHeightText('');
                }}
                activeOpacity={0.7}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="remove" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              
              <TextInput
                style={{
                  fontSize: units.height === 'in' ? 24 : 32,
                  fontWeight: '700',
                  color: theme.colors.primary || '#3BB273',
                  textAlign: 'center',
                  minWidth: units.height === 'in' ? 140 : 120,
                }}
                value={heightText !== '' ? heightText : (heightIsEmpty ? '' : height)}
                onChangeText={(text) => {
                  setHeightText(text);
                  if (text === '') {
                    setHeightIsEmpty(true);
                  } else {
                    setHeightIsEmpty(false);
                  }
                }}
                onBlur={() => {
                  if (heightText === '') {
                    setHeightIsEmpty(true);
                    return;
                  }
                  
                  // Converter altura da unidade selecionada para cm
                  const heightInCm = parseHeight(heightText, units.height);
                  
                  // Validar
                  if (heightInCm >= MIN_HEIGHT_CM && heightInCm <= MAX_HEIGHT_CM) {
                    // Converter de volta para a unidade selecionada
                    if (units.height === 'in') {
                      const inches = convertHeight(heightInCm, 'cm', 'in');
                      const feet = Math.floor(inches / 12);
                      const remainingInches = Math.round(inches % 12);
                      setHeight(`${feet}'${remainingInches}"`);
                    } else {
                      setHeight(Math.round(heightInCm).toString());
                    }
                  }
                  setHeightIsEmpty(false);
                  setHeightText('');
                }}
                keyboardType="numeric"
                selectTextOnFocus={false}
                placeholder={units.height === 'in' ? "5'10\"" : '175'}
              />
              
              <TouchableOpacity
                onPress={() => {
                  let currentValueCm = 175;
                  if (heightText !== '') {
                    currentValueCm = parseHeight(heightText, units.height);
                  } else if (height) {
                    if (units.height === 'in') {
                      currentValueCm = parseHeight(height, 'in');
                    } else {
                      currentValueCm = parseFloat(height) || 175;
                    }
                  }
                  
                  // Incrementar (em cm)
                  const newValueCm = Math.min(MAX_HEIGHT_CM, currentValueCm + 1);
                  
                  // Converter de volta para a unidade selecionada
                  if (units.height === 'in') {
                    const inches = convertHeight(newValueCm, 'cm', 'in');
                    const feet = Math.floor(inches / 12);
                    const remainingInches = Math.round(inches % 12);
                    setHeight(`${feet}'${remainingInches}"`);
                  } else {
                    setHeight(Math.round(newValueCm).toString());
                  }
                  setHeightText('');
                }}
                activeOpacity={0.7}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 12,
                }}
              >
                <Ionicons name="add" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={{
              textAlign: 'center',
              fontSize: 12,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 8,
            }}>
              {units.height === 'cm' ? 'cm' : "ft'in"}
            </Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={MIN_HEIGHT_CM}
              maximumValue={MAX_HEIGHT_CM}
              step={1}
              value={(() => {
                // Converter altura atual para cm para o slider
                if (heightText !== '') {
                  return parseHeight(heightText, units.height);
                } else if (height) {
                  if (units.height === 'in') {
                    return parseHeight(height, 'in');
                  } else {
                    return parseFloat(height) || 175;
                  }
                }
                return 175;
              })()}
              onValueChange={(value) => {
                // Converter valor do slider para a unidade selecionada
                if (units.height === 'in') {
                  const inches = convertHeight(value, 'cm', 'in');
                  const feet = Math.floor(inches / 12);
                  const remainingInches = Math.round(inches % 12);
                  setHeight(`${feet}'${remainingInches}"`);
                } else {
                  setHeight(Math.round(value).toString());
                }
                setHeightText('');
                setHeightIsEmpty(false);
              }}
              minimumTrackTintColor={theme.colors.primary || '#3BB273'}
              maximumTrackTintColor={theme.colors.border || '#E5E7EB'}
              thumbTintColor={theme.colors.primary || '#3BB273'}
            />
          </View>

        </ScrollView>

        {/* Botão Salvar */}
        <View style={{
          paddingHorizontal: 24,
          paddingBottom: 32,
          paddingTop: 20,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border || '#E5E7EB',
        }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !weight || !height}
            activeOpacity={0.7}
            style={{
              backgroundColor: (loading || !weight || !height)
                ? theme.colors.border || '#E5E7EB'
                : theme.colors.primary || '#3BB273',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (loading || !weight || !height) ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: (loading || !weight || !height)
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

