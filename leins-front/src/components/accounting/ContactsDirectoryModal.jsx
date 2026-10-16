import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
   MagnifyingGlassIcon, 
   ArrowPathIcon, 
   PlusIcon, 
   PencilSquareIcon, 
   TrashIcon, 
   XMarkIcon,
   UserGroupIcon,
   BuildingOffice2Icon,
   BriefcaseIcon,
   UserIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { 
   getContacts, 
   createContact, 
   updateContact, 
   deleteContact, 
   syncContactsFromSii 
} from '../../services/contactsApi';

const typeConfig = {
   PROVEEDOR: { label: 'Proveedor', pill: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300' },
   CLIENTE: { label: 'Cliente', pill: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300' },
   PRESTADOR_SERVICIOS: { label: 'Prestador BH', pill: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-300' },
   TRABAJADOR: { label: 'Trabajador', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300' },
   OTRO: { label: 'Otro', pill: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300' },
};

const ContactBadge = ({ type }) => {
   const config = typeConfig[type] || typeConfig.PROVEEDOR;
   return (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${config.pill}`}>
         {config.label}
      </span>
   );
};

const formatRut = (rut) => {
   let value = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
   if (value.length > 9) value = value.slice(0, 9);
   if (value.length <= 1) return value;
   const body = value.slice(0, -1);
   const dv = value.slice(-1);
   const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return `${formattedBody}-${dv}`;
};

export default function ContactsDirectoryModal({ isOpen, onClose, entityId, onContactCreated }) {
   const [contacts, setContacts] = useState([]);
   const [loading, setLoading] = useState(false);
   const [syncing, setSyncing] = useState(false);
   const [search, setSearch] = useState('');
   const [selectedType, setSelectedType] = useState('ALL');

   // Modal de crear / editar
   const [editModalOpen, setEditModalOpen] = useState(false);
   const [editingContact, setEditingContact] = useState(null);
   const [formData, setFormData] = useState({
      rut: '',
      name: '',
      type: 'PROVEEDOR',
      email: '',
      phone: '',
      notes: '',
   });
   const [saving, setSaving] = useState(false);

   const loadContacts = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      try {
         const res = await getContacts({ entityId, all: true });
         setContacts(res?.contacts || []);
      } catch (err) {
         toast.error(err.message || 'Error al cargar contactos');
      } finally {
         setLoading(false);
      }
   }, [entityId]);

   useEffect(() => {
      if (isOpen && entityId) {
         loadContacts();
      }
   }, [isOpen, entityId, loadContacts]);

   const handleSync = async () => {
      setSyncing(true);
      try {
         const stats = await syncContactsFromSii({ entityId });
         toast.success(`Sincronización completa: ${stats.created} nuevos, ${stats.updated} actualizados.`);
         await loadContacts();
         if (onContactCreated) onContactCreated();
      } catch (err) {
         toast.error(err.message || 'Error al sincronizar desde SII');
      } finally {
         setSyncing(false);
      }
   };

   const openCreateModal = () => {
      setEditingContact(null);
      setFormData({
         rut: '',
         name: '',
         type: 'TRABAJADOR',
         email: '',
         phone: '',
         notes: '',
      });
      setEditModalOpen(true);
   };

   const openEditModal = (contact) => {
      setEditingContact(contact);
      setFormData({
         rut: contact.rut,
         name: contact.name,
         type: contact.type,
         email: contact.email || '',
         phone: contact.phone || '',
         notes: contact.notes || '',
      });
      setEditModalOpen(true);
   };

   const handleSaveContact = async (e) => {
      e.preventDefault();
      if (!formData.rut.trim() || !formData.name.trim()) {
         toast.error('RUT y Nombre son requeridos');
         return;
      }

      setSaving(true);
      try {
         if (editingContact) {
            await updateContact(editingContact.id, {
               entityId,
               name: formData.name,
               type: formData.type,
               email: formData.email,
               phone: formData.phone,
               notes: formData.notes,
            });
            toast.success('Contacto actualizado correctamente');
         } else {
            await createContact({
               entityId,
               rut: formData.rut,
               name: formData.name,
               type: formData.type,
               email: formData.email,
               phone: formData.phone,
               notes: formData.notes,
            });
            toast.success('Contacto creado correctamente');
         }
         setEditModalOpen(false);
         await loadContacts();
         if (onContactCreated) onContactCreated();
      } catch (err) {
         toast.error(err.message || 'Error al guardar el contacto');
      } finally {
         setSaving(false);
      }
   };

   const handleDeleteContact = async (contact) => {
      if (!window.confirm(`¿Seguro que deseas eliminar al contacto ${contact.name} (${contact.rut})?`)) return;
      try {
         await deleteContact(contact.id, entityId);
         toast.success('Contacto eliminado');
         await loadContacts();
         if (onContactCreated) onContactCreated();
      } catch (err) {
         toast.error(err.message || 'Error al eliminar');
      }
   };

   const filteredContacts = useMemo(() => {
      let list = contacts;
      if (selectedType !== 'ALL') {
         list = list.filter((c) => c.type === selectedType);
      }
      if (search.trim()) {
         const q = search.toLowerCase().trim();
         const cleanQ = q.replace(/[.\s-]/g, '');
         list = list.filter(
            (c) =>
               (c.name && c.name.toLowerCase().includes(q)) ||
               (c.rut && c.rut.toLowerCase().includes(q)) ||
               (c.rut && c.rut.replace(/[.\s-]/g, '').includes(cleanQ)) ||
               (c.email && c.email.toLowerCase().includes(q))
         );
      }
      return list;
   }, [contacts, selectedType, search]);

   const counts = useMemo(() => {
      const c = { ALL: contacts.length, PROVEEDOR: 0, CLIENTE: 0, PRESTADOR_SERVICIOS: 0, TRABAJADOR: 0, OTRO: 0 };
      for (const item of contacts) {
         if (c[item.type] !== undefined) c[item.type]++;
      }
      return c;
   }, [contacts]);

   const ctrl = 'w-full px-3 py-2 text-sm bg-surface-1 border border-border-subtle rounded-xl text-text-main focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition';

   return (
      <>
         <Modal isOpen={isOpen} onClose={onClose} title="Directorio Centralizado de Contactos" maxWidth="max-w-5xl">
            <div className="space-y-5">
               {/* Header Controls */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                  <div>
                     <p className="text-xs text-text-soft">
                        Centralice y consulte clientes, proveedores, prestadores BH, trabajadores y otros terceros.
                     </p>
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={handleSync}
                        disabled={syncing || loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-main bg-surface-2 hover:bg-surface-3 rounded-xl border border-border-subtle transition disabled:opacity-50"
                        title="Importa o actualiza contactos desde Facturas y Boletas de Honorarios"
                     >
                        <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin text-brand' : ''}`} />
                        <span>{syncing ? 'Sincronizando...' : 'Sincronizar desde SII'}</span>
                     </button>
                     <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-sm transition"
                     >
                        <PlusIcon className="w-4 h-4 stroke-2" />
                        <span>Nuevo Contacto</span>
                     </button>
                  </div>
               </div>

               {/* Filtros y Buscador */}
               <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  {/* Pestañas de Tipo */}
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-surface-2/60 rounded-xl border border-border-subtle">
                     {[
                        { key: 'ALL', label: 'Todos' },
                        { key: 'PROVEEDOR', label: 'Proveedores' },
                        { key: 'CLIENTE', label: 'Clientes' },
                        { key: 'PRESTADOR_SERVICIOS', label: 'Prestadores BH' },
                        { key: 'TRABAJADOR', label: 'Trabajadores' },
                        { key: 'OTRO', label: 'Otros' },
                     ].map((t) => (
                        <button
                           key={t.key}
                           onClick={() => setSelectedType(t.key)}
                           className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                              selectedType === t.key
                                 ? 'bg-brand text-white shadow-sm font-semibold'
                                 : 'text-text-soft hover:text-text-main hover:bg-surface-1'
                           }`}
                        >
                           <span>{t.label}</span>
                           <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedType === t.key ? 'bg-white/20 text-white' : 'bg-surface-1 text-text-soft'}`}>
                              {counts[t.key] || 0}
                           </span>
                        </button>
                     ))}
                  </div>

                  {/* Input de Búsqueda */}
                  <div className="relative w-full sm:w-72">
                     <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-text-soft" />
                     <input
                        type="text"
                        placeholder="Buscar por RUT, Razón Social..."
                        className={`${ctrl} pl-9 text-xs`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                     />
                     {search && (
                        <button
                           onClick={() => setSearch('')}
                           className="absolute right-2.5 top-2.5 text-text-soft hover:text-text-main"
                        >
                           <XMarkIcon className="w-4 h-4" />
                        </button>
                     )}
                  </div>
               </div>

               {/* Tabla de Contactos */}
               <div className="border border-border-subtle rounded-2xl overflow-hidden bg-bg-content">
                  <div className="max-h-96 overflow-y-auto">
                     <table className="min-w-full text-xs text-left">
                        <thead className="bg-surface-1 border-b border-border-subtle sticky top-0 z-10 text-text-soft uppercase font-semibold">
                           <tr>
                              <th className="py-3 px-4 w-36">RUT</th>
                              <th className="py-3 px-4">Razón Social / Nombre</th>
                              <th className="py-3 px-4 w-36">Tipo</th>
                              <th className="py-3 px-4 w-28">Origen</th>
                              <th className="py-3 px-4 text-center w-24">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                           {loading ? (
                              <tr>
                                 <td colSpan={5} className="py-12 text-center text-text-soft">
                                    <div className="flex items-center justify-center gap-2">
                                       <span className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                                       <span>Cargando directorio de contactos...</span>
                                    </div>
                                 </td>
                              </tr>
                           ) : filteredContacts.length === 0 ? (
                              <tr>
                                 <td colSpan={5} className="py-10 text-center text-text-soft italic">
                                    No se encontraron contactos para los filtros aplicados.
                                 </td>
                              </tr>
                           ) : (
                              filteredContacts.map((c) => (
                                 <tr key={c.id || c.rut} className="hover:bg-brand/5 transition-colors">
                                    <td className="py-3 px-4 font-mono font-bold text-text-main">
                                       {formatRut(c.rut)}
                                    </td>
                                    <td className="py-3 px-4">
                                       <div className="font-semibold text-text-main">{c.name}</div>
                                       {(c.email || c.phone) && (
                                          <div className="text-[11px] text-text-soft mt-0.5">
                                             {c.email} {c.email && c.phone ? '•' : ''} {c.phone}
                                          </div>
                                       )}
                                    </td>
                                    <td className="py-3 px-4">
                                       <ContactBadge type={c.type} />
                                    </td>
                                    <td className="py-3 px-4 text-text-soft">
                                       {c.source === 'SII_FACT' ? (
                                          <span className="text-[11px]">SII Facturas</span>
                                       ) : c.source === 'SII_BH' ? (
                                          <span className="text-[11px]">SII Honorarios</span>
                                       ) : (
                                          <span className="text-[11px] font-medium text-brand">Manual</span>
                                       )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                       <div className="flex items-center justify-center gap-1.5">
                                          <button
                                             onClick={() => openEditModal(c)}
                                             className="p-1.5 text-text-soft hover:text-brand hover:bg-brand/10 rounded-lg transition"
                                             title="Editar contacto"
                                          >
                                             <PencilSquareIcon className="w-4 h-4" />
                                          </button>
                                          {c.source === 'MANUAL' && (
                                             <button
                                                onClick={() => handleDeleteContact(c)}
                                                className="p-1.5 text-text-soft hover:text-danger hover:bg-danger/10 rounded-lg transition"
                                                title="Eliminar contacto"
                                             >
                                                <TrashIcon className="w-4 h-4" />
                                             </button>
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Footer */}
               <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-text-soft">
                     Total de contactos: <strong className="text-text-main">{contacts.length}</strong>
                  </span>
                  <button
                     onClick={onClose}
                     className="px-4 py-2 text-xs font-semibold text-text-soft hover:text-text-main hover:bg-surface-2 rounded-xl transition"
                  >
                     Cerrar
                  </button>
               </div>
            </div>
         </Modal>

         {/* Modal Crear / Editar Contacto */}
         {editModalOpen && (
            <Modal
               isOpen={editModalOpen}
               onClose={() => setEditModalOpen(false)}
               title={editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
               maxWidth="max-w-md"
            >
               <form onSubmit={handleSaveContact} className="space-y-4">
                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">RUT *</label>
                     <input
                        type="text"
                        disabled={!!editingContact}
                        placeholder="12.345.678-9"
                        className={`${ctrl} font-mono`}
                        value={formData.rut}
                        onChange={(e) => setFormData({ ...formData, rut: formatRut(e.target.value) })}
                        required
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Nombre / Razón Social *</label>
                     <input
                        type="text"
                        placeholder="Ej: Juan Pérez o Empresa SpA"
                        className={ctrl}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Tipo de Contacto *</label>
                     <select
                        className={ctrl}
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                     >
                        <option value="PROVEEDOR">Proveedor</option>
                        <option value="CLIENTE">Cliente</option>
                        <option value="PRESTADOR_SERVICIOS">Prestador de Servicios (BH)</option>
                        <option value="TRABAJADOR">Trabajador</option>
                        <option value="OTRO">Otro tercero</option>
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Email (Opcional)</label>
                        <input
                           type="email"
                           placeholder="contacto@ejemplo.cl"
                           className={ctrl}
                           value={formData.email}
                           onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Teléfono (Opcional)</label>
                        <input
                           type="text"
                           placeholder="+56 9 1234 5678"
                           className={ctrl}
                           value={formData.phone}
                           onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Notas (Opcional)</label>
                     <textarea
                        rows={2}
                        placeholder="Detalles adicionales sobre este contacto..."
                        className={ctrl}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                     />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                     <button
                        type="button"
                        onClick={() => setEditModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-text-soft hover:bg-surface-2 rounded-xl transition"
                     >
                        Cancelar
                     </button>
                     <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-sm transition disabled:opacity-50"
                     >
                        {saving ? 'Guardando...' : editingContact ? 'Actualizar' : 'Guardar Contacto'}
                     </button>
                  </div>
               </form>
            </Modal>
         )}
      </>
   );
}
