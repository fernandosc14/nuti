/**
 * EditNameScreen
 * 
 * Tela para editar o nome do utilizador
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
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function EditNameScreen({ navigation }: any) {
  const { profile, updateProfile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);
  
  // Validar se a idade está no intervalo correto
  const isAgeValid = () => {
    if (!age || age === '') return true; // Idade é opcional
    const ageNum = parseInt(age);
    return !isNaN(ageNum) && ageNum >= 18 && ageNum <= 120;
  };
  
  const ageError = () => {
    if (!age || age === '') return null;
    const ageNum = parseInt(age);
    if (isNaN(ageNum)) return null;
    if (ageNum < 18) return t('profile.ageTooYoung') || 'Minimum age is 18';
    if (ageNum > 120) return t('profile.ageTooOld') || 'Maximum age is 120';
    return null;
  };

  // Calcular idade a partir da data de nascimento
  const calculateAge = (dateOfBirth: Date | undefined): number => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    // Só inicializar uma vez quando o profile estiver disponível
    if (!initialized.current && profile) {
      if (profile.name) {
        setName(profile.name);
      }
      if (profile.dateOfBirth) {
        const calculatedAge = calculateAge(profile.dateOfBirth);
        setAge(calculatedAge > 0 ? calculatedAge.toString() : '');
      }
      initialized.current = true;
    }
  }, [profile]);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Error',
        text2: t('profile.nameRequired') || 'Please enter a name',
      });
      return;
    }

    // Validar idade se fornecida
    if (!isAgeValid()) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Error',
        text2: ageError() || t('profile.invalidAge') || 'Please enter a valid age (18-120)',
      });
      return;
    }

    setLoading(true);
    try {
      const updates: any = { name: name.trim() };
      
      // Se a idade foi fornecida, calcular dateOfBirth
      if (age && parseInt(age) > 0) {
        const ageNum = parseInt(age);
        const today = new Date();
        const birthYear = today.getFullYear() - ageNum;
        // Usar 1 de Janeiro como data padrão (aproximação)
        const dateOfBirth = new Date(birthYear, 0, 1);
        updates.dateOfBirth = dateOfBirth;
      }
      
      await updateProfile(updates);
      
      // Desativar loading antes de navegar
      setLoading(false);
      
      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Success',
        text2: t('profile.nameUpdated') || 'Name updated successfully',
      });
      
      // Navegar após um pequeno delay para o Toast aparecer
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error: any) {
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Error',
        text2: error.message || t('profile.updateError') || 'Error updating name',
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
            {t('profile.editName') || 'Edit name'}
          </Text>
        </View>

        {/* Conteúdo */}
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Campo de Nome */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: 8,
            }}>
              {t('profile.name') || 'Name'}
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 16,
                fontSize: 16,
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
              }}
              value={name}
              onChangeText={setName}
              placeholder={t('profile.namePlaceholder') || 'Enter your name here'}
              placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              autoFocus={true}
              maxLength={50}
            />
          </View>

          {/* Campo de Idade */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: 8,
            }}>
              {t('profile.age') || 'Age'}
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 16,
                fontSize: 16,
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
              }}
              value={age}
              onChangeText={(text) => {
                // Permitir apenas números
                const numericValue = text.replace(/[^0-9]/g, '');
                // Permitir qualquer número, mas validar depois
                if (numericValue === '' || parseInt(numericValue) <= 120) {
                  setAge(numericValue);
                }
              }}
              placeholder={t('profile.agePlaceholder') || 'Enter your age'}
              placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              keyboardType="numeric"
              maxLength={3}
            />
            {ageError() && (
              <Text style={{
                fontSize: 12,
                color: '#EF4444',
                marginTop: 4,
                marginLeft: 4,
              }}>
                {ageError()}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Botão Pronto */}
        <View style={{
          paddingHorizontal: 24,
          paddingBottom: 32,
          paddingTop: 20,
        }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !name.trim() || !isAgeValid()}
            activeOpacity={0.7}
            style={{
              backgroundColor: (loading || !name.trim() || !isAgeValid())
                ? theme.colors.border || '#E5E7EB'
                : theme.colors.primary || '#3BB273',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (loading || !name.trim() || !isAgeValid()) ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: (loading || !name.trim() || !isAgeValid())
                  ? theme.colors.textSecondary || '#9CA3AF'
                  : '#FFFFFF',
              }}>
                {t('profile.save') || 'Save'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
