// src/components/PrimaryButton.jsx
export default function PrimaryButton({
   children,
   className = '',
   isLoading = false,
   ...props
}) {
   return (
      <button
         className={[
            'px-4 py-2 rounded-2xl text-white',
            'bg-brand hover:bg-brand-strong transition-colors',
            'shadow-soft focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-brand',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            className,
         ].join(' ')}
         disabled={isLoading || props.disabled}
         {...props}
      >
         {isLoading ? (
            <span className="inline-flex items-center gap-2">
               <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8v4" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
               </svg>
               Cargando...
            </span>
         ) : (
            children
         )}
      </button>
   );
}