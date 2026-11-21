import React, { useCallback, useEffect, useRef } from 'react';
import { useEntity } from '../context/EntityContext';
import { useEntities } from '../hooks/useEntities';

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

   const selectedItem = items.find((item) => Number(item.id) === Number(entityId)) || items[0] || { name: 'Comercial Andes Demo SpA', rut: '76.999.555-2' };

   return (
      <div className={`relative flex items-center gap-2.5 bg-white border border-[#E2EAFD] hover:border-[#DCE5FF] rounded-xl px-3 py-1.5 shadow-sm transition-all cursor-pointer group ${className}`}>
         <div className="bg-[#EFF3FF] p-1.5 rounded-lg text-[#1F6BFF] shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
         </div>
         <div className="flex flex-col text-left leading-tight min-w-0 pr-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#55607A]">
               ENTIDAD
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-xs font-bold text-[#0A1A3F] truncate max-w-[140px] sm:max-w-[200px] md:max-w-[240px]">
                  {selectedItem.name || selectedItem.legal_name || 'Comercial Andes Demo SpA'}{selectedItem.rut ? ` · ${selectedItem.rut}` : ''}
               </span>
               <svg className="w-3.5 h-3.5 text-[#55607A] shrink-0 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
               </svg>
            </div>
         </div>
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
