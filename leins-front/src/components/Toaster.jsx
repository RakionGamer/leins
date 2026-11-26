import React from 'react';
import { Toaster as RHTToaster, toast as rhtToast, resolveValue } from 'react-hot-toast';
import { isValidElement } from 'react';
import JeitoSmile from './JeitoSmile';

const TYPE_CONFIG = {
   success: {
      defaultTitle: '¡Listo!',
      eyeColor: '#3B82F6',
   },
   error: {
      defaultTitle: 'Algo salió mal',
      eyeColor: '#F05A5E',
   },
   loading: {
      defaultTitle: 'Procesando...',
      eyeColor: '#3B82F6',
   },
   blank: {
      defaultTitle: 'Aviso',
      eyeColor: '#3B82F6',
   },
   custom: {
      defaultTitle: 'Aviso',
      eyeColor: '#3B82F6',
   },
};

function parseToastContent(rawMessage, toastObj) {
   if (isValidElement(rawMessage)) {
      return { title: null, body: rawMessage };
   }

   const text = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '');

   // Si viene con formato "Título — Mensaje" (legacy o explícito)
   const dashIdx = text.indexOf(' — ');
   if (dashIdx > 0 && dashIdx < 60) {
      return {
         title: text.slice(0, dashIdx).trim(),
         body: text.slice(dashIdx + 3).trim(),
      };
   }

   const cfg = TYPE_CONFIG[toastObj?.type] || TYPE_CONFIG.blank;
   if (toastObj?.icon === '⚠️') {
      return { title: 'Atención', body: text };
   }
   if (toastObj?.icon === 'ℹ️') {
      return { title: 'Información', body: text };
   }

   return {
      title: cfg.defaultTitle,
      body: text,
   };
}

function JeitoToastCard({ t }) {
   const resolved = resolveValue(t.message, t);
   const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.blank;
   const eyeColor =
      t.type === 'error'
         ? '#F05A5E'
         : t.icon === '⚠️'
         ? '#F5B041'
         : cfg.eyeColor;

   const { title, body } = parseToastContent(resolved, t);

   return (
      <div
         className={`pointer-events-auto flex items-center gap-4 bg-[#0A1A3F] dark:bg-[#0D1F4B] border border-[#19316C] text-white rounded-[22px] px-5 py-4 shadow-[0_20px_45px_-12px_rgba(7,17,40,0.55)] max-w-[440px] w-full sm:w-auto min-w-[300px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            t.visible
               ? 'opacity-100 translate-y-0 scale-100'
               : 'opacity-0 -translate-y-2 scale-95'
         }`}
         role="status"
         aria-live="polite"
      >
         {/* JeitoSmile con guiño de ojo al aparecer */}
         <div className="shrink-0 flex items-center justify-center">
            <JeitoSmile
               className="w-10 h-10"
               mouthColor="#FFFFFF"
               eyeColor={eyeColor}
               winkOnMount={t.type !== 'loading'}
            />
         </div>

         {/* Contenido */}
         <div className="flex-1 min-w-0">
            {title && (
               <p className="font-nunito font-black text-[15px] leading-snug text-white">
                  {title}
               </p>
            )}
            <div className="text-[13px] leading-snug text-[#9FB0D1] mt-0.5 break-words">
               {body}
            </div>
         </div>

         {/* Botón cerrar */}
         <button
            type="button"
            onClick={() => rhtToast.dismiss(t.id)}
            aria-label="Cerrar alerta"
            className="shrink-0 p-1.5 -mr-1 rounded-lg text-[#7E93BE] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
         >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <line x1="18" y1="6" x2="6" y2="18" />
               <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
         </button>
      </div>
   );
}

// ---- Wrapper compatible ----
export function toast(arg, opts) {
   // Nueva API: string/ReactNode + options
   if (typeof arg === 'string' || isValidElement(arg)) {
      return rhtToast(arg, opts);
   }

   // API vieja: objeto { type, title, message, ms }
   if (arg && typeof arg === 'object') {
      const {
         type = 'info',
         title = '',
         message = '',
         ms,
         icon,
      } = arg;

      const text =
         title && message ? `${title} — ${message}` :
            title || message || '';

      const options = { duration: ms || 3800 };
      if (icon) options.icon = icon;

      if (type === 'success') return rhtToast.success(text, options);
      if (type === 'error') return rhtToast.error(text, options);
      if (type === 'warning') return rhtToast(text, { ...options, icon: '⚠️' });
      return rhtToast(text, options);
   }

   // fallback
   return rhtToast(String(arg ?? ''));
}

// Métodos directos en el wrapper para compatibilidad completa
toast.success = rhtToast.success;
toast.error = rhtToast.error;
toast.loading = rhtToast.loading;
toast.dismiss = rhtToast.dismiss;
toast.promise = rhtToast.promise;
toast.custom = rhtToast.custom;
toast.info = (msg, opts) => rhtToast(msg, { ...opts, icon: 'ℹ️' });
toast.warning = (msg, opts) => rhtToast(msg, { ...opts, icon: '⚠️' });

// ---- Toaster visual ----
export default function Toaster() {
   return (
      <RHTToaster
         position="top-right"
         gutter={10}
         toastOptions={{
            duration: 3800,
         }}
      >
         {(t) => <JeitoToastCard t={t} />}
      </RHTToaster>
   );
}
