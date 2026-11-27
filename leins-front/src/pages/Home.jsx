import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   CalendarioIcon,
   AbajoIcon,
   ComprasIcon,
   IngresosIcon,
   DocumentoIcon,
   ReciboIcon,
   AlertaIcon,
   BancoIcon,
   SincronizarIcon,
} from '../components/icons/SidebarIcons';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import { useEntity } from '../context/EntityContext';
import { useEntityRequired } from '../hooks/useEntityRequired';
import { usePeriod } from '../context/PeriodContext';
import { getDashboardSummary } from '../services/dashboardApi';
import { listBankAccounts } from '../services/entitiesApi';
import JeitoCurve from '../components/JeitoCurve';

// Formato de moneda chilena con espacio: "$ 12.480.300"
function formatClp(value) {
   const num = Math.round(Number(value || 0));
   const formatted = Math.abs(num).toLocaleString('es-CL');
   return num < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
}

const compactCurrencyFmt = new Intl.NumberFormat('es-CL', {
   style: 'currency',
   currency: 'CLP',
   notation: 'compact',
   maximumFractionDigits: 1,
});

function compactClp(value) {
   return compactCurrencyFmt.format(Number(value || 0));
}

// Formato de enteros
const intFmt = new Intl.NumberFormat('es-CL');

