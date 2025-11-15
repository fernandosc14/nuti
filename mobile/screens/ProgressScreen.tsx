import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export function ProgressScreen() {
  const { user, profile } = useUser();
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 }}>
              {t('progress.title')}
            </Text>
            <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginBottom: 24 }}>
              {t('progress.subtitle')}
            </Text>

            <View style={{ 
              backgroundColor: theme.colors.card, 
              borderRadius: 16, 
              padding: 20, 
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.text, marginBottom: 12 }}>
                {t('progress.caloriesToday')}
              </Text>
              {profile?.dailyCalorieGoal ? (
                <>
                  <Text style={{ fontSize: 36, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 8 }}>
                    {profile.dailyCalorieGoal} kcal
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
                    {t('progress.dailyGoal')}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 16, color: theme.colors.textSecondary }}>
                  {t('progress.configureGoal')}
                </Text>
              )}
            </View>

            <View style={{ 
              backgroundColor: theme.colors.card, 
              borderRadius: 16, 
              padding: 20, 
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.text, marginBottom: 12 }}>
                {t('progress.statistics')}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.primary }}>
                    {profile?.weight || 'N/A'}
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 }}>{t('progress.currentWeight')}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.primary }}>
                    {profile?.height || 'N/A'}
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 }}>{t('progress.height')}</Text>
                </View>
              </View>
            </View>
      </ScrollView>
    </View>
  );
}

