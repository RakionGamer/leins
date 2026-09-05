import { useEffect, useState } from 'react';

export default function SplashScreen({ minMs = 0, autoHide = false, label = 'Cargando...' }) {
   const [visible, setVisible] = useState(true);

   useEffect(() => {
      if (!autoHide || minMs === 0) return; // no temporizador para fallback de Suspense
      const timer = setTimeout(() => setVisible(false), minMs);
      return () => clearTimeout(timer);
   }, [autoHide, minMs]);

   return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center bg-bg-shell text-text-main transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
         {/* Logo */}
         <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center justify-center w-24 h-24 bg-brand-strong rounded-full animate-pulse">
               <span className="text-4xl font-bold">AS</span>
            </div>
            <h1 className="text-2xl font-bold text-brand animate-fade-in">
               Leins Advisor
            </h1>
         </div>

         {/* Spinner */}
         <div className="mt-8 flex items-center space-x-2 text-brand">
            <svg className="animate-spin h-6 w-6 text-brand"
               xmlns="http://www.w3.org/2000/svg"
               fill="none"
               viewBox="0 0 24 24"
            >
               <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
               ></circle>
               <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
               ></path>
            </svg>
            <span className="text-lg">{label}</span>
         </div>
      </div>
   );
}
