// leins-front/src/pages/superAdmin/components/ClientPermissionsModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import PermissionsMatrix from './PermissionsMatrix';
import SpinnerButton from 'components/SpinnerButton';
import { updateClientUserPermissions } from '../../../services/clientUsersApi';
import { toast } from 'components/Toaster';
import { getDefaultPermissions } from '../../../constants/permissions';
import { EntidadesIcon } from '../../../components/icons/SidebarIcons';

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8FAFF] border border-[#E2EAFD]">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] text-[#1F6BFF] font-nunito font-bold flex items-center justify-center text-sm shrink-0">
                     {client.name?.[0] || client.username?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <div>
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#0A1A3F] font-nunito">
                           {clientDisplayName}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EFF3FF] text-[#1F6BFF] font-bold border border-[#DCE5FF]">
                           @{client.username}
                        </span>
                     </div>
                     <p className="text-xs text-[#55607A] mt-0.5">{client.email}</p>
                  </div>
               </div>

               {/* SELECTOR DE ALCANCE (GLOBAL VS EMPRESA ESPECÍFICA) */}
               <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E2EAFD] shadow-xs">
                  <EntidadesIcon className="w-4 h-4 text-[#1F6BFF] shrink-0" />
                  <span className="text-xs font-semibold text-[#55607A] hidden sm:inline">Alcance:</span>
                  <select
                     value={selectedEntityId || ''}
                     onChange={(e) => setSelectedEntityId(e.target.value ? Number(e.target.value) : null)}
                     className="text-xs font-semibold px-2 py-1 rounded-lg border-0 bg-transparent text-[#0A1A3F] focus:ring-0 focus:outline-none cursor-pointer"
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
            <div className="pt-4 border-t border-[#E2EAFD] flex items-center justify-end gap-3">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-full border border-[#E2EAFD] text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#F8FAFF] text-xs font-bold transition cursor-pointer"
               >
                  Cancelar
               </button>
               <SpinnerButton
                  loading={saving}
                  onClick={handleSave}
                  className="px-6 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
               >
                  Guardar Permisos
               </SpinnerButton>
            </div>
         </div>
      </Modal>
   );
}