const MONTH_NAMES = [
   'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function Home() {
   const navigate = useNavigate();
   const { entity } = useEntity();
   const { entityId, ready, loading: loadingEntity } = useEntityRequired();
   const { period, setPeriod } = usePeriod();

   const [yearMode, setYearMode] = useState(false);
   const [summary, setSummary] = useState(null);
   const [loading, setLoading] = useState(false);
   const [bankBalance, setBankBalance] = useState(0);
   const [hasBankAccounts, setHasBankAccounts] = useState(false);
   const [hoveredDay, setHoveredDay] = useState(null);

   const activeYear = period?.year || new Date().getFullYear();
   const activeMonthNumber = period?.month || (new Date().getMonth() + 1);
   const activeMonthName = MONTH_NAMES[activeMonthNumber - 1] || 'este mes';
   const activeMonthFormatted = `${activeMonthName.charAt(0).toUpperCase() + activeMonthName.slice(1)} ${activeYear}`;

   const entityDisplayName = entity?.name || entity?.legal_name || 'tu empresa';

   // Carga de datos reales de resumen del dashboard desde la API
   useEffect(() => {
      if (!ready || !entityId) {
         setSummary(null);
         return undefined;
      }

      const controller = new AbortController();
      const monthStr = `${activeYear}-${String(activeMonthNumber).padStart(2, '0')}`;
      const scope = yearMode ? 'year' : 'month';

      setLoading(true);

      getDashboardSummary({ entityId, month: monthStr, scope, signal: controller.signal })
         .then((res) => {
            if (res) setSummary(res);
         })
         .catch((err) => {
            if (err.name !== 'AbortError') {
               console.error('[Dashboard] Error al cargar resumen:', err);
            }
         })
         .finally(() => setLoading(false));

      return () => controller.abort();
   }, [entityId, ready, activeYear, activeMonthNumber, yearMode]);

   // Carga de cuentas bancarias reales para calcular el saldo disponible real
   useEffect(() => {
      if (!ready || !entityId) {
         setBankBalance(0);
         setHasBankAccounts(false);
         return;
      }

      const controller = new AbortController();

      listBankAccounts({ entityId, signal: controller.signal })
         .then((res) => {
            const rows = Array.isArray(res?.rows) ? res.rows : [];
            setHasBankAccounts(rows.length > 0);
            const total = rows.reduce((sum, acc) => sum + Number(acc.initial_balance || 0), 0);
            setBankBalance(total);
         })
         .catch((err) => {
            if (err.name !== 'AbortError') {
               console.warn('[Dashboard] Error al consultar cuentas bancarias:', err);
            }
         });

      return () => controller.abort();
   }, [entityId, ready]);

   if (loadingEntity || !ready) {
      return <EntityRequiredNotice />;
   }

   // ----------------------------------------------------
   // DATOS REALES EXTRAÍDOS DEL SISTEMA
   // ----------------------------------------------------
   const sales = summary?.sales || {};
   const salesTotal = Number(sales.total || 0);
   const salesCount = Number(sales.count || 0);

   const purchases = summary?.purchases || {};
   const purchasesTotal = Number(purchases.total || 0);
   const purchasesCount = Number(purchases.count || 0);

   const resultTotal = Number(summary?.result?.total || 0);
   const resultMargin = salesTotal > 0 ? (resultTotal / salesTotal) * 100 : 0;

   const vatBalance = Number(summary?.vat?.balance || 0);
   const vatDebit = Number(summary?.vat?.debit || 0);
   const vatCredit = Number(summary?.vat?.credit || 0);

   const comparison = summary?.comparison || {};
   const comparisonLabel = comparison.label || (yearMode ? 'el año anterior' : 'el mes anterior');

   // Variaciones porcentuales reales
   const salesDiff = comparison.sales?.total?.changePercent != null ? Number(comparison.sales.total.changePercent) : null;
   const purchasesDiff = comparison.purchases?.total?.changePercent != null ? Number(comparison.purchases.total.changePercent) : null;
   const resultDiff = comparison.result?.total?.changePercent != null ? Number(comparison.result.total.changePercent) : null;
   const vatDiff = comparison.vat?.balance?.changePercent != null ? Number(comparison.vat.balance.changePercent) : null;

   // Alertas reales del backend
   const priority = {
      no_movements: 10,
      purchases_over_sales: 20,
      sales_drop: 30,
      result_drop: 35,
      purchases_growth: 40,
      sales_credit_notes_weight: 45,
      purchase_credit_notes_weight: 45,
      vat_growth: 50,
      sales_type_concentration: 70,
      purchase_type_concentration: 70,
   };
   const rawAlerts = Array.isArray(summary?.alerts) ? summary.alerts : [];
   const visibleAlerts = rawAlerts
      .filter((alert) => alert.type !== 'vat_payable' && !String(alert.type || '').startsWith('sync_'))
      .sort((a, b) => {
         if (a.severity === 'danger' && b.severity !== 'danger') return -1;
         if (b.severity === 'danger' && a.severity !== 'danger') return 1;
         return (priority[a.type] || 90) - (priority[b.type] || 90);
      })
      .slice(0, 2);

   // Calidad de datos real
   const quality = summary?.quality || {};
   const qualityBank = quality.bank || {};
   const qualityDocs = quality.documents || {};
   const reconciledRatio = qualityBank.reconciledRatio != null
      ? Number(qualityBank.reconciledRatio)
      : (qualityBank.totalTransactions > 0 ? 0 : 100);
   const pendingMovements = Number(qualityBank.pendingTransactions || 0);
   const unclassifiedDocs = Number(qualityDocs.unclassified || 0);
   const unclassifiedInvoices = Number(qualityDocs.ambiguousLegacyInvoices || 0);
   const mismatchAmount = Number(qualityDocs.amountMismatch || 0);
   const pendingBank = Number(qualityBank.pendingAmount || 0);

   // Composición real del período
   const salesComposition = Array.isArray(summary?.composition?.sales) ? summary.composition.sales : [];
   const purchasesComposition = Array.isArray(summary?.composition?.purchases) ? summary.composition.purchases : [];

   // Gráfico diario real
   const dailyItems = Array.isArray(summary?.daily) ? summary.daily : [];
   const maxBarValue = Math.max(
      1,
      ...dailyItems.map((d) => Math.max(Number(d.sales || 0), Number(d.purchases || 0)))
   );

   // Día activo actual para el tooltip: el día hovered, o el día con mayor movimiento, o el primero
   const defaultActiveDay = useMemo(() => {
      if (!dailyItems.length) return 1;
      let highestDay = dailyItems[0]?.day || 1;
      let highestVal = 0;
      dailyItems.forEach((d) => {
         const sum = Number(d.sales || 0) + Number(d.purchases || 0);
         if (sum > highestVal) {
            highestVal = sum;
            highestDay = d.day;
         }
      });
      return highestDay;
   }, [dailyItems]);

   const activeTooltipDay = hoveredDay !== null ? hoveredDay : defaultActiveDay;
   const currentActiveItem = dailyItems.find((d) => d.day === activeTooltipDay) || dailyItems[0] || { day: 1, sales: 0, purchases: 0 };

   return (
      <div className="space-y-6 text-[#0A1A3F] font-sans">
         {/* ========================================================
             1. CABECERA DEL DASHBOARD: Título, Subtítulo y Controles
             ======================================================== */}
         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
               <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black font-nunito text-[#0A1A3F] tracking-tight">
                     Panel de control
                  </h1>
                  {loading && <SincronizarIcon className="w-5 h-5 text-[#1F6BFF] animate-spin shrink-0" />}
               </div>
               <p className="text-sm font-normal text-[#55607A] mt-1">
                  Así van los números de {entityDisplayName} en {yearMode ? `el año ${activeYear}` : `${activeMonthName} ${activeYear}`}.
               </p>
            </div>

            <div className="flex items-center gap-3">
               {/* Selector de mes con botón / píldora */}
               <div className="relative inline-flex items-center">
                  <div className="flex items-center gap-2 bg-white border border-[#E2EAFD] hover:border-[#DCE5FF] rounded-xl px-3.5 py-2 shadow-sm text-xs font-bold text-[#0A1A3F] cursor-pointer transition-colors">
                     <CalendarioIcon className="w-4 h-4 text-[#55607A]" />
                     <span>{activeMonthFormatted}</span>
                     <AbajoIcon className="w-3.5 h-3.5 text-[#55607A]" />
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
                        yearMode ? 'bg-[#1F6BFF]' : 'bg-[#DCE5FF] dark:bg-[#1C3366]'
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
             2. TARJETAS DE AVISOS REALES (Solo si existen avisos del sistema)
             ======================================================== */}
         {visibleAlerts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {visibleAlerts.map((alert, index) => {
                  const isPurchases = String(alert.type || '').includes('purchase');
                  const actionText = isPurchases ? 'Ver compras' : 'Ver detalle';
                  const actionLink = isPurchases ? '/expenses/purchases' : '/income/sales-boletas';

                  return (
                     <div
                        key={alert.type || index}
                        className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow"
                     >
                        <div className="flex items-center gap-3.5 min-w-0">
                           <div className="h-10 w-10 rounded-xl bg-[#0A1A3F] dark:bg-white flex items-center justify-center text-white dark:text-[#0A1A3F] shrink-0 shadow-sm">
                              <AlertaIcon className="w-5 h-5 text-white dark:text-[#0A1A3F]" />
                           </div>
                           <div className="min-w-0">
                              <h3 className="text-sm font-bold font-nunito text-[#0A1A3F] truncate">
                                 {alert.title}
                              </h3>
                              <p className="text-xs text-[#55607A] mt-0.5 truncate">
                                 {alert.message}
                              </p>
                           </div>
                        </div>
                        <button
                           type="button"
                           onClick={() => navigate(actionLink)}
                           className="rounded-full border border-[#E2EAFD] dark:border-[#223B73] dark:bg-[#0F2147] hover:bg-[#EFF3FF] dark:hover:bg-[#162D5E] text-[#0A1A3F] dark:text-white text-xs font-bold px-4 py-2 transition-colors shrink-0 shadow-sm"
                        >
                           {actionText}
                        </button>
                     </div>
                  );
               })}
            </div>
         )}

         {/* ========================================================
             3. CUATRO TARJETAS DE CIFRAS (KPI) CON DATOS REALES
             ======================================================== */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Ventas del mes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        {yearMode ? 'Ventas del año' : 'Ventas del mes'}
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <DocumentoIcon className="w-4 h-4 text-[#0A1A3F]" />
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
                  {salesDiff != null ? (
                     <span className="inline-flex items-center gap-1 bg-[#0A1A3F] dark:bg-white text-white dark:text-[#0A1A3F] text-[11px] font-bold rounded-full px-2.5 py-1">
                        <span>{salesDiff >= 0 ? '↗' : '↘'}</span>
                        <span>{salesDiff > 0 ? `+${salesDiff.toFixed(1).replace('.', ',')}%` : `${salesDiff.toFixed(1).replace('.', ',')}%`} vs {comparisonLabel}</span>
                     </span>
                  ) : (
                     <span className="text-[11px] text-[#8E9BB5] font-medium">Sin datos de {comparisonLabel}</span>
                  )}
               </div>
            </div>

            {/* KPI 2: Compras del mes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        {yearMode ? 'Compras del año' : 'Compras del mes'}
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <ComprasIcon className="w-4 h-4 text-[#0A1A3F]" />
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
                  {purchasesDiff != null ? (
                     <span className="inline-flex items-center gap-1 bg-[#0A1A3F] dark:bg-white text-white dark:text-[#0A1A3F] text-[11px] font-bold rounded-full px-2.5 py-1">
                        <span>{purchasesDiff >= 0 ? '↗' : '↘'}</span>
                        <span>{purchasesDiff > 0 ? `+${purchasesDiff.toFixed(1).replace('.', ',')}%` : `${purchasesDiff.toFixed(1).replace('.', ',')}%`} vs {comparisonLabel}</span>
                     </span>
                  ) : (
                     <span className="text-[11px] text-[#8E9BB5] font-medium">Sin datos de {comparisonLabel}</span>
                  )}
               </div>
            </div>

            {/* KPI 3: Resultado */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">Resultado</span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <IngresosIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {formatClp(resultTotal)}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium">
                     Margen {resultMargin.toFixed(1).replace('.', ',')}%
                  </div>
               </div>
               <div className="mt-4">
                  {resultDiff != null ? (
                     <span className="inline-flex items-center gap-1 bg-[#0A1A3F] dark:bg-white text-white dark:text-[#0A1A3F] text-[11px] font-bold rounded-full px-2.5 py-1">
                        <span>{resultDiff >= 0 ? '↗' : '↘'}</span>
                        <span>{resultDiff > 0 ? `+${resultDiff.toFixed(1).replace('.', ',')}%` : `${resultDiff.toFixed(1).replace('.', ',')}%`} vs {comparisonLabel}</span>
                     </span>
                  ) : (
                     <span className="text-[11px] text-[#8E9BB5] font-medium">Sin datos de {comparisonLabel}</span>
                  )}
               </div>
            </div>

            {/* KPI 4: IVA por pagar / a favor */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-sm flex flex-col justify-between hover:border-[#DCE5FF] transition-all">
               <div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-[#55607A]">
                        {vatBalance >= 0 ? 'IVA por pagar' : 'IVA a favor'}
                     </span>
                     <div className="h-8 w-8 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#0A1A3F]">
                        <ReciboIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </div>
                  </div>
                  <div className="text-2xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-3 tracking-tight">
                     {formatClp(Math.abs(vatBalance))}
                  </div>
                  <div className="text-xs text-[#55607A] mt-1 font-medium truncate">
                     Débito {formatClp(vatDebit)} · Crédito {formatClp(vatCredit)}
                  </div>
               </div>
               <div className="mt-4">
                  {vatDiff != null ? (
                     <span className="inline-flex items-center gap-1 bg-[#EFF3FF] dark:bg-[#132B5E] text-[#1F6BFF] dark:text-[#7CA8FF] text-[11px] font-bold rounded-full px-2.5 py-1">
                        <span>{vatDiff >= 0 ? '↗' : '↘'}</span>
                        <span>{vatDiff > 0 ? `+${vatDiff.toFixed(1).replace('.', ',')}%` : `${vatDiff.toFixed(1).replace('.', ',')}%`} vs {comparisonLabel}</span>
                     </span>
                  ) : (
                     <span className="text-[11px] text-[#8E9BB5] font-medium">Sin datos de {comparisonLabel}</span>
                  )}
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
                           Ingresos vs. egresos {yearMode ? 'mensuales' : 'diarios'}
                        </h2>
                        <p className="text-xs text-[#55607A] mt-0.5">
                           Plata que entró y salió cada {yearMode ? 'mes' : 'día'} del período.
                        </p>
                     </div>
                     <div className="flex items-center gap-4 text-xs font-semibold text-[#55607A]">
                        <span className="inline-flex items-center gap-1.5">
                           <span className="w-2.5 h-2.5 rounded-full bg-[#1F6BFF]" />
                           <span>Ingresos</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                           <span className="w-2.5 h-2.5 rounded-full bg-[#0A1A3F] dark:bg-[#DCE6FF]" />
                           <span>Egresos</span>
                        </span>
                     </div>
                  </div>

                  {/* Área del gráfico de barras */}
                  {dailyItems.length === 0 ? (
                     <div className="mt-6 flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2EAFD] bg-[#F5F8FF] text-xs font-semibold text-[#8E9BB5]">
                        Sin movimientos registrados en este período.
                     </div>
                  ) : (
                     <div className="mt-6 flex">
                        {/* Eje Y dinámico */}
                        <div className="w-14 shrink-0 flex flex-col justify-between py-1 text-right text-[11px] font-semibold text-[#8E9BB5] pr-3 select-none h-48">
                           <span>{compactClp(maxBarValue)}</span>
                           <span>{compactClp(maxBarValue * 0.66)}</span>
                           <span>{compactClp(maxBarValue * 0.33)}</span>
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
                              style={{ gridTemplateColumns: `repeat(${dailyItems.length}, minmax(0, 1fr))` }}
                           >
                              {dailyItems.map((item) => {
                                 const sHeight = Math.min(100, Math.max(0, (Number(item.sales || 0) / maxBarValue) * 100));
                                 const pHeight = Math.min(100, Math.max(0, (Number(item.purchases || 0) / maxBarValue) * 100));
                                 const isHovered = activeTooltipDay === item.day;

                                 return (
                                    <div
                                       key={item.day || item.date}
                                       onMouseEnter={() => setHoveredDay(item.day)}
                                       className="relative flex flex-col items-center justify-end h-full group cursor-pointer"
                                    >
                                       {/* Tooltip activo (con línea punteada vertical) */}
                                       {isHovered && (Number(item.sales || 0) > 0 || Number(item.purchases || 0) > 0) && (
                                          <>
                                             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-40 border-l border-dashed border-[#1F6BFF] pointer-events-none z-10" />
                                             <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 w-44 bg-[#0A1A3F] dark:bg-white text-white dark:text-[#0A1A3F] rounded-xl p-3 shadow-2xl pointer-events-none animate-fade-in">
                                                <div className="text-[10px] text-[#8E9BB5] dark:text-[#55607A] font-semibold">
                                                   {item.date || `${item.day} ${activeMonthName.slice(0, 3)} ${activeYear}`}
                                                </div>
                                                <div className="mt-2 flex items-center justify-between text-xs">
                                                   <span className="flex items-center gap-1.5">
                                                      <span className="w-2 h-2 rounded-full bg-[#1F6BFF]" />
                                                      <span className="text-white/80 dark:text-[#55607A]">Ingresos</span>
                                                   </span>
                                                   <span className="font-bold text-white dark:text-[#0A1A3F] tabular-nums">
                                                      {formatClp(item.sales)}
                                                   </span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between text-xs">
                                                   <span className="flex items-center gap-1.5">
                                                      <span className="w-2 h-2 rounded-full border border-white/50 dark:border-[#0A1A3F]/40" />
                                                      <span className="text-white/80 dark:text-[#55607A]">Egresos</span>
                                                   </span>
                                                   <span className="font-bold text-white dark:text-[#0A1A3F] tabular-nums">
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
                                             className={`w-1 sm:w-1.5 rounded-t-sm bg-[#0A1A3F] dark:bg-[#DCE6FF] transition-all duration-150 ${
                                                isHovered ? 'ring-2 ring-[#55607A] dark:ring-white/60' : ''
                                             }`}
                                          />
                                       </div>

                                       {/* Etiqueta del día debajo del eje X (impares o etiqueta mensual) */}
                                       <div className="absolute -bottom-6 text-[10px] font-semibold text-[#8E9BB5] select-none">
                                          {item.label || (typeof item.day === 'number' && item.day % 2 !== 0 ? item.day : '')}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     </div>
                  )}
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

                        {salesComposition.length === 0 ? (
                           <div className="p-4 rounded-xl border border-dashed border-[#E2EAFD] text-xs text-[#8E9BB5] text-center font-medium">
                              Sin ventas registradas en este período.
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {salesComposition.map((item, index) => (
                                 <div key={item.code || index} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                       <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-semibold text-[#0A1A3F] truncate">{item.label}</span>
                                          <span className="bg-[#EFF3FF] text-[#55607A] text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                             {item.count} docs
                                          </span>
                                       </div>
                                       <span className="font-bold text-[#0A1A3F] tabular-nums shrink-0 ml-2">
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
                        )}
                     </div>

                     {/* Subcolumna 2: Compras por tipo */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xs font-bold text-[#0A1A3F]">Compras por tipo</h3>
                           <span className="text-xs text-[#55607A] font-medium">{purchasesCount} docs</span>
                        </div>

                        {purchasesComposition.length === 0 ? (
                           <div className="p-4 rounded-xl border border-dashed border-[#E2EAFD] text-xs text-[#8E9BB5] text-center font-medium">
                              Sin compras registradas en este período.
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {purchasesComposition.map((item, index) => (
                                 <div key={item.code || index} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                       <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-semibold text-[#0A1A3F] truncate">{item.label}</span>
                                          <span className="bg-[#EFF3FF] text-[#55607A] text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                                             {item.count} docs
                                          </span>
                                       </div>
                                       <span className="font-bold text-[#0A1A3F] tabular-nums shrink-0 ml-2">
                                          {formatClp(item.total)}
                                       </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#EFF3FF] rounded-full overflow-hidden">
                                       <div
                                          style={{ width: `${Math.min(100, Math.max(0, item.share || 0))}%` }}
                                          className="h-full bg-[#0A1A3F] dark:bg-[#DCE6FF] rounded-full"
                                       />
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            {/* ----------------------------------------------------
                COLUMNA DERECHA (4 COLUMNAS):
                - Con cuánto quedas hoy (Saldo real de bancos)
                - Calidad de datos real
               ---------------------------------------------------- */}
            <div className="xl:col-span-4 space-y-6">
               {/* TARJETA: Con cuánto quedas hoy (Azul Profundo con curva decorativa) */}
              <div className="relative overflow-hidden bg-[#0A1A3F] dark:bg-gradient-to-br dark:from-[#102659] dark:to-[#173985] dark:border dark:border-[#234594] text-white rounded-[28px] px-7 pt-6 pb-7 shadow-md flex flex-col justify-between min-h-[238px]">
   {/* Decoración curva de agua en la esquina inferior derecha */}
   <div className="absolute -bottom-6 -right-5 w-[215px] pointer-events-none select-none">
      <JeitoCurve strokeColor="#142A60" className="w-full h-auto" />
   </div>

   <div className="relative z-10">
      <div className="flex items-center justify-between">
         <span className="text-[15px] font-semibold text-[#A3B1CC] tracking-[-0.01em]">
            Con cuánto quedas hoy
         </span>
         <div className="h-11 w-11 rounded-[14px] bg-[#142859] flex items-center justify-center text-white shrink-0">
            <BancoIcon className="w-5 h-5 text-white" />
         </div>
      </div>

      <div className="text-[36px] sm:text-[38px] leading-[1.1] font-black font-nunito text-white tabular-nums tracking-tight mt-1.5">
         {formatClp(bankBalance)}
      </div>
      <p className="text-[13.5px] text-[#9BA9C4] mt-2.5 font-medium">
         {hasBankAccounts ? 'Saldo disponible en tus bancos' : 'Sin cuentas bancarias registradas'}
      </p>
   </div>

   <div className="relative z-10 mt-6">
      <button
         type="button"
         onClick={() => navigate('/accounting/cash-flow')}
         className="rounded-full bg-white dark:bg-white hover:bg-[#EFF3FF] dark:hover:bg-[#EEF3FF] text-[#0A1A3F] dark:text-[#0A1A3F] font-bold text-[13.5px] px-6 py-3 transition-colors inline-flex items-center gap-2.5 shadow-sm"
      >
         <span>Ver flujo de caja</span>
         <svg
            className="w-3.5 h-3.5 text-[#0A1A3F] dark:text-[#0A1A3F]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
         >
            <path d="M9 18l6-6-6-6" />
         </svg>
      </button>
   </div>
</div>

               {/* TARJETA: Calidad de datos real */}
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
                              className="text-[#EFF3FF] dark:text-[#152854]"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                           />
                           {/* Arco de progreso Azul Vivo (#1F6BFF) */}
                           <path
                              className="text-[#1F6BFF]"
                              strokeDasharray={`${reconciledRatio}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                           />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                           <span className="text-xs font-black font-nunito text-[#0A1A3F]">
                              {reconciledRatio.toFixed(1).replace('.', ',')}%
                           </span>
                        </div>
                     </div>

                     <div>
                        <h3 className="text-xs font-bold text-[#0A1A3F]">Conciliación bancaria</h3>
                        <p className="text-xs text-[#55607A] mt-0.5">
                           {pendingMovements} movimientos por revisar
                        </p>
                     </div>
                  </div>

                  {/* 4 Elementos de revisión reales */}
                  <div className="mt-5 space-y-3 pt-3 border-t border-[#EFF3FF]">
                     {/* Item 1 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                              unclassifiedDocs === 0 ? 'bg-[#EFF3FF] text-[#1F6BFF]' : 'bg-amber-100 text-amber-700'
                           }`}>
                              {unclassifiedDocs === 0 ? '✓' : '!'}
                           </div>
                           <span>Documentos sin clasificar</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F]">{unclassifiedDocs}</span>
                     </div>

                     {/* Item 2 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                              unclassifiedInvoices === 0 ? 'bg-[#EFF3FF] text-[#1F6BFF]' : 'bg-amber-100 text-amber-700'
                           }`}>
                              {unclassifiedInvoices === 0 ? '✓' : '!'}
                           </div>
                           <span>Facturas por clasificar</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F]">{unclassifiedInvoices}</span>
                     </div>

                     {/* Item 3 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                              mismatchAmount === 0 ? 'bg-[#EFF3FF] text-[#1F6BFF]' : 'bg-amber-100 text-amber-700 font-bold'
                           }`}>
                              {mismatchAmount === 0 ? '✓' : '▲'}
                           </div>
                           <span>Montos descuadrados</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F]">{mismatchAmount}</span>
                     </div>

                     {/* Item 4 */}
                     <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#55607A]">
                           <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                              pendingBank === 0 ? 'bg-[#EFF3FF] text-[#1F6BFF]' : 'bg-amber-100 text-amber-700 font-bold'
                           }`}>
                              {pendingBank === 0 ? '✓' : '▲'}
                           </div>
                           <span>Banco pendiente</span>
                        </div>
                        <span className="font-bold text-[#0A1A3F] tabular-nums">{formatClp(pendingBank)}</span>
                     </div>
                  </div>

                  {/* Botón Píldora: Revisar datos */}
                  <div className="mt-5">
                     <button
                        type="button"
                        onClick={() => navigate('/bank/cartolas')}
                        className="w-full rounded-full bg-[#EFF3FF] dark:bg-[#102452] hover:bg-[#DCE5FF] dark:hover:bg-[#16316E] text-[#1F6BFF] dark:text-[#7CA8FF] dark:border dark:border-[#1D356B] font-bold text-xs py-2.5 transition-colors text-center shadow-sm"
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
