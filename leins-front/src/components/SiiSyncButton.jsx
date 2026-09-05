import { useState } from 'react';
import { useEntity } from '../context/EntityContext';
import { startSiiSync } from '../services/entitiesApi';
import { toast } from './Toaster';

const SII_SYNC_CONFIG = {
   invoices: {
      title: 'Facturas de compra',
      buttonLabel: 'Sincronizar compras',
   },
   boletas: {
      title: 'Boletas',
      buttonLabel: 'Sincronizar boletas',
   },
   'sales-invoices': {
      title: 'Facturas de venta',
      buttonLabel: 'Sincronizar facturas',
   },
   honorarios: {
      title: 'Boletas de honorarios',
      buttonLabel: 'Sincronizar honorarios',
   },
};

export default function SiiSyncButton({ type, onSyncSuccess, label, documentTypeOptions = [], directions = null }) {
   const { entityId } = useEntity();
   const config = SII_SYNC_CONFIG[type] || { title: 'Documentos SII', buttonLabel: 'Sincronizar SII' };
   const normalizedDocumentTypeOptions = Array.isArray(documentTypeOptions)
      ? documentTypeOptions
         .map((option) => ({ value: String(option.value), label: option.label }))
         .filter((option) => option.value && option.label)
      : [];
   const hasDocumentTypeOptions = normalizedDocumentTypeOptions.length > 0;

   const [isOpen, setIsOpen] = useState(false);
   const [loading, setLoading] = useState(false);

   const now = new Date();
   const [year, setYear] = useState(now.getFullYear());
   const [month, setMonth] = useState(now.getMonth() + 1);
   const [selectedDocumentTypes, setSelectedDocumentTypes] = useState(() => (
      normalizedDocumentTypeOptions.map((option) => option.value)
   ));

   const toggleDocumentType = (value) => {
      setSelectedDocumentTypes((current) => (
         current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value]
      ));
   };

   const handleSync = async () => {
      if (!entityId) return;
      if (hasDocumentTypeOptions && selectedDocumentTypes.length === 0) {
         toast({ type: 'warning', title: 'Seleccion requerida', message: 'Selecciona al menos un tipo de documento.' });
         return;
      }
      setLoading(true);

      try {
         const result = await startSiiSync({
            entityId,
            year,
            month,
            type,
            documentTypes: hasDocumentTypeOptions
               ? selectedDocumentTypes.map((value) => Number(value)).filter(Number.isFinite)
               : null,
            directions,
         });

         toast({
            type: result?.duplicated ? 'warning' : 'info',
            title: result?.duplicated ? 'Proceso ya iniciado' : 'Proceso iniciado',
            message: result?.duplicated
               ? `Ya existe una sincronización en proceso para este periodo. Job ${result.jobId}.`
               : result?.jobId ? `Job ${result.jobId} creado. Puedes revisar el historial.` : 'El proceso corre en segundo plano.',
         });
         setIsOpen(false);
         onSyncSuccess?.(result);
      } catch (error) {
         toast({ type: 'error', title: 'Error', message: error.message });
      } finally {
         setLoading(false);
      }
   };

   return (
      <>
         <button
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
         >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {label || config.buttonLabel}
         </button>

         {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
               <div className="bg-bg-content rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border-subtle">
                  <h3 className="text-lg font-bold text-heading mb-4">Sincronizar {config.title}</h3>

                  <p className="text-sm text-text-soft mb-4">
                     Este proceso se conecta al SII y descarga los documentos. Puede tomar varios minutos.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                     <div>
                        <label className="block text-xs font-medium text-text-soft mb-1">Año</label>
                        <input
                           type="number"
                           value={year}
                           onChange={(e) => setYear(e.target.value)}
                           className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface-1 text-text-main"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-text-soft mb-1">Mes</label>
                        <select
                           value={month}
                           onChange={(e) => setMonth(e.target.value)}
                           className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-surface-1 text-text-main appearance-none"
                        >
                           <option value="ALL">Todo el año</option>
                           {[...Array(12)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>{i + 1}</option>
                           ))}
                        </select>
                     </div>
                  </div>

                  {hasDocumentTypeOptions && (
                     <div className="mb-6">
                        <label className="block text-xs font-medium text-text-soft mb-2">Tipo documento</label>
                        <div className="grid gap-2">
                           {normalizedDocumentTypeOptions.map((option) => (
                              <label
                                 key={option.value}
                                 className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-text-main"
                              >
                                 <input
                                    type="checkbox"
                                    checked={selectedDocumentTypes.includes(option.value)}
                                    onChange={() => toggleDocumentType(option.value)}
                                    className="h-4 w-4 rounded border-border-subtle text-brand focus:ring-brand"
                                 />
                                 <span>{option.label}</span>
                              </label>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className="flex justify-end gap-2">
                     <button
                        onClick={() => setIsOpen(false)}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-text-main hover:bg-surface-2 rounded-xl transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={handleSync}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-xl hover:bg-brand-strong transition-colors disabled:opacity-50 flex items-center gap-2"
                     >
                        {loading && <span className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />}
                        {loading ? 'Iniciando...' : 'Iniciar'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </>
   );
}
