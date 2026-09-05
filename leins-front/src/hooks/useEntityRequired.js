import { useEffect, useMemo } from 'react';
import { useEntity } from '../context/EntityContext';
import { useEntities } from './useEntities';

export function useEntityRequired() {
   const { entityId, setEntity } = useEntity();
   const { entities, loading } = useEntities({ limit: 200, activeOnly: true, assignedAdminOnly: true });

   const parsedEntityId = Number(entityId || 0);
   const allowedEntity = useMemo(() => {
      if (!parsedEntityId) return null;
      return entities.find((item) => Number(item.id) === parsedEntityId) || null;
   }, [entities, parsedEntityId]);

   useEffect(() => {
      if (loading || !entityId) return;
      if (allowedEntity) return;

      setEntity(null);
      try { localStorage.removeItem('entityId'); } catch {}

      const url = new URL(window.location.href);
      url.searchParams.delete('entityId');
      url.searchParams.delete('entity_id');
      window.history.replaceState({}, '', url);
   }, [allowedEntity, entityId, loading, setEntity]);

   return {
      entityId: allowedEntity ? Number(allowedEntity.id) : null,
      permissions: allowedEntity?.permissions || null,
      ready: Boolean(allowedEntity),
      loading,
      hasEntities: entities.length > 0,
   };
}
