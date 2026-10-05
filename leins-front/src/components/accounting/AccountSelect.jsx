import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon, CheckIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

// Paleta corporativa: tonos sobrios con punto indicador y borde sutil
const typeStyles = {
   ACTIVO: { label: 'Activo', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20', dot: 'bg-emerald-500' },
   PASIVO: { label: 'Pasivo', pill: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20', dot: 'bg-rose-500' },
   PATRIMONIO: { label: 'Patrimonio', pill: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20', dot: 'bg-violet-500' },
   INGRESOS: { label: 'Ingresos', pill: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20', dot: 'bg-sky-500' },
   COSTOS: { label: 'Costos', pill: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20', dot: 'bg-amber-500' },
   GASTOS: { label: 'Gastos', pill: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20', dot: 'bg-orange-500' },
   RESULTADO_GANANCIA: { label: 'Ganancia', pill: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20', dot: 'bg-sky-500' },
   RESULTADO_PERDIDA: { label: 'Pérdida', pill: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20', dot: 'bg-orange-500' },
};
const defaultTypeStyle = { label: '', pill: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300', dot: 'bg-slate-400' };

const getTypeStyle = (type) => {
   const s = typeStyles[type];
   if (s) return s;
   return { ...defaultTypeStyle, label: String(type || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) };
};

const TypePill = ({ type }) => {
   const s = getTypeStyle(type);
   if (!s.label) return null;
   return (
      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${s.pill}`}>
         <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
         {s.label}
      </span>
   );
};

const GroupPill = () => (
   <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300">
      <Squares2X2Icon className="h-3 w-3" />
      Agrupador
   </span>
);

const CodeChip = ({ children, className = '' }) => (
   <span className={`inline-block rounded-md border border-border-subtle bg-surface-2/70 px-2 py-0.5 text-center font-mono text-[11px] font-semibold tracking-tight text-text-soft ${className}`}>
      {children}
   </span>
);

const AccountSelect = ({ accounts = [], value, onChange, className = '', placeholder = 'Seleccionar cuenta...', allowClear = false }) => {
   const [isOpen, setIsOpen] = useState(false);
   const [search, setSearch] = useState('');
   const wrapperRef = useRef(null);

   const selectedAccount = useMemo(() => {
      return accounts.find(a => String(a.id) === String(value)) || null;
   }, [accounts, value]);

   const filteredAccounts = useMemo(() => {
      if (!search.trim()) return accounts;
      const q = search.toLowerCase().trim();
      return accounts.filter(a => {
         const code = (a.code || '').toLowerCase();
         const name = (a.name || '').toLowerCase();
         const type = (a.type || '').toLowerCase();
         return code.includes(q) || name.includes(q) || type.includes(q);
      });
   }, [accounts, search]);

   useEffect(() => {
      const handleClickOutside = (event) => {
         if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   return (
      <div className={`relative ${className}`} ref={wrapperRef}>
         <div
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center justify-between w-full px-3 py-2.5 text-sm bg-surface-1 border rounded-xl cursor-pointer transition ${isOpen ? 'border-brand ring-2 ring-brand/20' : 'border-border-subtle hover:border-brand/40'}`}
         >
            {selectedAccount ? (
               <div className="flex items-center gap-3 truncate pr-10 min-w-0">
                  <CodeChip>{selectedAccount.code}</CodeChip>
                  <span className="font-semibold text-text-main text-sm truncate">
                     {selectedAccount.name}
                  </span>
                  <TypePill type={selectedAccount.type} />
               </div>
            ) : (
               <span className="text-text-soft truncate pr-6">{placeholder}</span>
            )}

            {allowClear && selectedAccount ? (
               <div
                  className="absolute right-9 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-2 rounded-md z-10"
                  onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
               >
                  <XMarkIcon className="h-4 w-4 text-text-soft hover:text-rose-500" />
               </div>
            ) : null}

            <ChevronDownIcon className={`w-4 h-4 shrink-0 text-text-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
         </div>

         {isOpen && (
            <div className="absolute z-50 w-full mt-2 bg-bg-content border border-border-subtle rounded-xl shadow-xl overflow-hidden">
               <div className="p-2.5 border-b border-border-subtle bg-surface-1">
                  <div className="relative">
                     <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
                     <input
                        type="text"
                        autoFocus
                        placeholder="Buscar por nombre, código o tipo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-bg-content border border-border-subtle rounded-lg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-soft/60"
                     />
                  </div>
                  <div className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-text-soft">
                     {filteredAccounts.length} cuenta{filteredAccounts.length !== 1 ? 's' : ''}
                  </div>
               </div>

               <div className="max-h-[300px] overflow-y-auto overscroll-contain bg-bg-content">
                  {filteredAccounts.length === 0 ? (
                     <div className="p-6 text-center text-xs text-text-soft italic">
                        No se encontraron cuentas contables
                     </div>
                  ) : (
                     filteredAccounts.map(acc => {
                        const selected = String(value) === String(acc.id);
                        return (
                           <div
                              key={acc.id}
                              onClick={() => {
                                 onChange(acc.id);
                                 setIsOpen(false);
                                 setSearch('');
                              }}
                              className={`flex items-center justify-between gap-3 w-full px-4 py-2.5 text-left border-b border-border-subtle/40 last:border-b-0 cursor-pointer transition-colors border-l-[3px] ${selected ? 'bg-brand/10 border-l-brand' : 'border-l-transparent hover:bg-surface-1'} ${acc.is_title ? 'bg-surface-1/60' : ''}`}
                           >
                              <div className="flex items-center gap-3 min-w-0">
                                 <CodeChip className="min-w-[76px]">{acc.code}</CodeChip>
                                 <span className={`truncate text-sm ${acc.is_title ? 'font-bold uppercase tracking-wide text-[12px] text-text-main' : 'font-medium text-text-main/90'}`}>
                                    {acc.name}
                                 </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                 {acc.is_title && <GroupPill />}
                                 <TypePill type={acc.type} />
                                 {selected && <CheckIcon className="h-4 w-4 text-brand stroke-2" />}
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>
            </div>
         )}
      </div>
   );
};

export default AccountSelect;
