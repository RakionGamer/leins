import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   CalendarDaysIcon,
   ChevronDownIcon,
   ShoppingCartIcon,
   ArrowTrendingUpIcon,
   DocumentTextIcon,
   CalculatorIcon,
   ExclamationTriangleIcon,
   CheckCircleIcon,
   BuildingLibraryIcon,
} from '@heroicons/react/24/outline';
import { useEntity } from '../context/EntityContext';
import { useEntityRequired } from '../hooks/useEntityRequired';
import { usePeriod } from '../context/PeriodContext';
import { getDashboardSummary } from '../services/dashboardApi';
import JeitoCurve from '../components/JeitoCurve';

// Formato de moneda chilena: "$ 12.480.300"
function formatClp(value) {
   const num = Math.round(Number(value || 0));
   return `$ ${Math.abs(num).toLocaleString('es-CL')}`;
}

// Formato de enteros
const intFmt = new Intl.NumberFormat('es-CL');

// Datos de demostración oficiales del sistema Jeito (Julio 2026)
const DEMO_DASHBOARD = {
   sales: {
      total: 15449520,
      count: 18,
      diffPercent: -9.9,
      comparisonMonth: 'junio',
   },
   purchases: {
      total: 6470190,
      count: 10,
      diffPercent: 46.1,
      comparisonMonth: 'junio',
   },
   result: {
      total: 8979330,
      margin: 58.1,
      diffPercent: -29.4,
      comparisonMonth: 'junio',
   },
   vat: {
      balance: 1418570,
      debit: 2419150,
      credit: 1000580,
      diffPercent: -34.9,
      comparisonMonth: 'junio',
   },
   bankBalance: 101996903,
   alerts: [
      {
         id: 1,
         title: 'Tu resultado bajó 29,4% respecto a junio',
         message: 'Las ventas cayeron y las compras subieron. Revisemos qué cambió.',
         actionText: 'Ver detalle',
         link: '/income/sales-boletas',
      },
      {
         id: 2,
         title: 'Tus compras subieron 46,1%',
         message: 'Compraste $ 2.043.000 más que en junio, sobre todo a proveedores nacionales.',
         actionText: 'Ver compras',
         link: '/expenses/purchases',
      },
   ],
   quality: {
      reconciledRatio: 83.3,
      pendingCount: 6,
      unclassifiedDocs: 0,
      unclassifiedInvoices: 0,
      mismatchAmount: 1,
      pendingBankAmount: 8207739,
   },
   composition: {
      sales: [
         { label: 'Factura electrónica', count: 12, total: 13527920, share: 87.5 },
         { label: 'Boleta electrónica', count: 5, total: 1583000, share: 10.2 },
         { label: 'Factura exenta', count: 1, total: 338600, share: 2.3 },
      ],
      purchases: [
         { label: 'Factura electrónica', count: 9, total: 6266790, share: 96.8 },
         { label: 'Factura exenta', count: 1, total: 203400, share: 3.2 },
      ],
   },
   daily: [
      { day: 1, sales: 0, purchases: 500000 },
      { day: 2, sales: 0, purchases: 0 },
      { day: 3, sales: 800000, purchases: 0 },
      { day: 4, sales: 0, purchases: 0 },
      { day: 5, sales: 1500000, purchases: 450000 },
      { day: 6, sales: 1200000, purchases: 0 },
      { day: 7, sales: 0, purchases: 400000 },
      { day: 8, sales: 0, purchases: 500000 },
      { day: 9, sales: 2200000, purchases: 1200000 },
      { day: 10, sales: 1000000, purchases: 1100000 },
      { day: 11, sales: 0, purchases: 0 },
      { day: 12, sales: 0, purchases: 350000 },
      { day: 13, sales: 0, purchases: 500000 },
      { day: 14, sales: 800000, purchases: 0 },
      { day: 15, sales: 0, purchases: 0 },
      { day: 16, sales: 1800000, purchases: 0 },
      { day: 17, sales: 0, purchases: 1100000 },
      { day: 18, sales: 3120000, purchases: 0 },
      { day: 19, sales: 0, purchases: 0 },
      { day: 20, sales: 0, purchases: 600000 },
      { day: 21, sales: 0, purchases: 800000 },
      { day: 22, sales: 0, purchases: 0 },
      { day: 23, sales: 1200000, purchases: 0 },
      { day: 24, sales: 0, purchases: 0 },
      { day: 25, sales: 0, purchases: 600000 },
      { day: 26, sales: 900000, purchases: 0 },
      { day: 27, sales: 0, purchases: 1300000 },
      { day: 28, sales: 500000, purchases: 0 },
      { day: 29, sales: 0, purchases: 0 },
      { day: 30, sales: 0, purchases: 300000 },
      { day: 31, sales: 0, purchases: 0 },
   ],
};

