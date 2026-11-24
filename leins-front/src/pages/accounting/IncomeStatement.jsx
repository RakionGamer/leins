import React, { useState, useEffect, useCallback } from 'react';
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
   CheckIcon,
   ChartBarIcon,
} from '@heroicons/react/24/outline';

const formatClp = (n, showSign = false) => {
   const val = Number(n || 0);
   const absFormatted = Math.abs(val).toLocaleString('es-CL');
   if (val < 0) return `-$ ${absFormatted}`;
   if (val > 0 && showSign) return `+$ ${absFormatted}`;
   return `$ ${absFormatted}`;
};

const formatTableAmount = (val, isNegativeCost = false) => {
   const num = Number(val || 0);
   if (num === 0) return { text: '$ 0', isZero: true };
   const effectiveVal = isNegativeCost && num > 0 ? -num : num;
   const absFormatted = Math.abs(effectiveVal).toLocaleString('es-CL');
   if (effectiveVal < 0) {
      return { text: `-$ ${absFormatted}`, isZero: false, isNegative: true };
   }
   return { text: `$ ${absFormatted}`, isZero: false, isNegative: false };
};

const formatPct = (val) => {
   const num = Number(val || 0);
   return num.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const toYmd = (date) => {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const formatTableSubtitle = (months) => {
   if (!months || months.length === 0) return 'Cifras en pesos';
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

   return `${firstLabel} a ${lastLabel} ${year} · cifras en pesos`;
};

export default function IncomeStatement() {
   const { entityId, ready } = useEntityRequired();

   // Filtros principales (Por defecto Trimestre y Agrupado, idéntico a imagen de referencia)
   const [periodMode, setPeriodMode] = useState('quarter'); // 'current_month' | 'quarter' | 'semester' | 'year' | 'range'
   const [fromDate, setFromDate] = useState(() => {
      const now = new Date();
      return toYmd(new Date(now.getFullYear(), now.getMonth() - 2, 1));
   });
   const [toDate, setToDate] = useState(() => {
      const now = new Date();
      return toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
   });
   const [reportLevel, setReportLevel] = useState(1); // 1 = Agrupado, 2 = Por cuenta

   // Estado de datos
   const [statementData, setStatementData] = useState(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

   // Filas expandidas (por defecto ingresos expandido según imagen de referencia)
   const [expandedGroups, setExpandedGroups] = useState({
      ingresos: true,
      costos: false,
      gastos: false,
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
            ...months.map((m) => group.monthlyTotals?.[m.key] || 0),
            group.accumulated || 0,
         ];
         rows.push(groupRow);

         // Cuentas si están disponibles
         if (Array.isArray(group.accounts) && group.accounts.length > 0) {
            group.accounts.forEach((acc) => {
               rows.push([
                  `  ${acc.code} - ${acc.name}`,
                  ...months.map((m) => acc.monthlyAmounts?.[m.key] || 0),
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

   const months = statementData?.period?.months || [];
   const kpis = statementData?.kpis || {};
   const structure = statementData?.structure || [];

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
                  <span className="text-[#55607A]">Estado de resultados</span>
               </div>
               <h1 className="text-2xl sm:text-3xl font-nunito font-black text-[#0A1A3F] tracking-tight">
                  Estado de resultados
               </h1>
               <p className="text-xs sm:text-sm text-[#55607A] font-medium mt-0.5">
                  Comparativo mensual. Cuánto vendiste, cuánto te costó y con cuánto quedaste.
               </p>
            </div>

            {/* Botones de acción (Actualizar y Exportar Excel) */}
            <div className="flex items-center gap-2.5 shrink-0">
               <button
                  type="button"
                  onClick={() => {
                     loadStatement();
                     toast.success('Estado de Resultados actualizado');
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
                  disabled={loading || !statementData}
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
                     const allExp = {};
                     structure.forEach(g => { allExp[g.key] = true; });
                     setExpandedGroups(allExp);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                     reportLevel === 2 && Object.values(expandedGroups).every(Boolean)
                        ? 'bg-[#1F6BFF] text-white font-bold shadow-xs'
                        : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                  }`}
               >
                  Detalle
               </button>
               <button
                  type="button"
                  onClick={() => {
                     setReportLevel(1);
                  }}
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
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                     reportLevel === 2 && !Object.values(expandedGroups).every(Boolean)
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
            {/* Card 1: Ingresos operacionales */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#55607A] font-semibold">Ingresos operacionales</span>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                     <svg className="w-4 h-4 text-[#0A1A3F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                     </svg>
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-[#0A1A3F] tracking-tight">
                     {formatClp(kpis.totalIngresos)}
                  </div>
               </div>
            </div>

            {/* Card 2: Costo directo de ventas */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#55607A] font-semibold">Costo directo de ventas</span>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                     <svg className="w-4 h-4 text-[#0A1A3F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                        <polyline points="16 17 22 17 22 11" />
                     </svg>
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-[#0A1A3F] tracking-tight">
                     {formatClp(kpis.totalCostos)}
                  </div>
               </div>
            </div>

            {/* Card 3: Margen bruto */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#55607A] font-semibold">Margen bruto</span>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                     <ChartBarIcon className="w-4 h-4 text-[#0A1A3F] stroke-[2.25]" />
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-[#0A1A3F] tracking-tight">
                     {formatClp(kpis.margenBruto)}
                  </div>
                  <div className="text-[11px] text-[#8E9BB5] font-medium mt-1">
                     {formatPct(kpis.margenBrutoPct)}% de los ingresos
                  </div>
               </div>
            </div>

            {/* Card 4: EBITDA (Dark Navy Jeito) */}
            <div className="bg-[#0A1A3F] text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs border border-[#162955]">
               <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8E9BB5] font-semibold">EBITDA</span>
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                     <CheckIcon className="w-4 h-4 text-white stroke-[2.5]" />
                  </div>
               </div>
               <div className="mt-3">
                  <div className="font-nunito font-black text-xl sm:text-2xl text-white tracking-tight">
                     {formatClp(kpis.ebitda)}
                  </div>
                  <div className="text-[11px] text-[#8E9BB5] font-medium mt-1">
                     {formatPct(kpis.ebitdaPct)}% de los ingresos
                  </div>
               </div>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 4. Contenedor Principal: Estructura P&L (Tabla)          */}
         {/* ======================================================== */}
         <div className="bg-white rounded-3xl border border-[#E2EAFD] shadow-xs overflow-hidden">
            {/* Encabezado de la Tarjeta */}
            <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0F4FD]">
               <div>
                  <h2 className="font-nunito font-black text-lg text-[#0A1A3F] leading-tight">
                     Estructura P&L
                  </h2>
                  <p className="text-xs text-[#55607A] font-medium mt-0.5">
                     {formatTableSubtitle(months)}
                  </p>
               </div>
               {/* Legend indicadora de cuenta contable */}
               <div className="flex items-center gap-2 text-xs text-[#8E9BB5] select-none">
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[#EFF3FF] text-[#1F6BFF] border border-[#D8E4FF]">
                     41.01.10
                  </span>
                  <span className="font-medium">= cuenta contable</span>
               </div>
            </div>

            {/* Cuerpo de la Tabla */}
            {loading ? (
               <div className="p-16 flex flex-col items-center justify-center gap-3">
                  <ArrowPathIcon className="w-8 h-8 animate-spin text-[#1F6BFF]" />
                  <span className="text-xs text-[#55607A] font-medium">Cargando Estado de Resultados...</span>
               </div>
            ) : error ? (
               <div className="p-12 text-center text-rose-600">
                  <p className="font-semibold text-xs">{error}</p>
                  <button
                     onClick={loadStatement}
                     className="mt-4 px-4 py-2 rounded-xl bg-[#1F6BFF] text-white text-xs font-semibold cursor-pointer"
                  >
                     Reintentar
                  </button>
               </div>
            ) : structure.length === 0 ? (
               <div className="p-16 text-center text-[#55607A]">
                  <p className="font-semibold text-sm text-[#0A1A3F]">No hay movimientos registrados en el periodo seleccionado</p>
                  <p className="text-xs text-[#8E9BB5] mt-1">Los datos se alimentan automáticamente de las compras, ventas y honorarios extraídos del SII.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                     <thead>
                        <tr className="bg-[#0A1A3F] text-white">
                           <th className="py-3.5 px-5 text-left text-white font-bold text-xs sticky left-0 bg-[#0A1A3F] z-20 min-w-[320px]">
                              Estructura P&L / cuenta contable
                           </th>
                           {months.map((m) => (
                              <th key={m.key} className="py-3.5 px-4 text-right text-white font-bold text-xs min-w-[110px] whitespace-nowrap">
                                 {m.label}
                              </th>
                           ))}
                           <th className="py-3.5 px-5 text-right font-black text-xs text-white bg-[#1F6BFF] min-w-[130px] whitespace-nowrap">
                              Total acumulado
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#F0F4FD] font-medium">
                        {structure.map((item) => {
                           // 1. Subtotal: Margen Bruto Operacional (Fila celeste suave)
                           if (item.isSubtotal) {
                              return (
                                 <tr
                                    key={item.key}
                                    className="bg-[#F2F6FE] text-[#0A1A3F] font-bold border-y border-[#E2EAFD]"
                                 >
                                    <td className="py-3 px-5 font-bold text-[#0A1A3F] sticky left-0 bg-[#F2F6FE] z-10">
                                       {item.label}
                                    </td>
                                    {months.map((m) => {
                                       const val = item.monthlyTotals?.[m.key] || 0;
                                       const cell = formatTableAmount(val);
                                       return (
                                          <td key={m.key} className="py-3 px-4 text-right font-bold text-xs tabular-nums text-[#0A1A3F]">
                                             {cell.text}
                                          </td>
                                       );
                                    })}
                                    <td className="py-3 px-5 text-right font-black text-xs text-[#0A1A3F] bg-[#E8F0FE] tabular-nums">
                                       {formatTableAmount(item.accumulated).text}
                                    </td>
                                 </tr>
                              );
                           }

                           // 2. Fila Total: Resultado neto del período (EBITDA) - Fondo Marino & Total Azul
                           if (item.isTotal) {
                              return (
                                 <tr
                                    key={item.key}
                                    className="bg-[#0A1A3F] text-white font-bold border-t border-[#1E305C]"
                                 >
                                    <td className="py-3.5 px-5 text-xs tracking-wide text-white font-bold sticky left-0 bg-[#0A1A3F] z-20">
                                       {item.label}
                                    </td>
                                    {months.map((m) => {
                                       const val = item.monthlyTotals?.[m.key] || 0;
                                       const cell = formatTableAmount(val);
                                       return (
                                          <td key={m.key} className="py-3.5 px-4 text-right font-bold text-xs text-white tabular-nums">
                                             {cell.text}
                                          </td>
                                       );
                                    })}
                                    <td className="py-3.5 px-5 text-right font-black text-xs text-white bg-[#1F6BFF] tabular-nums">
                                       {formatTableAmount(item.accumulated).text}
                                    </td>
                                 </tr>
                              );
                           }

                           // 3. Grupos principales (1. Ingresos operacionales, 2. Costos, 3. Gastos)
                           const isExpanded = Boolean(expandedGroups[item.key]);
                           const isNegativeCost = item.key === 'costos' || item.key === 'gastos';

                           return (
                              <React.Fragment key={item.key}>
                                 {/* Fila de Grupo */}
                                 <tr className="bg-white hover:bg-[#F8FAFF] transition-colors border-b border-[#F0F4FD]">
                                    <td className="py-3 px-5 font-bold text-[#0A1A3F] sticky left-0 bg-white hover:bg-[#F8FAFF] z-10">
                                       <div className="flex items-center gap-2">
                                          <button
                                             type="button"
                                             onClick={() => toggleGroup(item.key)}
                                             className="p-0.5 rounded text-[#55607A] hover:text-[#0A1A3F] transition cursor-pointer"
                                             title={isExpanded ? 'Colapsar cuentas' : 'Expandir cuentas'}
                                          >
                                             {isExpanded ? (
                                                <ChevronDownIcon className="w-4 h-4 stroke-[2.5]" />
                                             ) : (
                                                <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                                             )}
                                          </button>
                                          <span className="text-xs font-bold text-[#0A1A3F]">{item.label}</span>
                                       </div>
                                    </td>
                                    {months.map((m) => {
                                       const val = item.monthlyTotals?.[m.key] || 0;
                                       const cell = formatTableAmount(val, isNegativeCost);
                                       return (
                                          <td
                                             key={m.key}
                                             className={`py-3 px-4 text-right font-bold text-xs tabular-nums transition ${
                                                cell.isZero ? 'text-[#A0AEC0]' : 'text-[#0A1A3F]'
                                             }`}
                                          >
                                             {cell.text}
                                          </td>
                                       );
                                    })}
                                    <td className="py-3 px-5 text-right font-bold text-xs text-[#0A1A3F] bg-[#F2F6FE] tabular-nums">
                                       {formatTableAmount(item.accumulated, isNegativeCost).text}
                                    </td>
                                 </tr>

                                 {/* Cuentas contables hijas (visibles si el grupo está expandido) */}
                                 {isExpanded &&
                                    item.accounts?.map((acc) => (
                                       <tr
                                          key={`${item.key}-${acc.code}`}
                                          className="bg-white hover:bg-[#F8FAFF] transition-colors border-b border-[#F0F4FD]"
                                       >
                                          <td className="py-2.5 px-5 pl-12 font-normal sticky left-0 bg-white hover:bg-[#F8FAFF] z-10">
                                             <div className="flex items-center gap-2.5">
                                                <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[#EFF3FF] text-[#1F6BFF] border border-[#D8E4FF] shrink-0">
                                                   {acc.code}
                                                </span>
                                                <span className="truncate text-xs text-[#55607A]">{acc.name}</span>
                                             </div>
                                          </td>
                                          {months.map((m) => {
                                             const accVal = acc.monthlyAmounts?.[m.key] || 0;
                                             const cell = formatTableAmount(accVal, isNegativeCost);
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
                                                         cellAmount: isNegativeCost && accVal > 0 ? -accVal : accVal,
                                                      })
                                                   }
                                                   className={`py-2.5 px-4 text-right text-xs tabular-nums transition ${
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
                                          <td className="py-2.5 px-5 text-right font-medium text-xs text-[#55607A] bg-[#F2F6FE] tabular-nums">
                                             {formatTableAmount(acc.total, isNegativeCost).text}
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
         {/* 5. Modal Mayor Analítico Auxiliar (Drill-down Jeito)     */}
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
                                 Mayor Analítico Auxiliar: {drillData?.accountName || 'Detalle de Imputaciones'} {drillData?.monthLabel || ''}
                              </h3>
                              <p className="text-xs text-[#55607A] font-medium mt-0.5">
                                 Detalle de movimientos e imputaciones respaldadas en operaciones del SII
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
                              Monto total imputado a esta celda:
                           </span>
                           <span className="text-lg sm:text-xl font-nunito font-black text-[#0A1A3F] tabular-nums">
                              {formatClp(targetCellAmount)}
                           </span>
                        </div>

                        {drillLoading ? (
                           <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <ArrowPathIcon className="w-7 h-7 animate-spin text-[#1F6BFF]" />
                              <span className="text-xs text-[#55607A] font-medium">Cargando comprobantes...</span>
                           </div>
                        ) : !drillData?.documents?.length ? (
                           <div className="py-10 text-center text-[#8E9BB5] text-xs">
                              No se encontraron documentos individuales asociados a esta celda en este periodo.
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
