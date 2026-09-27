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
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl = 'w-full h-9 px-3 text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--heading)] placeholder-[var(--text-soft)] focus:outline-none focus:border-[var(--brand)] transition-colors shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

export default function AccountingBalances() {
   const { entityId, ready } = useEntityRequired();

   const [balances, setBalances] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   const [search, setSearch] = useState('');
   const [typeFilter, setTypeFilter] = useState('ALL');
   const [expandedRut, setExpandedRut] = useState(null);

   const [mostrarFiltros, setMostrarFiltros] = useState(true);

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

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="animate-fade-in">
         {/* PANEL: Filtros */}
         <div
            className={[
               "relative bg-[var(--bg-content)] shadow-sm transition-all duration-300 ease-out origin-top",
               mostrarFiltros ? "z-[80] opacity-100 max-h-[1000px] py-3 px-4 space-y-3 scale-100 overflow-visible mb-4" : "z-0 opacity-0 max-h-0 p-0 pointer-events-none scale-[.98] overflow-hidden",
            ].join(" ")}
         >
            <h2 className="text-xl font-semibold text-[var(--heading)]">
               Saldos Contables por RUT
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
               <div className="flex flex-col gap-1 md:col-span-3">
                  <label className="text-[12px] text-[var(--text-soft)]">Buscar por RUT o Nombre</label>
                  <input
                     type="text"
                     placeholder="Buscar por RUT o razón social..."
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] placeholder-[var(--text-soft)] focus:outline-none focus:border-[var(--brand)]"
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
               <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[12px] text-[var(--text-soft)]">Tipo de Cuenta</label>
                  <select
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] focus:outline-none focus:border-[var(--brand)] appearance-none"
                     value={typeFilter}
                     onChange={(e) => setTypeFilter(e.target.value)}
                  >
                     <option value="ALL">Todos (Clientes y Proveedores)</option>
                     <option value="RECEIVABLE">Solo Clientes (Cuentas por Cobrar)</option>
                     <option value="PAYABLE">Solo Proveedores (Cuentas por Pagar)</option>
                  </select>
               </div>
               <div className="flex items-end gap-2">
                  <button
                     disabled={loading}
                     className={`px-4 py-2 rounded-lg ${loading ? "opacity-60 cursor-not-allowed" : "bg-[var(--brand)] text-white hover:opacity-90"}`}
                     onClick={loadBalances}
                  >
                     {loading ? "Cargando…" : "Filtrar"}
                  </button>
               </div>
            </div>
         </div>

         {/* Toolbar y Tabs */}
         <div className="bg-[var(--bg-content)] py-2 px-4 shadow-sm mb-4">
            <div className="flex items-center justify-between gap-3">
               <div className="flex flex-wrap items-center gap-2" role="tablist">
                  <button className="px-3 py-2 rounded-lg flex items-center gap-2 bg-[var(--surface-2)] text-[var(--heading)]">
                     <span>Saldos</span>
                  </button>
               </div>
               <div className="flex items-center gap-2">
                  <button
                     onClick={() => {
                        loadBalances();
                        toast.success('Saldos contables actualizados');
                     }}
                     className="flex items-center gap-2 px-3 md:px-6 py-2.5 bg-brand text-white font-medium rounded-xl shadow-lg shadow-brand/20 hover:bg-brand-strong hover:-translate-y-0.5 transition-all bg-[var(--brand)]"
                  >
                     <ArrowPathIcon className="w-4 h-4 stroke-2" />
                     <span className="hidden xl:block">Actualizar Saldos</span>
                  </button>
                  <button type="button" onClick={() => setMostrarFiltros(v => !v)} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-1)]" title="Mostrar/Ocultar filtros">
                     🔍
                  </button>
               </div>
            </div>
         </div>

         {err && <div className="p-4 bg-[var(--danger)]/10 text-[var(--danger)] rounded-lg mb-4 text-sm font-medium">Error: {err}</div>}

         {/* Balances Table */}
         <div className={`bg-[var(--bg-content)] overflow-auto shadow-sm transition-all animate-fade-in ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <table className="min-w-full text-sm">
               <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--heading)]">
                  <tr className="text-left">
                     <th className="px-3 py-2 w-8"></th>
                     <th className="px-3 py-2">RUT</th>
                     <th className="px-3 py-2">Razón Social / Nombre</th>
                     <th className="px-3 py-2">Tipo Cuenta</th>
                     <th className="px-3 py-2 text-right">Total Acumulado</th>
                     <th className="px-3 py-2 text-right">Abonos / Pagos</th>
                     <th className="px-3 py-2 text-right">Saldo Pendiente</th>
                     <th className="px-3 py-2 text-center">Estado</th>
                  </tr>
               </thead>
               <tbody>
                  {balances.length === 0 && (
                     <tr>
                        <td className="px-3 py-8 text-center text-[var(--text-soft)]" colSpan={8}>
                           Sin resultados. Ajusta filtros.
                        </td>
                     </tr>
                  )}
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
                              className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-1)] transition-colors cursor-pointer group"
                              onClick={() => setExpandedRut(isExpanded ? null : row.rut)}
                           >
                              <td className="px-3 py-2 text-[var(--text-soft)]">
                                 {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-[var(--heading)]">{row.rut}</td>
                              <td className="px-3 py-2 font-medium text-[var(--text-main)]">{row.name}</td>
                              <td className="px-3 py-2">
                                 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                    isClient
                                       ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20'
                                       : 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20'
                                 }`}>
                                    {isClient ? <UserIcon className="w-3 h-3" /> : <BuildingStorefrontIcon className="w-3 h-3" />}
                                    {isClient ? 'CLIENTE' : 'PROVEEDOR'}
                                 </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-medium text-[var(--heading)]">{clp(totalDoc)}</td>
                              <td className="px-3 py-2 text-right font-mono text-[var(--text-soft)]">{clp(paidDoc)}</td>
                              <td
                                 className={`px-3 py-2 text-right font-mono font-bold ${
                                    isPaid ? 'text-[var(--text-main)]' : 'text-[var(--heading)]'
                                 }`}
                              >
                                 {clp(row.balance)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                    isPaid
                                       ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20'
                                       : isPartial
                                       ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20'
                                       : 'bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--border-subtle)]'
                                 }`}>
                                    {row.status}
                                 </span>
                              </td>
                           </tr>
                           {isExpanded && row.documents && row.documents.length > 0 && (
                              <tr>
                                 <td colSpan={8} className="p-0 bg-[var(--surface-1)]">
                                    <div className="p-4 space-y-3 border-b border-[var(--border-subtle)]">
                                       <h4 className="text-[11px] uppercase font-semibold text-[var(--text-soft)] tracking-wider">
                                          Detalle de Documentos Pendientes ({row.documents.length})
                                       </h4>
                                       <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-content)]">
                                          <table className="min-w-full text-xs text-left">
                                             <thead className="bg-[var(--surface-2)] text-[var(--heading)] font-semibold uppercase tracking-wider">
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
                                             <tbody>
                                                {row.documents.map((doc, idx) => (
                                                   <tr key={doc.id} className={`${idx !== (row.documents.length - 1) ? 'border-b border-[var(--border-subtle)]' : ''} hover:bg-[var(--surface-1)]`}>
                                                      <td className="py-2 px-3 text-[var(--text-main)] font-medium">{doc.issue_date}</td>
                                                      <td className="py-2 px-3 font-medium text-[var(--heading)]">{doc.document_type}</td>
                                                      <td className="py-2 px-3 font-mono font-bold text-[var(--heading)]">N° {doc.folio}</td>
                                                      <td className="py-2 px-3 text-right font-mono text-[var(--heading)]">{clp(doc.total)}</td>
                                                      <td className="py-2 px-3 text-right font-mono text-[var(--text-soft)]">{clp(doc.paid)}</td>
                                                      <td className="py-2 px-3 text-right font-mono font-bold text-[var(--heading)]">{clp(doc.balance)}</td>
                                                      <td className="py-2 px-3 text-center">
                                                         <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                            doc.status === 'Pagado'
                                                               ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20'
                                                               : doc.status === 'Parcial'
                                                               ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20'
                                                               : 'bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--border-subtle)]'
                                                         }`}>
                                                            {doc.status}
                                                         </span>
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
      </div>
   );
}
