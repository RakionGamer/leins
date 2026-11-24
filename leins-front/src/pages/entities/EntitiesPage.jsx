import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'components/Toaster';
import Modal from 'components/Modal';
import { useEntity } from '../../context/EntityContext';
import { formatRutCL } from '../../utils/validators';
import EntityCredentialsPanel from './EntityCredentialsPanel';
import ClientUsersPanel from './ClientUsersPanel';
import EntityRowActionsMenu from './EntityRowActionsMenu';
import {
   PlusIcon,
   ArrowUpIcon,
   ArrowDownIcon,
   ArrowPathIcon,
   MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import {
   EntidadesIcon,
   EntidadActivaIcon,
   EntidadInactivaIcon,
   EntidadSesionIcon,
   FiltroIcon,
} from '../../components/icons/SidebarIcons';
import {
   listEntities,
   createEntity,
   updateEntity,
   changeEntityState,
   deleteEntity
} from '../../services/entitiesApi';

const DEFAULT_FORM = {
   name: '',
   rut: '',
   legalName: '',
};

const ACTIVE_STATE_ID = 1;
const INACTIVE_STATE_ID = 2;

function isEntityActive(row) {
   return Number(row?.state_id || 0) === ACTIVE_STATE_ID;
}

function entityStateLabel(row) {
   return isEntityActive(row) ? 'Activa' : 'Inactiva';
}

function useDebouncedValue(value, delay = 300) {
   const [debounced, setDebounced] = React.useState(value);

   React.useEffect(() => {
      const t = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(t);
   }, [value, delay]);

   return debounced;
}

export default function EntitiesPage() {
   const queryClient = useQueryClient();
   const { entityId, setEntity, currentEntity } = useEntity();

   const [search, setSearch] = useState('');
   const [page, setPage] = useState(0);
   const [pageSize, setPageSize] = useState(25);
   const [sortBy, setSortBy] = useState('name');
   const [sortOrder, setSortOrder] = useState('asc');
   const [activeOnly, setActiveOnly] = useState(false);
   const [form, setForm] = useState(DEFAULT_FORM);
   const [editingId, setEditingId] = useState(null);
   const [entityModalOpen, setEntityModalOpen] = useState(false);
   const [saving, setSaving] = useState(false);
   const [changingStateId, setChangingStateId] = useState(null);
   const [deletingId, setDeletingId] = useState(null);
   const [credentialsEntity, setCredentialsEntity] = useState(null);
   const [clientsEntity, setClientsEntity] = useState(null);
   const debouncedSearch = useDebouncedValue(search, 300);

   const { data, isLoading, isFetching, error } = useQuery({
      queryKey: ['entities-admin', { q: debouncedSearch, page, pageSize, sortBy, sortOrder, activeOnly }],
      queryFn: ({ signal }) => listEntities({
         q: debouncedSearch,
         limit: pageSize,
         offset: page * pageSize,
         sort: sortBy,
         order: sortOrder,
         activeOnly,
         assignedAdminOnly: true,
         signal
      })
   });

   const rows = data?.rows || [];
   const total = Number(data?.total || rows.length || 0);
   const totalPages = Math.max(1, Math.ceil(total / pageSize));
   const selectedEntityId = Number(entityId || 0);

   // Estadísticas para las tarjetas KPI de Jeito
   const stats = useMemo(() => {
      let activeCount = 0;
      let inactiveCount = 0;
      for (const r of rows) {
         if (isEntityActive(r)) activeCount++;
         else inactiveCount++;
      }
      return {
         total,
         active: activeOnly ? total : activeCount,
         inactive: activeOnly ? 0 : inactiveCount,
      };
   }, [rows, total, activeOnly]);

   // Nombre y RUT de la entidad seleccionada en la sesión actual
   const activeSessionEntityName = useMemo(() => {
      if (currentEntity?.name) return currentEntity.name;
      const found = rows.find((r) => Number(r.id) === selectedEntityId);
      if (found) return found.name || found.legal_name || `Entidad #${found.id}`;
      return selectedEntityId ? `Entidad #${selectedEntityId}` : 'Ninguna seleccionada';
   }, [currentEntity, rows, selectedEntityId]);

   const activeSessionEntityRut = useMemo(() => {
      if (currentEntity?.rut) return formatRutCL(currentEntity.rut);
      const found = rows.find((r) => Number(r.id) === selectedEntityId);
      if (found?.rut) return formatRutCL(found.rut);
      return selectedEntityId ? `ID #${selectedEntityId}` : 'Espacio de trabajo activo';
   }, [currentEntity, rows, selectedEntityId]);

   const formTitle = useMemo(
      () => (editingId ? 'Editar entidad' : 'Nueva entidad'),
      [editingId]
   );

   const resetForm = () => {
      setForm(DEFAULT_FORM);
      setEditingId(null);
   };

   const handleHeaderSort = (columnKey) => {
      if (sortBy === columnKey) {
         setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
         setSortBy(columnKey);
         setSortOrder('asc');
      }
      setPage(0);
   };

   const openCreateModal = () => {
      resetForm();
      setEntityModalOpen(true);
   };

   const closeEntityModal = () => {
      if (saving) return;
      resetForm();
      setEntityModalOpen(false);
   };

   const refreshEntities = async () => {
      await queryClient.invalidateQueries({ queryKey: ['entities-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['entities'] });
   };

   const onSubmit = async (e) => {
      e.preventDefault();
      const name = String(form.name || '').trim();
      const rut = String(form.rut || '').trim();
      const legalName = String(form.legalName || '').trim();

      if (!name) return toast.error('Ingresa el nombre de la entidad');
      if (!rut) return toast.error('Ingresa el RUT de la entidad');

      try {
         setSaving(true);
         if (editingId) {
            await updateEntity({ id: editingId, name, rut, legalName });
            toast.success('Entidad actualizada');
         } else {
            await createEntity({ name, rut, legalName });
            toast.success('Entidad creada');
         }

         await refreshEntities();
         resetForm();
         setEntityModalOpen(false);
      } catch (err) {
         toast.error(err?.message || 'No se pudo guardar la entidad');
      } finally {
         setSaving(false);
      }
   };

   const startEdit = (row) => {
      setEditingId(Number(row.id));
      setForm({
         name: row.name || row.legal_name || '',
         rut: row.rut || '',
         legalName: row.legal_name || '',
      });
      setEntityModalOpen(true);
   };

   const clearSelectedEntity = () => {
      setEntity(null);
      try { localStorage.removeItem('entityId'); } catch {}
      const url = new URL(window.location.href);
      url.searchParams.delete('entityId');
      window.history.replaceState({}, '', url);
   };

   const selectEntity = (row) => {
      const nextId = Number(row.id);
      if (!nextId) return;

      const nextEntity = {
         id: nextId,
         name: row.name || row.legal_name || `Entidad ${nextId}`,
         rut: row.rut || '',
      };

      setEntity(nextEntity);
      try { localStorage.setItem('entityId', String(nextId)); } catch {}

      const url = new URL(window.location.href);
      url.searchParams.set('entityId', String(nextId));
      window.history.replaceState({}, '', url);

      toast.success(`Entidad activa: ${nextEntity.name}`);
   };

   const onToggleState = async (row) => {
      const isActive = isEntityActive(row);
      const nextStateId = isActive ? INACTIVE_STATE_ID : ACTIVE_STATE_ID;
      const action = isActive ? 'desactivar' : 'activar';
      const ok = window.confirm(`¿Quieres ${action} la entidad ${row.name || row.legal_name || row.id}?`);
      if (!ok) return;

      try {
         setChangingStateId(Number(row.id));
         await changeEntityState({ id: row.id, stateId: nextStateId });

         if (Number(row.id) === selectedEntityId && isActive) {
            clearSelectedEntity();
         }

         toast.success(isActive ? 'Entidad desactivada' : 'Entidad activada');

         await refreshEntities();
         if (Number(editingId) === Number(row.id)) resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo cambiar el estado de la entidad');
      } finally {
         setChangingStateId(null);
      }
   };

   const onDelete = async (row) => {
      const ok = window.confirm(
         `Vas a eliminar la entidad "${row.name || row.legal_name || row.id}". Esta acción no se puede deshacer. ¿Continuar?`
      );
      if (!ok) return;

      try {
         setDeletingId(Number(row.id));
         const out = await deleteEntity({ id: row.id });

         if (out.deleted) {
            toast.success('Entidad eliminada');
            if (Number(row.id) === selectedEntityId) clearSelectedEntity();
         } else if (out.deactivated) {
            const detail = (out.blockedBy || [])
               .map((item) => `${item.label} (${item.count})`)
               .join(', ');
            toast.success(
               detail
                  ? `No se pudo eliminar, tiene datos asociados: ${detail}. Se desactivó en su lugar.`
                  : 'La entidad tenía datos asociados: se desactivó en lugar de eliminarse'
            );
            if (Number(row.id) === selectedEntityId) clearSelectedEntity();
         }

         await refreshEntities();
         if (Number(editingId) === Number(row.id)) resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo eliminar la entidad');
      } finally {
         setDeletingId(null);
      }
   };

   return (
      <div className="space-y-6">
         {/* ======================================================== */}
         {/* 1. Encabezado principal (Jeito Official Identity)        */}
         {/* ======================================================== */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <div className="flex items-center gap-2 text-xs font-medium text-[#8E9BB5] mb-1">
                  <span>General</span>
                  <span>›</span>
                  <span className="text-[#55607A]">Entidades</span>
               </div>
               <h1 className="text-2xl sm:text-3xl font-nunito font-black text-[#0A1A3F] tracking-tight">
                  Entidades
               </h1>
               <p className="text-xs sm:text-sm text-[#55607A] font-medium mt-0.5">
                  Crea, edita y administra las entidades y empresas del sistema.
               </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
               <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer"
               >
                  <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                  <span>Nueva entidad</span>
               </button>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 2. Tarjetas KPI de Resumen (Jeito Metric Cards Oficiales)*/}
         {/* ======================================================== */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total entidades */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        Total entidades
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <EntidadesIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {total}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     {total === 1 ? '1 empresa en sistema' : `${total} empresas registradas`}
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 bg-[#EFF3FF] text-[#1F6BFF] text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF]"></span>
                     <span>Catálogo general</span>
                  </span>
               </div>
            </div>

            {/* Card 2: Entidades activas */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        Entidades activas
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <EntidadActivaIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {stats.active}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     Habilitadas para operar
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 bg-[#E8F8F0] text-[#0D9488] text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]"></span>
                     <span>{total > 0 ? `${Math.round((stats.active / total) * 100)}% del total` : 'Operativas'}</span>
                  </span>
               </div>
            </div>

            {/* Card 3: Entidades inactivas */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        Entidades inactivas
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <EntidadInactivaIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {stats.inactive}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     Pausadas o sin acceso
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 bg-[#F3F4F6] text-[#6B7280] text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]"></span>
                     <span>{stats.inactive > 0 ? `${stats.inactive} inactivas` : '0 inactivas'}</span>
                  </span>
               </div>
            </div>

            {/* Card 4: Entidad en sesión (Tarjeta destacada Azul Marino oficial) */}
            <div className="bg-[#0A1A3F] text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#8E9FCA]">
                        Entidad en sesión
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                        <EntidadSesionIcon className="w-4 h-4 text-white" />
                     </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-nunito text-white tracking-tight mt-3 truncate" title={activeSessionEntityName}>
                     {activeSessionEntityName}
                  </div>
                  <div className="text-xs text-[#8E9FCA] mt-1 font-medium truncate">
                     {activeSessionEntityRut}
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF]"></span>
                     <span>En uso actual</span>
                  </span>
               </div>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 3. Tarjeta de Filtros de Búsqueda                       */}
         {/* ======================================================== */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div className="flex items-center gap-2 text-sm font-bold text-[#0A1A3F]">
                  <FiltroIcon className="w-4 h-4 text-[#1F6BFF]" />
                  <span>Filtros de búsqueda</span>
               </div>
               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => {
                        setSearch('');
                        setSortBy('name');
                        setSortOrder('asc');
                        setActiveOnly(false);
                        setPage(0);
                     }}
                     className="flex items-center gap-1.5 text-xs font-semibold text-[#8E9BB5] hover:text-[#0A1A3F] transition cursor-pointer"
                  >
                     <ArrowPathIcon className="w-3.5 h-3.5" />
                     <span>Limpiar filtros</span>
                  </button>

                  <div className="inline-flex p-1 bg-[#F5F8FF] rounded-xl border border-[#E2EAFD] text-xs font-medium">
                     <button
                        type="button"
                        onClick={() => {
                           setActiveOnly(false);
                           setPage(0);
                        }}
                        className={`px-3 py-1 rounded-lg transition font-bold text-xs cursor-pointer ${
                           !activeOnly
                              ? 'bg-white text-[#1F6BFF] shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F]'
                        }`}
                     >
                        Todas
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setActiveOnly(true);
                           setPage(0);
                        }}
                        className={`px-3 py-1 rounded-lg transition font-bold text-xs cursor-pointer ${
                           activeOnly
                              ? 'bg-white text-[#1F6BFF] shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F]'
                        }`}
                     >
                        Solo activas
                     </button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 pt-1">
               {/* 1. Búsqueda */}
               <div className="lg:col-span-6">
                  <label className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     Búsqueda
                  </label>
                  <div className="relative flex items-center">
                     <MagnifyingGlassIcon className="w-4 h-4 text-[#8E9BB5] absolute left-3.5 pointer-events-none" />
                     <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                           setSearch(e.target.value);
                           setPage(0);
                        }}
                        className="w-full h-11 pl-10 pr-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition"
                        placeholder="Buscar por nombre o RUT..."
                        autoComplete="off"
                     />
                  </div>
               </div>

               {/* 2. Ordenar por */}
               <div className="lg:col-span-3">
                  <label htmlFor="entities-sort-by" className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     Ordenar por
                  </label>
                  <select
                     id="entities-sort-by"
                     value={sortBy}
                     onChange={(e) => {
                        setSortBy(e.target.value);
                        setPage(0);
                     }}
                     className="w-full h-11 pl-3.5 pr-9 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition cursor-pointer"
                  >
                     <option value="name">Nombre</option>
                     <option value="rut">RUT</option>
                     <option value="id">ID</option>
                  </select>
               </div>

               {/* 3. Dirección */}
               <div className="lg:col-span-3">
                  <label htmlFor="entities-sort-order" className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     Dirección
                  </label>
                  <div className="flex items-center gap-2">
                     <select
                        id="entities-sort-order"
                        value={sortOrder}
                        onChange={(e) => {
                           setSortOrder(e.target.value);
                           setPage(0);
                        }}
                        className="w-full h-11 pl-3.5 pr-9 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition cursor-pointer"
                     >
                        <option value="asc">Ascendente</option>
                        <option value="desc">Descendente</option>
                     </select>
                     <button
                        type="button"
                        onClick={() => {
                           setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                           setPage(0);
                        }}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] hover:bg-white hover:border-[#1F6BFF] transition cursor-pointer"
                        title={sortOrder === 'asc' ? 'Orden ascendente (clic para cambiar a descendente)' : 'Orden descendente (clic para cambiar a ascendente)'}
                        aria-label={sortOrder === 'asc' ? 'Cambiar dirección a descendente' : 'Cambiar dirección a ascendente'}
                     >
                        {sortOrder === 'asc' ? (
                           <ArrowUpIcon className="h-4 w-4" />
                        ) : (
                           <ArrowDownIcon className="h-4 w-4" />
                        )}
                     </button>
                  </div>
               </div>
            </div>

            {/* Checkbox oculto/accesible para compatibilidad completa */}
            <div className="hidden">
               <label className="inline-flex items-center gap-2 text-xs text-[#55607A]">
                  <input
                     type="checkbox"
                     checked={activeOnly}
                     onChange={(e) => {
                        setActiveOnly(e.target.checked);
                        setPage(0);
                     }}
                  />
                  Solo activas
               </label>
            </div>
         </div>

         {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium p-4 flex items-center justify-between">
               <span>{error?.message || 'No se pudieron cargar las entidades'}</span>
               <button
                  type="button"
                  onClick={refreshEntities}
                  className="underline font-bold hover:text-rose-900"
               >
                  Reintentar
               </button>
            </div>
         )}

         {/* ======================================================== */}
         {/* 4. Tabla de Entidades (Jeito Official Identity)          */}
         {/* ======================================================== */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-[#F0F4FD] text-[#55607A] text-[11px] font-bold uppercase tracking-wider border-b border-[#E2EAFD]">
                        <th className="py-3.5 px-4">
                           <button
                              type="button"
                              onClick={() => handleHeaderSort('name')}
                              className={`inline-flex items-center gap-1.5 font-bold hover:text-[#0A1A3F] transition cursor-pointer ${
                                 sortBy === 'name' ? 'text-[#1F6BFF]' : 'text-[#55607A]'
                              }`}
                           >
                              <span>Nombre / Fantasía</span>
                              {sortBy === 'name' && (
                                 sortOrder === 'asc'
                                    ? <ArrowUpIcon className="h-3.5 w-3.5 text-[#1F6BFF]" />
                                    : <ArrowDownIcon className="h-3.5 w-3.5 text-[#1F6BFF]" />
                              )}
                           </button>
                        </th>
                        <th className="py-3.5 px-4">
                           <button
                              type="button"
                              onClick={() => handleHeaderSort('rut')}
                              className={`inline-flex items-center gap-1.5 font-bold hover:text-[#0A1A3F] transition cursor-pointer ${
                                 sortBy === 'rut' ? 'text-[#1F6BFF]' : 'text-[#55607A]'
                              }`}
                           >
                              <span>RUT</span>
                              {sortBy === 'rut' && (
                                 sortOrder === 'asc'
                                    ? <ArrowUpIcon className="h-3.5 w-3.5 text-[#1F6BFF]" />
                                    : <ArrowDownIcon className="h-3.5 w-3.5 text-[#1F6BFF]" />
                              )}
                           </button>
                        </th>
                        <th className="py-3.5 px-4">Razón social</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4">
                           <button
                              type="button"
                              onClick={() => handleHeaderSort('id')}
                              className={`inline-flex items-center gap-1.5 font-bold hover:text-[#0A1A3F] transition cursor-pointer ${
                                 sortBy === 'id' ? 'text-[#1F6BFF]' : 'text-[#55607A]'
                              }`}
                           >
                              <span>ID</span>
                              {sortBy === 'id' && (
                                 sortOrder === 'asc'
                                    ? <ArrowUpIcon className="h-3.5 w-3.5 text-[#1F6BFF]" />
                                    : <ArrowDownIcon className="h-3.5 w-3.5 text-[#1F6BFF]" />
                              )}
                           </button>
                        </th>
                        <th className="py-3.5 px-4 text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F4FD] text-xs">
                     {isLoading ? (
                        <tr>
                           <td colSpan={6} className="py-12 text-center text-[#8E9BB5]">
                              <div className="flex flex-col items-center justify-center gap-2">
                                 <div className="w-6 h-6 border-2 border-[#1F6BFF] border-t-transparent rounded-full animate-spin" />
                                 <span className="font-medium">Cargando entidades...</span>
                              </div>
                           </td>
                        </tr>
                     ) : rows.length === 0 ? (
                        <tr>
                           <td colSpan={6} className="py-12 text-center text-[#8E9BB5]">
                              <div className="flex flex-col items-center justify-center gap-1">
                                 <EntidadesIcon className="w-8 h-8 text-[#8E9BB5]" />
                                 <span className="font-semibold text-sm text-[#0A1A3F] mt-1">No hay entidades registradas</span>
                                 <span className="text-xs">Prueba ajustando los filtros o crea una nueva entidad.</span>
                              </div>
                           </td>
                        </tr>
                     ) : (
                        rows.map((row) => {
                           const isSelected = Number(row.id) === selectedEntityId;
                           const isActive = isEntityActive(row);
                           const canDelete = row.permissions?.can_delete ?? true;
                           const canUpdate = row.permissions?.can_update ?? true;
                           return (
                              <tr
                                 key={row.id}
                                 className="hover:bg-[#F9FBFF] transition group"
                              >
                                 {/* Nombre */}
                                 <td className="py-3.5 px-4 font-bold text-[#0A1A3F]">
                                    <div className="flex items-center gap-2">
                                       <span>{row.name || row.legal_name || '-'}</span>
                                       {isSelected && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF3FF] text-[#1F6BFF] border border-[#BFDBFE]">
                                             Activa en sesión
                                          </span>
                                       )}
                                    </div>
                                 </td>

                                 {/* RUT */}
                                 <td className="py-3.5 px-4 font-mono font-semibold text-[#55607A]">
                                    {row.rut || '-'}
                                 </td>

                                 {/* Razón social */}
                                 <td className="py-3.5 px-4 text-[#55607A] font-medium max-w-[260px] truncate" title={row.legal_name || ''}>
                                    {row.legal_name || '-'}
                                 </td>

                                 {/* Estado */}
                                 <td className="py-3.5 px-4">
                                    {isActive ? (
                                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F8F0] text-[#0D9488]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                          {entityStateLabel(row)}
                                       </span>
                                    ) : (
                                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#F3F4F6] text-[#6B7280]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                                          {entityStateLabel(row)}
                                       </span>
                                    )}
                                 </td>

                                 {/* ID */}
                                 <td className="py-3.5 px-4 font-mono text-[#8E9BB5]">
                                    #{row.id}
                                 </td>

                                 {/* Acciones */}
                                 <td className="py-3.5 px-4 text-right">
                                    <div className="flex justify-end">
                                       <EntityRowActionsMenu
                                          row={row}
                                          isSelected={isSelected}
                                          isActive={isActive}
                                          canUpdate={canUpdate}
                                          canDelete={canDelete}
                                          isChangingState={Number(changingStateId) === Number(row.id)}
                                          isDeleting={Number(deletingId) === Number(row.id)}
                                          onSelect={selectEntity}
                                          onEdit={startEdit}
                                          onOpenCredentials={setCredentialsEntity}
                                          onOpenClients={setClientsEntity}
                                          onToggleState={onToggleState}
                                          onDelete={onDelete}
                                       />
                                    </div>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>

            {/* Paginación Jeito */}
            {!isLoading && total > 0 && (
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 border-t border-[#E2EAFD] bg-[#FAFBFD]">
                  <div className="text-xs text-[#55607A] font-medium">
                     Mostrando {rows.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total} entidades
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="px-3.5 py-1.5 rounded-lg border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-xs font-bold text-[#0A1A3F] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                     >
                        Anterior
                     </button>
                     <div className="text-xs font-semibold text-[#55607A] px-2">
                        Página {Math.min(page + 1, totalPages)} de {totalPages}
                     </div>
                     <button
                        type="button"
                        disabled={(page + 1) >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3.5 py-1.5 rounded-lg border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-xs font-bold text-[#0A1A3F] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                     >
                        Siguiente
                     </button>
                     <select
                        aria-label="Filas por página"
                        value={pageSize}
                        onChange={(e) => {
                           setPageSize(Number(e.target.value));
                           setPage(0);
                        }}
                        className="min-w-[82px] border border-[#E2EAFD] bg-white text-[#0A1A3F] rounded-lg pl-3 pr-9 py-1.5 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                     >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                     </select>
                  </div>
               </div>
            )}
         </div>

         {/* ======================================================== */}
         {/* 5. Modales (Crear/Editar, Credenciales, Clientes)        */}
         {/* ======================================================== */}
         <Modal
            isOpen={entityModalOpen}
            onClose={closeEntityModal}
            title={formTitle}
            maxWidth="max-w-xl"
         >
            <form className="space-y-4 pt-1" onSubmit={onSubmit}>
               <div className="flex flex-col gap-1.5">
                  <label htmlFor="entity-name" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                     Nombre / Fantasía *
                  </label>
                  <input
                     id="entity-name"
                     type="text"
                     value={form.name}
                     onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                     className="w-full h-11 px-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition"
                     placeholder="Ej: Comercial Andes SpA"
                     maxLength={120}
                     autoComplete="off"
                     autoFocus
                  />
               </div>

               <div className="flex flex-col gap-1.5">
                  <label htmlFor="entity-rut" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                     RUT contribuyente *
                  </label>
                  <input
                     id="entity-rut"
                     type="text"
                     value={form.rut}
                     onChange={(e) => setForm((s) => ({ ...s, rut: formatRutCL(e.target.value) }))}
                     className="w-full h-11 px-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition"
                     placeholder="Ej: 76.999.555-2"
                     maxLength={12}
                     autoComplete="off"
                  />
               </div>

               <div className="flex flex-col gap-1.5">
                  <label htmlFor="entity-legal-name" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                     Razón social (opcional)
                  </label>
                  <input
                     id="entity-legal-name"
                     type="text"
                     value={form.legalName}
                     onChange={(e) => setForm((s) => ({ ...s, legalName: e.target.value }))}
                     className="w-full h-11 px-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition"
                     placeholder="Ej: Comercial e Inversiones Los Andes Limitada"
                     maxLength={160}
                     autoComplete="off"
                  />
               </div>

               <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-[#E2EAFD]">
                  <button
                     type="button"
                     onClick={closeEntityModal}
                     disabled={saving}
                     className="px-5 py-2.5 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={saving}
                     className={`px-5 py-2.5 rounded-full text-white text-xs font-bold transition shadow-xs cursor-pointer ${
                        saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1F6BFF] hover:bg-[#1657D7]'
                     }`}
                  >
                     {saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Crear entidad')}
                  </button>
               </div>
            </form>
         </Modal>

         <Modal
            isOpen={Boolean(credentialsEntity)}
            onClose={() => setCredentialsEntity(null)}
            title="Credenciales de entidad"
            maxWidth="max-w-6xl"
         >
            <EntityCredentialsPanel entity={credentialsEntity} />
         </Modal>

         <Modal
            isOpen={Boolean(clientsEntity)}
            onClose={() => setClientsEntity(null)}
            title="Clientes de la entidad"
            maxWidth="max-w-6xl"
         >
            <ClientUsersPanel entity={clientsEntity} />
         </Modal>
      </div>
   );
}
