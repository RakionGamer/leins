// leins-front/src/pages/superAdmin/components/ClientPermissionsModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import PermissionsMatrix from './PermissionsMatrix';
import SpinnerButton from 'components/SpinnerButton';
import { updateClientUserPermissions } from '../../../services/clientUsersApi';
import { toast } from 'components/Toaster';
import { getDefaultPermissions } from '../../../constants/permissions';
import { ShieldCheckIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';

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

   return (
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
         <div className="p-6 max-h-[88vh] overflow-y-auto">
            {/* CABECERA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border-subtle">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                     <ShieldCheckIcon className="w-6 h-6" />
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-heading dark:text-white">
                        Permisos Granulares: {client.name ? `${client.name} ${client.last_name || ''}` : client.username}
                     </h2>
                     <p className="text-xs text-text-soft">
                        @{client.username} &bull; {client.email}
                     </p>
                  </div>
               </div>

               {/* SELECTOR DE SCOPE (GLOBAL VS EMPRESA ESPECÍFICA) */}
               {clientEntities.length > 0 && (
                  <div className="flex items-center gap-2">
                     <BuildingOffice2Icon className="w-4 h-4 text-text-soft" />
                     <select
                        value={selectedEntityId || ''}
                        onChange={(e) => setSelectedEntityId(e.target.value ? Number(e.target.value) : null)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border-subtle bg-bg-content text-text-main focus:ring-brand focus:border-brand shadow-2xs"
                     >
                        <option value="">Permisos Globales (Todas las empresas)</option>
                        {clientEntities.map((ent) => (
                           <option key={ent.id} value={ent.id}>
                              {ent.name} ({ent.rut || `ID ${ent.id}`})
                           </option>
                        ))}
                     </select>
                  </div>
               )}
            </div>

            {/* CONTENIDO: MATRIZ */}
            <div className="mt-6">
               <PermissionsMatrix permissions={permissions} onChange={setPermissions} disabled={saving} />
            </div>

            {/* PIE / BOTONES */}
            <div className="mt-6 pt-4 border-t border-border-subtle flex justify-end items-center gap-3">
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
                  className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-brand-strong transition cursor-pointer active:scale-95"
               >
                  Guardar Permisos
               </SpinnerButton>
            </div>
         </div>
      </Modal>
   );
}
