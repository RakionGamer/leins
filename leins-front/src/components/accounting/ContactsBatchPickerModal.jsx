import React, { useState, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, CheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Modal from '../Modal';
import { getContacts } from '../../services/contactsApi';

const typeConfig = {
   PROVEEDOR: { label: 'Proveedor', pill: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300' },
   CLIENTE: { label: 'Cliente', pill: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300' },
   PRESTADOR_SERVICIOS: { label: 'Prestador BH', pill: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-300' },
   TRABAJADOR: { label: 'Trabajador', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300' },
   OTRO: { label: 'Otro', pill: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300' },
};

const formatRut = (rut) => {
   let value = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
   if (value.length > 9) value = value.slice(0, 9);
   if (value.length <= 1) return value;
   const body = value.slice(0, -1);
   const dv = value.slice(-1);
   const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return `${formattedBody}-${dv}`;
};

export default function ContactsBatchPickerModal({
   isOpen,
   onClose,
   entityId,
   onAddContacts,
   alreadySelectedRuts = [],
}) {
   const [contacts, setContacts] = useState([]);
   const [loading, setLoading] = useState(false);
   const [search, setSearch] = useState('');
   const [selectedType, setSelectedType] = useState('ALL');
   const [checkedRuts, setCheckedRuts] = useState(new Set());

   useEffect(() => {
      if (!isOpen || !entityId) return;
      setCheckedRuts(new Set());
      setSearch('');
      setSelectedType('ALL');

      const load = async () => {
         setLoading(true);
         try {
            const res = await getContacts({ entityId, all: true });
            setContacts(res?.contacts || []);
         } catch (e) {
            setContacts([]);
         } finally {
            setLoading(false);
         }
      };
      load();
   }, [isOpen, entityId]);

   const filteredContacts = useMemo(() => {
      let list = contacts;
      if (selectedType !== 'ALL') {
         list = list.filter((c) => c.type === selectedType);
      }
      if (search.trim()) {
         const q = search.toLowerCase().trim();
         const cleanQ = q.replace(/[.\s-]/g, '');
         list = list.filter(
            (c) =>
               (c.name && c.name.toLowerCase().includes(q)) ||
               (c.rut && c.rut.toLowerCase().includes(q)) ||
               (c.rut && c.rut.replace(/[.\s-]/g, '').includes(cleanQ))
         );
      }
      return list;
   }, [contacts, selectedType, search]);

   const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
   const alreadySelectedClean = useMemo(() => {
      return new Set((alreadySelectedRuts || []).map(cleanRut).filter(Boolean));
   }, [alreadySelectedRuts]);

   const toggleRut = (rut) => {
      if (alreadySelectedClean.has(cleanRut(rut))) return;
      setCheckedRuts((prev) => {
         const next = new Set(prev);
         if (next.has(rut)) next.delete(rut);
         else next.add(rut);
         return next;
      });
   };

   const selectAllVisible = () => {
      setCheckedRuts((prev) => {
         const next = new Set(prev);
         filteredContacts
            .filter((c) => !alreadySelectedClean.has(cleanRut(c.rut)))
            .forEach((c) => next.add(c.rut));
         return next;
      });
   };

   const deselectAll = () => {
      setCheckedRuts(new Set());
   };

   const handleConfirm = () => {
      const selected = contacts.filter((c) => checkedRuts.has(c.rut));
      onAddContacts(selected);
      onClose();
   };

   const ctrl = 'w-full px-3 py-2 text-xs bg-surface-1 border border-border-subtle rounded-xl text-text-main focus:outline-none focus:ring-2 focus:ring-brand';

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Selección Rápida desde Directorio" maxWidth="max-w-2xl">
         <div className="space-y-4">
            <p className="text-xs text-text-soft">
               Marque los contactos que desea asignar masivamente a esta cuenta contable.
            </p>

            {/* Barra de Búsqueda y Pestañas */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
               <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-surface-2/60 rounded-xl border border-border-subtle">
                  {[
                     { key: 'ALL', label: 'Todos' },
                     { key: 'PROVEEDOR', label: 'Proveedores' },
                     { key: 'CLIENTE', label: 'Clientes' },
                     { key: 'PRESTADOR_SERVICIOS', label: 'Prestadores BH' },
                     { key: 'TRABAJADOR', label: 'Trabajadores' },
                  ].map((t) => (
                     <button
                        key={t.key}
                        type="button"
                        onClick={() => setSelectedType(t.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                           selectedType === t.key
                              ? 'bg-brand text-white font-semibold'
                              : 'text-text-soft hover:text-text-main'
                        }`}
                     >
                        {t.label}
                     </button>
                  ))}
               </div>

               <div className="relative w-full sm:w-60">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-text-soft" />
                  <input
                     type="text"
                     placeholder="Filtrar por RUT o Nombre..."
                     className={`${ctrl} pl-8`}
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
            </div>

            {/* Acciones de Selección Rápida */}
            <div className="flex items-center justify-between text-xs text-text-soft px-1">
               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={selectAllVisible}
                     className="text-brand font-semibold hover:underline"
                  >
                     Seleccionar todos los visibles ({filteredContacts.length})
                  </button>
                  {checkedRuts.size > 0 && (
                     <button
                        type="button"
                        onClick={deselectAll}
                        className="text-danger font-semibold hover:underline"
                     >
                        Deseleccionar todos
                     </button>
                  )}
               </div>
               <span>
                  <strong className="text-brand font-bold">{checkedRuts.size}</strong> seleccionados
               </span>
            </div>

            {/* Lista con checkboxes */}
            <div className="border border-border-subtle rounded-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-border-subtle/40 bg-bg-content">
               {loading ? (
                  <div className="p-8 text-center text-xs text-text-soft">
                     Cargando contactos...
                  </div>
               ) : filteredContacts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-text-soft italic">
                     No se encontraron contactos coincidentes.
                  </div>
               ) : (
                  filteredContacts.map((c) => {
                     const isChecked = checkedRuts.has(c.rut);
                     const isAlreadyInRule = alreadySelectedClean.has(cleanRut(c.rut));
                     const config = typeConfig[c.type] || typeConfig.PROVEEDOR;

                     if (isAlreadyInRule) {
                        return (
                           <div
                              key={c.rut}
                              className="flex items-center gap-3 px-4 py-2.5 opacity-50 bg-surface-2/40 cursor-not-allowed select-none"
                              title="Este contacto ya está agregado a la regla"
                           >
                              <input
                                 type="checkbox"
                                 disabled
                                 checked={false}
                                 className="w-4 h-4 text-text-soft/40 rounded border-border-subtle cursor-not-allowed"
                              />
                              <div className="min-w-0 flex-1">
                                 <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-text-soft truncate">
                                       {c.name}
                                    </span>
                                    <span className="text-[10px] text-text-soft italic bg-surface-3 px-1.5 py-0.5 rounded font-medium">
                                       ya agregado
                                    </span>
                                 </div>
                                 <span className="text-[11px] font-mono text-text-soft/70 font-bold">
                                    {formatRut(c.rut)}
                                 </span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${config.pill}`}>
                                 {config.label}
                              </span>
                           </div>
                        );
                     }

                     return (
                        <label
                           key={c.rut}
                           className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition select-none ${
                              isChecked ? 'bg-brand/10' : 'hover:bg-surface-2'
                           }`}
                        >
                           <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRut(c.rut)}
                              className="w-4 h-4 text-brand rounded border-border-subtle focus:ring-brand cursor-pointer"
                           />
                           <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-text-main truncate block">
                                 {c.name}
                              </span>
                              <span className="text-[11px] font-mono text-text-soft font-bold">
                                 {formatRut(c.rut)}
                              </span>
                           </div>
                           <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${config.pill}`}>
                              {config.label}
                           </span>
                        </label>
                     );
                  })
               )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
               <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-text-soft hover:bg-surface-2 rounded-xl transition"
               >
                  Cancelar
               </button>
               <button
                  type="button"
                  disabled={checkedRuts.size === 0}
                  onClick={handleConfirm}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-sm transition disabled:opacity-50"
               >
                  {checkedRuts.size === 1 ? 'Agregar Contacto' : `Agregar (${checkedRuts.size}) Contactos`}
               </button>
            </div>
         </div>
      </Modal>
   );
}
