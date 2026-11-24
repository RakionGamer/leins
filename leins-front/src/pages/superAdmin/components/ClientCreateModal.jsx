// leins-front/src/pages/superAdmin/components/ClientCreateModal.jsx
import React, { useState } from 'react';
import Modal from 'components/Modal';
import FormInput from 'components/FormInput';
import FormError from 'components/FormError';
import SpinnerButton from 'components/SpinnerButton';
import PermissionsMatrix from './PermissionsMatrix';
import { createClientUser } from '../../../services/clientUsersApi';
import { useEntities } from '../../../hooks/useEntities';
import { toast } from 'components/Toaster';
import { getPresetPermissions } from '../../../constants/permissions';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export default function ClientCreateModal({ isOpen, onClose, onSuccess }) {
   const [username, setUsername] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [name, setName] = useState('');
   const [lastName, setLastName] = useState('');
   const [selectedEntityIds, setSelectedEntityIds] = useState([]);
   const [permissions, setPermissions] = useState(() => getPresetPermissions('OPERATIVE_STANDARD'));
   const [showPermissions, setShowPermissions] = useState(false);
   const [formError, setFormError] = useState(null);
   const [saving, setSaving] = useState(false);

   const { entities: availableEntities } = useEntities({ limit: 100, activeOnly: true });

   if (!isOpen) return null;

   const handleToggleEntity = (id) => {
      const numId = Number(id);
      setSelectedEntityIds((prev) =>
         prev.includes(numId) ? prev.filter((x) => x !== numId) : [...prev, numId]
      );
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      setFormError(null);

      if (!username.trim() || !email.trim() || !password.trim()) {
         setFormError('Usuario, email y contraseña son obligatorios');
         return;
      }

      setSaving(true);
      try {
         await createClientUser({
            username: username.trim(),
            email: email.trim(),
            password: password.trim(),
            name: name.trim() || null,
            lastName: lastName.trim() || null,
            entityIds: selectedEntityIds,
            permissions,
         });

         toast.success('Cliente creado correctamente');
         onSuccess?.();
         onClose();
      } catch (err) {
         setFormError(err?.message || 'Error al crear el cliente');
      } finally {
         setSaving(false);
      }
   };

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         maxWidth="max-w-4xl"
         title="Nuevo Cliente"
      >
         <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-xs text-[#55607A] -mt-1 pb-3 border-b border-[#E2EAFD]">
               Crea una cuenta de acceso para un cliente y asigna sus empresas y permisos.
            </p>

            <FormError message={formError} />

            {/* DATOS DE LA CUENTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormInput
                  label="Nombre de usuario *"
                  placeholder="ej. cliente_acme"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
               />
               <FormInput
                  label="Email *"
                  type="email"
                  placeholder="cliente@ejemplo.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
               />
               <FormInput
                  label="Nombre"
                  placeholder="Nombre del cliente"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
               />
               <FormInput
                  label="Apellido"
                  placeholder="Apellido del cliente"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
               />
               <div className="sm:col-span-2">
                  <FormInput
                     label="Contraseña inicial *"
                     type="password"
                     placeholder="Mínimo 6 caracteres"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     required
                  />
               </div>
            </div>

            {/* ASIGNACIÓN DE EMPRESAS */}
            <div className="border border-[#E2EAFD] rounded-2xl p-4 bg-[#F8FAFF] space-y-3">
               <label className="text-xs font-bold uppercase tracking-wider text-[#0A1A3F] block">
                  Empresas Asignadas
               </label>
               <p className="text-xs text-[#55607A]">
                  Selecciona las empresas que este cliente podrá gestionar.
               </p>

               <div className="max-h-36 overflow-y-auto divide-y divide-[#E2EAFD]/60 rounded-xl border border-[#E2EAFD] bg-white p-2">
                  {availableEntities?.length === 0 ? (
                     <p className="text-xs text-[#55607A] p-2">No hay empresas disponibles.</p>
                  ) : (
                     availableEntities?.map((ent) => {
                        const isChecked = selectedEntityIds.includes(Number(ent.id));
                        return (
                           <label
                              key={ent.id}
                              className="flex items-center gap-3 p-2 hover:bg-[#F9FBFF] rounded-lg cursor-pointer transition text-xs"
                           >
                              <input
                                 type="checkbox"
                                 checked={isChecked}
                                 onChange={() => handleToggleEntity(ent.id)}
                                 className="rounded border-[#D9E2EC] text-[#1F6BFF] focus:ring-[#1F6BFF] h-4 w-4 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                 <span className="font-bold text-[#0A1A3F] truncate block">
                                    {ent.name || ent.legal_name}
                                 </span>
                                 <span className="text-[11px] text-[#55607A]">{ent.rut || ent.tax_id}</span>
                              </div>
                           </label>
                        );
                     })
                  )}
               </div>
            </div>

            {/* SECCIÓN DESPLEGABLE DE PERMISOS */}
            <div className="border border-[#E2EAFD] rounded-2xl overflow-hidden bg-white">
               <button
                  type="button"
                  onClick={() => setShowPermissions((s) => !s)}
                  className="w-full flex items-center justify-between p-4 bg-[#F8FAFF] hover:bg-[#F0F4FD] transition cursor-pointer text-left"
               >
                  <div>
                     <span className="text-sm font-bold text-[#0A1A3F] block font-nunito">
                        Configurar Permisos Granulares
                     </span>
                     <span className="text-xs text-[#55607A]">
                        Por defecto aplica la plantilla "Operativo Estándar". Haz clic para personalizar.
                     </span>
                  </div>
                  {showPermissions ? (
                     <ChevronUpIcon className="w-5 h-5 text-[#55607A]" />
                  ) : (
                     <ChevronDownIcon className="w-5 h-5 text-[#55607A]" />
                  )}
               </button>

               {showPermissions && (
                  <div className="p-4 border-t border-[#E2EAFD]">
                     <PermissionsMatrix permissions={permissions} onChange={setPermissions} />
                  </div>
               )}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-4 border-t border-[#E2EAFD] flex justify-end items-center gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-full border border-[#E2EAFD] text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#F8FAFF] text-xs font-bold transition cursor-pointer"
               >
                  Cancelar
               </button>
               <SpinnerButton
                  type="submit"
                  loading={saving}
                  className="px-6 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
               >
                  Crear Cliente
               </SpinnerButton>
            </div>
         </form>
      </Modal>
   );
}
