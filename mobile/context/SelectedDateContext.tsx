/**
 * SelectedDateContext
 * 
 * Contexto para compartilhar a data selecionada no dashboard
 * Permite que refeições sejam adicionadas para dias anteriores
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedDateContextType {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
}

const SelectedDateContext = createContext<SelectedDateContextType>({
  selectedDate: null,
  setSelectedDate: () => {},
});

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  return (
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </SelectedDateContext.Provider>
  );
}

export function useSelectedDate() {
  return useContext(SelectedDateContext);
}

