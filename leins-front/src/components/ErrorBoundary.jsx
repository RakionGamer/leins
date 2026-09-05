import { Component } from 'react';

export default class ErrorBoundary extends Component {
   constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
   }

   static getDerivedStateFromError(error) {
      // Actualiza el estado para que el siguiente renderizado muestre la UI alternativa
      return { hasError: true, error };
   }

   componentDidCatch(error, info) {
      // Puedes registrar el error en un servicio de reportes
      console.error('🔴 Error capturado por Boundary:', error, info);
   }

   handleReload = () => {
      window.location.reload();
   };

   render() {
      if (this.state.hasError) {
         // Verificamos si estamos en desarrollo para decidir qué mostrar
         const isDev = import.meta.env.DEV;

         return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-fade-in">
               <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
                  {/* Icono de advertencia */}
                  <svg
                     xmlns="http://www.w3.org/2000/svg"
                     className="h-10 w-10 text-red-500"
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
               </div>

               <h2 className="text-2xl font-bold text-heading dark:text-white mb-2">
                  Ups, algo salió mal
               </h2>

               <p className="text-text-soft mb-6 max-w-md">
                  Ha ocurrido un error inesperado que impide mostrar esta sección.
                  Por favor, intenta recargar la página.
               </p>

               <div className="flex gap-4">
                  <button
                     onClick={this.handleReload}
                     className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-strong transition-colors shadow-sm font-medium"
                  >
                     Recargar Página
                  </button>
               </div>

               {/* Solo mostramos el detalle técnico en Desarrollo */}
               {isDev && this.state.error && (
                  <div className="mt-8 w-full max-w-2xl text-left">
                     <p className="text-xs font-bold text-red-500 uppercase mb-1">
                        Detalle del Error (Solo visible en Desarrollo):
                     </p>
                     <pre className="text-xs bg-gray-100 dark:bg-black/30 p-4 rounded border border-red-200 dark:border-red-900/50 overflow-auto max-h-60 text-red-700 dark:text-red-300 font-mono">
                        {this.state.error.toString()}
                        {'\n\n'}
                        {this.state.error.stack}
                     </pre>
                  </div>
               )}
            </div>
         );
      }

      return this.props.children;
   }
}
