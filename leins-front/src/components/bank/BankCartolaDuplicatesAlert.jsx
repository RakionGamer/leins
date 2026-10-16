import React, { useState } from 'react';
import { 
   ExclamationTriangleIcon, 
   CheckCircleIcon, 
   ChevronDownIcon, 
   ChevronUpIcon,
   CheckIcon,
   XMarkIcon 
} from '@heroicons/react/24/outline';
import { fmtCLP } from '../../utils/formatters';

export default function BankCartolaDuplicatesAlert({
   duplicateGroups = [],
   onUpdateGroupSelection,
   onOmitAllDuplicates,
   onKeepAllDuplicates,
   totalDataRows = 0,
   totalOmittedCount = 0,
}) {
   const [expandedGroupId, setExpandedGroupId] = useState(null);

   if (!duplicateGroups.length) return null;

   const totalDuplicateRows = duplicateGroups.reduce((acc, g) => acc + g.rows.length, 0);

   const toggleRow = (group, excelRowNumber) => {
      const next = new Set(group.selectedRowNumbers);
      if (next.has(excelRowNumber)) {
         // Si es la única seleccionada, advertir o no dejar vacía (o permitir dejar 0)
         next.delete(excelRowNumber);
      } else {
         next.add(excelRowNumber);
      }
      onUpdateGroupSelection(group.id, next);
   };

   const setGroupKeepCount = (group, count) => {
      if (count === 1) {
         // Conservar solo el primero
         onUpdateGroupSelection(group.id, new Set([group.rows[0].excelRowNumber]));
      } else if (count === 'all') {
         // Conservar todos
         onUpdateGroupSelection(group.id, new Set(group.rows.map((r) => r.excelRowNumber)));
      }
   };

   return (
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 space-y-4 animate-in fade-in duration-150">
         {/* Cabecera de Alerta */}
         <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
               <ExclamationTriangleIcon className="w-5 h-5 stroke-2" />
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[var(--heading)] flex items-center gap-2">
                     <span>Advertencia: {duplicateGroups.length} movimiento{duplicateGroups.length !== 1 ? 's con duplicados' : ' con duplicados'} en la planilla</span>
                     <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {totalDuplicateRows} filas repetidas
                     </span>
                  </h4>
               </div>
               <p className="text-xs text-[var(--text-soft)] mt-1">
                  Se encontraron filas con la misma fecha, monto y descripción dentro del Excel. Si estos movimientos aún no existen en la cuenta bancaria, se crearían registros duplicados. Puedes omitir las copias o seleccionar exactamente cuántos deseas importar antes de subir:
               </p>
            </div>
         </div>

         {/* Botones de Acción Global */}
         <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
            <div className="flex flex-wrap items-center gap-2">
               <button
                  type="button"
                  onClick={onOmitAllDuplicates}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
               >
                  <CheckIcon className="w-3.5 h-3.5 stroke-2" />
                  <span>Omitir duplicados (dejar 1 de cada uno)</span>
               </button>
               <button
                  type="button"
                  onClick={onKeepAllDuplicates}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-main)] border border-[var(--border-subtle)] transition"
               >
                  <span>Conservar todos</span>
               </button>
            </div>

            <div className="text-xs font-medium text-[var(--text-soft)]">
               A subir: <strong className="text-[var(--heading)]">{totalDataRows - totalOmittedCount}</strong> de {totalDataRows} | <span className="text-amber-700 dark:text-amber-400 font-semibold">{totalOmittedCount} omitido{totalOmittedCount !== 1 ? 's' : ''}</span>
            </div>
         </div>

         {/* Lista de Grupos Duplicados */}
         <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {duplicateGroups.map((group, idx) => {
               const isAllSelected = group.selectedRowNumbers.size === group.rows.length;
               const isOnlyOneSelected = group.selectedRowNumbers.size === 1 && group.selectedRowNumbers.has(group.rows[0].excelRowNumber);
               const isExpanded = expandedGroupId === group.id;

               return (
                  <div
                     key={group.id}
                     className="rounded-xl border border-border-subtle/80 bg-[var(--bg-content)] overflow-hidden shadow-sm text-xs"
                  >
                     <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[var(--surface-1)]">
                        <div className="min-w-0 flex-1">
                           <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-[var(--text-main)]">
                                 {group.date}
                              </span>
                              <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                                 group.amount < 0
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              }`}>
                                 {fmtCLP(group.amount)}
                              </span>
                              <span className="text-[var(--text-soft)] text-[11px] bg-[var(--surface-2)] px-2 py-0.5 rounded-full font-semibold">
                                 {group.rows.length} repeticiones
                              </span>
                           </div>
                           <div className="text-xs text-[var(--text-main)] font-medium mt-1 truncate" title={group.desc}>
                              {group.desc || '<Sin descripción>'}
                           </div>
                        </div>

                        {/* Controles por grupo */}
                        <div className="flex items-center gap-1.5 shrink-0">
                           <button
                              type="button"
                              onClick={() => setGroupKeepCount(group, 1)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                                 isOnlyOneSelected
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-[var(--surface-2)] text-[var(--text-soft)] hover:text-[var(--text-main)]'
                              }`}
                              title="Deja solo 1 movimiento y omite el resto"
                           >
                              Dejar 1
                           </button>
                           <button
                              type="button"
                              onClick={() => setGroupKeepCount(group, 'all')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                                 isAllSelected
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'bg-[var(--surface-2)] text-[var(--text-soft)] hover:text-[var(--text-main)]'
                              }`}
                              title="Importa todas las repeticiones"
                           >
                              Todos ({group.rows.length})
                           </button>
                           <button
                              type="button"
                              onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-border-subtle transition ${
                                 !isOnlyOneSelected && !isAllSelected
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold'
                                    : 'hover:bg-[var(--surface-2)] text-[var(--text-soft)]'
                              }`}
                              title="Seleccionar filas específicas"
                           >
                              <span>{group.selectedRowNumbers.size}/{group.rows.length} sel.</span>
                              {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                           </button>
                        </div>
                     </div>

                     {/* Despliegue de filas individuales */}
                     {isExpanded && (
                        <div className="p-3 border-t border-border-subtle bg-[var(--bg-content)] space-y-2">
                           <div className="text-[11px] font-semibold text-[var(--text-soft)] uppercase tracking-wider">
                              Filas individuales detectadas en el Excel (marca las que deseas subir):
                           </div>
                           <div className="divide-y divide-border-subtle/50 border border-border-subtle rounded-lg overflow-hidden">
                              {group.rows.map((row) => {
                                 const isChecked = group.selectedRowNumbers.has(row.excelRowNumber);
                                 return (
                                    <label
                                       key={row.excelRowNumber}
                                       className={`flex items-center gap-3 p-2.5 cursor-pointer transition select-none ${
                                          isChecked ? 'bg-brand/5' : 'bg-[var(--surface-1)] opacity-60'
                                       }`}
                                    >
                                       <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleRow(group, row.excelRowNumber)}
                                          className="w-4 h-4 text-brand rounded border-border-subtle focus:ring-brand cursor-pointer"
                                       />
                                       <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-1.5 text-xs">
                                          <div>
                                             <span className="font-mono font-bold text-brand">Fila #{row.excelRowNumber}</span>
                                          </div>
                                          <div>
                                             <span className="font-mono text-[var(--text-soft)]">{row.rawDate || row.date}</span>
                                          </div>
                                          <div className="truncate" title={row.desc}>
                                             <span className="text-[var(--text-main)]">{row.desc}</span>
                                          </div>
                                          <div className="text-right font-mono font-bold">
                                             <span className={row.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                {fmtCLP(row.amount)}
                                             </span>
                                             {row.doc && (
                                                <span className="block text-[10px] text-[var(--text-soft)] font-normal">
                                                   Doc: {row.doc}
                                                </span>
                                             )}
                                          </div>
                                       </div>
                                    </label>
                                 );
                              })}
                           </div>
                        </div>
                     )}
                  </div>
               );
            })}
         </div>
      </div>
   );
}
