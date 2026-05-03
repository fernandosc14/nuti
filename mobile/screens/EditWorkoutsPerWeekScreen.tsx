/**
 * EditWorkoutsPerWeekScreen
 * 
 * Tela para editar quantos treinos por semana
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { calculateCalorieGoalFromProfile } from '../utils/nutritionUtils';

type WorkoutFrequency = 'none' | '1x' | '1-2x' | '2-3x' | '3-4x' | '5-6x' | 'daily';

export function EditWorkoutsPerWeekScreen({ navigation }: any) {
  const { profile, updateProfile, refreshProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutFrequency>('none');
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      if (profile.workoutsPerWeek) {
        setSelectedWorkout(profile.workoutsPerWeek as WorkoutFrequency);
      }
      initialized.current = true;
    }
  }, [profile]);

  const workoutOptions: Array<{
    value: WorkoutFrequency;
    title: string;
    description: string;
    icon: string;
    color: string;
  }> = [
    { 
      value: 'none', 
      title: t('onboarding.workouts.none.title'), 
      description: t('onboarding.workouts.none.description'), 
      icon: 'bed-outline', 
      color: '#9CA3AF' 
    },
    { 
      value: '1x', 
      title: t('onboarding.workouts.1x.title'), 
      description: t('onboarding.workouts.1x.description'), 
      icon: 'walk-outline', 
      color: '#60A5FA' 
    },
    { 
      value: '1-2x', 
      title: t('onboarding.workouts.1-2x.title'), 
      description: t('onboarding.workouts.1-2x.description'), 
      icon: 'bicycle-outline', 
      color: '#34D399' 
    },
    { 
      value: '2-3x', 
      title: t('onboarding.workouts.2-3x.title'), 
      description: t('onboarding.workouts.2-3x.description'), 
      icon: 'fitness-outline', 
      color: '#3BB273' 
    },
    { 
      value: '3-4x', 
      title: t('onboarding.workouts.3-4x.title'), 
      description: t('onboarding.workouts.3-4x.description'), 
      icon: 'barbell-outline', 
      color: '#F59E0B' 
    },
    { 
      value: '5-6x', 
      title: t('onboarding.workouts.5-6x.title'), 
      description: t('onboarding.workouts.5-6x.description'), 
      icon: 'flame-outline', 
      color: '#EF4444' 
    },
    { 
      value: 'daily', 
      title: t('onboarding.workouts.daily.title'), 
      description: t('onboarding.workouts.daily.description'), 
      icon: 'flash-outline', 
      color: '#8B5CF6' 
    },
  ];

  const handleSave = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Recalcular calorias e macros baseado nos novos treinos por semana
      // Criar um perfil temporário com os novos valores para calcular
      const tempProfile = {
        ...profile,
        workoutsPerWeek: selectedWorkout,
      } as any;
      
      const calculatedPlan = calculateCalorieGoalFromProfile(tempProfile);
      
      // Preparar dados para atualizar
      const updateData: any = {
        workoutsPerWeek: selectedWorkout,
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
        text1: t('profile.updateSuccess') || 'Success',
        text2: t('profile.detailsUpdated') || 'Details updated successfully',
      });
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error: any) {
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Error',
        text2: error.message || t('profile.updateError') || 'Error updating details',
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
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
          {t('profile.workoutsPerWeek') || 'Treinos por semana'}
        </Text>
      </View>

      {/* Conteúdo */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{
          fontSize: 14,
          color: theme.colors.textSecondary || '#6B7280',
          marginBottom: 24,
          lineHeight: 20,
        }}>
          {t('onboarding.workoutsPerWeekDescription') || 'This helps us calculate your calorie needs.'}
        </Text>

        <View style={{ gap: 12 }}>
          {workoutOptions.map((option) => {
            const isSelected = selectedWorkout === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setSelectedWorkout(option.value)}
                style={{
                  borderRadius: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderWidth: isSelected ? 2.5 : 2,
                  backgroundColor: isSelected
                    ? '#3BB273'
                    : (theme.isDark ? '#1F2937' : '#FFFFFF'),
                  borderColor: isSelected
                    ? '#3BB273'
                    : (theme.isDark ? '#374151' : '#E5E7EB'),
                  shadowColor: isSelected ? '#3BB273' : '#000',
                  shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                  shadowOpacity: isSelected ? 0.2 : 0.1,
                  shadowRadius: isSelected ? 8 : 4,
                  elevation: isSelected ? 4 : 2,
                }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : (theme.isDark ? '#374151' : '#F3F4F6'),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}>
                    <Ionicons 
                      name={option.icon as any} 
                      size={24} 
                      color={isSelected ? '#FFFFFF' : option.color} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        marginBottom: 6,
                        color: isSelected
                          ? '#FFFFFF'
                          : theme.colors.text,
                        lineHeight: 22,
                      }}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13.5,
                        lineHeight: 19,
                        color: isSelected
                          ? 'rgba(255, 255, 255, 0.85)'
                          : (theme.colors.textSecondary || '#6B7280'),
                      }}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Botão Salvar */}
      <View style={{
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 32 : 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border || '#E5E7EB',
      }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.7}
          style={{
            backgroundColor: loading
              ? theme.colors.border || '#E5E7EB'
              : theme.colors.primary || '#3BB273',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: loading
                ? theme.colors.textSecondary || '#9CA3AF'
                : '#FFFFFF',
            }}>
              {t('profile.save') || 'Save'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

