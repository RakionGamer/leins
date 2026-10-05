import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { searchCounterparties } from '../../services/accountingApi';

/**
 * Input con autocompletado de contrapartes (RUT o razón social).
 * El dropdown se renderiza en un portal con posición fija para no ser
 * recortado por contenedores con overflow (ej. cuerpo del modal).
 */
const CounterpartyInput = ({ entityId, value, onChange, onSelect, placeholder, className = '', mono = false, required = false }) => {
   const [open, setOpen] = useState(false);
   const [results, setResults] = useState([]);
   const [loading, setLoading] = useState(false);
   const [active, setActive] = useState(0);
   const [rect, setRect] = useState(null);
   const inputRef = useRef(null);
   const menuRef = useRef(null);
   const justSelected = useRef(false);

   // Búsqueda con debounce
   useEffect(() => {
      if (justSelected.current) { justSelected.current = false; return; }
      const q = String(value || '').trim();
      if (!open || q.length < 2 || !entityId) { setResults([]); setLoading(false); return; }
      setLoading(true);
      const ctrl = new AbortController();
      const t = setTimeout(async () => {
         const data = await searchCounterparties({ entityId, q, signal: ctrl.signal });
         if (!ctrl.signal.aborted) { setResults(data); setActive(0); setLoading(false); }
      }, 250);
      return () => { clearTimeout(t); ctrl.abort(); };
   }, [value, open, entityId]);

   const updateRect = () => {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
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

   const pick = (item) => {
      justSelected.current = true;
      onSelect(item);
      setOpen(false);
      setResults([]);
   };

   const onKeyDown = (e) => {
      if (!open || results.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
      else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
   };

   const q = String(value || '').trim();
   const showMenu = open && rect && q.length >= 2 && (loading || results.length > 0 || !loading);

   const highlight = (text) => {
      const t = String(text || '');
      const idx = t.toLowerCase().indexOf(q.toLowerCase());
      if (!q || idx < 0) return t;
      return (
         <>
            {t.slice(0, idx)}
            <mark className="bg-brand/15 text-brand rounded-sm px-0.5">{t.slice(idx, idx + q.length)}</mark>
            {t.slice(idx + q.length)}
         </>
      );
   };

   return (
      <>
         <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            required={required}
            className={`${className} ${mono ? 'font-mono' : ''}`}
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
         />
         {showMenu && createPortal(
            <div
               ref={menuRef}
               style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, minWidth: Math.max(rect.width, 320), zIndex: 120 }}
               className="bg-bg-content border border-border-subtle rounded-xl shadow-xl overflow-hidden"
            >
               {loading && results.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-text-soft flex items-center gap-2">
                     <span className="w-3.5 h-3.5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                     Buscando...
                  </div>
               ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-text-soft italic">Sin coincidencias. Puedes ingresar el dato manualmente.</div>
               ) : (
                  <>
                     <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-soft bg-surface-1 border-b border-border-subtle/60">
                        {results.length} resultado{results.length !== 1 ? 's' : ''}
                     </div>
                     <ul className="max-h-64 overflow-y-auto">
                        {results.map((r, i) => (
                           <li
                              key={r.rut}
                              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                              onMouseEnter={() => setActive(i)}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-l-4 transition-colors ${i === active ? 'bg-brand/10 border-l-brand' : 'border-l-transparent'}`}
                           >
                              <div className="p-1.5 rounded-lg bg-surface-2 text-text-soft shrink-0">
                                 <BuildingOffice2Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                 <div className="text-sm font-semibold text-text-main truncate">
                                    {r.name ? highlight(r.name) : <span className="italic font-normal text-text-soft">Sin razón social</span>}
                                 </div>
                                 <div className="text-xs font-mono text-text-soft">{highlight(r.rut)}</div>
                              </div>
                           </li>
                        ))}
                     </ul>
                  </>
               )}
            </div>,
            document.body
         )}
      </>
   );
};

export default CounterpartyInput;
