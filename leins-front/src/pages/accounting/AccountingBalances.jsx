import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
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
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl =
   'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

export default function AccountingBalances() {
   const { entityId, ready } = useEntityRequired();

   const [balances, setBalances] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   const [search, setSearch] = useState('');
   const [typeFilter, setTypeFilter] = useState('ALL');

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

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Encabezado */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand/10 text-brand rounded-2xl">
                     <ScaleIcon className="w-7 h-7" />
                  </div>
                  <div>
                     <h2 className="text-2xl font-bold text-heading tracking-tight">Saldos Contables por RUT</h2>
                     <p className="text-sm text-text-soft mt-0.5">
                        Consolidado de Cuentas por Cobrar (Clientes) y Cuentas por Pagar (Proveedores) según asientos contables.
                     </p>
                  </div>
               </div>

               <button
                  onClick={loadBalances}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand bg-brand/10 hover:bg-brand hover:text-white rounded-2xl transition"
               >
                  <ArrowPathIcon className="w-4 h-4" /> Actualizar Saldos
               </button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
               <div className="md:col-span-8 relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3.5 top-3 text-text-soft" />
                  <input
                     type="text"
                     placeholder="Buscar por RUT o razón social..."
                     className={`${ctrl} pl-10`}
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
               <div className="md:col-span-4">
                  <select className={selectCtrl} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                     <option value="ALL">Todos (Clientes y Proveedores)</option>
                     <option value="RECEIVABLE">Solo Clientes (Cuentas por Cobrar)</option>
                     <option value="PAYABLE">Solo Proveedores (Cuentas por Pagar)</option>
                  </select>
               </div>
            </div>
         </div>

         {/* Tarjetas resumen */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border-subtle bg-bg-content p-4 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <CurrencyDollarIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Saldos por Cobrar</div>
                  <div className="text-xl font-bold text-emerald-600">{clp(summaryStats.totalReceivable)}</div>
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-content p-4 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                  <ClockIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Clientes Pendientes</div>
                  <div className="text-xl font-bold text-heading">{summaryStats.countReceivable} RUTs</div>
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-content p-4 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
                  <BanknotesIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Saldos por Pagar</div>
                  <div className="text-xl font-bold text-rose-600">{clp(summaryStats.totalPayable)}</div>
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-content p-4 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
                  <BuildingStorefrontIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Proveedores Pendientes</div>
                  <div className="text-xl font-bold text-heading">{summaryStats.countPayable} RUTs</div>
               </div>
            </div>
         </div>

         {/* Alertas */}
         {err && <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 text-sm font-medium">{err}</div>}

         {/* Tabla de Saldos por RUT */}
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
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft text-xs uppercase font-semibold">
                        <tr>
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

                           return (
                              <tr key={row.rut} className="hover:bg-brand/5 transition">
                                 <td className="p-4 font-mono font-bold text-brand">{row.rut}</td>
                                 <td className="p-4 font-medium text-heading">{row.name}</td>
                                 <td className="p-4">
                                    <span
                                       className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center w-fit gap-1 ${
                                          isClient
                                             ? 'bg-blue-100 text-blue-700'
                                             : 'bg-purple-100 text-purple-700'
                                       }`}
                                    >
                                       {isClient ? <UserIcon className="w-3.5 h-3.5" /> : <BuildingStorefrontIcon className="w-3.5 h-3.5" />}
                                       {isClient ? 'CLIENTE' : 'PROVEEDOR'}
                                    </span>
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
                                    <span
                                       className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                          isPaid
                                             ? 'bg-emerald-100 text-emerald-700'
                                             : isPartial
                                             ? 'bg-amber-100 text-amber-700'
                                             : 'bg-rose-100 text-rose-700'
                                       }`}
                                    >
                                       {row.status}
                                    </span>
                                 </td>
                              </tr>
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
