/**
 * ChatScreen
 * 
 * Tela de chat com IA usando Groq API
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sendChatMessage, ChatMessage } from '../services/api';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatScreen({ navigation }: any) {
  const { user, profile } = useUser();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return;

    try {
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const messagesData: Message[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        messagesData.push({
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.createdAt?.toDate() || new Date(),
        });
      });

      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user || loading) return;

    // Verificar se é premium ou tem limite
    if (profile?.plan === 'free') {
      // Limitar mensagens para free (exemplo: 5 por dia)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('userId', '==', user.uid),
        where('role', '==', 'user'),
        where('createdAt', '>=', Timestamp.fromDate(today)),
        where('createdAt', '<', Timestamp.fromDate(tomorrow))
      );

      const snapshot = await getDocs(q);
      if (snapshot.size >= 5) {
        Toast.show({
          type: 'info',
          text1: 'Limite atingido',
          text2: 'Atualiza para Premium para chat ilimitado!',
        });
        navigation.navigate('Premium');
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Salvar mensagem do utilizador
      await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        role: 'user',
        content: userMessage.content,
        createdAt: Timestamp.now(),
      });

      // Preparar histórico de mensagens para a API
      const chatHistory: ChatMessage[] = messages
        .slice(-10) // Últimas 10 mensagens para contexto
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
        .concat([{ role: 'user', content: userMessage.content }]);

      // Enviar para Groq API
      const assistantContent = await sendChatMessage(chatHistory, user.uid);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Salvar resposta da IA
      await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: Timestamp.now(),
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao comunicar com a IA',
      });

      // Adicionar mensagem de erro
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpa, ocorreu um erro. Por favor, tenta novamente.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {!theme.isDark && (
          <LinearGradient
            colors={['#FFFFFF', '#F0FDF4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border || '#E5E7EB',
        }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary || '#3BB273'} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.colors.text,
            }}>
              {t('chat.title')}
            </Text>
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#6B7280',
            }}>
              {t('chat.subtitle')}
            </Text>
          </View>
        </View>

        {/* Mensagens */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 16 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: (theme.colors.primary || '#3BB273') + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 40 }}>💬</Text>
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: 8,
            }}>
              {t('chat.greeting')}
            </Text>
            <Text style={{
              color: theme.colors.textSecondary || '#6B7280',
              textAlign: 'center',
            }}>
              {t('chat.greetingMessage')}
            </Text>
          </View>
        )}

        {messages.map((message) => (
          <MotiView
            key={message.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={{
              marginBottom: 16,
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                maxWidth: '80%',
                borderRadius: 24,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: message.role === 'user'
                  ? (theme.colors.primary || '#3BB273')
                  : (theme.colors.card || (theme.isDark ? '#1F2937' : '#F3F4F6')),
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: message.role === 'user'
                    ? '#FFFFFF'
                    : theme.colors.text,
                }}
              >
                {message.content}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: message.role === 'user'
                    ? 'rgba(255, 255, 255, 0.7)'
                    : (theme.colors.textSecondary || '#6B7280'),
                }}
              >
                {message.timestamp.toLocaleTimeString('pt-PT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </MotiView>
        ))}

        {loading && (
          <View style={{ marginBottom: 16, alignItems: 'flex-start' }}>
            <View style={{
              backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#F3F4F6'),
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 8, height: 8, backgroundColor: theme.colors.primary || '#3BB273', borderRadius: 4 }} />
                <View style={{ width: 8, height: 8, backgroundColor: theme.colors.primary || '#3BB273', borderRadius: 4, marginTop: 4 }} />
                <View style={{ width: 8, height: 8, backgroundColor: theme.colors.primary || '#3BB273', borderRadius: 4 }} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

        {/* Input */}
        <View style={{
          paddingHorizontal: 24,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border || '#E5E7EB',
          backgroundColor: theme.colors.background,
          paddingTop: 12,
          paddingBottom: 60,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#F3F4F6'),
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: theme.colors.text,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                maxHeight: 100,
              }}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={theme.colors.textSecondary || '#9CA3AF'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
              style={{
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: (inputText.trim() && !loading)
                  ? (theme.colors.primary || '#3BB273')
                  : (theme.isDark ? '#374151' : '#D1D5DB'),
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

