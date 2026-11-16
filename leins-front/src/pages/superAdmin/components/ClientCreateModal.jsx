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
import { UserPlusIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

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
            <p className="text-xs text-text-soft -mt-1 pb-3 border-b border-border-subtle">
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
            <div className="border border-border-subtle rounded-2xl p-4 bg-gray-50/50 dark:bg-white/5 space-y-3">
               <label className="text-xs font-bold uppercase tracking-wider text-heading dark:text-white block">
                  Empresas Asignadas
               </label>
               <p className="text-xs text-text-soft">
                  Selecciona las empresas que este cliente podrá gestionar.
               </p>

               <div className="max-h-36 overflow-y-auto divide-y divide-border-subtle/50 rounded-xl border border-border-subtle bg-bg-content p-2">
                  {availableEntities?.length === 0 ? (
                     <p className="text-xs text-text-soft p-2">No hay empresas disponibles.</p>
                  ) : (
                     availableEntities?.map((ent) => {
                        const isChecked = selectedEntityIds.includes(Number(ent.id));
                        return (
                           <label
                              key={ent.id}
                              className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition text-xs"
                           >
                              <input
                                 type="checkbox"
                                 checked={isChecked}
                                 onChange={() => handleToggleEntity(ent.id)}
                                 className="rounded border-border-subtle text-brand focus:ring-brand h-4 w-4 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                 <span className="font-semibold text-heading dark:text-white truncate block">
                                    {ent.name || ent.legal_name}
                                 </span>
                                 <span className="text-[11px] text-text-soft">{ent.rut || ent.tax_id}</span>
                              </div>
                           </label>
                        );
                     })
                  )}
               </div>
            </div>

            {/* SECCIÓN DESPLEGABLE DE PERMISOS */}
            <div className="border border-border-subtle rounded-2xl overflow-hidden bg-bg-content">
               <button
                  type="button"
                  onClick={() => setShowPermissions((s) => !s)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50/80 dark:bg-white/5 hover:bg-gray-100 transition cursor-pointer text-left"
               >
                  <div>
                     <span className="text-sm font-bold text-heading dark:text-white block">
                        Configurar Permisos Granulares
                     </span>
                     <span className="text-xs text-text-soft">
                        Por defecto aplica la plantilla "Operativo Estándar". Haz clic para personalizar.
                     </span>
                  </div>
                  {showPermissions ? (
                     <ChevronUpIcon className="w-5 h-5 text-text-soft" />
                  ) : (
                     <ChevronDownIcon className="w-5 h-5 text-text-soft" />
                  )}
               </button>

               {showPermissions && (
                  <div className="p-4 border-t border-border-subtle">
                     <PermissionsMatrix permissions={permissions} onChange={setPermissions} />
                  </div>
               )}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-4 border-t border-border-subtle flex justify-end items-center gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-border-subtle hover:bg-gray-100 dark:hover:bg-white/5 text-text-soft transition cursor-pointer"
               >
                  Cancelar
               </button>
               <SpinnerButton
                  type="submit"
                  loading={saving}
                  className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-brand-strong transition cursor-pointer active:scale-95"
               >
                  Crear Cliente
               </SpinnerButton>
            </div>
         </form>
      </Modal>
   );
}
