import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listTransactions } from 'services/entitiesApi';

export function useBankTransactions(entityId, options = {}) {
   const { limit = 50, offset = 0, soloPendientes = false, filters = {} } = options;

   const queryInfo = useQuery({
      // la clave unica que react query usara para cachear
      queryKey: ['bankTransactions', { entityId, limit, offset, soloPendientes, filters }],
      queryFn: ({ signal }) => listTransactions({
         entityId,
         limit,
         offset,
         soloPendientes,
         filters,
         // react query inyecta este signal para auto-cancelar peticiones duplicadas
         signal
      }),
      // solo ejecuta si hay una entidad seleccionada
      enabled: !!entityId,
      // placeholderdata evita pantallazo blanco al cambiar de pagina
      placeholderData: keepPreviousData,
   });

   return {
      transactions: queryInfo.data?.rows || [],
      total: queryInfo.data?.total || 0,
      isLoading: queryInfo.isLoading,
      isFetching: queryInfo.isFetching,
      refetch: queryInfo.refetch
   };
}