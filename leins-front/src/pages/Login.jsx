import { Link } from 'react-router-dom';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useLoginForm } from '../hooks/useLoginForm';
import FormInput from 'components/FormInput';
import SpinnerButton from 'components/SpinnerButton';
import FormError from 'components/FormError';

export default function Login() {
   // extraemos la logica limpia de nuestro hook
   const {
      step,
      loading,
      formError,
      twoFactorCode,
      setTwoFactorCode,
      register,
      errors,
      submitLogin,
      submit2FA,
      resetToStep1
   } = useLoginForm();

   return (
      <div className="min-h-screen grid md:grid-cols-2">
         {/* hero */}
         <div className="hidden md:flex items-center justify-center p-8 bg-bg-shell text-text-main dark:bg-brand-strong dark:text-white animate-fade-in">
            <div className="text-center">
               <h1 className="text-4xl font-bold mb-4">
                  <span className="text-brand">Bienvenido a </span>
                  <span className="font-extrabold text-heading dark:text-brand-tint">Leins Advisor</span>
               </h1>
            </div>
         </div>

         {/* formulario */}
         <div className="flex items-center justify-center p-6 md:p-8 bg-brand/5 dark:bg-bg-shell">
            <div className="w-full max-w-md rounded-2xl shadow-soft border border-border-subtle bg-bg-content ring-1 ring-border-subtle/40 backdrop-blur p-6 md:p-8 animate-slide-up delay-100">

               {step === 1 ? (
                  <>
                     <h2 className="text-3xl font-bold text-center mb-6 text-brand animate-pop delay-200">
                        Iniciar sesión
                     </h2>

                     {/* componente de error global mejorado */}
                     <FormError message={formError} />

                     <form className="space-y-4" onSubmit={submitLogin} autoComplete="off">
                        <div>
                           <FormInput
                              label="Usuario"
                              placeholder="Ingrese usuario"
                              className={errors.username ? 'border-danger focus:ring-danger focus:border-danger text-danger placeholder:text-danger/50' : ''}
                              {...register('username')}
                           />
                           {errors.username && (
                              <p className="text-danger text-xs mt-1 font-semibold animate-fade-in pl-1">
                                 {errors.username.message}
                              </p>
                           )}
                        </div>

                        <div>
                           <FormInput
                              label="Contraseña"
                              type="password"
                              placeholder="••••••••"
                              className={errors.password ? 'border-danger focus:ring-danger focus:border-danger text-danger placeholder:text-danger/50' : ''}
                              {...register('password')}
                           />
                           {errors.password && (
                              <p className="text-danger text-xs mt-1 font-semibold animate-fade-in pl-1">
                                 {errors.password.message}
                              </p>
                           )}
                        </div>

                        <SpinnerButton type="submit" loading={loading}>
                           {loading ? 'Validando...' : 'Ingresar al sistema'}
                        </SpinnerButton>
                     </form>

                     <div className="mt-6 text-center">
                        <p className="text-sm text-text-soft">
                           ¿Olvidaste tu contraseña?{' '}
                           <Link to="/forgot-password" className="font-medium underline text-brand-strong hover:text-brand transition-colors">
                              Recuperar accesos
                           </Link>
                        </p>
                     </div>
                  </>
               ) : (
                  <div className="animate-fade-in">
                     <div className="text-center mb-8">
                        <div className="mx-auto w-14 h-14 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4 ring-4 ring-brand/5">
                           <ShieldCheckIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-heading dark:text-white">Verificación de 2 Pasos</h2>
                        <p className="text-sm text-text-soft mt-2 px-4">
                           Protección activa. Ingresa el código de 6 dígitos.
                        </p>
                     </div>

                     <FormError message={formError} />

                     <form className="space-y-6" onSubmit={submit2FA}>
                        <div className="flex justify-center">
                           <input
                              type="text"
                              maxLength="6"
                              autoFocus
                              value={twoFactorCode}
                              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="000 000"
                              className="block w-full text-center text-3xl tracking-[0.5em] font-mono py-3 bg-white dark:bg-black/20 border-2 border-border-subtle rounded-xl focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700"
                           />
                        </div>

                        <SpinnerButton type="submit" loading={loading} className="w-full">
                           Verificar acceso
                        </SpinnerButton>

                        <button
                           type="button"
                           onClick={resetToStep1}
                           className="w-full text-xs font-medium text-text-soft hover:text-black dark:hover:text-white mt-4 py-2 transition-colors"
                        >
                           ← Volver al inicio de sesión
                        </button>
                     </form>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}