import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const EntityCtx = createContext(null);

function readInitialEntity() {
   if (typeof window === 'undefined') return null;
   try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get('entityId') || url.searchParams.get('entity_id');
      if (fromUrl && Number(fromUrl) > 0) {
         localStorage.setItem('entityId', String(fromUrl));
         return { id: Number(fromUrl) };
      }
      const fromLS = localStorage.getItem('entityId');
      if (fromLS && Number(fromLS) > 0) {
         return { id: Number(fromLS) };
      }
   } catch {
      // ignore storage errors
   }
   return null;
}

export function EntityProvider({ children }) {
   const [entity, setEntity] = useState(readInitialEntity); // { id, name, rut }

   // Mantener sincronía si cambia la URL al montar
   useEffect(() => {
      try {
         const url = new URL(window.location.href);
         const fromUrl = url.searchParams.get('entityId') || url.searchParams.get('entity_id');
         if (fromUrl && Number(fromUrl) > 0) {
            setEntity((prev) => (prev?.id === Number(fromUrl) ? prev : { id: Number(fromUrl) }));
            localStorage.setItem('entityId', String(fromUrl));
         }
      } catch {
         // ignore
      }
   }, []);

   const entityId = entity?.id ?? null;
   const value = useMemo(() => ({ entity, entityId, setEntity }), [entity, entityId]);

   return <EntityCtx.Provider value={value}>{children}</EntityCtx.Provider>;
}

export function useEntity() {
   return useContext(EntityCtx);
}
