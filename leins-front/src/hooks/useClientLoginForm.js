import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
   username: z.string().min(1, 'El usuario es requerido'),
   password: z.string().min(1, 'La contrasena es requerida')
});

export function useClientLoginForm() {
   const [formError, setFormError] = useState(null);
   const [loading, setLoading] = useState(false);

   const { loginAsClient } = useAuth();
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

   const onLoginSubmit = async (data) => {
      setFormError(null);
      setLoading(true);
      try {
         await loginAsClient(data);
         navigate('/');
      } catch (error) {
         setFormError(error.message || 'error al iniciar sesion');
      } finally {
         setLoading(false);
      }
   };

   return {
      loading,
      formError,
      register,
      errors,
      submitLogin: handleSubmit(onLoginSubmit),
   };
}
