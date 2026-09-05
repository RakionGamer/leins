import { useEffect, useMemo, useState } from 'react';
import {
   ArrowPathIcon,
   ArrowTrendingUpIcon,
   BanknotesIcon,
   CheckCircleIcon,
   ChevronDownIcon,
   ChevronUpIcon,
   MinusIcon,
   ExclamationTriangleIcon,
   InformationCircleIcon,
   ReceiptPercentIcon,
   ShoppingCartIcon,
   ArrowDownIcon,
   ArrowUpIcon,
   XCircleIcon,
} from '@heroicons/react/24/outline';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import Tooltip from 'components/Tooltip';
import { useEntityRequired } from '../hooks/useEntityRequired';
import { usePeriod } from '../context/PeriodContext';
import { useAuth } from '../context/AuthContext';
import { getDashboardSummary } from '../services/dashboardApi';

const currencyFmt = new Intl.NumberFormat('es-CL', {
   style: 'currency',
   currency: 'CLP',
   maximumFractionDigits: 0,
});

const intFmt = new Intl.NumberFormat('es-CL');
const compactCurrencyFmt = new Intl.NumberFormat('es-CL', {
   style: 'currency',
   currency: 'CLP',
   notation: 'compact',
   maximumFractionDigits: 1,
});

function periodToYYYYMM(period) {
   const month = String(period?.month || new Date().getMonth() + 1).padStart(2, '0');
   const year = period?.year || new Date().getFullYear();
   return `${year}-${month}`;
}

function periodLabel(period, yearMode = false) {
   const year = Number(period?.year || new Date().getFullYear());
   if (yearMode) return String(year);

   const month = Number(period?.month || new Date().getMonth() + 1);
   const date = new Date(year, month - 1, 1);
   return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(date);
}

function clp(value) {
   return currencyFmt.format(Number(value || 0));
}

function compactClp(value) {
   return compactCurrencyFmt.format(Number(value || 0));
}

function pct(value) {
   return `${Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
}

function trendPct(value) {
   return `${Math.abs(Number(value || 0)).toLocaleString('es-CL', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
   })}%`;
}

function TrendLine({ comparison, label, polarity = 'positive' }) {
   if (!comparison || !label) return null;

   const diff = Number(comparison.diff || 0);
   const state = comparison.state || 'no_change';
   const percent = comparison.changePercent;
   const isNeutral = state === 'no_change' || diff === 0;
   const isNew = state === 'new';
   const isEnded = state === 'ended';
   const isPositive = polarity === 'inverse' ? diff < 0 : diff > 0;
   const Icon = isNeutral || isNew ? MinusIcon : diff > 0 ? ArrowUpIcon : ArrowDownIcon;
   const toneClass = isNeutral || isNew
      ? 'text-text-soft'
      : isPositive
         ? 'text-emerald-600'
         : 'text-red-600';

   const text = isNeutral
      ? `Sin variación vs ${label}`
      : isNew
         ? `Nuevo movimiento vs ${label}`
         : isEnded
            ? `Sin movimiento actual vs ${label}`
            : `${diff > 0 ? '+' : '-'}${trendPct(percent)} vs ${label}`;

   return (
      <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold ${toneClass}`}>
         <Icon className="h-4 w-4" />
         <span>{text}</span>
      </div>
   );
}

function InfoTip({ content }) {
   if (!content) return null;
   return (
      <Tooltip content={content}>
         <InformationCircleIcon className="h-3.5 w-3.5 shrink-0 text-text-soft/60 hover:text-text-soft" />
      </Tooltip>
   );
}

function StatCard({ title, value, subtitle, icon: Icon, color, accent, tone = 'neutral', comparison, comparisonLabel, trendPolarity = 'positive', tooltip }) {
   const toneClass = tone === 'good'
      ? 'text-emerald-600'
      : tone === 'bad'
         ? 'text-red-600'
         : 'text-heading';

   return (
      <div className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-content p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
         <div className={`absolute inset-x-0 top-0 h-1 ${accent || 'bg-brand/50'}`} />
         <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
               <p className="flex items-center gap-1.5 text-sm font-medium text-text-soft">
                  <span>{title}</span>
                  <InfoTip content={tooltip} />
               </p>
               <h4 className={`mt-1 break-words text-2xl font-bold ${toneClass}`}>{value}</h4>
            </div>
            <div className={`rounded-xl p-3 ring-1 ring-inset ring-black/5 transition-transform duration-200 group-hover:scale-105 ${color}`}>
               <Icon className="h-6 w-6" />
            </div>
         </div>
         <p className="mt-3 text-sm text-text-soft">{subtitle}</p>
         <TrendLine comparison={comparison} label={comparisonLabel} polarity={trendPolarity} />
      </div>
   );
}

