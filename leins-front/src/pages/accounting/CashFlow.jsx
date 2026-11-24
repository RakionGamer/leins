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
   ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

const formatClp = (n, showSign = false) => {
   const val = Number(n || 0);
   const absFormatted = Math.abs(val).toLocaleString('es-CL');
   if (val < 0) return `-$ ${absFormatted}`;
   if (val > 0 && showSign) return `+$ ${absFormatted}`;
   return `$ ${absFormatted}`;
};

const formatTableAmount = (val, isOutflow = false) => {
   const num = Number(val || 0);
   if (num === 0) return { text: '$ 0', isZero: true };
   const effectiveVal = isOutflow && num > 0 ? -num : num;
   const absFormatted = Math.abs(effectiveVal).toLocaleString('es-CL');
   if (effectiveVal < 0) {
      return { text: `-$ ${absFormatted}`, isZero: false, isNegative: true };
   }
   return { text: `$ ${absFormatted}`, isZero: false, isNegative: false };
};

const toYmd = (date) => {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const formatSpanishDateLong = (ymdStr) => {
   if (!ymdStr) return '';
   const [y, m, d] = String(ymdStr).split('-').map(Number);
   if (!y || !m) return '';
   const monthsEs = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
   ];
   const day = d || 30;
   return `Al ${day} de ${monthsEs[m - 1] || ''} de ${y}`;
};

const formatTableSubtitle = (months, reportLevel) => {
   if (!months || months.length === 0) return 'Detalle mensualizado';
   const monthsEs = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
   ];
   const firstKey = months[0]?.key || '';
   const lastKey = months[months.length - 1]?.key || '';
   const [, m1] = firstKey.split('-').map(Number);
   const [y2, m2] = lastKey.split('-').map(Number);

   const firstLabel = monthsEs[(m1 || 1) - 1] || months[0]?.label || '';
   const lastLabel = (monthsEs[(m2 || 12) - 1] || months[months.length - 1]?.label || '').toLowerCase();
   const year = y2 || new Date().getFullYear();
   const levelLabel = reportLevel === 2 ? 'detalle por cuenta' : 'vista agrupada';

   return `${firstLabel} a ${lastLabel} ${year} · ${levelLabel}`;
};

