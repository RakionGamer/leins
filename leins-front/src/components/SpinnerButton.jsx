// src/components/SpinnerButton.jsx
export default function SpinnerButton({ loading, children, className = '', ...props }) {
   return (
      <button
         disabled={loading || props.disabled}
         className={[
            'w-full text-white py-2 rounded-2xl shadow-soft',
            'bg-brand hover:bg-brand-strong transition-colors',
            'flex justify-center items-center gap-2',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg-content',
            className,
         ].join(' ')}
         {...props}
      >
         {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
         )}
         {children}
      </button>
   );
}