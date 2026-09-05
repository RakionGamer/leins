// src/context/PeriodContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const PeriodContext = createContext(null);

export function PeriodProvider({ children }) {
   const [period, setPeriod] = useState(() => {
      const saved = localStorage.getItem('period');
      if (saved) {
         try { return JSON.parse(saved); } catch { }
      }
      const d = new Date();
      return { month: d.getMonth() + 1, year: d.getFullYear() }; // 1..12
   });

   useEffect(() => {
      localStorage.setItem('period', JSON.stringify(period));
   }, [period]);

   const value = useMemo(() => ({ period, setPeriod }), [period]);
   return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
   const ctx = useContext(PeriodContext);
   if (!ctx) throw new Error('usePeriod debe usarse dentro de <PeriodProvider>');
   return ctx;
}
