import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import { toast } from '../../components/Toaster';
import { getBalances } from '../../services/accountingApi';
import {
   ScaleIcon,
   MagnifyingGlassIcon,
   ArrowPathIcon,
   BanknotesIcon,
   ClockIcon,
   CurrencyDollarIcon,
   BuildingStorefrontIcon,
   UserIcon,
   FunnelIcon,
   ChevronRightIcon,
   ChevronDownIcon,
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand';

function Pill({ children, colorClass = 'bg-brand/10 text-brand ring-brand/20' }) {
   return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${colorClass}`}>
         {children}
      </span>
   );
}

function BalancesSummary({ balances }) {
   const summaryStats = useMemo(() => {
      let totalReceivable = 0;
      let totalPayable = 0;
      let countReceivable = 0;
      let countPayable = 0;

      balances.forEach((b) => {
         if (b.account_type === 'CLIENTE') {
            totalReceivable += b.balance;
            if (b.balance > 0) countReceivable++;
         } else {
            totalPayable += b.balance;
            if (b.balance > 0) countPayable++;
         }
      });

      return { totalReceivable, totalPayable, countReceivable, countPayable };
   }, [balances]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
               <CurrencyDollarIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-[10px] sm:text-xs font-semibold text-text-soft uppercase tracking-wide">Saldos por Cobrar</div>
               <div className="text-lg sm:text-xl font-bold text-emerald-600">{clp(summaryStats.totalReceivable)}</div>
            </div>
         </div>

         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
               <ClockIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-[10px] sm:text-xs font-semibold text-text-soft uppercase tracking-wide">Clientes Pendientes</div>
               <div className="text-lg sm:text-xl font-bold text-heading">{summaryStats.countReceivable} RUTs</div>
            </div>
         </div>

         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
               <BanknotesIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-[10px] sm:text-xs font-semibold text-text-soft uppercase tracking-wide">Saldos por Pagar</div>
               <div className="text-lg sm:text-xl font-bold text-rose-600">{clp(summaryStats.totalPayable)}</div>
            </div>
         </div>

         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl">
               <BuildingStorefrontIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Proveedores Pendientes</div>
               <div className="text-xl font-bold text-brand">{summaryStats.countPayable} RUTs</div>
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

   const loadBalances = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const data = await getBalances({ entityId, type: typeFilter, q: search });
         setBalances(Array.isArray(data) ? data : []);
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

   const handleClearFilters = () => {
      setSearch('');
      setTypeFilter('ALL');
   };

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Top Header Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Saldos Contables por RUT</h2>
                  <p className="text-sm text-text-soft mt-1">
                     Consolidado de Cuentas por Cobrar (Clientes) y Cuentas por Pagar (Proveedores) recalculado según asientos contables.
                  </p>
               </div>

               <button
                  onClick={() => {
                     loadBalances();
                     toast.success('Saldos contables actualizados');
                  }}
                  className={`${btnCtrl} text-brand border-brand/20 bg-brand/5`}
               >
                  <ArrowPathIcon className="w-5 h-5 stroke-2" />
                  <span>Actualizar Saldos</span>
               </button>
            </div>

            {/* Filter Section */}
            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                     <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
                  </div>
                  <button
                     onClick={handleClearFilters}
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
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3.5 top-3 text-text-soft" />
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
                     <select className={selectCtrl} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="ALL">Todos (Clientes y Proveedores)</option>
                        <option value="RECEIVABLE">Solo Clientes (Cuentas por Cobrar)</option>
                        <option value="PAYABLE">Solo Proveedores (Cuentas por Pagar)</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Summary Cards */}
         <BalancesSummary balances={balances} />

         {/* Error Notice */}
         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Balances Table */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-10 text-center text-brand font-medium animate-pulse flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" /> Calculando saldos por RUT...
               </div>
            ) : balances.length === 0 ? (
               <div className="p-12 text-center text-text-soft">
                  <ScaleIcon className="w-12 h-12 mx-auto text-text-soft/50 mb-3" />
                  <p className="text-base font-semibold">No hay movimientos registrados para calcular saldos</p>
                  <p className="text-sm mt-1">Genera asientos desde SII o crea asientos manuales para ver el consolidado por RUT.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft font-semibold">
                        <tr>
                           <th className="p-4 w-10"></th>
                           <th className="p-4">RUT</th>
                           <th className="p-4">Razón Social / Nombre</th>
                           <th className="p-4">Tipo Cuenta</th>
                           <th className="p-4 text-right">Total Acumulado</th>
                           <th className="p-4 text-right">Abonos / Pagos</th>
                           <th className="p-4 text-right">Saldo Pendiente</th>
                           <th className="p-4 text-center">Estado</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {balances.map((row) => {
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
                                       {isExpanded ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                                    </td>
                                    <td className="p-4 font-mono font-bold text-brand">{row.rut}</td>
                                    <td className="p-4 font-medium text-heading">{row.name}</td>
                                    <td className="p-4">
                                       <Pill
                                          colorClass={
                                             isClient
                                                ? 'bg-blue-500/10 text-blue-600 ring-blue-500/20'
                                                : 'bg-purple-500/10 text-purple-600 ring-purple-500/20'
                                          }
                                       >
                                          {isClient ? <UserIcon className="w-3.5 h-3.5" /> : <BuildingStorefrontIcon className="w-3.5 h-3.5" />}
                                          {isClient ? 'CLIENTE' : 'PROVEEDOR'}
                                       </Pill>
                                    </td>
                                    <td className="p-4 text-right font-mono font-semibold text-text-main">{clp(totalDoc)}</td>
                                    <td className="p-4 text-right font-mono text-text-soft">{clp(paidDoc)}</td>
                                    <td
                                       className={`p-4 text-right font-mono font-bold ${
                                          isPaid ? 'text-emerald-600' : isClient ? 'text-blue-600' : 'text-rose-600'
                                       }`}
                                    >
                                       {clp(row.balance)}
                                    </td>
                                    <td className="p-4 text-center">
                                       <Pill
                                          colorClass={
                                             isPaid
                                                ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
                                                : isPartial
                                                ? 'bg-amber-500/10 text-amber-600 ring-amber-500/20'
                                                : 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
                                          }
                                       >
                                          {row.status}
                                       </Pill>
                                    </td>
                                 </tr>
                                 {isExpanded && row.documents && row.documents.length > 0 && (
                                    <tr>
                                       <td colSpan={8} className="p-0 bg-surface-1">
                                          <div className="p-5 space-y-3 border-y border-border-subtle/80">
                                             <h4 className="text-xs uppercase font-bold text-text-soft tracking-wider">
                                                Detalle de Documentos Pendientes ({row.documents.length})
                                             </h4>
                                             <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-content">
                                                <table className="min-w-full text-xs text-left">
                                                   <thead className="bg-surface-2 text-text-soft font-semibold border-b border-border-subtle">
                                                      <tr>
                                                         <th className="py-2.5 px-4">Fecha</th>
                                                         <th className="py-2.5 px-4">Tipo Documento</th>
                                                         <th className="py-2.5 px-4">Folio</th>
                                                         <th className="py-2.5 px-4 text-right">Total</th>
                                                         <th className="py-2.5 px-4 text-right">Pagado</th>
                                                         <th className="py-2.5 px-4 text-right">Saldo</th>
                                                         <th className="py-2.5 px-4 text-center">Estado</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-border-subtle/50">
                                                      {row.documents.map(doc => (
                                                         <tr key={doc.id} className="hover:bg-brand/5">
                                                            <td className="py-2.5 px-4 text-text-soft font-medium">{doc.issue_date}</td>
                                                            <td className="py-2.5 px-4 font-semibold text-heading">{doc.document_type}</td>
                                                            <td className="py-2.5 px-4 font-mono font-bold text-brand">N° {doc.folio}</td>
                                                            <td className="py-2.5 px-4 text-right font-mono text-text-main">{clp(doc.total)}</td>
                                                            <td className="py-2.5 px-4 text-right font-mono text-text-soft">{clp(doc.paid)}</td>
                                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-heading">{clp(doc.balance)}</td>
                                                            <td className="py-2.5 px-4 text-center">
                                                               <Pill
                                                                  colorClass={
                                                                     doc.status === 'Pagado'
                                                                        ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
                                                                        : doc.status === 'Parcial'
                                                                        ? 'bg-amber-500/10 text-amber-600 ring-amber-500/20'
                                                                        : 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
                                                                  }
                                                               >
                                                                  {doc.status}
                                                               </Pill>
                                                            </td>
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
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      </div>
   );
}

