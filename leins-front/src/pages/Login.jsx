import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoginForm } from '../hooks/useLoginForm';
import JeitoLogo from '../components/JeitoLogo';
import JeitoSmile from '../components/JeitoSmile';
import JeitoCurve from '../components/JeitoCurve';

export default function Login() {
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
      resetToStep1,
   } = useLoginForm();

   const [showPassword, setShowPassword] = useState(false);
   const [rememberMe, setRememberMe] = useState(true);

   return (
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden font-sans">
         {/* =========================================
             PANEL IZQUIERDO: Marca, Mensaje y Sonrisa
             ========================================= */}
         <div className="relative w-full lg:w-[54%] bg-[#0A1A3F] min-h-[460px] lg:min-h-screen p-8 sm:p-12 lg:p-16 flex flex-col justify-between overflow-hidden select-none">
            {/* Curva de agua decorativa de fondo (#13285C / #11244E) */}
            <div
               className="curve absolute -bottom-[26%] sm:-bottom-[28%] lg:-bottom-[30%] left-[22%] sm:left-[24%] lg:left-[26%] w-[86%] sm:w-[84%] pointer-events-none select-none"
            >
               <JeitoCurve
                  className="w-full h-auto block"
                  strokeColor="#11244E"
               />
            </div>

            {/* Cabecera superior izquierda: Logo Jeito */}
            <div className="relative z-10">
               <JeitoLogo
                  className="w-28 sm:w-32 h-auto text-white"
                  dotColor="#1F6BFF"
                  textColor="#FFFFFF"
               />
            </div>

            {/* Zona central: Titular, subtítulo, píldoras y Sonrisa */}
            <div className="relative z-10 my-auto py-8 lg:py-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
               <div className="max-w-[340px] sm:max-w-[380px] lg:max-w-[400px]">
                  {/* H1 Principal con peso Black 900 en 3 líneas con separación clara y color #7FAAFF */}
                  <h1 className="font-nunito font-black text-white text-3xl sm:text-4xl lg:text-[42px] xl:text-[46px] leading-[1.25] tracking-tight">
                     <div>Tus finanzas</div>
                     <div className="mt-1 sm:mt-1.5 flex items-center flex-wrap">
                        <span className="text-[#7FAAFF] mr-2 sm:mr-2.5">al día,</span>
                        <span>sin</span>
                     </div>
                     <div className="mt-1 sm:mt-1.5">planillas.</div>
                  </h1>

                  {/* Subtítulo Nunito Sans */}
                  <p className="mt-5 text-[#8E9BB5] text-xs sm:text-sm lg:text-[14px] leading-relaxed font-normal">
                     Concilia, reporta y controla tu negocio en un solo lugar. Tu
                     CFO remoto, todos los días.
                  </p>

                  {/* Píldoras de propuesta de valor */}
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                     <div className="inline-flex items-center rounded-full bg-[#13285C] px-4 py-1.5 text-white text-xs sm:text-[13px] font-sans font-bold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-[#1F6BFF] mr-2 shrink-0"></span>
                        Concilia.
                     </div>
                     <div className="inline-flex items-center rounded-full bg-[#13285C] px-4 py-1.5 text-white text-xs sm:text-[13px] font-sans font-bold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-[#1F6BFF] mr-2 shrink-0"></span>
                        Reporta.
                     </div>
                     <div className="inline-flex items-center rounded-full bg-[#13285C] px-4 py-1.5 text-white text-xs sm:text-[13px] font-sans font-bold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-[#1F6BFF] mr-2 shrink-0"></span>
                        Controla.
                     </div>
                  </div>
               </div>

               {/* Sonrisa Jeito oficial: interactiva, ojos siguen el cursor y parpadean */}
               <div className="shrink-0 self-center lg:self-auto lg:mr-6 xl:mr-10">
                  <JeitoSmile
                     className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32"
                     mouthColor="#FFFFFF"
                     eyeColor="#1F6BFF"
                     animated={true}
                  />
               </div>
            </div>

            {/* Pie inferior izquierdo: Slogan */}
            <div className="relative z-10 pt-4">
               <p className="italic text-xs sm:text-[13px] text-[#8E9FCA] font-sans font-normal">
                  Sempre tem um jeito.
               </p>
            </div>
         </div>

         {/* =========================================
             PANEL DERECHO: Formulario de Autenticación
             ========================================= */}
         <div
            className="w-full lg:w-[46%] min-h-full flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-white text-[#0A1A3F]"
            style={{
               backgroundColor: '#FFFFFF',
               color: '#0A1A3F',
               colorScheme: 'light',
               '--control-bg': '#FFFFFF',
               '--control-text': '#0A1A3F',
               '--control-placeholder': '#55607A',
               '--control-border': '#D9E2EC',
            }}
         >
            <div className="w-full max-w-[360px] sm:max-w-[380px]">
               {step === 1 ? (
                  <>
                     {/* Encabezado del Formulario */}
                     <div className="mb-8">
                        <h2 className="font-nunito font-black text-[#0A1A3F] text-2xl sm:text-[28px] tracking-tight leading-snug">
                           Hola de nuevo
                        </h2>
                        <p className="mt-1 text-[#55607A] text-xs sm:text-[13px] font-sans font-normal">
                           Ingresa para ver con cuánto quedas este mes.
                        </p>
                     </div>

                     {/* Error global si falla el login */}
                     {formError && (
                        <div
                           role="alert"
                           className="mb-5 p-3 rounded-xl bg-[#FDF0F0] border border-[#E5484D]/30 text-[#E5484D] text-xs font-semibold flex items-center gap-2"
                        >
                           <svg
                              className="w-4 h-4 shrink-0 stroke-[#E5484D]"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                           >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                           </svg>
                           <span>{formError}</span>
                        </div>
                     )}

                     {/* Formulario */}
                     <form onSubmit={submitLogin} autoComplete="off" className="space-y-4">
                        {/* Campo Usuario o Correo */}
                        <div>
                           <label
                              htmlFor="username"
                              className="block text-[11px] font-sans font-bold tracking-wider text-[#55607A] uppercase mb-1.5"
                           >
                              USUARIO O CORREO
                           </label>
                           <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#55607A] pointer-events-none">
                                 <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                 >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                 </svg>
                              </span>
                              <input
                                 id="username"
                                 type="text"
                                 placeholder="leins@empresa.cl"
                                 style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#0A1A3F',
                                 }}
                                 className={`w-full h-11 sm:h-12 pl-10 pr-4 rounded-xl border-2 ${errors.username
                                    ? 'border-[#E5484D] focus:ring-[#E5484D]/20'
                                    : 'border-[#1F6BFF] focus:ring-[#1F6BFF]/20'
                                    } !bg-white !text-[#0A1A3F] placeholder-[#55607A]/50 font-sans text-sm focus:outline-none focus:ring-2 transition-all`}
                                 {...register('username')}
                              />
                           </div>
                           {errors.username && (
                              <p className="text-[#E5484D] text-xs mt-1 font-semibold pl-1">
                                 {errors.username.message}
                              </p>
                           )}
                        </div>

                        {/* Campo Contraseña */}
                        <div>
                           <label
                              htmlFor="password"
                              className="block text-[11px] font-sans font-bold tracking-wider text-[#55607A] uppercase mb-1.5"
                           >
                              CONTRASEÑA
                           </label>
                           <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#55607A] pointer-events-none">
                                 <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                 >
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                 </svg>
                              </span>
                              <input
                                 id="password"
                                 type={showPassword ? 'text' : 'password'}
                                 placeholder="••••••••••"
                                 style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#0A1A3F',
                                 }}
                                 className={`w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border ${errors.password
                                    ? 'border-[#E5484D] focus:ring-[#E5484D]/20'
                                    : 'border-[#D9E2EC] focus:border-[#1F6BFF] focus:ring-[#1F6BFF]/20'
                                    } !bg-white !text-[#0A1A3F] placeholder-[#55607A]/50 font-sans text-sm focus:outline-none focus:ring-2 transition-all`}
                                 {...register('password')}
                              />
                              <button
                                 type="button"
                                 onClick={() => setShowPassword(!showPassword)}
                                 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#55607A] hover:text-[#1F6BFF] focus:outline-none transition-colors"
                                 aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                              >
                                 {showPassword ? (
                                    <svg
                                       className="w-4 h-4"
                                       fill="none"
                                       viewBox="0 0 24 24"
                                       stroke="currentColor"
                                       strokeWidth="1.8"
                                       strokeLinecap="round"
                                       strokeLinejoin="round"
                                    >
                                       <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                       <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                 ) : (
                                    <svg
                                       className="w-4 h-4"
                                       fill="none"
                                       viewBox="0 0 24 24"
                                       stroke="currentColor"
                                       strokeWidth="1.8"
                                       strokeLinecap="round"
                                       strokeLinejoin="round"
                                    >
                                       <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                       <circle cx="12" cy="12" r="3" />
                                    </svg>
                                 )}
                              </button>
                           </div>
                           {errors.password && (
                              <p className="text-[#E5484D] text-xs mt-1 font-semibold pl-1">
                                 {errors.password.message}
                              </p>
                           )}
                        </div>

                        {/* Fila: Recordarme y ¿Olvidaste tu contraseña? */}
                        <div className="pt-1 flex items-center justify-between text-xs sm:text-[13px]">
                           <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input
                                 type="checkbox"
                                 checked={rememberMe}
                                 onChange={(e) => setRememberMe(e.target.checked)}
                                 className="w-4 h-4 rounded text-[#1F6BFF] border-[#D9E2EC] focus:ring-[#1F6BFF] focus:ring-offset-0 cursor-pointer !bg-white checked:!bg-[#1F6BFF]"
                              />
                              <span className="font-sans font-medium text-[#0A1A3F]">Recordarme</span>
                           </label>

                           <Link
                              to="/forgot-password"
                              className="font-sans font-semibold text-[#1F6BFF] hover:underline"
                           >
                              ¿Olvidaste tu contraseña?
                           </Link>
                        </div>

                        {/* Botón CTA Ingresar: Píldora rounded-full Nunito Black */}
                        <div className="pt-2">
                           <button
                              type="submit"
                              disabled={loading}
                              className="w-full h-11 sm:h-12 rounded-full bg-[#1F6BFF] hover:bg-[#1558D6] text-white font-nunito font-black text-sm sm:text-[15px] flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1F6BFF] focus:ring-offset-2 cursor-pointer"
                           >
                              {loading ? (
                                 <>
                                    <svg
                                       className="animate-spin h-4 w-4 text-white"
                                       xmlns="http://www.w3.org/2000/svg"
                                       fill="none"
                                       viewBox="0 0 24 24"
                                    >
                                       <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                       ></circle>
                                       <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8v8z"
                                       ></path>
                                    </svg>
                                    <span>Ingresando...</span>
                                 </>
                              ) : (
                                 <>
                                    <span>Ingresar</span>
                                    <svg
                                       className="w-4 h-4 stroke-[2.5]"
                                       fill="none"
                                       viewBox="0 0 24 24"
                                       stroke="currentColor"
                                       strokeLinecap="round"
                                       strokeLinejoin="round"
                                    >
                                       <path d="M9 5l7 7-7 7" />
                                    </svg>
                                 </>
                              )}
                           </button>
                        </div>
                     </form>

                     {/* Pie de ayuda */}
                     <div className="mt-8 text-center text-xs text-[#55607A] font-sans">
                        ¿Necesitas ayuda? Escríbenos a{' '}
                        <a
                           href="mailto:hola@jeito.cl"
                           className="font-bold text-[#0A1A3F] hover:text-[#1F6BFF] transition-colors"
                        >
                           hola@jeito.cl
                        </a>
                     </div>
                  </>
               ) : (
                  /* =========================================
                     PASO 2: Verificación de 2 Pasos (2FA)
                     ========================================= */
                  <div className="animate-fade-in">
                     <div className="text-center mb-8">
                        <div className="mx-auto w-14 h-14 bg-[#EEF3FF] text-[#1F6BFF] rounded-full flex items-center justify-center mb-4 ring-4 ring-[#EEF3FF]/60">
                           <svg
                              className="w-7 h-7"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                           >
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <path d="M9 12l2 2 4-4" />
                           </svg>
                        </div>
                        <h2 className="font-nunito font-black text-2xl text-[#0A1A3F]">
                           Verificación de 2 Pasos
                        </h2>
                        <p className="text-xs sm:text-[13px] text-[#55607A] mt-2">
                           Protección activa. Ingresa el código de 6 dígitos.
                        </p>
                     </div>

                     {formError && (
                        <div
                           role="alert"
                           className="mb-5 p-3 rounded-xl bg-[#FDF0F0] border border-[#E5484D]/30 text-[#E5484D] text-xs font-semibold"
                        >
                           {formError}
                        </div>
                     )}

                     <form className="space-y-6" onSubmit={submit2FA}>
                        <div className="flex justify-center">
                           <input
                              type="text"
                              maxLength="6"
                              autoFocus
                              value={twoFactorCode}
                              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="000 000"
                              style={{
                                 backgroundColor: '#FFFFFF',
                                 color: '#0A1A3F',
                              }}
                              className="block w-full text-center text-3xl tracking-[0.5em] font-amount font-semibold py-3 !bg-white border-2 border-[#D8E2F5] rounded-xl focus:border-[#1F6BFF] focus:ring-4 focus:ring-[#1F6BFF]/10 outline-none transition-all !text-[#0A1A3F] placeholder-[#55607A]/30"
                           />
                        </div>

                        <button
                           type="submit"
                           disabled={loading}
                           className="w-full h-11 sm:h-12 rounded-full bg-[#1F6BFF] hover:bg-[#1558D6] text-white font-nunito font-black text-sm sm:text-[15px] flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                           {loading ? (
                              <span>Verificando...</span>
                           ) : (
                              <>
                                 <span>Verificar acceso</span>
                                 <svg
                                    className="w-4 h-4 stroke-[2.5]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                 >
                                    <path d="M9 5l7 7-7 7" />
                                 </svg>
                              </>
                           )}
                        </button>

                        <button
                           type="button"
                           onClick={resetToStep1}
                           className="w-full text-xs font-semibold text-[#55607A] hover:text-[#0A1A3F] mt-3 py-2 transition-colors flex items-center justify-center gap-1"
                        >
                           <span>← Volver al inicio de sesión</span>
                        </button>
                     </form>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
