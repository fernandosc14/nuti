/**
 * SelectedDateContext
 * 
 * Context for sharing the selected date on the dashboard.
 * Allows meals to be added for previous days
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

