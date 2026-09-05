// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './context/AuthContext';
import App from './App';
import reportWebVitals from './reportWebVitals';

import './index.css';
import './styles/theme-controls.css';

// instanciamos el cliente de query con sus opciones globales
const queryClient = new QueryClient({
   defaultOptions: {
      queries: {
         // los datos se consideran obsoletos despues de 5 minutos
         staleTime: 1000 * 60 * 5,
         // no reintentar automaticamente si falla la peticion
         retry: false,
         // evitar que recargue la data al cambiar de ventana en el navegador
         refetchOnWindowFocus: false,
      },
   },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
   <React.StrictMode>
      <QueryClientProvider client={queryClient}>
         <AuthProvider>
            <App />
         </AuthProvider>
      </QueryClientProvider>
   </React.StrictMode>
);

// medir performance (opcional):
// en dev, logea metricas en consola; en prod, no hace ruido
if (import.meta.env.DEV) {
   reportWebVitals(console.log);
} else {
   reportWebVitals();
}
