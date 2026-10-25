import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, XMarkIcon, UserIcon, CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { getContactsForSelect } from '../../services/contactsApi';
import { searchCounterparties } from '../../services/accountingApi';

const typeConfig = {
   PROVEEDOR: { label: 'Proveedor', pill: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300' },
   CLIENTE: { label: 'Cliente', pill: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300' },
   PRESTADOR_SERVICIOS: { label: 'Prestador BH', pill: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-300' },
   TRABAJADOR: { label: 'Trabajador', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300' },
   OTRO: { label: 'Otro', pill: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300' },
};

const ContactBadge = ({ type }) => {
   const config = typeConfig[type] || typeConfig.PROVEEDOR;
   return (
      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${config.pill}`}>
         {config.label}
      </span>
   );
};

export default function ContactSelect({
   entityId,
   value,
   rut,
   name,
   isLocked: propIsLocked,
   alreadySelectedRuts = [],
   onChange,
   onSelect,
   onSelectMultiple,
   onClear,
   placeholder = 'Buscar o ingresar RUT / Contacto...',
   className = '',
   required = false,
   disabled = false,
}) {
   const [open, setOpen] = useState(false);
   const [contacts, setContacts] = useState([]);
   const [selectedRuts, setSelectedRuts] = useState(new Set());
   const [loading, setLoading] = useState(false);
   const [active, setActive] = useState(0);
   const [rect, setRect] = useState(null);
   const [dropdownSearch, setDropdownSearch] = useState('');
   const inputRef = useRef(null);
   const menuRef = useRef(null);
   const dropdownSearchInputRef = useRef(null);
   const justSelected = useRef(false);

   const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
   const alreadySelectedCleanSet = useMemo(() => {
      return new Set((alreadySelectedRuts || []).map(cleanRut).filter(Boolean));
   }, [alreadySelectedRuts]);

   // Determinar si está bloqueado (un contacto ya está seleccionado y fijado)
   const isLocked = propIsLocked !== undefined 
      ? propIsLocked 
      : Boolean(rut && name);

   // Carga inicial o por búsqueda
   const loadContacts = async (query = '', signal) => {
      if (!entityId) return;
      setLoading(true);
      try {
         let searchTerm = String(query || '').trim();
         // Si es un formato "RUT - Nombre", solo buscar por RUT para no fallar
         if (searchTerm.includes(' - ')) {
            searchTerm = searchTerm.split(' - ')[0].trim();
         }

         let data = await getContactsForSelect({ entityId, q: searchTerm, limit: 100, signal }).catch(() => null);
         if (!data || !Array.isArray(data)) {
            data = await searchCounterparties({ entityId, q: searchTerm, signal });
         }
         if (signal && signal.aborted) return;
         setContacts(Array.isArray(data) ? data : []);
         setActive(0);
      } catch (err) {
         if (!signal || !signal.aborted) setContacts([]);
      } finally {
         if (!signal || !signal.aborted) setLoading(false);
      }
   };

   // Cuando se abre el dropdown
   useEffect(() => {
      if (!open || !entityId) return;
      if (justSelected.current) {
         justSelected.current = false;
         return;
      }

      setDropdownSearch('');
      const ctrl = new AbortController();
      // Si el campo ya tiene un contacto fijado, cargamos TODOS los contactos para permitir elegir otro sin filtro previo
      const q = isLocked ? '' : (value || '');
      loadContacts(q, ctrl.signal);

      // Si está bloqueado y abrimos, enfocar el buscador interno del dropdown
      if (isLocked) {
         setTimeout(() => {
            if (dropdownSearchInputRef.current) {
               dropdownSearchInputRef.current.focus();
            }
         }, 50);
      }

      return () => {
         ctrl.abort();
      };
   }, [open, isLocked, entityId]);

   // Búsqueda mientras se escribe en modo desbloqueado
   useEffect(() => {
      if (!open || isLocked || !entityId) return;
      if (justSelected.current) return;

      const ctrl = new AbortController();
      const t = setTimeout(() => {
         loadContacts(value || '', ctrl.signal);
      }, 150);

      return () => {
         clearTimeout(t);
         ctrl.abort();
      };
   }, [value, open, isLocked, entityId]);

   const updateRect = () => {
      if (inputRef.current) {
         setRect(inputRef.current.getBoundingClientRect());
      }
   };

   useLayoutEffect(() => {
      if (!open) return;
      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
      return () => {
         window.removeEventListener('resize', updateRect);
         window.removeEventListener('scroll', updateRect, true);
      };
   }, [open]);

   useEffect(() => {
      const onDown = (e) => {
         if (inputRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
         setOpen(false);
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
   }, []);

   const handleSelect = (item) => {
      if (alreadySelectedCleanSet.has(cleanRut(item.rut))) return;
      justSelected.current = true;
      if (onSelect) onSelect(item);
      setSelectedRuts(new Set());
      setOpen(false);
   };

   const toggleRut = (rutVal) => {
      if (alreadySelectedCleanSet.has(cleanRut(rutVal))) return;
      setSelectedRuts((prev) => {
         const next = new Set(prev);
         if (next.has(rutVal)) next.delete(rutVal);
         else next.add(rutVal);
         return next;
      });
   };

   const handleConfirmMultiple = () => {
      const selected = contacts.filter((c) => selectedRuts.has(c.rut) && !alreadySelectedCleanSet.has(cleanRut(c.rut)));
      if (selected.length === 0) return;
      if (selected.length === 1 && onSelect) {
         onSelect(selected[0]);
      } else if (onSelectMultiple) {
         onSelectMultiple(selected);
      }
      setSelectedRuts(new Set());
      setOpen(false);
   };

   const handleClear = (e) => {
      e.stopPropagation();
      if (onClear) {
         onClear();
      } else if (onChange) {
         onChange('');
      }
      setOpen(false);
      if (inputRef.current) inputRef.current.focus();
   };

   const onKeyDown = (e) => {
      if (!open) {
         if (e.key === 'ArrowDown' || e.key === 'Enter') {
            setOpen(true);
         }
         return;
      }
      if (contacts.length === 0) {
         if (e.key === 'Escape') setOpen(false);
         return;
      }
      if (e.key === 'ArrowDown') {
         e.preventDefault();
         setActive((a) => (a + 1) % contacts.length);
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setActive((a) => (a - 1 + contacts.length) % contacts.length);
      } else if (e.key === 'Enter') {
         e.preventDefault();
         if (selectedRuts.size > 0) {
            handleConfirmMultiple();
         } else if (contacts[active]) {
            handleSelect(contacts[active]);
         }
      } else if (e.key === 'Escape') {
         e.stopPropagation();
         setOpen(false);
      }
   };

   const highlightQuery = isLocked ? dropdownSearch : String(value || '').trim();

   const highlight = (text) => {
      const t = String(text || '');
      const q = highlightQuery.toLowerCase().trim();
      const idx = t.toLowerCase().indexOf(q);
      if (!q || idx < 0) return t;
      return (
         <>
            {t.slice(0, idx)}
            <mark className="bg-brand/20 text-brand font-semibold rounded-sm px-0.5">{t.slice(idx, idx + q.length)}</mark>
            {t.slice(idx + q.length)}
         </>
      );
   };

   return (
      <div className="relative w-full">
         <div 
            className="relative cursor-pointer"
            onClick={(e) => {
               if (disabled) return;
               if (e.target.closest('button')) return;
               if (isLocked) {
                  setOpen((prev) => !prev);
               } else {
                  setOpen(true);
               }
            }}
         >
            <input
               ref={inputRef}
               type="text"
               autoComplete="off"
               disabled={disabled}
               placeholder={placeholder}
               required={required}
               readOnly={isLocked}
               className={`${className} ${
                  isLocked 
                     ? 'bg-surface-2 text-text-main font-semibold cursor-pointer select-none pl-9 pr-14 border-brand/40 shadow-xs' 
                     : 'pr-8'
               }`}
               value={value || ''}
               onChange={(e) => {
                  if (!isLocked && onChange) {
                     onChange(e.target.value);
                     setOpen(true);
                  }
               }}
               onFocus={() => {
                  if (!disabled && !isLocked) {
                     setOpen(true);
                  }
               }}
               onKeyDown={onKeyDown}
            />

            {/* Ícono de contacto fijado a la izquierda si está bloqueado */}
            {isLocked && (
               <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand">
                  <UserIcon className="w-4 h-4" />
               </div>
            )}

            {/* Acciones en el extremo derecho: Botón X para desvincular y Flecha Dropdown */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
               {value && (
                  <button
                     type="button"
                     tabIndex={-1}
                     onClick={handleClear}
                     className="p-1 rounded-md text-text-soft hover:text-danger hover:bg-surface-3 transition"
                     title="Quitar contacto y seleccionar otro"
                  >
                     <XMarkIcon className="w-4 h-4" />
                  </button>
               )}
               <button
                  type="button"
                  tabIndex={-1}
                  className="p-1 text-text-soft hover:text-text-main transition pointer-events-none"
               >
                  <ChevronDownIcon className="w-4 h-4" />
               </button>
            </div>
         </div>

         {/* Menú Dropdown en Portal */}
         {open && rect && createPortal(
            <div
               ref={menuRef}
               style={{
                  position: 'fixed',
                  top: rect.bottom + 6,
                  left: rect.left,
                  minWidth: Math.max(rect.width, 380),
                  maxWidth: Math.max(rect.width, 520),
                  zIndex: 99999,
               }}
               className="bg-bg-content border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
               {/* Barra superior del menú */}
               <div className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-text-soft bg-surface-1 border-b border-border-subtle/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                     <UserIcon className="w-3.5 h-3.5 text-brand" />
                     <span>Contactos Registrados</span>
                  </div>
                  <div className="flex items-center gap-2">
                     {contacts.length > 0 && onSelectMultiple && (
                        <button
                           type="button"
                           onMouseDown={(e) => {
                              e.preventDefault();
                              const selectable = contacts.filter((c) => !alreadySelectedCleanSet.has(cleanRut(c.rut)));
                              if (selectable.length > 0 && selectedRuts.size === selectable.length) {
                                 setSelectedRuts(new Set());
                              } else {
                                 setSelectedRuts(new Set(selectable.map((c) => c.rut)));
                              }
                           }}
                           className="text-[10px] font-semibold text-brand hover:underline"
                        >
                           {selectedRuts.size > 0 && selectedRuts.size === contacts.filter((c) => !alreadySelectedCleanSet.has(cleanRut(c.rut))).length
                              ? 'Deseleccionar todos'
                              : 'Seleccionar todos'}
                        </button>
                     )}
                     <span className="text-brand font-mono font-semibold">{contacts.length} resultado{contacts.length !== 1 ? 's' : ''}</span>
                  </div>
               </div>

               {/* Buscador interno dentro del dropdown cuando el campo está bloqueado */}
               {isLocked && (
                  <div className="p-2 border-b border-border-subtle/60 bg-surface-1">
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-soft" />
                        <input
                           ref={dropdownSearchInputRef}
                           type="text"
                           placeholder="Filtrar por RUT o Razón Social..."
                           className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-content border border-border-subtle rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-brand"
                           value={dropdownSearch}
                           onChange={(e) => {
                              setDropdownSearch(e.target.value);
                              loadContacts(e.target.value);
                           }}
                           onClick={(e) => e.stopPropagation()}
                           onMouseDown={(e) => e.stopPropagation()}
                        />
                     </div>
                  </div>
               )}

               {/* Lista de resultados */}
               {loading && contacts.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-text-soft flex items-center justify-center gap-2">
                     <span className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                     <span>Cargando contactos...</span>
                  </div>
               ) : contacts.length === 0 ? (
                  <div className="p-5 text-center">
                     <p className="text-xs text-text-soft italic">No se encontraron contactos coincidentes.</p>
                     <p className="text-[11px] text-text-soft/80 mt-1">
                        {isLocked ? 'Prueba con otro término de búsqueda.' : 'Puedes ingresar el contacto manualmente si es nuevo.'}
                     </p>
                  </div>
               ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border-subtle/30">
                     {contacts.map((item, i) => {
                        const itemCleanRut = cleanRut(item.rut);
                        const isAlreadyInRule = alreadySelectedCleanSet.has(itemCleanRut);
                        const isChecked = selectedRuts.has(item.rut);

                        if (isAlreadyInRule) {
                           return (
                              <div
                                 key={item.rut + '-' + i}
                                 className="flex items-center justify-between gap-3 px-3.5 py-2.5 opacity-50 bg-surface-2/40 cursor-not-allowed select-none"
                                 title="Este contacto ya está agregado a la regla"
                              >
                                 {onSelectMultiple && (
                                    <input
                                       type="checkbox"
                                       disabled
                                       checked={false}
                                       className="w-4 h-4 rounded border-border-subtle text-text-soft/40 cursor-not-allowed shrink-0"
                                    />
                                 )}
                                 <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                       <span className="text-sm font-semibold text-text-soft truncate">
                                          {item.name || 'Sin razón social'}
                                       </span>
                                       <span className="text-[10px] bg-surface-3 text-text-soft px-1.5 py-0.5 rounded font-semibold italic shrink-0">
                                          Ya en la regla
                                       </span>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-text-soft/70 mt-0.5">
                                       {item.formattedRut || item.rut}
                                    </div>
                                 </div>
                                 <div className="shrink-0">
                                    <ContactBadge type={item.type} />
                                 </div>
                              </div>
                           );
                        }

                        if (onSelectMultiple) {
                           return (
                              <label
                                 key={item.rut + '-' + i}
                                 onMouseEnter={() => setActive(i)}
                                 className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer select-none transition-colors ${
                                    isChecked
                                       ? 'bg-brand/10 border-l-4 border-l-brand'
                                       : i === active
                                          ? 'bg-surface-2 border-l-4 border-l-brand/50'
                                          : 'border-l-4 border-l-transparent hover:bg-surface-2'
                                 }`}
                              >
                                 <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleRut(item.rut)}
                                    className="w-4 h-4 rounded border-border-subtle text-brand focus:ring-brand cursor-pointer shrink-0"
                                 />
                                 <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-text-main truncate">
                                       {item.name ? highlight(item.name) : <span className="italic font-normal text-text-soft">Sin razón social</span>}
                                    </div>
                                    <div className="text-xs font-mono font-bold text-text-soft mt-0.5">
                                       {highlight(item.formattedRut || item.rut)}
                                    </div>
                                 </div>
                                 <div className="shrink-0">
                                    <ContactBadge type={item.type} />
                                 </div>
                              </label>
                           );
                        }

                        return (
                           <div
                              key={item.rut + '-' + i}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setActive(i)}
                              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                                 i === active
                                    ? 'bg-surface-2 border-l-4 border-l-brand/50'
                                    : 'border-l-4 border-l-transparent hover:bg-surface-2'
                              }`}
                           >
                              <div className="min-w-0 flex-1">
                                 <div className="text-sm font-semibold text-text-main truncate">
                                    {item.name ? highlight(item.name) : <span className="italic font-normal text-text-soft">Sin razón social</span>}
                                 </div>
                                 <div className="text-xs font-mono font-bold text-text-soft mt-0.5">
                                    {highlight(item.formattedRut || item.rut)}
                                 </div>
                              </div>
                              <div className="shrink-0">
                                 <ContactBadge type={item.type} />
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}

               {/* Barra de acción cuando hay selección múltiple activa */}
               {onSelectMultiple && selectedRuts.size > 0 && (
                  <div className="p-2.5 bg-surface-1 border-t border-border-subtle/70 flex items-center justify-between gap-3">
                     <div className="text-xs font-semibold text-text-main">
                        <span className="text-brand font-bold">{selectedRuts.size}</span> seleccionado{selectedRuts.size !== 1 ? 's' : ''}
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           type="button"
                           onClick={() => setSelectedRuts(new Set())}
                           className="px-2.5 py-1 text-xs text-text-soft hover:text-danger rounded-lg transition"
                        >
                           Limpiar
                        </button>
                        <button
                           type="button"
                           onClick={handleConfirmMultiple}
                           className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow transition flex items-center gap-1.5"
                        >
                           <CheckIcon className="w-4 h-4 stroke-2" />
                           {selectedRuts.size === 1 ? 'Agregar' : `Agregar (${selectedRuts.size})`}
                        </button>
                     </div>
                  </div>
               )}
            </div>,
            document.body
         )}
      </div>
   );
}
