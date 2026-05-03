/**
 * ChatScreen
 * 
 * Tela de chat com IA usando Groq API
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sendChatMessage, ChatMessage, transcribeAudio, getUserChatContext, UserChatContext, addMealFromChat, addExerciseFromChat, parseMealSuggestion, parseExerciseSuggestion, cleanResponseForDisplay, ParsedMealSuggestion, ParsedExerciseSuggestion } from '../services/api';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updateStreak } from '../utils/streakUtils';
import Toast from 'react-native-toast-message';
import { MotiView } from 'moti';
import { useAudioRecorder, requestRecordingPermissionsAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  deleted?: boolean;
  mealSuggestion?: ParsedMealSuggestion;
  exerciseSuggestion?: ParsedExerciseSuggestion;
}

export function ChatScreen({ navigation }: any) {
  const { user, profile, refreshProfile } = useUser();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Verificar se o utilizador tem plano premium
  const isPremium = profile?.plan === 'premium';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [userContext, setUserContext] = useState<UserChatContext | null>(null);
  const optionsButtonRef = useRef<TouchableOpacity>(null);
  const [optionsButtonLayout, setOptionsButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  // Gerar sugestões apenas uma vez quando o componente monta ou quando o objetivo muda
  const suggestions = useMemo(() => {
    const goal = profile?.goal || 'maintain';
    let mealSuggestions: string[] = [];
    let workoutSuggestions: string[] = [];
    
    if (goal === 'lose') {
      mealSuggestions = [
        t('chat.suggestionLose1') || 'How can I lose weight?',
        t('chat.suggestionLose2') || 'Which foods help burn fat?',
        t('chat.suggestionLose3') || 'Give me tips for a calorie deficit',
        t('chat.suggestionLose4') || 'Recipes for losing weight',
      ];
      workoutSuggestions = [
        t('chat.workoutSuggestionLose1') || 'Which workouts help burn fat?',
        t('chat.workoutSuggestionLose2') || 'Suggest a workout to lose weight',
        t('chat.workoutSuggestionLose3') || 'What exercises are best for weight loss?',
        t('chat.workoutSuggestionLose4') || 'Give me a workout plan to burn calories',
      ];
    } else if (goal === 'gain') {
      mealSuggestions = [
        t('chat.suggestionGain1') || 'How can I gain weight?',
        t('chat.suggestionGain2') || 'Which foods are high in calories?',
        t('chat.suggestionGain3') || 'Give me tips to gain muscle mass',
        t('chat.suggestionGain4') || 'Recipes to gain weight',
      ];
      workoutSuggestions = [
        t('chat.workoutSuggestionGain1') || 'Which workouts help gain muscle mass?',
        t('chat.workoutSuggestionGain2') || 'Suggest a workout for hypertrophy',
        t('chat.workoutSuggestionGain3') || 'What exercises are best for gaining muscle mass?',
        t('chat.workoutSuggestionGain4') || 'Give me a workout plan to gain muscle mass',
      ];
    } else {
      // maintain ou sem objetivo definido
      mealSuggestions = [
        t('chat.suggestionMaintain1') || 'How can I maintain my weight?',
        t('chat.suggestionMaintain2') || 'What are the best foods for maintenance?',
        t('chat.suggestionMaintain3') || 'Give me tips for a balanced diet',
        t('chat.suggestionMaintain4') || 'Healthy recipes',
      ];
      workoutSuggestions = [
        t('chat.workoutSuggestionMaintain1') || 'Which workouts are best for maintenance?',
        t('chat.workoutSuggestionMaintain2') || 'Suggest a balanced workout',
        t('chat.workoutSuggestionMaintain3') || 'What exercises help maintain fitness?',
        t('chat.workoutSuggestionMaintain4') || 'Give me a workout plan for maintenance',
      ];
    }
    
    // Combinar todas as sugestões
    const allSuggestions = [...mealSuggestions, ...workoutSuggestions];
    
    // Selecionar aleatoriamente 4 sugestões
    const shuffled = [...allSuggestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, [profile?.goal, t]);
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
      loadUserContext();
    }
    
    // Limpar gravação ao desmontar
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      // Limpar gravação de forma segura
      try {
        if (audioRecorder && typeof audioRecorder.isRecording !== 'undefined' && audioRecorder.isRecording) {
          audioRecorder.stop().catch(() => {
            // Ignorar erros ao parar durante cleanup
          });
        }
      } catch (error) {
        // Ignorar erros se o recorder já foi liberado
      }
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Animar ponto pulsante durante gravação
  useEffect(() => {
    const isRecording = audioRecorder && typeof audioRecorder.isRecording !== 'undefined' && audioRecorder.isRecording;
    
    if (isRecording) {
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
  }, [audioRecorder?.isRecording, pulseAnim]);

  // Animar pontos de "digitando" quando o bot está a responder
  useEffect(() => {
    if (loading) {
      // Criar animação sequencial para os 3 pontos
      const createDotAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createDotAnimation(dot1Anim, 0);
      const anim2 = createDotAnimation(dot2Anim, 200);
      const anim3 = createDotAnimation(dot3Anim, 400);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        dot1Anim.setValue(0.3);
        dot2Anim.setValue(0.3);
        dot3Anim.setValue(0.3);
      };
    } else {
      dot1Anim.setValue(0.3);
      dot2Anim.setValue(0.3);
      dot3Anim.setValue(0.3);
    }
  }, [loading, dot1Anim, dot2Anim, dot3Anim]);

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
        
        // Parsear sugestões se for mensagem do assistente
        const content = data.content || '';
        const mealSuggestion = data.role === 'assistant' ? parseMealSuggestion(content) : undefined;
        const exerciseSuggestion = data.role === 'assistant' ? parseExerciseSuggestion(content) : undefined;
        const displayContent = data.role === 'assistant' ? cleanResponseForDisplay(content) : content;
        
        messagesData.push({
          id: doc.id,
          role: data.role,
          content: displayContent,
          timestamp: data.createdAt?.toDate() || new Date(),
          deleted: data.deleted || false,
          mealSuggestion,
          exerciseSuggestion,
        });
      });

      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadUserContext = async () => {
    if (!user) return;
    
    try {
      const context = await getUserChatContext(user.uid);
      setUserContext(context);
    } catch (error) {
      console.error('Error loading user context:', error);
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
        text1: t('chat.error') || 'Error',
        text2: 'User not authenticated',
      });
      return;
    }

    if (messages.length === 0) {
      Toast.show({
        type: 'info',
        text1: t('chat.chatCleared') || 'Chat cleared',
        text2: 'There are no messages to delete',
      });
      setShowOptionsDropdown(false);
      return;
    }

    try {
      setClearingChat(true);
      
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
        text1: t('chat.chatCleared') || 'Chat cleared',
        text2: t('chat.chatClearedMessage') || 'All messages have been deleted',
      });
    } catch (error: any) {
      console.error('Error clearing chat:', error);
      Toast.show({
        type: 'error',
        text1: t('chat.error') || 'Error',
        text2: error.message || t('chat.errorClearingChat') || 'Error clearing chat',
      });
    } finally {
      setClearingChat(false);
    }
  };

  const startRecording = async () => {
    try {
      // Verificar se o recorder é válido
      if (!audioRecorder || typeof audioRecorder.isRecording === 'undefined') {
        return;
      }

      // Verificar se já está gravando
      if (audioRecorder.isRecording) {
        return;
      }

      // Solicitar permissão
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: 'error',
          text1: 'Permission required',
          text2: 'Permission to record audio is needed.',
        });
        return;
      }

      // Resetar duração
      setRecordingDuration(0);

      // Preparar recorder e iniciar gravação em paralelo para ser mais rápido
      const preparePromise = audioRecorder.prepareToRecordAsync?.().catch(() => {
        // Ignorar erro se já estiver preparado
      });
      
      // Iniciar gravação imediatamente (não esperar pela preparação)
      try {
        const recordResult: any = audioRecorder.record();
        const recordPromise = recordResult && typeof recordResult.then === 'function' 
          ? recordResult 
          : Promise.resolve(recordResult);
        
        // Aguardar ambas as operações em paralelo
        await Promise.all([preparePromise, recordPromise].filter(Boolean));
      } catch (recordError: any) {
        console.warn('Error starting recording:', recordError);
        throw recordError;
      }
      
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
              text1: 'Error',
              text2: 'Unable to start recording. Please try again.',
            });
            return;
          }
        } catch (retryError) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Unable to start recording. Please try again.',
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
        text1: 'Error',
        text2: error.message || 'Unable to start recording. Please restart the app.',
      });
    }
  };

  const stopRecording = async () => {
    // Verificar se o recorder é válido
    if (!audioRecorder || typeof audioRecorder.isRecording === 'undefined') {
      // Limpar timer mesmo se o recorder não for válido
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingDuration(0);
      return;
    }

    if (!audioRecorder.isRecording) {
      // Limpar timer se não estiver gravando
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      return;
    }

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
            text1: t('chat.recordingTooShort') || 'Very short recording',
            text2: t('chat.recordingTooShortMessage') || 'Please record at least 3 seconds',
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
              text1: t('chat.noSpeechDetected') || 'No speech detected',
              text2: t('chat.noSpeechDetectedMessage') || 'Please speak into the microphone',
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
              text1: t('chat.audioNotRecognized') || 'Audio not recognized',
              text2: t('chat.audioNotRecognizedMessage') || 'Please try to speak more clearly',
            });
          }
        } catch (error: any) {
          Toast.show({
            type: 'error',
            text1: t('chat.error') || 'Error',
            text2: error.message || (t('chat.errorMessage') || 'Error transcribing audio'),
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
          console.warn('Error deleting temporary file:', deleteError);
        }
      }
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Error stopping recording',
      });
    }
  };

  // Função para verificar e atualizar rate limit (5 chamadas por minuto)
  const checkRateLimit = async (): Promise<boolean> => {
    try {
      const RATE_LIMIT_KEY = `chat_rate_limit_${user?.uid}`;
      const RATE_LIMIT_COUNT = 5; // 5 chamadas
      const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto em milissegundos

      const storedData = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      const now = Date.now();
      
      if (!storedData) {
        // Primeira chamada - criar novo registro
        await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify([now]));
        return true;
      }

      const timestamps: number[] = JSON.parse(storedData);
      
      // Remover timestamps antigos (fora da janela de 1 minuto)
      const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
      
      if (recentTimestamps.length >= RATE_LIMIT_COUNT) {
        // Limite atingido
        const oldestTimestamp = Math.min(...recentTimestamps);
        const waitTime = Math.ceil((RATE_LIMIT_WINDOW - (now - oldestTimestamp)) / 1000);
        return false;
      }

      // Adicionar novo timestamp
      recentTimestamps.push(now);
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recentTimestamps));
      return true;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Em caso de erro, permitir a chamada (fail open)
      return true;
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || !user || loading) return;

    // Verificar se é premium
    if (profile?.plan !== 'premium') {
      Toast.show({
        type: 'info',
        text1: t('chat.premiumRequired') || 'Premium Required',
        text2: t('chat.premiumRequiredMessage') || 'Chat is available for Premium users only. Upgrade to Premium to access the chat!',
      });
      // Opcional: navegar para a screen de Premium
      // navigation.navigate('Premium');
      return;
    }

    // Verificar rate limit (5 chamadas por minuto)
    const canSend = await checkRateLimit();
    if (!canSend) {
      Toast.show({
        type: 'info',
        text1: t('chat.rateLimitReached') || 'Message limit reached',
        text2: t('chat.rateLimitMessage') || 'Please wait a moment before sending another message. Limit: 5 messages per minute.',
      });
      return;
    }

    // Contar apenas caracteres (sem espaços)
    const textWithoutSpaces = textToSend.replace(/\s/g, '');
    
    // Verificar comprimento mínimo (10 caracteres, sem contar espaços)
    if (textWithoutSpaces.length < 10) {
      Toast.show({
        type: 'info',
        text1: t('chat.messageTooShort') || 'Message too short',
        text2: t('chat.messageTooShortMessage') || 'Please write at least 10 characters',
      });
      return;
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

      // Atualizar contexto antes de enviar (para ter dados atualizados)
      const updatedContext = await getUserChatContext(user.uid);
      setUserContext(updatedContext);

      // Enviar para Groq API com contexto do utilizador
      const assistantContentRaw = await sendChatMessage(chatHistory, user.uid, language, updatedContext);

      // Parsear sugestões da resposta
      const mealSuggestion = parseMealSuggestion(assistantContentRaw);
      const exerciseSuggestion = parseExerciseSuggestion(assistantContentRaw);
      
      // Limpar resposta para exibição (remover blocos JSON)
      let assistantContent = cleanResponseForDisplay(assistantContentRaw);
      
      // Se houver uma sugestão de refeição, adicionar os alimentos à mensagem
      if (mealSuggestion && mealSuggestion.foods && mealSuggestion.foods.length > 0) {
        const mealNameInBold = `**${mealSuggestion.name}**`;
        
        // Verificar se o nome já está no conteúdo
        const nameInContent = assistantContent.toLowerCase().includes(mealSuggestion.name.toLowerCase());
        if (!nameInContent) {
          assistantContent = `${mealNameInBold}\n\n${assistantContent}`;
        }
        
        // Adicionar lista de alimentos da refeição
        const foodsList = mealSuggestion.foods.map(food => {
          const calories = food.caloriesPer100g ? Math.round(food.caloriesPer100g) : '';
          const weight = food.weight ? Math.round(food.weight) : '';
          return `• **${food.name}**${weight ? ` - ${weight}g` : ''}${calories ? ` (${calories} kcal/100g)` : ''}`;
        }).join('\n');
        
        // Verificar se os alimentos já estão listados no conteúdo
        const firstFoodName = mealSuggestion.foods[0]?.name || '';
        const foodsAlreadyListed = firstFoodName && assistantContent.toLowerCase().includes(firstFoodName.toLowerCase());
        
        if (!foodsAlreadyListed && foodsList) {
          assistantContent = `${assistantContent}\n\n**Foods for this meal:**\n${foodsList}`;
        }
      }
      
      // Se houver uma sugestão de treino e o nome não estiver no conteúdo, adicionar no início
      if (exerciseSuggestion && exerciseSuggestion.name) {
        const exerciseNameInBold = `**${exerciseSuggestion.name}**`;
        // Verificar se o nome já está no conteúdo
        const nameInContent = assistantContent.toLowerCase().includes(exerciseSuggestion.name.toLowerCase());
        if (!nameInContent) {
          assistantContent = `${exerciseNameInBold}\n\n${assistantContent}`;
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        mealSuggestion,
        exerciseSuggestion,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Salvar resposta da IA completa (com blocos JSON) e obter o ID real
      const assistantMessageRef = await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        role: 'assistant',
        content: assistantContentRaw, // Salvar conteúdo completo para poder parsear depois
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
        text1: 'Error',
        text2: error.message || 'Error communicating with the server',
      });

      // Adicionar mensagem de erro
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar skeleton de chat (bolhas de mensagens)
  const renderSkeletonContent = () => {
    const textSkeletonColor = theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    const timestampSkeletonColor = theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
    
    // Cores exatas das bolhas reais
    const userBubbleColor = theme.colors.primary || '#3BB273';
    const assistantBubbleColor = theme.colors.card || (theme.isDark ? '#1F2937' : '#F3F4F6');
    
    return (
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 30 }}
        contentContainerStyle={{ 
          paddingBottom: 100,
        }}
        scrollEnabled={false}
      >
        {/* Bolhas de mensagens skeleton - padrão alternado igual ao chat real */}
        {[
          { role: 'user', width: '70%', lines: [100, 85] },
          { role: 'assistant', width: '75%', lines: [100, 100, 60] },
          { role: 'user', width: '65%', lines: [100] },
          { role: 'assistant', width: '80%', lines: [100, 100, 100, 75] },
          { role: 'user', width: '60%', lines: [100, 90] },
          { role: 'assistant', width: '70%', lines: [100, 95] },
        ].map((bubble, index) => (
          <View
            key={index}
            style={{
              marginBottom: 16,
              alignItems: bubble.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                maxWidth: bubble.width,
                borderRadius: 24,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: bubble.role === 'user' ? userBubbleColor : assistantBubbleColor,
              }}
            >
              {/* Linhas de texto skeleton dentro da bolha - com larguras variadas */}
              {bubble.lines.map((lineWidth, lineIndex) => (
                <View
                  key={lineIndex}
                  style={{
                    height: 14,
                    backgroundColor: bubble.role === 'user' 
                      ? 'rgba(255, 255, 255, 0.3)' 
                      : textSkeletonColor,
                    borderRadius: 4,
                    marginBottom: lineIndex < bubble.lines.length - 1 ? 6 : 0,
                    width: `${lineWidth}%`,
                  }}
                />
              ))}
              {/* Timestamp skeleton - igual ao real */}
              <View
                style={{
                  width: 40,
                  height: 11,
                  backgroundColor: bubble.role === 'user'
                    ? 'rgba(255, 255, 255, 0.5)'
                    : timestampSkeletonColor,
                  borderRadius: 4,
                  marginTop: 4,
                }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // Se não for premium, mostrar tela de bloqueio com skeleton atrás
  if (!isPremium) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
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
        {/* Skeleton da tela por trás */}
        <View style={styles.skeletonContainer}>
          {renderSkeletonContent()}
        </View>

        {/* Overlay de bloqueio */}
        <View style={[StyleSheet.absoluteFill, styles.lockOverlay]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.lockBackButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={theme.colors.primary || '#3BB273'} 
            />
          </TouchableOpacity>

          <View style={styles.lockContent}>
            <View style={[
              styles.lockIconContainer,
              { backgroundColor: (theme.colors.primary || '#3BB273') + '20' },
            ]}>
              <Ionicons 
                name="lock-closed" 
                size={64} 
                color={theme.colors.primary || '#3BB273'} 
              />
            </View>

            <Text style={[styles.lockTitle, { color: '#FFFFFF' }]}>
              {t('chat.premiumRequired') || 'Premium Required'}
            </Text>
            <Text style={[styles.lockDescription, { color: theme.isDark ? (theme.colors.textSecondary || '#6B7280') : '#6B7280' }]}>
              {t('chat.premiumRequiredDescription') || 'This feature is available only for Premium users. Upgrade to unlock chat and more features.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.lockUpgradeButton,
                { backgroundColor: theme.colors.primary || '#3BB273' },
              ]}
              onPress={() => navigation.navigate('PremiumOnboarding')}
              activeOpacity={0.8}
            >
              <Text style={styles.lockUpgradeButtonText}>
                {t('premium.upgradeButton') || 'Upgrade to Premium'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
            position: 'relative',
            zIndex: 100,
            minHeight: 56,
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
                zIndex: 1001,
                position: 'absolute',
                left: 24,
              }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
            <Text style={{
                fontSize: 28,
              fontWeight: '700',
              color: theme.colors.text,
                textAlign: 'center',
                lineHeight: 40,
            }}>
              {t('chat.title')}
            </Text>
            </View>
            <View style={{ zIndex: 1001, position: 'absolute', right: 20 }}>
              <TouchableOpacity 
                ref={optionsButtonRef}
                onPress={() => setShowOptionsDropdown(!showOptionsDropdown)}
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  setOptionsButtonLayout({ x, y, width, height });
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

      {/* Modal para Dropdown de Opções */}
      <Modal
        visible={showOptionsDropdown && !showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsDropdown(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
          onPress={() => setShowOptionsDropdown(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: (optionsButtonLayout.y > 0 
                ? optionsButtonLayout.y + optionsButtonLayout.height + 2 + insets.top
                : insets.top + 100),
              right: 20,
              backgroundColor: theme.colors.card || (theme.isDark ? '#1F2937' : '#FFFFFF'),
              borderRadius: 12,
              paddingVertical: 8,
              minWidth: 140,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 8,
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
                justifyContent: 'center',
                paddingHorizontal: 8,
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
                textAlign: 'center',
            }}>
                {clearingChat ? (t('common.loading') || 'Deleting...') : (t('chat.clearChat') || 'Clear chat')}
            </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
                {(() => {
                  const textColor = message.role === 'user' ? '#FFFFFF' : theme.colors.text;
                  const content = message.content;
                  
                  // Verificar se há markdown
                  if (!content.includes('**')) {
                    return (
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                          color: textColor,
                }}
              >
                        {content}
              </Text>
                    );
                  }

                  // Processar markdown
                  const parts: React.ReactNode[] = [];
                  const regex = /\*\*(.+?)\*\*/g;
                  let lastIndex = 0;
                  let match;
                  let key = 0;

                  while ((match = regex.exec(content)) !== null) {
                    // Adicionar texto antes do match
                    if (match.index > lastIndex) {
                      const beforeText = content.substring(lastIndex, match.index);
                      if (beforeText) {
                        parts.push(
                          <Text key={`text-${key++}`} style={{ color: textColor }}>
                            {beforeText}
                          </Text>
                        );
                      }
                    }

                    // Adicionar texto em negrito
                    parts.push(
                      <Text key={`bold-${key++}`} style={{ color: textColor, fontWeight: '700' }}>
                        {match[1]}
                      </Text>
                    );

                    lastIndex = regex.lastIndex;
                  }

                  // Adicionar texto restante
                  if (lastIndex < content.length) {
                    const remainingText = content.substring(lastIndex);
                    if (remainingText) {
                      parts.push(
                        <Text key={`text-${key++}`} style={{ color: textColor }}>
                          {remainingText}
                        </Text>
                      );
                    }
                  }

                  return (
                    <Text
                      style={{
                        fontSize: 14,
                        lineHeight: 20,
                        color: textColor,
                      }}
                    >
                      {parts}
                    </Text>
                  );
                })()}
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
            
            {/* Botões de ação para sugestões */}
            {message.role === 'assistant' && (message.mealSuggestion || message.exerciseSuggestion) && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {message.mealSuggestion && (
                  <TouchableOpacity
                    onPress={() => {
                      if (!message.mealSuggestion) return;
                      
                      // Navegar para AddMealScreen com os dados pré-preenchidos
                      navigation.navigate('AddMeal', {
                        mealSuggestion: message.mealSuggestion,
                        mode: 'confirm',
                      });
                    }}
                    style={{
                      backgroundColor: '#2D8659', // Verde mais escuro e diferente do primário
                      borderRadius: 16,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="restaurant" size={20} color="#FFFFFF" />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#FFFFFF',
                    }}>
                      {t('chat.addMeal') || 'Add Meal'}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginLeft: 'auto',
                    }}>
                      {Math.round(message.mealSuggestion.calories)} kcal
                    </Text>
                  </TouchableOpacity>
                )}
                
                {message.exerciseSuggestion && (
                  <TouchableOpacity
                    onPress={() => {
                      if (!message.exerciseSuggestion) return;
                      
                      // Navegar para AddExerciseScreen com os dados pré-preenchidos
                      navigation.navigate('AddExercise', {
                        exerciseSuggestion: message.exerciseSuggestion,
                      });
                    }}
                    style={{
                      backgroundColor: '#4A90E2', // Azul para diferenciar do verde
                      borderRadius: 16,
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="fitness" size={20} color="#FFFFFF" />
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#FFFFFF',
                    }}>
                      {t('chat.addExercise') || 'Add Exercise'}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginLeft: 'auto',
                    }}>
                      {message.exerciseSuggestion.duration} min
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Animated.View 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    backgroundColor: theme.colors.primary || '#3BB273', 
                    borderRadius: 4,
                    opacity: dot1Anim,
                    transform: [{ scale: dot1Anim }],
                  }} 
                />
                <Animated.View 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    backgroundColor: theme.colors.primary || '#3BB273', 
                    borderRadius: 4,
                    opacity: dot2Anim,
                    transform: [{ scale: dot2Anim }],
                  }} 
                />
                <Animated.View 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    backgroundColor: theme.colors.primary || '#3BB273', 
                    borderRadius: 4,
                    opacity: dot3Anim,
                    transform: [{ scale: dot3Anim }],
                  }} 
                />
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
          {messages.length === 0 && !loading && (
              <View style={{ gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
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
                    alignSelf: 'flex-end',
                    maxWidth: '100%',
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
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {audioRecorder && typeof audioRecorder.isRecording !== 'undefined' && audioRecorder.isRecording ? (
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
                    {t('chat.recording') || 'Recording...'}
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
                disabled={loading || transcribing || inputText.trim().replace(/\s/g, '').length < 10}
              style={{
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                  backgroundColor: (!loading && !transcribing && inputText.trim().replace(/\s/g, '').length >= 10)
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
                  const isRecording = audioRecorder && typeof audioRecorder.isRecording !== 'undefined' && audioRecorder.isRecording;
                  if (!isRecording) {
                    startRecording();
                  }
                }}
                onPressOut={() => {
                  const isRecording = audioRecorder && typeof audioRecorder.isRecording !== 'undefined' && audioRecorder.isRecording;
                  if (isRecording) {
                    stopRecording();
                  }
                }}
                disabled={loading || transcribing}
                activeOpacity={0.7}
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: (audioRecorder && typeof audioRecorder.isRecording !== 'undefined' && audioRecorder.isRecording)
                    ? '#EF4444'
                    : (theme.colors.primary || '#3BB273'),
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
              {t('chat.deleteMessage') || 'Delete message'}
            </Text>

            {/* Mensagem de confirmação */}
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary || '#6B7280',
              marginBottom: 24,
              textAlign: 'center',
              lineHeight: 20,
            }}>
              {t('chat.deleteMessageConfirm') || 'Are you sure you want to delete this message?'}
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
                  {t('chat.cancel') || 'Cancel'}
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
                      text1: t('chat.messageDeleted') || 'Message deleted',
                      text2: t('chat.messageDeletedMessage') || 'The message was successfully deleted',
                    });
                  } catch (error: any) {
                    console.error('Error deleting message:', error);
                    Toast.show({
                      type: 'error',
                      text1: t('chat.error') || 'Error',
                      text2: t('chat.errorDeletingMessage') || 'Error deleting message',
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
                  {t('chat.delete') || 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  lockOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  lockBackButton: {
    paddingTop: 16,
    paddingBottom: 8,
    marginLeft: -8,
    zIndex: 10,
  },
  lockContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  lockIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  lockTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  lockDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  lockUpgradeButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockUpgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

