import React from 'react';
import { createPortal } from 'react-dom';

const SIZE_MAP = {
   sm: 'max-w-sm',
   md: 'max-w-md',
   lg: 'max-w-lg',
   xl: 'max-w-xl',
   '2xl': 'max-w-2xl',
   '3xl': 'max-w-3xl',
   '4xl': 'max-w-4xl',
   '5xl': 'max-w-5xl',
   '6xl': 'max-w-6xl',
   '7xl': 'max-w-7xl',
   full: 'max-w-[95vw]',
};

export default function Modal({
   isOpen,
   onClose,
   title,
   children,
   maxWidth,
   size,
   zIndex = 'z-[100]',
   hideHeader = false,
}) {
   if (!isOpen) return null;

   // Soporta tanto maxWidth="max-w-5xl" como size="5xl" o size="max-w-5xl"
   const resolvedMaxWidth =
      maxWidth ||
      (size ? (SIZE_MAP[size] || size) : 'max-w-md');

   return createPortal(
      <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs`}>
         <div className={`w-full ${resolvedMaxWidth} bg-bg-content rounded-2xl shadow-2xl border border-border-subtle overflow-hidden transition-all flex flex-col max-h-[90vh]`}>
            {!hideHeader && (
               <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-1 shrink-0">
                  <h3 className="text-lg font-semibold text-heading truncate">{title}</h3>
                  <button
                     onClick={onClose}
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-text-soft hover:text-heading hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                     aria-label="cerrar modal"
                  >
                     ✕
                  </button>
               </div>
            )}
            <div className="p-4 sm:p-5 overflow-y-auto">
               {children}
            </div>
         </div>
      </div>,
      document.body
   );
}
