// src/components/PdfViewerModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
   DocumentTextIcon,
   ArrowTopRightOnSquareIcon,
   ArrowDownTrayIcon,
   ArrowPathIcon,
   ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function PdfViewerModal({
   isOpen,
   onClose,
   pdfUrl,
   title = 'Visor de PDF',
   subtitle = null,
   downloadFilename = 'documento.pdf',
}) {
   const [blobUrl, setBlobUrl] = useState(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState(null);

   useEffect(() => {
      if (!isOpen || !pdfUrl) {
         setBlobUrl(null);
         setError(null);
         setLoading(false);
         return;
      }

      let active = true;
      let createdBlobUrl = null;

      const fetchPdfBlob = async () => {
         setLoading(true);
         setError(null);
         try {
            const res = await fetch(pdfUrl, { mode: 'cors' });
            if (!res.ok) {
               throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
            }
            const blob = await res.blob();
            if (!active) return;
            createdBlobUrl = URL.createObjectURL(blob);
            setBlobUrl(createdBlobUrl);
         } catch (err) {
            console.error('Error cargando PDF en blob:', err);
            if (active) {
               // Fallback: usar url directa si falla el fetch blob
               setError(err.message || 'No se pudo cargar el PDF');
            }
         } finally {
            if (active) setLoading(false);
         }
      };

      fetchPdfBlob();

      return () => {
         active = false;
         if (createdBlobUrl) {
            URL.revokeObjectURL(createdBlobUrl);
         }
      };
   }, [isOpen, pdfUrl]);

   if (!isOpen) return null;

   const effectiveViewUrl = blobUrl || pdfUrl;

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         title={
            <div className="flex items-center gap-2">
               <DocumentTextIcon className="w-5 h-5 text-[var(--brand)]" />
               <span className="truncate">{title}</span>
            </div>
         }
         maxWidth="max-w-5xl"
      >
         <div className="flex flex-col gap-3">
            {/* Barra superior con detalles y acciones de descarga */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)] text-xs">
               <div className="text-[var(--text-soft)]">
                  {subtitle && <span className="font-medium text-[var(--text-main)]">{subtitle}</span>}
               </div>

               <div className="flex items-center gap-2 ml-auto">
                  <a
                     href={pdfUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] text-[var(--text-main)] font-medium transition shadow-xs text-xs"
                     title="Abrir en pestaña nueva"
                  >
                     <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                     <span>Abrir en pestaña</span>
                  </a>

                  <a
                     href={pdfUrl}
                     download={downloadFilename}
                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--brand)] text-white hover:opacity-90 font-medium transition shadow-xs text-xs"
                     title="Descargar archivo PDF"
                  >
                     <ArrowDownTrayIcon className="w-4 h-4" />
                     <span>Descargar</span>
                  </a>
               </div>
            </div>

            {/* Contenedor del Visor */}
            <div className="relative w-full h-[75vh] bg-[var(--surface-2)]/50 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
               {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-content)]/80 backdrop-blur-xs z-10">
                     <ArrowPathIcon className="w-8 h-8 text-[var(--brand)] animate-spin" />
                     <p className="text-xs text-[var(--text-soft)] font-medium">Cargando visor de PDF...</p>
                  </div>
               )}

               {error && !blobUrl ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                     <ExclamationTriangleIcon className="w-10 h-10 text-amber-500" />
                     <p className="text-sm font-semibold text-[var(--heading)]">No se pudo cargar la vista previa directa</p>
                     <p className="text-xs text-[var(--text-soft)] max-w-md">
                        Puedes abrir el documento en una pestaña nueva o descargarlo directamente con los botones superiores.
                     </p>
                     <div className="flex gap-2 mt-2">
                        <a
                           href={pdfUrl}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="px-4 py-2 bg-[var(--brand)] text-white text-xs font-semibold rounded-xl hover:opacity-90 transition"
                        >
                           Abrir PDF en pestaña
                        </a>
                     </div>
                  </div>
               ) : (
                  <iframe
                     src={effectiveViewUrl}
                     title={typeof title === 'string' ? title : 'Visor de PDF'}
                     className="w-full h-full border-0"
                  />
               )}
            </div>
         </div>
      </Modal>
   );
}
