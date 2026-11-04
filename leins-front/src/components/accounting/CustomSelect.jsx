import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function CustomSelect({
   value,
   onChange,
   options = [],
   placeholder = 'Seleccionar...',
   disabled = false,
   className = '',
}) {
   const [open, setOpen] = useState(false);
   const [rect, setRect] = useState(null);

   const triggerRef = useRef(null);
   const menuRef = useRef(null);

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
      if (!open) return;
      const handleClickOutside = (e) => {
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
         if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         document.removeEventListener('keydown', handleKeyDown);
      };
   }, [open]);

   const selectedOption = options.find((opt) => opt.value === value) || null;

   const handleSelect = (val) => {
      onChange(val);
      setOpen(false);
   };

   const renderMenu = () => {
      if (!open || !rect) return null;

      const placeAbove = rect.spaceBelow < 250 && rect.bottom > 250;
      const menuStyle = {
         position: 'absolute',
         left: `${rect.left}px`,
         width: `${Math.max(rect.width, 240)}px`,
         zIndex: 9999,
         ...(placeAbove
            ? { bottom: `${window.innerHeight - rect.bottom + window.scrollY + 6}px` }
            : { top: `${rect.top + 6}px` }),
      };

      return createPortal(
         <div
            ref={menuRef}
            style={menuStyle}
            className="rounded-2xl border border-border-subtle bg-surface-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 p-1.5 space-y-1"
         >
            {options.map((opt) => {
               const isSelected = opt.value === value;
               return (
                  <div
                     key={opt.value}
                     onClick={() => handleSelect(opt.value)}
                     className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition select-none ${
                        isSelected
                           ? 'bg-brand/10 text-brand font-semibold'
                           : 'text-text-main hover:bg-surface-2'
                     }`}
                  >
                     <div className="flex-1 mr-2">
                        <div className="flex items-center gap-2">
                           {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                           <span className="text-sm">{opt.label}</span>
                           {opt.badge && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${opt.badge}`}>
                                 {opt.badgeText || opt.label}
                              </span>
                           )}
                        </div>
                        {opt.description && (
                           <p className="text-[11px] text-text-soft font-normal mt-0.5 leading-tight">
                              {opt.description}
                           </p>
                        )}
                     </div>
                     {isSelected && <CheckIcon className="w-4 h-4 stroke-2 text-brand shrink-0 mt-0.5" />}
                  </div>
               );
            })}
         </div>,
         document.body
      );
   };

   return (
      <div className={`relative ${className}`}>
         <div
            ref={triggerRef}
            onClick={() => {
               if (disabled) return;
               setOpen(!open);
            }}
            className={`w-full h-11 px-3.5 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main transition shadow-sm flex items-center justify-between select-none cursor-pointer ${
               disabled
                  ? 'opacity-60 cursor-not-allowed bg-surface-2'
                  : 'hover:border-border-strong hover:bg-surface-1'
            } ${open ? 'ring-2 ring-brand border-transparent' : ''}`}
         >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
               {selectedOption ? (
                  <>
                     {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
                     <span className="font-medium text-text-main truncate">
                        {selectedOption.label}
                     </span>
                  </>
               ) : (
                  <span className="text-text-soft/70 truncate text-sm">
                     {placeholder}
                  </span>
               )}
            </div>

            <ChevronDownIcon
               className={`w-4 h-4 text-text-soft transition-transform duration-200 shrink-0 ${
                  open ? 'rotate-180 text-brand' : ''
               }`}
            />
         </div>

         {renderMenu()}
      </div>
   );
}