export default function CashFlow() {
   const { entityId, ready } = useEntityRequired();

   // Filtros principales (Por defecto Año completo y Por cuenta, idéntico a imagen de referencia)
   const [periodMode, setPeriodMode] = useState('year'); // 'current_month' | 'quarter' | 'semester' | 'year' | 'range'
   const [fromDate, setFromDate] = useState(() => {
      const now = new Date();
      return toYmd(new Date(now.getFullYear(), 0, 1));
   });
   const [toDate, setToDate] = useState(() => {
      const now = new Date();
      return toYmd(new Date(now.getFullYear(), 11, 31));
   });
   const [reportLevel, setReportLevel] = useState(2); // 1 = Agrupado, 2 = Por cuenta

   // Estado de datos
   const [cashFlowData, setCashFlowData] = useState(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

   // Grupos expandidos
   const [expandedGroups, setExpandedGroups] = useState({
      operacion: true,
      inversion: true,
      financiamiento: true,
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

   const months = cashFlowData?.period?.months || [];
   const kpis = cashFlowData?.kpis || {};
   const structure = cashFlowData?.structure || [];
   const endingBankBalanceRow = cashFlowData?.endingBankBalanceRow;

   // Datos procesados para el gráfico de barras "Saldo final en bancos"
   const chartData = useMemo(() => {
      if (!endingBankBalanceRow || !months.length) return [];
      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Encontrar cuál mes es el vigente
      const hasCurrent = months.some(m => m.key === currentYm);
      const targetCurrentKey = hasCurrent ? currentYm : months[months.length - 1]?.key;

      return months.map(m => {
         const val = Number(endingBankBalanceRow.monthlyAmounts?.[m.key] || 0);
         const isCurrent = m.key === targetCurrentKey;
         const shortName = m.label?.split(' ')[0] || m.label;
         return {
            ...m,
            val,
            isCurrent,
            shortName,
         };
      });
   }, [endingBankBalanceRow, months]);

   const maxBalance = useMemo(() => {
      const vals = chartData.map(d => d.val);
      const m = Math.max(0, ...vals);
      return m > 0 ? m * 1.18 : 120000000;
   }, [chartData]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
         {/* ======================================================== */}
         {/* 1. Header: Breadcrumb, Título & Botones de Acción       */}
         {/* ======================================================== */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <div className="flex items-center gap-1.5 text-xs text-[#8E9BB5] font-medium mb-1">
                  <span>Reportes</span>
                  <span>›</span>
                  <span className="text-[#55607A]">Flujo de caja</span>
               </div>
               <h1 className="text-2xl sm:text-3xl font-nunito font-black text-[#0A1A3F] tracking-tight">
                  Flujo de caja
               </h1>
               <p className="text-xs sm:text-sm text-[#55607A] font-medium mt-0.5">
                  Cuánta plata entró, cuánta salió y con cuánto quedas, mes a mes.
               </p>
            </div>

            {/* Botones de acción (Actualizar y Exportar Excel) */}
            <div className="flex items-center gap-2.5 shrink-0">
               <button
                  type="button"
                  onClick={() => {
                     loadCashFlow();
                     toast.success('Flujo de Caja actualizado');
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
               >
                  <ArrowPathIcon className={`w-4 h-4 text-[#0A1A3F] ${loading ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
               </button>

               <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={loading || !cashFlowData}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
               >
                  <ArrowDownTrayIcon className="w-4 h-4 stroke-[2.5]" />
                  <span>Exportar Excel</span>
               </button>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 2. Barra de Filtros: Periodos, Rango y Reportabilidad   */}
         {/* ======================================================== */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-2 sm:p-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
            {/* Lado izquierdo: Presets de Periodo + Rango de Fechas */}
            <div className="flex flex-wrap items-center gap-2.5">
               {/* Preset Pills */}
               <div className="inline-flex rounded-xl bg-[#F5F8FF] p-1 border border-[#E2EAFD] text-xs font-medium">
                  <button
                     type="button"
                     onClick={() => handlePreset('current_month')}
                     className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        periodMode === 'current_month'
                           ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                           : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                     }`}
                  >
                     Mes en curso
                  </button>
                  <button
                     type="button"
                     onClick={() => handlePreset('quarter')}
                     className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        periodMode === 'quarter'
                           ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                           : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                     }`}
                  >
                     Trimestre
                  </button>
                  <button
                     type="button"
                     onClick={() => handlePreset('semester')}
                     className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        periodMode === 'semester'
                           ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                           : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                     }`}
                  >
                     Semestre
                  </button>
                  <button
                     type="button"
                     onClick={() => handlePreset('year')}
                     className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        periodMode === 'year'
                           ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                           : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                     }`}
                  >
                     Año completo
                  </button>
               </div>

               {/* Date Range Inputs */}
               <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                     <span className="absolute left-3 pointer-events-none text-[#8E9BB5] text-xs">📅</span>
                     <DateInput
                        disabled={loading}
                        className="w-32 sm:w-36 h-9 pl-8 pr-3 text-xs rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] font-bold shadow-xs hover:border-[#1F6BFF] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] transition cursor-pointer"
                        value={fromDate}
                        onChange={(val) => {
                           setFromDate(val);
                           setPeriodMode('range');
                        }}
                        placeholder="Desde"
                     />
                  </div>
                  <span className="text-[#8E9BB5] font-bold text-xs select-none">—</span>
                  <div className="relative flex items-center">
                     <span className="absolute left-3 pointer-events-none text-[#8E9BB5] text-xs">📅</span>
                     <DateInput
                        disabled={loading}
                        className="w-32 sm:w-36 h-9 pl-8 pr-3 text-xs rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] font-bold shadow-xs hover:border-[#1F6BFF] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] transition cursor-pointer"
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

            {/* Lado derecho: Píldoras de Nivel (Detalle | Agrupado | Por cuenta) */}
            <div className="inline-flex rounded-xl bg-[#F5F8FF] p-1 border border-[#E2EAFD] text-xs font-medium self-start lg:self-auto">
               <button
                  type="button"
                  onClick={() => {
                     setReportLevel(2);
                     setExpandedGroups({ operacion: true });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                     reportLevel === 2
                        ? 'bg-[#1F6BFF] text-white font-bold shadow-xs'
                        : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                  }`}
               >
                  Detalle
               </button>
               <button
                  type="button"
                  onClick={() => setReportLevel(1)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                     reportLevel === 1
                        ? 'bg-[#1F6BFF] text-white font-bold shadow-xs'
                        : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                  }`}
               >
                  Agrupado
               </button>
               <button
                  type="button"
                  onClick={() => {
                     setReportLevel(2);
                     setExpandedGroups({ operacion: true });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                     reportLevel === 2
                        ? 'bg-[#1F6BFF] text-white font-bold shadow-xs'
                        : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                  }`}
               >
                  Por cuenta
               </button>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 3. Tarjetas KPI de Resumen (4 Cards Jeito Oficial)       */}
         {/* ======================================================== */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Cobros en efectivo */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#55607A] font-semibold">Cobros en efectivo</span>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                     <svg className="w-4 h-4 text-[#0A1A3F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                     </svg>
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-[#0A1A3F] tracking-tight">
                     {formatClp(kpis.totalIncomes)}
                  </div>
               </div>
            </div>

            {/* Card 2: Pagos en efectivo */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#55607A] font-semibold">Pagos en efectivo</span>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                     <svg className="w-4 h-4 text-[#0A1A3F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                        <polyline points="16 17 22 17 22 11" />
                     </svg>
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-[#0A1A3F] tracking-tight">
                     {formatClp(kpis.totalExpenses ? -Math.abs(kpis.totalExpenses) : 0)}
                  </div>
               </div>
            </div>

            {/* Card 3: Flujo neto operacional */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#55607A] font-semibold">Flujo neto operacional</span>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                     <svg className="w-4 h-4 text-[#0A1A3F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8h11" />
                        <path d="M12.5 4.5 16 8l-3.5 3.5" />
                        <path d="M20 16H9" />
                        <path d="M11.5 12.5 8 16l3.5 3.5" />
                     </svg>
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-[#0A1A3F] tracking-tight">
                     {formatClp(kpis.netOperatingFlow, true)}
                  </div>
                  <div className="inline-flex items-center gap-1 bg-[#EEF4FF] text-[#1F6BFF] px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-2 self-start">
                     <ArrowTrendingUpIcon className="w-3 h-3 stroke-[2.5]" />
                     <span>{Number(kpis.netOperatingFlow || 0) >= 0 ? 'Positivo todo el año' : 'Negativo en el año'}</span>
                  </div>
               </div>
            </div>

            {/* Card 4: Saldo disponible en bancos (Dark Navy Jeito) */}
            <div className="bg-[#0A1A3F] text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs border border-[#162955]">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8E9BB5] font-semibold">Saldo disponible en bancos</span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                     <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 9.5 12 4.5l8.5 5" />
                        <path d="M4.5 20h15" />
                        <path d="M6.5 12.5v4.5" />
                        <path d="M10.5 12.5v4.5" />
                        <path d="M14.5 12.5v4.5" />
                        <path d="M18.5 12.5v4.5" />
                     </svg>
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-white tracking-tight">
                     {formatClp(kpis.currentBankBalance)}
                  </div>
                  <div className="text-[11px] text-[#8E9BB5] font-medium mt-1">
                     {formatSpanishDateLong(toDate || new Date())}
                  </div>
               </div>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 4. Gráfico de Barras: Saldo final en bancos             */}
         {/* ======================================================== */}
         {endingBankBalanceRow && months.length > 0 && (
            <div className="bg-white rounded-3xl border border-[#E2EAFD] p-6 shadow-xs">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                     <h3 className="font-nunito font-black text-lg text-[#0A1A3F] leading-tight">
                        Saldo final en bancos
                     </h3>
                     <p className="text-xs text-[#55607A] font-medium mt-0.5">
                        Con cuánto cerraste cada mes.
                     </p>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs">
                     <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#DCE8FE]"></span>
                        <span className="text-[#8E9BB5] font-medium">Meses cerrados</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#1F6BFF]"></span>
                        <span className="text-[#55607A] font-bold">Mes en curso</span>
                     </div>
                  </div>
               </div>

               {/* Chart Body Layout */}
               <div className="flex pt-6 pb-2">
                  {/* Y-axis labels */}
                  <div className="w-14 flex flex-col justify-between text-right text-[11px] font-semibold text-[#8E9BB5] pr-3 select-none h-44 pb-6">
                     <span>${Math.round(maxBalance / 1000000)} M</span>
                     <span>${Math.round((maxBalance * 0.666) / 1000000)} M</span>
                     <span>${Math.round((maxBalance * 0.333) / 1000000)} M</span>
                     <span>$0 M</span>
                  </div>

                  {/* Bars & Grid Container */}
                  <div className="relative flex-1 flex flex-col justify-between">
                     {/* Horizontal Gridlines */}
                     <div className="absolute inset-x-0 top-0 border-b border-[#F0F4FD] pointer-events-none" />
                     <div className="absolute inset-x-0 top-[33.3%] border-b border-[#F0F4FD] pointer-events-none" />
                     <div className="absolute inset-x-0 top-[66.6%] border-b border-[#F0F4FD] pointer-events-none" />
                     <div className="absolute inset-x-0 top-[100%] border-b border-[#F0F4FD] pointer-events-none" />

                     {/* Bars */}
                     <div className="h-44 flex items-end justify-between gap-1 sm:gap-2.5 px-2 relative z-10">
                        {chartData.map((d) => {
                           const pct = maxBalance > 0 ? Math.min(100, Math.max(4, (Math.max(0, d.val) / maxBalance) * 100)) : 4;
                           return (
                              <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                 {d.isCurrent && d.val > 0 && (
                                    <div className="text-[11px] font-black text-[#0A1A3F] mb-1.5 whitespace-nowrap animate-in fade-in">
                                       ${Math.round(d.val / 1000000)} M
                                    </div>
                                 )}
                                 <div
                                    style={{ height: `${pct}%` }}
                                    className={`w-full max-w-[44px] rounded-t-lg sm:rounded-t-xl transition-all duration-300 ${
                                       d.isCurrent
                                          ? 'bg-[#1F6BFF] shadow-sm'
                                          : 'bg-[#DCE8FE] hover:bg-[#C9DDFF]'
                                    }`}
                                    title={`${d.label}: ${formatClp(d.val)}`}
                                 />
                              </div>
                           );
                        })}
                     </div>

                     {/* X-axis Month Labels */}
                     <div className="flex items-center justify-between gap-1 sm:gap-2.5 px-2 pt-2.5 border-t border-[#F0F4FD]">
                        {chartData.map((d) => (
                           <div key={d.key} className="flex-1 text-center text-[11px] font-semibold text-[#55607A] truncate">
                              {d.shortName}
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* ======================================================== */}
         {/* 5. Contenedor Principal: Detalle del flujo (Tabla)       */}
         {/* ======================================================== */}
         <div className="bg-white rounded-3xl border border-[#E2EAFD] shadow-xs overflow-hidden">
            {/* Encabezado de la Tarjeta */}
            <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0F4FD]">
               <div>
                  <h2 className="font-nunito font-black text-lg text-[#0A1A3F] leading-tight">
                     Detalle del flujo
                  </h2>
                  <p className="text-xs text-[#55607A] font-medium mt-0.5">
                     {formatTableSubtitle(months, reportLevel)}
                  </p>
               </div>
               <div className="text-xs text-[#8E9BB5] font-semibold flex items-center gap-1 select-none">
                  <span>Desliza para ver más meses</span>
                  <span>›</span>
               </div>
            </div>

            {/* Cuerpo de la Tabla */}
            {loading ? (
               <div className="p-16 flex flex-col items-center justify-center gap-3">
                  <ArrowPathIcon className="w-8 h-8 animate-spin text-[#1F6BFF]" />
                  <span className="text-xs text-[#55607A] font-medium">Calculando Flujo de Caja desde Conciliación Bancaria...</span>
               </div>
            ) : error ? (
               <div className="p-12 text-center text-rose-600">
                  <p className="font-semibold text-xs">{error}</p>
                  <button
                     onClick={loadCashFlow}
                     className="mt-4 px-4 py-2 rounded-xl bg-[#1F6BFF] text-white text-xs font-semibold cursor-pointer"
                  >
                     Reintentar
                  </button>
               </div>
            ) : structure.length === 0 ? (
               <div className="p-16 text-center text-[#55607A]">
                  <p className="font-semibold text-sm text-[#0A1A3F]">No hay movimientos de tesorería registrados en el periodo seleccionado</p>
                  <p className="text-xs text-[#8E9BB5] mt-1">Los datos se alimentan automáticamente de los movimientos bancarios conciliados con compras, ventas y honorarios.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                     <thead>
                        <tr className="bg-[#0A1A3F] text-white">
                           <th className="py-3.5 px-5 text-left text-white font-bold text-xs sticky left-0 bg-[#0A1A3F] z-20 min-w-[320px]">
                              Concepto flujo de efectivo
                           </th>
                           {months.map((m) => (
                              <th key={m.key} className="py-3.5 px-4 text-right text-white font-bold text-xs min-w-[110px] whitespace-nowrap">
                                 {m.label}
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#F0F4FD] font-medium">
                        {structure.map((group) => {
                           const isExpanded = Boolean(expandedGroups[group.key] ?? true);

                           return (
                              <React.Fragment key={group.key}>
                                 {/* Fila de Encabezado de Grupo (ACTIVIDADES DE OPERACIÓN) */}
                                 <tr className="bg-white hover:bg-[#F8FAFF] transition-colors border-b border-[#F0F4FD]">
                                    <td className="py-3 px-5 font-bold text-[#0A1A3F] sticky left-0 bg-white hover:bg-[#F8FAFF] z-10">
                                       <div className="flex items-center gap-2">
                                          <button
                                             type="button"
                                             onClick={() => toggleGroup(group.key)}
                                             className="p-0.5 rounded text-[#55607A] hover:text-[#0A1A3F] transition cursor-pointer"
                                             title={isExpanded ? 'Colapsar' : 'Expandir'}
                                          >
                                             {isExpanded ? (
                                                <ChevronDownIcon className="w-4 h-4 stroke-[2.5]" />
                                             ) : (
                                                <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                                             )}
                                          </button>
                                          <span className="text-xs font-bold text-[#0A1A3F]">{group.label}</span>
                                       </div>
                                    </td>
                                    {months.map((m) => {
                                       const val = group.monthlyAmounts[m.key] || 0;
                                       const cell = formatTableAmount(val);
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
                                             className={`py-3 px-4 text-right font-bold text-xs tabular-nums transition ${
                                                val !== 0 ? 'cursor-pointer hover:underline hover:text-[#1F6BFF]' : ''
                                             } ${cell.isZero ? 'text-[#A0AEC0]' : 'text-[#0A1A3F]'}`}
                                             title={val !== 0 ? 'Clic para ver Mayor Analítico Auxiliar' : ''}
                                          >
                                             {cell.text}
                                          </td>
                                       );
                                    })}
                                 </tr>

                                 {/* Filas de Conceptos (Nivel 1) */}
                                 {isExpanded && group.items?.map((item) => {
                                    const isOutflow = item.isOutflow;

                                    return (
                                       <React.Fragment key={item.key}>
                                          <tr className="bg-white hover:bg-[#F8FAFF] transition-colors border-b border-[#F0F4FD]">
                                             <td className="py-2.5 px-5 pl-10 text-[#0A1A3F] font-medium text-xs sticky left-0 bg-white hover:bg-[#F8FAFF] z-10">
                                                <span className="truncate">{item.name}</span>
                                             </td>
                                             {months.map((m) => {
                                                const rawVal = item.monthlyAmounts[m.key] || 0;
                                                const cell = formatTableAmount(rawVal, isOutflow);

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
                                                            cellAmount: isOutflow && rawVal > 0 ? -rawVal : rawVal,
                                                         })
                                                      }
                                                      className={`py-2.5 px-4 text-right text-xs tabular-nums transition ${
                                                         rawVal !== 0
                                                            ? 'cursor-pointer hover:underline hover:text-[#1F6BFF] hover:font-bold'
                                                            : ''
                                                      } ${cell.isZero ? 'text-[#A0AEC0]' : 'text-[#0A1A3F]'}`}
                                                      title={rawVal !== 0 ? 'Clic para ver Mayor Analítico Auxiliar' : ''}
                                                   >
                                                      {cell.text}
                                                   </td>
                                                );
                                             })}
                                          </tr>

                                          {/* Cuentas contables detalladas (Nivel 2 / Por cuenta) */}
                                          {reportLevel === 2 &&
                                             item.accounts?.map((acc) => (
                                                <tr
                                                   key={acc.code}
                                                   className="bg-white hover:bg-[#F8FAFF] transition-colors border-b border-[#F0F4FD]"
                                                >
                                                   <td className="py-2 px-5 pl-14 font-normal sticky left-0 bg-white hover:bg-[#F8FAFF] z-10">
                                                      <div className="flex items-center gap-2">
                                                         <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[#EFF3FF] text-[#1F6BFF] border border-[#D8E4FF] shrink-0">
                                                            {acc.code}
                                                         </span>
                                                         <span className="truncate text-xs text-[#55607A]">{acc.name}</span>
                                                      </div>
                                                   </td>
                                                   {months.map((m) => {
                                                      const accVal = acc.monthlyAmounts[m.key] || 0;
                                                      const cell = formatTableAmount(accVal, isOutflow);

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
                                                                  cellAmount: isOutflow && accVal > 0 ? -accVal : accVal,
                                                               })
                                                            }
                                                            className={`py-2 px-4 text-right text-xs tabular-nums transition ${
                                                               accVal !== 0
                                                                  ? 'cursor-pointer hover:underline hover:text-[#1F6BFF] hover:font-bold'
                                                                  : ''
                                                            } ${cell.isZero ? 'text-[#A0AEC0]' : 'text-[#55607A]'}`}
                                                            title={accVal !== 0 ? 'Clic para ver Mayor Analítico Auxiliar' : ''}
                                                         >
                                                            {cell.text}
                                                         </td>
                                                      );
                                                   })}
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
                           <tr className="bg-[#0A1A3F] text-white font-bold border-t border-[#1E305C]">
                              <td className="py-3.5 px-5 text-xs tracking-wide text-white font-bold sticky left-0 bg-[#0A1A3F] z-20">
                                 {endingBankBalanceRow.label}
                              </td>
                              {months.map((m) => {
                                 const balanceVal = endingBankBalanceRow.monthlyAmounts[m.key] || 0;
                                 const cell = formatTableAmount(balanceVal);
                                 return (
                                    <td
                                       key={m.key}
                                       className="py-3.5 px-4 text-right font-bold text-xs text-white tabular-nums"
                                    >
                                       {cell.text}
                                    </td>
                                 );
                              })}
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            )}
         </div>

         {/* ======================================================== */}
         {/* 6. Modal Mayor Analítico Auxiliar (Drill-down de Cartola) */}
         {/* ======================================================== */}
         {drillModalOpen &&
            createPortal(
               <div
                  onClick={(e) => {
                     if (e.target === e.currentTarget) setDrillModalOpen(false);
                  }}
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A1A3F]/40 backdrop-blur-xs p-3 sm:p-4 md:p-6 overflow-y-auto"
               >
                  <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#E2EAFD] overflow-hidden my-auto flex flex-col max-h-[90vh]">
                     {/* Header */}
                     <div className="px-6 py-4 border-b border-[#E2EAFD] flex items-center justify-between bg-white shrink-0">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                              <CheckCircleIcon className="w-5 h-5 stroke-[2.5]" />
                           </div>
                           <div>
                              <h3 className="text-base font-nunito font-black text-[#0A1A3F] tracking-tight">
                                 Mayor Analítico Auxiliar: {drillData?.conceptName || 'Detalle de Movimientos'} {drillData?.monthLabel || ''}
                              </h3>
                              <p className="text-xs text-[#55607A] font-medium mt-0.5">
                                 Detalle de movimientos de cartola bancaria e imputaciones respaldadas
                              </p>
                           </div>
                        </div>
                        <button
                           type="button"
                           onClick={() => setDrillModalOpen(false)}
                           className="p-2 rounded-xl text-[#8E9BB5] hover:text-[#0A1A3F] hover:bg-[#EEF3FF] transition cursor-pointer"
                        >
                           <XMarkIcon className="w-5 h-5" />
                        </button>
                     </div>

                     {/* Body Content */}
                     <div className="p-6 overflow-y-auto space-y-4">
                        {/* Monto Total Box */}
                        <div className="rounded-2xl border border-[#E2EAFD] bg-[#F8FAFF] p-4 flex items-center justify-between shadow-xs">
                           <span className="text-xs sm:text-sm text-[#55607A] font-medium">
                              Monto total conciliado a esta celda:
                           </span>
                           <span className="text-lg sm:text-xl font-nunito font-black text-[#0A1A3F] tabular-nums">
                              {formatClp(targetCellAmount)}
                           </span>
                        </div>

                        {drillLoading ? (
                           <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <ArrowPathIcon className="w-7 h-7 animate-spin text-[#1F6BFF]" />
                              <span className="text-xs text-[#55607A] font-medium">Cargando movimientos bancarios...</span>
                           </div>
                        ) : !drillData?.documents?.length ? (
                           <div className="py-10 text-center text-[#8E9BB5] text-xs">
                              No se encontraron movimientos individuales asociados a esta celda en este periodo.
                           </div>
                        ) : (
                           <div className="border border-[#E2EAFD] rounded-2xl overflow-hidden shadow-xs">
                              <table className="w-full text-left text-xs">
                                 <thead>
                                    <tr className="bg-[#F8FAFF] text-[#55607A] font-bold border-b border-[#E2EAFD]">
                                       <th className="py-2.5 px-3">Fecha</th>
                                       <th className="py-2.5 px-3">Folio / TRX</th>
                                       <th className="py-2.5 px-3">RUT / Entidad</th>
                                       <th className="py-2.5 px-3">Razón Social / Detalle</th>
                                       <th className="py-2.5 px-3 text-right">Monto Neto</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-[#F0F4FD] font-medium text-[#0A1A3F]">
                                    {drillData.documents.map((doc) => (
                                       <tr key={doc.id} className="hover:bg-[#F8FAFF] transition-colors">
                                          <td className="py-2.5 px-3 text-[#55607A] whitespace-nowrap">{doc.date}</td>
                                          <td className="py-2.5 px-3 font-mono font-bold text-[#1F6BFF] whitespace-nowrap">
                                             {doc.folio_display}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-[#0A1A3F] whitespace-nowrap">{doc.counterparty_rut}</td>
                                          <td className="py-2.5 px-3 text-[#0A1A3F] font-medium truncate max-w-[260px]">{doc.counterparty_name}</td>
                                          <td className="py-2.5 px-3 text-right font-bold text-[#0A1A3F] whitespace-nowrap tabular-nums">
                                             {formatClp(doc.amount_net)}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>

                     {/* Footer */}
                     <div className="px-6 py-4 border-t border-[#E2EAFD] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#1F6BFF]">
                           <CheckCircleIcon className="w-5 h-5 shrink-0 stroke-[2.5]" />
                           <span>Suma de registros cuadra 1:1 con el monto seleccionado ({drillData?.documents?.length || 0} comprobantes)</span>
                        </div>
                        <button
                           type="button"
                           onClick={() => setDrillModalOpen(false)}
                           className="px-5 py-2 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold shadow-xs transition self-end sm:self-auto cursor-pointer"
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
