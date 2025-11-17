/**
 * UpdateWeightScreen
 *
 * Tela simples para atualizar o peso atual
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import Toast from 'react-native-toast-message';

import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { useUnits } from '../context/UnitsContext';

export function UpdateWeightScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { profile, updateProfile, refreshProfile } = useUser();
  const { units, convertWeight } = useUnits();

  const [sliderValue, setSliderValue] = useState(70);
  const [manualValue, setManualValue] = useState('');
  const [loading, setLoading] = useState(false);

  const formatFloat = (value: number) => {
    if (!isFinite(value)) return 0;
    return Math.round(value * 10) / 10;
  };

  const formatWeight = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

  const ranges = useMemo(() => {
    const MIN_KG = 30;
    const MAX_KG = 200;

    if (units.weight === 'lb') {
      return {
        min: Math.round(convertWeight(MIN_KG, 'kg', 'lb')),
        max: Math.round(convertWeight(MAX_KG, 'kg', 'lb')),
        step: 1,
      };
    }
    return {
      min: MIN_KG,
      max: MAX_KG,
      step: 0.5,
    };
  }, [units.weight, convertWeight]);

  useEffect(() => {
    if (profile?.weight) {
      const displayWeight =
        units.weight === 'lb'
          ? convertWeight(profile.weight, 'kg', 'lb')
          : profile.weight;
      setSliderValue(formatFloat(displayWeight));
      setManualValue('');
    }
  }, [profile?.weight, units.weight, convertWeight]);

  const currentDisplay = manualValue !== '' ? manualValue : formatWeight(sliderValue);

  const handleManualChange = (text: string) => {
    setManualValue(text);
    const normalized = parseFloat(text.replace(',', '.'));
    if (!isNaN(normalized)) {
      const clamped = Math.min(Math.max(normalized, ranges.min), ranges.max);
      setSliderValue(formatFloat(clamped));
    }
  };

  const handleSave = async () => {
    const rawValue =
      manualValue !== ''
        ? parseFloat(manualValue.replace(',', '.'))
        : sliderValue;

    if (isNaN(rawValue)) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.fillAllFields') || 'Por favor, preencha todos os campos',
      });
      return;
    }

    if (rawValue < ranges.min || rawValue > ranges.max) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.invalidWeight') || 'Peso inválido',
      });
      return;
    }

    setLoading(true);
    try {
      const weightInKg =
        units.weight === 'lb'
          ? convertWeight(rawValue, 'lb', 'kg')
          : rawValue;

      await updateProfile({ weight: parseFloat(weightInKg.toFixed(2)) });
      await refreshProfile();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
        <View
          style={{
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text, marginBottom: 8 }}>
            {t('progress.updateWeightTitle')}
          </Text>
          <Text style={{ color: theme.colors.textSecondary || '#6B7280', lineHeight: 20, marginBottom: 20 }}>
            {t('progress.updateWeightDescription')}
          </Text>

          <Text style={{ fontSize: 46, fontWeight: '800', color: theme.colors.text, textAlign: 'center' }}>
            {currentDisplay} {units.weight === 'kg' ? 'kg' : 'lbs'}
          </Text>

          <View style={{ marginVertical: 24 }}>
            <Slider
              minimumValue={ranges.min}
              maximumValue={ranges.max}
              step={ranges.step}
              value={sliderValue}
              onValueChange={value => {
                setSliderValue(value);
                setManualValue('');
              }}
              minimumTrackTintColor={theme.colors.primary || '#3BB273'}
              maximumTrackTintColor={theme.colors.border || '#CBD5F5'}
              thumbTintColor={theme.colors.primary || '#3BB273'}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: theme.colors.textSecondary || '#6B7280', fontWeight: '600' }}>
                {ranges.min}
              </Text>
              <Text style={{ color: theme.colors.textSecondary || '#6B7280', fontWeight: '600' }}>
                {ranges.max}
              </Text>
            </View>
          </View>

          <Text style={{ color: theme.colors.text, fontWeight: '600', marginBottom: 8 }}>
            {t('progress.weightInputLabel')}
          </Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextInput
              style={{
                flex: 1,
                fontSize: 18,
                color: theme.colors.text,
              }}
              value={manualValue}
              placeholder={t('progress.weightInputPlaceholder') || 'Ex: 72.5'}
              placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              keyboardType="decimal-pad"
              onChangeText={handleManualChange}
            />
            <Text style={{ color: theme.colors.textSecondary || '#6B7280', fontWeight: '600' }}>
              {units.weight === 'kg' ? 'kg' : 'lbs'}
            </Text>
          </View>

          <TouchableOpacity
            style={{
              marginTop: 24,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: loading
                ? (theme.colors.primary || '#3BB273') + '99'
                : (theme.colors.primary || '#3BB273'),
            }}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {t('progress.weightSaveButton')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

