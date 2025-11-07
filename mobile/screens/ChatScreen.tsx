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
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#3BB273" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            NutriBot
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            O teu assistente nutricional
          </Text>
        </View>
      </View>

      {/* Mensagens */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-6 py-4"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {messages.length === 0 && (
          <View className="items-center justify-center py-12">
            <View className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full items-center justify-center mb-4">
              <Text className="text-4xl">🤖</Text>
            </View>
            <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Olá!
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center">
              Sou o NutriBot. Como posso ajudar hoje?
            </Text>
          </View>
        )}

        {messages.map((message) => (
          <MotiView
            key={message.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            className={`mb-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <View
              className={`max-w-[80%] rounded-3xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-green-500'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <Text
                className={`text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'text-white'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {message.content}
              </Text>
              <Text
                className={`text-xs mt-1 ${
                  message.role === 'user'
                    ? 'text-white/70'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
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
          <View className="mb-4 items-start">
            <View className="bg-gray-100 dark:bg-gray-800 rounded-3xl px-4 py-3">
              <View className="flex-row gap-2">
                <View className="w-2 h-2 bg-green-500 rounded-full" />
                <View className="w-2 h-2 bg-green-500 rounded-full" style={{ marginTop: 4 }} />
                <View className="w-2 h-2 bg-green-500 rounded-full" />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <View className="flex-row items-center gap-2">
            <TextInput
              className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
              placeholder="Escreve a tua mensagem..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
              className={`rounded-xl px-4 py-3 ${
                inputText.trim() && !loading
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

