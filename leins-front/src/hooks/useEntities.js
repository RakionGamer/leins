import { useQuery } from '@tanstack/react-query';
import { listEntities } from '../services/entitiesApi';

export function useEntities(initialFilters = {}) {
   // usequery maneja la cache, el loading y los errores automaticamente
   const {
      data: entities = [],
      isLoading: loading,
      error,
      refetch: reload
   } = useQuery({
      // la querykey actua como el identificador unico en la cache.
      // al incluir initialFilters, si estos cambian, se hace una nueva peticion
      queryKey: ['entities', initialFilters],
      queryFn: async () => {
         const { rows } = await listEntities(initialFilters);
         return rows;
      }
   });

   return { entities, loading, error, reload };
}