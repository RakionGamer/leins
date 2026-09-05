import React from 'react';

// agregamos la propiedad maxwidth con un valor por defecto
export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
         {/* inyectamos la clase de tailwind dinamicamente */}
         <div className={`w-full ${maxWidth} bg-bg-content rounded-2xl shadow-xl border border-border-subtle overflow-hidden transition-all`}>
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-1">
               <h3 className="text-lg font-semibold text-heading">{title}</h3>
               <button
                  onClick={onClose}
                  className="text-text-soft hover:text-heading transition-colors"
                  aria-label="cerrar modal"
               >
                  ✕
               </button>
            </div>
            <div className="p-4">
               {children}
            </div>
         </div>
      </div>
   );
}