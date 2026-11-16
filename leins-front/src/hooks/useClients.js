// leins-front/src/hooks/useClients.js
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listClientUsers, changeClientUserState, deleteClientUser } from '../services/clientUsersApi';
import { toast } from 'components/Toaster';

export function useClients() {
   const [page, setPage] = useState(1);
   const [search, setSearch] = useState('');
   const [selectedEntityId, setSelectedEntityId] = useState(null);
   const LIMIT = 10;

   const queryClient = useQueryClient();

   // Query para listar clientes
   const {
      data,
      isLoading: loading,
      isError: error,
      refetch,
   } = useQuery({
      queryKey: ['clientUsers', { page, search, limit: LIMIT, entityId: selectedEntityId }],
      queryFn: () => listClientUsers({ page, limit: LIMIT, search, entityId: selectedEntityId }),
   });

   const clients = data?.rows || [];
   const total = data?.total || 0;

   // Mutación para activar/suspender cliente
   const toggleStateMutation = useMutation({
      mutationFn: ({ id, newState }) => changeClientUserState({ userId: id, stateId: newState }),
      onSuccess: (_, variables) => {
         toast.success(`Cliente ${variables.newState === 1 ? 'activado' : 'suspendido'}`);
         queryClient.invalidateQueries({ queryKey: ['clientUsers'] });
      },
      onError: (err) => {
         toast.error(err?.message || 'Error al cambiar estado del cliente');
      }
   });

   // Mutación para eliminar cliente
   const deleteClientMutation = useMutation({
      mutationFn: (id) => deleteClientUser({ userId: id }),
      onSuccess: () => {
         toast.success('Cliente eliminado correctamente');
         queryClient.invalidateQueries({ queryKey: ['clientUsers'] });
      },
      onError: (err) => {
         toast.error(err?.message || 'Error al eliminar cliente');
      }
   });

   const toggleState = (client) => {
      const newState = client.state_id === 1 ? 2 : 1;
      toggleStateMutation.mutate({ id: client.id, newState });
   };

   const removeClient = (id) => {
      if (window.confirm('¿Estás seguro de eliminar este cliente? Se revocarán sus accesos y sesiones.')) {
         deleteClientMutation.mutate(id);
      }
   };

   return {
      clients,
      loading,
      error,
      page,
      setPage,
      total,
      limit: LIMIT,
      search,
      setSearch,
      selectedEntityId,
      setSelectedEntityId,
      toggleState,
      removeClient,
      refetch,
   };
}
