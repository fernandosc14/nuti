/**
 * ProfileScreen
 * 
 * Tela de perfil do utilizador com edição de dados e badges
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeItem } from '../components/BadgeItem';
import { PremiumPromoCard } from '../components/PremiumPromoCard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Alert } from 'react-native';

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: Date;
}

export function ProfileScreen({ navigation }: any) {
  const { user, profile, signOut, updateProfile, refreshProfile } = useUser();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme.isDark;
  const { language, setLanguage, t } = useLanguage();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // Função para gerar código de referência único baseado no userId
  const generateReferralCode = (userId: string): string => {
    const code = userId.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return code || userId.substring(0, 6).toUpperCase();
  };

  const [referralCode, setReferralCode] = useState<string>('');

  // Função para obter ou criar código de referência
  const getOrCreateReferralCode = async (): Promise<string> => {
    if (!user) return '';

    try {
      if (profile?.referralCode) {
        return profile.referralCode;
      }

      const newReferralCode = generateReferralCode(user.uid);
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        referralCode: newReferralCode,
      });
      
      await updateProfile({ referralCode: newReferralCode });
      
      return newReferralCode;
    } catch (error) {
      console.error('Error creating referral code:', error);
      return generateReferralCode(user.uid);
    }
  };

  useEffect(() => {
    const loadReferralCode = async () => {
      if (!user || !profile) return;
      
      if (profile.referralCode) {
        setReferralCode(profile.referralCode);
      } else if (user.uid) {
        try {
          const code = await getOrCreateReferralCode();
          if (code) {
            setReferralCode(code);
          }
        } catch (error) {
          console.error('Error loading referral code:', error);
        }
      }
    };
    
    loadReferralCode();
  }, [user?.uid, profile?.id]);

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;

    try {
      await Clipboard.setStringAsync(referralCode);
      Toast.show({
        type: 'success',
        text1: t('profile.referralCode.copied') || 'Código copiado!',
        text2: t('profile.referralCode.copiedMessage') || 'O código de referência foi copiado para a área de transferência',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.referralCode.copyError') || 'Erro ao copiar código',
      });
    }
  };

  // Calcular idade a partir de dateOfBirth
  const calculateAge = (dateOfBirth?: Date): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const userAge = calculateAge(profile?.dateOfBirth);

  const handleSelectProfileImage = () => {
    if (!user) return;
    setShowImagePickerModal(true);
  };

  const handleCameraPress = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error') || 'Erro',
          t('profile.cameraPermissionRequired') || 'Permissão de câmera necessária'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('profile.imageUploadError') || 'Erro ao selecionar imagem',
      });
    }
  };

  const handleGalleryPress = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error') || 'Erro',
          t('profile.galleryPermissionRequired') || 'Permissão de galeria necessária'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: error.message || t('profile.imageUploadError') || 'Erro ao selecionar imagem',
      });
    }
  };

  // Converter imagem para base64 (solução gratuita sem Firebase Storage)
  // Usa XMLHttpRequest que funciona melhor no React Native
  const uriToBase64 = async (uri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result as string;
              if (base64String) {
                resolve(base64String);
              } else {
                reject(new Error('Falha ao converter blob para base64'));
              }
            };
            reader.onerror = () => {
              reject(new Error('Erro ao ler o blob'));
            };
            reader.readAsDataURL(xhr.response);
          } catch (readError: any) {
            reject(new Error('Erro ao processar resposta: ' + readError.message));
          }
        } else {
          reject(new Error(`Falha ao carregar imagem: status ${xhr.status}`));
        }
      };
      
      xhr.onerror = function () {
        reject(new Error('Erro de rede ao carregar imagem'));
      };
      
      xhr.onabort = function () {
        reject(new Error('Carregamento da imagem cancelado'));
      };
      
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  const uploadProfileImage = async (imageUri: string) => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: 'Usuário não autenticado',
      });
      return;
    }

    setUploadingImage(true);
    try {
      console.log('Starting image upload, URI:', imageUri);
      console.log('User UID:', user.uid);
      
      // Converter imagem para base64
      const base64Image = await uriToBase64(imageUri);
      console.log('Base64 image created, length:', base64Image.length);
      
      // Verificar tamanho (limite do Firestore é ~1MB, mas vamos limitar a ~500KB para segurança)
      const sizeInKB = (base64Image.length * 3) / 4 / 1024;
      if (sizeInKB > 500) {
        Toast.show({
          type: 'error',
          text1: t('common.error') || 'Erro',
          text2: 'Imagem muito grande. Por favor, escolha uma imagem menor (máximo 500KB).',
        });
        return;
      }
      
      console.log('Image size:', sizeInKB.toFixed(2), 'KB');

      // Atualizar perfil com a imagem em base64
      await updateProfile({ profileImageUrl: base64Image });
      console.log('Profile updated with base64 image');

      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Sucesso',
        text2: t('profile.imageUpdated') || 'Foto de perfil atualizada com sucesso',
      });
    } catch (error: any) {
      console.error('Error uploading profile image:', error);
      console.error('Error message:', error.message);
      
      let errorMessage = t('profile.imageUploadError') || 'Erro ao fazer upload da imagem';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: errorMessage,
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeProfileImage = async () => {
    if (!user) return;

    setShowImagePickerModal(false);
    setUploadingImage(true);
    try {
      // Remover a foto de perfil usando deleteField do Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        profileImageUrl: deleteField(),
      });
      
      // Recarregar o perfil para atualizar o estado local
      await refreshProfile();
      
      Toast.show({
        type: 'success',
        text1: t('profile.updateSuccess') || 'Sucesso',
        text2: t('profile.imageRemoved') || 'Foto de perfil removida com sucesso',
      });
    } catch (error: any) {
      console.error('Error removing profile image:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Erro',
        text2: t('profile.imageRemoveError') || 'Erro ao remover foto de perfil',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  React.useEffect(() => {
    if (profile) {
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
            name: badgeData.name || '',
            icon: badgeData.icon || '🏆',
            description: badgeData.description || '',
            earnedAt: badgeData.earnedAt?.toDate(),
          });
        }
      }

      setBadges(badgesData);
    } catch (error) {
      console.error('Error loading badges:', error);
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

  const handleDeleteAccount = () => {
    setShowDeleteAccountModal(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      setShowDeleteAccountModal(false);
      Toast.show({
        type: 'info',
        text1: 'Funcionalidade em desenvolvimento',
        text2: 'A eliminação de conta estará disponível em breve',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao eliminar conta',
      });
    }
  };

  const handleSupportEmail = () => {
    Linking.openURL('mailto:support@nuti.app?subject=Suporte Nuti');
  };

  const handleFeatureRequest = () => {
    Linking.openURL('mailto:feedback@nuti.app?subject=Solicitação de Recurso');
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Título Grande */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
          <Text style={{
            fontSize: 32,
            fontWeight: '800',
            color: theme.colors.text,
          }}>
            {t('profile.settings')}
          </Text>
        </View>

        {/* Secção de Perfil */}
        <View style={{
          marginHorizontal: 24,
          marginBottom: 24,
          backgroundColor: theme.colors.card,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 20,
          borderWidth: 1,
          borderColor: theme.colors.border || '#E5E7EB',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Avatar */}
            <TouchableOpacity
              onPress={handleSelectProfileImage}
              activeOpacity={0.7}
              disabled={uploadingImage}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.primary || '#3BB273',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                overflow: 'hidden',
              }}
            >
              {profile?.profileImageUrl ? (
                <Image
                  source={{ uri: profile.profileImageUrl }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                  }}
                />
              ) : (
                <Ionicons name="camera" size={28} color="#FFFFFF" />
              )}
              {uploadingImage && (
                <View style={{
                  position: 'absolute',
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              )}
            </TouchableOpacity>

            {/* Nome e Idade */}
            <TouchableOpacity
              onPress={() => navigation.navigate('EditName')}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginRight: 8,
                  flex: 1,
                }}>
                  {profile?.name || t('profile.name') || 'Digite seu nome'}
                </Text>
                <Ionicons name="pencil-outline" size={18} color={theme.colors.textSecondary || '#9CA3AF'} />
              </View>
              {userAge !== null && (
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#9CA3AF',
                }}>
                  {userAge} {t('profile.ageYears') || 'anos'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Secção de Código de Referência - Estilo "Invita amici" */}
        {referralCode && (
          <View style={{
            marginHorizontal: 24,
            marginBottom: 24,
            backgroundColor: theme.colors.card,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.colors.border || '#E5E7EB',
          }}>
            <View style={{
              backgroundColor: '#9333EA',
              padding: 20,
              alignItems: 'center',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <Ionicons name="people-outline" size={24} color="#FFFFFF" />
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginLeft: 8,
                }}>
                  {t('profile.referralCode.title') || 'Invita amici'}
                </Text>
              </View>
              <Text style={{
                fontSize: 14,
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 16,
                opacity: 0.9,
              }}>
                {t('profile.referralCode.description') || 'Il viaggio è più facile insieme.'}
              </Text>
              <TouchableOpacity
                onPress={handleCopyReferralCode}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  marginTop: 8,
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#9333EA',
                }}>
                  {t('profile.referralCode.invite') || `Invita un amico per guadagnare $`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Premium Promo Card */}
        <PremiumPromoCard
          variant="compact"
          onPress={() => navigation.navigate('Premium')}
        />

        {/* Lista de Configurações */}
        <View style={{
          marginHorizontal: 24,
          marginBottom: 24,
        }}>
          {/* Detalhes Pessoais */}
          <TouchableOpacity
            onPress={() => navigation.navigate('EditPersonalDetails')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="person-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.personalDetails') || 'Detalhes pessoais'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Meta e Peso Atual */}
          <TouchableOpacity
            onPress={() => navigation.navigate('EditGoalAndWeight')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="flag-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.goalAndWeight') || 'Meta e peso atual'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Calorias e Macros */}
          <TouchableOpacity
            onPress={() => navigation.navigate('EditCaloriesAndMacros')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="flame-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.caloriesAndMacros') || 'Calorias e Macros'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Treinos por Semana */}
          <TouchableOpacity
            onPress={() => navigation.navigate('EditWorkoutsPerWeek')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="fitness-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.workoutsPerWeek') || 'Treinos por semana'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Dieta */}
          <TouchableOpacity
            onPress={() => navigation.navigate('EditDiet')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="restaurant-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.diet') || 'Dieta'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Idioma */}
          <TouchableOpacity
            onPress={() => setShowLanguageModal(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="language-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.language')}
            </Text>
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#9CA3AF',
              marginRight: 8,
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
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Preferências */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Preferences')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.preferences') || 'Preferências'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Divisor */}
          <View style={{
            height: 1,
            backgroundColor: theme.colors.border || '#E5E7EB',
            marginVertical: 16,
          }} />

          {/* Termos e Condições */}
          <TouchableOpacity
            onPress={() => {
              Toast.show({
                type: 'info',
                text1: t('profile.settings.terms'),
                text2: 'Em breve',
              });
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="document-text-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.settings.terms')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Política de Privacidade */}
          <TouchableOpacity
            onPress={() => {
              Toast.show({
                type: 'info',
                text1: t('profile.settings.privacyPolicy'),
                text2: 'Em breve',
              });
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.settings.privacyPolicy')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Email de Suporte */}
          <TouchableOpacity
            onPress={handleSupportEmail}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="mail-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.settings.supportEmail') || 'Email de Suporte'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Solicitação de Recurso */}
          <TouchableOpacity
            onPress={handleFeatureRequest}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="megaphone-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.settings.featureRequest') || 'Solicitação de recurso'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Excluir Conta? */}
          <TouchableOpacity
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="person-remove-outline" size={24} color="#EF4444" />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#EF4444',
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.settings.deleteAccount') || 'Excluir Conta?'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>

          {/* Divisor */}
          <View style={{
            height: 1,
            backgroundColor: theme.colors.border || '#E5E7EB',
            marginVertical: 24,
          }} />

          {/* Sair */}
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: theme.colors.border || '#E5E7EB',
            }}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.colors.text} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: theme.colors.text,
              marginLeft: 12,
              flex: 1,
            }}>
              {t('profile.signOut')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary || '#9CA3AF'} />
          </TouchableOpacity>
        </View>

        {/* Versão */}
        <View style={{
          alignItems: 'center',
          marginTop: 8,
          marginBottom: 24,
        }}>
          <Text style={{
            fontSize: 12,
            color: theme.colors.textSecondary || '#9CA3AF',
            fontWeight: '600',
          }}>
            {t('profile.settings.version') || 'VERSÃO'} {appVersion}
          </Text>
        </View>
      </ScrollView>

      {/* Modal de Idioma */}
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
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 20,
              textAlign: 'center',
            }}>
              {t('profile.language')}
            </Text>

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
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: language === lang.code
                    ? (theme.colors.primary || '#3BB273') + '20'
                    : 'transparent',
                  marginBottom: 8,
                  borderWidth: language === lang.code ? 2 : 1,
                  borderColor: language === lang.code
                    ? theme.colors.primary || '#3BB273'
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
                    ? theme.colors.primary || '#3BB273'
                    : theme.colors.text,
                  flex: 1,
                }}>
                  {lang.name}
                </Text>
                {language === lang.code && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.colors.primary || '#3BB273'}
                  />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Logout */}
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

            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('profile.signOut')}
            </Text>

            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}>
              {t('profile.signOutConfirm')}
            </Text>

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

      {/* Modal de Eliminar Conta */}
      <Modal
        visible={showDeleteAccountModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowDeleteAccountModal(false)}
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
              <Ionicons name="warning-outline" size={32} color="#EF4444" />
            </View>

            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 12,
            }}>
              {t('profile.settings.deleteAccount') || 'Excluir Conta?'}
            </Text>

            <Text style={{
              fontSize: 16,
              color: theme.colors.textSecondary || '#9CA3AF',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}>
              {t('profile.settings.deleteAccountConfirm') || 'Tens a certeza que queres eliminar a tua conta? Esta ação não pode ser desfeita.'}
            </Text>

            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={() => setShowDeleteAccountModal(false)}
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
                  {t('profile.cancel') || 'Cancelar'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmDeleteAccount}
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
                  {t('profile.settings.delete') || 'Eliminar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Seleção de Foto */}
      <Modal
        visible={showImagePickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowImagePickerModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 24,
              paddingBottom: 60,
              paddingHorizontal: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Handle bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: theme.colors.border || '#E5E7EB',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 24,
            }} />

            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 24,
            }}>
              {t('profile.selectPhoto') || 'Selecionar foto'}
            </Text>

            <View style={{
              flexDirection: 'row',
              gap: 16,
              marginBottom: 16,
            }}>
              {/* Opção Câmera */}
              <TouchableOpacity
                onPress={handleCameraPress}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.background,
                  borderRadius: 16,
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.colors.primary || '#3BB273',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Ionicons name="camera" size={28} color="#FFFFFF" />
                </View>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('profile.camera') || 'Câmera'}
                </Text>
              </TouchableOpacity>

              {/* Opção Galeria */}
              <TouchableOpacity
                onPress={handleGalleryPress}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.background,
                  borderRadius: 16,
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border || '#E5E7EB',
                }}
              >
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.colors.primary || '#3BB273',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Ionicons name="images" size={28} color="#FFFFFF" />
                </View>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('profile.gallery') || 'Galeria'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Opção Remover Foto (apenas se já houver foto) */}
            {profile?.profileImageUrl && (
              <TouchableOpacity
                onPress={removeProfileImage}
                activeOpacity={0.7}
                disabled={uploadingImage}
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  backgroundColor: theme.colors.background,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#EF4444',
                  marginBottom: 12,
                }}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#EF4444',
                  }}>
                    {t('profile.removePhoto') || 'Remover foto'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Botão Cancelar */}
            <TouchableOpacity
              onPress={() => setShowImagePickerModal(false)}
              activeOpacity={0.7}
              style={{
                paddingVertical: 16,
                borderRadius: 12,
                backgroundColor: theme.colors.background,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.text,
              }}>
                {t('common.cancel') || 'Cancelar'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
