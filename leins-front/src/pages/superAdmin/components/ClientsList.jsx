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
   ChevronLeftIcon,
   ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
   EntidadesIcon,
   CandadoIcon,
   EditarIcon,
   EliminarIcon,
} from '../../../components/icons/SidebarIcons';

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
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
               {/* BUSCADOR */}
               <div className="relative group w-full sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                     <MagnifyingGlassIcon className="h-4 w-4 text-[#8E9BB5] group-focus-within:text-[#1F6BFF]" />
                  </div>
                  <input
                     type="text"
                     className="block w-full pl-10 pr-4 py-2.5 border border-[#E2EAFD] rounded-xl bg-[#F8FAFF] text-xs text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition shadow-xs"
                     placeholder="Buscar por cliente, email o usuario..."
                     value={search}
                     onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                     }}
                  />
               </div>

               {/* FILTRO POR EMPRESA */}
               <div className="w-full sm:w-60">
                  <select
                     value={selectedEntityId || ''}
                     onChange={(e) => {
                        setSelectedEntityId(e.target.value ? Number(e.target.value) : null);
                        setPage(1);
                     }}
                     className="block w-full px-3.5 py-2.5 border border-[#E2EAFD] rounded-xl bg-[#F8FAFF] text-xs font-semibold text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] shadow-xs cursor-pointer"
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
               className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
               <PlusIcon className="w-4 h-4 stroke-[2.5]" />
               <span>Nuevo Cliente</span>
            </button>
         </div>

         {/* TABLA DE CLIENTES */}
         <div className="bg-white border border-[#E2EAFD] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full min-w-[860px] text-left border-collapse">
                  <thead>
                     <tr className="border-b border-[#E2EAFD] bg-[#F0F4FD] text-[#55607A] text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Cliente</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4">Empresas Asignadas</th>
                        <th className="py-3.5 px-4 text-center">Estado</th>
                        <th className="py-3.5 px-4 text-right w-52">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2EAFD]/70">
                     {loading ? (
                        <tr>
                           <td colSpan="5" className="py-12 text-center text-[#8E9BB5] text-xs">
                              <div className="flex flex-col items-center justify-center gap-2">
                                 <div className="w-6 h-6 border-2 border-[#1F6BFF] border-t-transparent rounded-full animate-spin" />
                                 <span className="font-medium">Cargando clientes...</span>
                              </div>
                           </td>
                        </tr>
                     ) : clients.length === 0 ? (
                        <tr>
                           <td colSpan="5" className="py-12 text-center text-[#8E9BB5] text-xs">
                              No se encontraron clientes contratantes registrados.
                           </td>
                        </tr>
                     ) : (
                        clients.map((client) => {
                           const assignedEntities = client.entities || [];

                           return (
                              <tr key={client.id} className="hover:bg-[#F9FBFF] transition group">
                                 {/* NOMBRE Y USUARIO */}
                                 <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-9 h-9 rounded-xl bg-[#EFF3FF] text-[#1F6BFF] flex items-center justify-center font-bold text-xs font-nunito shrink-0">
                                          {client.name?.[0] || client.username?.[0]?.toUpperCase() || 'C'}
                                       </div>
                                       <div className="min-w-0">
                                          <p className="font-bold text-[#0A1A3F] text-sm truncate">
                                             {client.name ? `${client.name} ${client.last_name || ''}` : client.username}
                                          </p>
                                          <p className="text-xs text-[#55607A]">@{client.username}</p>
                                       </div>
                                    </div>
                                 </td>

                                 {/* EMAIL */}
                                 <td className="py-3.5 px-4 text-xs text-[#55607A] font-medium font-sans">
                                    {client.email}
                                 </td>

                                 {/* EMPRESAS ASIGNADAS */}
                                 <td className="py-3.5 px-4">
                                    {assignedEntities.length === 0 ? (
                                       <span className="text-xs text-[#E5484D] font-semibold bg-[#FDF0F0] px-2.5 py-1 rounded-full border border-[#E5484D]/20">
                                          Sin empresas asignadas
                                       </span>
                                    ) : (
                                       <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
                                          {assignedEntities.slice(0, 2).map((ent) => (
                                             <span
                                                key={ent.id}
                                                className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-[#EFF3FF] text-[#1F6BFF] border border-[#DCE5FF]"
                                             >
                                                {ent.name}
                                             </span>
                                          ))}
                                          {assignedEntities.length > 2 && (
                                             <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#0A1A3F] text-white">
                                                +{assignedEntities.length - 2} más
                                             </span>
                                          )}
                                       </div>
                                    )}
                                 </td>

                                 {/* ESTADO */}
                                 <td className="py-3.5 px-4 text-center">
                                    <button
                                       type="button"
                                       onClick={() => toggleState(client)}
                                       className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          client.state_id === 1 ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'
                                       }`}
                                       title={client.state_id === 1 ? 'Activo (Clic para suspender)' : 'Suspendido (Clic para activar)'}
                                    >
                                       <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                             client.state_id === 1 ? 'translate-x-4' : 'translate-x-0'
                                          }`}
                                       />
                                    </button>
                                 </td>

                                 {/* ACCIONES */}
                                 <td className="py-3.5 px-4 text-right w-52">
                                    <div className="flex items-center justify-end gap-1.5">
                                       <Tooltip content="Configurar Permisos Granulares">
                                          <button
                                             type="button"
                                             onClick={() => setPermissionsClient(client)}
                                             className="p-2 rounded-xl text-[#1F6BFF] hover:bg-[#EFF3FF] transition cursor-pointer"
                                             aria-label="Permisos granulares"
                                          >
                                             <CandadoIcon className="w-4 h-4" />
                                          </button>
                                       </Tooltip>

                                       <Tooltip content="Asignar Empresas">
                                          <button
                                             type="button"
                                             onClick={() => setEntitiesClient(client)}
                                             className="p-2 rounded-xl text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#F0F4FD] transition cursor-pointer"
                                             aria-label="Asignar empresas"
                                          >
                                             <EntidadesIcon className="w-4 h-4" />
                                          </button>
                                       </Tooltip>

                                       <Tooltip content="Editar Cliente">
                                          <button
                                             type="button"
                                             onClick={() => setEditClient(client)}
                                             className="p-2 rounded-xl text-[#55607A] hover:text-[#1F6BFF] hover:bg-[#EFF3FF] transition cursor-pointer"
                                             aria-label="Editar cliente"
                                          >
                                             <EditarIcon className="w-4 h-4" />
                                          </button>
                                       </Tooltip>

                                       <Tooltip content="Eliminar Cliente">
                                          <button
                                             type="button"
                                             onClick={() => removeClient(client.id)}
                                             className="p-2 rounded-xl text-[#55607A] hover:text-[#E5484D] hover:bg-[#FDF0F0] transition cursor-pointer"
                                             aria-label="Eliminar cliente"
                                          >
                                             <EliminarIcon className="w-4 h-4" />
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
               <div className="py-3 px-4 border-t border-[#E2EAFD] flex items-center justify-between bg-white text-xs text-[#55607A]">
                  <span className="font-medium">
                     Mostrando página {page} de {totalPages} ({total} clientes en total)
                  </span>
                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="p-1.5 border border-[#E2EAFD] rounded-lg text-[#0A1A3F] hover:bg-[#F8FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                     >
                        <ChevronLeftIcon className="w-4 h-4" />
                     </button>
                     <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="p-1.5 border border-[#E2EAFD] rounded-lg text-[#0A1A3F] hover:bg-[#F8FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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
