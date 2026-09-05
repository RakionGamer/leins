import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 10;
const MARGIN = 12;

function clamp(value, min, max) {
   return Math.min(Math.max(value, min), max);
}

function getPosition(anchorRect, tooltipRect, preferred) {
   const viewportWidth = window.innerWidth;
   const viewportHeight = window.innerHeight;
   const fits = {
      top: anchorRect.top >= tooltipRect.height + GAP + MARGIN,
      bottom: viewportHeight - anchorRect.bottom >= tooltipRect.height + GAP + MARGIN,
      left: anchorRect.left >= tooltipRect.width + GAP + MARGIN,
      right: viewportWidth - anchorRect.right >= tooltipRect.width + GAP + MARGIN,
   };

   const placement = fits[preferred]
      ? preferred
      : ['top', 'bottom', 'right', 'left'].find((item) => fits[item]) || preferred || 'top';

   let top = 0;
   let left = 0;

   if (placement === 'top') {
      top = anchorRect.top - tooltipRect.height - GAP;
      left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
   } else if (placement === 'bottom') {
      top = anchorRect.bottom + GAP;
      left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
   } else if (placement === 'left') {
      top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2;
      left = anchorRect.left - tooltipRect.width - GAP;
   } else {
      top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2;
      left = anchorRect.right + GAP;
   }

   return {
      placement,
      top: clamp(top, MARGIN, viewportHeight - tooltipRect.height - MARGIN),
      left: clamp(left, MARGIN, viewportWidth - tooltipRect.width - MARGIN),
   };
}

export default function Tooltip({ content, children, position = 'top', className = '' }) {
   const id = useId();
   const anchorRef = useRef(null);
   const tooltipRef = useRef(null);
   const [visible, setVisible] = useState(false);
   const [coords, setCoords] = useState(null);

   useLayoutEffect(() => {
      if (!visible || !anchorRef.current || !tooltipRef.current) return undefined;

      const update = () => {
         const anchorRect = anchorRef.current.getBoundingClientRect();
         const tooltipRect = tooltipRef.current.getBoundingClientRect();
         setCoords(getPosition(anchorRect, tooltipRect, position));
      };

      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);

      return () => {
         window.removeEventListener('resize', update);
         window.removeEventListener('scroll', update, true);
      };
   }, [position, visible]);

   if (!content) return children;

   const tooltip = visible && typeof document !== 'undefined'
      ? createPortal(
         <span
            id={id}
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none fixed z-[1000] max-w-[280px] rounded-md bg-brand-strong/90 px-2 py-1 text-xs font-medium leading-snug text-white shadow-lg ring-1 ring-white/10 transition-opacity duration-150"
            style={{
               top: coords?.top ?? -9999,
               left: coords?.left ?? -9999,
               opacity: coords ? 1 : 0,
            }}
         >
            {content}
         </span>,
         document.body
      )
      : null;

   return (
      <span
         ref={anchorRef}
         className={`inline-flex ${className}`}
         aria-describedby={visible ? id : undefined}
         onMouseEnter={() => setVisible(true)}
         onMouseLeave={() => setVisible(false)}
         onFocusCapture={() => setVisible(true)}
         onBlurCapture={() => setVisible(false)}
      >
         {children}
         {tooltip}
      </span>
   );
}
