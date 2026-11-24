// leins-front/src/pages/superAdmin/components/ClientEntitiesModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import SpinnerButton from 'components/SpinnerButton';
import { updateClientUser } from '../../../services/clientUsersApi';
import { useEntities } from '../../../hooks/useEntities';
import { toast } from 'components/Toaster';
import { CheckIcon } from '@heroicons/react/24/outline';

export default function ClientEntitiesModal({ isOpen, onClose, client, onSuccess }) {
   const [selectedEntityIds, setSelectedEntityIds] = useState([]);
   const [saving, setSaving] = useState(false);

   const { entities: availableEntities, loading: loadingEntities } = useEntities({
      limit: 100,
      activeOnly: true,
   });

   useEffect(() => {
      if (!client) return;
      const currentIds = (client.entities || []).map((e) => Number(e.id));
      setSelectedEntityIds(currentIds);
   }, [client]);

   if (!isOpen || !client) return null;

   const handleToggle = (id) => {
      const numId = Number(id);
      setSelectedEntityIds((prev) =>
         prev.includes(numId) ? prev.filter((x) => x !== numId) : [...prev, numId]
      );
   };

   const handleSave = async () => {
      setSaving(true);
      try {
         await updateClientUser({
            userId: client.id,
            entityIds: selectedEntityIds,
         });

         toast.success('Empresas asignadas actualizadas');
         onSuccess?.();
         onClose();
      } catch (err) {
         toast.error(err?.message || 'Error al actualizar empresas');
      } finally {
         setSaving(false);
      }
   };

   const clientDisplayName = client?.name
      ? `${client.name} ${client.last_name || ''}`.trim()
      : client?.username;

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         maxWidth="max-w-2xl"
         title={`Empresas Asignadas — ${clientDisplayName}`}
      >
         <div className="space-y-4">
            <p className="text-xs text-[#55607A] -mt-1 pb-3 border-b border-[#E2EAFD]">
               Marca las empresas que este cliente podrá gestionar en el portal.
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#E2EAFD]/60 rounded-2xl border border-[#E2EAFD] bg-white p-2">
               {loadingEntities ? (
                  <p className="p-4 text-center text-xs text-[#55607A]">Cargando empresas...</p>
               ) : availableEntities?.length === 0 ? (
                  <p className="p-4 text-center text-xs text-[#55607A]">No hay empresas disponibles.</p>
               ) : (
                  availableEntities?.map((ent) => {
                     const isChecked = selectedEntityIds.includes(Number(ent.id));
                     return (
                        <div
                           key={ent.id}
                           onClick={() => handleToggle(ent.id)}
                           className={`flex items-center justify-between p-3 hover:bg-[#F9FBFF] rounded-xl cursor-pointer transition select-none ${
                              isChecked ? 'bg-[#F0F4FD]' : ''
                           }`}
                        >
                           <div className="min-w-0 pr-3">
                              <p className="text-sm font-bold text-[#0A1A3F] truncate">
                                 {ent.name || ent.legal_name}
                              </p>
                              <p className="text-xs text-[#55607A]">{ent.rut || ent.tax_id}</p>
                           </div>

                           <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                                 isChecked
                                    ? 'bg-[#1F6BFF] border-[#1F6BFF] text-white shadow-xs'
                                    : 'border-[#D9E2EC] bg-white text-transparent'
                              }`}
                           >
                              <CheckIcon className="w-4 h-4 stroke-[3]" />
                           </div>
                        </div>
                     );
                  })
               )}
            </div>

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
                  loading={saving}
                  onClick={handleSave}
                  className="px-6 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
               >
                  Guardar Asignaciones
               </SpinnerButton>
            </div>
         </div>
      </Modal>
   );
}
