import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSuperAdmins, changeAdminState, deleteAdmin } from '../services/userApi';
import { toast } from 'components/Toaster';

export function useSuperAdmins() {
   const [page, setPage] = useState(1);
   const [search, setSearch] = useState('');
   const LIMIT = 10;

   const queryClient = useQueryClient();

   // 1. query para listar administradores
   const {
      data,
      isLoading: loading,
      isError: error
   } = useQuery({
      queryKey: ['superAdmins', { page, search, limit: LIMIT }],
      queryFn: () => getSuperAdmins({ page, limit: LIMIT, search })
   });

   const users = data?.items || [];
   const total = data?.total || 0;

   // 2. mutacion para cambiar estado
   const toggleStateMutation = useMutation({
      mutationFn: ({ id, newState }) => changeAdminState(id, newState),
      onSuccess: (_, variables) => {
         toast.success(`usuario ${variables.newState === 1 ? 'activado' : 'suspendido'}`);
         // sintaxis actualizada para react query v5
         queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
      },
      onError: () => {
         toast.error('error al cambiar estado');
      }
   });

   // 3. mutacion para eliminar
   const deleteUserMutation = useMutation({
      mutationFn: (id) => deleteAdmin(id),
      onSuccess: () => {
         toast.success('administrador eliminado');
         queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
      },
      onError: (err) => {
         toast.error(err.message || 'error al eliminar');
      }
   });

   const toggleState = (user) => {
      const newState = user.state_id === 1 ? 2 : 1;
      toggleStateMutation.mutate({ id: user.id, newState });
   };

   const removeUser = (id) => {
      if (window.confirm('¿estas seguro de eliminar este administrador?')) {
         deleteUserMutation.mutate(id);
      }
   };

   // retornamos exactamente las variables que tu componente necesita
   return {
      users,
      loading,
      error,
      page,
      setPage,
      total,
      search,
      setSearch,
      toggleState,
      removeUser
   };
}