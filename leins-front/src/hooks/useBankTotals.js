import { useQuery } from '@tanstack/react-query';
import { countTransactionsByType } from '../services/entitiesApi';

export function useBankTotals(entityId, options = {}) {
   const { filters = {}, soloPendientes = false } = options;

   // 1. query para el total de abonos (badge verde)
   const {
      data: abonosTotal = 0,
      isLoading: abonosLoading,
      isFetching: abonosFetching
   } = useQuery({
      queryKey: ['bankTotals', 'Abonos', { entityId, soloPendientes, filters }],
      queryFn: ({ signal }) => countTransactionsByType({
         entityId,
         tipo: 'Abonos',
         soloPendientes,
         filters,
         signal
      }),
      enabled: !!entityId,
   });

   // 2. query para el total de cargos (badge rojo)
   const {
      data: cargosTotal = 0,
      isLoading: cargosLoading,
      isFetching: cargosFetching
   } = useQuery({
      queryKey: ['bankTotals', 'Cargos', { entityId, soloPendientes, filters }],
      queryFn: ({ signal }) => countTransactionsByType({
         entityId,
         tipo: 'Cargos',
         soloPendientes,
         filters,
         signal
      }),
      enabled: !!entityId,
   });

   return {
      abonosTotal,
      cargosTotal,
      // "loading" cubre la carga inicial (sin dato aun); "fetching" tambien cubre
      // refetch por cambio de filtros, para no mostrar un numero viejo mientras
      // se recalcula
      abonosLoading: Boolean(entityId) && (abonosLoading || abonosFetching),
      cargosLoading: Boolean(entityId) && (cargosLoading || cargosFetching),
   };
}