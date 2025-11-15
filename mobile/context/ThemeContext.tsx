import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  border: string;
  card: string;
  error: string;
  success: string;
}

interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  primary: '#3BB273',
  border: '#E5E7EB',
  card: '#FFFFFF',
  error: '#EF4444',
  success: '#3BB273',
};

const darkColors: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#3BB273',
  border: '#334155',
  card: '#1E293B',
  error: '#EF4444',
  success: '#3BB273',
};

interface ThemeContextType {
  theme: Theme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    // Sempre seguir o tema do sistema
    setIsDark(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const setThemeMode = async (mode: ThemeMode) => {
    // Não fazer nada - sempre automático
  };

  const toggleTheme = () => {
    // Não fazer nada - sempre automático
  };

  const colors = isDark ? darkColors : lightColors;

  const theme: Theme = {
    mode: 'system',
    colors,
    isDark,
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

