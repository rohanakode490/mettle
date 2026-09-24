import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeStorage } from '@/utils/storage';
import { WeightUnit } from '@/utils/weight';

interface WeightUnitContextType {
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => Promise<void>;
  toggleUnit: () => Promise<void>;
}

const STORAGE_KEY = 'mettle_weight_unit';

const WeightUnitContext = createContext<WeightUnitContextType>({
  unit: 'kg',
  setUnit: async () => {},
  toggleUnit: async () => {},
});

export const WeightUnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unit, setUnitState] = useState<WeightUnit>('kg');

  useEffect(() => {
    safeStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'kg' || saved === 'lb') {
        setUnitState(saved);
      }
    });
  }, []);

  const setUnit = async (newUnit: WeightUnit) => {
    setUnitState(newUnit);
    await safeStorage.setItem(STORAGE_KEY, newUnit);
  };

  const toggleUnit = async () => {
    const next: WeightUnit = unit === 'kg' ? 'lb' : 'kg';
    await setUnit(next);
  };

  return (
    <WeightUnitContext.Provider value={{ unit, setUnit, toggleUnit }}>
      {children}
    </WeightUnitContext.Provider>
  );
};

export const useWeightUnit = () => useContext(WeightUnitContext);
