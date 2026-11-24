// leins-front/src/pages/superAdmin/SuperAdminList.jsx
import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useSuperAdmins } from '../../hooks/useSuperAdmins';
import Modal from 'components/Modal';
import Tooltip from 'components/Tooltip';
import AdminEntitiesPanel from './AdminEntitiesPanel';
import ClientsList from './components/ClientsList';
import {
   MagnifyingGlassIcon,
   PlusIcon,
   ChevronLeftIcon,
   ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
   UsuarioIcon,
   AdministradoresIcon,
   EntidadesIcon,
   EditarIcon,
   EliminarIcon,
} from '../../components/icons/SidebarIcons';

export default function UsersPage() {
   const [searchParams, setSearchParams] = useSearchParams();
   const activeTab = searchParams.get('tab') === 'super-admin' ? 'super-admin' : 'clients';

   const {
      users,
      loading,
      page,
      setPage,
      total,
      limit,
      search,
      setSearch,
      toggleState,
      removeUser,
   } = useSuperAdmins();

   const [assignmentAdmin, setAssignmentAdmin] = useState(null);
   const totalPages = Math.ceil(total / limit);

   const handleTabChange = (tabKey) => {
      setSearchParams({ tab: tabKey });
   };

   return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in space-y-6">
         {/* CABECERA PRINCIPAL */}
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
               <h1 className="text-2xl sm:text-3xl font-black font-nunito text-[#0A1A3F] tracking-tight">
                  Usuarios del sistema
               </h1>
               <p className="text-xs sm:text-[13px] text-[#55607A] mt-1 font-sans">
                  Gestión integral de clientes contratantes y super administradores de la plataforma.
               </p>
            </div>

            {/* PESTAÑAS (TABS OFICIALES JEITO) */}
            <div className="inline-flex p-1 bg-[#F5F8FF] rounded-xl border border-[#E2EAFD] text-xs font-medium">
               <button
                  type="button"
                  onClick={() => handleTabChange('clients')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                     activeTab === 'clients'
                        ? 'bg-[#1F6BFF] text-white shadow-xs'
                        : 'text-[#55607A] hover:text-[#0A1A3F]'
                  }`}
               >
                  <UsuarioIcon className="w-4 h-4" />
                  <span>Clientes</span>
               </button>

               <button
                  type="button"
                  onClick={() => handleTabChange('super-admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                     activeTab === 'super-admin'
                        ? 'bg-[#1F6BFF] text-white shadow-xs'
                        : 'text-[#55607A] hover:text-[#0A1A3F]'
                  }`}
               >
                  <AdministradoresIcon className="w-4 h-4" />
                  <span>Super administradores</span>
               </button>
            </div>
         </div>

         {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
         {activeTab === 'clients' ? (
            <ClientsList />
         ) : (
            <div className="space-y-4">
               {/* BARRA SUPERIOR DE SUPER ADMINS */}
               <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="relative group w-full sm:w-72">
                     <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-4 w-4 text-[#8E9BB5] group-focus-within:text-[#1F6BFF]" />
                     </div>
                     <input
                        type="text"
                        className="block w-full pl-10 pr-4 py-2.5 border border-[#E2EAFD] rounded-xl bg-[#F8FAFF] text-xs text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition shadow-xs"
                        placeholder="Buscar por nombre o email..."
                        value={search}
                        onChange={(e) => {
                           setSearch(e.target.value);
                           setPage(1);
                        }}
                     />
                  </div>

                  <Link
                     to="/super-admin/create"
                     className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                  >
                     <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                     <span>Nuevo Super Admin</span>
                  </Link>
               </div>

               {/* TABLA DE SUPER ADMINISTRADORES */}
               <div className="bg-white border border-[#E2EAFD] rounded-2xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="w-full min-w-[760px] text-left border-collapse">
                        <thead>
                           <tr className="border-b border-[#E2EAFD] bg-[#F0F4FD] text-[#55607A] text-[11px] font-bold uppercase tracking-wider">
                              <th className="py-3.5 px-4">Usuario</th>
                              <th className="py-3.5 px-4">Email</th>
                              <th className="py-3.5 px-4 text-center">Estado</th>
                              <th className="py-3.5 px-4 text-right w-44">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2EAFD]/70">
                           {loading ? (
                              <tr>
                                 <td colSpan="4" className="py-12 text-center text-[#8E9BB5] text-xs">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                       <div className="w-6 h-6 border-2 border-[#1F6BFF] border-t-transparent rounded-full animate-spin" />
                                       <span className="font-medium">Cargando super administradores...</span>
                                    </div>
                                 </td>
                              </tr>
                           ) : users.length === 0 ? (
                              <tr>
                                 <td colSpan="4" className="py-12 text-center text-[#8E9BB5] text-xs">
                                    No se encontraron super administradores registrados.
                                 </td>
                              </tr>
                           ) : (
                              users.map((user) => (
                                 <tr key={user.id} className="hover:bg-[#F9FBFF] transition group">
                                    <td className="py-3.5 px-4">
                                       <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-xl bg-[#EFF3FF] text-[#1F6BFF] flex items-center justify-center font-bold text-xs font-nunito shrink-0">
                                             {user.name?.[0] || user.username[0].toUpperCase()}
                                          </div>
                                          <div>
                                             <p className="font-bold text-[#0A1A3F] text-sm">
                                                {user.username}
                                             </p>
                                             <p className="text-xs text-[#55607A]">
                                                {user.name} {user.last_name}
                                             </p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-xs text-[#55607A] font-medium font-sans">
                                       {user.email}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                       <button
                                          type="button"
                                          onClick={() => toggleState(user)}
                                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                             user.state_id === 1 ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'
                                          }`}
                                          title={user.state_id === 1 ? 'Activo (Clic para suspender)' : 'Inactivo (Clic para activar)'}
                                       >
                                          <span
                                             className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                user.state_id === 1 ? 'translate-x-4' : 'translate-x-0'
                                             }`}
                                          />
                                       </button>
                                    </td>
                                    <td className="py-3.5 px-4 text-right w-44">
                                       <div className="flex items-center justify-end gap-1.5">
                                          <Tooltip content="Asignar entidades">
                                             <button
                                                type="button"
                                                onClick={() => setAssignmentAdmin(user)}
                                                className="p-2 text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#F0F4FD] rounded-xl transition cursor-pointer"
                                                aria-label="Asignar entidades"
                                             >
                                                <EntidadesIcon className="w-4 h-4" />
                                             </button>
                                          </Tooltip>
                                          <Tooltip content="Editar super administrador">
                                             <Link
                                                to={`/super-admin/edit/${user.id}`}
                                                className="p-2 text-[#55607A] hover:text-[#1F6BFF] hover:bg-[#EFF3FF] rounded-xl transition"
                                                aria-label="Editar super administrador"
                                             >
                                                <EditarIcon className="w-4 h-4" />
                                             </Link>
                                          </Tooltip>
                                          <Tooltip content="Eliminar super administrador">
                                             <button
                                                type="button"
                                                onClick={() => removeUser(user.id)}
                                                className="p-2 text-[#55607A] hover:text-[#E5484D] hover:bg-[#FDF0F0] rounded-xl transition cursor-pointer"
                                                aria-label="Eliminar super administrador"
                                             >
                                                <EliminarIcon className="w-4 h-4" />
                                             </button>
                                          </Tooltip>
                                       </div>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>

                  {/* PAGINACIÓN */}
                  <div className="py-3 px-4 border-t border-[#E2EAFD] flex items-center justify-between bg-white text-xs text-[#55607A]">
                     <span className="font-medium">
                        Mostrando {users.length} de {total} registros
                     </span>
                     <div className="flex items-center gap-2">
                        <button
                           type="button"
                           onClick={() => setPage((p) => Math.max(1, p - 1))}
                           disabled={page === 1}
                           className="p-1.5 rounded-lg border border-[#E2EAFD] hover:bg-[#F8FAFF] text-[#0A1A3F] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                           <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold px-2 text-[#0A1A3F]">
                           Página {page} de {totalPages || 1}
                        </span>
                        <button
                           type="button"
                           onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                           disabled={page >= totalPages}
                           className="p-1.5 rounded-lg border border-[#E2EAFD] hover:bg-[#F8FAFF] text-[#0A1A3F] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                           <ChevronRightIcon className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               </div>

               <Modal
                  isOpen={Boolean(assignmentAdmin)}
                  onClose={() => setAssignmentAdmin(null)}
                  title="Asignar entidades"
                  maxWidth="max-w-6xl"
               >
                  <AdminEntitiesPanel admin={assignmentAdmin} />
               </Modal>
            </div>
         )}
      </div>
   );
}
