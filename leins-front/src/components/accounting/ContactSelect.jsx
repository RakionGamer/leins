import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline';
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
   onChange,
   onSelect,
   placeholder = 'Buscar o ingresar RUT / Contacto...',
   className = '',
   required = false,
   disabled = false,
}) {
   const [open, setOpen] = useState(false);
   const [contacts, setContacts] = useState([]);
   const [loading, setLoading] = useState(false);
   const [active, setActive] = useState(0);
   const [rect, setRect] = useState(null);
   const inputRef = useRef(null);
   const menuRef = useRef(null);
   const justSelected = useRef(false);

   // Carga inicial o por búsqueda
   const loadContacts = async (query = '', signal) => {
      if (!entityId) return;
      setLoading(true);
      try {
         // Intentar consultar endpoint de contactos
         let data = await getContactsForSelect({ entityId, q: query, limit: 100, signal }).catch(() => null);
         if (!data || !Array.isArray(data)) {
            // Fallback a searchCounterparties si contacts aún no está disponible
            data = await searchCounterparties({ entityId, q: query, signal });
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

   // Al abrir o cambiar valor mientras está abierto
   useEffect(() => {
      if (!open || !entityId) return;
      if (justSelected.current) {
         justSelected.current = false;
         return;
      }

      const ctrl = new AbortController();
      const t = setTimeout(() => {
         loadContacts(value || '', ctrl.signal);
      }, 150);

      return () => {
         clearTimeout(t);
         ctrl.abort();
      };
   }, [open, value, entityId]);

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
      justSelected.current = true;
      if (onSelect) onSelect(item);
      setOpen(false);
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
         if (contacts[active]) handleSelect(contacts[active]);
      } else if (e.key === 'Escape') {
         e.stopPropagation();
         setOpen(false);
      }
   };

   const q = String(value || '').trim();

   const highlight = (text) => {
      const t = String(text || '');
      const idx = t.toLowerCase().indexOf(q.toLowerCase());
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
         <div className="relative">
            <input
               ref={inputRef}
               type="text"
               autoComplete="off"
               disabled={disabled}
               placeholder={placeholder}
               required={required}
               className={`${className} pr-7`}
               value={value || ''}
               onChange={(e) => {
                  onChange(e.target.value);
                  setOpen(true);
               }}
               onFocus={() => {
                  setOpen(true);
                  if (contacts.length === 0) loadContacts(value || '');
               }}
               onKeyDown={onKeyDown}
            />
            {value && (
               <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                     e.stopPropagation();
                     onChange('');
                     if (inputRef.current) inputRef.current.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-soft hover:text-danger p-0.5"
                  title="Limpiar"
               >
                  <XMarkIcon className="w-4 h-4" />
               </button>
            )}
         </div>

         {open && rect && createPortal(
            <div
               ref={menuRef}
               style={{
                  position: 'fixed',
                  top: rect.bottom + 6,
                  left: rect.left,
                  minWidth: Math.max(rect.width, 340),
                  maxWidth: Math.max(rect.width, 450),
                  zIndex: 99999,
               }}
               className="bg-bg-content border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
               <div className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-text-soft bg-surface-1 border-b border-border-subtle/60 flex items-center justify-between">
                  <span>Contactos Registrados</span>
                  <span className="text-brand font-mono font-semibold">{contacts.length} resultado{contacts.length !== 1 ? 's' : ''}</span>
               </div>

               {loading && contacts.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-text-soft flex items-center justify-center gap-2">
                     <span className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                     <span>Cargando contactos...</span>
                  </div>
               ) : contacts.length === 0 ? (
                  <div className="p-4 text-center">
                     <p className="text-xs text-text-soft italic">No se encontraron contactos coincidentes.</p>
                     <p className="text-[11px] text-text-soft/80 mt-1">Puedes continuar ingresándolo manualmente.</p>
                  </div>
               ) : (
                  <ul className="max-h-64 overflow-y-auto divide-y divide-border-subtle/30">
                     {contacts.map((item, i) => (
                        <li
                           key={item.rut + '-' + i}
                           onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(item);
                           }}
                           onMouseEnter={() => setActive(i)}
                           className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                              i === active ? 'bg-brand/10 border-l-4 border-l-brand' : 'border-l-4 border-l-transparent hover:bg-surface-2'
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
                        </li>
                     ))}
                  </ul>
               )}
            </div>,
            document.body
         )}
      </div>
   );
}
