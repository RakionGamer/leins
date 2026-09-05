import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'components/Toaster';
import SpinnerButton from 'components/SpinnerButton';
import { changePasswordInSession, generate2FA, enable2FA, disable2FA } from '../../services/userApi';
// 👇 CORRECCIÓN: Quitamos ShieldCheckIcon y QrCodeIcon que no se usaban
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function ChangePasswordTab() {
   const { user, setUser } = useAuth();

   // --- Estado Contraseña ---
   const [passForm, setPassForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
   const [passLoading, setPassLoading] = useState(false);
   const [showPass, setShowPass] = useState({ old: false, new: false, confirm: false });

   // --- Estado 2FA ---
   const [is2FAEnabled, setIs2FAEnabled] = useState(false);
   const [show2FASetup, setShow2FASetup] = useState(false);
   const [qrData, setQrData] = useState(null);
   const [twoFactorCode, setTwoFactorCode] = useState('');
   const [verifying2FA, setVerifying2FA] = useState(false);

   // Sincronizar estado inicial
   useEffect(() => {
      if (user) {
         setIs2FAEnabled(!!user.two_factor_enabled);
      }
   }, [user]);

   // --- Lógica Contraseña ---
   const handlePassChange = (e) => setPassForm({ ...passForm, [e.target.name]: e.target.value });
   const togglePassShow = (field) => setShowPass(prev => ({ ...prev, [field]: !prev[field] }));

   const handlePassSubmit = async (e) => {
      e.preventDefault();
      if (passForm.newPassword !== passForm.confirmPassword) return toast.error('Las nuevas contraseñas no coinciden');
      if (passForm.newPassword.length < 6) return toast.error('Mínimo 6 caracteres');

      setPassLoading(true);
      try {
         await changePasswordInSession({
            oldPassword: passForm.oldPassword,
            newPassword: passForm.newPassword
         });
         toast.success('Contraseña actualizada correctamente');
         setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } catch (err) {
         toast.error(err.message || 'Error al actualizar');
      } finally {
         setPassLoading(false);
      }
   };

   // --- Lógica 2FA ---
   const handleToggle2FA = async () => {
      if (is2FAEnabled) {
         if (!window.confirm('¿Estás seguro de desactivar la seguridad de dos pasos? Tu cuenta será menos segura.')) return;
         try {
            await disable2FA();
            setIs2FAEnabled(false);
            setUser({ ...user, two_factor_enabled: false });
            toast.success('2FA Desactivado');
         } catch (error) {
            toast.error(error.message);
         }
      } else {
         try {
            const data = await generate2FA();
            setQrData(data);
            setShow2FASetup(true);
         } catch (error) {
            toast.error('Error al generar QR: ' + error.message);
         }
      }
   };

   const handleConfirm2FA = async () => {
      if (twoFactorCode.length < 6) return toast.error('Ingresa el código de 6 dígitos');
      setVerifying2FA(true);
      try {
         await enable2FA(twoFactorCode, qrData.tempSecret);
         setIs2FAEnabled(true);
         setShow2FASetup(false);
         setQrData(null);
         setTwoFactorCode('');
         setUser({ ...user, two_factor_enabled: true });
         toast.success('¡Seguridad activada correctamente!');
      } catch (error) {
         toast.error(error.message || 'Código incorrecto');
      } finally {
         setVerifying2FA(false);
      }
   };

   return (
      <div className="space-y-12 animate-fade-in text-left">

         {/* SECCIÓN 1: CAMBIAR CONTRASEÑA */}
         <form onSubmit={handlePassSubmit} className="space-y-6">
            <div>
               <h3 className="text-sm font-bold uppercase tracking-widest text-heading dark:text-white mb-1">
                  Cambiar Contraseña
               </h3>
               <p className="text-xs text-text-soft dark:text-gray-400">
                  Actualiza tu clave periódicamente para mantener tu cuenta segura.
               </p>
            </div>

            <MinimalInput
               label="Contraseña Actual"
               name="oldPassword"
               value={passForm.oldPassword}
               onChange={handlePassChange}
               placeholder="••••••••"
               showPassword={showPass.old}
               onToggle={() => togglePassShow('old')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
               <MinimalInput
                  label="Nueva Contraseña"
                  name="newPassword"
                  value={passForm.newPassword}
                  onChange={handlePassChange}
                  placeholder="Mínimo 6 caracteres"
                  showPassword={showPass.new}
                  onToggle={() => togglePassShow('new')}
               />
               <MinimalInput
                  label="Repetir Nueva"
                  name="confirmPassword"
                  value={passForm.confirmPassword}
                  onChange={handlePassChange}
                  placeholder="Confirma la clave"
                  showPassword={showPass.confirm}
                  onToggle={() => togglePassShow('confirm')}
               />
            </div>

            <div className="flex justify-end pt-2">
               <SpinnerButton
                  loading={passLoading}
                  className="bg-brand text-white hover:bg-brand-strong hover:text-white transition-colors shadow-none rounded-xl px-6 py-2 font-medium text-xs uppercase tracking-wide"
               >
                  Actualizar Clave
               </SpinnerButton>
            </div>
         </form>

         {/* DIVIDER */}
         <div className="h-px bg-border-subtle/30 dark:bg-white/10 w-full" />

         {/* SECCIÓN 2: DOBLE FACTOR (2FA) */}
         <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-heading dark:text-white">
                        Doble Factor de Autenticación
                     </h3>
                     {is2FAEnabled && (
                        <span className="bg-green-100 text-green-700 text-[9px] px-2 py-0.5 rounded-full font-bold border border-green-200 uppercase tracking-wide">
                           Activado
                        </span>
                     )}
                  </div>
                  <p className="text-xs text-text-soft dark:text-gray-400 max-w-md leading-relaxed">
                     Añade una capa extra de seguridad requiriendo un código de tu celular al iniciar sesión.
                  </p>
               </div>

               {/* Toggle Switch */}
               <button
                  type="button"
                  onClick={handleToggle2FA}
                  disabled={show2FASetup}
                  className={`
                     relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2
                     ${is2FAEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
               >
                  <span className="sr-only">Usar configuración 2FA</span>
                  <span
                     aria-hidden="true"
                     className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${is2FAEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                  />
               </button>
            </div>

            {/* Panel QR */}
            {show2FASetup && qrData && (
               <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-6 border border-border-subtle/50 dark:border-white/5 animate-fade-in-down">
                  <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                     {/* QR Imagen */}
                     <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm shrink-0">
                        <img src={qrData.qrCode} alt="QR Code" className="w-32 h-32" />
                     </div>

                     <div className="flex-1 w-full space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-brand">Configuración Requerida</h4>
                        <ol className="list-decimal list-inside text-xs text-text-soft dark:text-gray-300 space-y-1.5 ml-1">
                           <li>Abre <strong>Google Authenticator</strong> en tu celular.</li>
                           <li>Escanea el código QR de la izquierda.</li>
                           <li>Ingresa el código de 6 dígitos que aparece en tu app.</li>
                        </ol>

                        <div className="flex items-end gap-3 mt-4">
                           <div className="w-32">
                              <label className="block text-[9px] uppercase font-bold mb-1 text-text-soft/70">Código</label>
                              <input
                                 type="text"
                                 maxLength="6"
                                 value={twoFactorCode}
                                 onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                                 placeholder="000 000"
                                 className="block w-full bg-white dark:bg-black/20 border border-border-subtle dark:border-white/10 rounded-lg px-3 py-2 text-center text-sm tracking-widest font-mono focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                              />
                           </div>
                           <SpinnerButton
                              type="button"
                              onClick={handleConfirm2FA}
                              loading={verifying2FA}
                              className="bg-brand text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-brand-strong transition-colors h-[38px]"
                           >
                              Activar
                           </SpinnerButton>
                           <button
                              type="button"
                              onClick={() => { setShow2FASetup(false); setQrData(null); }}
                              className="px-3 py-2 text-[10px] font-bold uppercase text-text-soft hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                           >
                              Cancelar
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>

      </div>
   );
}

function MinimalInput({ label, name, value, onChange, placeholder, showPassword, onToggle, ...props }) {
   return (
      <div className="group relative">
         <label
            htmlFor={name}
            className="block text-[9px] uppercase tracking-widest text-black dark:text-gray-500 font-bold mb-1 transition-colors group-focus-within:text-brand dark:group-focus-within:text-brand-tint"
         >
            {label}
         </label>

         <div className="relative">
            <input
               id={name}
               name={name}
               type={showPassword ? "text" : "password"}
               value={value}
               onChange={onChange}
               placeholder={placeholder}
               className="
                  block w-full 
                  bg-transparent 
                  border-0 border-b border-border-subtle/40 dark:border-white/10 
                  text-black dark:text-white 
                  text-sm font-normal 
                  pb-1 pr-8 px-0
                  placeholder:text-text-soft/30 dark:placeholder:text-gray-600/50 
                  focus:ring-0 focus:border-brand dark:focus:border-brand-tint 
                  transition-all duration-300
               "
               {...props}
            />
            <button
               type="button"
               onClick={onToggle}
               className="absolute right-0 bottom-1.5 text-text-soft/40 hover:text-black dark:hover:text-white transition-colors outline-none"
               tabIndex="-1"
            >
               {showPassword ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
            </button>
         </div>
      </div>
   );
}