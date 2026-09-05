import { useState, useEffect, useRef } from "react";

// Anima desde el valor anterior al nuevo en "durationMs"
export function useTweenNumber(value, durationMs = 300) {
   const [display, setDisplay] = useState(Number(value) || 0);
   const prevRef = useRef(Number(value) || 0);
   const rafRef = useRef(0);

   useEffect(() => {
      const from = prevRef.current;
      const to = Number(value) || 0;
      if (from === to) return;

      const start = performance.now();
      cancelAnimationFrame(rafRef.current);

      const tick = (now) => {
         const t = Math.min(1, (now - start) / durationMs);
         const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
         setDisplay(from + (to - from) * eased);
         if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
         } else {
            prevRef.current = to;
            setDisplay(to);
         }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
   }, [value, durationMs]);

   return display;
}