/**
 * ProgressScreen
 * 
 * Tela de progresso do utilizador com gráficos e estatísticas
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 24px padding each side, 2 cards with gap

type TimePeriod = '90' | '180' | '365' | 'all';

export function ProgressScreen() {
  const { user, profile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('90');
  const [streakDays, setStreakDays] = useState<boolean[]>(new Array(7).fill(false));

  const currentWeight = profile?.weight || 0;
  const goalWeight = profile?.desiredWeight || profile?.weight || 0;
  
  // Calcular progresso baseado no objetivo
  const calculateProgress = () => {
    if (!currentWeight || !goalWeight) return 0;
    
    // Se já atingiu a meta, mostrar 100%
    if (profile?.goal === 'lose' && currentWeight <= goalWeight) return 100;
    if (profile?.goal === 'gain' && currentWeight >= goalWeight) return 100;
    if (profile?.goal === 'maintain') return 0; // Manter sempre mostra 0% por enquanto
    
    // Calcular progresso baseado na diferença
    // Assumir peso inicial como 10% acima/abaixo da meta para ter uma referência
    const startWeight = profile?.goal === 'lose' 
      ? goalWeight * 1.1  // Começar 10% acima da meta
      : goalWeight * 0.9; // Começar 10% abaixo da meta
    
    const totalDistance = Math.abs(startWeight - goalWeight);
    const currentDistance = Math.abs(currentWeight - goalWeight);
    const progress = ((totalDistance - currentDistance) / totalDistance) * 100;
    
    return Math.max(0, Math.min(100, progress));
  };
  
  const progressPercentage = calculateProgress();

  // Calcular próxima pesagem (6 dias a partir de hoje)
  const getNextWeighIn = () => {
    const today = new Date();
    const nextWeighIn = new Date(today);
    nextWeighIn.setDate(today.getDate() + 6);
    return nextWeighIn.getDate() - today.getDate();
  };

  // Dados do gráfico (mock data por enquanto)
  const graphData = [
    { weight: 54.5, date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    { weight: 54.3, date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { weight: 54.0, date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    { weight: 53.8, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { weight: 53.5, date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { weight: 54.0, date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { weight: currentWeight || 54.0, date: new Date() },
  ];

  const minWeight = Math.min(...graphData.map(d => d.weight));
  const maxWeight = Math.max(...graphData.map(d => d.weight));
  const weightRange = maxWeight - minWeight || 1;
  const graphHeight = 150;
  const graphWidth = SCREEN_WIDTH - 48;
  const padding = 40;

  // Calcular posições dos pontos no gráfico
  const getGraphPoints = () => {
    return graphData.map((point, index) => {
      const x = padding + (index * (graphWidth - padding * 2) / (graphData.length - 1));
      const y = graphHeight - padding - ((point.weight - minWeight) / weightRange) * (graphHeight - padding * 2);
      return { x, y, weight: point.weight };
    });
  };

  const graphPoints = getGraphPoints();

  // Dias da semana
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingTop: 20, paddingBottom: 24 }}>
          <Text style={{
            fontSize: 32,
            fontWeight: '800',
            color: theme.colors.text,
          }}>
            {t('progress.title') || 'Progresso'}
          </Text>
        </View>

        {/* Cards principais */}
        <View style={{
          flexDirection: 'row',
          gap: 12,
          marginBottom: 24,
        }}>
          {/* Card Meu Peso */}
          <View style={{
            width: CARD_WIDTH,
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 8,
            }}>
              {t('progress.myWeight') || 'Meu peso'}
            </Text>
            <Text style={{
              fontSize: 28,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 12,
            }}>
              {currentWeight ? `${currentWeight} kg` : '-- kg'}
            </Text>
            
            {/* Barra de progresso */}
            <View style={{
              height: 6,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 3,
              marginBottom: 8,
              overflow: 'hidden',
            }}>
              <View style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progressPercentage))}%`,
                backgroundColor: theme.colors.primary || '#3BB273',
                borderRadius: 3,
              }} />
            </View>
            
            <Text style={{
              fontSize: 12,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 12,
            }}>
              {t('progress.goal') || 'Meta'} {goalWeight ? `${goalWeight} kg` : '-- kg'}
            </Text>
            
            <Text style={{
              fontSize: 12,
              color: theme.colors.textSecondary || '#9CA3AF',
            }}>
              {t('progress.nextWeighIn') || 'Próxima pesagem:'} {getNextWeighIn()}d
            </Text>
          </View>

          {/* Card Sequência de Dias */}
          <View style={{
            width: CARD_WIDTH,
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
            alignItems: 'center',
          }}>
            {/* Ícone de chama */}
            <View style={{
              position: 'relative',
              marginBottom: 12,
            }}>
              <Ionicons
                name="flame"
                size={48}
                color="#FF6B35"
              />
              <View style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: [{ translateX: -10 }, { translateY: -12 }],
              }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                  {profile?.streak || 0}
                </Text>
              </View>
              {/* Sparkles */}
              <Ionicons
                name="star"
                size={12}
                color="#FFD700"
                style={{ position: 'absolute', top: -4, left: -4 }}
              />
              <Ionicons
                name="star"
                size={10}
                color="#FFD700"
                style={{ position: 'absolute', top: 8, right: -6 }}
              />
              <Ionicons
                name="star"
                size={8}
                color="#FFD700"
                style={{ position: 'absolute', bottom: -2, left: 4 }}
              />
            </View>
            
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#FF6B35',
              marginBottom: 16,
            }}>
              {t('progress.dayStreak') || 'Sequência de dias'}
            </Text>
            
            {/* Dias da semana */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              width: '100%',
            }}>
              {weekDays.map((day, index) => (
                <View key={index} style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 10,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    marginBottom: 4,
                  }}>
                    {day}
                  </Text>
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: streakDays[index]
                      ? '#FF6B35'
                      : theme.colors.border || '#E5E7EB',
                  }} />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Seleção de período */}
        <View style={{
          flexDirection: 'row',
          gap: 8,
          marginBottom: 24,
        }}>
          {([
            { key: '90', label: t('progress.90Days') || '90 Dias' },
            { key: '180', label: t('progress.6Months') || '6 Meses' },
            { key: '365', label: t('progress.1Year') || '1 Ano' },
            { key: 'all', label: t('progress.allTime') || 'Todos os tem...' },
          ] as { key: TimePeriod; label: string }[]).map((period) => (
            <TouchableOpacity
              key={period.key}
              onPress={() => setSelectedPeriod(period.key)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: selectedPeriod === period.key
                  ? theme.colors.primary || '#3BB273'
                  : theme.colors.card,
                borderWidth: 1,
                borderColor: selectedPeriod === period.key
                  ? theme.colors.primary || '#3BB273'
                  : theme.colors.border || '#E5E7EB',
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: selectedPeriod === period.key
                  ? '#FFFFFF'
                  : theme.colors.text,
              }}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Progresso do Objetivo */}
        <View style={{
          backgroundColor: theme.colors.card,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: theme.colors.border || '#E5E7EB',
          marginBottom: 24,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: theme.colors.text,
            }}>
              {t('progress.goalProgress') || 'Progresso do Objetivo'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#9CA3AF',
              }}>
                {Math.round(progressPercentage)}% {t('progress.ofGoal') || 'da meta'}
              </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Ionicons
                  name="pencil-outline"
                  size={18}
                  color={theme.colors.textSecondary || '#9CA3AF'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Gráfico */}
          <View style={{ height: graphHeight, marginBottom: 20 }}>
            <Svg width={graphWidth} height={graphHeight}>
              {/* Linhas horizontais tracejadas */}
              {[54.5, 54.3, 54.0, 53.8, 53.5].map((weight, index) => {
                const y = graphHeight - padding - ((weight - minWeight) / weightRange) * (graphHeight - padding * 2);
                return (
                  <Line
                    key={`dash-${index}`}
                    x1={padding}
                    y1={y}
                    x2={graphWidth - padding}
                    y2={y}
                    stroke={theme.colors.border || '#E5E7EB'}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                );
              })}
              
              {/* Linha sólida no peso atual */}
              {currentWeight > 0 && (
                <Line
                  x1={padding}
                  y1={graphHeight - padding - ((currentWeight - minWeight) / weightRange) * (graphHeight - padding * 2)}
                  x2={graphWidth - padding}
                  y2={graphHeight - padding - ((currentWeight - minWeight) / weightRange) * (graphHeight - padding * 2)}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              )}
              
              {/* Valores no eixo Y */}
              {[54.5, 54.3, 54.0, 53.8, 53.5].map((weight, index) => {
                const y = graphHeight - padding - ((weight - minWeight) / weightRange) * (graphHeight - padding * 2);
                return (
                  <SvgText
                    key={`label-${index}`}
                    x={padding - 8}
                    y={y + 4}
                    fontSize={10}
                    fill={theme.colors.textSecondary || '#9CA3AF'}
                    textAnchor="end"
                  >
                    {weight.toFixed(1)}
                  </SvgText>
                );
              })}
              
              {/* Linha do gráfico */}
              {graphPoints.map((point, index) => {
                if (index === 0) return null;
                const prevPoint = graphPoints[index - 1];
                return (
                  <Line
                    key={`line-${index}`}
                    x1={prevPoint.x}
                    y1={prevPoint.y}
                    x2={point.x}
                    y2={point.y}
                    stroke={theme.colors.primary || '#3BB273'}
                    strokeWidth={2}
                  />
                );
              })}
              
              {/* Pontos no gráfico */}
              {graphPoints.map((point, index) => (
                <Circle
                  key={`point-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={theme.colors.primary || '#3BB273'}
                />
              ))}
            </Svg>
          </View>

          {/* Mensagem motivacional */}
          <Text style={{
            fontSize: 14,
            color: theme.colors.primary || '#3BB273',
            textAlign: 'center',
            fontWeight: '600',
          }}>
            {t('progress.motivationalMessage') || 'Começar é a parte mais difícil. Você está pronto para isso!'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
