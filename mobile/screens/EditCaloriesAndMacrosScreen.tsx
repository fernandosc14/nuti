/**
 * EditCaloriesAndMacrosScreen
 * 
 * Tela para editar as metas de calorias e macros
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

export function EditCaloriesAndMacrosScreen({ navigation }: any) {
  const { profile, updateProfile, refreshProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      const goal = (profile as any)?.dailyCalorieGoal || 2000;
      const proteinGoal = (profile as any)?.dailyProteinGoal || Math.round((goal * 0.30) / 4);
      const carbsGoal = (profile as any)?.dailyCarbsGoal || Math.round((goal * 0.40) / 4);
      const fatGoal = (profile as any)?.dailyFatGoal || Math.round((goal * 0.30) / 9);
      
      setCalories(goal.toString());
      setProtein(proteinGoal.toString());
      setCarbs(carbsGoal.toString());
      setFat(fatGoal.toString());
    }
  }, [profile]);

  const handleSave = async () => {
    const caloriesNum = parseInt(calories) || 0;
    const proteinNum = parseInt(protein) || 0;
    const carbsNum = parseInt(carbs) || 0;
    const fatNum = parseInt(fat) || 0;

    if (caloriesNum < 1200 || caloriesNum > 5000) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('dashboard.invalidCalories') || 'Calorias devem estar entre 1200 e 5000',
      });
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        dailyCalorieGoal: caloriesNum,
        dailyProteinGoal: proteinNum,
        dailyCarbsGoal: carbsNum,
        dailyFatGoal: fatNum,
      } as any);
      await refreshProfile();
      setLoading(false);
      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Sucesso',
        text2: t('dashboard.goalsUpdated') || 'Metas atualizadas com sucesso',
      });
      navigation.goBack();
    } catch (error: any) {
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('profile.updateError') || 'Erro ao atualizar metas',
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
            {t('profile.caloriesAndMacros') || 'Calorias e Macros'}
          </Text>
        </View>

        {/* Conteúdo */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: Platform.OS === 'ios' ? 32 : 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Calorias Card */}
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="flame" size={24} color="#EF4444" />
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: theme.colors.text,
              }}>
                {t('dashboard.calories') || 'Calories'}
              </Text>
            </View>
            <TextInput
              style={{
                backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 16,
                fontSize: 28,
                fontWeight: '700',
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                textAlign: 'center',
              }}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="2000"
              placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
            />
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
              marginTop: 12,
              fontWeight: '600',
            }}>
              kcal
            </Text>
          </View>

          {/* Proteína */}
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
                <Ionicons name="nutrition" size={18} color="#EF4444" />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('dashboard.protein') || 'Proteína'}
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
              paddingHorizontal: 12,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="150"
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              />
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.textSecondary || '#9CA3AF',
                marginLeft: 6,
              }}>
                g
              </Text>
            </View>
          </View>

          {/* Carboidratos */}
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#D1FAE5',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
                <Ionicons name="fast-food" size={18} color="#10B981" />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('dashboard.carbs') || 'Carboidratos'}
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
              paddingHorizontal: 12,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="200"
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              />
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.textSecondary || '#9CA3AF',
                marginLeft: 6,
              }}>
                g
              </Text>
            </View>
          </View>

          {/* Gordura */}
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FEF9C3',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
                <Ionicons name="flame" size={18} color="#EAB308" />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('dashboard.fat') || 'Gordura'}
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.isDark ? '#1F2937' : '#F9FAFB',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
              paddingHorizontal: 12,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholder="67"
                placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              />
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.colors.textSecondary || '#9CA3AF',
                marginLeft: 6,
              }}>
                g
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Botão Save */}
        <View style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: Platform.OS === 'ios' ? 32 : 24,
          backgroundColor: theme.colors.background,
        }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={{
              backgroundColor: loading
                ? theme.colors.border || '#E5E7EB'
                : theme.colors.primary || '#3BB273',
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.5 : 1,
            }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#FFFFFF',
              }}>
                {t('common.save') || 'Guardar'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

