import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS = [
   'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function parseDate(value) {
   if (!value) return null;
   const [year, month, day] = String(value).split('-').map(Number);
   if (!year || !month || !day) return null;
   return new Date(year, month - 1, day);
}

function toYmd(date) {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
}

function formatDisplay(value) {
   const date = parseDate(value);
   if (!date) return '';
   return new Intl.DateTimeFormat('es-CL').format(date);
}

function sameDay(a, b) {
   return a && b
      && a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function buildCalendarDays(viewDate) {
   const year = viewDate.getFullYear();
   const month = viewDate.getMonth();
   const first = new Date(year, month, 1);
   const startOffset = (first.getDay() + 6) % 7;
   const start = new Date(year, month, 1 - startOffset);

   return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
   });
}

export default function DateInput({
   value,
   onChange,
   disabled = false,
   className = '',
   placeholder = 'Seleccionar fecha',
   min,
   id,
}) {
   const [open, setOpen] = useState(false);
   const selected = useMemo(() => parseDate(value), [value]);
   const minDate = useMemo(() => parseDate(min), [min]);
   const [viewDate, setViewDate] = useState(() => selected || new Date());
   const rootRef = useRef(null);

   useEffect(() => {
      if (selected) setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
   }, [selected]);

   useEffect(() => {
      if (!open) return undefined;
      const handlePointerDown = (event) => {
         if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
      };
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
   }, [open]);

   const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);

   const moveMonth = (delta) => {
      setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
   };

   const selectDay = (date) => {
      if (minDate && date < minDate) return;
      onChange?.(toYmd(date));
      setOpen(false);
   };

   return (
      <div ref={rootRef} className="relative">
         <button
            id={id}
            type="button"
            disabled={disabled}
            className={`${className} text-left`}
            onClick={() => !disabled && setOpen((state) => !state)}
         >
            <span className={value ? 'text-text-main' : 'text-text-soft/70'}>
               {formatDisplay(value) || placeholder}
            </span>
         </button>

         {open && (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[1000] w-72 rounded-2xl border border-border-subtle bg-bg-content p-3 shadow-xl">
               <div className="mb-3 flex items-center justify-between">
                  <button
                     type="button"
                     className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-soft hover:bg-surface-2 hover:text-heading focus:outline-none focus:ring-2 focus:ring-brand"
                     onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        moveMonth(-1);
                     }}
                     aria-label="Mes anterior"
                  >
                     <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <div className="text-sm font-bold text-heading">
                     {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </div>
                  <button
                     type="button"
                     className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-soft hover:bg-surface-2 hover:text-heading focus:outline-none focus:ring-2 focus:ring-brand"
                     onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        moveMonth(1);
                     }}
                     aria-label="Mes siguiente"
                  >
                     <ChevronRightIcon className="h-5 w-5" />
                  </button>
               </div>

               <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-text-soft">
                  {WEEKDAYS.map((day) => <div key={day} className="py-1">{day}</div>)}
               </div>
               <div className="mt-1 grid grid-cols-7 gap-1">
                  {days.map((date) => {
                     const ymd = toYmd(date);
                     const outOfMonth = date.getMonth() !== viewDate.getMonth();
                     const isSelected = sameDay(date, selected);
                     const isToday = sameDay(date, new Date());
                     const isDisabled = Boolean(minDate && date < minDate);

                     return (
                        <button
                           key={ymd}
                           type="button"
                           disabled={isDisabled}
                           className={[
                              'h-9 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand',
                              isSelected ? 'bg-brand text-white shadow-sm' : 'hover:bg-surface-2 text-text-main',
                              outOfMonth && !isSelected ? 'text-text-soft/50' : '',
                              isToday && !isSelected ? 'ring-1 ring-brand/40' : '',
                              isDisabled ? 'cursor-not-allowed opacity-30 hover:bg-transparent' : '',
                           ].join(' ')}
                           onClick={() => selectDay(date)}
                        >
                           {date.getDate()}
                        </button>
                     );
                  })}
               </div>
            </div>
         )}
      </div>
   );
}
