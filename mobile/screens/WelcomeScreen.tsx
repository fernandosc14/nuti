/**
 * WelcomeScreen
 * 
 * Tela inicial da aplicação com opções para começar ou fazer login
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, Language } from '../context/LanguageContext';

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
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
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
  
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
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

      <View className="flex-1 items-center justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-12">
          <View className="w-32 h-32 bg-green-500 rounded-full items-center justify-center mb-6">
            <Text className="text-6xl">🥗</Text>
          </View>
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {t('welcome.title')}
          </Text>
          <Text className="text-lg text-gray-500 dark:text-gray-400 text-center">
            {t('welcome.subtitle')}
          </Text>
        </View>

        {/* Botão Get Started */}
        <TouchableOpacity
          onPress={handleGetStarted}
          className="bg-green-500 rounded-xl py-4 px-12 w-full items-center justify-center mb-4 shadow-lg"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-lg">{t('welcome.getStarted')}</Text>
        </TouchableOpacity>

        {/* Link Sign In */}
        <TouchableOpacity
          onPress={() => navigation?.navigate('Login')}
          activeOpacity={0.7}
          style={{ marginTop: 16 }}
        >
          <Text style={{
            color: '#3BB273',
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'center',
          }}>
            {t('welcome.alreadyRegistered')}
          </Text>
        </TouchableOpacity>
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
              backgroundColor: '#FFFFFF',
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
                color: '#111827',
              }}>
                {t('welcome.selectLanguage')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowLanguageModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color="#111827" />
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
                      : '#F9FAFB',
                    borderWidth: 1,
                    borderColor: language === lang.code
                      ? '#3BB273'
                      : '#E5E7EB',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{lang.flag}</Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: language === lang.code ? '#FFFFFF' : '#111827',
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
    </SafeAreaView>
  );
}

