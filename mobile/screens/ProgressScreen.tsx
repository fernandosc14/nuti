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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

  // Preparar dados do gráfico incluindo peso inicial se não houver histórico
  const chartData = useMemo(() => {
    if (!profile?.weight) return [];
    
    const history = profile.weightHistory || [];
    
    // Se não há histórico, criar entrada inicial com o peso atual e data de criação do perfil
    if (history.length === 0 && profile.createdAt) {
      return [{
        weight: profile.weight,
        date: profile.createdAt,
      }];
    }
    
    return history;
  }, [profile?.weight, profile?.weightHistory, profile?.createdAt]);

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

  // Verificar se o usuário tem plano premium
  const isPremium = profile?.plan === 'premium';

  // Renderizar skeleton de exemplo (sem dados reais, apenas formas)
  const renderSkeletonContent = () => {
    const skeletonColor = theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
    
    return (
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 32, paddingTop: 24 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Card de peso skeleton */}
        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}>
          {/* Linhas de título skeleton */}
          <View style={{ marginBottom: 20 }}>
            <View style={{
              width: '60%',
              height: 16,
              backgroundColor: skeletonColor,
              borderRadius: 8,
              marginBottom: 8,
            }} />
            <View style={{
              width: '40%',
              height: 12,
              backgroundColor: skeletonColor,
              borderRadius: 6,
            }} />
          </View>

          {/* Valor grande skeleton */}
          <View style={{
            width: '50%',
            height: 48,
            backgroundColor: skeletonColor,
            borderRadius: 8,
            marginBottom: 20,
            alignSelf: 'center',
          }} />

          {/* Botão skeleton */}
          <View style={{
            width: '100%',
            height: 48,
            backgroundColor: skeletonColor,
            borderRadius: 12,
          }} />
        </View>

        {/* Gráfico skeleton */}
        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}>
          {/* Linhas de título skeleton */}
          <View style={{ marginBottom: 20 }}>
            <View style={{
              width: '50%',
              height: 16,
              backgroundColor: skeletonColor,
              borderRadius: 8,
              marginBottom: 8,
            }} />
          </View>

          {/* Gráfico de barras skeleton */}
          <View style={{ height: 200, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', height: 150 }}>
              {[0.8, 0.4, 0.6, 0.9, 0.7, 0.75, 0.85].map((height, index) => (
                <View
                  key={index}
                  style={{
                    width: '12%',
                    height: `${height * 100}%`,
                    backgroundColor: skeletonColor,
                    borderRadius: 4,
                    minHeight: 20,
                  }}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Card BMI skeleton */}
        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}>
          {/* Header skeleton */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: '50%',
              height: 16,
              backgroundColor: skeletonColor,
              borderRadius: 8,
            }} />
            <View style={{
              width: 80,
              height: 24,
              backgroundColor: skeletonColor,
              borderRadius: 12,
            }} />
          </View>

          {/* Valor BMI skeleton */}
          <View style={{
            width: '30%',
            height: 48,
            backgroundColor: skeletonColor,
            borderRadius: 8,
            marginBottom: 12,
            alignSelf: 'center',
          }} />
          <View style={{
            width: '20%',
            height: 14,
            backgroundColor: skeletonColor,
            borderRadius: 6,
            alignSelf: 'center',
            marginBottom: 20,
          }} />

          {/* Barra de progresso skeleton */}
          <View style={{
            width: '100%',
            height: 14,
            backgroundColor: skeletonColor,
            borderRadius: 7,
            marginBottom: 8,
          }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <View style={{ width: 30, height: 12, backgroundColor: skeletonColor, borderRadius: 6 }} />
            <View style={{ width: 30, height: 12, backgroundColor: skeletonColor, borderRadius: 6 }} />
          </View>

          {/* Descrição skeleton */}
          <View style={{ marginBottom: 8 }}>
            <View style={{ width: '100%', height: 12, backgroundColor: skeletonColor, borderRadius: 6, marginBottom: 6 }} />
            <View style={{ width: '80%', height: 12, backgroundColor: skeletonColor, borderRadius: 6 }} />
          </View>
          <View style={{ width: '60%', height: 12, backgroundColor: skeletonColor, borderRadius: 6 }} />
        </View>
      </ScrollView>
    );
  };

  // Renderizar conteúdo real da tela
  const renderProgressContent = () => (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={isPremium}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        position: 'relative',
        zIndex: 100,
        minHeight: 56,
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
            zIndex: 1001,
            position: 'absolute',
            left: 0,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
          <Text style={{
            fontSize: 28,
            fontWeight: '700',
            color: theme.colors.text,
            textAlign: 'center',
            lineHeight: 40,
          }}>
            {t('progress.title')}
          </Text>
        </View>
      </View>

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

      {/* Weight Progress Chart */}
      {profile?.weight && chartData.length > 0 && (
        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.card || '#FFFFFF',
            borderColor: theme.colors.border || '#E5E7EB',
          },
        ]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 16 }]}>
            {t('progress.weightProgress')}
          </Text>
          <WeightChart 
            data={chartData} 
            units={units}
            convertWeight={convertWeight}
            theme={theme}
            t={t}
          />
        </View>
      )}

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
  );

  // Se não for premium, mostrar tela de bloqueio com skeleton atrás
  if (!isPremium) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        {!theme.isDark && (
          <LinearGradient
            colors={['#F0FDF4', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        {theme.isDark && (
          <LinearGradient
            colors={['#1A2E1F', theme.colors.background || '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
          />
        )}
        {/* Skeleton da tela por trás */}
        <View style={styles.skeletonContainer}>
          {renderSkeletonContent()}
        </View>

        {/* Overlay de bloqueio */}
        <View style={[StyleSheet.absoluteFill, styles.lockOverlay]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.lockBackButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={theme.colors.primary || '#3BB273'} 
            />
          </TouchableOpacity>

          <View style={styles.lockContent}>
            <View style={[
              styles.lockIconContainer,
              { backgroundColor: (theme.colors.primary || '#3BB273') + '20' },
            ]}>
              <Ionicons 
                name="lock-closed" 
                size={64} 
                color={theme.colors.primary || '#3BB273'} 
              />
            </View>

            <Text style={[styles.lockTitle, { color: theme.isDark ? theme.colors.text : '#111827' }]}>
              {t('progress.premiumRequired') || 'Premium Required'}
            </Text>
            <Text style={[styles.lockDescription, { color: theme.isDark ? (theme.colors.textSecondary || '#6B7280') : '#6B7280' }]}>
              {t('progress.premiumRequiredDescription') || 'This feature is available only for Premium users. Upgrade to unlock progress tracking and more features.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.lockUpgradeButton,
                { backgroundColor: theme.colors.primary || '#3BB273' },
              ]}
              onPress={() => navigation.navigate('Premium')}
              activeOpacity={0.8}
            >
              <Text style={styles.lockUpgradeButtonText}>
                {t('premium.upgradeButton') || 'Upgrade to Premium'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      {!theme.isDark && (
        <LinearGradient
          colors={['#F0FDF4', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {theme.isDark && (
        <LinearGradient
          colors={['#1A2E1F', theme.colors.background || '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
        />
      )}
      {renderProgressContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 0,
    gap: 24,
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
  skeletonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  lockOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  lockBackButton: {
    paddingTop: 16,
    paddingBottom: 8,
    marginLeft: -8,
    zIndex: 10,
  },
  lockContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  lockIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  lockTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  lockDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  lockUpgradeButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#3BB273',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lockUpgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

// Componente de gráfico de peso
const WeightChart = ({ data, units, convertWeight, theme, t }: any) => {
  const { width } = Dimensions.get('window');
  const chartWidth = width - 88; // padding + borders
  const chartHeight = 200;
  const padding = 40;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  // Processar dados
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Ordenar por data
    const sorted = [...data]
      .map(entry => ({
        weight: entry.weight,
        date: entry.date instanceof Date ? entry.date : new Date(entry.date),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Converter unidades se necessário
    return sorted.map(entry => ({
      ...entry,
      displayWeight: units.weight === 'lb' 
        ? convertWeight(entry.weight, 'kg', 'lb')
        : entry.weight,
    }));
  }, [data, units, convertWeight]);

  if (processedData.length === 0) {
    return (
      <View style={{ height: chartHeight, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textSecondary || '#6B7280' }}>
          {t('progress.noWeightData') || 'No weight data available'}
        </Text>
      </View>
    );
  }

  // Calcular min/max para escala
  const weights = processedData.map(d => d.displayWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = maxWeight - minWeight || 1;
  const paddingY = weightRange * 0.2; // 20% padding

  // Gerar pontos do gráfico
  const points = processedData.map((entry, index) => {
    const x = padding + (index / (processedData.length - 1 || 1)) * innerWidth;
    const normalizedWeight = (entry.displayWeight - minWeight + paddingY) / (weightRange + paddingY * 2);
    const y = padding + innerHeight - (normalizedWeight * innerHeight);
    return { x, y, weight: entry.displayWeight, date: entry.date };
  });

  // Gerar path para a linha
  const pathData = points.map((point, index) => {
    return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
  }).join(' ');

  // Formatar datas para labels
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1d';
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    return `${Math.floor(diffDays / 30)}mo`;
  };

  // Labels do eixo Y (peso)
  const yLabels = [0, 1, 2, 3].map(i => {
    const value = minWeight - paddingY + (weightRange + paddingY * 2) * (1 - i / 3);
    return {
      value: value.toFixed(1),
      y: padding + (i / 3) * innerHeight,
    };
  });

  return (
    <View style={{ height: chartHeight }}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <Line
            key={`grid-${i}`}
            x1={padding}
            y1={label.y}
            x2={chartWidth - padding}
            y2={label.y}
            stroke={theme.colors.border || '#E5E7EB'}
            strokeWidth={0.5}
            strokeDasharray="4,4"
            opacity={0.5}
          />
        ))}

        {/* Path da linha */}
        <Path
          d={pathData}
          fill="none"
          stroke={theme.colors.primary || '#3BB273'}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos */}
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={theme.colors.primary || '#3BB273'}
            stroke={theme.colors.card || '#FFFFFF'}
            strokeWidth={2}
          />
        ))}

        {/* Labels do eixo Y */}
        <G>
          {yLabels.map((label, i) => (
            <SvgText
              key={`y-label-${i}`}
              x={padding - 8}
              y={label.y + 4}
              fontSize="11"
              fill={theme.colors.textSecondary || '#6B7280'}
              textAnchor="end"
            >
              {label.value}
            </SvgText>
          ))}
        </G>

        {/* Labels do eixo X (datas) */}
        <G>
          {points.map((point, index) => {
            // Mostrar apenas alguns labels para não sobrecarregar
            const showLabel = index === 0 || 
                            index === points.length - 1 || 
                            index === Math.floor(points.length / 2);
            if (!showLabel) return null;
            
            return (
              <SvgText
                key={`x-label-${index}`}
                x={point.x}
                y={chartHeight - padding + 16}
                fontSize="10"
                fill={theme.colors.textSecondary || '#6B7280'}
                textAnchor="middle"
              >
                {formatDate(point.date)}
              </SvgText>
            );
          })}
        </G>
      </Svg>
    </View>
  );
};
