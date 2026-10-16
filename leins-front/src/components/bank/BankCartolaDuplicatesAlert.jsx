import React, { useState } from 'react';
import { 
   ChevronDownIcon, 
   ChevronUpIcon,
   ExclamationTriangleIcon,
   CheckIcon
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
   const [expandedGroupId, setExpandedGroupId] = useState(
      duplicateGroups.length === 1 ? duplicateGroups[0].id : null
   );

   if (!duplicateGroups.length) return null;

   const totalDuplicateRows = duplicateGroups.reduce((acc, g) => acc + g.rows.length, 0);

   const toggleRow = (group, excelRowNumber) => {
      const next = new Set(group.selectedRowNumbers);
      if (next.has(excelRowNumber)) {
         next.delete(excelRowNumber);
      } else {
         next.add(excelRowNumber);
      }
      onUpdateGroupSelection(group.id, next);
   };

   const setGroupKeepCount = (e, group, count) => {
      e.stopPropagation();
      if (count === 1) {
         onUpdateGroupSelection(group.id, new Set([group.rows[0].excelRowNumber]));
      } else if (count === 'all') {
         onUpdateGroupSelection(group.id, new Set(group.rows.map((r) => r.excelRowNumber)));
      }
   };

   const toggleAccordion = (groupId) => {
      setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
   };

   return (
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 space-y-3.5">
         {/* Encabezado informativo - estilo neutro y sólido */}
         <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-main)] shrink-0 mt-0.5">
               <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-2" />
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-[var(--heading)] flex items-center gap-2">
                     <span>Movimientos duplicados detectados en el archivo</span>
                     <span className="text-xs px-2 py-0.5 rounded-md font-medium border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-soft)]">
                        {duplicateGroups.length} {duplicateGroups.length === 1 ? 'grupo' : 'grupos'} ({totalDuplicateRows} filas)
                     </span>
                  </div>
               </div>
               <p className="text-xs text-[var(--text-soft)] mt-1 leading-relaxed">
                  Se detectaron filas idénticas (misma fecha, monto y descripción) en esta planilla. Puedes elegir si omitir las copias o cuántas deseas subir.
               </p>
            </div>
         </div>

         {/* Barra de acciones globales y resumen numérico */}
         <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-2">
               <button
                  type="button"
                  onClick={onOmitAllDuplicates}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--heading)] border border-[var(--border-subtle)] transition flex items-center gap-1.5"
               >
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Omitir duplicados (dejar 1 de cada uno)</span>
               </button>
               <button
                  type="button"
                  onClick={onKeepAllDuplicates}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-soft)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition"
               >
                  <span>Conservar todos</span>
               </button>
            </div>

            <div className="text-xs text-[var(--text-soft)]">
               A subir: <span className="font-semibold text-[var(--heading)]">{totalDataRows - totalOmittedCount}</span> de {totalDataRows}
               {totalOmittedCount > 0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                     ({totalOmittedCount} {totalOmittedCount === 1 ? 'omitido' : 'omitidos'})
                  </span>
               )}
            </div>
         </div>

         {/* Lista desplegable interactiva de grupos duplicados */}
         <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {duplicateGroups.map((group) => {
               const isAllSelected = group.selectedRowNumbers.size === group.rows.length;
               const isOnlyOneSelected = group.selectedRowNumbers.size === 1 && group.selectedRowNumbers.has(group.rows[0].excelRowNumber);
               const isExpanded = expandedGroupId === group.id;

               return (
                  <div
                     key={group.id}
                     className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-content)] overflow-hidden transition"
                  >
                     {/* Fila principal del grupo: completamente cliqueable para desplegar/contraer */}
                     <div
                        onClick={() => toggleAccordion(group.id)}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-[var(--surface-1)] select-none transition"
                     >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                           <div className="text-[var(--text-soft)] hover:text-[var(--text-main)] shrink-0">
                              {isExpanded ? (
                                 <ChevronUpIcon className="w-4 h-4" />
                              ) : (
                                 <ChevronDownIcon className="w-4 h-4" />
                              )}
                           </div>
                           <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                 <span className="font-mono text-[var(--text-soft)]">
                                    {group.date}
                                 </span>
                                 <span className="font-semibold text-[var(--heading)]">
                                    {fmtCLP(group.amount)}
                                 </span>
                                 <span className="text-[11px] px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-soft)]">
                                    {group.rows.length} repeticiones
                                 </span>
                                 <span className={`text-[11px] font-medium ${
                                    group.selectedRowNumbers.size === 0 
                                       ? 'text-red-500' 
                                       : group.selectedRowNumbers.size === group.rows.length 
                                          ? 'text-[var(--text-soft)]' 
                                          : 'text-amber-600 dark:text-amber-400'
                                 }`}>
                                    ({group.selectedRowNumbers.size} de {group.rows.length} a subir)
                                 </span>
                              </div>
                              <div className="text-xs text-[var(--text-main)] mt-0.5 truncate" title={group.desc}>
                                 {group.desc || '<Sin descripción>'}
                              </div>
                           </div>
                        </div>

                        {/* Botones rápidos de selección para este grupo */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                           <button
                              type="button"
                              onClick={(e) => setGroupKeepCount(e, group, 1)}
                              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                                 isOnlyOneSelected
                                    ? 'bg-[var(--surface-3)] text-[var(--heading)] border-[var(--border-subtle)] shadow-xs'
                                    : 'bg-[var(--surface-1)] text-[var(--text-soft)] hover:text-[var(--text-main)] border-transparent'
                              }`}
                              title="Deja solo 1 fila y omite las otras"
                           >
                              Dejar 1
                           </button>
                           <button
                              type="button"
                              onClick={(e) => setGroupKeepCount(e, group, 'all')}
                              className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                                 isAllSelected
                                    ? 'bg-[var(--surface-3)] text-[var(--heading)] border-[var(--border-subtle)] shadow-xs'
                                    : 'bg-[var(--surface-1)] text-[var(--text-soft)] hover:text-[var(--text-main)] border-transparent'
                              }`}
                              title="Conservar todas las filas"
                           >
                              Todos ({group.rows.length})
                           </button>
                        </div>
                     </div>

                     {/* Despliegue de filas individuales del Excel */}
                     {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-[var(--border-subtle)] bg-[var(--surface-1)] space-y-1.5">
                           <div className="text-[11px] text-[var(--text-soft)] font-medium pt-1">
                              Selecciona con la casilla las filas que deseas incluir en la subida:
                           </div>
                           <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-md bg-[var(--bg-content)] overflow-hidden">
                              {group.rows.map((row) => {
                                 const isChecked = group.selectedRowNumbers.has(row.excelRowNumber);
                                 return (
                                    <label
                                       key={row.excelRowNumber}
                                       className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition select-none ${
                                          isChecked ? 'hover:bg-[var(--surface-1)]' : 'bg-[var(--surface-1)] opacity-50'
                                       }`}
                                    >
                                       <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleRow(group, row.excelRowNumber)}
                                          className="w-4 h-4 rounded border-[var(--border-subtle)] cursor-pointer"
                                       />
                                       <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                          <div className="font-mono text-[var(--text-soft)]">
                                             Fila #{row.excelRowNumber}
                                          </div>
                                          <div className="text-[var(--text-soft)]">
                                             {row.rawDate || row.date}
                                          </div>
                                          <div className="truncate text-[var(--text-main)]" title={row.desc}>
                                             {row.desc}
                                          </div>
                                          <div className="text-right font-medium text-[var(--heading)]">
                                             {fmtCLP(row.amount)}
                                             {row.doc ? (
                                                <span className="block text-[10px] text-[var(--text-soft)] font-normal">
                                                   Doc: {row.doc}
                                                </span>
                                             ) : null}
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
