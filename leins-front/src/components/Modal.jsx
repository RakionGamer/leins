import React from 'react';
import { createPortal } from 'react-dom';

// agregamos la propiedad maxwidth con un valor por defecto
export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
   if (!isOpen) return null;

   // portal a document.body: evita que ancestros con transform/overflow recorten el overlay fixed
   return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
         {/* inyectamos la clase de tailwind dinamicamente */}
         <div className={`w-full ${maxWidth} bg-bg-content rounded-2xl shadow-xl border border-border-subtle overflow-hidden transition-all flex flex-col max-h-[90vh]`}>
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-1 shrink-0">
               <h3 className="text-lg font-semibold text-heading">{title}</h3>
               <button
                  onClick={onClose}
                  className="text-text-soft hover:text-heading transition-colors"
                  aria-label="cerrar modal"
               >
                  ✕
               </button>
            </div>
            <div className="p-4 overflow-y-auto">
               {children}
            </div>
         </div>
      </div>,
      document.body
   );
}