import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import { toast } from '../../components/Toaster';
import { getBalances } from '../../services/accountingApi';
import {
   ChevronDownIcon,
   ChevronRightIcon,
   ArrowPathIcon,
   BuildingStorefrontIcon,
   UserIcon,
   DocumentDuplicateIcon,
   BanknotesIcon,
   CurrencyDollarIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
}

function ResumenSaldos({ balances }) {
   const fmt = new Intl.NumberFormat('es-CL');
   const stats = useMemo(() => {
      let clientes = 0, proveedores = 0, saldoTotal = 0;
      for (const b of balances ?? []) {
         if (b.account_type === 'CLIENTE') clientes++;
         else proveedores++;
         saldoTotal += Number(b.balance || 0);
      }
      return { total: balances?.length ?? 0, clientes, proveedores, saldoTotal };
   }, [balances]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Entidades</div>
               <div className="text-xl font-bold text-heading">{stats.total}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl"><UserIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Clientes (Por Cobrar)</div>
               <div className="text-xl font-bold text-heading">{stats.clientes}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl"><BuildingStorefrontIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Proveedores (Por Pagar)</div>
               <div className="text-xl font-bold text-heading">{stats.proveedores}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><CurrencyDollarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Saldo Total Pendiente</div>
               <div className="text-xl font-bold text-brand">$ {fmt.format(stats.saldoTotal)}</div>
            </div>
         </div>
      </div>
   );
}

