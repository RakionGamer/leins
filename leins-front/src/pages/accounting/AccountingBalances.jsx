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

const ctrl = 'w-full h-9 px-3 text-sm rounded border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 transition-colors shadow-2xs';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-9 flex items-center justify-center gap-2 px-3 rounded border border-gray-300 bg-white text-gray-700 text-sm font-medium shadow-2xs hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer';

function Pill({ children, colorClass = 'bg-gray-100 text-gray-700 border-gray-200' }) {
   return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
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
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-md">
               <CurrencyDollarIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Saldos por Cobrar</div>
               <div className="text-lg font-bold text-gray-900">{clp(summaryStats.totalReceivable)}</div>
            </div>
         </div>

         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-600 rounded-md">
               <ClockIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Clientes Pendientes</div>
               <div className="text-lg font-bold text-gray-900">{summaryStats.countReceivable} RUTs</div>
            </div>
         </div>

         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-md">
               <BanknotesIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Saldos por Pagar</div>
               <div className="text-lg font-bold text-gray-900">{clp(summaryStats.totalPayable)}</div>
            </div>
         </div>

         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-700 rounded-md">
               <BuildingStorefrontIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Proveedores Pendientes</div>
               <div className="text-lg font-bold text-gray-900">{summaryStats.countPayable} RUTs</div>
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
      <div className="space-y-4">
         {/* Top Header Card */}
         <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Saldos Contables por RUT</h2>
                  <p className="text-xs text-gray-500 mt-1">
                     Consolidado de Cuentas por Cobrar (Clientes) y Cuentas por Pagar (Proveedores) recalculado según asientos contables.
                  </p>
               </div>

               <button
                  onClick={() => {
                     loadBalances();
                     toast.success('Saldos contables actualizados');
                  }}
                  className={btnCtrl}
               >
                  <ArrowPathIcon className="w-4 h-4 text-gray-500" />
                  <span>Actualizar Saldos</span>
               </button>
            </div>

            {/* Filter Section */}
            <div className="space-y-3">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                     <FunnelIcon className="w-4 h-4 text-gray-500" /> Filtros de Búsqueda
                  </div>
                  <button
                     onClick={handleClearFilters}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-3.5 h-3.5" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-gray-50/80 p-3 rounded-lg border border-gray-200">
                  <div className="space-y-1 md:col-span-8 relative">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Buscar por RUT o Nombre</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Buscar por RUT o razón social..."
                           className={`${ctrl} pl-9`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1 md:col-span-4">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Tipo de Cuenta</label>
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
         {err && <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-xs font-medium">Error: {err}</div>}

         {/* Balances Table */}
         <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            {loading ? (
               <div className="p-8 text-center text-gray-500 font-medium text-sm flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-400" /> Calculando saldos por RUT...
               </div>
            ) : balances.length === 0 ? (
               <div className="p-10 text-center text-gray-500">
                  <ScaleIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-800">No hay movimientos registrados para calcular saldos</p>
                  <p className="text-xs text-gray-500 mt-1">Genera asientos desde SII o crea asientos manuales para ver el consolidado por RUT.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                     <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                        <tr>
                           <th className="py-2.5 px-3 w-8"></th>
                           <th className="py-2.5 px-3">RUT</th>
                           <th className="py-2.5 px-3">Razón Social / Nombre</th>
                           <th className="py-2.5 px-3">Tipo Cuenta</th>
                           <th className="py-2.5 px-3 text-right">Total Acumulado</th>
                           <th className="py-2.5 px-3 text-right">Abonos / Pagos</th>
                           <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                           <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200">
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
                                    className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                                    onClick={() => setExpandedRut(isExpanded ? null : row.rut)}
                                 >
                                    <td className="py-2.5 px-3 text-gray-400">
                                       {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{row.rut}</td>
                                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.name}</td>
                                    <td className="py-2.5 px-3">
                                       <Pill
                                          colorClass={
                                             isClient
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : 'bg-purple-50 text-purple-700 border-purple-200'
                                          }
                                       >
                                          {isClient ? <UserIcon className="w-3 h-3 text-blue-600" /> : <BuildingStorefrontIcon className="w-3 h-3 text-purple-600" />}
                                          {isClient ? 'CLIENTE' : 'PROVEEDOR'}
                                       </Pill>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-medium text-gray-800">{clp(totalDoc)}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-gray-500">{clp(paidDoc)}</td>
                                    <td
                                       className={`py-2.5 px-3 text-right font-mono font-bold ${
                                          isPaid ? 'text-gray-900' : 'text-gray-900'
                                       }`}
                                    >
                                       {clp(row.balance)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                       <Pill
                                          colorClass={
                                             isPaid
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : isPartial
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-gray-100 text-gray-700 border-gray-200'
                                          }
                                       >
                                          {row.status}
                                       </Pill>
                                    </td>
                                 </tr>
                                 {isExpanded && row.documents && row.documents.length > 0 && (
                                    <tr>
                                       <td colSpan={8} className="p-0 bg-gray-50/70">
                                          <div className="p-4 space-y-3 border-y border-gray-200">
                                             <h4 className="text-[11px] uppercase font-semibold text-gray-600 tracking-wider">
                                                Detalle de Documentos Pendientes ({row.documents.length})
                                             </h4>
                                             <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                                                <table className="min-w-full text-xs text-left">
                                                   <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase tracking-wider">
                                                      <tr>
                                                         <th className="py-2 px-3">Fecha</th>
                                                         <th className="py-2 px-3">Tipo Documento</th>
                                                         <th className="py-2 px-3">Folio</th>
                                                         <th className="py-2 px-3 text-right">Total</th>
                                                         <th className="py-2 px-3 text-right">Pagado</th>
                                                         <th className="py-2 px-3 text-right">Saldo</th>
                                                         <th className="py-2 px-3 text-center">Estado</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-gray-200">
                                                      {row.documents.map(doc => (
                                                         <tr key={doc.id} className="hover:bg-gray-50/80">
                                                            <td className="py-2 px-3 text-gray-600 font-medium">{doc.issue_date}</td>
                                                            <td className="py-2 px-3 font-medium text-gray-800">{doc.document_type}</td>
                                                            <td className="py-2 px-3 font-mono font-bold text-gray-900">N° {doc.folio}</td>
                                                            <td className="py-2 px-3 text-right font-mono text-gray-800">{clp(doc.total)}</td>
                                                            <td className="py-2 px-3 text-right font-mono text-gray-500">{clp(doc.paid)}</td>
                                                            <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">{clp(doc.balance)}</td>
                                                            <td className="py-2 px-3 text-center">
                                                               <Pill
                                                                  colorClass={
                                                                     doc.status === 'Pagado'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : doc.status === 'Parcial'
                                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        : 'bg-gray-100 text-gray-700 border-gray-200'
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

