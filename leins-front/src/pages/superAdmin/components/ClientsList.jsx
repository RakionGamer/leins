// leins-front/src/pages/superAdmin/components/ClientsList.jsx
import React, { useState } from 'react';
import { useClients } from '../../../hooks/useClients';
import { useEntities } from '../../../hooks/useEntities';
import Tooltip from 'components/Tooltip';
import ClientCreateModal from './ClientCreateModal';
import ClientEditModal from './ClientEditModal';
import ClientPermissionsModal from './ClientPermissionsModal';
import ClientEntitiesModal from './ClientEntitiesModal';
import {
   MagnifyingGlassIcon,
   PlusIcon,
   ShieldCheckIcon,
   BuildingOffice2Icon,
   PencilSquareIcon,
   TrashIcon,
   ChevronLeftIcon,
   ChevronRightIcon,
   UserIcon,
} from '@heroicons/react/24/outline';

export default function ClientsList() {
   const {
      clients,
      loading,
      page,
      setPage,
      total,
      limit,
      search,
      setSearch,
      selectedEntityId,
      setSelectedEntityId,
      toggleState,
      removeClient,
      refetch,
   } = useClients();

   const { entities: availableEntities } = useEntities({ limit: 100, activeOnly: true });

   const [createModalOpen, setCreateModalOpen] = useState(false);
   const [editClient, setEditClient] = useState(null);
   const [permissionsClient, setPermissionsClient] = useState(null);
   const [entitiesClient, setEntitiesClient] = useState(null);

   const totalPages = Math.ceil(total / limit);

   return (
      <div className="space-y-4">
         {/* BARRA SUPERIOR: BUSCADOR, FILTRO POR EMPRESA Y BOTÓN NUEVO */}
         <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
               {/* BUSCADOR */}
               <div className="relative group w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 group-focus-within:text-brand" />
                  </div>
                  <input
                     type="text"
                     className="block w-full pl-9 pr-3 py-2 border border-border-subtle rounded-xl bg-bg-content text-xs focus:ring-brand focus:border-brand transition-all shadow-2xs"
                     placeholder="Buscar cliente, email, usuario..."
                     value={search}
                     onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                     }}
                  />
               </div>

               {/* FILTRO POR EMPRESA */}
               <div className="w-full sm:w-56">
                  <select
                     value={selectedEntityId || ''}
                     onChange={(e) => {
                        setSelectedEntityId(e.target.value ? Number(e.target.value) : null);
                        setPage(1);
                     }}
                     className="block w-full px-3 py-2 border border-border-subtle rounded-xl bg-bg-content text-xs focus:ring-brand focus:border-brand shadow-2xs font-medium text-text-main"
                  >
                     <option value="">Todas las empresas</option>
                     {availableEntities?.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                           {ent.name || ent.legal_name}
                        </option>
                     ))}
                  </select>
               </div>
            </div>

            {/* BOTÓN NUEVO CLIENTE */}
            <button
               type="button"
               onClick={() => setCreateModalOpen(true)}
               className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-brand-strong transition-all cursor-pointer active:scale-95 shrink-0"
            >
               <PlusIcon className="w-4 h-4" />
               <span>Nuevo Cliente</span>
            </button>
         </div>

         {/* TABLA DE CLIENTES */}
         <div className="bg-bg-content border border-border-subtle rounded-2xl shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full min-w-[860px] text-left border-collapse">
                  <thead>
                     <tr className="border-b border-border-subtle bg-gray-50/50 dark:bg-white/5">
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft">Cliente</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft">Email</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft">Empresas Asignadas</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft text-center">Estado</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft text-end w-56">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                     {loading ? (
                        <tr>
                           <td colSpan="5" className="p-8 text-center text-text-soft text-sm">
                              Cargando clientes...
                           </td>
                        </tr>
                     ) : clients.length === 0 ? (
                        <tr>
                           <td colSpan="5" className="p-8 text-center text-text-soft text-sm">
                              No se encontraron clientes contratantes.
                           </td>
                        </tr>
                     ) : (
                        clients.map((client) => {
                           const assignedEntities = client.entities || [];

                           return (
                              <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                 {/* NOMBRE Y USUARIO */}
                                 <td className="p-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-9 h-9 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                                          {client.name?.[0] || client.username?.[0]?.toUpperCase() || 'C'}
                                       </div>
                                       <div className="min-w-0">
                                          <p className="font-semibold text-heading dark:text-white text-sm truncate">
                                             {client.name ? `${client.name} ${client.last_name || ''}` : client.username}
                                          </p>
                                          <p className="text-xs text-text-soft">@{client.username}</p>
                                       </div>
                                    </div>
                                 </td>

                                 {/* EMAIL */}
                                 <td className="p-4 text-xs text-text-soft font-medium">
                                    {client.email}
                                 </td>

                                 {/* EMPRESAS ASIGNADAS */}
                                 <td className="p-4">
                                    {assignedEntities.length === 0 ? (
                                       <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                          Sin empresas asignadas
                                       </span>
                                    ) : (
                                       <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                                          {assignedEntities.slice(0, 2).map((ent) => (
                                             <span
                                                key={ent.id}
                                                className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/10 text-text-main"
                                             >
                                                {ent.name}
                                             </span>
                                          ))}
                                          {assignedEntities.length > 2 && (
                                             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                                                +{assignedEntities.length - 2} más
                                             </span>
                                          )}
                                       </div>
                                    )}
                                 </td>

                                 {/* ESTADO */}
                                 <td className="p-4 text-center">
                                    <button
                                       type="button"
                                       onClick={() => toggleState(client)}
                                       className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          client.state_id === 1 ? 'bg-success' : 'bg-gray-300 dark:bg-neutral-700'
                                       }`}
                                       title={client.state_id === 1 ? 'Cliente Activo (Clic para suspender)' : 'Cliente Suspendido (Clic para activar)'}
                                    >
                                       <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                             client.state_id === 1 ? 'translate-x-4' : 'translate-x-0'
                                          }`}
                                       />
                                    </button>
                                 </td>

                                 {/* ACCIONES */}
                                 <td className="p-4 text-end">
                                    <div className="flex items-center justify-end gap-1">
                                       <Tooltip content="Configurar Permisos Granulares">
                                          <button
                                             type="button"
                                             onClick={() => setPermissionsClient(client)}
                                             className="p-1.5 rounded-lg text-brand hover:bg-brand/10 transition cursor-pointer"
                                          >
                                             <ShieldCheckIcon className="w-5 h-5" />
                                          </button>
                                       </Tooltip>

                                       <Tooltip content="Asignar Empresas">
                                          <button
                                             type="button"
                                             onClick={() => setEntitiesClient(client)}
                                             className="p-1.5 rounded-lg text-text-soft hover:text-heading hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                                          >
                                             <BuildingOffice2Icon className="w-5 h-5" />
                                          </button>
                                       </Tooltip>

                                       <Tooltip content="Editar Cliente">
                                          <button
                                             type="button"
                                             onClick={() => setEditClient(client)}
                                             className="p-1.5 rounded-lg text-text-soft hover:text-heading hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                                          >
                                             <PencilSquareIcon className="w-5 h-5" />
                                          </button>
                                       </Tooltip>

                                       <Tooltip content="Eliminar Cliente">
                                          <button
                                             type="button"
                                             onClick={() => removeClient(client.id)}
                                             className="p-1.5 rounded-lg text-danger/80 hover:text-danger hover:bg-danger/10 transition cursor-pointer"
                                          >
                                             <TrashIcon className="w-5 h-5" />
                                          </button>
                                       </Tooltip>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>

            {/* PAGINACIÓN */}
            {totalPages > 1 && (
               <div className="p-4 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-text-soft">
                     Mostrando página {page} de {totalPages} ({total} clientes en total)
                  </span>
                  <div className="flex gap-2">
                     <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="p-1.5 border border-border-subtle rounded-lg text-text-soft hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                     >
                        <ChevronLeftIcon className="w-4 h-4" />
                     </button>
                     <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="p-1.5 border border-border-subtle rounded-lg text-text-soft hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                     >
                        <ChevronRightIcon className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            )}
         </div>

         {/* MODALES */}
         <ClientCreateModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onSuccess={refetch}
         />

         <ClientEditModal
            isOpen={Boolean(editClient)}
            onClose={() => setEditClient(null)}
            client={editClient}
            onSuccess={refetch}
         />

         <ClientPermissionsModal
            isOpen={Boolean(permissionsClient)}
            onClose={() => setPermissionsClient(null)}
            client={permissionsClient}
            onSuccess={refetch}
         />

         <ClientEntitiesModal
            isOpen={Boolean(entitiesClient)}
            onClose={() => setEntitiesClient(null)}
            client={entitiesClient}
            onSuccess={refetch}
         />
      </div>
   );
}