function DetailRow({ label, value, tooltip }) {
   return (
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle/60 py-3 last:border-0">
         <span className="flex items-center gap-1.5 text-sm text-text-soft">
            <span>{label}</span>
            <InfoTip content={tooltip} />
         </span>
         <span className="text-sm font-bold text-heading">{value}</span>
      </div>
   );
}

function CompositionCard({ title, items = [], accent = 'emerald' }) {
   const [expanded, setExpanded] = useState(false);
   const accentClass = accent === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
   const emptyText = title.toLowerCase().includes('ventas') ? 'Sin ventas en el periodo.' : 'Sin compras en el periodo.';
   const visibleLimit = 3;
   const hasMore = items.length > visibleLimit;
   const visibleItems = expanded || !hasMore ? items : items.slice(0, visibleLimit);

   return (
      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
         <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-heading">{title}</h3>
            <span className="text-xs font-semibold text-text-soft">{intFmt.format(items.reduce((sum, item) => sum + Number(item.count || 0), 0))} docs</span>
         </div>

         {!items.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-bg-content p-4 text-sm font-medium text-text-soft">
               {emptyText}
            </div>
         ) : (
            <div className="mt-4 space-y-3">
               {visibleItems.map((item) => (
                  <div key={`${item.code || 'none'}-${item.label}`} className="rounded-xl border border-border-subtle bg-bg-content p-3">
                     <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                           <div className="truncate text-sm font-bold text-heading">{item.label}</div>
                           <div className="mt-1 text-xs font-semibold text-text-soft">
                              {item.code ? `Tipo ${item.code}` : 'Sin código'} · {intFmt.format(item.count || 0)} documentos
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-bold text-heading">{clp(item.total)}</div>
                           <div className="text-xs font-semibold text-text-soft">{pct(item.share)}</div>
                        </div>
                     </div>
                     <div className="mt-3 h-2 overflow-hidden rounded-full bg-border-subtle/60">
                        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${Math.min(100, Math.max(0, Number(item.share || 0)))}%` }} />
                     </div>
                     <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                           <div className="font-semibold text-text-soft">Neto</div>
                           <div className="mt-0.5 font-bold text-heading">{clp(item.net)}</div>
                        </div>
                        <div>
                           <div className="font-semibold text-text-soft">IVA</div>
                           <div className="mt-0.5 font-bold text-heading">{clp(item.vat)}</div>
                        </div>
                        <div>
                           <div className="font-semibold text-text-soft">Exento</div>
                           <div className="mt-0.5 font-bold text-heading">{clp(item.exempt)}</div>
                        </div>
                     </div>
                  </div>
               ))}
               {hasMore && (
                  <button
                     type="button"
                     onClick={() => setExpanded((value) => !value)}
                     className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-content px-3 py-2 text-sm font-bold text-text-main transition-colors hover:border-brand/40 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                     aria-expanded={expanded}
                  >
                     {expanded ? (
                        <>
                           <ChevronUpIcon className="h-4 w-4" />
                           Ver menos
                        </>
                     ) : (
                        <>
                           <ChevronDownIcon className="h-4 w-4" />
                           Ver {items.length - visibleLimit} más
                        </>
                     )}
                  </button>
               )}
            </div>
         )}
      </div>
   );
}

function CompositionPanel({ composition = {} }) {
   const salesItems = Array.isArray(composition.sales) ? composition.sales : [];
   const purchaseItems = Array.isArray(composition.purchases) ? composition.purchases : [];

   return (
      <section className="rounded-2xl border border-border-subtle bg-bg-content p-5 shadow-soft">
         <div>
            <h2 className="text-lg font-bold text-heading">Composición del periodo</h2>
            <p className="mt-1 text-sm text-text-soft">Distribución por tipo de documento y participación sobre el total.</p>
         </div>
         <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CompositionCard title="Ventas por tipo" items={salesItems} accent="emerald" />
            <CompositionCard title="Compras por tipo" items={purchaseItems} accent="amber" />
         </div>
      </section>
   );
}

const ALERT_STYLE = {
   danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-200',
   warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200',
   info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-200',
};

const ALERT_ICON = {
   danger: XCircleIcon,
   warning: ExclamationTriangleIcon,
   info: InformationCircleIcon,
};

function AlertsPanel({ alerts = [] }) {
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
   const visibleAlerts = [...alerts]
      .filter((alert) => alert.type !== 'vat_payable' && !String(alert.type || '').startsWith('sync_'))
      .sort((a, b) => {
         if (a.severity === 'danger' && b.severity !== 'danger') return -1;
         if (b.severity === 'danger' && a.severity !== 'danger') return 1;
         return (priority[a.type] || 90) - (priority[b.type] || 90);
      })
      .slice(0, 2);

   if (!visibleAlerts.length) return null;

   return (
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
         {visibleAlerts.map((alert) => {
            const Icon = ALERT_ICON[alert.severity] || InformationCircleIcon;
            return (
               <div key={alert.type} className={`flex items-start gap-3 rounded-2xl border p-4 ${ALERT_STYLE[alert.severity] || ALERT_STYLE.info}`}>
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                     <div className="text-sm font-bold">{alert.title}</div>
                     <div className="mt-1 text-sm opacity-90">
                        {alert.message}
                     </div>
                  </div>
               </div>
            );
         })}
      </section>
   );
}

function QualityPanel({ quality = {} }) {
   const documents = quality.documents || {};
   const bank = quality.bank || {};
   const ratio = bank.reconciledRatio;
   const ratioLabel = ratio == null ? '-' : `${Number(ratio).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
   const statusOk = quality.status === 'ok';

   const checks = [
      {
         label: 'Docs sin clasificar',
         tooltip: 'Documentos que no calzan con ningun tipo de venta o compra conocido y quedan fuera de los totales.',
         value: intFmt.format(Number(documents.unclassified || 0)),
         warn: Number(documents.unclassified || 0) > 0,
      },
      {
         label: 'Facturas por clasificar',
         tooltip: 'Facturas afectas o exentas (tipo 33/34) sin dato claro de si fueron una venta o una compra. Mientras no se aclaren, pueden estar contadas en el lado equivocado.',
         value: intFmt.format(Number(documents.ambiguousLegacyInvoices || 0)),
         warn: Number(documents.ambiguousLegacyInvoices || 0) > 0,
      },
      {
         label: 'Montos descuadrados',
         tooltip: 'Documentos donde neto + IVA + exento no coincide con el total informado por el SII.',
         value: intFmt.format(Number(documents.amountMismatch || 0)),
         warn: Number(documents.amountMismatch || 0) > 0,
      },
      {
         label: 'Banco pendiente',
         tooltip: 'Suma de movimientos bancarios del periodo que todavia no se han conciliado con un documento.',
         value: clp(bank.pendingAmount),
         warn: Number(bank.pendingAmount || 0) > 0,
      },
   ];

   return (
      <section className="rounded-2xl border border-border-subtle bg-bg-content p-5 shadow-soft">
         <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
               <h2 className="text-lg font-bold text-heading">Calidad de datos</h2>
               <p className="mt-1 text-sm text-text-soft">Señales rápidas para validar si los totales del periodo son confiables.</p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${statusOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
               {statusOk ? <CheckCircleIcon className="h-4 w-4" /> : <ExclamationTriangleIcon className="h-4 w-4" />}
               {statusOk ? 'Sin observaciones' : 'Revisar datos'}
            </span>
         </div>

         <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-border-subtle bg-surface-1 p-3">
               <div className="flex items-center gap-1.5 text-xs font-semibold text-text-soft">
                  <span>Conciliación banco</span>
                  <InfoTip content="Porcentaje de movimientos bancarios del periodo que ya fueron conciliados con un documento." />
               </div>
               <div className="mt-1 text-lg font-bold text-heading">{ratioLabel}</div>
               <div className="mt-1 text-xs text-text-soft">{intFmt.format(Number(bank.pendingTransactions || 0))} movimientos pendientes</div>
            </div>
            {checks.map((item) => (
               <div key={item.label} className={`rounded-xl border p-3 ${item.warn ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-border-subtle bg-surface-1 text-heading'}`}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold opacity-75">
                     <span>{item.label}</span>
                     <InfoTip content={item.tooltip} />
                  </div>
                  <div className="mt-1 text-lg font-bold">{item.value}</div>
               </div>
            ))}
         </div>
      </section>
   );
}

function valuePercent(value, maxValue) {
   if (!maxValue) return 0;
   const numeric = Number(value || 0);
   return Math.max(0, Math.min(100, (numeric / maxValue) * 100));
}

function DailyBars({ items = [], granularity = 'day' }) {
   const maxValue = Math.max(
      0,
      ...items.map((item) => Number(item.sales || 0)),
      ...items.map((item) => Number(item.purchases || 0))
   );
   const hasMovements = items.some((item) => Number(item.sales || 0) || Number(item.purchases || 0));
   const maxAxis = maxValue || 1;
   const isYear = granularity === 'month';

   const linePoints = items.map((item, index) => ({
      x: ((index + 0.5) / (items.length || 1)) * 100,
      salesY: 100 - valuePercent(item.sales, maxAxis),
      purchasesY: 100 - valuePercent(item.purchases, maxAxis),
   }));
   const salesPolyline = linePoints.map((p) => `${p.x.toFixed(2)},${p.salesY.toFixed(2)}`).join(' ');
   const purchasesPolyline = linePoints.map((p) => `${p.x.toFixed(2)},${p.purchasesY.toFixed(2)}`).join(' ');

   return (
      <section className="rounded-2xl border border-border-subtle bg-bg-content p-5 shadow-soft">
         <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
               <h2 className="text-lg font-bold text-heading">Ingresos vs egresos {isYear ? 'mensuales' : 'diarios'}</h2>
               <p className="mt-1 text-sm text-text-soft">Comparación {isYear ? 'mensual' : 'diaria'} del periodo seleccionado.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-soft">
               <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Ventas</span>
               <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Compras</span>
            </div>
         </div>

         {!hasMovements ? (
            <div className="mt-6 flex h-64 items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-surface-1 text-sm font-medium text-text-soft">
               Sin movimientos para este periodo.
            </div>
         ) : (
            <div className="mt-6">
               <div className="flex gap-4">
                  <div className="hidden w-20 shrink-0 flex-col justify-between py-1 text-right text-xs font-semibold text-text-soft sm:flex">
                     <span>{compactClp(maxAxis)}</span>
                     <span>{compactClp(maxAxis / 2)}</span>
                     <span>$0</span>
                  </div>
                  <div className="min-w-0 flex-1 overflow-x-auto pb-2">
                     <div className={`relative ${isYear ? 'min-w-[520px]' : 'min-w-[760px]'}`}>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border-subtle/70" />
                        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border-subtle/50" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-6 h-px bg-border-subtle/70" />

                        <div className="relative grid h-72 items-end gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(18px, 1fr))` }}>
                           <svg
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                              className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-1.5rem)] w-full overflow-visible"
                           >
                              <polyline
                                 points={salesPolyline}
                                 fill="none"
                                 vectorEffect="non-scaling-stroke"
                                 strokeWidth="2"
                                 strokeLinejoin="round"
                                 strokeLinecap="round"
                                 className="text-emerald-500"
                                 stroke="currentColor"
                              />
                              <polyline
                                 points={purchasesPolyline}
                                 fill="none"
                                 vectorEffect="non-scaling-stroke"
                                 strokeWidth="2"
                                 strokeLinejoin="round"
                                 strokeLinecap="round"
                                 className="text-amber-500"
                                 stroke="currentColor"
                              />
                           </svg>
                           {items.map((item) => {
                              const result = Number(item.result || 0);
                              return (
                                 <div key={item.date} className="group relative flex h-full min-w-[18px] flex-col justify-end">
                                    <div className="pointer-events-none absolute left-1/2 top-2 z-20 hidden w-56 -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-content p-3 text-xs shadow-lg group-hover:block">
                                       <div className="font-bold text-heading">{item.date}</div>
                                       <div className="mt-2 space-y-1 text-text-soft">
                                          <div className="flex justify-between gap-3"><span>Ventas</span><strong className="text-emerald-600">{clp(item.sales)}</strong></div>
                                          <div className="flex justify-between gap-3"><span>Compras</span><strong className="text-amber-600">{clp(item.purchases)}</strong></div>
                                          <div className="flex justify-between gap-3 border-t border-border-subtle pt-1"><span>Resultado</span><strong className={result >= 0 ? 'text-emerald-600' : 'text-red-600'}>{clp(result)}</strong></div>
                                       </div>
                                    </div>
                                    <div className="relative h-[calc(100%-1.5rem)] w-full">
                                       <div
                                          className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-bg-content bg-emerald-500 shadow-sm transition-transform duration-150 group-hover:scale-125"
                                          style={{ bottom: `${valuePercent(item.sales, maxAxis)}%` }}
                                          title={`Ventas ${item.date}: ${clp(item.sales)}`}
                                       />
                                       <div
                                          className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-bg-content bg-amber-500 shadow-sm transition-transform duration-150 group-hover:scale-125"
                                          style={{ bottom: `${valuePercent(item.purchases, maxAxis)}%` }}
                                          title={`Compras ${item.date}: ${clp(item.purchases)}`}
                                       />
                                    </div>
                                    <div className="h-6 pt-2 text-center text-[11px] font-semibold text-text-soft">{item.label || item.day}</div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </section>
   );
}

export default function Home() {
   const { period, setPeriod } = usePeriod();
   const { isClient } = useAuth();
   const { entityId, ready, loading: loadingEntity } = useEntityRequired();
   const [summary, setSummary] = useState(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [yearMode, setYearMode] = useState(false);

   const maxMonth = useMemo(() => periodToYYYYMM({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
   }), []);
   const month = useMemo(() => periodToYYYYMM(period), [period]);
   const scope = yearMode ? 'year' : 'month';
   const titlePeriod = useMemo(() => periodLabel(period, yearMode), [period, yearMode]);

   useEffect(() => {
      if (month <= maxMonth) return;
      const [year, monthNumber] = maxMonth.split('-').map(Number);
      setPeriod({ year, month: monthNumber });
   }, [maxMonth, month, setPeriod]);

   useEffect(() => {
      if (!ready || !entityId) {
         setSummary(null);
         return undefined;
      }

      const controller = new AbortController();
      setLoading(true);
      setError('');

      getDashboardSummary({ entityId, month, scope, signal: controller.signal })
         .then(setSummary)
         .catch((err) => {
            if (err.name !== 'AbortError') setError(err.message || 'No se pudo cargar el dashboard');
         })
         .finally(() => setLoading(false));

      return () => controller.abort();
   }, [entityId, month, ready, scope]);

   if (!loadingEntity && !ready) {
      return <EntityRequiredNotice />;
   }

   const sales = summary?.sales || {};
   const purchases = summary?.purchases || {};
   const result = Number(summary?.result?.total || 0);
   const vatBalance = Number(summary?.vat?.balance || 0);
   const margin = Number(sales.total || 0) > 0 ? (result / Number(sales.total)) * 100 : 0;
   const daily = Array.isArray(summary?.daily) ? summary.daily : [];
   const granularity = summary?.granularity || (yearMode ? 'month' : 'day');
   const alerts = Array.isArray(summary?.alerts) ? summary.alerts : [];
   const comparison = summary?.comparison || {};
   const comparisonLabel = comparison.label;
   const composition = summary?.composition || {};
   const quality = summary?.quality || {};

   const handlePeriodChange = (value) => {
      if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return;
      const safeValue = value > maxMonth ? maxMonth : value;
      const [year, monthNumber] = safeValue.split('-').map(Number);
      setPeriod({ year, month: monthNumber });
   };

   return (
      <div className="animate-fade-in space-y-6">
         <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-brand/10 via-bg-content to-bg-content p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
               <div>
                  <h1 className="text-2xl font-bold text-heading">Panel de Control</h1>
                  <p className="text-text-soft">{yearMode ? `Resumen financiero del año ${titlePeriod}` : `Resumen financiero de ${titlePeriod}`} para la entidad activa.</p>
               </div>
               <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-bg-content/80 px-3 py-2 text-sm font-semibold text-text-soft backdrop-blur-sm sm:flex-row sm:items-center">
                  {loading && <ArrowPathIcon className="h-4 w-4 animate-spin text-brand" />}
                  <div className="flex items-center gap-2">
                     <label htmlFor="dashboard-period" className="whitespace-nowrap">Periodo</label>
                     <input
                        id="dashboard-period"
                        type="month"
                        value={month > maxMonth ? maxMonth : month}
                        max={maxMonth}
                        onChange={(event) => handlePeriodChange(event.target.value)}
                        className="h-8 rounded-xl border border-border-subtle bg-bg-content px-2 text-sm font-semibold text-text-main outline-none focus:ring-2 focus:ring-brand"
                     />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-1 py-1 text-sm font-semibold text-text-main">
                     <input
                        type="checkbox"
                        checked={yearMode}
                        onChange={(event) => setYearMode(event.target.checked)}
                        className="h-4 w-4 rounded border-border-subtle text-brand focus:ring-brand"
                     />
                     Ver año completo
                  </label>
               </div>
            </div>
         </div>

         {error && (
            <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm font-medium text-danger">
               {error}
            </div>
         )}

         <AlertsPanel alerts={alerts} />

         <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
               title={yearMode ? 'Ventas del año' : 'Ventas del mes'}
               value={clp(sales.total)}
               subtitle={`${intFmt.format(sales.count || 0)} documentos`}
               icon={BanknotesIcon}
               color="bg-emerald-500/10 text-emerald-600"
               accent="bg-emerald-500/60"
               tone="good"
               comparison={comparison.sales?.total}
               comparisonLabel={comparisonLabel}
               tooltip="Total de boletas y facturas de venta del periodo, ya descontando las notas de credito emitidas."
            />
            <StatCard
               title={yearMode ? 'Compras del año' : 'Compras del mes'}
               value={clp(purchases.total)}
               subtitle={`${intFmt.format(purchases.count || 0)} documentos`}
               icon={ShoppingCartIcon}
               color="bg-amber-500/10 text-amber-600"
               accent="bg-amber-500/60"
               comparison={comparison.purchases?.total}
               comparisonLabel={comparisonLabel}
               trendPolarity="inverse"
               tooltip="Total de facturas de compra del periodo, ya descontando las notas de credito recibidas."
            />
            <StatCard
               title="Resultado"
               value={clp(result)}
               subtitle={`Margen ${pct(margin)}`}
               icon={ArrowTrendingUpIcon}
               color={result >= 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-red-500/10 text-red-600'}
               accent={result >= 0 ? 'bg-blue-500/60' : 'bg-red-500/60'}
               tone={result >= 0 ? 'good' : 'bad'}
               comparison={comparison.result?.total}
               comparisonLabel={comparisonLabel}
               tooltip="Ventas menos compras del periodo. El margen es este resultado como porcentaje de las ventas."
            />
            <StatCard
               title={vatBalance >= 0 ? 'IVA por pagar' : 'IVA a favor'}
               value={clp(Math.abs(vatBalance))}
               subtitle={`Débito ${clp(summary?.vat?.debit)} / Crédito ${clp(summary?.vat?.credit)}`}
               icon={ReceiptPercentIcon}
               color={vatBalance >= 0 ? 'bg-violet-500/10 text-violet-600' : 'bg-emerald-500/10 text-emerald-600'}
               accent={vatBalance >= 0 ? 'bg-violet-500/60' : 'bg-emerald-500/60'}
               tone={vatBalance <= 0 ? 'good' : 'neutral'}
               comparison={comparison.vat?.balance}
               comparisonLabel={comparisonLabel}
               trendPolarity="inverse"
               tooltip="IVA debito (de tus ventas) menos IVA credito (de tus compras). Si es positivo, es lo que debes pagar al SII; si es negativo, queda a tu favor."
            />
         </div>

         {!isClient && <QualityPanel quality={quality} />}

         <CompositionPanel composition={composition} />

         <DailyBars items={daily} granularity={granularity} />

         <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border-subtle bg-bg-content p-5 shadow-soft">
               <h2 className="text-lg font-bold text-heading">Detalle comercial</h2>
               <div className="mt-4">
                  <DetailRow label="Ventas netas" value={clp(sales.net)} tooltip="Monto de ventas antes de IVA." />
                  <DetailRow label="Ventas exentas" value={clp(sales.exempt)} tooltip="Ventas que no pagan IVA (exentas)." />
                  <DetailRow label="IVA ventas" value={clp(sales.vat)} tooltip="IVA debito: el que cobraste a tus clientes." />
                  <DetailRow label="Total ventas" value={clp(sales.total)} tooltip="Neto + exento + IVA, ya descontando notas de credito." />
               </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-bg-content p-5 shadow-soft">
               <h2 className="text-lg font-bold text-heading">Detalle de compras e IVA</h2>
               <div className="mt-4">
                  <DetailRow label="Compras netas" value={clp(purchases.net)} tooltip="Monto de compras antes de IVA." />
                  <DetailRow label="Compras exentas" value={clp(purchases.exempt)} tooltip="Compras que no pagan IVA (exentas)." />
                  <DetailRow label="IVA compras" value={clp(purchases.vat)} tooltip="IVA credito: el que te cobraron tus proveedores." />
                  <DetailRow
                     label={vatBalance >= 0 ? 'IVA por pagar' : 'IVA a favor'}
                     value={clp(Math.abs(vatBalance))}
                     tooltip="IVA ventas menos IVA compras del periodo."
                  />
               </div>
            </section>
         </div>
      </div>
   );
}
