const withOpacity = (variable) => ({ opacityValue } = {}) =>
   opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;

module.exports = {
   darkMode: 'class',
   content: [
      './index.html',
      './public/**/*.html',
      './src/**/*.{js,jsx,ts,tsx}',
      // Opcional: si tienes plantillas fuera de src/public, añade rutas concretas
      // './templates/**/*.{html,php}',
   ],
   theme: {
      extend: {
         colors: {
            // brand
            brand: withOpacity('--brand-rgb'),
            'brand-strong': withOpacity('--brand-strong-rgb'),
            'brand-tint': withOpacity('--brand-tint-rgb'),

            // backgrounds
            'bg-shell': withOpacity('--bg-shell-rgb'),
            'bg-content': withOpacity('--bg-content-rgb'),
            'surface-1': withOpacity('--surface-1-rgb'),
            'surface-2': withOpacity('--surface-2-rgb'),

            // text
            'text-main': withOpacity('--text-main-rgb'),
            'text-soft': withOpacity('--text-soft-rgb'),
            heading: withOpacity('--heading-rgb'),

            // borders
            'border-subtle': withOpacity('--border-subtle-rgb'),
            'border-strong': withOpacity('--border-strong-rgb'),

            // states
            info: withOpacity('--info-rgb'),
            'info-bg': withOpacity('--info-bg-rgb'),
            success: withOpacity('--success-rgb'),
            'success-bg': withOpacity('--success-bg-rgb'),
            warning: withOpacity('--warning-rgb'),
            'warning-bg': withOpacity('--warning-bg-rgb'),
            danger: withOpacity('--danger-rgb'),
            'danger-bg': withOpacity('--danger-bg-rgb'),

            // compat
            'bg-sidebar': withOpacity('--bg-sidebar-rgb'),
         },
         keyframes: {
            'fade-in': {
               '0%': { opacity: '0', transform: 'translateY(20px)' },
               '100%': { opacity: '1', transform: 'translateY(0)' },
            },
         },
         animation: {
            'fade-in': 'fade-in 0.7s ease-out',
         },
         boxShadow: {
            soft: '0 8px 24px rgba(0,0,0,0.06)',
         },
         borderRadius: {
            '2xl': '1rem',
         },
         container: {
            center: true,
            padding: {
               DEFAULT: '1rem',
               sm: '1.25rem',
               lg: '2rem',
               xl: '2rem',
               '2xl': '2.5rem',
            },
         },
      },
   },
   plugins: [require('@tailwindcss/forms')],
};