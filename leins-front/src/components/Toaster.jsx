import { Toaster as RHTToaster, toast as rhtToast } from 'react-hot-toast';
import { isValidElement } from 'react';

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

      const options = { duration: ms || 3500 };
      if (icon) options.icon = icon;

      if (type === 'success') return rhtToast.success(text, options);
      if (type === 'error') return rhtToast.error(text, options);
      if (type === 'warning') return rhtToast(text, { ...options, icon: '⚠️' });
      return rhtToast(text, options);
   }

   // fallback
   return rhtToast(String(arg ?? ''));
}

// 👇👇 AGREGA ESTAS LÍNEAS AQUÍ 👇👇
// Esto "pega" los métodos originales a tu función wrapper
toast.success = rhtToast.success;
toast.error = rhtToast.error;
toast.loading = rhtToast.loading;
toast.dismiss = rhtToast.dismiss;
toast.promise = rhtToast.promise;
toast.custom = rhtToast.custom;
// 👆👆 FIN DE LAS LÍNEAS NUEVAS 👆👆


// ---- Toaster visual ----
export default function Toaster() {
   return (
      <RHTToaster
         position="top-right"
         toastOptions={{
            duration: 3500,
            className:
               'rounded-2xl shadow-soft ring-1 ring-border-subtle/60 bg-bg-content text-text-main',
            success: {
               className:
                  'rounded-2xl shadow-soft ring-1 ring-success/30 bg-success-bg text-success',
            },
            error: {
               className:
                  'rounded-2xl shadow-soft ring-1 ring-danger/30 bg-danger-bg text-danger',
            },
            loading: {
               className:
                  'rounded-2xl shadow-soft ring-1 ring-info/30 bg-info-bg text-info',
            },
         }}
      />
   );
}