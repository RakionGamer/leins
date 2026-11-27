import { useEffect, useState } from 'react';
import JeitoSmile from './JeitoSmile';
import JeitoLogo from './JeitoLogo';

export default function SplashScreen({
   minMs = 0,
   autoHide = false,
   label = 'Cargando...',
   fullScreen = true,
}) {
   const [visible, setVisible] = useState(true);

   useEffect(() => {
      if (!autoHide || minMs === 0) return;
      const timer = setTimeout(() => setVisible(false), minMs);
      return () => clearTimeout(timer);
   }, [autoHide, minMs]);

   // Remueve "..." final para renderizar los 3 puntos flotantes animados
   const cleanLabel = String(label || 'Cargando').replace(/\.{2,}$/, '').trim();

   const containerClass = fullScreen
      ? `fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F5F8FF] dark:bg-[#071128] text-[#0A1A3F] dark:text-white transition-opacity duration-500 ${
           visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`
      : `w-full min-h-[62vh] flex flex-col items-center justify-center text-[#0A1A3F] dark:text-white transition-opacity duration-300 ${
           visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`;

   return (
      <div className={containerClass} role="status" aria-live="polite">
         <div className="flex flex-col items-center gap-4">
            {/* Carita Jeito en squircle */}
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#0C1A38] border border-[#E2EAFD] dark:border-[#182B52] shadow-sm flex items-center justify-center">
               <JeitoSmile
                  className="w-10 h-10 text-[#0A1A3F] dark:text-white"
                  mouthColor="currentColor"
                  eyeColor="#1F6BFF"
                  winkOnMount
               />
            </div>

            {/* Logo oficial Jeito */}
            <JeitoLogo
               className="w-24 h-auto text-[#0A1A3F] dark:text-white"
               dotColor="#1F6BFF"
               textColor="currentColor"
            />
         </div>

         {/* Texto + 3 puntos suspensivos flotantes 1 por 1 */}
         <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-[#55607A] dark:text-[#8DA2CC] font-nunito tracking-tight">
               {cleanLabel}
            </span>
            <span className="inline-flex items-center gap-1" aria-hidden="true">
               <span
                  className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] jeito-dot-float"
                  style={{ animationDelay: '0ms' }}
               />
               <span
                  className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] jeito-dot-float"
                  style={{ animationDelay: '160ms' }}
               />
               <span
                  className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] jeito-dot-float"
                  style={{ animationDelay: '320ms' }}
               />
            </span>
         </div>
      </div>
   );
}
