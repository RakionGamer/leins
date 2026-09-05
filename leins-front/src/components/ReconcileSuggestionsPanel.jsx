import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { fetchSuggestionsFast, reconcileOne, reconcileBulk, listReconciliations, unreconcile } from '../services/reconcileApi';
import { toast } from '../components/Toaster';
import { getSiiDocumentTypeLabel, getSiiDocumentTypeShortLabel } from '../utils/siiConstants';

function fmt(n) {
   if (n == null) return '-';
   return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0 }).format(Number(n));
}

function isoDate(d) {
   if (!d) return '-';
   const dt = typeof d === 'string' ? new Date(d) : d;
   return dt.toISOString().slice(0, 10);
}

function HoverTip({ label = 'Detalle', content }) {
   const triggerRef = useRef(null);
   const [open, setOpen] = useState(false);
   const [position, setPosition] = useState({ top: 0, left: 0 });

   const updatePosition = useCallback(() => {
      const node = triggerRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const tooltipWidth = 320;
      const estimatedHeight = 170;
      const margin = 12;

      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));

      let top = rect.bottom + 8;
      if (top + estimatedHeight > window.innerHeight - margin) {
         top = Math.max(margin, rect.top - estimatedHeight - 8);
      }

      setPosition({ top, left });
   }, []);

   useEffect(() => {
      if (!open) return undefined;
      updatePosition();

      const onViewportChange = () => updatePosition();
      window.addEventListener('scroll', onViewportChange, true);
      window.addEventListener('resize', onViewportChange);

      return () => {
         window.removeEventListener('scroll', onViewportChange, true);
         window.removeEventListener('resize', onViewportChange);
      };
   }, [open, updatePosition]);

   if (!content) return null;

   return (
      <span
         ref={triggerRef}
         className="relative inline-flex"
         onMouseEnter={() => setOpen(true)}
         onMouseLeave={() => setOpen(false)}
         onFocus={() => setOpen(true)}
         onBlur={() => setOpen(false)}
      >
         <span className="badge badge-neutral cursor-help select-none hover:border-strong hover:text-[var(--heading)] transition-colors">
            {label}
         </span>
         {open && createPortal(
            <span
               className="pointer-events-none rounded-xl border border-strong bg-[var(--bg-content)] p-2.5 text-xs text-main shadow-xl whitespace-pre-line"
               style={{
                  position: 'fixed',
                  top: position.top,
                  left: position.left,
                  width: 320,
                  zIndex: 99999,
               }}
            >
               {content}
            </span>,
            document.body
         )}
      </span>
   );
}

function candidateTone(idx) {
   if (idx === 0) {
      return {
         card: 'border-strong bg-success-soft shadow-sm suggestion-principal-card',
         rank: 'badge-success',
      };
   }
   if (idx === 1) {
      return {
         card: 'border-[var(--border-strong)] bg-[color:rgba(var(--brand-rgb),0.08)]',
         rank: 'badge-neutral',
      };
   }
   return {
      card: 'border-subtle bg-surface-1',
      rank: 'badge-neutral',
   };
}

function confidenceLabel(value) {
   if (value === 'high') return 'Confianza alta';
   if (value === 'medium') return 'Confianza media';
   return 'Confianza baja';
}

function confidenceBadge(value) {
   if (value === 'high') return 'badge-success';
   if (value === 'medium') return 'badge-warning';
   return 'badge-neutral';
}

function confidenceSummary(value, reasons = []) {
   const reasonSet = new Set(Array.isArray(reasons) ? reasons : []);
   const hasExactAmount = reasonSet.has('suma=exacta') || reasonSet.has('monto=exacto');
   const hasCounterparty = reasonSet.has('mismo-rut')
      || reasonSet.has('misma-contraparte')
      || reasonSet.has('rut-emisor-en-glosa')
      || reasonSet.has('nombre-en-glosa')
      || reasonSet.has('folio-en-glosa')
      || reasonSet.has('historial-contraparte');

   if (value === 'high') {
      return hasExactAmount && hasCounterparty
         ? 'Muy probable: monto exacto y contraparte consistente.'
         : 'Muy probable: varios criterios calzan bien.';
   }
   if (value === 'medium') {
      return hasCounterparty
         ? 'Revisar: hay señal de contraparte, pero conviene validar montos.'
         : 'Revisar: monto y fecha calzan, sin señal fuerte de contraparte.';
   }
   return 'Baja certeza: revisar documentos antes de conciliar.';
}

