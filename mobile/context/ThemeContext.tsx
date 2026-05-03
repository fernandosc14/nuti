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
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Load saved preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('theme_mode');
        if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
          setThemeModeState(savedMode as ThemeMode);
          if (savedMode === 'light') {
            setIsDark(false);
          } else if (savedMode === 'dark') {
            setIsDark(true);
          } else {
            // If it's 'system', follow the system
            setIsDark(systemColorScheme === 'dark');
          }
        } else {
          // If there's no saved preference, follow the system
          setThemeModeState('system');
          setIsDark(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
        setThemeModeState('system');
        setIsDark(systemColorScheme === 'dark');
      }
    };
    loadThemePreference();
  }, []);

  // If the mode is 'system', follow the system
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDark(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, themeMode]);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      if (mode === 'light') {
        setIsDark(false);
      } else if (mode === 'dark') {
        setIsDark(true);
      } else {
        setIsDark(systemColorScheme === 'dark');
      }
      await AsyncStorage.setItem('theme_mode', mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newMode = isDark ? 'light' : 'dark';
    await setThemeMode(newMode);
  };

  const colors = isDark ? darkColors : lightColors;

  const theme: Theme = {
    mode: themeMode,
    colors,
    isDark,
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
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

