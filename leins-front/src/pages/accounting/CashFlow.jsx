import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import DateInput from '../../components/DateInput';
import { toast } from '../../components/Toaster';
import { getCashFlow, getCashFlowDrilldown } from '../../services/accountingApi';
import {
   ChevronDownIcon,
   ChevronRightIcon,
   ArrowPathIcon,
   ArrowDownTrayIcon,
   CheckCircleIcon,
   XMarkIcon,
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

export default function CashFlow() {
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
   const [cashFlowData, setCashFlowData] = useState(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

   // Grupos expandidos
   const [expandedGroups, setExpandedGroups] = useState({
      operacion: true,
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

   const loadCashFlow = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setError(null);
      try {
         const [tYear, tMonth] = (toDate || '').split('-').map(Number);
         const res = await getCashFlow({
            entityId,
            periodMode,
            year: tYear || new Date().getFullYear(),
            month: tMonth || (new Date().getMonth() + 1),
            from: periodMode === 'range' ? fromDate : undefined,
            to: periodMode === 'range' ? toDate : undefined,
         });
         if (res?.ok) {
            setCashFlowData(res);
         } else {
            throw new Error(res?.message || 'Error al obtener Flujo de Caja');
         }
      } catch (e) {
         setError(e.message || 'Error al cargar el Flujo de Caja');
      } finally {
         setLoading(false);
      }
   }, [entityId, periodMode, fromDate, toDate]);

   useEffect(() => {
      if (ready && entityId) {
         loadCashFlow();
      }
   }, [ready, entityId, loadCashFlow]);

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
   const handleOpenDrilldown = async ({ conceptKey, accountCode, monthKey, conceptName, cellAmount }) => {
      if (!entityId || (!monthKey && periodMode !== 'range')) return;
      setDrillModalOpen(true);
      setDrillLoading(true);
      setTargetCellAmount(cellAmount);
      setDrillData(null);

      try {
         const res = await getCashFlowDrilldown({
            entityId,
            conceptKey,
            accountCode,
            periodMonth: monthKey || undefined,
            from: !monthKey ? fromDate : undefined,
            to: !monthKey ? toDate : undefined,
         });
         if (res?.ok) {
            setDrillData({
               ...res,
               conceptName: conceptName || res.conceptName,
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
      if (!cashFlowData?.period?.months || !cashFlowData?.structure) return;

      const months = cashFlowData.period.months;
      const headers = ['Concepto Flujo de Efectivo', ...months.map((m) => m.label), 'Total Flujo Neto'];
      const rows = [headers];

      cashFlowData.structure.forEach((group) => {
         rows.push([
            group.label,
            ...months.map((m) => group.monthlyAmounts[m.key] || 0),
            group.total || 0,
         ]);

         if (Array.isArray(group.items)) {
            group.items.forEach((item) => {
               const sign = item.isOutflow ? -1 : 1;
               rows.push([
                  `  ${item.name}`,
                  ...months.map((m) => (item.monthlyAmounts[m.key] || 0) * sign),
                  (item.total || 0) * sign,
               ]);

               if (reportLevel === 2 && Array.isArray(item.accounts)) {
                  item.accounts.forEach((acc) => {
                     rows.push([
                        `    ${acc.code} - ${acc.name}`,
                        ...months.map((m) => (acc.monthlyAmounts[m.key] || 0) * sign),
                        (acc.total || 0) * sign,
                     ]);
                  });
               }
            });
         }
      });

      if (cashFlowData.endingBankBalanceRow) {
         const ending = cashFlowData.endingBankBalanceRow;
         rows.push([
            ending.label,
            ...months.map((m) => ending.monthlyAmounts[m.key] || 0),
            ending.total || 0,
         ]);
      }

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.map(cell => `"${cell}"`).join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Flujo_de_Caja_${fromDate}_${toDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Archivo CSV descargado exitosamente');
   };

   if (!ready) return <EntityRequiredNotice />;

   const months = cashFlowData?.period?.months || [];
   const kpis = cashFlowData?.kpis || {};
   const structure = cashFlowData?.structure || [];
   const endingBankBalanceRow = cashFlowData?.endingBankBalanceRow;

   return (
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
               <div>
                  <h1 className="text-xl md:text-2xl font-black text-heading tracking-tight flex items-center gap-2.5">
                     <BanknotesIcon className="w-7 h-7 text-brand" />
                     <span>Flujo de Caja (Efectivo Directo & Proyectado)</span>
                  </h1>
                  <p className="text-xs md:text-sm text-text-soft mt-1">
                     Comparativo mensualizado de tesorería con drilldown de cartola bancaria
                  </p>
               </div>

               {/* Botones de acción */}
               <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                     onClick={loadCashFlow}
                     disabled={loading}
                     className="h-10 flex items-center justify-center gap-2 px-4 rounded-xl border border-border-subtle bg-bg-content text-text-main text-xs font-semibold transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                     <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                     <span>Actualizar</span>
                  </button>
                  <button
                     onClick={handleExportCSV}
                     disabled={loading || !cashFlowData}
                     className="h-10 flex items-center justify-center gap-2 px-4 rounded-xl border border-border-subtle bg-bg-content text-text-main text-xs font-semibold transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer disabled:opacity-50"
                  >
                     <ArrowDownTrayIcon className="w-4 h-4" />
                     <span>Exportar Excel</span>
                  </button>
               </div>
            </div>

            {/* Selector de Periodo y Reportabilidad */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4">
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

         {/* KPI Cards Row */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-bg-content rounded-2xl p-4 border border-border-subtle shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-soft">Cobros en Efectivo (Ventas)</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                     <ArrowTrendingUpIcon className="w-4 h-4" />
                  </div>
               </div>
               <div className="mt-2 text-xl font-black text-heading tracking-tight font-mono">
                  {clp(kpis.totalIncomes)}
               </div>
               <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span>Ingresos percibidos en cartola</span>
               </div>
            </div>

            <div className="bg-bg-content rounded-2xl p-4 border border-border-subtle shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-soft">Pagos en Efectivo (Compras/Gastos)</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                     <ArrowTrendingDownIcon className="w-4 h-4" />
                  </div>
               </div>
               <div className="mt-2 text-xl font-black text-heading tracking-tight font-mono">
                  {clp(kpis.totalExpenses)}
               </div>
               <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                  <span>Egresos pagados en cartola</span>
               </div>
            </div>

            <div className="bg-bg-content rounded-2xl p-4 border border-border-subtle shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-soft">Flujo Neto Operacional</span>
                  <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                     <BanknotesIcon className="w-4 h-4" />
                  </div>
               </div>
               <div className={`mt-2 text-xl font-black tracking-tight font-mono ${
                  (kpis.netOperatingFlow || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
               }`}>
                  {clp(kpis.netOperatingFlow, true)}
               </div>
               <div className="mt-1 text-[11px] text-text-soft font-medium">
                  Cobros menos pagos del período
               </div>
            </div>

            <div className="bg-bg-content rounded-2xl p-4 border border-border-subtle shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-soft">Saldo Disponible en Bancos</span>
                  <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                     <CurrencyDollarIcon className="w-4 h-4" />
                  </div>
               </div>
               <div className="mt-2 text-xl font-black text-heading tracking-tight font-mono">
                  {clp(kpis.currentBankBalance)}
               </div>
               <div className="mt-1 text-[11px] text-text-soft font-medium">
                  Liquidez total en cuentas bancarias
               </div>
            </div>
         </div>

         {/* Contenedor Principal de la Tabla */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading && (
               <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <ArrowPathIcon className="w-8 h-8 animate-spin text-brand" />
                  <span className="text-xs font-semibold text-text-soft">Calculando Flujo de Caja desde Cartola Bancaria...</span>
               </div>
            )}

            {error && (
               <div className="p-8 text-center">
                  <p className="text-sm font-semibold text-danger">{error}</p>
                  <button
                     onClick={loadCashFlow}
                     className="mt-3 px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand/90 transition cursor-pointer"
                  >
                     Reintentar
                  </button>
               </div>
            )}

            {!loading && !error && (
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                     <thead>
                        <tr className="border-b border-border-subtle bg-surface-1/50 text-text-soft font-bold">
                           <th className="py-3 px-4 min-w-[280px]">Concepto Flujo de Efectivo</th>
                           {months.map((m) => (
                              <th key={m.key} className="py-3 px-3 text-right font-mono min-w-[110px]">
                                 {m.label}
                              </th>
                           ))}
                           <th className="py-3 px-4 text-right font-mono min-w-[130px] bg-surface-2/60 text-heading">
                              Total Flujo Neto
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle">
                        {structure.map((group) => {
                           const isExpanded = expandedGroups[group.key] ?? true;

                           return (
                              <React.Fragment key={group.key}>
                                 {/* Fila de Encabezado de Grupo (ACTIVIDADES DE OPERACIÓN) */}
                                 <tr
                                    onClick={() => toggleGroup(group.key)}
                                    className="cursor-pointer transition-colors bg-surface-1/30 hover:bg-surface-2/50 font-bold"
                                 >
                                    <td className="py-3 px-4 flex items-center gap-2 text-heading select-none">
                                       {isExpanded ? (
                                          <ChevronDownIcon className="w-4 h-4 text-text-soft shrink-0" />
                                       ) : (
                                          <ChevronRightIcon className="w-4 h-4 text-text-soft shrink-0" />
                                       )}
                                       <span className="tracking-wide uppercase text-xs">
                                          {group.label}
                                       </span>
                                    </td>
                                    {months.map((m) => {
                                       const val = group.monthlyAmounts[m.key] || 0;
                                       return (
                                          <td
                                             key={m.key}
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                if (val !== 0) {
                                                   handleOpenDrilldown({
                                                      conceptKey: group.key,
                                                      monthKey: m.key,
                                                      conceptName: group.label,
                                                      cellAmount: val,
                                                   });
                                                }
                                             }}
                                             className={`py-3 px-3 text-right font-mono transition ${
                                                val !== 0 ? 'cursor-pointer hover:underline hover:text-brand' : ''
                                             } ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                                             title={val !== 0 ? 'Clic para ver Mayor Analítico Auxiliar' : ''}
                                          >
                                             {clp(val)}
                                          </td>
                                       );
                                    })}
                                    <td className={`py-3 px-4 text-right font-mono font-extrabold bg-surface-2/40 ${
                                       group.total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                       {clp(group.total)}
                                    </td>
                                 </tr>

                                 {/* Filas de Conceptos (Nivel 1) */}
                                 {isExpanded &&
                                    group.items?.map((item) => {
                                       const isOutflow = item.isOutflow;

                                       return (
                                          <React.Fragment key={item.key}>
                                             <tr className="hover:bg-surface-1/40 transition-colors">
                                                <td className="py-2.5 px-4 pl-9 text-text-main font-medium">
                                                   <div className="flex items-center gap-2">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-text-soft/40"></span>
                                                      <span>{item.name}</span>
                                                   </div>
                                                </td>
                                                {months.map((m) => {
                                                   const rawVal = item.monthlyAmounts[m.key] || 0;
                                                   const displayVal = isOutflow && rawVal > 0 ? -rawVal : rawVal;

                                                   return (
                                                      <td
                                                         key={m.key}
                                                         onClick={() =>
                                                            rawVal !== 0 &&
                                                            handleOpenDrilldown({
                                                               conceptKey: item.key,
                                                               accountCode: item.code,
                                                               monthKey: m.key,
                                                               conceptName: `${item.name} (${m.label})`,
                                                               cellAmount: displayVal,
                                                            })
                                                         }
                                                         className={`py-2.5 px-3 text-right font-mono transition ${
                                                            rawVal !== 0
                                                               ? 'cursor-pointer hover:underline hover:text-brand hover:font-bold'
                                                               : 'opacity-40'
                                                         }`}
                                                         title={rawVal !== 0 ? 'Clic para ver Mayor Analítico Auxiliar' : ''}
                                                      >
                                                         {clp(displayVal)}
                                                      </td>
                                                   );
                                                })}
                                                <td className="py-2.5 px-4 text-right font-mono font-bold bg-surface-1/30">
                                                   {clp(isOutflow && item.total > 0 ? -item.total : item.total)}
                                                </td>
                                             </tr>

                                             {/* Cuentas contables detalladas (Nivel 2) */}
                                             {reportLevel === 2 &&
                                                item.accounts?.map((acc) => (
                                                   <tr
                                                      key={acc.code}
                                                      className="bg-surface-1/20 hover:bg-surface-2/40 text-[11px] text-text-soft transition-colors"
                                                   >
                                                      <td className="py-2 px-4 pl-14 font-mono truncate max-w-[280px]">
                                                         <span className="text-text-soft/70 mr-1.5">{acc.code}</span>
                                                         <span>{acc.name}</span>
                                                      </td>
                                                      {months.map((m) => {
                                                         const accVal = acc.monthlyAmounts[m.key] || 0;
                                                         const displayAccVal = isOutflow && accVal > 0 ? -accVal : accVal;

                                                         return (
                                                            <td
                                                               key={m.key}
                                                               onClick={() =>
                                                                  accVal !== 0 &&
                                                                  handleOpenDrilldown({
                                                                     conceptKey: item.key,
                                                                     accountCode: acc.code,
                                                                     monthKey: m.key,
                                                                     conceptName: `${acc.code} ${acc.name} (${m.label})`,
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
                                                         {clp(isOutflow && acc.total > 0 ? -acc.total : acc.total)}
                                                      </td>
                                                   </tr>
                                                ))}
                                          </React.Fragment>
                                       );
                                    })}
                              </React.Fragment>
                           );
                        })}

                        {/* Fila Destacada: SALDO FINAL EN BANCOS (DISPONIBLE) */}
                        {endingBankBalanceRow && (
                           <tr className="bg-[#0f172a] text-white font-bold text-xs shadow-md">
                              <td className="py-3.5 px-4 font-bold tracking-tight uppercase">
                                 {endingBankBalanceRow.label}
                              </td>
                              {months.map((m) => {
                                 const balanceVal = endingBankBalanceRow.monthlyAmounts[m.key] || 0;
                                 return (
                                    <td
                                       key={m.key}
                                       className="py-3.5 px-3 text-right font-mono text-emerald-400 font-bold"
                                    >
                                       {clp(balanceVal)}
                                    </td>
                                 );
                              })}
                              <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-400 bg-slate-900 border-l border-slate-800">
                                 {clp(endingBankBalanceRow.total)}
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            )}
         </div>

         {/* ======================================================== */}
         {/* Modal Mayor Analítico Auxiliar (Drill-down de Cartola)   */}
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
                     {/* Dark Header */}
                     <div className="bg-[#0f172a] text-white p-5 flex items-start justify-between shrink-0">
                        <div>
                           <h3 className="text-base md:text-lg font-bold tracking-tight">
                              Mayor Analítico Auxiliar: {drillData?.conceptName || 'Detalle de Movimientos'} {drillData?.monthLabel || ''}
                           </h3>
                           <p className="text-xs text-slate-400 mt-0.5">
                              Detalle de movimientos de cartola bancaria e imputaciones respaldadas
                           </p>
                        </div>
                        <button
                           type="button"
                           onClick={() => setDrillModalOpen(false)}
                           className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
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
                           <span className="text-lg md:text-xl font-extrabold text-heading font-mono">
                              {clp(targetCellAmount)}
                           </span>
                        </div>

                        {drillLoading ? (
                           <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <ArrowPathIcon className="w-7 h-7 animate-spin text-brand" />
                              <span className="text-xs text-text-soft font-medium">Cargando movimientos bancarios...</span>
                           </div>
                        ) : !drillData?.documents?.length ? (
                           <div className="py-10 text-center text-text-soft text-xs">
                              No se encontraron movimientos individuales asociados a esta celda en este periodo.
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
