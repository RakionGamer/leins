import { useClientLoginForm } from '../hooks/useClientLoginForm';
import FormInput from 'components/FormInput';
import SpinnerButton from 'components/SpinnerButton';
import FormError from 'components/FormError';

export default function ClientLogin() {
   const {
      loading,
      formError,
      register,
      errors,
      submitLogin,
   } = useClientLoginForm();

   return (
      <div className="min-h-screen grid md:grid-cols-2">
         {/* hero */}
         <div className="hidden md:flex items-center justify-center p-8 bg-bg-shell text-text-main dark:bg-brand-strong dark:text-white animate-fade-in">
            <div className="text-center">
               <h1 className="text-4xl font-bold mb-4">
                  <span className="text-brand">Portal de </span>
                  <span className="font-extrabold text-heading dark:text-brand-tint">Clientes</span>
               </h1>
               <p className="text-sm text-text-soft max-w-sm mx-auto">
                  Accede con las credenciales que te entrego tu asesor Leins.
               </p>
            </div>
         </div>

         {/* formulario */}
         <div className="flex items-center justify-center p-6 md:p-8 bg-brand/5 dark:bg-bg-shell">
            <div className="w-full max-w-md rounded-2xl shadow-soft border border-border-subtle bg-bg-content ring-1 ring-border-subtle/40 backdrop-blur p-6 md:p-8 animate-slide-up delay-100">
               <h2 className="text-3xl font-bold text-center mb-6 text-brand animate-pop delay-200">
                  Iniciar sesión
               </h2>

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
                     {loading ? 'Validando...' : 'Ingresar'}
                  </SpinnerButton>
               </form>
            </div>
         </div>
      </div>
   );
}
