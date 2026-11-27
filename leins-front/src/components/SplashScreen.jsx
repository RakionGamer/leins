import { useEffect, useState } from 'react';
import JeitoSmile from './JeitoSmile';

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
         {/* Solo carita feliz Jeito limpia y animada */}
         <JeitoSmile
            className="w-16 h-16 sm:w-20 sm:h-20 text-[#0A1A3F] dark:text-white"
            mouthColor="currentColor"
            eyeColor="#1F6BFF"
            animated
            winkOnMount
         />

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
