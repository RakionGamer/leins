import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function FormError({ message }) {
   if (!message) return null;

   return (
      <div className="mb-6 animate-fade-in flex items-start gap-3 bg-danger-bg/80 dark:bg-danger-bg/10 border border-danger/20 text-danger px-4 py-3 rounded-xl text-sm font-medium shadow-sm backdrop-blur-sm">
         <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
         <span className="leading-snug">{message}</span>
      </div>
   );
}