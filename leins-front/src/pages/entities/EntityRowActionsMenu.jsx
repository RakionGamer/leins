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
                  ? 'border-[var(--brand)] bg-[var(--surface-2)] text-[var(--heading)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-main)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]'
            }`}
         >
            {isBusy ? (
               <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
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
                  className="max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] p-1.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
               >
                  <button
                     type="button"
                     role="menuitem"
                     disabled={!isActive}
                     onClick={() => runAction(() => onSelect(row))}
                     className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-main)] hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                     <span className="inline-flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Seleccionar</span>
                     </span>
                     {isSelected && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                           Activa
                        </span>
                     )}
                  </button>

                  {canUpdate && (
                     <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(() => onEdit(row))}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition cursor-pointer"
                     >
                        <PencilSquareIcon className="h-4 w-4 text-[var(--text-soft)] shrink-0" />
                        <span>Editar</span>
                     </button>
                  )}

                  {canUpdate && (
                     <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(() => onOpenCredentials(row))}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-main)] hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300 transition cursor-pointer"
                     >
                        <KeyIcon className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Credenciales</span>
                     </button>
                  )}

                  <button
                     type="button"
                     role="menuitem"
                     onClick={() => runAction(() => onOpenClients(row))}
                     className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-main)] hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300 transition cursor-pointer"
                  >
                     <UsersIcon className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                     <span>Clientes</span>
                  </button>

                  {(canUpdate || canDelete) && (
                     <div className="my-1 border-t border-[var(--border-subtle)]" role="separator" />
                  )}

                  {canUpdate && (
                     <button
                        type="button"
                        role="menuitem"
                        disabled={isChangingState}
                        onClick={() => runAction(() => onToggleState(row))}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                           isActive
                              ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                              : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
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
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--danger)] hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
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
