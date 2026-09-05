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

   return (
      <div className={`flex items-center gap-2 ${className}`}>
         <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest text-text-soft">
            Entidades
         </span>
         <select
            className="border rounded px-2 py-1 text-sm min-w-[10rem] sm:min-w-[14rem] bg-[var(--surface-1)]"
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
