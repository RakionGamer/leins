export default function FormInput({ label, type = 'text', value, onChange, placeholder, className = '', ...props }) {
   return (
      <div className="w-full">
         {label && (
            <label className="block mb-1 text-sm font-semibold tracking-wide text-heading">
               {label}
            </label>
         )}
         <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={[
               'w-full px-4 py-2.5 rounded-2xl transition-all duration-200',
               'border border-border-subtle',
               'bg-bg-content text-text-main placeholder-text-soft/70',
               'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
               'shadow-soft',
               // Estilos para estado deshabilitado (disabled)
               'disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:text-text-soft disabled:cursor-not-allowed',
               className
            ].join(' ')}
            {...props}
         />
      </div>
   );
}