/**
 * Units Context
 * 
 * Context API para gerenciar unidades de medida
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WeightUnit = 'kg' | 'lb';
type HeightUnit = 'cm' | 'in';

interface Units {
  weight: WeightUnit;
  height: HeightUnit;
}

interface UnitsContextType {
  units: Units;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setHeightUnit: (unit: HeightUnit) => Promise<void>;
  convertWeight: (value: number, from: WeightUnit, to: WeightUnit) => number;
  convertHeight: (value: number, from: HeightUnit, to: HeightUnit) => number;
  formatHeight: (value: number, unit: HeightUnit) => string; // Formatar altura para exibição
  parseHeight: (value: string, unit: HeightUnit) => number; // Converter string de altura para cm
}

const UnitsContext = createContext<UnitsContextType | undefined>(undefined);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useState<Units>({ weight: 'kg', height: 'cm' });

  // Carregar preferências salvas
  useEffect(() => {
    const loadUnits = async () => {
      try {
        const savedWeight = await AsyncStorage.getItem('weight_unit');
        const savedHeight = await AsyncStorage.getItem('height_unit');
        
        setUnits({
          weight: (savedWeight as WeightUnit) || 'kg',
          height: (savedHeight as HeightUnit) || 'cm',
        });
      } catch (error) {
        console.error('Error loading units:', error);
      }
    };
    loadUnits();
  }, []);

  const setWeightUnit = async (unit: WeightUnit) => {
    try {
      setUnits(prev => ({ ...prev, weight: unit }));
      await AsyncStorage.setItem('weight_unit', unit);
    } catch (error) {
      console.error('Error saving weight unit:', error);
    }
  };

  const setHeightUnit = async (unit: HeightUnit) => {
    try {
      setUnits(prev => ({ ...prev, height: unit }));
      await AsyncStorage.setItem('height_unit', unit);
    } catch (error) {
      console.error('Error saving height unit:', error);
    }
  };

  const convertWeight = (value: number, from: WeightUnit, to: WeightUnit): number => {
    if (from === to) return value;
    if (from === 'kg' && to === 'lb') return value * 2.20462;
    if (from === 'lb' && to === 'kg') return value / 2.20462;
    return value;
  };

  const convertHeight = (value: number, from: HeightUnit, to: HeightUnit): number => {
    if (from === to) return value;
    // Converter cm para inches
    if (from === 'cm' && to === 'in') return value / 2.54;
    // Converter inches para cm
    if (from === 'in' && to === 'cm') return value * 2.54;
    return value;
  };

  // Formatar altura para exibição (cm -> número, in -> ft'in")
  const formatHeight = (value: number, unit: HeightUnit): string => {
    if (unit === 'cm') {
      return Math.round(value).toString();
    } else {
      // Converter cm para inches, depois para ft'in"
      const inches = value / 2.54;
      const feet = Math.floor(inches / 12);
      const remainingInches = Math.round(inches % 12);
      return `${feet}'${remainingInches}"`;
    }
  };

  // Converter string de altura para cm (aceita cm, ft'in", ou apenas inches)
  const parseHeight = (value: string, unit: HeightUnit): number => {
    if (unit === 'cm') {
      const num = parseFloat(value.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    } else {
      // Tentar parsear formato ft'in" ou apenas inches
      const cleanText = value.replace(/[^0-9'"]/g, '');
      const match = cleanText.match(/(\d+)'(\d+)/);
      if (match) {
        const feet = parseInt(match[1]) || 0;
        const inches = parseInt(match[2]) || 0;
        const totalInches = feet * 12 + inches;
        return totalInches * 2.54; // Converter para cm
      } else {
        // Se não for formato ft'in", assumir que são apenas inches
        const inches = parseFloat(cleanText.replace(/[^0-9.]/g, ''));
        return isNaN(inches) ? 0 : inches * 2.54; // Converter para cm
      }
    }
  };

  return (
    <UnitsContext.Provider value={{ 
      units, 
      setWeightUnit, 
      setHeightUnit, 
      convertWeight, 
      convertHeight,
      formatHeight,
      parseHeight,
    }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error('useUnits must be used within UnitsProvider');
  }
  return context;
}

