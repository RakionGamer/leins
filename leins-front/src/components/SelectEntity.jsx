import React, { useCallback, useEffect, useRef } from 'react';
import { useEntity } from '../context/EntityContext';
import { useEntities } from '../hooks/useEntities';
import { EntidadesIcon, AbajoIcon } from './icons/SidebarIcons';

export default function SelectEntity({ className = '' }) {
   const { entity, entityId, setEntity } = useEntity();
   const { entities: items, loading } = useEntities({ limit: 200, activeOnly: true, assignedAdminOnly: true });
   const didAutoSelect = useRef(false);

   const clearSelection = useCallback(() => {
      setEntity(null);
      try { localStorage.removeItem('entityId'); } catch {}
      const url = new URL(window.location.href);
      url.searchParams.delete('entityId');
      window.history.replaceState({}, '', url);
   }, [setEntity]);

   const applySelection = useCallback((chosen) => {
      if (!chosen?.id || Number(chosen.id) === Number(entityId)) return;

      const nextEntity = {
         id: Number(chosen.id),
         name: chosen.name || chosen.legal_name || `Entidad ${chosen.id}`,
         rut: chosen.rut || chosen.tax_id || '',
         permissions: chosen.permissions || null,
      };

      setEntity(nextEntity);
      localStorage.setItem('entityId', String(nextEntity.id));
      const url = new URL(window.location.href);
      url.searchParams.set('entityId', String(nextEntity.id));
      window.history.replaceState({}, '', url);
   }, [entityId, setEntity]);

   const selectId = useCallback((id) => {
      const found = items.find((item) => Number(item.id) === Number(id));
      if (!found) return clearSelection();
      applySelection(found);
   }, [items, applySelection, clearSelection]);

   useEffect(() => {
      if (loading) return;

      if (items.length === 0) {
         didAutoSelect.current = false;
         if (entityId) clearSelection();
         return;
      }

      if (entityId) {
         const current = items.find((item) => Number(item.id) === Number(entityId));
         if (!current) {
            didAutoSelect.current = false;
            clearSelection();
            return;
         }

         if (!entity?.name || !entity?.permissions) {
            setEntity({
               id: Number(current.id),
               name: current.name || current.legal_name || `Entidad ${current.id}`,
               rut: current.rut || current.tax_id || '',
               permissions: current.permissions || null,
            });
         }
         return;
      }

      if (!didAutoSelect.current) {
         didAutoSelect.current = true;
         applySelection(items[0]);
      }
   }, [items, loading, entityId, entity?.name, clearSelection, applySelection, setEntity]);

   if (loading || items.length === 0) {
      return null;
   }

   const selectedItem = items.find((item) => Number(item.id) === Number(entityId)) || items[0] || null;

   return (
      <div className={`relative flex items-center gap-2.5 bg-[#EEF3FF] hover:bg-[#E2EAFD] dark:bg-[#0E1F45] dark:hover:bg-[#132856] dark:border dark:border-[#1B315E] rounded-full pl-1.5 pr-4 h-11 transition-all cursor-pointer group shadow-xs ${className}`}>
         {/* Círculo blanco con ícono de entidad oficial */}
         <div className="bg-white dark:bg-[#152D63] rounded-full w-8 h-8 flex items-center justify-center shadow-xs shrink-0">
            <EntidadesIcon className="w-4 h-4 text-[#0A1A3F] dark:text-white" />
         </div>

         {/* Textos: ENTIDAD / Nombre · RUT */}
         <div className="flex flex-col text-left leading-tight min-w-0 pr-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#55607A] dark:text-[#8DA2CC] font-nunito">
               ENTIDAD
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-xs font-bold text-[#0A1A3F] dark:text-white font-nunito truncate max-w-[140px] sm:max-w-[200px] md:max-w-[260px]">
                  {selectedItem ? (selectedItem.name || selectedItem.legal_name || `Entidad ${selectedItem.id}`) : 'Seleccionar entidad'}{selectedItem?.rut ? ` · ${selectedItem.rut}` : ''}
               </span>
               <AbajoIcon className="w-3.5 h-3.5 text-[#0A1A3F] dark:text-[#8DA2CC] shrink-0 transition-transform group-hover:translate-y-0.5" />
            </div>
         </div>

         {/* Select nativo accesible superpuesto transparente */}
         <select
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-sm"
            value={entityId ?? items[0]?.id ?? ''}
            onChange={(e) => selectId(e.target.value)}
            aria-label="Seleccionar entidad"
         >
            {items.map((item) => (
               <option key={item.id} value={item.id}>
                  {item.name || item.legal_name || `ID ${item.id}`} {item.rut ? `- ${item.rut}` : ''}
               </option>
            ))}
         </select>
      </div>
   );
}
