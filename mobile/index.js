// Suprimir warning do SafeAreaView deprecated ANTES de importar qualquer coisa
// Interceptar TODOS os métodos de logging possíveis
(function() {
  'use strict';
  
  if (typeof global === 'undefined') return;
  
  // Interceptar console.warn
  const originalWarn = global.console?.warn || console.warn;
  const warn = function(...args) {
    try {
      const msg = args.length > 0 ? String(args[0]) : '';
      if (msg.includes('SafeAreaView has been deprecated') || 
          msg.includes('react-native-safe-area-context')) {
        return;
      }
    } catch (e) {}
    originalWarn.apply(console, args);
  };
  
  // Interceptar console.error também
  const originalError = global.console?.error || console.error;
  const error = function(...args) {
    try {
      const msg = args.length > 0 ? String(args[0]) : '';
      if (msg.includes('SafeAreaView has been deprecated') || 
          msg.includes('react-native-safe-area-context')) {
        return;
      }
    } catch (e) {}
    originalError.apply(console, args);
  };
  
  // Aplicar as sobrescritas
  if (global.console) {
    global.console.warn = warn;
    global.console.error = error;
  }
  if (console) {
    console.warn = warn;
    console.error = error;
  }
})();

import { LogBox } from 'react-native';

// Configurar LogBox para suprimir warnings - múltiplas tentativas
if (__DEV__) {
  // Tentar diferentes formatos de padrões
  const warningsToIgnore = [
    'SafeAreaView has been deprecated',
    'SafeAreaView has been deprecated and will be removed',
    'SafeAreaView has been deprecated and will be removed in a future release',
    /SafeAreaView.*deprecated/i,
    /SafeAreaView.*removed/i,
    /react-native-safe-area-context/i,
    /Please use 'react-native-safe-area-context'/i,
  ];
  
  LogBox.ignoreLogs(warningsToIgnore);
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