function reasonLabel(reason) {
   const text = String(reason || '');
   const labels = {
      'suma=exacta': 'Suma exacta',
      'monto=exacto': 'Monto exacto',
      'mismo-rut': 'Mismo RUT',
      'misma-contraparte': 'Misma contraparte',
      'mismo-dia': 'Mismo dia',
      'rut-emisor-en-glosa': 'RUT en transferencia',
      'nombre-en-glosa': 'Nombre en transferencia',
      'folio-en-glosa': 'Folio en glosa',
      'historial-contraparte': 'Historial previo',
   };

   if (labels[text]) return labels[text];
   if (text.startsWith('fecha+/-')) return `Fecha cercana (${text.replace('fecha+/-', '+/-')})`;
   if (text.startsWith('monto~+/-')) return `Monto cercano (${text.replace('monto~+/-', '+/-$')})`;
   if (text.startsWith('suma~+/-')) return `Suma cercana (${text.replace('suma~+/-', '+/-$')})`;
   return text;
}

function formatReasons(reasons) {
   return Array.isArray(reasons) && reasons.length
      ? reasons.map(reasonLabel).join(' | ')
      : 'Sin criterios';
}

function criteriaDetail({ date, total, amount, diff, confidence, reasons }) {
   return [
      confidence ? confidenceSummary(confidence, reasons) : null,
      date ? `Fecha ${isoDate(date)}` : null,
      total != null ? `Total $${fmt(total)}` : null,
      amount != null ? `Monto $${fmt(amount)}` : null,
      diff != null ? `Diferencia $${fmt(Math.abs(Number(diff || 0)))}` : null,
      ...(Array.isArray(reasons) ? reasons.map(reasonLabel) : []),
   ].filter(Boolean).join('\n');
}

function groupPairs(row, group) {
   const txId = row?.bank_tx?.id;
   if (!txId || !Array.isArray(group?.documents)) return [];

   return group.documents
      .map((doc) => ({
         bank_transaction_id: txId,
         document_id: Number(doc.id),
         amount: Number(doc.amount ?? doc.remaining_amount ?? 0),
      }))
      .filter((pair) => pair.bank_transaction_id && pair.document_id && pair.amount > 0);
}

function groupDetail(group) {
   const docs = Array.isArray(group?.documents) ? group.documents : [];
   const lines = docs.map((doc) => (
      `${getSiiDocumentTypeShortLabel(doc.doc_type_code)} folio ${doc.folio || doc.id} - ${doc.counterparty_rut || '-'} - ${isoDate(doc.issue_date)} - $${fmt(doc.amount ?? doc.remaining_amount)}`
   ));

   return [
      `Score: ${Number(group?.score || 0).toFixed(3)}`,
      `Confianza: ${confidenceLabel(group?.confidence)}`,
      `Total: $${fmt(group?.total_amount)}`,
      `Diferencia: $${fmt(Math.abs(Number(group?.diff_amount || 0)))}`,
      `Criterios: ${formatReasons(group?.reasons)}`,
      '',
      ...lines,
   ].join('\n');
}

