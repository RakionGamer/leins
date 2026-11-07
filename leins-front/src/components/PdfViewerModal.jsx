// src/components/PdfViewerModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
   DocumentTextIcon,
   ArrowPathIcon,
   ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function PdfViewerModal({
   isOpen,
   onClose,
   pdfUrl,
   title = 'Visor de Boleta',
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
         maxWidth="max-w-4xl"
      >
         <div className="relative w-full h-[80vh] bg-[var(--surface-2)]/40 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            {loading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-content)]/85 backdrop-blur-xs z-10">
                  <ArrowPathIcon className="w-8 h-8 text-[var(--brand)] animate-spin" />
                  <p className="text-xs text-[var(--text-soft)] font-medium">Cargando visor de PDF...</p>
               </div>
            )}

            {error && !blobUrl ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <ExclamationTriangleIcon className="w-10 h-10 text-amber-500" />
                  <p className="text-sm font-semibold text-[var(--heading)]">No se pudo cargar la vista previa</p>
                  <p className="text-xs text-[var(--text-soft)] max-w-md">
                     {error}
                  </p>
               </div>
            ) : (
               <iframe
                  src={effectiveViewUrl}
                  title={typeof title === 'string' ? title : 'Visor de Boleta'}
                  className="w-full h-full border-0 rounded-xl"
               />
            )}
         </div>
      </Modal>
   );
}
