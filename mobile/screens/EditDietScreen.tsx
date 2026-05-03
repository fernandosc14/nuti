/**
 * EditDietScreen
 * 
 * Tela para editar a dieta
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

type DietType = 'classic' | 'pescatarian' | 'vegetarian' | 'vegan';

export function EditDietScreen({ navigation }: any) {
  const { profile, updateProfile, refreshProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [selectedDiet, setSelectedDiet] = useState<DietType>('classic');
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      if (profile.diet) {
        setSelectedDiet(profile.diet as DietType);
      }
      initialized.current = true;
    }
  }, [profile]);

  const dietOptions: Array<{
    value: DietType;
    title: string;
    description: string;
    icon: string;
    color: string;
  }> = [
    { 
      value: 'classic', 
      title: t('onboarding.diet.classic.title'), 
      description: t('onboarding.diet.classic.description'), 
      icon: 'restaurant-outline', 
      color: '#3BB273' 
    },
    { 
      value: 'pescatarian', 
      title: t('onboarding.diet.pescatarian.title'), 
      description: t('onboarding.diet.pescatarian.description'), 
      icon: 'fish-outline', 
      color: '#60A5FA' 
    },
    { 
      value: 'vegetarian', 
      title: t('onboarding.diet.vegetarian.title'), 
      description: t('onboarding.diet.vegetarian.description'), 
      icon: 'leaf-outline', 
      color: '#34D399' 
    },
    { 
      value: 'vegan', 
      title: t('onboarding.diet.vegan.title'), 
      description: t('onboarding.diet.vegan.description'), 
      icon: 'flower-outline', 
      color: '#A78BFA' 
    },
  ];

  const handleSave = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      await updateProfile({
        diet: selectedDiet,
      });
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
          {t('onboarding.diet.title') || "What's your diet?"}
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
          {t('onboarding.diet.description') || 'Will be used for meal suggestions'}
        </Text>

        <View style={{ gap: 12 }}>
          {dietOptions.map((option) => {
            const isSelected = selectedDiet === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setSelectedDiet(option.value)}
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

