import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const typeColors = {
   ACTIVO: 'bg-emerald-500/10 text-emerald-700',
   PASIVO: 'bg-rose-500/10 text-rose-700',
   PATRIMONIO: 'bg-purple-500/10 text-purple-700',
   RESULTADO_GANANCIA: 'bg-blue-500/10 text-blue-700',
   RESULTADO_PERDIDA: 'bg-orange-500/10 text-orange-700',
};

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
            className="flex items-center justify-between w-full px-3 py-2.5 text-sm bg-surface-1 border border-border-subtle rounded-xl cursor-pointer hover:border-brand/30 transition focus:outline-none focus:ring-2 focus:ring-brand/20"
         >
            {selectedAccount ? (
               <div className="flex items-center gap-2 truncate pr-6">
                  <span className="font-mono font-bold text-xs bg-surface-2 px-1.5 py-0.5 rounded text-text-main">{selectedAccount.code}</span>
                  <span className="font-semibold text-text-main truncate">{selectedAccount.name}</span>
               </div>
            ) : (
               <span className="text-text-soft truncate pr-6">{placeholder}</span>
            )}
            
            {allowClear && selectedAccount ? (
               <div 
                  className="absolute right-9 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-2 rounded-md z-10"
                  onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-soft hover:text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
               </div>
            ) : null}
            
            <ChevronDownIcon className={`w-4 h-4 text-text-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
         </div>

         {isOpen && (
            <div className="absolute z-50 w-full mt-2 bg-bg-content border border-border-subtle rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="p-2 border-b border-border-subtle/50 bg-surface-1/50 sticky top-0 z-10 backdrop-blur-md">
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
               </div>
               
               <div className="max-h-60 overflow-y-auto overscroll-contain p-1">
                  {filteredAccounts.length === 0 ? (
                     <div className="p-4 text-center text-xs text-text-soft italic">
                        No se encontraron cuentas contables
                     </div>
                  ) : (
                     filteredAccounts.map(acc => {
                        const typeStyle = typeColors[acc.type] || 'bg-surface-2 text-text-soft';
                        
                        return (
                           <div
                              key={acc.id}
                              onClick={() => {
                                 onChange(acc.id);
                                 setIsOpen(false);
                                 setSearch('');
                              }}
                              className={`flex flex-col gap-1 w-full px-3 py-2 text-left hover:bg-brand/5 rounded-lg cursor-pointer transition ${String(value) === String(acc.id) ? 'bg-brand/10' : ''}`}
                           >
                              <div className="flex items-center justify-between gap-2">
                                 <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono font-bold text-xs bg-surface-2 px-1.5 py-0.5 rounded shadow-sm border border-border-subtle/30 text-text-main">{acc.code}</span>
                                    <span className="font-semibold text-text-main truncate text-sm">{acc.name}</span>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${typeStyle}`}>
                                    {acc.type.replace('_', ' ')}
                                 </span>
                                 {acc.is_title && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                       AGRUPADOR
                                    </span>
                                 )}
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
