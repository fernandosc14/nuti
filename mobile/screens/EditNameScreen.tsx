/**
 * EditNameScreen
 * 
 * Tela para editar o nome do utilizador
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile?.name]);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.nameRequired') || 'Por favor, insira um nome',
      });
      return;
    }

    setLoading(true);
    try {
      await updateProfile({ name: name.trim() });
      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Sucesso',
        text2: t('profile.nameUpdated') || 'Nome atualizado com sucesso',
      });
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('profile.updateError') || 'Erro ao atualizar nome',
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
            {t('profile.editName') || 'Editar nome'}
          </Text>
        </View>

        {/* Conteúdo */}
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
          {/* Campo de Texto */}
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
            placeholder={t('profile.namePlaceholder') || 'Insira o nome aqui'}
            placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
            autoFocus={true}
            maxLength={50}
          />
        </View>

        {/* Botão Pronto */}
        <View style={{
          paddingHorizontal: 24,
          paddingBottom: 32,
          paddingTop: 20,
        }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !name.trim()}
            activeOpacity={0.7}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (loading || !name.trim()) ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('profile.done') || 'Pronto'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
