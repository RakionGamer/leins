import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useSuperAdmins } from '../../hooks/useSuperAdmins';
import Modal from 'components/Modal';
import Tooltip from 'components/Tooltip';
import AdminEntitiesPanel from './AdminEntitiesPanel';
import {
   MagnifyingGlassIcon,
   PencilSquareIcon,
   TrashIcon,
   PlusIcon,
   BuildingOffice2Icon,
   ChevronLeftIcon,
   ChevronRightIcon
} from '@heroicons/react/24/outline';

export default function SuperAdminList() {
   const {
      users, loading, page, setPage, total, limit,
      search, setSearch, toggleState, removeUser
   } = useSuperAdmins();
   const [assignmentAdmin, setAssignmentAdmin] = useState(null);

   const totalPages = Math.ceil(total / limit);

   return (
      <div className="p-6 max-w-7xl mx-auto animate-fade-in">

         {/* HEADER Y BUSCADOR */}
         <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
               <h1 className="text-2xl font-bold text-heading dark:text-white">Super administradores</h1>
               <p className="text-sm text-text-soft">Gestion de usuarios con acceso administrativo global</p>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
               <div className="relative group w-full md:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 group-focus-within:text-brand" />
                  </div>
                  <input
                     type="text"
                     className="block w-full pl-10 pr-3 py-2 border border-border-subtle rounded-xl bg-bg-content text-sm focus:ring-brand focus:border-brand transition-all shadow-sm"
                     placeholder="Buscar nombre, email..."
                     value={search}
                     onChange={(e) => { setSearch(e.target.value); setPage(1); }} // Reset página al buscar
                  />
               </div>

               <Link
                  to="/super-admin/create"
                  className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-brand-strong transition-all"
               >
                  <PlusIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Nuevo</span>
               </Link>
            </div>
         </div>

         {/* TABLA */}
         <div className="bg-bg-content border border-border-subtle rounded-2xl shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full min-w-[860px] text-left border-collapse">
                  <thead>
                     <tr className="border-b border-border-subtle bg-gray-50/50 dark:bg-white/5">
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft">Usuario</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft">Email</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft text-center">Estado</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-widest text-text-soft text-end w-48 min-w-[12rem]">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                     {loading ? (
                        <tr>
                           <td colSpan="4" className="p-8 text-center text-text-soft">Cargando datos...</td>
                        </tr>
                     ) : users.length === 0 ? (
                        <tr>
                           <td colSpan="4" className="p-8 text-center text-text-soft">No se encontraron super administradores.</td>
                        </tr>
                     ) : (
                        users.map((user) => (
                           <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="p-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                                       {user.name?.[0] || user.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                       <p className="font-medium text-heading dark:text-white text-sm">{user.username}</p>
                                       <p className="text-xs text-text-soft">{user.name} {user.last_name}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-4 text-sm text-text-soft">{user.email}</td>
                              <td className="p-4 text-center">
                                 <button
                                    onClick={() => toggleState(user)}
                                    className={`
                                       relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                                       ${user.state_id === 1 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                                    `}
                                 >
                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.state_id === 1 ? 'translate-x-4' : 'translate-x-0'}`} />
                                 </button>
                              </td>
                              <td className="p-4 text-right w-48 min-w-[12rem]">
                                 <div className="flex items-center justify-end gap-2">
                                    <Tooltip content="Asignar entidades">
                                       <button
                                          type="button"
                                          onClick={() => setAssignmentAdmin(user)}
                                          className="p-2 text-text-soft hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                          aria-label="Asignar entidades"
                                       >
                                          <BuildingOffice2Icon className="w-4 h-4" />
                                       </button>
                                    </Tooltip>
                                    <Tooltip content="Editar super administrador">
                                       <Link
                                          to={`/super-admin/edit/${user.id}`}
                                          className="p-2 text-text-soft hover:text-brand hover:bg-brand/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                          aria-label="Editar super administrador"
                                       >
                                          <PencilSquareIcon className="w-4 h-4" />
                                       </Link>
                                    </Tooltip>
                                    <Tooltip content="Eliminar super administrador">
                                       <button
                                          type="button"
                                          onClick={() => removeUser(user.id)}
                                          className="p-2 text-text-soft hover:text-danger hover:bg-danger/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                                          aria-label="Eliminar super administrador"
                                       >
                                          <TrashIcon className="w-4 h-4" />
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
            <div className="p-4 border-t border-border-subtle flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
               <span className="text-xs text-text-soft">
                  Mostrando {users.length} de {total} registros
               </span>
               <div className="flex items-center gap-2">
                  <button
                     onClick={() => setPage(p => Math.max(1, p - 1))}
                     disabled={page === 1}
                     className="p-1.5 rounded-lg border border-border-subtle hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                     <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium px-2">Página {page} de {totalPages || 1}</span>
                  <button
                     onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                     disabled={page >= totalPages}
                     className="p-1.5 rounded-lg border border-border-subtle hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
   );
}
