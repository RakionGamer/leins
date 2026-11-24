import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
   CheckCircleIcon,
   EllipsisVerticalIcon,
   KeyIcon,
   PencilSquareIcon,
   PowerIcon,
   TrashIcon,
   UsersIcon,
} from '@heroicons/react/24/outline';

const MENU_WIDTH = 208;
const ESTIMATED_MENU_HEIGHT = 276;

export default function EntityRowActionsMenu({
   row,
   isSelected,
   isActive,
   canUpdate,
   canDelete,
   isChangingState,
   isDeleting,
   onSelect,
   onEdit,
   onOpenCredentials,
   onOpenClients,
   onToggleState,
   onDelete,
}) {
   const [open, setOpen] = useState(false);
   const [coords, setCoords] = useState(null);
   const triggerRef = useRef(null);
   const menuRef = useRef(null);

   const isBusy = Boolean(isChangingState || isDeleting);
   const entityLabel = row?.name || row?.legal_name || `entidad ${row?.id || ''}`;

   const updatePosition = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();

      // Si el disparador salió completamente del viewport al hacer scroll, cerramos el menú
      if (r.bottom < 0 || r.top > window.innerHeight) {
         setOpen(false);
         return;
      }

      const menuHeight = menuRef.current?.offsetHeight || ESTIMATED_MENU_HEIGHT;
      const spaceBelow = window.innerHeight - r.bottom;
      const placeAbove = spaceBelow < menuHeight + 12 && r.top > spaceBelow;

      const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));

      setCoords({
         left,
         top: placeAbove ? null : r.bottom + 6,
         bottom: placeAbove ? window.innerHeight - r.top + 6 : null,
      });
   };

   useLayoutEffect(() => {
      if (!open) return;
      updatePosition();
      const rafId = requestAnimationFrame(updatePosition);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
         cancelAnimationFrame(rafId);
         window.removeEventListener('resize', updatePosition);
         window.removeEventListener('scroll', updatePosition, true);
      };
   }, [open]);

   useEffect(() => {
      if (!open) return;
      const handleMouseDown = (e) => {
         if (
            triggerRef.current &&
            !triggerRef.current.contains(e.target) &&
            menuRef.current &&
            !menuRef.current.contains(e.target)
         ) {
            setOpen(false);
         }
      };
      const handleKeyDown = (e) => {
         if (e.key === 'Escape') {
            setOpen(false);
            triggerRef.current?.focus();
         }
      };

      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
         document.removeEventListener('mousedown', handleMouseDown);
         document.removeEventListener('keydown', handleKeyDown);
      };
   }, [open]);

   const runAction = (fn) => {
      setOpen(false);
      if (typeof fn === 'function') fn();
   };

   return (
      <>
         <button
            ref={triggerRef}
            type="button"
            onClick={() => {
               if (isBusy) return;
               setOpen((prev) => !prev);
            }}
            disabled={isBusy}
            aria-label={`Acciones para ${entityLabel}`}
            aria-haspopup="menu"
            aria-expanded={open}
            title={isBusy ? (isDeleting ? 'Eliminando...' : 'Guardando...') : 'Acciones'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
               open
                  ? 'border-[#1F6BFF] bg-[#EFF3FF] text-[#1F6BFF]'
                  : 'border-[#E2EAFD] bg-white text-[#55607A] hover:bg-[#F5F8FF] hover:text-[#0A1A3F] hover:border-[#BFDBFE]'
            }`}
         >
            {isBusy ? (
               <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1F6BFF] border-t-transparent" />
            ) : (
               <EllipsisVerticalIcon className="h-5 w-5" />
            )}
         </button>

         {open &&
            coords &&
            createPortal(
               <div
                  ref={menuRef}
                  role="menu"
                  aria-label={`Acciones de ${entityLabel}`}
                  style={{
                     position: 'fixed',
                     left: `${coords.left}px`,
                     width: `${MENU_WIDTH}px`,
                     zIndex: 90,
                     ...(coords.top !== null ? { top: `${coords.top}px` } : {}),
                     ...(coords.bottom !== null ? { bottom: `${coords.bottom}px` } : {}),
                  }}
                  className="max-h-[calc(100vh-16px)] overflow-y-auto rounded-2xl border border-[#E2EAFD] bg-white p-1.5 shadow-xl ring-1 ring-black/5"
               >
                  <button
                     type="button"
                     role="menuitem"
                     disabled={!isActive}
                     onClick={() => runAction(() => onSelect(row))}
                     className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#0A1A3F] hover:bg-[#E8F8F0] hover:text-[#0D9488] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                     <span className="inline-flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Seleccionar</span>
                     </span>
                     {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F8F0] text-[#0D9488]">
                           Activa
                        </span>
                     )}
                  </button>

                  {canUpdate && (
                     <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(() => onEdit(row))}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#0A1A3F] hover:bg-[#F5F8FF] hover:text-[#1F6BFF] transition cursor-pointer"
                     >
                        <PencilSquareIcon className="h-4 w-4 text-[#8E9BB5] shrink-0" />
                        <span>Editar</span>
                     </button>
                  )}

                  {canUpdate && (
                     <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(() => onOpenCredentials(row))}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#0A1A3F] hover:bg-[#EFF3FF] hover:text-[#1F6BFF] transition cursor-pointer"
                     >
                        <KeyIcon className="h-4 w-4 text-[#1F6BFF] shrink-0" />
                        <span>Credenciales</span>
                     </button>
                  )}

                  <button
                     type="button"
                     role="menuitem"
                     onClick={() => runAction(() => onOpenClients(row))}
                     className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#0A1A3F] hover:bg-[#F3E8FF] hover:text-[#7C3AED] transition cursor-pointer"
                  >
                     <UsersIcon className="h-4 w-4 text-purple-600 shrink-0" />
                     <span>Clientes</span>
                  </button>

                  {(canUpdate || canDelete) && (
                     <div className="my-1.5 border-t border-[#F0F4FD]" role="separator" />
                  )}

                  {canUpdate && (
                     <button
                        type="button"
                        role="menuitem"
                        disabled={isChangingState}
                        onClick={() => runAction(() => onToggleState(row))}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                           isActive
                              ? 'text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                     >
                        <PowerIcon className="h-4 w-4 shrink-0" />
                        <span>
                           {isChangingState
                              ? 'Guardando...'
                              : isActive
                                 ? 'Desactivar'
                                 : 'Activar'}
                        </span>
                     </button>
                  )}

                  {canDelete && (
                     <button
                        type="button"
                        role="menuitem"
                        disabled={isDeleting}
                        onClick={() => runAction(() => onDelete(row))}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                     >
                        <TrashIcon className="h-4 w-4 shrink-0" />
                        <span>{isDeleting ? 'Eliminando...' : 'Eliminar'}</span>
                     </button>
                  )}
               </div>,
               document.body
            )}
      </>
   );
}
