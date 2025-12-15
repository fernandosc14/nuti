/**
 * PreferencesScreen
 * 
 * Tela de preferências do utilizador
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useUnits } from '../context/UnitsContext';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import {
  applyReminderPreference,
  loadReminderPreference,
  requestNotificationPermission,
} from '../services/notifications';

export function PreferencesScreen({ navigation }: any) {
  const { theme, toggleTheme, themeMode, setThemeMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { units, setWeightUnit, setHeightUnit } = useUnits();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showWeightUnitModal, setShowWeightUnitModal] = useState(false);
  const [showHeightUnitModal, setShowHeightUnitModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mealReminders, setMealReminders] = useState<boolean>(false);
  const [waterReminders, setWaterReminders] = useState<boolean>(false);
  const [isProcessingMeal, setIsProcessingMeal] = useState<boolean>(false);
  const [isProcessingWater, setIsProcessingWater] = useState<boolean>(false);

  useEffect(() => {
    const loadPreferences = async () => {
      const mealPref = await loadReminderPreference('meal');
      const waterPref = await loadReminderPreference('water');
      if (mealPref != null) setMealReminders(mealPref);
      if (waterPref != null) setWaterReminders(waterPref);
    };

    loadPreferences();
  }, []);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  ];

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    setShowLanguageModal(false);
  };

  // Toggle básico sem animação
  const PlainToggle = ({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => {
    return (
      <Pressable
        onPress={() => !disabled && onChange(!value)}
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.colors.border || '#E5E7EB',
          backgroundColor: value ? (theme.colors.primary || '#3BB273') : (theme.colors.card || '#FFFFFF'),
          alignItems: value ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
          paddingHorizontal: 4,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: value ? '#FFFFFF' : (theme.colors.textSecondary || '#9CA3AF'),
          }}
        />
      </Pressable>
    );
  };

  const handleReminderToggle = async (type: 'meal' | 'water', value: boolean) => {
    const previousValue = type === 'meal' ? mealReminders : waterReminders;
    try {
      // Guardar processamento para evitar duplo toque
      if (type === 'meal') setIsProcessingMeal(true);
      if (type === 'water') setIsProcessingWater(true);

      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            t('notifications.permission_title') || 'Permissão necessária',
            t('notifications.permission_body') || 'Ativa as notificações nas definições para receber lembretes.',
          );
          // Terminar processamento
          if (type === 'meal') setIsProcessingMeal(false);
          if (type === 'water') setIsProcessingWater(false);
          return;
        }
      }

      // Otimista para evitar flicker no Switch enquanto agenda
      if (type === 'meal') setMealReminders(value);
      if (type === 'water') setWaterReminders(value);

      await applyReminderPreference(type, value);
    } catch (error) {
      console.error('Reminder toggle error', error);
      // Reverter em caso de erro
      if (type === 'meal') setMealReminders(previousValue);
      if (type === 'water') setWaterReminders(previousValue);
      Alert.alert(
        t('notifications.error_title') || 'Erro ao atualizar',
        t('notifications.error_body') || 'Não foi possível atualizar os lembretes. Tenta novamente.',
      );
    }
    finally {
      if (type === 'meal') setIsProcessingMeal(false);
      if (type === 'water') setIsProcessingWater(false);
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
          {t('profile.preferences') || 'Preferências'}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Idioma */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 12,
            }}>
              {t('profile.language') || 'Idioma'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowLanguageModal(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="language" size={24} color={theme.colors.primary || '#3BB273'} style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {languages.find(l => l.code === language)?.flag} {languages.find(l => l.code === language)?.name || 'English'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        </MotiView>

        {/* Tema */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 50 }}
        >
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 12,
            }}>
              {t('profile.theme') || 'Tema'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowThemeModal(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="color-palette-outline" size={20} color={theme.colors.text} style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.colors.text,
                }}>
                  {themeMode === 'dark' 
                    ? (t('profile.darkMode') || 'Modo escuro')
                    : themeMode === 'light'
                    ? (t('profile.lightMode') || 'Modo claro')
                    : (t('profile.systemMode') || 'Sistema')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        </MotiView>

        {/* Notificações */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 100 }}
        >
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 12,
            }}>
              {t('preferences.notifications') || 'Notificações'}
            </Text>
            
            {/* Notificações de Refeições */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border || '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.text} style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.colors.text,
                }}>
                  {t('preferences.mealReminders') || 'Lembretes de refeições'}
                </Text>
              </View>
              <PlainToggle
                value={mealReminders}
                onChange={(value) => !isProcessingMeal && handleReminderToggle('meal', value)}
                disabled={isProcessingMeal}
              />
            </View>

            {/* Notificações de Água */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="water-outline" size={20} color={theme.colors.text} style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.colors.text,
                }}>
                  {t('preferences.waterReminders') || 'Lembretes de água'}
                </Text>
              </View>
              <PlainToggle
                value={waterReminders}
                onChange={(value) => !isProcessingWater && handleReminderToggle('water', value)}
                disabled={isProcessingWater}
              />
            </View>
          </View>
        </MotiView>

        {/* Unidades */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300, delay: 150 }}
        >
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: theme.colors.textSecondary || '#9CA3AF',
              marginBottom: 12,
            }}>
              {t('preferences.units') || 'Unidades'}
            </Text>
            
            <TouchableOpacity
              onPress={() => setShowWeightUnitModal(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="scale-outline" size={20} color={theme.colors.text} style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.colors.text,
                }}>
                  {t('preferences.weightUnit') || 'Unidade de peso'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: theme.colors.primary || '#3BB273',
                  marginRight: 8,
                }}>
                  {units.weight}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </View>
            </TouchableOpacity>
            
            <View style={{
              height: 1,
              backgroundColor: theme.colors.border || '#E5E7EB',
              marginVertical: 8,
            }} />
            
            <TouchableOpacity
              onPress={() => setShowHeightUnitModal(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="resize-outline" size={20} color={theme.colors.text} style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.colors.text,
                }}>
                  {t('preferences.heightUnit') || 'Unidade de altura'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: theme.colors.primary || '#3BB273',
                  marginRight: 8,
                }}>
                  {units.height === 'cm' ? 'cm' : "ft'in"}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </View>
            </TouchableOpacity>
          </View>
        </MotiView>
      </ScrollView>

      {/* Modal de Idioma */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowLanguageModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 40,
              maxHeight: '80%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 20,
            }} />
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              paddingHorizontal: 24,
              marginBottom: 20,
            }}>
              {t('profile.selectLanguage') || 'Selecionar Idioma'}
            </Text>
            <ScrollView>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => handleLanguageChange(lang.code)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    backgroundColor: language === lang.code
                      ? (theme.colors.primary || '#3BB273') + '20'
                      : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{lang.flag}</Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: language === lang.code ? '700' : '500',
                    color: theme.colors.text,
                    flex: 1,
                  }}>
                    {lang.name}
                  </Text>
                  {language === lang.code && (
                    <Ionicons name="checkmark" size={24} color={theme.colors.primary || '#3BB273'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Unidade de Peso */}
      <Modal
        visible={showWeightUnitModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWeightUnitModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowWeightUnitModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 60,
              maxHeight: '50%',
              marginBottom: 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 20,
            }} />
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              paddingHorizontal: 24,
              marginBottom: 20,
            }}>
              {t('preferences.selectWeightUnit') || 'Selecionar Unidade de Peso'}
            </Text>
            <ScrollView>
              {(['kg', 'lb'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  onPress={async () => {
                    await setWeightUnit(unit);
                    setShowWeightUnitModal(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    backgroundColor: units.weight === unit
                      ? (theme.colors.primary || '#3BB273') + '20'
                      : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: units.weight === unit ? '700' : '500',
                    color: theme.colors.text,
                    flex: 1,
                  }}>
                    {unit === 'kg' ? 'Quilogramas (kg)' : 'Libras (lb)'}
                  </Text>
                  {units.weight === unit && (
                    <Ionicons name="checkmark" size={24} color={theme.colors.primary || '#3BB273'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Unidade de Altura */}
      <Modal
        visible={showHeightUnitModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHeightUnitModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowHeightUnitModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 60,
              maxHeight: '50%',
              marginBottom: 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 20,
            }} />
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              paddingHorizontal: 24,
              marginBottom: 20,
            }}>
              {t('preferences.selectHeightUnit') || 'Selecionar Unidade de Altura'}
            </Text>
            <ScrollView>
              {(['cm', 'in'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  onPress={async () => {
                    await setHeightUnit(unit);
                    setShowHeightUnitModal(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    backgroundColor: units.height === unit
                      ? (theme.colors.primary || '#3BB273') + '20'
                      : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: units.height === unit ? '700' : '500',
                    color: theme.colors.text,
                    flex: 1,
                  }}>
                    {unit === 'cm' ? (t('preferences.cm') || 'Centimeters (cm)') : (t('preferences.inches') || "Feet and Inches (ft'in)")}
                  </Text>
                  {units.height === unit && (
                    <Ionicons name="checkmark" size={24} color={theme.colors.primary || '#3BB273'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Tema */}
      <Modal
        visible={showThemeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowThemeModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 60,
              maxHeight: '50%',
              marginBottom: 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 20,
            }} />
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              paddingHorizontal: 24,
              marginBottom: 20,
            }}>
              {t('profile.theme') || 'Tema'}
            </Text>
            <ScrollView>
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={async () => {
                    await setThemeMode(mode);
                    setShowThemeModal(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    backgroundColor: themeMode === mode
                      ? (theme.colors.primary || '#3BB273') + '20'
                      : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: themeMode === mode ? '700' : '500',
                    color: theme.colors.text,
                    flex: 1,
                  }}>
                    {mode === 'dark'
                      ? (t('profile.darkMode') || 'Modo escuro')
                      : mode === 'light'
                      ? (t('profile.lightMode') || 'Modo claro')
                      : (t('profile.systemMode') || 'Sistema')}
                  </Text>
                  {themeMode === mode && (
                    <Ionicons name="checkmark" size={24} color={theme.colors.primary || '#3BB273'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

