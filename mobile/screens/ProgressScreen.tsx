/**
 * ProgressScreen
 * 
 * Tela de progresso do utilizador (em desenvolvimento)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnits } from '../context/UnitsContext';

const BMI_MIN = 10;
const BMI_MAX = 40;

export function ProgressScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { profile } = useUser();
  const { t } = useLanguage();
  const { units, convertWeight } = useUnits();

  const weightInfo = useMemo(() => {
    if (!profile?.weight) {
      return null;
    }
    const weightValue = units.weight === 'lb'
      ? convertWeight(profile.weight, 'kg', 'lb')
      : profile.weight;

    return {
      value: Number(weightValue.toFixed(1)),
      unit: units.weight === 'kg' ? 'kg' : 'lbs',
    };
  }, [profile?.weight, units, convertWeight]);

  const bmiData = useMemo(() => {
    if (!profile?.weight || !profile?.height || profile.height <= 0) {
      return null;
    }

    const weightKg = Number(profile.weight);
    const heightMeters = Number(profile.height) / 100;
    if (!weightKg || !heightMeters) {
      return null;
    }

    const bmiRaw = weightKg / (heightMeters * heightMeters);
    const bmi = Number(bmiRaw.toFixed(1));

    let statusKey: 'underweight' | 'normal' | 'overweight' | 'obese' = 'normal';

    if (bmi < 18.5) statusKey = 'underweight';
    else if (bmi >= 18.5 && bmi < 25) statusKey = 'normal';
    else if (bmi >= 25 && bmi < 30) statusKey = 'overweight';
    else statusKey = 'obese';

    const statusConfig: Record<typeof statusKey, { color: string; background: string }> = {
      underweight: { color: '#F97316', background: 'rgba(249, 115, 22, 0.15)' },
      normal: { color: '#22C55E', background: 'rgba(34, 197, 94, 0.15)' },
      overweight: { color: '#EAB308', background: 'rgba(234, 179, 8, 0.15)' },
      obese: { color: '#EF4444', background: 'rgba(239, 68, 68, 0.15)' },
    };

    const segments = [
      { key: 'underweight', min: 10, max: 18.5, color: '#F97316' },
      { key: 'normal', min: 18.5, max: 25, color: '#22C55E' },
      { key: 'overweight', min: 25, max: 30, color: '#EAB308' },
      { key: 'obese', min: 30, max: 40, color: '#EF4444' },
    ] as const;

    const indicatorPercent = Math.min(
      Math.max(((bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100, 0),
      100,
    );

    return {
      bmi,
      statusKey,
      label: t(`progress.bmiStatus.${statusKey}`),
      description: t(`progress.bmiStatusDescription.${statusKey}`),
      ...statusConfig[statusKey],
      segments,
      indicatorPercent,
    };
  }, [profile?.weight, profile?.height, t]);

  const bmiAvailable = !!bmiData;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.message, { color: theme.colors.text }]}>
          {t('progress.underDevelopment') || 'This feature is under development'}
        </Text>

        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {t('progress.weightCardTitle')}
              </Text>
              <Text style={[styles.weightSubtitle, { color: theme.colors.textSecondary || '#6B7280' }]}>
                {t('progress.weightCardSubtitle')}
              </Text>
            </View>
          </View>

          <Text style={[styles.weightValue, { color: theme.colors.text }]}>
            {weightInfo ? `${weightInfo.value} ${weightInfo.unit}` : t('progress.weightMissing')}
          </Text>

          <TouchableOpacity
            style={[
              styles.weightButton,
              { backgroundColor: theme.colors.primary || '#3BB273' },
            ]}
            onPress={() => navigation.navigate('UpdateWeight')}
            activeOpacity={0.8}
          >
            <Text style={styles.weightButtonText}>
              {t('progress.weightCardButton')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {t('progress.bmiTitle')}
            </Text>
            {bmiAvailable && bmiData && (
              <View style={[
                styles.statusPill,
                { backgroundColor: bmiData.background },
              ]}>
                <Text style={[styles.statusText, { color: bmiData.color }]}>
                  {bmiData.label}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.bmiValue, { color: theme.colors.text }]}>
            {bmiAvailable && bmiData ? bmiData.bmi : '--'}
          </Text>
          <Text style={[styles.bmiLabel, { color: theme.colors.textSecondary || '#6B7280' }]}>
            BMI
          </Text>

          {/* BMI Progress Bar */}
          <View style={styles.progressWrapper}>
            <View style={styles.progressBar}>
              {bmiData?.segments.map(segment => (
                <View
                  key={segment.key}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: segment.color,
                      flex: (segment.max - segment.min) / (BMI_MAX - BMI_MIN),
                    },
                  ]}
                />
              ))}
            </View>
            {bmiAvailable && (
              <View
                style={[
                  styles.indicatorContainer,
                  { left: `${bmiData.indicatorPercent}%` },
                ]}
              >
                <View
                  style={[
                    styles.indicatorPointer,
                    {
                      backgroundColor: theme.mode === 'dark' ? '#F9FAFB' : '#111827',
                      borderColor: theme.colors.card || '#FFFFFF',
                    },
                  ]}
                />
              </View>
            )}
            <View style={styles.scaleLabels}>
              <Text style={[styles.scaleText, { color: theme.colors.textSecondary || '#6B7280' }]}>
                {BMI_MIN}
              </Text>
              <Text style={[styles.scaleText, { color: theme.colors.textSecondary || '#6B7280' }]}>
                {BMI_MAX}
              </Text>
            </View>
          </View>

          <Text style={[styles.description, { color: theme.colors.textSecondary || '#6B7280' }]}>
            {t('progress.bmiDescription')}
          </Text>

          <Text style={[
            styles.statusDescription,
            { color: bmiAvailable && bmiData ? bmiData.color : (theme.colors.textSecondary || '#6B7280') },
          ]}>
            {bmiAvailable && bmiData
              ? bmiData.description
              : t('progress.bmiMissingData')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 24,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bmiValue: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
  },
  bmiLabel: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  weightSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  weightValue: {
    fontSize: 44,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 16,
  },
  weightButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  weightButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  progressWrapper: {
    marginBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    height: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.1)',
  },
  progressSegment: {
    height: '100%',
  },
  indicatorContainer: {
    position: 'absolute',
    top: -8,
    transform: [{ translateX: -8 }],
  },
  indicatorPointer: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    shadowColor: '#111827',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  scaleText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
