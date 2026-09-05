import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const EntityCtx = createContext(null);

export function EntityProvider({ children }) {
   const [entity, setEntity] = useState(null); // { id, name, rut }

   // cargar desde URL o localStorage al inicio
   useEffect(() => {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get('entityId');
      if (fromUrl) {
         setEntity((prev) => prev?.id === Number(fromUrl) ? prev : { id: Number(fromUrl) });
         localStorage.setItem('entityId', String(fromUrl));
         return;
      }
      const fromLS = localStorage.getItem('entityId');
      if (fromLS) setEntity({ id: Number(fromLS) });
   }, []);

   const entityId = entity?.id ?? null;
   const value = useMemo(() => ({ entity, entityId, setEntity }), [entity, entityId]);

   return <EntityCtx.Provider value={value}>{children}</EntityCtx.Provider>;
}

export function useEntity() {
   return useContext(EntityCtx);
}