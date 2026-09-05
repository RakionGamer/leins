import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveTokens, setStoredUser } from '../utils/auth';
import { verifyLogin2FA } from '../services/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// definimos las reglas de validacion
const loginSchema = z.object({
   username: z.string().min(1, 'El usuario es requerido'),
   password: z.string().min(1, 'La contrasena es requerida')
});

export function useLoginForm() {
   const [step, setStep] = useState(1);
   const [tempUserId, setTempUserId] = useState(null);
   const [twoFactorCode, setTwoFactorCode] = useState('');
   const [formError, setFormError] = useState(null);
   const [loading, setLoading] = useState(false);

   const { login, setUser } = useAuth();
   const navigate = useNavigate();

   const {
      register,
      handleSubmit,
      formState: { errors }
   } = useForm({
      resolver: zodResolver(loginSchema),
      defaultValues: {
         username: '',
         password: ''
      }
   });

   // paso 1: envio de credenciales
   const onLoginSubmit = async (data) => {
      setFormError(null);
      setLoading(true);
      try {
         const result = await login(data);
         // verificamos si el backend requiere 2fa
         if (result && result.require2fa) {
            setTempUserId(result.userId);
            setStep(2);
         } else {
            navigate('/');
         }
      } catch (error) {
         setFormError(error.message || 'error al iniciar sesion');
      } finally {
         setLoading(false);
      }
   };

   // paso 2: validacion de doble factor
   const handle2FASubmit = async (e) => {
      e.preventDefault();
      if (!twoFactorCode || twoFactorCode.length < 6) {
         return setFormError('codigo invalido');
      }

      setFormError(null);
      setLoading(true);
      try {
         const result = await verifyLogin2FA({ userId: tempUserId, token: twoFactorCode });
         saveTokens(result.accessToken, result.refreshToken);
         setStoredUser(result.user);
         setUser(result.user);
         navigate('/');
      } catch (error) {
         setFormError(error.message || 'codigo 2fa incorrecto');
      } finally {
         setLoading(false);
      }
   };

   // volver al paso inicial
   const resetToStep1 = () => {
      setStep(1);
      setFormError(null);
      setTwoFactorCode('');
   };

   return {
      step,
      loading,
      formError,
      twoFactorCode,
      setTwoFactorCode,
      register,
      errors,
      submitLogin: handleSubmit(onLoginSubmit),
      submit2FA: handle2FASubmit,
      resetToStep1
   };
}