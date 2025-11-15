/**
 * ProfileScreen
 * 
 * Tela de perfil do utilizador com edição de dados e badges
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { BadgeItem } from '../components/BadgeItem';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import Slider from '@react-native-community/slider';

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: Date;
}

export function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut, updateProfile } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImperial, setIsImperial] = useState(false);
  // Estados temporários para edição livre
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [weightIsEmpty, setWeightIsEmpty] = useState(false);
  const [heightIsEmpty, setHeightIsEmpty] = useState(false);
  const isEditingRef = useRef(false);

  React.useEffect(() => {
    // Só atualizar valores quando não estiver em modo de edição
    if (profile && !isEditingRef.current) {
      setName(profile.name || '');
      setWeight(profile.weight ? profile.weight.toString() : '');
      setHeight(profile.height ? profile.height.toString() : '');
      setGoal(profile.goal || 'maintain');
      loadBadges();
    }
  }, [profile]);

  // Quando entrar em modo de edição, carregar valores
  React.useEffect(() => {
    if (editing && profile) {
      isEditingRef.current = true;
      setName(profile.name || '');
      setWeight(profile.weight ? profile.weight.toString() : '');
      setHeight(profile.height ? profile.height.toString() : '');
      setGoal(profile.goal || 'maintain');
      setWeightText('');
      setHeightText('');
      setWeightIsEmpty(false);
      setHeightIsEmpty(false);
    } else {
      isEditingRef.current = false;
    }
  }, [editing]);

  const loadBadges = async () => {
    if (!user || !profile?.badges) return;

    try {
      const badgesRef = collection(db, 'badges');
      const badgesData: Badge[] = [];

      for (const badgeId of profile.badges) {
        const q = query(badgesRef, where('__name__', '==', badgeId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const badgeData = snapshot.docs[0].data();
          badgesData.push({
            id: badgeId,
            name: badgeData.name,
            icon: badgeData.icon,
            description: badgeData.description,
          });
        }
      }

      setBadges(badgesData);
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não estás autenticado',
      });
      return;
    }

    setLoading(true);
    try {
      // Processar texto temporário se houver
      let finalWeight = weight;
      let finalHeight = height;
      
      if (weightText !== '') {
        const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
          if (isImperial) {
            const kg = num / 2.20462;
            if (kg >= 30 && kg <= 200) {
              finalWeight = (Math.round(kg * 2) / 2).toString();
            }
          } else {
            if (num >= 30 && num <= 200) {
              finalWeight = (Math.round(num * 2) / 2).toString();
            }
          }
        }
      }
      
      if (heightText !== '') {
        const num = parseInt(heightText.replace(/[^0-9]/g, ''));
        if (!isNaN(num) && num >= 120 && num <= 220) {
          finalHeight = num.toString();
        }
      }

      const updates: any = {
        name: name.trim() || profile?.name || '',
        goal: goal,
      };

      // Só atualizar peso e altura se foram fornecidos valores válidos
      if (finalWeight && !isNaN(parseFloat(finalWeight))) {
        updates.weight = parseFloat(finalWeight);
      }
      if (finalHeight && !isNaN(parseFloat(finalHeight))) {
        updates.height = parseFloat(finalHeight);
      }

      await updateProfile(updates);

      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess'),
        text2: 'As tuas informações foram salvas',
      });

      setEditing(false);
      setWeightText('');
      setHeightText('');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || t('profile.updateError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setShowLogoutModal(true);
  };

  const confirmSignOut = async () => {
    try {
      setShowLogoutModal(false);
      await signOut();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao fazer logout',
      });
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#3BB273" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            {t('profile.title')}
          </Text>
          {editing ? (
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#3BB273" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#3BB273" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Ionicons name="pencil" size={24} color="#3BB273" />
            </TouchableOpacity>
          )}
        </View>

        <View className="px-6 py-6">
          {/* Informações Pessoais */}
          <View className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('profile.personalInfo')}
              </Text>
              {editing && (
                <TouchableOpacity
                  onPress={() => {
                    setEditing(false);
                    // Resetar valores quando cancelar
                    if (profile) {
                      setName(profile.name || '');
                      setWeight(profile.weight ? profile.weight.toString() : '');
                      setHeight(profile.height ? profile.height.toString() : '');
                      setGoal(profile.goal || 'maintain');
                      setWeightText('');
                      setHeightText('');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700"
                >
                  <Text className="text-gray-700 dark:text-gray-300 font-semibold">
                    {t('profile.cancel')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="mb-6">
              <Text className="text-gray-700 dark:text-gray-300 mb-3 font-semibold text-base">
                {t('profile.name')}
              </Text>
              {editing ? (
                <TextInput
                  className="bg-white dark:bg-gray-900 rounded-xl px-4 py-4 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 text-lg"
                  value={name}
                  onChangeText={setName}
                  placeholder="O teu nome"
                  placeholderTextColor="#9CA3AF"
                />
              ) : (
                <View className="bg-white dark:bg-gray-900 rounded-xl px-4 py-4 border-2 border-gray-200 dark:border-gray-700">
                  <Text className="text-gray-900 dark:text-white text-lg">
                    {profile?.name || 'Não definido'}
                  </Text>
                </View>
              )}
            </View>

            <View className="mb-6">
              <Text className="text-gray-700 dark:text-gray-300 mb-3 font-semibold text-base">
                Email
              </Text>
              <View className="bg-white dark:bg-gray-900 rounded-xl px-4 py-4 border-2 border-gray-200 dark:border-gray-700">
                <Text className="text-gray-900 dark:text-white text-lg">
                  {profile?.email || user?.email}
                </Text>
              </View>
            </View>

            {/* Peso com slider */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-700 dark:text-gray-300 font-semibold text-base">
                  {t('profile.weight')}
                </Text>
                {editing && (
                  <View className="flex-row bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                    <TouchableOpacity
                      onPress={() => setIsImperial(false)}
                      className={`px-3 py-1 rounded ${!isImperial ? 'bg-green-500' : ''}`}
                    >
                      <Text className={`text-xs font-semibold ${!isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        kg
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIsImperial(true)}
                      className={`px-3 py-1 rounded ${isImperial ? 'bg-green-500' : ''}`}
                    >
                      <Text className={`text-xs font-semibold ${isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        lbs
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {editing ? (
                <View>
                  <View className="flex-row items-center justify-center mb-4">
                    <TouchableOpacity
                      onPress={() => {
                        let currentValue = parseFloat(weight) || 70;
                        if (weightText !== '') {
                          const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                          if (!isNaN(num)) {
                            if (isImperial) {
                              const kg = num / 2.20462;
                              if (kg >= 30 && kg <= 200) {
                                currentValue = Math.round(kg * 2) / 2;
                                setWeight(currentValue.toString());
                              }
                            } else {
                              if (num >= 30 && num <= 200) {
                                currentValue = Math.round(num * 2) / 2;
                                setWeight(currentValue.toString());
                              }
                            }
                          }
                        }
                        const newValue = Math.max(30, currentValue - 0.5);
                        setWeight(newValue.toString());
                        setWeightText('');
                      }}
                      className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={24} color="#3BB273" />
                    </TouchableOpacity>
                    
                    <TextInput
                      className="text-4xl font-bold text-green-500 text-center min-w-[150px]"
                      value={weightText !== '' ? weightText : (weightIsEmpty ? '' : (isImperial ? `${Math.round(parseFloat(weight || '70') * 2.20462)}` : weight))}
                      onChangeText={(text) => {
                        setWeightText(text);
                        if (text === '') {
                          setWeightIsEmpty(true);
                        } else {
                          setWeightIsEmpty(false);
                        }
                      }}
                      onBlur={() => {
                        if (weightText === '') {
                          setWeightIsEmpty(true);
                          return;
                        }
                        const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                        if (!isNaN(num)) {
                          if (isImperial) {
                            const kg = num / 2.20462;
                            if (kg >= 30 && kg <= 200) {
                              setWeight((Math.round(kg * 2) / 2).toString());
                              setWeightIsEmpty(false);
                              setWeightText('');
                            }
                          } else {
                            if (num >= 30 && num <= 200) {
                              setWeight((Math.round(num * 2) / 2).toString());
                              setWeightIsEmpty(false);
                              setWeightText('');
                            }
                          }
                        }
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={false}
                    />
                    
                    <TouchableOpacity
                      onPress={() => {
                        let currentValue = parseFloat(weight) || 70;
                        if (weightText !== '') {
                          const num = parseFloat(weightText.replace(/[^0-9.]/g, ''));
                          if (!isNaN(num)) {
                            if (isImperial) {
                              const kg = num / 2.20462;
                              if (kg >= 30 && kg <= 200) {
                                currentValue = Math.round(kg * 2) / 2;
                                setWeight(currentValue.toString());
                              }
                            } else {
                              if (num >= 30 && num <= 200) {
                                currentValue = Math.round(num * 2) / 2;
                                setWeight(currentValue.toString());
                              }
                            }
                          }
                        }
                        const newValue = Math.min(200, currentValue + 0.5);
                        setWeight(newValue.toString());
                        setWeightText('');
                      }}
                      className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={24} color="#3BB273" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-center text-gray-500 dark:text-gray-400 mb-4">
                    {isImperial ? 'lbs' : 'kg'}
                  </Text>
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={30}
                    maximumValue={200}
                    step={0.5}
                    value={parseFloat(weight) || 70}
                    onValueChange={(value) => {
                      setWeight((Math.round(value * 2) / 2).toString());
                      setWeightText('');
                      setWeightIsEmpty(false);
                    }}
                    minimumTrackTintColor="#3BB273"
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#3BB273"
                  />
                </View>
              ) : (
                <View className="bg-white dark:bg-gray-900 rounded-xl px-4 py-4 border-2 border-gray-200 dark:border-gray-700">
                  <Text className="text-gray-900 dark:text-white text-lg">
                    {profile?.weight ? `${profile.weight} kg` : 'Não definido'}
                  </Text>
                </View>
              )}
            </View>

            {/* Altura com slider */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-700 dark:text-gray-300 font-semibold text-base">
                  {t('profile.height')}
                </Text>
                {editing && (
                  <View className="flex-row bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                    <TouchableOpacity
                      onPress={() => setIsImperial(false)}
                      className={`px-3 py-1 rounded ${!isImperial ? 'bg-green-500' : ''}`}
                    >
                      <Text className={`text-xs font-semibold ${!isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        cm
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setIsImperial(true)}
                      className={`px-3 py-1 rounded ${isImperial ? 'bg-green-500' : ''}`}
                    >
                      <Text className={`text-xs font-semibold ${isImperial ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        ft/in
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {editing ? (
                <View>
                  <View className="flex-row items-center justify-center mb-4">
                    <TouchableOpacity
                      onPress={() => {
                        let currentValue = parseFloat(height) || 175;
                        if (heightText !== '') {
                          const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                          if (!isNaN(num) && num >= 120 && num <= 220) {
                            currentValue = num;
                            setHeight(currentValue.toString());
                          }
                        }
                        const newValue = Math.max(120, currentValue - 1);
                        setHeight(newValue.toString());
                        setHeightText('');
                      }}
                      className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center mr-4"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={24} color="#3BB273" />
                    </TouchableOpacity>
                    
                    <TextInput
                      className="text-4xl font-bold text-green-500 text-center min-w-[150px]"
                      value={heightText !== '' ? heightText : (heightIsEmpty ? '' : (isImperial ? `${Math.floor(parseFloat(height || '175') / 30.48)}'${Math.round((parseFloat(height || '175') % 30.48) / 2.54)}"` : height))}
                      onChangeText={(text) => {
                        setHeightText(text);
                        if (text === '') {
                          setHeightIsEmpty(true);
                        } else {
                          setHeightIsEmpty(false);
                        }
                      }}
                      onBlur={() => {
                        if (heightText === '') {
                          setHeightIsEmpty(true);
                          return;
                        }
                        let newHeight = parseFloat(height) || 175;
                        if (isImperial) {
                          const cleanText = heightText.replace(/[^0-9'"]/g, '');
                          let feet = 0;
                          let inches = 0;
                          const match1 = cleanText.match(/(\d+)'(\d+)/);
                          if (match1) {
                            feet = parseInt(match1[1]) || 0;
                            inches = parseInt(match1[2]) || 0;
                          } else {
                            const num = parseInt(cleanText);
                            if (!isNaN(num)) {
                              if (num >= 40 && num <= 84) {
                                feet = Math.floor(num / 10);
                                inches = num % 10;
                              } else if (num >= 4 && num <= 7) {
                                feet = num;
                                inches = 0;
                              }
                            }
                          }
                          if (feet >= 4 && feet <= 7 && inches >= 0 && inches <= 11) {
                            const totalCm = feet * 30.48 + inches * 2.54;
                            if (totalCm >= 120 && totalCm <= 220) {
                              newHeight = Math.round(totalCm);
                            }
                          }
                        } else {
                          const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                          if (!isNaN(num) && num >= 120 && num <= 220) {
                            newHeight = num;
                          }
                        }
                        setHeight(newHeight.toString());
                        setHeightIsEmpty(false);
                        setHeightText('');
                      }}
                      keyboardType={isImperial ? "default" : "numeric"}
                      selectTextOnFocus={false}
                    />
                    
                    <TouchableOpacity
                      onPress={() => {
                        let currentValue = parseFloat(height) || 175;
                        if (heightText !== '') {
                          const num = parseInt(heightText.replace(/[^0-9]/g, ''));
                          if (!isNaN(num) && num >= 120 && num <= 220) {
                            currentValue = num;
                            setHeight(currentValue.toString());
                          }
                        }
                        const newValue = Math.min(220, currentValue + 1);
                        setHeight(newValue.toString());
                        setHeightText('');
                      }}
                      className="bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12 items-center justify-center ml-4"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={24} color="#3BB273" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-center text-gray-500 dark:text-gray-400 mb-4">
                    {isImperial ? "ft'in\"" : 'cm'}
                  </Text>
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={120}
                    maximumValue={220}
                    step={1}
                    value={parseFloat(height) || 175}
                    onValueChange={(value) => {
                      setHeight(Math.round(value).toString());
                      setHeightText('');
                      setHeightIsEmpty(false);
                    }}
                    minimumTrackTintColor="#3BB273"
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#3BB273"
                  />
                </View>
              ) : (
                <View className="bg-white dark:bg-gray-900 rounded-xl px-4 py-4 border-2 border-gray-200 dark:border-gray-700">
                  <Text className="text-gray-900 dark:text-white text-lg">
                    {profile?.height ? `${profile.height} cm` : 'Não definido'}
                  </Text>
                </View>
              )}
            </View>

            <View className="mb-6">
              <Text className="text-gray-700 dark:text-gray-300 mb-3 font-semibold text-base">
                {t('profile.goal')}
              </Text>
              {editing ? (
                <View className="flex-row gap-3">
                  {(['lose', 'maintain', 'gain'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGoal(g)}
                      className={`flex-1 py-4 px-4 rounded-xl border-2 ${
                        goal === g
                          ? 'bg-green-500 border-green-500'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          goal === g
                            ? 'text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {g === 'lose'
                          ? 'Perder'
                          : g === 'gain'
                          ? 'Ganhar'
                          : 'Manter'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View className="bg-white dark:bg-gray-900 rounded-xl px-4 py-4 border-2 border-gray-200 dark:border-gray-700">
                  <Text className="text-gray-900 dark:text-white text-lg">
                    {profile?.goal === 'lose'
                      ? t('onboarding.goal.lose')
                      : profile?.goal === 'gain'
                      ? t('onboarding.goal.gain')
                      : t('onboarding.goal.maintain')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Streak */}
          <View className="mb-6">
            <View className="bg-orange-100 dark:bg-orange-900 rounded-2xl p-4 flex-row items-center">
              <Ionicons name="flame" size={32} color="#F97316" />
              <View className="ml-4 flex-1">
                <Text className="font-bold text-gray-900 dark:text-white text-lg">
                  {t('profile.streak')}
                </Text>
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.streak || 0} {t('profile.streakDays')} 🔥
                </Text>
              </View>
            </View>
          </View>

          {/* Idioma */}
          <View className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="bg-green-100 dark:bg-green-900 rounded-full p-2 mr-3">
                  <Ionicons name="language" size={20} color="#3BB273" />
                </View>
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('profile.language')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLanguageModal(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.card,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                  minWidth: 140,
                  justifyContent: 'space-between',
                }}
              >
                <View className="flex-row items-center">
                  <Text style={{ fontSize: 20, marginRight: 8 }}>
                    {[
                      { code: 'en', flag: '🇬🇧' },
                      { code: 'pt', flag: '🇵🇹' },
                      { code: 'es', flag: '🇪🇸' },
                      { code: 'fr', flag: '🇫🇷' },
                      { code: 'de', flag: '🇩🇪' },
                      { code: 'it', flag: '🇮🇹' },
                    ].find(l => l.code === language)?.flag || '🌐'}
                  </Text>
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: theme.colors.text,
                  }}>
                    {[
                      { code: 'en', name: 'English' },
                      { code: 'pt', name: 'Português' },
                      { code: 'es', name: 'Español' },
                      { code: 'fr', name: 'Français' },
                      { code: 'de', name: 'Deutsch' },
                      { code: 'it', name: 'Italiano' },
                    ].find(l => l.code === language)?.name || 'English'}
                  </Text>
                </View>
                <Ionicons 
                  name="chevron-down" 
                  size={18} 
                  color={theme.colors.textSecondary || '#9CA3AF'} 
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Badges */}
          {badges.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('profile.badges')}
              </Text>
              <View className="flex-row flex-wrap">
                {badges.map((badge) => (
                  <BadgeItem key={badge.id} {...badge} size="medium" />
                ))}
              </View>
            </View>
          )}

          {/* Plano */}
          <View className="mb-6">
            <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('profile.plan')}
                </Text>
                <View
                  className={`px-3 py-1 rounded-full ${
                    profile?.plan === 'premium'
                      ? 'bg-yellow-100 dark:bg-yellow-900'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      profile?.plan === 'premium'
                        ? 'text-yellow-800 dark:text-yellow-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {profile?.plan === 'premium' ? t('profile.plan.premium') : t('profile.plan.free')}
                  </Text>
                </View>
              </View>
              {profile?.plan === 'free' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Premium')}
                  className="mt-3 bg-green-500 rounded-xl py-3 items-center"
                >
                  <Text className="text-white font-semibold">
                    {t('profile.upgradePremium')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Configurações */}
          <View className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}>
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('profile.settings')}
            </Text>
            
            <View style={{ gap: 8 }}>
              {/* Notificações */}
              <TouchableOpacity
                onPress={() => {
                  // TODO: Navegar para tela de notificações
                  Toast.show({
                    type: 'info',
                    text1: t('profile.settings.notifications'),
                    text2: 'Em breve',
                  });
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <View className="bg-blue-100 dark:bg-blue-900 rounded-full p-2 mr-3">
                  <Ionicons name="notifications-outline" size={20} color="#3B82F6" />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  flex: 1,
                }}>
                  {t('profile.settings.notifications')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>

              {/* Privacidade */}
              <TouchableOpacity
                onPress={() => {
                  // TODO: Navegar para tela de privacidade
                  Toast.show({
                    type: 'info',
                    text1: t('profile.settings.privacy'),
                    text2: 'Em breve',
                  });
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <View className="bg-purple-100 dark:bg-purple-900 rounded-full p-2 mr-3">
                  <Ionicons name="lock-closed-outline" size={20} color="#9333EA" />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  flex: 1,
                }}>
                  {t('profile.settings.privacy')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>

              {/* Ajuda e Suporte */}
              <TouchableOpacity
                onPress={() => {
                  // TODO: Navegar para tela de ajuda
                  Toast.show({
                    type: 'info',
                    text1: t('profile.settings.help'),
                    text2: 'Em breve',
                  });
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <View className="bg-green-100 dark:bg-green-900 rounded-full p-2 mr-3">
                  <Ionicons name="help-circle-outline" size={20} color="#3BB273" />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  flex: 1,
                }}>
                  {t('profile.settings.help')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>

              {/* Sobre */}
              <TouchableOpacity
                onPress={() => setShowAboutModal(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <View className="bg-gray-100 dark:bg-gray-700 rounded-full p-2 mr-3">
                  <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                  flex: 1,
                }}>
                  {t('profile.settings.about')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-red-500 rounded-xl py-4 items-center mb-6"
          >
            <Text className="text-white font-semibold text-lg">{t('profile.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowLogoutModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Icon */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#EF4444' + '20',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>

            {/* Title */}
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('profile.signOut')}
            </Text>

            {/* Message */}
            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}>
              {t('profile.signOutConfirm')}
            </Text>

            {/* Buttons */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('profile.signOutConfirmNo')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmSignOut}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}>
                  {t('profile.signOutConfirmYes')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowLanguageModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 20,
              padding: 20,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-end mb-4">
              <TouchableOpacity
                onPress={() => setShowLanguageModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.colors.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 8 }}>
              {[
                { code: 'en', name: 'English', flag: '🇬🇧' },
                { code: 'pt', name: 'Português', flag: '🇵🇹' },
                { code: 'es', name: 'Español', flag: '🇪🇸' },
                { code: 'fr', name: 'Français', flag: '🇫🇷' },
                { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
                { code: 'it', name: 'Italiano', flag: '🇮🇹' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => {
                    setLanguage(lang.code as any);
                    setShowLanguageModal(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: language === lang.code
                      ? '#3BB273'
                      : theme.colors.background,
                    borderWidth: language === lang.code ? 2 : 1,
                    borderColor: language === lang.code
                      ? '#3BB273'
                      : theme.colors.border || '#E5E7EB',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>
                    {lang.flag}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: language === lang.code
                      ? '#FFFFFF'
                      : theme.colors.text,
                    flex: 1,
                  }}>
                    {lang.name}
                  </Text>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowAboutModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              padding: 24,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="items-center mb-6">
              <View className="bg-green-100 dark:bg-green-900 rounded-full p-4 mb-4">
                <Text style={{ fontSize: 48 }}>🥗</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Nuti
              </Text>
              <Text className="text-base text-gray-500 dark:text-gray-400 text-center">
                {t('welcome.subtitle')}
              </Text>
            </View>

            {/* Version */}
            <View className="items-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary || '#9CA3AF',
                marginBottom: 4,
              }}>
                {t('profile.settings.version')}
              </Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: theme.colors.primary || '#3BB273',
              }}>
                1.0.0
              </Text>
            </View>

            {/* Info */}
            <View style={{ gap: 12, marginBottom: 20 }}>
              <View className="flex-row items-center">
                <Ionicons name="heart" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  flex: 1,
                }}>
                  {t('profile.settings.madeWith')}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="shield-checkmark" size={20} color="#3BB273" style={{ marginRight: 12 }} />
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  flex: 1,
                }}>
                  {t('profile.settings.dataSecure')}
                </Text>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setShowAboutModal(false)}
              activeOpacity={0.7}
              style={{
                backgroundColor: theme.colors.primary || '#3BB273',
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#FFFFFF',
              }}>
                {t('common.close')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
  );
}

