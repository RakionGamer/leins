import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import {
   listEmissoConnections,
   discoverAndLinkEmissoAccounts,
   createEmissoConnectLink
} from '../../services/entitiesApi';
import { toast } from 'components/Toaster';

const AVAILABLE_BANKS = [
   { id: 'bch_empresas', name: 'Banco de Chile' },
   { id: 'santander_empresas', name: 'Banco Santander' },
   { id: 'bci_pyme', name: 'Banco BCI (Pyme / Empresas)' },
   { id: 'banco_estado', name: 'BancoEstado' },
   { id: 'scotiabank_empresas', name: 'Scotiabank' },
   { id: 'itau_empresas', name: 'Banco Itaú' },
   { id: 'bice_empresas', name: 'Banco BICE' },
   { id: 'banco_security', name: 'Banco Security' },
];

export default function EmissoConnectModal({ isOpen, onClose, entityId, onAccountsLinked }) {
   const [loading, setLoading] = useState(false);
   const [linkingId, setLinkingId] = useState(null);
   const [creatingLink, setCreatingLink] = useState(false);
   const [connections, setConnections] = useState([]);
   const [selectedSystem, setSelectedSystem] = useState('bch_empresas');
   const [scopeNotice, setScopeNotice] = useState(false);

   const fetchConnections = async () => {
      if (!entityId) return;
      setLoading(true);
      setScopeNotice(false);
      try {
         const res = await listEmissoConnections({ entityId });
         setConnections(res?.connections || []);
      } catch (err) {
         toast.error(err?.message || 'Error al consultar conexiones de Emisso');
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      if (isOpen) {
         fetchConnections();
      }
   }, [isOpen, entityId]);

   const handleLink = async (conn) => {
      if (!entityId) return;
      setLinkingId(conn.id);
      try {
         const res = await discoverAndLinkEmissoAccounts({
            entityId,
            connectionId: conn.id,
            system: conn.system || 'bch_empresas',
         });
         toast.success(`¡Cuentas vinculadas con éxito! (${res.accountsFound || 0} cuentas detectadas)`);
         if (onAccountsLinked) {
            await onAccountsLinked();
         }
         await fetchConnections();
         onClose();
      } catch (err) {
         toast.error(err?.message || 'Error al vincular cuentas');
      } finally {
         setLinkingId(null);
      }
   };

   const handleCreateNewConnection = async () => {
      if (!entityId) return;
      setCreatingLink(true);
      setScopeNotice(false);
      try {
         const res = await createEmissoConnectLink({
            entityId,
            system: selectedSystem,
            redirectUrl: window.location.href,
         });

         const linkUrl = res?.url || res?.link || res?.enlace;
         if (linkUrl) {
            window.open(linkUrl, '_blank', 'width=600,height=700');
            toast.info('Se abrió la ventana de conexión segura. Completa el login en el banco y luego pulsa "Actualizar lista".');
         } else {
            toast.success('Solicitud enviada a Emisso');
            await fetchConnections();
         }
      } catch (err) {
         if (String(err?.message || '').includes('scope_not_granted')) {
            setScopeNotice(true);
         } else {
            toast.error(err?.message || 'No se pudo generar el enlace de conexión');
         }
      } finally {
         setCreatingLink(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Vincular Banco con Emisso Connect" maxWidth="max-w-2xl">
         <div className="space-y-6">
            {/* Header explicativo */}
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-text-soft">
               <p className="font-medium text-heading mb-1">
                  Integración bancaria automatizada
               </p>
               <p>
                  Conecta tus cuentas bancarias para sincronizar saldos y movimientos automáticamente cada 4 horas
                  sin necesidad de descargar ni subir archivos Excel manualmente.
               </p>
            </div>

            {/* Lista de conexiones detectadas */}
            <div>
               <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-heading flex items-center gap-2">
                     <span>🏦</span> Conexiones detectadas en Emisso
                  </h4>
                  <button
                     type="button"
                     onClick={fetchConnections}
                     disabled={loading}
                     className="text-xs text-primary hover:underline font-medium"
                  >
                     {loading ? 'Consultando...' : '↻ Actualizar lista'}
                  </button>
               </div>

               {loading ? (
                  <div className="py-8 text-center text-xs text-text-soft">
                     <span className="loading loading-spinner loading-md text-primary mr-2" />
                     Consultando conexiones en Emisso...
                  </div>
               ) : connections.length === 0 ? (
                  <div className="p-4 bg-surface-1 rounded-xl border border-border-subtle text-center text-xs text-text-soft">
                     No se detectaron conexiones bancarias activas en tu cuenta de Emisso.
                     Puedes conectar un banco abajo.
                  </div>
               ) : (
                  <div className="space-y-3">
                     {connections.map((conn) => {
                        const isCurrentLinking = linkingId === conn.id;
                        return (
                           <div
                              key={conn.id}
                              className="p-3.5 bg-surface-1 rounded-xl border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                           >
                              <div className="min-w-0">
                                 <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-heading">{conn.name}</span>
                                    <span className={`badge badge-xs ${conn.status === 'active' ? 'badge-success text-white' : 'badge-ghost'}`}>
                                       {conn.status === 'active' ? 'Activa' : conn.status}
                                    </span>
                                    {conn.isLinked && (
                                       <span className="badge badge-xs badge-info text-white">
                                          Vinculada
                                       </span>
                                    )}
                                 </div>
                                 <div className="text-[11px] text-text-soft mt-1 flex flex-wrap gap-x-3">
                                    <span>ID: <code className="bg-surface-2 px-1 py-0.5 rounded text-[10px]">{conn.id}</code></span>
                                    <span>Cadencia: {conn.cadence || '4h'}</span>
                                    {conn.lastVerified && (
                                       <span>Verificada: {new Date(conn.lastVerified).toLocaleDateString()}</span>
                                    )}
                                 </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                 <button
                                    type="button"
                                    onClick={() => handleLink(conn)}
                                    disabled={isCurrentLinking || loading}
                                    className="btn btn-sm btn-primary gap-1"
                                 >
                                    {isCurrentLinking && <span className="loading loading-spinner loading-xs" />}
                                    {conn.isLinked ? '↻ Re-vincular cuentas' : '⚡ Vincular cuentas'}
                                 </button>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>

            {/* Aviso si la API key carece del scope de enlace */}
            {scopeNotice && (
               <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold mb-1">Permiso adicional requerido para enlaces directos</p>
                  <p>
                     Tu API Key actual no tiene el permiso <code className="font-mono bg-amber-500/20 px-1 rounded">conexiones.enlace.crear</code>.
                     Para crear una conexión nueva, ingrésala directamente en tu panel de Emisso (
                     <a href="https://connect.emisso.ai" target="_blank" rel="noopener noreferrer" className="underline font-bold">
                        connect.emisso.ai
                     </a>
                     ). Una vez conectada, pulsa <strong>"Actualizar lista"</strong> arriba y podrás vincularla de inmediato con un solo clic.
                  </p>
               </div>
            )}

            {/* Conectar nuevo banco */}
            <div className="pt-3 border-t border-border-subtle">
               <h4 className="text-sm font-semibold text-heading mb-2">
                  ¿Deseas conectar un nuevo banco?
               </h4>
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                     value={selectedSystem}
                     onChange={(e) => setSelectedSystem(e.target.value)}
                     className="select select-bordered select-sm flex-1 bg-surface-1"
                  >
                     {AVAILABLE_BANKS.map((b) => (
                        <option key={b.id} value={b.id}>
                           {b.name}
                        </option>
                     ))}
                  </select>

                  <button
                     type="button"
                     onClick={handleCreateNewConnection}
                     disabled={creatingLink || loading}
                     className="btn btn-sm btn-outline gap-1.5"
                  >
                     {creatingLink && <span className="loading loading-spinner loading-xs" />}
                     🌐 Conectar con Banco
                  </button>
               </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
               <button type="button" onClick={onClose} className="btn btn-sm btn-ghost">
                  Cerrar
               </button>
            </div>
         </div>
      </Modal>
   );
}
