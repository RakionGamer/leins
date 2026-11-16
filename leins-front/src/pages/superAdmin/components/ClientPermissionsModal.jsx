// leins-front/src/pages/superAdmin/components/ClientPermissionsModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import PermissionsMatrix from './PermissionsMatrix';
import SpinnerButton from 'components/SpinnerButton';
import { updateClientUserPermissions } from '../../../services/clientUsersApi';
import { toast } from 'components/Toaster';
import { getDefaultPermissions } from '../../../constants/permissions';
import { BuildingOffice2Icon, UserCircleIcon } from '@heroicons/react/24/outline';

export default function ClientPermissionsModal({ isOpen, onClose, client, onSuccess }) {
   const [permissions, setPermissions] = useState(getDefaultPermissions());
   const [selectedEntityId, setSelectedEntityId] = useState(null);
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      if (!client) return;

      // Si seleccionó una entidad específica, buscar sus permisos de entidad
      if (selectedEntityId) {
         const ent = (client.entities || []).find((e) => Number(e.id) === Number(selectedEntityId));
         if (ent?.permissions) {
            setPermissions(ent.permissions);
            return;
         }
      }

      // De lo contrario, usar permisos globales del cliente
      setPermissions(client.permissions || getDefaultPermissions());
   }, [client, selectedEntityId]);

   if (!isOpen || !client) return null;

   const handleSave = async () => {
      setSaving(true);
      try {
         await updateClientUserPermissions({
            userId: client.id,
            entityId: selectedEntityId || undefined,
            permissions,
         });
         toast.success(
            selectedEntityId
               ? 'Permisos específicos de la empresa guardados'
               : 'Permisos globales del cliente guardados'
         );
         onSuccess?.();
         onClose();
      } catch (err) {
         toast.error(err?.message || 'Error al guardar los permisos');
      } finally {
         setSaving(false);
      }
   };

   const clientEntities = client.entities || [];
   const clientDisplayName = client.name
      ? `${client.name} ${client.last_name || ''}`.trim()
      : client.username;

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         maxWidth="max-w-6xl"
         title={`Permisos Granulares — ${clientDisplayName}`}
      >
         <div className="space-y-5">
            {/* SUB-HEADER: DATOS CLIENTE Y SELECTOR DE ALCANCE */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-1 border border-border-subtle">
               <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                     <UserCircleIcon className="w-5 h-5" />
                  </div>
                  <div>
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-heading dark:text-white">
                           {clientDisplayName}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-semibold">
                           @{client.username}
                        </span>
                     </div>
                     <p className="text-xs text-text-soft mt-0.5">{client.email}</p>
                  </div>
               </div>

               {/* SELECTOR DE ALCANCE (GLOBAL VS EMPRESA ESPECÍFICA) */}
               <div className="flex items-center gap-2 bg-bg-content p-1.5 rounded-xl border border-border-subtle shadow-2xs">
                  <BuildingOffice2Icon className="w-4 h-4 text-brand ml-1.5 shrink-0" />
                  <span className="text-xs font-semibold text-text-soft hidden sm:inline">Alcance:</span>
                  <select
                     value={selectedEntityId || ''}
                     onChange={(e) => setSelectedEntityId(e.target.value ? Number(e.target.value) : null)}
                     className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border-0 bg-transparent text-text-main focus:ring-0 focus:outline-none cursor-pointer"
                  >
                     <option value="">Permisos Globales (Todas las empresas)</option>
                     {clientEntities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                           {ent.name} ({ent.rut || `ID ${ent.id}`})
                        </option>
                     ))}
                  </select>
               </div>
            </div>

            {/* MATRIZ DE PERMISOS GRANULARES */}
            <PermissionsMatrix
               permissions={permissions}
               onChange={setPermissions}
               disabled={saving}
            />

            {/* BOTONES DE ACCIÓN */}
            <div className="pt-4 border-t border-border-subtle flex items-center justify-end gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-border-subtle hover:bg-gray-100 dark:hover:bg-white/5 text-text-soft transition cursor-pointer"
               >
                  Cancelar
               </button>
               <SpinnerButton
                  loading={saving}
                  onClick={handleSave}
                  className="bg-brand text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-brand-strong transition cursor-pointer active:scale-95"
               >
                  Guardar Permisos
               </SpinnerButton>
            </div>
         </div>
      </Modal>
   );
}

