/**
 * ProfileScreen
 * 
 * Tela de perfil do utilizador com edição de dados e badges
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { BadgeItem } from '../components/BadgeItem';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: Date;
}

export function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut, updateProfile } = useUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setWeight(profile.weight ? profile.weight.toString() : '');
      setHeight(profile.height ? profile.height.toString() : '');
      setGoal(profile.goal || 'maintain');
      loadBadges();
    }
  }, [profile]);

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
      const updates: any = {
        name: name.trim() || profile?.name || '',
        goal: goal,
      };

      // Só atualizar peso e altura se foram fornecidos valores válidos
      if (weight && !isNaN(parseFloat(weight))) {
        updates.weight = parseFloat(weight);
      }
      if (height && !isNaN(parseFloat(height))) {
        updates.height = parseFloat(height);
      }

      await updateProfile(updates);

      Toast.show({
        type: 'success',
        text1: 'Perfil atualizado!',
        text2: 'As tuas informações foram salvas',
      });

      setEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao atualizar perfil',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sair', 'Tens a certeza que queres sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Erro',
              text2: 'Erro ao fazer logout',
            });
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#3BB273" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Perfil
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
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Informações Pessoais
            </Text>

            <View className="mb-4">
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Nome
              </Text>
              {editing ? (
                <TextInput
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                  value={name}
                  onChangeText={setName}
                  placeholder="O teu nome"
                />
              ) : (
                <Text className="text-gray-900 dark:text-white text-base">
                  {profile?.name || 'Não definido'}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Email
              </Text>
              <Text className="text-gray-900 dark:text-white text-base">
                {profile?.email || user?.email}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Peso (kg)
              </Text>
              {editing ? (
                <TextInput
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  keyboardType="numeric"
                />
              ) : (
                <Text className="text-gray-900 dark:text-white text-base">
                  {profile?.weight ? `${profile.weight} kg` : 'Não definido'}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Altura (cm)
              </Text>
              {editing ? (
                <TextInput
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                  value={height}
                  onChangeText={setHeight}
                  placeholder="175"
                  keyboardType="numeric"
                />
              ) : (
                <Text className="text-gray-900 dark:text-white text-base">
                  {profile?.height ? `${profile.height} cm` : 'Não definido'}
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Objetivo
              </Text>
              {editing ? (
                <View className="flex-row gap-3">
                  {(['lose', 'maintain', 'gain'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGoal(g)}
                      className={`px-4 py-2 rounded-xl border-2 ${
                        goal === g
                          ? 'bg-green-500 border-green-500'
                          : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Text
                        className={
                          goal === g
                            ? 'text-white font-semibold'
                            : 'text-gray-700 dark:text-gray-300'
                        }
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
                <Text className="text-gray-900 dark:text-white text-base">
                  {profile?.goal === 'lose'
                    ? 'Perder peso'
                    : profile?.goal === 'gain'
                    ? 'Ganhar peso'
                    : 'Manter peso'}
                </Text>
              )}
            </View>
          </View>

          {/* Streak */}
          <View className="mb-6">
            <View className="bg-orange-100 dark:bg-orange-900 rounded-2xl p-4 flex-row items-center">
              <Ionicons name="flame" size={32} color="#F97316" />
              <View className="ml-4 flex-1">
                <Text className="font-bold text-gray-900 dark:text-white text-lg">
                  Streak Atual
                </Text>
                <Text className="text-gray-600 dark:text-gray-300">
                  {profile?.streak || 0} dias consecutivos 🔥
                </Text>
              </View>
            </View>
          </View>

          {/* Badges */}
          {badges.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Badges Desbloqueadas
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
                  Plano Atual
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
                    {profile?.plan === 'premium' ? '⭐ Premium' : 'Free'}
                  </Text>
                </View>
              </View>
              {profile?.plan === 'free' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Premium')}
                  className="mt-3 bg-green-500 rounded-xl py-3 items-center"
                >
                  <Text className="text-white font-semibold">
                    Atualizar para Premium
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-red-500 rounded-xl py-4 items-center mb-6"
          >
            <Text className="text-white font-semibold text-lg">Sair</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

