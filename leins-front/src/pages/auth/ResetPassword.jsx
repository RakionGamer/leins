import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../services/auth';
import { toast } from 'components/Toaster';
import FormInput from 'components/FormInput';
import SpinnerButton from 'components/SpinnerButton';

export default function ResetPassword() {
   const [searchParams] = useSearchParams();
   const navigate = useNavigate();

   // Extraemos token e id de la URL
   const token = searchParams.get('token');
   const id = searchParams.get('id');

   const [pass, setPass] = useState('');
   const [confirm, setConfirm] = useState('');
   const [loading, setLoading] = useState(false);

   useEffect(() => {
      if (!token || !id) {
         toast.error('Link inválido o incompleto');
         navigate('/login');
      }
   }, [token, id, navigate]);

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (pass !== confirm) return toast.error('Las contraseñas no coinciden');
      if (pass.length < 6) return toast.error('Mínimo 6 caracteres');

      setLoading(true);
      try {
         await resetPassword({ token, id, newPassword: pass });
         toast.success('¡Contraseña restablecida! Ahora puedes ingresar.');
         navigate('/login');
      } catch (err) {
         toast.error(err.message);
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base p-4">
         <div className="w-full max-w-md bg-bg-content p-8 rounded-3xl shadow-soft border border-border-subtle">
            <h1 className="text-2xl font-bold text-heading mb-6">Nueva Contraseña</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
               <FormInput
                  label="Nueva Contraseña"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
               />
               <FormInput
                  label="Confirmar Contraseña"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
               />
               <SpinnerButton loading={loading} type="submit" className="mt-4">
                  Cambiar Contraseña
               </SpinnerButton>
            </form>
         </div>
      </div>
   );
}