export default function AccountingBalances() {
   const { entityId, ready } = useEntityRequired();

   const [balances, setBalances] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   const [search, setSearch] = useState('');
   const [typeFilter, setTypeFilter] = useState('ALL');
   const [expandedRut, setExpandedRut] = useState(null);

   const [currentPage, setCurrentPage] = useState(1);
   const itemsPerPage = 15;

   const loadBalances = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const data = await getBalances({ entityId, type: typeFilter, q: search });
         setBalances(Array.isArray(data) ? data : []);
         setCurrentPage(1); // Reset page on new load
      } catch (e) {
         setErr(e.message || 'Error al obtener saldos por RUT');
      } finally {
         setLoading(false);
      }
   }, [entityId, typeFilter, search]);

   useEffect(() => {
      if (ready && entityId) {
         loadBalances();
      }
   }, [ready, entityId, loadBalances]);

   if (!ready) return <EntityRequiredNotice />;

   const totalPages = Math.ceil(balances.length / itemsPerPage);
   const paginatedBalances = balances.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

   return (
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Saldos Contables por RUT</h2>
                  <p className="text-sm text-text-soft mt-1">Resumen consolidado de saldos pendientes por cobrar y por pagar por cliente y proveedor.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={() => {
                        loadBalances();
                        toast.success('Saldos contables actualizados');
                     }}
                     className="h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                     <ArrowPathIcon className="w-5 h-5 stroke-2" />
                     <span>Actualizar Saldos</span>
                  </button>
               </div>
            </div>

            {/* Filter Section */}
            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                     <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
                  </div>
                  <button
                     onClick={() => { setSearch(''); setTypeFilter('ALL'); loadBalances(); }}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-4 h-4" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-8 relative">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Buscar por RUT o Nombre</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-text-soft/70" />
                        <input
                           type="text"
                           placeholder="Buscar por RUT o razón social..."
                           className={`${ctrl} pl-10`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Tipo de Cuenta</label>
                     <select
                        className={selectCtrl}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                     >
                        <option value="ALL">Todos (Clientes y Proveedores)</option>
                        <option value="RECEIVABLE">Solo Clientes (Cuentas por Cobrar)</option>
                        <option value="PAYABLE">Solo Proveedores (Cuentas por Pagar)</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Resumen Tarjetas */}
         <ResumenSaldos balances={balances} />

         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Balances Table */}
         <div className={`bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden transition-all ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="overflow-x-auto">
               <table className="min-w-full text-sm text-left">
                  <thead className="bg-surface-2 border-b border-border-subtle text-text-soft font-semibold">
                     <tr>
                        <th className="p-4 w-8"></th>
                        <th className="p-4 font-semibold">RUT</th>
                        <th className="p-4 font-semibold">Razón Social / Nombre</th>
                        <th className="p-4 font-semibold">Tipo Cuenta</th>
                        <th className="p-4 font-semibold text-right">Total Acumulado</th>
                        <th className="p-4 font-semibold text-right">Abonos / Pagos</th>
                        <th className="p-4 font-semibold text-right">Saldo Pendiente</th>
                        <th className="p-4 font-semibold text-center">Estado</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                     {paginatedBalances.length === 0 ? (
                        <tr>
                           <td className="p-10 text-center text-text-soft italic" colSpan={8}>
                              Sin resultados. Ajusta filtros.
                           </td>
                        </tr>
                     ) : (
                        paginatedBalances.map((row) => {
                           const isClient = row.account_type === 'CLIENTE';
                           const totalDoc = isClient ? row.total_debit : row.total_credit;
                           const paidDoc = isClient ? row.total_credit : row.total_debit;
                           const isPaid = row.balance <= 0;
                           const isPartial = row.balance > 0 && row.balance < totalDoc;
                           const isExpanded = expandedRut === row.rut;

                           return (
                              <React.Fragment key={row.rut}>
                                 <tr
                                    className="hover:bg-brand/5 transition-colors cursor-pointer group"
                                    onClick={() => setExpandedRut(isExpanded ? null : row.rut)}
                                 >
                                    <td className="p-4 text-text-soft">
                                       {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                    </td>
                                    <td className="p-4 font-mono font-bold text-heading">{row.rut}</td>
                                    <td className="p-4 font-medium text-text-main">{row.name}</td>
                                    <td className="p-4">
                                       <Pill colorClass={isClient ? 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30' : 'bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:ring-purple-500/30'}>
                                          {isClient ? <UserIcon className="w-3.5 h-3.5" /> : <BuildingStorefrontIcon className="w-3.5 h-3.5" />}
                                          {isClient ? 'CLIENTE' : 'PROVEEDOR'}
                                       </Pill>
                                    </td>
                                    <td className="p-4 text-right font-mono font-medium text-heading">{clp(totalDoc)}</td>
                                    <td className="p-4 text-right font-mono text-text-soft">{clp(paidDoc)}</td>
                                    <td
                                       className={`p-4 text-right font-mono font-bold ${
                                          isPaid ? 'text-text-main' : 'text-brand'
                                       }`}
                                    >
                                       {clp(row.balance)}
                                    </td>
                                    <td className="p-4 text-center">
                                       <Pill colorClass={
                                          isPaid
                                             ? 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30'
                                             : isPartial
                                             ? 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30'
                                             : 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/30'
                                       }>
                                          {row.status}
                                       </Pill>
                                    </td>
                                 </tr>
                                 {isExpanded && row.entries && row.entries.length > 0 && (
                                    <tr>
                                       <td colSpan={8} className="p-0 bg-surface-1">
                                          <div className="p-5 space-y-4 border-b border-border-subtle shadow-inner">
                                             <h4 className="text-xs uppercase font-bold text-text-soft tracking-wider">
                                                Historial de Movimientos Contables ({row.entries.length})
                                             </h4>
                                             <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-content">
                                                <table className="min-w-full text-xs text-left">
                                                   <thead className="bg-surface-2 text-text-soft font-semibold uppercase tracking-wider">
                                                      <tr>
                                                         <th className="py-2.5 px-4">Fecha</th>
                                                         <th className="py-2.5 px-4">Concepto / Glosa</th>
                                                         <th className="py-2.5 px-4 text-right">Debe (Cargo)</th>
                                                         <th className="py-2.5 px-4 text-right">Haber (Abono)</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-border-subtle/50">
                                                      {row.entries.map((entry) => (
                                                         <tr key={entry.id} className="hover:bg-surface-1">
                                                            <td className="py-2.5 px-4 text-text-main font-medium">{entry.date}</td>
                                                            <td className="py-2.5 px-4 font-medium text-heading">{entry.concept}</td>
                                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-text-main">{entry.debit > 0 ? clp(entry.debit) : '-'}</td>
                                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-brand">{entry.credit > 0 ? clp(entry.credit) : '-'}</td>
                                                         </tr>
                                                      ))}
                                                   </tbody>
                                                </table>
                                             </div>

                                          </div>
                                       </td>
                                    </tr>
                                 )}
                              </React.Fragment>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
               <div className="p-4 border-t border-border-subtle bg-surface-1 flex items-center justify-between text-sm">
                  <div className="text-text-soft font-medium">
                     Mostrando <span className="text-heading">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-heading">{Math.min(currentPage * itemsPerPage, balances.length)}</span> de <span className="text-heading">{balances.length}</span> resultados
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-content text-text-main font-medium hover:bg-surface-2 disabled:opacity-50 transition-colors"
                     >
                        Anterior
                     </button>
                     <div className="font-semibold text-text-main px-2">
                        Página {currentPage} de {totalPages}
                     </div>
                     <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-content text-text-main font-medium hover:bg-surface-2 disabled:opacity-50 transition-colors"
                     >
                        Siguiente
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}

