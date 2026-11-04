import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
   ChevronDownIcon,
   MagnifyingGlassIcon,
   XMarkIcon,
   CheckIcon,
   PlusIcon,
} from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { createAccount } from '../../services/accountingApi';
import { toast } from '../Toaster';
import Modal from '../Modal';

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
      Mayor / Agrupador
   </span>
);

const AuxPill = () => (
   <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
      Auxiliar
   </span>
);

const CodeChip = ({ children, className = '' }) => (
   <span className={`inline-block rounded-md border border-border-subtle bg-surface-2/70 px-2 py-0.5 text-center font-mono text-[11px] font-semibold tracking-tight text-text-soft ${className}`}>
      {children}
   </span>
);

function pad2(n) {
   return String(n).padStart(2, '0');
}

function suggestMajorCode(type, accounts) {
   const base = { ACTIVO: 1, PASIVO: 2, PATRIMONIO: 3, INGRESOS: 4, COSTOS: 5, GASTOS: 61 }[type] || 61;
   const firsts = (accounts || [])
      .filter(a => a.type === type && (a.is_title || String(a.code).endsWith('.00.00') || String(a.code).endsWith('.00')))
      .map(a => parseInt(String(a.code).split('.')[0], 10))
      .filter(n => !isNaN(n));
   if (firsts.length === 0) return `${pad2(base)}.00.00`;
   return `${pad2(Math.max(...firsts) + 1)}.00.00`;
}

function suggestChildCode(parentCode, accounts) {
   const [p0, p1] = String(parentCode || '').split('.');
   if (!p0) return '61.04.10';
   const siblings = (accounts || []).map(a => String(a.code).split('.')).filter(p => p[0] === p0);
   if (p1 === '00' || !p1) {
      // Padre mayor -> subgrupo XX.YY.00
      const nums = siblings.filter(p => p[1] && p[1] !== '00').map(p => parseInt(p[1], 10)).filter(n => !isNaN(n));
      return `${p0}.${pad2((nums.length ? Math.max(...nums) : 0) + 1)}.00`;
   }
   // Padre subgrupo -> detalle XX.YY.ZZ
   const nums = siblings.filter(p => p[1] === p1 && p[2] && p[2] !== '00').map(p => parseInt(p[2], 10)).filter(n => !isNaN(n));
   const maxNum = nums.length ? Math.max(...nums) : 0;
   const step = (maxNum % 10 === 0 && maxNum >= 10) ? 10 : 1;
   const next = maxNum + step;
   return `${p0}.${p1}.${pad2(next)}`;
}

function getSuggestedCode(type, accounts) {
   const accountsOfType = (accounts || []).filter(a => a.type === type);
   if (accountsOfType.length === 0) {
      if (type === 'ACTIVO') return '01.01.10';
      if (type === 'PASIVO') return '02.01.10';
      if (type === 'PATRIMONIO') return '03.01.10';
      if (type === 'INGRESOS') return '04.01.10';
      if (type === 'COSTOS') return '05.01.10';
      if (type === 'GASTOS') return '61.01.10';
      return '60.01.10';
   }

   const leafAccounts = accountsOfType.filter(a => !a.is_title && !String(a.code).endsWith('.00'));
   if (leafAccounts.length > 0) {
      leafAccounts.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
      const lastCode = leafAccounts[leafAccounts.length - 1].code;
      const parts = lastCode.split('.');
      if (parts.length >= 3) {
         const lastNum = parseInt(parts[parts.length - 1], 10);
         if (!isNaN(lastNum)) {
            const step = (lastNum % 10 === 0 && lastNum >= 10) ? 10 : 1;
            parts[parts.length - 1] = pad2(lastNum + step);
            return parts.join('.');
         }
      }
   }

   accountsOfType.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
   const lastCode = accountsOfType[accountsOfType.length - 1].code;
   const parts = lastCode.split('.');
   const lastNum = parseInt(parts[parts.length - 1], 10);
   if (!isNaN(lastNum)) {
      parts[parts.length - 1] = pad2(lastNum + 10);
      return parts.join('.');
   }
   return lastCode + '.10';
}