const MONTH_NAMES = [
   'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function Home() {
   const navigate = useNavigate();
   const { entity } = useEntity();
   const { entityId, ready } = useEntityRequired();
   const { period, setPeriod } = usePeriod();

   const [yearMode, setYearMode] = useState(false);
   const [summary, setSummary] = useState(null);
   const [hoveredDay, setHoveredDay] = useState(18); // Por defecto el día 18 con tooltip activo

   const activeYear = period?.year || 2026;
   const activeMonthNumber = period?.month || 7;
   const activeMonthName = MONTH_NAMES[activeMonthNumber - 1] || 'julio';
   const activeMonthFormatted = `${activeMonthName.charAt(0).toUpperCase() + activeMonthName.slice(1)} ${activeYear}`;

   const entityDisplayName = entity?.name || entity?.legal_name || 'Comercial Andes Demo SpA';

   // Carga de datos reales desde el backend
   useEffect(() => {
      if (!ready || !entityId) return;

      const controller = new AbortController();
      const monthStr = `${activeYear}-${String(activeMonthNumber).padStart(2, '0')}`;
      const scope = yearMode ? 'year' : 'month';

      getDashboardSummary({ entityId, month: monthStr, scope, signal: controller.signal })
         .then((res) => {
            if (res) setSummary(res);
         })
         .catch((err) => {
            if (err.name !== 'AbortError') {
               console.warn('[Dashboard] Usando datos de presentación:', err.message);
            }
         });

      return () => controller.abort();
   }, [entityId, ready, activeYear, activeMonthNumber, yearMode]);

   // Integración de datos: Si el backend provee datos los usamos; si vienen vacíos usamos la data de diseño
   const salesTotal = summary?.sales?.total ? Number(summary.sales.total) : DEMO_DASHBOARD.sales.total;
   const salesCount = summary?.sales?.count ? Number(summary.sales.count) : DEMO_DASHBOARD.sales.count;
   const salesDiff = summary?.comparison?.sales?.total?.changePercent != null
      ? Number(summary.comparison.sales.total.changePercent)
      : DEMO_DASHBOARD.sales.diffPercent;

   const purchasesTotal = summary?.purchases?.total ? Number(summary.purchases.total) : DEMO_DASHBOARD.purchases.total;
   const purchasesCount = summary?.purchases?.count ? Number(summary.purchases.count) : DEMO_DASHBOARD.purchases.count;
   const purchasesDiff = summary?.comparison?.purchases?.total?.changePercent != null
      ? Number(summary.comparison.purchases.total.changePercent)
      : DEMO_DASHBOARD.purchases.diffPercent;

   const resultTotal = summary?.result?.total != null ? Number(summary.result.total) : DEMO_DASHBOARD.result.total;
   const resultMargin = salesTotal > 0 ? (resultTotal / salesTotal) * 100 : DEMO_DASHBOARD.result.margin;
   const resultDiff = summary?.comparison?.result?.total?.changePercent != null
      ? Number(summary.comparison.result.total.changePercent)
      : DEMO_DASHBOARD.result.diffPercent;

   const vatBalance = summary?.vat?.balance != null ? Number(summary.vat.balance) : DEMO_DASHBOARD.vat.balance;
   const vatDebit = summary?.vat?.debit != null ? Number(summary.vat.debit) : DEMO_DASHBOARD.vat.debit;
   const vatCredit = summary?.vat?.credit != null ? Number(summary.vat.credit) : DEMO_DASHBOARD.vat.credit;
   const vatDiff = summary?.comparison?.vat?.balance?.changePercent != null
      ? Number(summary.comparison.vat.balance.changePercent)
      : DEMO_DASHBOARD.vat.diffPercent;

   const comparisonLabel = summary?.comparison?.label || 'junio';

   // Calidad de datos
   const qualityReconciled = summary?.quality?.bank?.reconciledRatio != null
      ? Number(summary.quality.bank.reconciledRatio)
      : DEMO_DASHBOARD.quality.reconciledRatio;
   const qualityPendingMovements = summary?.quality?.bank?.pendingTransactions != null
      ? Number(summary.quality.bank.pendingTransactions)
      : DEMO_DASHBOARD.quality.pendingCount;
   const qualityUnclassifiedDocs = summary?.quality?.documents?.unclassified != null
      ? Number(summary.quality.documents.unclassified)
      : DEMO_DASHBOARD.quality.unclassifiedDocs;
   const qualityUnclassifiedInvoices = summary?.quality?.documents?.ambiguousLegacyInvoices != null
      ? Number(summary.quality.documents.ambiguousLegacyInvoices)
      : DEMO_DASHBOARD.quality.unclassifiedInvoices;
   const qualityMismatchAmount = summary?.quality?.documents?.amountMismatch != null
      ? Number(summary.quality.documents.amountMismatch)
      : DEMO_DASHBOARD.quality.mismatchAmount;
   const qualityPendingBank = summary?.quality?.bank?.pendingAmount != null
      ? Number(summary.quality.bank.pendingAmount)
      : DEMO_DASHBOARD.quality.pendingBankAmount;

   // Composición
   const salesComposition = Array.isArray(summary?.composition?.sales) && summary.composition.sales.length > 0
      ? summary.composition.sales
      : DEMO_DASHBOARD.composition.sales;
   const purchasesComposition = Array.isArray(summary?.composition?.purchases) && summary.composition.purchases.length > 0
      ? summary.composition.purchases
      : DEMO_DASHBOARD.composition.purchases;

   // Gráfico diario
   const dailyItems = Array.isArray(summary?.daily) && summary.daily.length > 0
      ? summary.daily.map((d, i) => ({
         day: d.day || (i + 1),
         sales: Number(d.sales || 0),
         purchases: Number(d.purchases || 0),
      }))
      : DEMO_DASHBOARD.daily;

   // Max value para el gráfico de barras (escala hasta $3.2M)
   const maxBarValue = 3200000;

   // Día activo actual para el tooltip
   const currentActiveItem = dailyItems.find((d) => d.day === hoveredDay) || dailyItems[17] || dailyItems[0];

   return (
      <div className="space-y-6 text-[#0A1A3F] font-sans">
         {/* ========================================================
             1. CABECERA DEL DASHBOARD: Título, Subtítulo y Controles
             ======================================================== */}
         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
               <h1 className="text-3xl font-black font-nunito text-[#0A1A3F] tracking-tight">
                  Panel de control
               </h1>
               <p className="text-sm font-normal text-[#55607A] mt-1">
                  Así van los números de {entityDisplayName} en {activeMonthName} {activeYear}.
               </p>
            </div>

            <div className="flex items-center gap-3">
               {/* Selector de mes con botón / píldora */}
               <div className="relative inline-flex items-center">
                  <div className="flex items-center gap-2 bg-white border border-[#E2EAFD] hover:border-[#DCE5FF] rounded-xl px-3.5 py-2 shadow-sm text-xs font-bold text-[#0A1A3F] cursor-pointer transition-colors">
                     <CalendarDaysIcon className="w-4 h-4 text-[#55607A]" />
                     <span>{activeMonthFormatted}</span>
                     <ChevronDownIcon className="w-3.5 h-3.5 text-[#55607A]" />
                  </div>
                  <input
                     type="month"
                     value={`${activeYear}-${String(activeMonthNumber).padStart(2, '0')}`}
                     onChange={(e) => {
                        if (!e.target.value) return;
                        const [y, m] = e.target.value.split('-').map(Number);
                        setPeriod({ year: y, month: m });
                     }}
                     className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                     aria-label="Seleccionar período"
                  />
               </div>

               {/* Toggle switch: Ver año completo */}
               <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                     type="button"
                     role="switch"
                     aria-checked={yearMode}
                     onClick={() => setYearMode(!yearMode)}
                     className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        yearMode ? 'bg-[#1F6BFF]' : 'bg-[#DCE5FF]'
                     }`}
                  >
                     <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                           yearMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                     />
                  </button>
                  <span className="text-xs font-semibold text-[#0A1A3F]">
                     Ver año completo
                  </span>
               </label>
            </div>
         </div>

         {/* ========================================================
             2. TARJETAS DE AVISOS (2 columnas)
             ======================================================== */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aviso 1: Resultado */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-[#0A1A3F] flex items-center justify-center text-white shrink-0 shadow-sm">
                     <ExclamationTriangleIcon className="w-5 h-5 text-white stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                     <h3 className="text-sm font-bold font-nunito text-[#0A1A3F] truncate">
                        Tu resultado bajó 29,4% respecto a junio
                     </h3>
                     <p className="text-xs text-[#55607A] mt-0.5 truncate">
                        Las ventas cayeron y las compras subieron. Revisemos qué cambió.
                     </p>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={() => navigate('/income/sales-boletas')}
                  className="rounded-full border border-[#E2EAFD] hover:bg-[#EFF3FF] text-[#0A1A3F] text-xs font-bold px-4 py-2 transition-colors shrink-0 shadow-sm"
               >
                  Ver detalle
               </button>
            </div>

            {/* Aviso 2: Compras */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-[#0A1A3F] flex items-center justify-center text-white shrink-0 shadow-sm">
                     <ExclamationTriangleIcon className="w-5 h-5 text-white stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                     <h3 className="text-sm font-bold font-nunito text-[#0A1A3F] truncate">
                        Tus compras subieron 46,1%
                     </h3>
                     <p className="text-xs text-[#55607A] mt-0.5 truncate">
                        Compraste $ 2.043.000 más que en junio, sobre todo a proveedores nacionales.
                     </p>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={() => navigate('/expenses/purchases')}
                  className="rounded-full border border-[#E2EAFD] hover:bg-[#EFF3FF] text-[#0A1A3F] text-xs font-bold px-4 py-2 transition-colors shrink-0 shadow-sm"
               >
                  Ver compras
               </button>
            </div>
         </div>

         {/* ========================================================
             3. CUATRO TARJETAS DE CIFRAS (KPI)
             ======================================================== */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Ventas del mes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        {yearMode ? 'Ventas del año' : 'Ventas del mes'}
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                        <DocumentTextIcon className="w-4 h-4 stroke-[2]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {formatClp(salesTotal)}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     {intFmt.format(salesCount)} documentos
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1 bg-[#0A1A3F] text-white text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span>↘</span>
                     <span>{salesDiff > 0 ? `+${salesDiff}%` : `${salesDiff}%`} vs {comparisonLabel}</span>
                  </span>
               </div>
            </div>

            {/* KPI 2: Compras del mes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        {yearMode ? 'Compras del año' : 'Compras del mes'}
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                        <ShoppingCartIcon className="w-4 h-4 stroke-[2]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {formatClp(purchasesTotal)}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     {intFmt.format(purchasesCount)} documentos
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1 bg-[#0A1A3F] text-white text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span>↗</span>
                     <span>{purchasesDiff > 0 ? `+${purchasesDiff}%` : `${purchasesDiff}%`} vs {comparisonLabel}</span>
                  </span>
               </div>
            </div>

            {/* KPI 3: Resultado */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">Resultado</span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                        <ArrowTrendingUpIcon className="w-4 h-4 stroke-[2]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {formatClp(resultTotal)}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     Margen {resultMargin.toFixed(1)}%
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1 bg-[#0A1A3F] text-white text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span>↘</span>
                     <span>{resultDiff > 0 ? `+${resultDiff}%` : `${resultDiff}%`} vs {comparisonLabel}</span>
                  </span>
               </div>
            </div>

            {/* KPI 4: IVA por pagar */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">IVA por pagar</span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                        <CalculatorIcon className="w-4 h-4 stroke-[2]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {formatClp(vatBalance)}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium truncate">
                     Débito {formatClp(vatDebit)} · Crédito {formatClp(vatCredit)}
                  </div>
               </div>
               <div className="mt-4">
                  <span className="inline-flex items-center gap-1 bg-[#EFF3FF] text-[#1F6BFF] text-[11px] font-bold rounded-full px-2.5 py-1">
                     <span>↘</span>
                     <span>{vatDiff > 0 ? `+${vatDiff}%` : `${vatDiff}%`} vs {comparisonLabel}</span>
                  </span>
               </div>
            </div>
         </div>

         {/* ========================================================
             4. SECCIÓN PRINCIPAL EN 2 COLUMNAS (8 cols / 4 cols)
             ======================================================== */}
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* ----------------------------------------------------
                COLUMNA IZQUIERDA (8 COLUMNAS):
                - Ingresos vs. egresos diarios
                - Composición del período
               ---------------------------------------------------- */}
            <div className="xl:col-span-8 space-y-6">
               {/* TARJETA: Ingresos vs. egresos diarios */}
               <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                     <div>
                        <h2 className="text-base font-bold font-nunito text-[#0A1A3F]">
                           Ingresos vs. egresos diarios
                        </h2>
                        <p className="text-xs text-[#55607A] mt-0.5">
                           Plata que entró y salió cada día del período.
                        </p>
                     </div>
                     <div className="flex items-center gap-4 text-xs font-semibold text-[#55607A]">
                        <span className="inline-flex items-center gap-1.5">
                           <span className="w-2.5 h-2.5 rounded-full bg-[#1F6BFF]" />
                           <span>Ingresos</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                           <span className="w-2.5 h-2.5 rounded-full bg-[#0A1A3F]" />
                           <span>Egresos</span>
                        </span>
                     </div>
                  </div>

                  {/* Área del gráfico de barras */}
                  <div className="mt-6 flex">
                     {/* Eje Y: $3 M, $2 M, $1 M, $0 */}
                     <div className="w-12 shrink-0 flex flex-col justify-between py-1 text-right text-[11px] font-semibold text-[#8E9BB5] pr-3 select-none h-48">
                        <span>$3 M</span>
                        <span>$2 M</span>
                        <span>$1 M</span>
                        <span>$0</span>
                     </div>

                     {/* Contenedor del gráfico de barras */}
                     <div className="relative flex-1 h-48">
                        {/* Guías horizontales sutiles */}
                        <div className="absolute inset-x-0 top-0 border-b border-[#EFF3FF] pointer-events-none" />
                        <div className="absolute inset-x-0 top-1/3 border-b border-[#EFF3FF] pointer-events-none" />
                        <div className="absolute inset-x-0 top-2/3 border-b border-[#EFF3FF] pointer-events-none" />
                        <div className="absolute inset-x-0 bottom-6 border-b border-[#E2EAFD] pointer-events-none" />

                        {/* Columnas diarias */}
                        <div
                           className="relative grid gap-1 items-end h-[calc(100%-1.5rem)] w-full"
                           style={{ gridTemplateColumns: 'repeat(31, minmax(0, 1fr))' }}
                        >
                           {dailyItems.map((item) => {
                              const sHeight = Math.min(100, Math.max(0, (item.sales / maxBarValue) * 100));
                              const pHeight = Math.min(100, Math.max(0, (item.purchases / maxBarValue) * 100));
                              const isHovered = hoveredDay === item.day;

                              return (
                                 <div
                                    key={item.day}
                                    onMouseEnter={() => setHoveredDay(item.day)}
                                    className="relative flex flex-col items-center justify-end h-full group cursor-pointer"
                                 >
                                    {/* Tooltip activo (con línea punteada vertical) */}
                                    {isHovered && (
                                       <>
                                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-40 border-l border-dashed border-[#1F6BFF] pointer-events-none z-10" />
                                          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 w-44 bg-[#0A1A3F] text-white rounded-xl p-3 shadow-2xl pointer-events-none animate-fade-in">
                                             <div className="text-[10px] text-[#8E9BB5] font-semibold">
                                                {item.day} {activeMonthName.slice(0, 3)} {activeYear}
                                             </div>
                                             <div className="mt-2 flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-1.5">
                                                   <span className="w-2 h-2 rounded-full bg-[#1F6BFF]" />
                                                   <span className="text-white/80">Ingresos</span>
                                                </span>
                                                <span className="font-bold text-white tabular-nums">
                                                   {formatClp(item.sales)}
                                                </span>
                                             </div>
                                             <div className="mt-1 flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-1.5">
                                                   <span className="w-2 h-2 rounded-full border border-white/50" />
                                                   <span className="text-white/80">Egresos</span>
                                                </span>
                                                <span className="font-bold text-white tabular-nums">
                                                   {formatClp(item.purchases)}
                                                </span>
                                             </div>
                                          </div>
                                       </>
                                    )}

                                    {/* Par de barras: Izquierda Azul (#1F6BFF), Derecha Azul Profundo (#0A1A3F) */}
                                    <div className="flex items-end justify-center gap-0.5 w-full h-full pb-1">
                                       <div
                                          style={{ height: `${sHeight}%` }}
                                          className={`w-1 sm:w-1.5 rounded-t-sm bg-[#1F6BFF] transition-all duration-150 ${
                                             isHovered ? 'ring-2 ring-[#7FAAFF]' : ''
                                          }`}
                                       />
                                       <div
                                          style={{ height: `${pHeight}%` }}
                                          className={`w-1 sm:w-1.5 rounded-t-sm bg-[#0A1A3F] transition-all duration-150 ${
                                             isHovered ? 'ring-2 ring-[#55607A]' : ''
                                          }`}
                                       />
                                    </div>

                                    {/* Etiqueta del día debajo del eje X (impares: 1, 3, 5, ..., 31) */}
                                    <div className="absolute -bottom-6 text-[10px] font-semibold text-[#8E9BB5] select-none">
                                       {item.day % 2 !== 0 ? item.day : ''}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>
               </div>

               {/* TARJETA: Composición del período */}
               <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-sm">
                  <div>
                     <h2 className="text-base font-bold font-nunito text-[#0A1A3F]">
                        Composición del período
                     </h2>
                     <p className="text-xs text-[#55607A] mt-0.5">
                        Distribución por tipo de documento y su peso sobre el total.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                     {/* Subcolumna 1: Ventas por tipo */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xs font-bold text-[#0A1A3F]">Ventas por tipo</h3>
                           <span className="text-xs text-[#55607A] font-medium">{salesCount} docs</span>
                        </div>

                        <div className="space-y-4">
                           {salesComposition.map((item, index) => (
                              <div key={index} className="space-y-1.5">
                                 <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                       <span className="font-semibold text-[#0A1A3F]">{item.label}</span>
                                       <span className="bg-[#EFF3FF] text-[#55607A] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          {item.count} docs
                                       </span>
                                    </div>
                                    <span className="font-bold text-[#0A1A3F] tabular-nums">
                                       {formatClp(item.total)}
                                    </span>
                                 </div>
                                 <div className="h-1.5 w-full bg-[#EFF3FF] rounded-full overflow-hidden">
                                    <div
                                       style={{ width: `${Math.min(100, Math.max(0, item.share || 0))}%` }}
                                       className="h-full bg-[#1F6BFF] rounded-full"
                                    />
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Subcolumna 2: Compras por tipo */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xs font-bold text-[#0A1A3F]">Compras por tipo</h3>
                           <span className="text-xs text-[#55607A] font-medium">{purchasesCount} docs</span>
                        </div>

                        <div className="space-y-4">
                           {purchasesComposition.map((item, index) => (
                              <div key={index} className="space-y-1.5">
                                 <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                       <span className="font-semibold text-[#0A1A3F]">{item.label}</span>
                                       <span className="bg-[#EFF3FF] text-[#55607A] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          {item.count} docs
                                       </span>
                                    </div>
                                    <span className="font-bold text-[#0A1A3F] tabular-nums">
                                       {formatClp(item.total)}
                                    </span>
                                 </div>
                                 <div className="h-1.5 w-full bg-[#EFF3FF] rounded-full overflow-hidden">
                                    <div
                                       style={{ width: `${Math.min(100, Math.max(0, item.share || 0))}%` }}
                                       className="h-full bg-[#0A1A3F] rounded-full"
                                    />
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* ----------------------------------------------------
                COLUMNA DERECHA (4 COLUMNAS):
                - Con cuánto quedas hoy
                - Calidad de datos
               ---------------------------------------------------- */}
            <div className="xl:col-span-4 space-y-6">
               {/* TARJETA: Con cuánto quedas hoy (Azul Profundo con curva) */}
               <div className="relative overflow-hidden bg-[#0A1A3F] text-white rounded-2xl p-6 shadow-md flex flex-col justify-between min-h-[220px]">
                  {/* Decoración curva de agua en la esquina inferior derecha */}
                  <div className="absolute -bottom-14 -right-10 w-44 pointer-events-none opacity-40 select-none">
                     <JeitoCurve strokeColor="#13285C" className="w-full h-auto" />
                  </div>

                  <div className="relative z-10">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#8E9BB5]">
                           Con cuánto quedas hoy
                        </span>
                        <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                           <BuildingLibraryIcon className="w-4 h-4 stroke-[2]" />
                        </div>
                     </div>

                     <div className="text-3xl font-black font-nunito text-white tabular-nums tracking-tight mt-3">
                        {formatClp(DEMO_DASHBOARD.bankBalance)}
                     </div>
                     <p className="text-xs text-[#8E9BB5] mt-1 font-medium">
                        Saldo disponible en tus bancos
                     </p>
                  </div>

                  <div className="relative z-10 mt-6">
                     <button
                        type="button"
                        onClick={() => navigate('/reports/cash-flow')}
                        className="rounded-full bg-white hover:bg-[#EFF3FF] text-[#0A1A3F] font-bold text-xs px-5 py-2.5 transition-colors inline-flex items-center gap-1 shadow-sm"
                     >
                        <span>Ver flujo de caja</span>
                        <span>&gt;</span>
                     </button>
                  </div>
               </div>

               {/* TARJETA: Calidad de datos */}
               <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-sm">
                  <div>
                     <h2 className="text-base font-bold font-nunito text-[#0A1A3F]">
                        Calidad de datos
                     </h2>
                     <p className="text-xs text-[#55607A] mt-0.5">
                        Para confiar en los totales del período.
                     </p>
                  </div>

                  {/* Sección Donut Chart + Resumen de conciliación */}
                  <div className="mt-5 flex items-center gap-4">
                     <div className="relative w-16 h-16 shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                           {/* Círculo de fondo Hielo */}
                           <path
                              className="text-[#EFF3FF]"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                           />
                           {/* Arco de progreso Azul Vivo (#1F6BFF) */}
                           <path
                              className="text-[#1F6BFF]"
                              strokeDasharray={`${qualityReconciled}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                           />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                           <span className="text-xs font-black font-nunito text-[#0A1A3F]">
                              {qualityReconciled.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%
                           </span>
                        </div>
                     </div>

                     <div>
                        <h3 className="text-xs font-bold text-[#0A1A3F]">Conciliación bancaria</h3>
                        <p className="text-xs text-[#55607A] mt-0.5">
                           {qualityPendingMovements} movimientos por revisar
                        </p>
                     </div>
                  </div>

                  {/* 4 Elementos de revisión */}
                  <div className="mt-5 space-y-3 pt-3 border-t border-[#EFF3FF]">
                     {/* Item 1 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className="h-5 w-5 rounded-full bg-[#EFF3FF] text-[#1F6BFF] flex items-center justify-center text-[11px] font-bold">
                              ✓
                           </div>
                           <span>Documentos sin clasificar</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F]">{qualityUnclassifiedDocs}</span>
                     </div>

                     {/* Item 2 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className="h-5 w-5 rounded-full bg-[#EFF3FF] text-[#1F6BFF] flex items-center justify-center text-[11px] font-bold">
                              ✓
                           </div>
                           <span>Facturas por clasificar</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F]">{qualityUnclassifiedInvoices}</span>
                     </div>

                     {/* Item 3 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className="h-5 w-5 rounded-full bg-[#EFF3FF] text-[#55607A] flex items-center justify-center text-[10px]">
                              ▲
                           </div>
                           <span>Montos descuadrados</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F]">{qualityMismatchAmount}</span>
                     </div>

                     {/* Item 4 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className="h-5 w-5 rounded-full bg-[#EFF3FF] text-[#55607A] flex items-center justify-center text-[10px]">
                              ▲
                           </div>
                           <span>Banco pendiente</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F] tabular-nums">{formatClp(qualityPendingBank)}</span>
                     </div>
                  </div>

                  {/* Botón Píldora: Revisar datos */}
                  <div className="mt-5">
                     <button
                        type="button"
                        onClick={() => navigate('/bank/cartolas')}
                        className="w-full rounded-full bg-[#EFF3FF] hover:bg-[#DCE5FF] text-[#1F6BFF] font-bold text-xs py-2.5 transition-colors text-center shadow-sm"
                     >
                        Revisar datos
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
