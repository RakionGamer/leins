import { render, screen } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';

test('renderiza la aplicacion correctamente', async () => {
   window.history.pushState({}, '', '/login');

   render(
      <AuthProvider>
         <App />
      </AuthProvider>
   );

   expect(
      await screen.findByRole('button', {
         name: /ingresar/i,
      })
   ).toBeInTheDocument();
});