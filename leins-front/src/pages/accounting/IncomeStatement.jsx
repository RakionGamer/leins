import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import DateInput from '../../components/DateInput';
import { toast } from '../../components/Toaster';
import { getIncomeStatement, getIncomeStatementDrilldown } from '../../services/accountingApi';
import {
   ChevronDownIcon,
   ChevronRightIcon,
   ArrowPathIcon,
   ArrowDownTrayIcon,
   CheckCircleIcon,
   XMarkIcon,
   ChartBarIcon,
   CurrencyDollarIcon,
   BanknotesIcon,
   ArrowTrendingUpIcon,
   ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

const clp = (n, showSign = false) => {
   const val = Number(n || 0);
   const absFormatted = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
   }).format(Math.abs(val));

   if (val < 0) return `-${absFormatted}`;
   if (val > 0 && showSign) return `+${absFormatted}`;
   return absFormatted;
};

const toYmd = (date) => {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

export default function IncomeStatement() {
   const { entityId, ready } = useEntityRequired();

   // Filtros principales
   const [periodMode, setPeriodMode] = useState('quarter'); // 'current_month' | 'quarter' | 'semester' | 'year' | 'range'
   const [fromDate, setFromDate] = useState(() => {
      const now = new Date();
      return toYmd(new Date(now.getFullYear(), now.getMonth() - 2, 1));
   });
   const [toDate, setToDate] = useState(() => {
      const now = new Date();
      return toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
   });
   const [reportLevel, setReportLevel] = useState(1); // 1 = Nivel 1 (Agrupado), 2 = Nivel 2 (Cuentas)

   // Estado de datos
   const [statementData, setStatementData] = useState(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

   // Filas expandidas (para Nivel 1 cuando se abre individualmente)
   const [expandedGroups, setExpandedGroups] = useState({
      ingresos: true,
      costos: true,
      gastos: true,
   });

   // Estado del Modal Mayor Analítico Auxiliar (Drill-down)
   const [drillModalOpen, setDrillModalOpen] = useState(false);
   const [drillLoading, setDrillLoading] = useState(false);
   const [drillData, setDrillData] = useState(null);
   const [targetCellAmount, setTargetCellAmount] = useState(0);

   const handlePreset = (mode) => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      if (mode === 'current_month') {
         setFromDate(toYmd(new Date(y, m, 1)));
         setToDate(toYmd(new Date(y, m + 1, 0)));
      } else if (mode === 'quarter') {
         setFromDate(toYmd(new Date(y, m - 2, 1)));
         setToDate(toYmd(new Date(y, m + 1, 0)));
      } else if (mode === 'semester') {
         setFromDate(toYmd(new Date(y, m - 5, 1)));
         setToDate(toYmd(new Date(y, m + 1, 0)));
      } else if (mode === 'year') {
         setFromDate(toYmd(new Date(y, 0, 1)));
         setToDate(toYmd(new Date(y, 11, 31)));
      }
      setPeriodMode(mode);
   };

   const loadStatement = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setError(null);
      try {
         const [tYear, tMonth] = (toDate || '').split('-').map(Number);
         const res = await getIncomeStatement({
            entityId,
            periodMode,
            year: tYear || new Date().getFullYear(),
            month: tMonth || (new Date().getMonth() + 1),
            from: periodMode === 'range' ? fromDate : undefined,
            to: periodMode === 'range' ? toDate : undefined,
         });
         if (res?.ok) {
            setStatementData(res);
         } else {
            throw new Error(res?.message || 'Error al obtener Estado de Resultados');
         }
      } catch (e) {
         setError(e.message || 'Error al cargar el Estado de Resultados');
      } finally {
         setLoading(false);
      }
   }, [entityId, periodMode, fromDate, toDate]);

   useEffect(() => {
      if (ready && entityId) {
         loadStatement();
      }
   }, [ready, entityId, loadStatement]);

   // Bloquear scroll de fondo y cerrar con ESC cuando el modal esté abierto
   useEffect(() => {
      if (!drillModalOpen) return;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
         if (e.key === 'Escape') setDrillModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
         document.body.style.overflow = prevOverflow;
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, [drillModalOpen]);

   const toggleGroup = (groupKey) => {
      setExpandedGroups((prev) => ({
         ...prev,
         [groupKey]: !prev[groupKey],
      }));
   };

   // Abrir Mayor Analítico Auxiliar
   const handleOpenDrilldown = async ({ accountCode, groupKey, monthKey, accountName, cellAmount }) => {
      if (!entityId || (!monthKey && periodMode !== 'range')) return;
      setDrillModalOpen(true);
      setDrillLoading(true);
      setTargetCellAmount(cellAmount);
      setDrillData(null);

      try {
         const res = await getIncomeStatementDrilldown({
            entityId,
            accountCode,
            groupKey,
            periodMonth: monthKey,
            from: (!monthKey && periodMode === 'range') ? fromDate : undefined,
            to: (!monthKey && periodMode === 'range') ? toDate : undefined,
         });
         if (res?.ok) {
            setDrillData({
               ...res,
               accountName: accountName || res.accountName,
            });
         } else {
            throw new Error(res?.message || 'No se pudo obtener el detalle analítico');
         }
      } catch (err) {
         toast.error(err.message || 'Error al cargar mayor analítico');
         setDrillModalOpen(false);
      } finally {
         setDrillLoading(false);
      }
   };

   // Exportar a CSV
   const handleExportCSV = () => {
      if (!statementData?.period?.months || !statementData?.structure) return;

      const months = statementData.period.months;
      const headers = ['Estructura P&L / Cuenta Contable', ...months.map((m) => m.label), 'Total Acumulado'];
      const rows = [headers];

      statementData.structure.forEach((group) => {
         // Fila de grupo
         const groupRow = [
            group.label,
            ...months.map((m) => group.monthlyTotals[m.key] || 0),
            group.accumulated || 0,
         ];
         rows.push(groupRow);

         // Cuentas si están disponibles
         if (Array.isArray(group.accounts) && group.accounts.length > 0) {
            group.accounts.forEach((acc) => {
               rows.push([
                  `  ${acc.code} - ${acc.name}`,
                  ...months.map((m) => acc.monthlyAmounts[m.key] || 0),
                  acc.total || 0,
               ]);
            });
         }
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.map(cell => `"${cell}"`).join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Estado_de_Resultados_${fromDate}_${toDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Archivo CSV descargado exitosamente');
   };

   if (!ready) return <EntityRequiredNotice />;

   const months = statementData?.period?.months || [];
   const kpis = statementData?.kpis || {};
   const structure = statementData?.structure || [];

   return (
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Estado de Resultados (Comparativo Mensual)</h2>
                  <p className="text-sm text-text-soft mt-1">
                     Visualización de periodos mensualizados con reporte por Nivel 1 (Agrupado) y Nivel 2 (Cuentas) respaldado en operaciones del SII.
                  </p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={() => {
                        loadStatement();
                        toast.success('Estado de Resultados actualizado');
                     }}
                     disabled={loading}
                     className="h-10 flex items-center justify-center gap-2 px-4 rounded-xl border border-border-subtle bg-bg-content text-text-main text-xs font-semibold transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                     <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                     <span>Actualizar</span>
                  </button>
                  <button
                     onClick={handleExportCSV}
                     disabled={loading || !statementData}
                     className="h-10 flex items-center justify-center gap-2 px-4 rounded-xl border border-border-subtle bg-bg-content text-text-main text-xs font-semibold transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer disabled:opacity-50"
                  >
                     <ArrowDownTrayIcon className="w-4 h-4" />
                     <span>Exportar Excel</span>
                  </button>
               </div>
            </div>

            {/* Selector de Periodo y Reportabilidad */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
               {/* Period Pills & Date Range Inputs */}
               <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex rounded-xl bg-surface-2 p-1 border border-border-subtle text-xs font-medium">
                     <button
                        type="button"
                        onClick={() => handlePreset('current_month')}
                        className={`px-3 py-1.5 rounded-lg transition ${
                           periodMode === 'current_month'
                              ? 'bg-bg-content text-heading font-semibold shadow-sm'
                              : 'text-text-soft hover:text-heading'
                        }`}
                     >
                        Solo Mes en Curso
                     </button>
                     <button
                        type="button"
                        onClick={() => handlePreset('quarter')}
                        className={`px-3 py-1.5 rounded-lg transition ${
                           periodMode === 'quarter'
                              ? 'bg-bg-content text-heading font-semibold shadow-sm'
                              : 'text-text-soft hover:text-heading'
                        }`}
                     >
                        El Trimestre (3 Meses)
                     </button>
                     <button
                        type="button"
                        onClick={() => handlePreset('semester')}
                        className={`px-3 py-1.5 rounded-lg transition ${
                           periodMode === 'semester'
                              ? 'bg-bg-content text-heading font-semibold shadow-sm'
                              : 'text-text-soft hover:text-heading'
                        }`}
                     >
                        El Semestre (6 Meses)
                     </button>
                     <button
                        type="button"
                        onClick={() => handlePreset('year')}
                        className={`px-3 py-1.5 rounded-lg transition ${
                           periodMode === 'year'
                              ? 'bg-bg-content text-heading font-semibold shadow-sm'
                              : 'text-text-soft hover:text-heading'
                        }`}
                     >
                        Todo el Año (12 Meses)
                     </button>
                  </div>

                  {/* Rango de fechas colocado al lado del contenedor de opciones */}
                  <div className="flex items-center gap-1.5">
                     <div className="w-32">
                        <DateInput
                           disabled={loading}
                           className="w-full h-9 flex items-center px-3 text-xs rounded-xl border border-border-subtle bg-bg-content text-text-main shadow-sm hover:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand font-medium transition cursor-pointer"
                           value={fromDate}
                           onChange={(val) => {
                              setFromDate(val);
                              setPeriodMode('range');
                           }}
                           placeholder="Desde"
                        />
                     </div>
                     <span className="text-text-soft font-semibold text-xs">—</span>
                     <div className="w-32">
                        <DateInput
                           disabled={loading}
                           className="w-full h-9 flex items-center px-3 text-xs rounded-xl border border-border-subtle bg-bg-content text-text-main shadow-sm hover:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand font-medium transition cursor-pointer"
                           value={toDate}
                           onChange={(val) => {
                              setToDate(val);
                              setPeriodMode('range');
                           }}
                           min={fromDate || undefined}
                           placeholder="Hasta"
                        />
                     </div>
                  </div>
               </div>

               {/* Reportabilidad Pills */}
               <div className="flex items-center gap-3">
                  <span className="text-xs text-text-soft font-medium">Reportabilidad:</span>
                  <div className="inline-flex rounded-xl bg-surface-2 p-1 border border-border-subtle text-xs font-medium">
                     <button
                        type="button"
                        onClick={() => setReportLevel(1)}
                        className={`px-3 py-1.5 rounded-lg transition ${
                           reportLevel === 1
                              ? 'bg-brand text-white font-semibold shadow-sm'
                              : 'text-text-soft hover:text-heading'
                        }`}
                     >
                        Nivel 1 (Agrupado)
                     </button>
                     <button
                        type="button"
                        onClick={() => setReportLevel(2)}
                        className={`px-3 py-1.5 rounded-lg transition ${
                           reportLevel === 2
                              ? 'bg-brand text-white font-semibold shadow-sm'
                              : 'text-text-soft hover:text-heading'
                        }`}
                     >
                        Nivel 2 (Cuentas)
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* KPI Summary Cards */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <ArrowTrendingUpIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Ingresos Operacionales</div>
                  <div className="text-lg md:text-xl font-bold text-heading">{clp(kpis.totalIngresos)}</div>
               </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
               <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                  <ArrowTrendingDownIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Costo Directo Ventas</div>
                  <div className="text-lg md:text-xl font-bold text-heading">{clp(kpis.totalCostos)}</div>
               </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-emerald-500/20">
               <div className="p-3 bg-emerald-600 text-white rounded-xl">
                  <BanknotesIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                     Margen Bruto ({kpis.margenBrutoPct ?? 0}%)
                  </div>
                  <div className="text-lg md:text-xl font-bold text-emerald-700 dark:text-emerald-300">
                     {clp(kpis.margenBruto)}
                  </div>
               </div>
            </div>

            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
               <div className="p-3 bg-brand text-white rounded-xl">
                  <CurrencyDollarIcon className="w-6 h-6" />
               </div>
               <div>
                  <div className="text-xs font-semibold text-brand uppercase tracking-wide">
                     EBITDA ({kpis.ebitdaPct ?? 0}%)
                  </div>
                  <div className="text-lg md:text-xl font-bold text-brand">
                     {clp(kpis.ebitda)}
                  </div>
               </div>
            </div>
         </div>

         {/* Main Statement Table */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-16 flex flex-col items-center justify-center gap-3">
                  <ArrowPathIcon className="w-8 h-8 animate-spin text-brand" />
                  <span className="text-sm text-text-soft font-medium">Cargando Estado de Resultados...</span>
               </div>
            ) : error ? (
               <div className="p-12 text-center text-danger">
                  <p className="font-semibold">{error}</p>
                  <button
                     onClick={loadStatement}
                     className="mt-4 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold"
                  >
                     Reintentar
                  </button>
               </div>
            ) : structure.length === 0 ? (
               <div className="p-16 text-center text-text-soft">
                  <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-heading">No hay movimientos registrados en el periodo seleccionado</p>
                  <p className="text-xs mt-1">Los datos se alimentan automáticamente de las compras, ventas y honorarios extraídos del SII.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                     <thead>
                        <tr className="border-b border-border-subtle bg-surface-1 text-text-soft uppercase tracking-wider font-semibold">
                           <th className="py-3.5 px-4 min-w-[280px]">Estructura P&L / Cuenta Contable</th>
                           {months.map((m) => (
                              <th key={m.key} className="py-3.5 px-3 text-right min-w-[120px]">
                                 {m.label}
                              </th>
                           ))}
                           <th className="py-3.5 px-4 text-right min-w-[140px] bg-slate-900 text-white font-bold tracking-normal text-[13px]">
                              Total Acumulado
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle font-medium">
                        {structure.map((item) => {
                           // 1. Subtotal: Margen Bruto Operacional
                           if (item.isSubtotal) {
                              return (
                                 <tr
                                    key={item.key}
                                    className="bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-y border-emerald-200 dark:border-emerald-800/40"
                                 >
                                    <td className="py-3 px-4 font-bold text-heading">
                                       {item.label}
                                    </td>
                                    {months.map((m) => (
                                       <td key={m.key} className="py-3 px-3 text-right font-bold transition">
                                          {clp(item.monthlyTotals[m.key])}
                                       </td>
                                    ))}
                                    <td className="py-3 px-4 text-right font-bold text-heading bg-surface-1/80">
                                       {clp(item.accumulated)}
                                    </td>
                                 </tr>
                              );
                           }

                           if (item.isTotal) {
                              return (
                                 <tr
                                    key={item.key}
                                    className="bg-surface-2 font-bold text-heading border-t-2 border-border-subtle"
                                 >
                                    <td className="py-4 px-4 text-[13px] tracking-wide text-brand">
                                       {item.label}
                                    </td>
                                    {months.map((m) => (
                                       <td key={m.key} className="py-4 px-3 text-right font-bold text-[13px]">
                                          {clp(item.monthlyTotals[m.key])}
                                       </td>
                                    ))}
                                    <td className="py-4 px-4 text-right font-extrabold text-[15px] bg-slate-900 text-white">
                                       {clp(item.accumulated)}
                                    </td>
                                 </tr>
                              );
                           }

                           // 3. Grupos principales (Ingresos, Costos, Gastos)
                           const isExpanded = reportLevel === 2 && Boolean(expandedGroups[item.key]);
                           const isNegativeCost = item.key === 'costos' || item.key === 'gastos';

                           return (
                              <React.Fragment key={item.key}>
                                 <tr className="bg-bg-content hover:bg-surface-1/60 transition-colors">
                                    <td className="py-3 px-4 font-bold text-heading">
                                       <div className="flex items-center gap-2">
                                          {reportLevel === 2 && (
                                             <button
                                                type="button"
                                                onClick={() => toggleGroup(item.key)}
                                                className="p-1 rounded hover:bg-surface-2 text-text-soft transition cursor-pointer"
                                                title={isExpanded ? 'Colapsar cuentas' : 'Expandir cuentas'}
                                             >
                                                {isExpanded ? (
                                                   <ChevronDownIcon className="w-4 h-4 text-brand" />
                                                ) : (
                                                   <ChevronRightIcon className="w-4 h-4" />
                                                )}
                                             </button>
                                          )}
                                          <span>{item.label}</span>
                                       </div>
                                    </td>
                                    {months.map((m) => {
                                       const val = item.monthlyTotals[m.key] || 0;
                                       const displayVal = isNegativeCost && val > 0 ? -val : val;
                                       return (
                                          <td
                                             key={m.key}
                                             className={`py-3 px-3 text-right font-bold transition ${
                                                isNegativeCost ? 'text-text-main' : 'text-emerald-600 dark:text-emerald-400'
                                             }`}
                                          >
                                             {clp(displayVal)}
                                          </td>
                                       );
                                    })}
                                    <td className="py-3 px-4 text-right font-bold text-heading bg-surface-1/80">
                                       {clp(isNegativeCost && item.accumulated > 0 ? -item.accumulated : item.accumulated)}
                                    </td>
                                 </tr>

                                 {/* Cuentas contables hijas (Solo visible en Nivel 2) */}
                                 {reportLevel === 2 && isExpanded &&
                                    item.accounts?.map((acc) => (
                                       <tr
                                          key={`${item.key}-${acc.code}`}
                                          className="text-text-soft hover:bg-surface-1/40 hover:text-heading transition-colors text-[11.5px]"
                                       >
                                          <td className="py-2 px-4 pl-10 font-normal">
                                             <div className="flex items-center gap-2">
                                                <span className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle">
                                                   {acc.code}
                                                </span>
                                                <span className="truncate">{acc.name}</span>
                                             </div>
                                          </td>
                                          {months.map((m) => {
                                             const accVal = acc.monthlyAmounts[m.key] || 0;
                                             const displayAccVal = isNegativeCost && accVal > 0 ? -accVal : accVal;
                                             return (
                                                <td
                                                   key={m.key}
                                                   onClick={() =>
                                                      accVal !== 0 &&
                                                      handleOpenDrilldown({
                                                         accountCode: acc.code,
                                                         groupKey: item.key,
                                                         monthKey: m.key,
                                                         accountName: `${acc.code} ${acc.name}`,
                                                         cellAmount: displayAccVal,
                                                      })
                                                   }
                                                   className={`py-2 px-3 text-right font-mono transition ${
                                                      accVal !== 0
                                                         ? 'cursor-pointer hover:underline hover:text-brand hover:font-bold'
                                                         : 'opacity-40'
                                                   }`}
                                                   title={accVal !== 0 ? 'Clic para ver Mayor Analítico Auxiliar' : ''}
                                                >
                                                   {clp(displayAccVal)}
                                                </td>
                                             );
                                          })}
                                          <td className="py-2 px-4 text-right font-mono font-semibold bg-surface-1/30">
                                             {clp(isNegativeCost && acc.total > 0 ? -acc.total : acc.total)}
                                          </td>
                                       </tr>
                                    ))}
                              </React.Fragment>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </div>

         {/* ======================================================== */}
         {/* Modal Mayor Analítico Auxiliar (Drill-down exacto al ejemplo) */}
         {/* ======================================================== */}
         {drillModalOpen &&
            createPortal(
               <div
                  onClick={(e) => {
                     if (e.target === e.currentTarget) setDrillModalOpen(false);
                  }}
                  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
               >
                  <div className="w-full max-w-4xl bg-bg-content rounded-2xl shadow-2xl border border-border-subtle overflow-hidden flex flex-col max-h-[90vh]">
                     {/* Dark Header matching screenshot */}
                     <div className="bg-[#0f172a] text-white p-5 flex items-start justify-between shrink-0">
                        <div>
                           <h3 className="text-base md:text-lg font-bold tracking-tight">
                              Mayor Analítico Auxiliar: {drillData?.accountName || 'Detalle de Imputaciones'} {drillData?.monthLabel || ''}
                           </h3>
                           <p className="text-xs text-slate-400 mt-0.5">
                              Detalle de movimientos e imputaciones respaldadas en operaciones del SII
                           </p>
                        </div>
                        <button
                           type="button"
                           onClick={() => setDrillModalOpen(false)}
                           className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
                        >
                           <XMarkIcon className="w-5 h-5" />
                        </button>
                     </div>

                     {/* Body Content */}
                     <div className="p-5 overflow-y-auto space-y-4">
                        {/* Monto Total Box */}
                        <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 flex items-center justify-between">
                           <span className="text-xs md:text-sm text-text-soft font-medium">
                              Monto total conciliado a esta celda:
                           </span>
                           <span className="text-lg md:text-xl font-extrabold text-heading">
                              {clp(targetCellAmount)}
                           </span>
                        </div>

                        {drillLoading ? (
                           <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <ArrowPathIcon className="w-7 h-7 animate-spin text-brand" />
                              <span className="text-xs text-text-soft font-medium">Cargando comprobantes...</span>
                           </div>
                        ) : !drillData?.documents?.length ? (
                           <div className="py-10 text-center text-text-soft text-xs">
                              No se encontraron documentos individuales asociados a esta celda en este periodo.
                           </div>
                        ) : (
                           <div className="border border-border-subtle rounded-xl overflow-hidden shadow-xs">
                              <table className="w-full text-left text-xs">
                                 <thead>
                                    <tr className="bg-surface-2 text-text-soft font-semibold border-b border-border-subtle">
                                       <th className="py-2.5 px-3">Fecha</th>
                                       <th className="py-2.5 px-3">Folio / TRX</th>
                                       <th className="py-2.5 px-3">RUT / Entidad</th>
                                       <th className="py-2.5 px-3">Razón Social / Detalle</th>
                                       <th className="py-2.5 px-3 text-right">Monto Neto</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border-subtle font-medium">
                                    {drillData.documents.map((doc) => (
                                       <tr key={doc.id} className="hover:bg-surface-1 transition-colors">
                                          <td className="py-2.5 px-3 text-text-soft whitespace-nowrap">{doc.date}</td>
                                          <td className="py-2.5 px-3 font-mono font-semibold text-brand whitespace-nowrap">
                                             {doc.folio_display}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-text-main whitespace-nowrap">{doc.counterparty_rut}</td>
                                          <td className="py-2.5 px-3 text-heading truncate max-w-[260px]">{doc.counterparty_name}</td>
                                          <td className="py-2.5 px-3 text-right font-extrabold text-heading whitespace-nowrap font-mono">
                                             {clp(doc.amount_net)}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>

                     {/* Footer matching screenshot */}
                     <div className="p-4 border-t border-border-subtle bg-surface-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                           <CheckCircleIcon className="w-5 h-5 shrink-0" />
                           <span>Suma de registros cuadra 1:1 con el monto seleccionado ({drillData?.documents?.length || 0} comprobantes)</span>
                        </div>
                        <button
                           type="button"
                           onClick={() => setDrillModalOpen(false)}
                           className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition self-end sm:self-auto cursor-pointer"
                        >
                           Cerrar Auxiliar
                        </button>
                     </div>
                  </div>
               </div>,
               document.body
            )}
      </div>
   );
}
