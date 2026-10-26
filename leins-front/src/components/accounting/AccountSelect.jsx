import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

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
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${s.pill}`}>
         {s.label}
      </span>
   );
};

const GroupPill = () => (
   <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300">
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
   const [coords, setCoords] = useState(null);

   const triggerRef = useRef(null);
   const menuRef = useRef(null);
   const searchInputRef = useRef(null);

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

   const updateCoords = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - r.bottom;
      const spaceAbove = r.top;

      // Si hay poco espacio abajo (< 260px) y más espacio arriba, abrir hacia arriba
      const openUpwards = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableHeight = openUpwards ? spaceAbove - 16 : spaceBelow - 16;
      const listMaxHeight = Math.min(320, Math.max(160, availableHeight - 65));

      setCoords({
         top: openUpwards ? r.top - 6 : r.bottom + 6,
         left: Math.max(12, Math.min(r.left, viewportWidth - Math.max(r.width, 360) - 12)),
         width: Math.min(Math.max(r.width, 360), viewportWidth - 24),
         openUpwards,
         listMaxHeight,
      });
   };

   useLayoutEffect(() => {
      if (!isOpen) return;
      updateCoords();

      const handleScroll = () => updateCoords();
      const handleResize = () => updateCoords();

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
         window.removeEventListener('resize', handleResize);
         window.removeEventListener('scroll', handleScroll, true);
      };
   }, [isOpen]);

   useEffect(() => {
      if (isOpen) {
         setTimeout(() => {
            searchInputRef.current?.focus();
         }, 50);
      } else {
         setSearch('');
      }
   }, [isOpen]);

   useEffect(() => {
      const handleClickOutside = (event) => {
         if (
            triggerRef.current && !triggerRef.current.contains(event.target) &&
            menuRef.current && !menuRef.current.contains(event.target)
         ) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   useEffect(() => {
      const handleKeyDown = (e) => {
         if (e.key === 'Escape' && isOpen) {
            setIsOpen(false);
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isOpen]);

   return (
      <div className={`relative ${className}`}>
         <div
            ref={triggerRef}
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center justify-between w-full px-3 py-2.5 text-sm bg-surface-1 border rounded-xl cursor-pointer transition select-none ${
               isOpen ? 'border-brand ring-2 ring-brand/20' : 'border-border-subtle hover:border-brand/40'
            }`}
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
                  onClick={(e) => {
                     e.stopPropagation();
                     onChange('', null);
                     setIsOpen(false);
                  }}
                  title="Limpiar selección"
               >
                  <XMarkIcon className="h-4 w-4 text-text-soft hover:text-rose-500" />
               </div>
            ) : null}

            <ChevronDownIcon className={`w-4 h-4 shrink-0 text-text-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
         </div>

         {/* Menú Dropdown renderizado mediante Portal en document.body para evitar recortes de modal / overflow */}
         {isOpen && coords && createPortal(
            <div
               ref={menuRef}
               style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  transform: coords.openUpwards ? 'translateY(-100%)' : undefined,
                  zIndex: 99999,
               }}
               className="bg-bg-content border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
            >
               <div className="p-2.5 border-b border-border-subtle bg-surface-1 shrink-0">
                  <div className="relative">
                     <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
                     <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar por nombre, código o tipo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-bg-content border border-border-subtle rounded-xl focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition placeholder:text-text-soft/60"
                     />
                  </div>
                  <div className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-text-soft flex items-center justify-between">
                     <span>{filteredAccounts.length} cuenta{filteredAccounts.length !== 1 ? 's' : ''} disponible{filteredAccounts.length !== 1 ? 's' : ''}</span>
                     {search && (
                        <button
                           type="button"
                           onClick={() => setSearch('')}
                           className="text-brand hover:underline font-semibold"
                        >
                           Limpiar filtro
                        </button>
                     )}
                  </div>
               </div>

               <div
                  style={{ maxHeight: coords.listMaxHeight }}
                  className="overflow-y-auto overscroll-contain bg-bg-content divide-y divide-border-subtle/30"
               >
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
                                 onChange(acc.id, acc);
                                 setIsOpen(false);
                                 setSearch('');
                              }}
                              className={`flex items-center justify-between gap-3 w-full px-4 py-2.5 text-left cursor-pointer transition-colors border-l-[3px] select-none ${
                                 selected
                                    ? 'bg-brand/10 border-l-brand'
                                    : 'border-l-transparent hover:bg-surface-1'
                              } ${acc.is_title ? 'bg-surface-1/60 opacity-80' : ''}`}
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
            </div>,
            document.body
         )}
      </div>
   );
};

export default AccountSelect;
