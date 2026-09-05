import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordRecovery } from '../../services/auth';
import { toast } from 'components/Toaster';
import FormInput from 'components/FormInput';
import SpinnerButton from 'components/SpinnerButton';

export default function ForgotPassword() {
   const [email, setEmail] = useState('');
   const [loading, setLoading] = useState(false);
   const [sent, setSent] = useState(false);

   const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
         await requestPasswordRecovery(email);
         setSent(true); // Cambiamos la UI para mostrar mensaje de éxito
         toast.success('Correo enviado');
      } catch (err) {
         toast.error(err.message);
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base p-4">
         <div className="w-full max-w-md bg-bg-content p-8 rounded-3xl shadow-soft border border-border-subtle">
            <h1 className="text-2xl font-bold text-heading mb-2">Recuperar Contraseña</h1>
            
            {!sent ? (
               <form onSubmit={handleSubmit} className="space-y-6">
                  <p className="text-text-soft">Ingresa tu correo y te enviaremos instrucciones.</p>
                  <FormInput 
                     label="Email" 
                     type="email" 
                     value={email} 
                     onChange={(e) => setEmail(e.target.value)} 
                     required 
                     placeholder="admin@leinsadvisor.cl"
                  />
                  <div className="flex flex-col gap-3">
                     <SpinnerButton loading={loading} type="submit">
                        Enviar Link
                     </SpinnerButton>
                     <Link to="/login" className="text-center text-sm text-brand-strong hover:underline">
                        Volver al inicio de sesión
                     </Link>
                  </div>
               </form>
            ) : (
               <div className="text-center space-y-6 animate-fade-in">
                  <div className="text-5xl">📧</div>
                  <p className="text-heading font-medium">¡Correo enviado!</p>
                  <p className="text-text-soft text-sm">
                     Revisa tu bandeja de entrada (y spam) para continuar con el proceso.
                  </p>
                  <Link to="/login" className="block w-full py-2 bg-brand-tint/10 text-brand-strong rounded-xl font-medium">
                     Volver al Login
                  </Link>
               </div>
            )}
         </div>
      </div>
   );
}