const AccountSelect = ({
   accounts = [],
   value,
   onChange,
   className = '',
   placeholder = 'Seleccionar cuenta...',
   allowClear = false,
   canCreate: propCanCreate,
   onAccountCreated,
   entityId: propEntityId,
}) => {
   const queryClient = useQueryClient();
   const { entityId: hookEntityId, permissions } = useEntityRequired();
   const currentEntityId = propEntityId || hookEntityId;
   const canCreate = propCanCreate ?? ((permissions?.can_create ?? true) && (permissions?.can_update ?? true));

   const [localAccounts, setLocalAccounts] = useState(accounts);
   useEffect(() => {
      setLocalAccounts(accounts);
   }, [accounts]);

   const [isOpen, setIsOpen] = useState(false);
   const [search, setSearch] = useState('');
   const [coords, setCoords] = useState(null);

   const triggerRef = useRef(null);
   const menuRef = useRef(null);
   const searchInputRef = useRef(null);

   // Modal de creación rápida de cuenta
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
   const [createForm, setCreateForm] = useState({
      kind: 'AUXILIAR', // 'AUXILIAR' (imputable) | 'MAYOR' (agrupador)
      name: '',
      type: 'GASTOS',
      parentCode: '',
      code: '',
      requireRut: true,
   });
   const [creating, setCreating] = useState(false);
   const [createError, setCreateError] = useState(null);

   const selectedAccount = useMemo(() => {
      return localAccounts.find(a => String(a.id) === String(value)) || null;
   }, [localAccounts, value]);

   const filteredAccounts = useMemo(() => {
      if (!search.trim()) return localAccounts;
      const q = search.toLowerCase().trim();
      return localAccounts.filter(a => {
         const code = (a.code || '').toLowerCase();
         const name = (a.name || '').toLowerCase();
         const type = (a.type || '').toLowerCase();
         return code.includes(q) || name.includes(q) || type.includes(q);
      });
   }, [localAccounts, search]);

   const availableParents = useMemo(() => {
      return (localAccounts || [])
         .filter(a => a.type === createForm.type && (a.is_title || String(a.code).endsWith('.00')))
         .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
   }, [localAccounts, createForm.type]);

   const updateCoords = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - r.bottom;
      const spaceAbove = r.top;

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

   // Apertura del modal de creación rápida
   const handleOpenCreateModal = (e) => {
      e?.stopPropagation?.();
      setIsOpen(false);

      const initialType = 'GASTOS';
      const parents = (localAccounts || [])
         .filter(a => a.type === initialType && (a.is_title || String(a.code).endsWith('.00')))
         .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

      const defaultParent = parents.find(p => String(p.code).startsWith('61.04')) || parents[0] || null;
      const defaultParentCode = defaultParent ? defaultParent.code : '';

      const suggestedCode = defaultParentCode
         ? suggestChildCode(defaultParentCode, localAccounts)
         : getSuggestedCode(initialType, localAccounts);

      setCreateForm({
         kind: 'AUXILIAR',
         name: search.trim(),
         type: initialType,
         parentCode: defaultParentCode,
         code: suggestedCode,
         requireRut: true,
      });
      setCreateError(null);
      setIsCreateModalOpen(true);
   };

   const handleKindChange = (kind) => {
      if (kind === 'MAYOR') {
         const code = suggestMajorCode(createForm.type, localAccounts);
         setCreateForm(prev => ({
            ...prev,
            kind,
            parentCode: '',
            code,
            requireRut: false,
         }));
      } else {
         const defaultParentCode = availableParents[0] ? availableParents[0].code : '';
         const code = defaultParentCode
            ? suggestChildCode(defaultParentCode, localAccounts)
            : getSuggestedCode(createForm.type, localAccounts);
         setCreateForm(prev => ({
            ...prev,
            kind,
            parentCode: defaultParentCode,
            code,
            requireRut: ['GASTOS', 'COSTOS', 'ACTIVO', 'PASIVO'].includes(prev.type),
         }));
      }
   };

   const handleTypeChange = (newType) => {
      const parents = (localAccounts || [])
         .filter(a => a.type === newType && (a.is_title || String(a.code).endsWith('.00')))
         .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

      const defaultParentCode = parents[0] ? parents[0].code : '';
      const suggestedCode = createForm.kind === 'MAYOR'
         ? suggestMajorCode(newType, localAccounts)
         : (defaultParentCode ? suggestChildCode(defaultParentCode, localAccounts) : getSuggestedCode(newType, localAccounts));

      setCreateForm(prev => ({
         ...prev,
         type: newType,
         parentCode: defaultParentCode,
         code: suggestedCode,
         requireRut: ['GASTOS', 'COSTOS', 'ACTIVO', 'PASIVO'].includes(newType) && prev.kind === 'AUXILIAR',
      }));
   };

   const handleParentChange = (newParentCode) => {
      const suggestedCode = newParentCode
         ? suggestChildCode(newParentCode, localAccounts)
         : getSuggestedCode(createForm.type, localAccounts);

      setCreateForm(prev => ({
         ...prev,
         parentCode: newParentCode,
         code: suggestedCode,
      }));
   };

   const handleCreateSubmit = async (e) => {
      e.preventDefault();
      if (!currentEntityId) {
         toast.error('No se ha detectado una empresa/entidad activa.');
         return;
      }
      if (!createForm.name.trim()) {
         setCreateError('El nombre de la cuenta es obligatorio.');
         return;
      }
      if (!createForm.code.trim()) {
         setCreateError('El código contable es obligatorio.');
         return;
      }

      setCreating(true);
      setCreateError(null);
      try {
         const isMayor = createForm.kind === 'MAYOR';
         const newAccount = await createAccount({
            entityId: currentEntityId,
            name: createForm.name.trim(),
            code: createForm.code.trim(),
            type: createForm.type,
            nature: ['ACTIVO', 'COSTOS', 'GASTOS'].includes(createForm.type) ? 'DEUDORA' : 'ACREEDORA',
            cost_center_requirement: 'NONE',
            require_rut: Boolean(createForm.requireRut && !isMayor),
            require_reference: false,
            is_auxiliary: !isMayor,
            is_title: isMayor,
         });

         const tipoTexto = isMayor ? 'mayor' : 'auxiliar';
         toast.success(`Cuenta ${tipoTexto} "${newAccount.code} - ${newAccount.name}" creada y seleccionada.`);
         setLocalAccounts(prev => [...prev, newAccount]);
         onChange(newAccount.id, newAccount);
         onAccountCreated?.(newAccount);
         queryClient?.invalidateQueries?.({ queryKey: ['accountingAccounts'] });
         setIsCreateModalOpen(false);
         setSearch('');
      } catch (err) {
         setCreateError(err.message || 'Error al crear la cuenta contable');
      } finally {
         setCreating(false);
      }
   };

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
                  <div className="flex items-center gap-1.5 shrink-0">
                     {selectedAccount.is_title ? <GroupPill /> : <AuxPill />}
                     <TypePill type={selectedAccount.type} />
                  </div>
               </div>
            ) : (
               <span className="text-text-soft truncate pr-6">{placeholder}</span>
            )}

            {allowClear && selectedAccount ? (
               <div
                  className="absolute right-9 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-2 rounded-md z-10 cursor-pointer"
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
                     <div className="flex items-center gap-2">
                        {search && (
                           <button
                              type="button"
                              onClick={() => setSearch('')}
                              className="text-text-soft hover:text-text-main font-semibold cursor-pointer"
                           >
                              Limpiar
                           </button>
                        )}
                        {canCreate && (
                           <button
                              type="button"
                              onClick={handleOpenCreateModal}
                              className="text-brand hover:underline font-semibold cursor-pointer"
                           >
                              + Nueva cuenta
                           </button>
                        )}
                     </div>
                  </div>
               </div>

               <div
                  style={{ maxHeight: coords.listMaxHeight }}
                  className="overflow-y-auto overscroll-contain bg-bg-content divide-y divide-border-subtle/30"
               >
                  {filteredAccounts.length === 0 ? (
                     <div className="p-6 text-center space-y-3">
                        <p className="text-xs text-text-soft">
                           {search ? (
                              <>No se encontró ninguna cuenta que coincida con "<strong className="text-text-main">{search}</strong>"</>
                           ) : (
                              'No hay cuentas contables registradas'
                           )}
                        </p>
                        {canCreate && (
                           <button
                              type="button"
                              onClick={handleOpenCreateModal}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 rounded-xl transition cursor-pointer"
                           >
                              <PlusIcon className="w-4 h-4 stroke-2" />
                              <span>Crear cuenta {search ? `"${search}"` : ''}</span>
                           </button>
                        )}
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
                                 {acc.is_title ? <GroupPill /> : <AuxPill />}
                                 <TypePill type={acc.type} />
                                 {selected && <CheckIcon className="h-4 w-4 text-brand stroke-2" />}
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>

               {canCreate && filteredAccounts.length > 0 && (
                  <div className="p-2 border-t border-border-subtle bg-surface-1 shrink-0">
                     <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/10 rounded-xl transition cursor-pointer"
                     >
                        <PlusIcon className="w-4 h-4 stroke-2" />
                        <span>Crear nueva cuenta contable</span>
                     </button>
                  </div>
               )}
            </div>,
            document.body
         )}

         {/* Modal de Creación Rápida de Cuenta Contable */}
         <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Nueva Cuenta Contable"
            maxWidth="max-w-lg"
            zIndex="z-[150]"
         >
            <form onSubmit={handleCreateSubmit} className="space-y-4">
               {createError && (
                  <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger font-medium">
                     {createError}
                  </div>
               )}

               {/* Estructura: Auxiliar vs Mayor */}
               <div>
                  <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider mb-1.5">
                     Estructura de la cuenta
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-2 border border-border-subtle">
                     {[
                        ['AUXILIAR', 'Cuenta auxiliar (imputable)'],
                        ['MAYOR', 'Cuenta mayor (agrupador)'],
                     ].map(([k, label]) => (
                        <button
                           key={k}
                           type="button"
                           onClick={() => handleKindChange(k)}
                           className={`h-9 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              createForm.kind === k
                                 ? 'bg-brand text-white shadow-xs'
                                 : 'text-text-soft hover:text-heading hover:bg-surface-1'
                           }`}
                        >
                           {label}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Nombre */}
               <div>
                  <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider mb-1">
                     Nombre de la cuenta <span className="text-danger">*</span>
                  </label>
                  <input
                     type="text"
                     autoFocus
                     required
                     value={createForm.name}
                     onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                     placeholder="Ej: Licencias de Software, Publicidad Redes, etc."
                     className="w-full h-10 px-3 text-sm rounded-xl border border-border-subtle bg-surface-1 text-heading placeholder:text-text-soft/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                  />
               </div>

               {/* Tipo de cuenta */}
               <div>
                  <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider mb-1.5">
                     Tipo de cuenta <span className="text-danger">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                     {['GASTOS', 'COSTOS', 'ACTIVO', 'PASIVO', 'INGRESOS', 'PATRIMONIO'].map((t) => {
                        const style = getTypeStyle(t);
                        const isSelected = createForm.type === t;
                        return (
                           <button
                              key={t}
                              type="button"
                              onClick={() => handleTypeChange(t)}
                              className={`py-2 px-1 text-center rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                 isSelected
                                    ? 'bg-brand text-white border-brand shadow-xs'
                                    : 'border-border-subtle bg-surface-1 text-text-main hover:bg-surface-2'
                              }`}
                           >
                              {style.label || t}
                           </button>
                        );
                     })}
                  </div>
               </div>

               {/* Agrupador / Cuenta Padre (solo para auxiliar) */}
               {createForm.kind === 'AUXILIAR' ? (
                  <div>
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider mb-1">
                        Agrupador / Cuenta Mayor (Opcional)
                     </label>
                     <select
                        value={createForm.parentCode}
                        onChange={(e) => handleParentChange(e.target.value)}
                        className="w-full h-10 px-3 text-sm rounded-xl border border-border-subtle bg-surface-1 text-heading focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition cursor-pointer"
                     >
                        <option value="">Automático (Sugerir código libre)</option>
                        {availableParents.map((p) => (
                           <option key={p.id} value={p.code}>
                              {p.code} — {p.name}
                           </option>
                        ))}
                     </select>
                     <p className="text-[11px] text-text-soft mt-1">
                        Selecciona bajo qué cuenta mayor se ubicará para ordenar tu balance.
                     </p>
                  </div>
               ) : (
                  <div className="p-3 bg-surface-2 border border-border-subtle rounded-xl text-xs text-text-soft">
                     Esta cuenta mayor se creará como encabezado de nivel superior (terminación <strong>.00.00</strong>) para organizar futuras cuentas auxiliares.
                  </div>
               )}

               {/* Código contable */}
               <div>
                  <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider mb-1">
                     Código contable <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                     <input
                        type="text"
                        required
                        value={createForm.code}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="Ej: 61.04.10"
                        className="w-full h-10 px-3 text-sm font-mono font-semibold rounded-xl border border-border-subtle bg-surface-1 text-heading focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                     />
                  </div>
                  <p className="text-[11px] text-text-soft mt-1">
                     Código correlativo generado automáticamente. Puedes ajustarlo manualmente si lo deseas.
                  </p>
               </div>

               {/* Exigir RUT (solo para cuentas auxiliares imputables) */}
               {createForm.kind === 'AUXILIAR' && (
                  <div className="pt-1">
                     <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                           type="checkbox"
                           checked={createForm.requireRut}
                           onChange={(e) => setCreateForm(prev => ({ ...prev, requireRut: e.target.checked }))}
                           className="w-4 h-4 rounded accent-brand text-brand cursor-pointer"
                        />
                        <span className="text-xs font-medium text-text-main">
                           Exigir RUT de contraparte al imputar (Recomendado para proveedores y clientes)
                        </span>
                     </label>
                  </div>
               )}

               {/* Acciones */}
               <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                  <button
                     type="button"
                     onClick={() => setIsCreateModalOpen(false)}
                     disabled={creating}
                     className="px-4 py-2 text-xs font-semibold text-text-soft hover:text-heading hover:bg-surface-2 rounded-xl border border-border-subtle transition cursor-pointer"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={creating}
                     className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-brand hover:opacity-95 rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer"
                  >
                     {creating ? (
                        <>
                           <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                           <span>Creando cuenta...</span>
                        </>
                     ) : (
                        <>
                           <CheckIcon className="w-4 h-4 stroke-2" />
                           <span>Crear y Seleccionar</span>
                        </>
                     )}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
};

export default AccountSelect;