export default function ReconcileSuggestionsPanel({
   entityId,
   accountId,
   type,
   dateFrom,
   dateTo,
   daysWindow = 3,
   onApplied
}) {
   const queryClient = useQueryClient();
   const [pageSize, setPageSize] = useState(20);
   const [page, setPage] = useState(0);
   const [bulk, setBulk] = useState(new Map());
   const [pendingGroup, setPendingGroup] = useState(null);

   const { data, isLoading, isFetching, isError, error } = useQuery({
      queryKey: ['reconcileSuggestions', { entityId, accountId, type, dateFrom, dateTo, daysWindow, page, pageSize }],
      queryFn: ({ signal }) => {
         const params = {
            entityId,
            type,
            dateFrom,
            dateTo,
            daysWindow,
            limit: pageSize,
            offset: page * pageSize,
            signal
         };
         if (accountId) params.accountId = accountId;
         return fetchSuggestionsFast(params);
      },
      enabled: !!entityId,
      keepPreviousData: true,
      // si la busqueda se pasa del tope de tiempo del servidor, preferimos fallar rapido
      // y mostrar el error en vez de reintentar varias veces y quedar "pegado" cargando
      retry: 1
   });

   const rows = useMemo(() => (
      (data?.rows || []).filter((row) => (
         (row?.candidates || []).length > 0 || (row?.candidate_groups || []).length > 0
      ))
   ), [data?.rows]);
   const total = Number(data?.total || 0);
   const hasMore = Boolean(data?.has_more);
   const isEstimated = Boolean(data?.is_estimated);
   const bulkPairsCount = useMemo(() => (
      Array.from(bulk.values()).reduce((sum, item) => sum + (Array.isArray(item?.pairs) ? item.pairs.length : 0), 0)
   ), [bulk]);

   useEffect(() => {
      const next = new Map();
      rows.forEach((r) => {
         const tx = r.bank_tx;
         const bestGroup = r.candidate_groups?.[0];
         const top = r.candidates?.[0];
         if (!tx) return;

         if (bestGroup) {
            const pairs = groupPairs(r, bestGroup);
            if (pairs.length) {
               next.set(tx.id, { kind: 'group', pairs, label: `${pairs.length} docs` });
               return;
            }
         }

         if (top) {
            next.set(tx.id, {
               kind: 'single',
               pairs: [{ bank_transaction_id: tx.id, document_id: top.id }],
               label: '1 doc',
            });
         }
      });
      setBulk(next);
   }, [rows]);

   const recOneMut = useMutation({
      mutationFn: (payload) => reconcileOne(payload),
      onSuccess: () => {
         toast.success('Conciliado correctamente');
         queryClient.invalidateQueries({ queryKey: ['reconcileSuggestions'] });
         if (onApplied) onApplied();
      },
      onError: (err) => toast.error(err.message || 'Error al conciliar')
   });

   const recBulkMut = useMutation({
      mutationFn: (pairs) => reconcileBulk({ entityId, pairs, method: 'suggested' }),
      onSuccess: () => {
         toast.success('Conciliacion masiva exitosa');
         setPendingGroup(null);
         setBulk(new Map());
         queryClient.invalidateQueries({ queryKey: ['reconcileSuggestions'] });
         if (onApplied) onApplied();
      },
      onError: (err) => toast.error(err.message || 'Error masivo')
   });

   const [linksFor, setLinksFor] = useState(null);
   const { data: linksData, isLoading: loadingLinks } = useQuery({
      queryKey: ['reconciliations', entityId, linksFor],
      queryFn: () => listReconciliations({ entityId, bank_transaction_id: linksFor, limit: 100, offset: 0 }),
      enabled: !!linksFor
   });
   const links = linksData?.rows || [];

   const undoMut = useMutation({
      mutationFn: ({ id, kind }) => unreconcile({ id, entityId, kind }),
      onSuccess: () => {
         toast.success('Conciliacion deshecha');
         queryClient.invalidateQueries({ queryKey: ['reconciliations', entityId, linksFor] });
         queryClient.invalidateQueries({ queryKey: ['reconcileSuggestions'] });
         if (onApplied) onApplied();
      },
      onError: (err) => toast.error(err.message || 'Error al deshacer')
   });

   const doReconcileOne = (row, cand, amountStr) => {
      const payload = { entityId, bank_transaction_id: row.bank_tx.id, document_id: cand.id };
      const v = amountStr != null && String(amountStr).trim() !== '' ? Number(amountStr) : null;
      if (v != null) payload.amount = v;
      recOneMut.mutate(payload);
   };

   const doReconcileGroup = (row, group) => {
      const pairs = groupPairs(row, group);
      if (!pairs.length) return toast.error('El grupo no tiene montos pendientes para conciliar');
      setPendingGroup({ row, group, pairs });
   };

   const confirmPendingGroup = () => {
      if (!pendingGroup?.pairs?.length) return;
      recBulkMut.mutate(pendingGroup.pairs);
   };

   const doReconcileBest = (row) => {
      const bestGroup = row.candidate_groups?.[0];
      if (bestGroup) return doReconcileGroup(row, bestGroup);

      const top = row.candidates?.[0];
      if (top) doReconcileOne(row, top, null);
   };

   const doBulk = () => {
      if (bulk.size === 0) return;
      const pairs = Array.from(bulk.values()).flatMap((item) => item.pairs || []);
      if (!pairs.length) return;
      if (window.confirm(`Seguro que deseas conciliar ${pairs.length} aplicacion(es) en ${bulk.size} movimiento(s)?`)) {
         recBulkMut.mutate(pairs);
      }
   };

   const undoLink = (id, kind) => {
      if (window.confirm(`Deshacer conciliacion #${id}?`)) {
         undoMut.mutate({ id, kind });
      }
   };

   const isBusy = isLoading || recOneMut.isPending || recBulkMut.isPending;

   return (
      <div className="mt-4 space-y-3">
         <section className="card relative p-4 md:p-5">
            <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top_right,rgba(var(--brand-rgb),0.16),transparent_45%)]" />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
               <div>
                  <div className="text-sm font-semibold text-[var(--heading)]">Sugerencias de conciliacion</div>
                  <div className="text-xs text-text-soft mt-1">
                     {isEstimated ? `Resultados en pagina: ${fmt(rows.length)}` : `Resultados: ${fmt(total)}`}
                     {isFetching && <span className="ml-2 animate-pulse text-brand">actualizando...</span>}
                  </div>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-neutral">Top 3 por movimiento</span>
                  <HoverTip
                     label="Como funciona"
                     content={'Mostramos grupos de documentos cuando la suma calza con el movimiento y tambien 3 candidatos individuales por score.\nPuedes conciliar uno por uno o en bloque.'}
                  />
                  <button
                     className="btn btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
                     disabled={isBusy || bulk.size === 0}
                     onClick={doBulk}
                  >
                     Conciliar sugeridas ({bulkPairsCount})
                  </button>
               </div>
            </div>
         </section>

         <section className="space-y-3">
            {isError ? (
               <div className="card p-6 text-sm text-red-700 bg-red-50 border border-red-200">
                  {error?.message || 'No se pudieron cargar las sugerencias.'}
                  {' '}Prueba acotar el rango de fechas o filtrar por una cuenta bancaria especifica.
               </div>
            ) : (!isLoading && rows.length === 0) ? (
               <div className="card p-6 text-sm text-text-soft">No hay sugerencias para los filtros seleccionados.</div>
            ) : (
               rows.map((row) => {
                  const tx = row.bank_tx;
                  const groups = row.candidate_groups || [];
                  const top = row.candidates?.[0];
                  const hasBest = groups.length > 0 || Boolean(top);
                  return (
                     <article key={tx.id} className="card relative p-4 md:p-5 lg:p-6 border-strong shadow-[0_10px_26px_rgba(0,0,0,0.08)]">
                        <div className="absolute inset-0 opacity-60 bg-[linear-gradient(120deg,rgba(var(--brand-rgb),0.08),transparent_35%)]" />
                        <div className="relative">
                           <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                 <div className="text-base font-semibold text-[var(--heading)] leading-snug truncate" title={tx.description || '(sin descripcion)'}>
                                    {tx.description || '(sin descripcion)'}
                                 </div>
                                 <div className="flex flex-wrap gap-1.5 mt-2">
                                    <span className="badge badge-neutral">{isoDate(tx.issued_at)}</span>
                                    <span className="badge badge-neutral">TX #{tx.id}</span>
                                    <span className="badge badge-neutral">Saldo ${fmt(tx.remaining_amount)}</span>
                                    <HoverTip label="Glosa" content={tx.description || '(sin descripcion)'} />
                                 </div>
                                 <div className="mt-2">
                                    <button
                                       className="text-xs text-brand underline underline-offset-2 hover:opacity-80"
                                       onClick={() => setLinksFor(tx.id)}
                                    >
                                       Ver aplicaciones
                                    </button>
                                 </div>
                              </div>

                              <div className="flex flex-col gap-2 lg:items-end">
                                 <div className="text-sm text-text-soft">Monto movimiento</div>
                                 <div className="text-xl font-bold text-[var(--heading)]">${fmt(tx.amount)}</div>
                                 {hasBest ? (
                                    <button
                                       className="btn btn-primary w-full lg:w-auto px-4 py-2 text-sm disabled:opacity-50"
                                       disabled={isBusy}
                                       onClick={() => doReconcileBest(row)}
                                    >
                                       {groups.length ? 'Conciliar mejor grupo' : 'Conciliar mejor'}
                                    </button>
                                 ) : (
                                    <span className="text-xs text-text-soft">Sin accion</span>
                                 )}
                              </div>
                           </div>

                           {groups.length > 0 && (
                              <div className="mt-4">
                                 <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <div className="text-xs font-semibold uppercase text-text-soft">Calces multiples</div>
                                    <span className="badge reconcile-group-kind">Suma de documentos</span>
                                 </div>
                                 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {groups.map((group, idx) => {
                                       const pairs = groupPairs(row, group);
                                       return (
                                          <div key={`${tx.id}-group-${idx}`} className="card-soft reconcile-group-card p-3 md:p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
                                             <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                   <div className="font-semibold text-[var(--heading)]">
                                                      Grupo #{idx + 1} - {group.documents_count || pairs.length} documentos
                                                   </div>
                                                   <div className="text-xs text-text-soft mt-1">
                                                      Total ${fmt(group.total_amount)} - Dif. ${fmt(Math.abs(Number(group.diff_amount || 0)))}
                                                   </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                   <span className={idx === 0 ? 'badge reconcile-group-rank' : 'badge badge-neutral'}>{idx === 0 ? 'Mejor' : `#${idx + 1}`}</span>
                                                   <span className={`badge ${confidenceBadge(group.confidence)}`}>{confidenceLabel(group.confidence)}</span>
                                                   <span className="badge badge-neutral">{Number(group.score || 0).toFixed(3)}</span>
                                                </div>
                                             </div>

                                             <div className="mt-3 space-y-1.5">
                                                {(group.documents || []).slice(0, 4).map((doc) => (
                                                   <div key={doc.id} className="flex items-center justify-between gap-2 text-xs">
                                                      <span className="truncate text-[var(--heading)]" title={`${getSiiDocumentTypeLabel(doc.doc_type_code)} - Folio ${doc.folio || doc.id}`}>
                                                         {getSiiDocumentTypeShortLabel(doc.doc_type_code)} {doc.folio || doc.id}
                                                      </span>
                                                      <span className="shrink-0 text-text-soft">${fmt(doc.amount ?? doc.remaining_amount)}</span>
                                                   </div>
                                                ))}
                                                {(group.documents || []).length > 4 && (
                                                   <div className="text-xs text-text-soft">+{group.documents.length - 4} documento(s)</div>
                                                )}
                                             </div>

                                             <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <HoverTip
                                                   label="Criterios"
                                                   content={criteriaDetail({
                                                      total: group.total_amount,
                                                      diff: group.diff_amount,
                                                      confidence: group.confidence,
                                                      reasons: group.reasons,
                                                   })}
                                                />
                                                <HoverTip label="Detalle grupo" content={groupDetail(group)} />
                                                <button
                                                   className="btn btn-outline reconcile-group-action px-3 py-1.5 text-xs disabled:opacity-50"
                                                   disabled={isBusy || pairs.length === 0}
                                                   onClick={() => doReconcileGroup(row, group)}
                                                >
                                                   Conciliar grupo
                                                </button>
                                             </div>
                                          </div>
                                       );
                                    })}
                                 </div>
                              </div>
                           )}

                           <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {row.candidates && row.candidates.map((c, idx) => {
                                 const tone = candidateTone(idx);
                                 return (
                                    <div key={c.id} className={`card-soft p-3 md:p-4 ${tone.card} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md`}>
                                       <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                             <div className="font-semibold text-[var(--heading)] truncate" title={`${getSiiDocumentTypeLabel(c.doc_type_code)} - Folio ${c.folio || '-'}`}>
                                                {getSiiDocumentTypeShortLabel(c.doc_type_code)} - Folio {c.folio || '-'}
                                             </div>
                                             <div className="text-xs text-text-soft mt-1 truncate" title={c.counterparty_rut || '-'}>
                                                {c.counterparty_rut || '-'}
                                             </div>
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                             <span className={`badge ${tone.rank}`}>#{idx + 1}</span>
                                             <span className={`badge ${confidenceBadge(c.confidence)}`}>{confidenceLabel(c.confidence)}</span>
                                             <span className="badge badge-neutral">{Number(c.score).toFixed(3)}</span>
                                          </div>
                                       </div>

                                       <div className="flex flex-wrap gap-1.5 mt-2">
                                          <HoverTip
                                             label="Criterios"
                                             content={criteriaDetail({
                                                date: c.issue_date,
                                                total: c.total_amount,
                                                confidence: c.confidence,
                                                reasons: c.reasons,
                                             })}
                                          />
                                          <HoverTip
                                             label="Detalle doc."
                                             content={`Documento: ${getSiiDocumentTypeLabel(c.doc_type_code)} / Folio ${c.folio || '-'}\nRUT: ${c.counterparty_rut || '-'}\nFecha: ${isoDate(c.issue_date)}\nScore: ${Number(c.score).toFixed(3)}\nConfianza: ${confidenceLabel(c.confidence)}\nTotal: ${fmt(c.total_amount)}\nSaldo: ${fmt(c.remaining_amount)}\nCriterios: ${formatReasons(c.reasons)}`}
                                          />
                                       </div>

                                       <div className="flex flex-wrap items-center gap-2 mt-3">
                                          <input
                                             type="number"
                                             placeholder="monto opcional"
                                             className="input w-36 text-xs"
                                             id={`amt-${tx.id}-${c.id}`}
                                          />
                                          <button
                                             className="btn btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
                                             disabled={isBusy}
                                             onClick={() => {
                                                const v = document.getElementById(`amt-${tx.id}-${c.id}`)?.value;
                                                doReconcileOne(row, c, v);
                                             }}
                                          >
                                             Conciliar
                                          </button>
                                          {idx === 0 && (
                                             <span className="badge badge-success inline-flex items-center gap-1.5">
                                                <span className="relative flex h-2 w-2">
                                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-70" />
                                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
                                                </span>
                                                Recomendada
                                             </span>
                                          )}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     </article>
                  );
               })
            )}
         </section>

         <section className="card p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
               <div className="text-sm text-text-soft">
                  {isEstimated ? `Pagina ${page + 1}` : `Pagina ${page + 1} de ${Math.max(1, Math.ceil(total / pageSize))}`}
               </div>
               <div className="flex flex-wrap items-center gap-2">
                  <button
                     className="btn btn-outline px-3 py-1.5 text-sm disabled:opacity-50"
                     disabled={page === 0 || isBusy}
                     onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                     Anterior
                  </button>
                  <button
                     className="btn btn-outline px-3 py-1.5 text-sm disabled:opacity-50"
                     disabled={isBusy || (isEstimated ? !hasMore : (page + 1) * pageSize >= total)}
                     onClick={() => setPage((p) => p + 1)}
                  >
                     Siguiente
                  </button>
                  <label className="text-xs text-text-soft ml-1">Filas</label>
                  <select
                     className="input text-sm py-1.5"
                     value={pageSize}
                     onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  >
                     <option value={20}>20</option>
                     <option value={50}>50</option>
                     <option value={100}>100</option>
                     <option value={200}>200</option>
                  </select>
               </div>
            </div>
         </section>

         {linksFor != null && (
            <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setLinksFor(null)}>
               <div className="bg-bg-content rounded-xl shadow-xl w-[95vw] max-w-4xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-bg-content">
                     <div className="font-semibold text-heading">Historial de tx #{linksFor}</div>
                     <button className="text-sm underline" onClick={() => setLinksFor(null)}>Cerrar</button>
                  </div>
                  <div className="p-4">
                     {loadingLinks ? (
                        <div className="p-4 animate-pulse">Cargando...</div>
                     ) : (!links || links.length === 0) ? (
                        <div className="text-sm text-text-soft">No se encontraron conciliaciones previas.</div>
                     ) : (
                        <table className="min-w-full text-sm">
                           <thead className="table-head text-heading">
                              <tr>
                                 <th className="text-left p-2">#</th>
                                 <th className="text-left p-2">Documento</th>
                                 <th className="text-left p-2">Monto</th>
                                 <th className="text-left p-2">Acciones</th>
                              </tr>
                           </thead>
                           <tbody>
                              {links.map((l) => {
                                 const isBankMatch = l.kind === 'bank_transaction';
                                 return (
                                    <tr key={`${l.kind || 'document'}-${l.id}`} className="border-t border-border-subtle">
                                       <td className="p-2">{l.id}</td>
                                       <td className="p-2">
                                          {isBankMatch
                                             ? `Cruce con mov. ${l.folio || `MOV-${l.target_bank_transaction_id}`} - ${l.bank_description || '-'} - ${isoDate(l.issue_date)}`
                                             : `${getSiiDocumentTypeShortLabel(l.doc_type_code)} - folio ${l.folio} - ${l.counterparty_rut} - ${isoDate(l.issue_date)}`}
                                       </td>
                                       <td className="p-2">${fmt(l.amount_applied)}</td>
                                       <td className="p-2">
                                          <button
                                             className="btn px-3 py-1 border-danger text-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
                                             onClick={() => undoLink(l.id, l.kind)}
                                             disabled={undoMut.isPending}
                                          >
                                             Deshacer
                                          </button>
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     )}
                  </div>
               </div>
            </div>
         )}

         {pendingGroup && createPortal(
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 p-3" onClick={() => setPendingGroup(null)}>
               <div
                  className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-content)] text-[var(--text-main)] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-content)] p-4 md:flex-row md:items-start md:justify-between">
                     <div>
                        <div className="text-lg font-semibold text-[var(--heading)]">Revisar grupo antes de conciliar</div>
                        <div className="mt-1 text-sm text-text-soft">
                           {confidenceSummary(pendingGroup.group.confidence, pendingGroup.group.reasons)}
                        </div>
                     </div>
                     <button className="btn btn-outline px-3 py-1.5 text-sm" onClick={() => setPendingGroup(null)}>
                        Cerrar
                     </button>
                  </div>

                  <div className="max-h-[calc(88vh-84px)] overflow-auto p-4">
                     <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
                           <div className="text-xs font-semibold uppercase text-text-soft">Movimiento bancario</div>
                           <div className="mt-2 text-sm font-semibold text-[var(--heading)]">{pendingGroup.row.bank_tx.description || '(sin descripcion)'}</div>
                           <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="badge badge-neutral">{isoDate(pendingGroup.row.bank_tx.issued_at)}</span>
                              <span className="badge badge-neutral">TX #{pendingGroup.row.bank_tx.id}</span>
                           </div>
                           <div className="mt-3 text-2xl font-bold text-[var(--heading)]">${fmt(pendingGroup.row.bank_tx.amount)}</div>
                           <div className="mt-1 text-xs text-text-soft">Saldo ${fmt(pendingGroup.row.bank_tx.remaining_amount)}</div>
                        </section>

                        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
                           <div className="text-xs font-semibold uppercase text-text-soft">Grupo sugerido</div>
                           <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                 <div className="text-xs text-text-soft">Documentos</div>
                                 <div className="font-semibold text-[var(--heading)]">{pendingGroup.group.documents_count || pendingGroup.pairs.length}</div>
                              </div>
                              <div>
                                 <div className="text-xs text-text-soft">Diferencia</div>
                                 <div className="font-semibold text-[var(--heading)]">${fmt(Math.abs(Number(pendingGroup.group.diff_amount || 0)))}</div>
                              </div>
                              <div>
                                 <div className="text-xs text-text-soft">Suma</div>
                                 <div className="font-semibold text-[var(--heading)]">${fmt(pendingGroup.group.total_amount)}</div>
                              </div>
                              <div>
                                 <div className="text-xs text-text-soft">Score</div>
                                 <div className="font-semibold text-[var(--heading)]">{Number(pendingGroup.group.score || 0).toFixed(3)}</div>
                              </div>
                           </div>
                           <div className="mt-3 flex flex-wrap gap-1.5">
                              <span className={`badge ${confidenceBadge(pendingGroup.group.confidence)}`}>{confidenceLabel(pendingGroup.group.confidence)}</span>
                              {(pendingGroup.group.reasons || []).slice(0, 5).map((reason) => (
                                 <span key={reason} className="badge badge-neutral">{reasonLabel(reason)}</span>
                              ))}
                           </div>
                        </section>

                        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
                           <div className="text-xs font-semibold uppercase text-text-soft">Revision</div>
                           <div className="mt-2 text-sm text-[var(--text-main)]">
                              Confirma que los documentos correspondan al mismo pago antes de aplicar la conciliacion.
                           </div>
                           <div className="mt-3 flex flex-col gap-2">
                              <button
                                 className="btn btn-primary w-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                 disabled={recBulkMut.isPending}
                                 onClick={confirmPendingGroup}
                              >
                                 {recBulkMut.isPending ? 'Conciliando...' : `Conciliar grupo (${pendingGroup.pairs.length})`}
                              </button>
                              <button
                                 className="btn btn-outline w-full px-4 py-2 text-sm"
                                 disabled={recBulkMut.isPending}
                                 onClick={() => setPendingGroup(null)}
                              >
                                 Cancelar
                              </button>
                           </div>
                        </section>
                     </div>

                     <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                        <table className="min-w-full text-sm">
                           <thead className="table-head text-[var(--heading)]">
                              <tr>
                                 <th className="p-2 text-left">Tipo</th>
                                 <th className="p-2 text-left">Folio</th>
                                 <th className="p-2 text-left">Fecha</th>
                                 <th className="p-2 text-left">Contraparte</th>
                                 <th className="p-2 text-right">Monto</th>
                              </tr>
                           </thead>
                           <tbody>
                              {(pendingGroup.group.documents || []).map((doc) => (
                                 <tr key={doc.id} className="border-t border-[var(--border-subtle)]">
                                    <td className="p-2">{getSiiDocumentTypeShortLabel(doc.doc_type_code)}</td>
                                    <td className="p-2">{doc.folio || doc.id}</td>
                                    <td className="p-2">{isoDate(doc.issue_date)}</td>
                                    <td className="p-2">
                                       <div className="font-medium text-[var(--heading)]">{doc.counterparty_name || '-'}</div>
                                       <div className="text-xs text-text-soft">{doc.counterparty_rut || '-'}</div>
                                    </td>
                                    <td className="p-2 text-right">${fmt(doc.amount ?? doc.remaining_amount)}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            </div>,
            document.body
         )}
      </div>
   );
}
