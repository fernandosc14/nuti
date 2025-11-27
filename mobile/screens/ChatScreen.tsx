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
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sendChatMessage, ChatMessage, transcribeAudio } from '../services/api';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';
import { useAudioRecorder, requestRecordingPermissionsAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  deleted?: boolean;
}

export function ChatScreen({ navigation }: any) {
  const { user, profile } = useUser();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const optionsButtonRef = useRef<TouchableOpacity>(null);
  const [optionsButtonLayout, setOptionsButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Opções mínimas necessárias para o expo-audio funcionar
  const audioRecorder = useAudioRecorder({
    android: {
      extension: '.m4a',
    },
    ios: {
      extension: '.m4a',
    },
    web: {
      mimeType: 'audio/webm',
    },
  });

  useEffect(() => {
    if (user) {
      loadMessages();
    }
    
    // Limpar gravação ao desmontar
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (audioRecorder.isRecording) {
        audioRecorder.stop().catch(() => {});
      }
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Animar ponto pulsante durante gravação
  useEffect(() => {
    if (audioRecorder.isRecording) {
      // Animação de pulso contínua
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => {
        pulseAnimation.stop();
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [audioRecorder.isRecording, pulseAnim]);

  const loadMessages = async () => {
    if (!user) return;

    try {
      // Calcular data limite (30 minutos atrás)
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('userId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(thirtyMinutesAgo)),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const messagesData: Message[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filtrar mensagens deletadas
        if (data.deleted === true) {
          return;
        }
        messagesData.push({
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.createdAt?.toDate() || new Date(),
          deleted: data.deleted || false,
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

  const clearChat = async () => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: t('chat.error') || 'Erro',
        text2: 'Utilizador não autenticado',
      });
      return;
    }

    if (messages.length === 0) {
      Toast.show({
        type: 'info',
        text1: t('chat.chatCleared') || 'Chat limpo',
        text2: 'Não há mensagens para eliminar',
      });
      setShowOptionsDropdown(false);
      return;
    }

    try {
      // Marcar todas as mensagens como deletadas
      const deletePromises = messages.map(message => 
        updateDoc(doc(db, 'messages', message.id), {
          userId: user.uid, // Incluir userId para garantir que não é alterado
          deleted: true,
        })
      );

      await Promise.all(deletePromises);
      
      // Limpar lista local
      setMessages([]);
      setShowOptionsDropdown(false);
      
      Toast.show({
        type: 'success',
        text1: t('chat.chatCleared') || 'Chat limpo',
        text2: t('chat.chatClearedMessage') || 'Todas as mensagens foram eliminadas',
      });
    } catch (error: any) {
      console.error('Error clearing chat:', error);
      Toast.show({
        type: 'error',
        text1: t('chat.error') || 'Erro',
        text2: error.message || t('chat.errorClearingChat') || 'Erro ao limpar o chat',
      });
    }
  };

  const startRecording = async () => {
    try {
      // Verificar se já está gravando
      if (audioRecorder.isRecording) {
        return;
      }

      // Solicitar permissão
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Precisa de permissão para gravar áudio.');
        return;
      }

      // Resetar duração
      setRecordingDuration(0);

      // Preparar recorder e iniciar gravação em paralelo para ser mais rápido
      const preparePromise = audioRecorder.prepareToRecordAsync?.().catch(() => {
        // Ignorar erro se já estiver preparado
      });
      
      // Iniciar gravação imediatamente (não esperar pela preparação)
      const recordPromise = audioRecorder.record();
      
      // Aguardar ambas as operações em paralelo
      await Promise.all([preparePromise, recordPromise].filter(Boolean));
      
      // Verificar se iniciou (delay mínimo)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verificar se realmente iniciou
      if (!audioRecorder.isRecording) {
        // Tentar novamente uma vez
        try {
          await audioRecorder.record();
          await new Promise(resolve => setTimeout(resolve, 50));
          
          if (!audioRecorder.isRecording) {
            Toast.show({
              type: 'error',
              text1: 'Erro',
              text2: 'Não foi possível iniciar a gravação. Tenta novamente.',
            });
            return;
          }
        } catch (retryError) {
          Toast.show({
            type: 'error',
            text1: 'Erro',
            text2: 'Não foi possível iniciar a gravação. Tenta novamente.',
          });
          return;
        }
      }

      // Iniciar timer apenas depois de confirmar que está gravando
      const startTime = Date.now();
      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(elapsed);
        
        // Parar automaticamente quando atingir 30 segundos
        if (elapsed >= 30) {
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
          stopRecording();
        }
      }, 100);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Não foi possível iniciar a gravação. Reinicia a app.',
      });
    }
  };

  const stopRecording = async () => {
    if (!audioRecorder.isRecording) return;

    // Parar o timer
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      const result = await audioRecorder.stop();
      
      // Extrair a URI do objeto retornado
      const uri = typeof result === 'string' ? result : (result?.url || result?.uri || '');
      
      // Resetar duração
      setRecordingDuration(0);

      if (uri) {
        // Verificar se a gravação foi muito curta (menos de 3 segundos)
        if (recordingDuration < 3) {
          Toast.show({
            type: 'info',
            text1: t('chat.recordingTooShort') || 'Gravação muito curta',
            text2: t('chat.recordingTooShortMessage') || 'Grava pelo menos 3 segundos',
          });
          return;
        }

        setTranscribing(true);
        try {
          // Transcrever áudio para texto
          const transcribedText = await transcribeAudio(uri);
          
          // Textos comuns que o Whisper retorna quando não há fala (filtrar)
          const commonNoiseTexts = [
            'thank you for watching',
            'thanks for watching',
            'thank you',
            'thanks',
            'you',
            'thank you for',
            'thank you for watching this video',
            'obrigado por assistir',
            'obrigado',
            'gracias',
            'merci',
            'danke',
            'grazie',
            'um',
            'uh',
            'ah',
            'eh',
            'oh',
            'hmm',
            'mmm',
            'huh',
            'yeah',
            'yes',
            'no',
            'ok',
            'okay',
            'alright',
            'all right',
            'sure',
            'right',
            'yeah yeah',
            'uh huh',
            'mm hmm',
            'hmm hmm',
            'um um',
            'ah ah',
            'eh eh',
            'oh oh',
            '.',
            ',',
            '...',
            '..',
            '?',
            '!',
            '-',
            '—',
            '–',
          ];
          
          const normalizedText = transcribedText.trim().toLowerCase();
          
          // Verificar se é apenas pontuação ou ruído
          const isOnlyPunctuation = /^[.,!?\-—–\s]+$/.test(normalizedText);
          const isNoise = commonNoiseTexts.some(noise => {
            const noiseLower = noise.toLowerCase();
            return normalizedText === noiseLower || 
                   normalizedText === noiseLower + '.' ||
                   normalizedText === noiseLower + ',' ||
                   normalizedText.startsWith(noiseLower + ' ') ||
                   normalizedText.endsWith(' ' + noiseLower);
          });
          
          // Validar se o texto é válido (não vazio, não muito curto, não é apenas pontuação, e não é ruído)
          const trimmedText = transcribedText.trim();
          
          // Se o texto estiver completamente vazio ou muito curto, é porque não houve fala
          if (!trimmedText || trimmedText.length === 0) {
            Toast.show({
              type: 'info',
              text1: t('chat.noSpeechDetected') || 'Nenhuma fala detectada',
              text2: t('chat.noSpeechDetectedMessage') || 'Por favor, fala para o microfone',
            });
            return;
          }
          
          const isValid = trimmedText.length >= 3 && // Mínimo 3 caracteres
                         !isOnlyPunctuation && 
                         !isNoise &&
                         trimmedText.split(/\s+/).length >= 1; // Pelo menos uma palavra
          
          if (isValid) {
            setInputText(trimmedText);
          } else {
            // Texto foi detectado mas é ruído ou inválido
            Toast.show({
              type: 'info',
              text1: t('chat.audioNotRecognized') || 'Áudio não reconhecido',
              text2: t('chat.audioNotRecognizedMessage') || 'Tenta falar mais claramente',
            });
          }
        } catch (error: any) {
          Toast.show({
            type: 'error',
            text1: t('chat.error') || 'Erro',
            text2: error.message || (t('chat.errorMessage') || 'Erro ao transcrever áudio'),
          });
        } finally {
          setTranscribing(false);
        }

        // Limpar arquivo temporário
        try {
          if (uri && typeof uri === 'string' && (uri.startsWith('file://') || uri.startsWith('content://'))) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        } catch (deleteError) {
          console.warn('Erro ao deletar arquivo temporário:', deleteError);
        }
      }
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao parar a gravação',
      });
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || !user || loading) return;

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
      // Contar apenas mensagens não deletadas
      const nonDeletedCount = snapshot.docs.filter(doc => doc.data().deleted !== true).length;
      if (nonDeletedCount >= 5) {
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
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!messageText) {
      setInputText('');
    }
    setLoading(true);

    try {
      // Salvar mensagem do utilizador e obter o ID real
      const userMessageRef = await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        role: 'user',
        content: userMessage.content,
        createdAt: Timestamp.now(),
      });

      // Atualizar mensagem local com o ID real do Firestore
      const userMessageWithId: Message = {
        ...userMessage,
        id: userMessageRef.id,
      };
      setMessages((prev) => prev.map(m => m.id === userMessage.id ? userMessageWithId : m));

      // Preparar histórico de mensagens para a API
      const chatHistory: ChatMessage[] = messages
        .slice(-10) // Últimas 10 mensagens para contexto
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
        .concat([{ role: 'user', content: textToSend }]);

      // Enviar para Groq API
      const assistantContent = await sendChatMessage(chatHistory, user.uid, language);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Salvar resposta da IA e obter o ID real
      const assistantMessageRef = await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: Timestamp.now(),
      });

      // Atualizar mensagem do assistente com o ID real do Firestore
      const assistantMessageWithId: Message = {
        ...assistantMessage,
        id: assistantMessageRef.id,
      };
      setMessages((prev) => prev.map(m => m.id === assistantMessage.id ? assistantMessageWithId : m));
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      {!theme.isDark && (
        <LinearGradient
          colors={['#FFFFFF', '#F0FDF4']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {theme.isDark && (
        <LinearGradient
          colors={['#1A2E1F', theme.colors.background || '#000000']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
        />
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 24, position: 'relative', zIndex: 100 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 0,
              paddingTop: 0,
              paddingBottom: 12,
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
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  ref={optionsButtonRef}
                  onPress={() => setShowOptionsDropdown(!showOptionsDropdown)}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                
                {/* Dropdown de Opções */}
                {showOptionsDropdown && !showDeleteModal && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 40,
                      right: 0,
                      backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#FFFFFF'),
                      borderRadius: 12,
                      paddingVertical: 8,
                      minWidth: 180,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 8,
                      zIndex: 1000,
                      borderWidth: 1,
                      borderColor: theme.colors.border || '#E5E7EB',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        clearChat();
                      }}
                      disabled={clearingChat}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        opacity: clearingChat ? 0.5 : 1,
                      }}
                    >
                      {clearingChat ? (
                        <ActivityIndicator size="small" color="#EF4444" style={{ marginRight: 12 }} />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                      )}
                      <Text style={{
                        fontSize: 16,
                        color: '#EF4444',
                        fontWeight: '500',
                      }}>
                        {clearingChat ? (t('common.loading') || 'A eliminar...') : (t('chat.clearChat') || 'Limpar chat')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>

        {/* Overlay para fechar dropdown ao clicar fora */}
        {showOptionsDropdown && !showDeleteModal && (
          <Pressable
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onPress={() => setShowOptionsDropdown(false)}
            pointerEvents="box-none"
          />
        )}

        {/* Mensagens */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 30 }}
          contentContainerStyle={{ 
            paddingBottom: 100,
            flexGrow: messages.length === 0 ? 1 : 0,
          }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={messages.length > 0}
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
            <TouchableOpacity
              onLongPress={() => {
                // Só permitir eliminar mensagens do utilizador
                if (message.role === 'user') {
                  setShowOptionsDropdown(false); // Fechar dropdown se estiver aberto
                  setMessageToDelete(message);
                  setShowDeleteModal(true);
                }
              }}
              activeOpacity={message.role === 'user' ? 0.8 : 1}
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
            </TouchableOpacity>
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
          backgroundColor: 'transparent',
          paddingTop: 12,
          paddingBottom: 45,
        }}>
          {/* Sugestões de Mensagens */}
          {messages.length === 0 && !loading && (() => {
            // Obter sugestões baseadas no objetivo do utilizador
            const goal = profile?.goal || 'maintain';
            let suggestions: string[] = [];
            
            if (goal === 'lose') {
              suggestions = [
                t('chat.suggestionLose1') || 'Como posso perder peso?',
                t('chat.suggestionLose2') || 'Quais alimentos ajudam a queimar gordura?',
                t('chat.suggestionLose3') || 'Dá-me dicas para um déficit calórico',
                t('chat.suggestionLose4') || 'Receitas para perder peso',
              ];
            } else if (goal === 'gain') {
              suggestions = [
                t('chat.suggestionGain1') || 'Como posso ganhar peso?',
                t('chat.suggestionGain2') || 'Quais alimentos são ricos em calorias?',
                t('chat.suggestionGain3') || 'Dá-me dicas para ganhar massa muscular',
                t('chat.suggestionGain4') || 'Receitas para ganhar peso',
              ];
            } else {
              // maintain ou sem objetivo definido
              suggestions = [
                t('chat.suggestionMaintain1') || 'Como manter o meu peso?',
                t('chat.suggestionMaintain2') || 'Quais são os melhores alimentos para manutenção?',
                t('chat.suggestionMaintain3') || 'Dá-me dicas para uma dieta equilibrada',
                t('chat.suggestionMaintain4') || 'Receitas saudáveis',
              ];
            }
            
            return (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'flex-end' }}>
                {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    handleSendMessage(suggestion);
                  }}
                  style={{
                    backgroundColor: (theme.colors.card || (theme.isDark ? '#1F2937' : '#F3F4F6')) + '80',
                    borderRadius: 24,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: (theme.colors.border || '#E5E7EB') + 'CC',
                    opacity: 0.75,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    fontSize: 14,
                    color: theme.colors.text,
                    fontWeight: '500',
                  }}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {audioRecorder.isRecording ? (
              // Visualização de waveform durante gravação
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#F3F4F6'),
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: theme.colors.border || '#E5E7EB',
                gap: 8,
              }}>
                {/* Indicador de gravação */}
                <View style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                  {/* Ponto pulsante */}
                  <Animated.View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#EF4444',
                    opacity: pulseAnim,
                  }} />
                  
                  {/* Texto "Gravando..." */}
                  <Text style={{
                    fontSize: 14,
                    color: theme.colors.textSecondary || '#9CA3AF',
                    fontWeight: '500',
                  }}>
                    {t('chat.recording') || 'Gravando...'}
                  </Text>
                </View>

                {/* Timer */}
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary || '#9CA3AF',
                  fontWeight: '500',
                  minWidth: 40,
                  textAlign: 'right',
                }}>
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')} / 0:30
                </Text>
              </View>
            ) : (
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
                editable={!loading && !transcribing}
              />
            )}
            
            {/* Botão de gravação de áudio ou enviar mensagem */}
            {inputText.trim() ? (
              // Botão de enviar quando há texto
              <TouchableOpacity
                onPress={() => handleSendMessage()}
                disabled={loading || transcribing}
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: (!loading && !transcribing)
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
            ) : (
              // Botão de gravação de áudio quando não há texto
              <TouchableOpacity
                onPressIn={() => {
                  if (!audioRecorder.isRecording) {
                    startRecording();
                  }
                }}
                onPressOut={() => {
                  if (audioRecorder.isRecording) {
                    stopRecording();
                  }
                }}
                disabled={loading || transcribing}
                activeOpacity={0.7}
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: audioRecorder.isRecording
                    ? '#EF4444'
                    : (theme.isDark ? '#374151' : '#D1D5DB'),
                }}
              >
                {transcribing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons 
                    name="mic" 
                    size={20} 
                    color="#FFFFFF" 
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>

      {/* Modal de Eliminar Mensagem */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setMessageToDelete(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
          onPress={() => {
            setShowDeleteModal(false);
            setMessageToDelete(null);
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#FFFFFF'),
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Título */}
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              marginBottom: 12,
              textAlign: 'center',
            }}>
              {t('chat.deleteMessage') || 'Eliminar mensagem'}
            </Text>

            {/* Mensagem de confirmação */}
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#6B7280',
              marginBottom: 24,
              textAlign: 'center',
              lineHeight: 20,
            }}>
              {t('chat.deleteMessageConfirm') || 'Tens a certeza que queres eliminar esta mensagem?'}
            </Text>

            {/* Botões */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  setMessageToDelete(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: theme.colors.border || '#E5E7EB',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  {t('chat.cancel') || 'Cancelar'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  if (!messageToDelete) return;
                  
                  try {
                    // Marcar como deletada em vez de eliminar o documento
                    await updateDoc(doc(db, 'messages', messageToDelete.id), {
                      userId: user.uid, // Incluir userId para garantir que não é alterado
                      deleted: true,
                    });
                    
                    // Se for uma mensagem do utilizador, também eliminar a resposta do bot (se existir)
                    if (messageToDelete.role === 'user') {
                      // Encontrar o índice da mensagem na lista
                      const messageIndex = messages.findIndex(m => m.id === messageToDelete.id);
                      
                      // Verificar se a próxima mensagem é do assistente
                      if (messageIndex !== -1 && messageIndex < messages.length - 1) {
                        const nextMessage = messages[messageIndex + 1];
                        if (nextMessage.role === 'assistant') {
                          // Marcar também a resposta do bot como deletada
                          await updateDoc(doc(db, 'messages', nextMessage.id), {
                            userId: user.uid, // Incluir userId para garantir que não é alterado
                            deleted: true,
                          });
                        }
                      }
                    }
                    
                    // Atualizar lista local - remover ambas as mensagens se aplicável
                    setMessages(prev => {
                      const filtered = prev.filter(m => m.id !== messageToDelete.id);
                      // Se era mensagem do user, remover também a próxima se for do assistente
                      if (messageToDelete.role === 'user') {
                        const messageIndex = prev.findIndex(m => m.id === messageToDelete.id);
                        if (messageIndex !== -1 && messageIndex < prev.length - 1) {
                          const nextMessage = prev[messageIndex + 1];
                          if (nextMessage.role === 'assistant') {
                            return filtered.filter(m => m.id !== nextMessage.id);
                          }
                        }
                      }
                      return filtered;
                    });
                    
                    setShowDeleteModal(false);
                    setMessageToDelete(null);
                    Toast.show({
                      type: 'success',
                      text1: t('chat.messageDeleted') || 'Mensagem eliminada',
                      text2: t('chat.messageDeletedMessage') || 'A mensagem foi eliminada com sucesso',
                    });
                  } catch (error: any) {
                    console.error('Error deleting message:', error);
                    Toast.show({
                      type: 'error',
                      text1: t('chat.error') || 'Erro',
                      text2: t('chat.errorDeletingMessage') || 'Erro ao eliminar mensagem',
                    });
                  }
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#FFFFFF',
                }}>
                  {t('chat.delete') || 'Eliminar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

