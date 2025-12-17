/**
 * WelcomeScreen
 * 
 * Tela inicial da aplicação com opções para começar ou fazer login
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Image, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Asset } from 'expo-asset';
import { useLanguage, Language } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import Toast from 'react-native-toast-message';

const languages = [
  { code: 'en' as Language, name: 'English', flag: '🇬🇧' },
  { code: 'pt' as Language, name: 'Português', flag: '🇵🇹' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
  { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
  { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it' as Language, name: 'Italiano', flag: '🇮🇹' },
];

export function WelcomeScreen({ navigation, showOnboarding }: any) {
  const { t, language, setLanguage } = useLanguage();
  const { signInWithGoogleNative } = useUser();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [shouldRenderVideo, setShouldRenderVideo] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadVideo = async () => {
      const asset = Asset.fromModule(require('../assets/welcome-video.mp4'));
      await asset.downloadAsync();
      if (asset.localUri) {
        setVideoUri(asset.localUri);
      }
    };
    loadVideo();
  }, []);
  
  const player = useVideoPlayer(videoUri || require('../assets/welcome-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    if (videoUri) {
      player.play();
      setTimeout(() => {
        setShouldRenderVideo(true);
      }, 100);
    }
  });
  
  useEffect(() => {
    if (videoUri && player) {
      player.loop = true;
      player.muted = true;
      player.play();
      setTimeout(() => {
        setShouldRenderVideo(true);
      }, 100);
    }
  }, [videoUri, player]);
  
  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];
  
  // Se showOnboarding está disponível (vindo do contexto), usá-lo em vez de navegação
  const handleGetStarted = () => {
    if (showOnboarding) {
      showOnboarding();
    } else if (navigation) {
      // Fallback para navegação (caso o contexto não esteja disponível)
      navigation.navigate('Onboarding');
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogleNative();
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('auth.signIn') + ' ' + t('common.success'),
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error?.message || t('common.error'),
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      {/* Language Selector - Top Right (below status bar) */}
      <View style={{ position: 'absolute', top: 60, right: 20, zIndex: 10 }}>
        <TouchableOpacity
          onPress={() => setShowLanguageModal(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 20,
            backgroundColor: 'rgba(59, 178, 115, 0.1)',
            borderWidth: 1,
            borderColor: '#3BB273',
          }}
        >
          <Text style={{ fontSize: 18, marginRight: 6 }}>{currentLanguage.flag}</Text>
          <Ionicons name="chevron-down" size={16} color="#3BB273" />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Video no centro */}
        <View style={styles.videoContainer}>
          {shouldRenderVideo && player ? (
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
              allowsPictureInPicture={false}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Image
                source={require('../assets/frame-welcome-video.png')}
                style={styles.placeholderImage}
              />
            </View>
          )}
        </View>

        {/* Botões em baixo */}
        <View style={styles.buttonsContainer}>
          {/* Botão Get Started */}
          <TouchableOpacity
            onPress={handleGetStarted}
            style={styles.getStartedButton}
            activeOpacity={0.8}
          >
            <Text style={styles.getStartedText}>{t('welcome.getStarted')}</Text>
          </TouchableOpacity>

          {/* Link Sign In */}
          <TouchableOpacity
            onPress={handleSignIn}
            activeOpacity={0.7}
            style={styles.signInButton}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#3BB273" />
            ) : (
              <Text style={styles.signInText}>
                {t('welcome.alreadyRegistered')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Consent: Terms & Privacy */}
          <View style={{ alignItems: 'center', marginTop: 8, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
              {(t('auth.byContinuingAgree') as string) || 'Ao continuar, concordas com os '}
              <Text
                style={{ fontSize: 12, color: '#3BB273' }}
                onPress={() => Linking.openURL('https://nuti.app/terms-and-conditions')}
              >
                {t('profile.settings.terms') || 'Termos e Condições'}
              </Text>
              {' e '}
              <Text
                style={{ fontSize: 12, color: '#3BB273' }}
                onPress={() => Linking.openURL('https://nuti.app/privacy-policy')}
              >
                {t('profile.settings.privacyPolicy') || 'Política de Privacidade'}
              </Text>
              {'.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Language Selection Modal */}
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
              backgroundColor: '#1F2937',
              borderRadius: 20,
              padding: 20,
              width: '85%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 8,
              borderWidth: 1,
              borderColor: '#374151',
            }}
          >
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#FFFFFF',
              }}>
                {t('welcome.selectLanguage')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowLanguageModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#374151',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Language Options */}
            <View style={{ gap: 8 }}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => {
                    setLanguage(lang.code);
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
                      : '#374151',
                    borderWidth: 1,
                    borderColor: language === lang.code
                      ? '#3BB273'
                      : '#4B5563',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{lang.flag}</Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: language === lang.code ? '#FFFFFF' : '#F9FAFB',
                    flex: 1,
                  }}>
                    {lang.name}
                  </Text>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Loading Modal */}
      <Modal
        visible={loading}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#3BB273" />
            <Text style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    maxHeight: '75%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    paddingBottom: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    maxWidth: 500,
    maxHeight: 500,
    backgroundColor: 'transparent',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  videoPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxWidth: 500,
    maxHeight: 500,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  getStartedButton: {
    backgroundColor: '#3BB273',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signInButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  signInText: {
    color: '#3BB273',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#374151',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
});

