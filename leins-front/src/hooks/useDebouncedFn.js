import { useEffect, useCallback, useRef } from "react";

export function useDebouncedFn(fn, delay) {
   const t = useRef(null);
   const saved = useRef(fn);
   const delayRef = useRef(delay);

   useEffect(() => { saved.current = fn; }, [fn]);
   useEffect(() => { delayRef.current = delay; }, [delay]);

   useEffect(() => () => clearTimeout(t.current), []);

   return useCallback((...args) => {
      clearTimeout(t.current);
      t.current = setTimeout(() => saved.current(...args), delayRef.current);
   }, []);
}