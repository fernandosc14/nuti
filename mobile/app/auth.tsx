import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import supabase from '../services/supabase';
import Input from '../components/Input';
import Button from '../components/Button';

export default function Auth() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha e-mail e senha');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // On success, navigate to dashboard
        router.replace('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Sucesso', 'Conta criada. Verifique seu e-mail se necessário.');
        // After sign up, go to onboarding to collect initial preferences.
        router.replace('/onboarding');
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold mb-6">{mode === 'login' ? 'Entrar' : 'Cadastrar'}</Text>
      <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry />

      <Button onPress={submit} style={{ width: '100%', marginTop: 8 }}>
        {loading ? 'Carregando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </Button>

      <View className="flex-row items-center justify-between w-full mt-3">
        <Button variant="ghost" onPress={() => router.back()}>
          Voltar
        </Button>
        <Button variant="secondary" onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
        </Button>
      </View>
    </View>
  );
}
