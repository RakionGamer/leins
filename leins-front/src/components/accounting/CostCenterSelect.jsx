import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
   ChevronDownIcon,
   MagnifyingGlassIcon,
   CheckIcon,
   PlusIcon,
   XMarkIcon,
   TagIcon,
} from '@heroicons/react/24/outline';
import { toast } from '../Toaster';
import { createCostCenter } from '../../services/accountingApi';

export default function CostCenterSelect({
   value,
   onChange,
   entityId,
   costCenters = [],
   onCostCentersChange,
   placeholder = 'Seleccionar Centro de Costo...',
   required = false,
   allowClear = true,
   disabled = false,
   className = '',
}) {
   const [open, setOpen] = useState(false);
   const [search, setSearch] = useState('');
   const [rect, setRect] = useState(null);

   // Inline creation state
   const [isCreating, setIsCreating] = useState(false);
   const [newCode, setNewCode] = useState('');
   const [newName, setNewName] = useState('');
   const [saving, setSaving] = useState(false);

   const triggerRef = useRef(null);
   const menuRef = useRef(null);
   const searchInputRef = useRef(null);

   // Calculate position for Portal dropdown
   const updatePosition = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setRect({
         top: r.bottom + window.scrollY,
         left: r.left + window.scrollX,
         width: r.width,
         bottom: r.top + window.scrollY,
         spaceBelow: window.innerHeight - r.bottom,
      });
   };

   useLayoutEffect(() => {
      if (open) {
         updatePosition();
         window.addEventListener('resize', updatePosition);
         window.addEventListener('scroll', updatePosition, true);
         return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
         };
      }
   }, [open]);

   useEffect(() => {
      if (open && !isCreating) {
         setTimeout(() => searchInputRef.current?.focus(), 50);
      }
   }, [open, isCreating]);

   // Handle click outside
   useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e) => {
         if (
            triggerRef.current &&
            !triggerRef.current.contains(e.target) &&
            menuRef.current &&
            !menuRef.current.contains(e.target)
         ) {
            setOpen(false);
            setIsCreating(false);
            setSearch('');
         }
      };
      const handleKeyDown = (e) => {
         if (e.key === 'Escape') {
            setOpen(false);
            setIsCreating(false);
            setSearch('');
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         document.removeEventListener('keydown', handleKeyDown);
      };
   }, [open]);

   // Selected item details
   const selectedItem = useMemo(() => {
      if (!value) return null;
      return (
         costCenters.find(
            (c) => (c.name || c).toUpperCase() === String(value).toUpperCase()
         ) || { name: value, code: null }
      );
   }, [value, costCenters]);

   // Filtered items
   const filteredItems = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return costCenters;
      return costCenters.filter((c) => {
         const name = (c.name || c).toLowerCase();
         const code = (c.code || '').toLowerCase();
         return name.includes(q) || code.includes(q);
      });
   }, [costCenters, search]);

   const handleSelect = (name) => {
      onChange(name);
      setOpen(false);
      setSearch('');
      setIsCreating(false);
   };

   const handleClear = (e) => {
      e?.stopPropagation();
      onChange('');
      setSearch('');
   };

   const handleCreateInline = async (e) => {
      e?.preventDefault();
      e?.stopPropagation();
      const cleanName = newName.trim();
      if (!cleanName) {
         toast.error('El nombre del centro de costo es requerido');
         return;
      }

      setSaving(true);
      try {
         const created = await createCostCenter({
            entityId,
            name: cleanName,
            code: newCode.trim() || null,
         });

         const item = created?.id
            ? created
            : { id: Date.now(), name: cleanName, code: newCode.trim() || null, is_active: true };

         if (onCostCentersChange) {
            onCostCentersChange((prev) => {
               const filtered = prev.filter(
                  (c) => (c.name || c).toUpperCase() !== cleanName.toUpperCase()
               );
               return [...filtered, item].sort((a, b) =>
                  (a.name || a).localeCompare(b.name || b)
               );
            });
         }

         toast.success(`Centro de costo "${cleanName}" creado`);
         handleSelect(cleanName);
         setNewName('');
         setNewCode('');
         setIsCreating(false);
      } catch (err) {
         toast.error(err.message || 'Error al crear centro de costo');
      } finally {
         setSaving(false);
      }
   };

   // Render Portal Menu
   const renderMenu = () => {
      if (!open || !rect) return null;

      const placeAbove = rect.spaceBelow < 280 && rect.bottom > 280;
      const menuStyle = {
         position: 'absolute',
         left: `${rect.left}px`,
         width: `${Math.max(rect.width, 280)}px`,
         zIndex: 9999,
         ...(placeAbove
            ? { bottom: `${window.innerHeight - rect.bottom + window.scrollY + 6}px` }
            : { top: `${rect.top + 6}px` }),
      };

      return createPortal(
         <div
            ref={menuRef}
            style={menuStyle}
            className="rounded-2xl border border-border-subtle bg-surface-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
         >
            {isCreating ? (
               <div className="p-3.5 space-y-3 bg-surface-2/60">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold uppercase tracking-wider text-text-soft">
                        Nuevo Centro de Costo
                     </span>
                     <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="text-text-soft hover:text-text-main p-1 rounded-lg"
                     >
                        <XMarkIcon className="w-4 h-4" />
                     </button>
                  </div>

                  <div className="space-y-2">
                     <input
                        type="text"
                        placeholder="Código (opcional, ej: CC-01)"
                        className="w-full h-9 px-3 text-xs rounded-xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        disabled={saving}
                     />
                     <input
                        type="text"
                        placeholder="Nombre (ej: Administración, Faena Norte)"
                        className="w-full h-9 px-3 text-xs rounded-xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-1 focus:ring-brand"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        disabled={saving}
                        autoFocus
                     />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                     <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-medium text-text-soft hover:text-text-main rounded-lg transition"
                     >
                        Cancelar
                     </button>
                     <button
                        type="button"
                        onClick={handleCreateInline}
                        disabled={saving || !newName.trim()}
                        className="px-3.5 py-1.5 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover shadow-sm transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                     >
                        <PlusIcon className="w-3.5 h-3.5 stroke-2" />
                        <span>{saving ? 'Guardando...' : 'Crear y Asignar'}</span>
                     </button>
                  </div>
               </div>
            ) : (
               <>
                  {/* Search box if items exist */}
                  <div className="p-2 border-b border-border-subtle bg-surface-2/40">
                     <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-soft" />
                        <input
                           ref={searchInputRef}
                           type="text"
                           placeholder="Buscar centro de costo..."
                           className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-1 focus:ring-brand"
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                           <button
                              type="button"
                              onClick={() => setSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-soft hover:text-text-main p-0.5"
                           >
                              <XMarkIcon className="w-3.5 h-3.5" />
                           </button>
                        )}
                     </div>
                  </div>

                  {/* List of options */}
                  <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                     {allowClear && !required && (
                        <div
                           onClick={() => handleSelect('')}
                           className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                              !value
                                 ? 'bg-brand/10 text-brand font-semibold'
                                 : 'text-text-soft hover:bg-surface-2 hover:text-text-main'
                           }`}
                        >
                           <span>Sin Centro de Costo (Ninguno)</span>
                           {!value && <CheckIcon className="w-4 h-4 stroke-2" />}
                        </div>
                     )}

                     {filteredItems.length === 0 ? (
                        <div className="py-4 text-center text-xs text-text-soft">
                           No se encontraron centros de costo
                        </div>
                     ) : (
                        filteredItems.map((cc) => {
                           const itemName = cc.name || cc;
                           const itemCode = cc.code || null;
                           const isSelected =
                              String(value || '').toUpperCase() === itemName.toUpperCase();

                           return (
                              <div
                                 key={cc.id || itemName}
                                 onClick={() => handleSelect(itemName)}
                                 className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                                    isSelected
                                       ? 'bg-brand/10 text-brand font-semibold'
                                       : 'text-text-main hover:bg-surface-2'
                                 }`}
                              >
                                 <div className="flex items-center gap-2 min-w-0">
                                    {itemCode ? (
                                       <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-surface-2 border border-border-subtle text-text-soft shrink-0">
                                          {itemCode}
                                       </span>
                                    ) : (
                                       <TagIcon className="w-3.5 h-3.5 text-text-soft/60 shrink-0" />
                                    )}
                                    <span className="truncate">{itemName}</span>
                                 </div>
                                 {isSelected && <CheckIcon className="w-4 h-4 stroke-2 text-brand shrink-0" />}
                              </div>
                           );
                        })
                     )}
                  </div>

                  {/* Footer Create Action */}
                  <div className="p-2 border-t border-border-subtle bg-surface-2/40">
                     <button
                        type="button"
                        onClick={() => {
                           setIsCreating(true);
                           setNewName(search.trim());
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-brand hover:bg-brand/10 rounded-xl transition cursor-pointer"
                     >
                        <PlusIcon className="w-4 h-4 stroke-2" />
                        <span>Crear nuevo Centro de Costo...</span>
                     </button>
                  </div>
               </>
            )}
         </div>,
         document.body
      );
   };

   return (
      <div className={`relative ${className}`}>
         {/* Trigger Button */}
         <div
            ref={triggerRef}
            onClick={() => {
               if (disabled) return;
               setOpen(!open);
               setIsCreating(false);
            }}
            className={`w-full h-11 px-3.5 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main transition shadow-sm flex items-center justify-between select-none cursor-pointer ${
               disabled
                  ? 'opacity-60 cursor-not-allowed bg-surface-2'
                  : 'hover:border-border-strong hover:bg-surface-1'
            } ${open ? 'ring-2 ring-brand border-transparent' : ''}`}
         >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
               {selectedItem && selectedItem.name ? (
                  <>
                     {selectedItem.code && (
                        <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-brand/10 text-brand border border-brand/20 shrink-0">
                           {selectedItem.code}
                        </span>
                     )}
                     <span className="font-medium text-text-main truncate">
                        {selectedItem.name}
                     </span>
                  </>
               ) : (
                  <span className="text-text-soft/70 truncate text-sm">
                     {placeholder}
                  </span>
               )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
               {selectedItem && selectedItem.name && allowClear && !disabled && (
                  <button
                     type="button"
                     onClick={handleClear}
                     className="p-1 rounded-lg text-text-soft hover:text-text-main hover:bg-surface-2 transition"
                     title="Quitar centro de costo"
                  >
                     <XMarkIcon className="w-4 h-4" />
                  </button>
               )}
               <ChevronDownIcon
                  className={`w-4 h-4 text-text-soft transition-transform duration-200 ${
                     open ? 'rotate-180 text-brand' : ''
                  }`}
               />
            </div>
         </div>

         {renderMenu()}
      </div>
   );
}
