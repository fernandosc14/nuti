/**
 * EditPersonalDetailsScreen
 * 
 * Tela para editar os detalhes pessoais (peso, altura, objetivo)
 */

import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Slider from '@react-native-community/slider';

export function EditPersonalDetailsScreen({ navigation }: any) {
  const { profile, updateProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [loading, setLoading] = useState(false);
  const [isImperial, setIsImperial] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [weightIsEmpty, setWeightIsEmpty] = useState(false);
  const [heightIsEmpty, setHeightIsEmpty] = useState(false);

  useEffect(() => {
    if (profile) {
      setWeight(profile.weight ? profile.weight.toString() : '');
      setHeight(profile.height ? profile.height.toString() : '');
      setGoal(profile.goal || 'maintain');
      setWeightText('');
      setHeightText('');
      setWeightIsEmpty(false);
      setHeightIsEmpty(false);
    }
  }, [profile]);

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
          if (isImperial) {
            const kg = num / 2.20462;
            if (kg >= 30 && kg <= 200) {
              finalWeight = (Math.round(kg * 2) / 2).toString();
            }
          } else {
            if (num >= 30 && num <= 200) {
              finalWeight = (Math.round(num * 2) / 2).toString();
            }
          }
        }
      }
      
      if (heightText !== '') {
        let newHeight = parseFloat(height) || 175;
        if (isImperial) {
          const cleanText = heightText.replace(/[^0-9'"]/g, '');
          let feet = 0;
          let inches = 0;
          const match1 = cleanText.match(/(\d+)'(\d+)/);
          if (match1) {
            feet = parseInt(match1[1]) || 0;
            inches = parseInt(match1[2]) || 0;
          } else {
            const num = parseInt(cleanText);
            if (!isNaN(num)) {
              if (num >= 40 && num <= 84) {
                feet = Math.floor(num / 10);
                inches = num % 10;
              } else if (num >= 4 && num <= 7) {
                feet = num;
                inches = 0;
              }
            }
          }
          if (feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
            const totalCm = feet * 30.48 + inches * 2.54;
            if (totalCm >= 120 && totalCm <= 220) {
              newHeight = Math.round(totalCm);
            }
          }
        } else {
          const num = parseInt(heightText.replace(/[^0-9]/g, ''));
          if (!isNaN(num) && num >= 120 && num <= 220) {
            newHeight = num;
          }
        }
        finalHeight = newHeight.toString();
      }

      await updateProfile({
        weight: parseFloat(finalWeight),
        height: parseFloat(finalHeight),
        goal,
      });

      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Sucesso',
        text2: t('profile.detailsUpdated') || 'Detalhes atualizados com sucesso',
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('profile.updateError') || 'Erro ao atualizar detalhes',
      });
    } finally {
      setLoading(false);
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
              <View style={{ flexDirection: 'row', backgroundColor: theme.colors.border || '#E5E7EB', borderRadius: 8, padding: 2 }}>
                <TouchableOpacity
                  onPress={() => setIsImperial(false)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: !isImperial ? theme.colors.primary || '#3BB273' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: !isImperial ? '#FFFFFF' : theme.colors.textSecondary || '#9CA3AF',
                  }}>
                    kg
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsImperial(true)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: isImperial ? theme.colors.primary || '#3BB273' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isImperial ? '#FFFFFF' : theme.colors.textSecondary || '#9CA3AF',
                  }}>
                    lbs
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  let currentValue = parseFloat(weight) || 70;
                  if (weightText !== '') {
                    const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num)) {
                      if (isImperial) {
                        const kg = num / 2.20462;
                        if (kg >= 30 && kg <= 200) {
                          currentValue = Math.round(kg * 2) / 2;
                          setWeight(currentValue.toString());
                        }
                      } else {
                        if (num >= 30 && num <= 200) {
                          currentValue = Math.round(num * 2) / 2;
                          setWeight(currentValue.toString());
                        }
                      }
                    }
                  }
                  const newValue = Math.max(30, currentValue - 0.5);
                  setWeight(newValue.toString());
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
                value={weightText !== '' ? weightText : (weightIsEmpty ? '' : (isImperial ? `${Math.round(parseFloat(weight || '70') * 2.20462)}` : weight))}
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
                    if (isImperial) {
                      const kg = num / 2.20462;
                      if (kg >= 30 && kg <= 200) {
                        setWeight((Math.round(kg * 2) / 2).toString());
                        setWeightIsEmpty(false);
                        setWeightText('');
                      }
                    } else {
                      if (num >= 30 && num <= 200) {
                        setWeight((Math.round(num * 2) / 2).toString());
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
                  let currentValue = parseFloat(weight) || 70;
                  if (weightText !== '') {
                    const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num)) {
                      if (isImperial) {
                        const kg = num / 2.20462;
                        if (kg >= 30 && kg <= 200) {
                          currentValue = Math.round(kg * 2) / 2;
                          setWeight(currentValue.toString());
                        }
                      } else {
                        if (num >= 30 && num <= 200) {
                          currentValue = Math.round(num * 2) / 2;
                          setWeight(currentValue.toString());
                        }
                      }
                    }
                  }
                  const newValue = Math.min(200, currentValue + 0.5);
                  setWeight(newValue.toString());
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
              {isImperial ? 'lbs' : 'kg'}
            </Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={30}
              maximumValue={200}
              step={0.5}
              value={parseFloat(weight) || 70}
              onValueChange={(value) => {
                setWeight((Math.round(value * 2) / 2).toString());
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
              <View style={{ flexDirection: 'row', backgroundColor: theme.colors.border || '#E5E7EB', borderRadius: 8, padding: 2 }}>
                <TouchableOpacity
                  onPress={() => setIsImperial(false)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: !isImperial ? theme.colors.primary || '#3BB273' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: !isImperial ? '#FFFFFF' : theme.colors.textSecondary || '#9CA3AF',
                  }}>
                    cm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsImperial(true)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: isImperial ? theme.colors.primary || '#3BB273' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isImperial ? '#FFFFFF' : theme.colors.textSecondary || '#9CA3AF',
                  }}>
                    ft/in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  let currentValue = parseFloat(height) || 175;
                  if (heightText !== '') {
                    const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                    if (!isNaN(num) && num >= 120 && num <= 220) {
                      currentValue = num;
                      setHeight(currentValue.toString());
                    }
                  }
                  const newValue = Math.max(120, currentValue - 1);
                  setHeight(newValue.toString());
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
                  fontSize: 32,
                  fontWeight: '700',
                  color: theme.colors.primary || '#3BB273',
                  textAlign: 'center',
                  minWidth: 120,
                }}
                value={heightText !== '' ? heightText : (heightIsEmpty ? '' : (isImperial ? `${Math.floor(parseFloat(height || '175') / 30.48)}'${Math.round((parseFloat(height || '175') % 30.48) / 2.54)}"` : height))}
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
                  let newHeight = parseFloat(height) || 175;
                  if (isImperial) {
                    const cleanText = heightText.replace(/[^0-9'"]/g, '');
                    let feet = 0;
                    let inches = 0;
                    const match1 = cleanText.match(/(\d+)'(\d+)/);
                    if (match1) {
                      feet = parseInt(match1[1]) || 0;
                      inches = parseInt(match1[2]) || 0;
                    } else {
                      const num = parseInt(cleanText);
                      if (!isNaN(num)) {
                        if (num >= 40 && num <= 84) {
                          feet = Math.floor(num / 10);
                          inches = num % 10;
                        } else if (num >= 4 && num <= 7) {
                          feet = num;
                          inches = 0;
                        }
                      }
                    }
                    if (feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
                      const totalCm = feet * 30.48 + inches * 2.54;
                      if (totalCm >= 120 && totalCm <= 220) {
                        newHeight = Math.round(totalCm);
                      }
                    }
                  } else {
                    const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                    if (!isNaN(num) && num >= 120 && num <= 220) {
                      newHeight = num;
                    }
                  }
                  setHeight(newHeight.toString());
                  setHeightIsEmpty(false);
                  setHeightText('');
                }}
                keyboardType={isImperial ? "default" : "numeric"}
                selectTextOnFocus={false}
              />
              
              <TouchableOpacity
                onPress={() => {
                  let currentValue = parseFloat(height) || 175;
                  if (heightText !== '') {
                    const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                    if (!isNaN(num) && num >= 120 && num <= 220) {
                      currentValue = num;
                      setHeight(currentValue.toString());
                    }
                  }
                  const newValue = Math.min(220, currentValue + 1);
                  setHeight(newValue.toString());
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
              {isImperial ? "ft'in\"" : 'cm'}
            </Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={120}
              maximumValue={220}
              step={1}
              value={parseFloat(height) || 175}
              onValueChange={(value) => {
                setHeight(Math.round(value).toString());
                setHeightText('');
                setHeightIsEmpty(false);
              }}
              minimumTrackTintColor={theme.colors.primary || '#3BB273'}
              maximumTrackTintColor={theme.colors.border || '#E5E7EB'}
              thumbTintColor={theme.colors.primary || '#3BB273'}
            />
          </View>

          {/* Objetivo */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: 16,
            }}>
              {t('profile.goal')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['lose', 'maintain', 'gain'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGoal(g)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: goal === g
                      ? theme.colors.primary || '#3BB273'
                      : theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: goal === g
                      ? theme.colors.primary || '#3BB273'
                      : theme.colors.border || '#E5E7EB',
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: goal === g
                      ? '#FFFFFF'
                      : theme.colors.text,
                  }}>
                    {g === 'lose'
                      ? t('onboarding.goal.lose')
                      : g === 'gain'
                      ? t('onboarding.goal.gain')
                      : t('onboarding.goal.maintain')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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

