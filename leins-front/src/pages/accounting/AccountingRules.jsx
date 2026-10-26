import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import Modal from '../../components/Modal';
import AccountSelect from '../../components/accounting/AccountSelect';
import CounterpartyInput from '../../components/accounting/CounterpartyInput';
import ContactSelect from '../../components/accounting/ContactSelect';
import ContactsDirectoryModal from '../../components/accounting/ContactsDirectoryModal';
import ContactsBatchPickerModal from '../../components/accounting/ContactsBatchPickerModal';
import { toast } from '../../components/Toaster';
import {
   getRules,
   upsertRule,
   upsertBulkRules,
   searchCounterpartyName,
   deleteRule,
   getAccounts,
} from '../../services/accountingApi';
import {
   PlusIcon,
   TrashIcon,
   ArrowPathIcon,
   DocumentDuplicateIcon,
   TagIcon,
   BookOpenIcon,
   CurrencyDollarIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
   PencilIcon,
   UserGroupIcon,
} from '@heroicons/react/24/outline';

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
}

const getRoleFromAccount = (account) => {
   if (!account) return 'Desconocido';
   const code = account.code || '';
   const name = (account.name || '').toLowerCase();
   
   if (code.startsWith('11.05.') || name.includes('cliente')) return 'Cliente';
   if (code === '21.12.15' || name.includes('honorarios')) return 'Prestador de Servicios (BH)';
   if (code === '21.12.10' || name.includes('remuneraciones')) return 'Colaborador (Liq)';
   if (code.startsWith('2') || code.startsWith('6') || name.includes('proveedor')) return 'Proveedor';
   
   return 'Otro';
};

const getRoleColor = (role) => {
   switch (role) {
      case 'Cliente': return 'bg-blue-100 text-blue-700 ring-blue-200';
      case 'Proveedor': return 'bg-purple-100 text-purple-700 ring-purple-200';
      case 'Prestador de Servicios (BH)': return 'bg-amber-100 text-amber-700 ring-amber-200';
      case 'Colaborador (Liq)': return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
      default: return 'bg-slate-100 text-slate-700 ring-slate-200';
   }
};

const formatRut = (rut) => {
   let value = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
   if (value.length > 9) value = value.slice(0, 9);
   if (value.length <= 1) return value;
   let body = value.slice(0, -1);
   let dv = value.slice(-1);
   body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return `${body}-${dv}`;
};

const cleanRut = (rut) => String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();

function ResumenReglas({ rules }) {
   const stats = useMemo(() => {
      const ruts = new Set();
      const accounts = new Set();
      let costCenters = 0;

      for (const r of rules ?? []) {
         if (r.counterparty_rut) ruts.add(r.counterparty_rut);
         if (r.account_id) accounts.add(r.account_id);
         if (r.cost_center) costCenters++;
      }
      return { total: rules?.length ?? 0, ruts: ruts.size, accounts: accounts.size, costCenters };
   }, [rules]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Reglas</div>
               <div className="text-xl font-bold text-heading">{stats.total}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl"><TagIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">RUTs Configurados</div>
               <div className="text-xl font-bold text-heading">{stats.ruts}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl"><BookOpenIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Cuentas Asignadas</div>
               <div className="text-xl font-bold text-heading">{stats.accounts}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><CurrencyDollarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Centros de Costo</div>
               <div className="text-xl font-bold text-brand">{stats.costCenters}</div>
            </div>
         </div>
      </div>
   );
}

export default function AccountingRules() {
   const { entityId, ready } = useEntityRequired();

   const [rules, setRules] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [search, setSearch] = useState('');
   const [accountFilter, setAccountFilter] = useState('');
   const [roleFilter, setRoleFilter] = useState('');

   const clearFilters = () => {
      setSearch('');
      setAccountFilter('');
      setRoleFilter('');
      loadRules();
   };

   const [modalOpen, setModalOpen] = useState(false);
   const [editingGroup, setEditingGroup] = useState(null);
   const [contactsModalOpen, setContactsModalOpen] = useState(false);
   const [batchPickerOpen, setBatchPickerOpen] = useState(false);
   const [formData, setFormData] = useState({
      account_id: '',
      glosa: '',
      cost_center: '',
      ruts: [{ rut: '', name: '', displayValue: '' }],
   });
   const [submitting, setSubmitting] = useState(false);

   const handleAddBatchContacts = (selectedContacts) => {
      setFormData((prev) => {
         const existing = prev.ruts.filter((r) => r.rut && r.rut.trim());
         const existingCleanRuts = new Set(existing.map((r) => cleanRut(r.rut)));

         const newRows = [];
         for (const c of selectedContacts) {
            const cleanC = cleanRut(c.rut);
            if (!existingCleanRuts.has(cleanC)) {
               const fRut = formatRut(c.rut);
               const name = c.name || '';
               newRows.push({
                  rut: fRut,
                  name,
                  displayValue: name ? `${fRut} - ${name}` : fRut,
                  fromDirectory: Boolean(name),
               });
               existingCleanRuts.add(cleanC);
            }
         }

         return {
            ...prev,
            ruts: [...existing, ...newRows].length ? [...existing, ...newRows] : [{ rut: '', name: '', displayValue: '' }],
         };
      });
      toast.success(`Se agregaron ${selectedContacts.length} contactos a la asignación`);
   };

   const loadRules = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const [rulesData, accountsData] = await Promise.all([
            getRules({ entityId }),
            getAccounts({ entityId }),
         ]);
         setRules(Array.isArray(rulesData) ? rulesData : []);
         setAccounts(Array.isArray(accountsData) ? accountsData : []);
      } catch (e) {
         setErr(e.message || 'Error al cargar reglas');
      } finally {
         setLoading(false);
      }
   }, [entityId]);

   useEffect(() => {
      if (ready && entityId) {
         loadRules();
      }
   }, [ready, entityId, loadRules]);

   const addRutRow = () => {
      setFormData(prev => ({ ...prev, ruts: [...prev.ruts, { rut: '', name: '', displayValue: '' }] }));
   };
   
   const removeRutRow = (index) => {
      setFormData(prev => ({ ...prev, ruts: prev.ruts.filter((_, i) => i !== index) }));
   };


   const parseRutAndName = (str) => {
      const val = String(str || '').trim();
      if (!val) return { rut: '', name: '' };

      const separatorIdx = val.indexOf(' - ');
      if (separatorIdx !== -1) {
         const part1 = val.slice(0, separatorIdx).trim();
         const part2 = val.slice(separatorIdx + 3).trim();
         return {
            rut: formatRut(part1),
            name: part2,
         };
      }

      const rutRegex = /^(\d{1,2}(?:\.?\d{3}){2}-?[\dkK]|\d{7,8}-?[\dkK])/i;
      const match = val.match(rutRegex);
      if (match) {
         const rawRut = match[1];
         const rest = val.slice(match[0].length).replace(/^[\s\-_:,]+/, '').trim();
         const fRut = formatRut(rawRut);
         return {
            rut: fRut,
            name: rest,
         };
      }

      const cleanOnly = val.replace(/[^0-9kK]/g, '');
      if (cleanOnly.length >= 7 && cleanOnly.length <= 9) {
         const fRut = formatRut(cleanOnly);
         return {
            rut: fRut,
            name: '',
         };
      }

      return {
         rut: val,
         name: '',
      };
   };

   const handleUnifiedInputChange = async (index, val) => {
      const parsed = parseRutAndName(val);
      
      setFormData((prev) => {
         const newRuts = [...prev.ruts];
         newRuts[index] = {
            ...newRuts[index],
            rut: parsed.rut,
            name: parsed.name,
            displayValue: val,
            fromDirectory: false,
         };
         return { ...prev, ruts: newRuts };
      });

      const clean = String(parsed.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
      if (clean.length >= 8 && !parsed.name) {
         const existing = rules.find(r => String(r.counterparty_rut || '').replace(/[^0-9kK]/g, '').toUpperCase() === clean && r.counterparty_name);
         if (existing && existing.counterparty_name) {
            setFormData(prev => {
               const newRuts = [...prev.ruts];
               if (!newRuts[index].name) {
                  newRuts[index].name = existing.counterparty_name;
                  newRuts[index].displayValue = `${formatRut(clean)} - ${existing.counterparty_name}`;
                  newRuts[index].fromDirectory = true;
               }
               return { ...prev, ruts: newRuts };
            });
            return;
         }

         const result = await searchCounterpartyName(clean);
         if (result && result.name) {
            setFormData(prev => {
               const newRuts = [...prev.ruts];
               if (!newRuts[index].name) {
                  newRuts[index].name = result.name;
                  newRuts[index].displayValue = `${formatRut(clean)} - ${result.name}`;
                  newRuts[index].fromDirectory = true;
               }
               return { ...prev, ruts: newRuts };
            });
         }
      }
   };

   const handleContactSelect = (index, item) => {
      const cleanNewRut = cleanRut(item.rut);
      const isAlreadyInOtherRow = formData.ruts.some((r, i) => i !== index && cleanRut(r.rut) === cleanNewRut);
      if (isAlreadyInOtherRow) {
         toast.warning('Este contacto ya está agregado a esta regla');
         return;
      }
      const fRut = formatRut(item.rut);
      const name = item.name || '';
      setFormData((prev) => {
         const newRuts = [...prev.ruts];
         newRuts[index] = {
            rut: fRut,
            name,
            displayValue: name ? `${fRut} - ${name}` : fRut,
            fromDirectory: Boolean(name),
         };
         return { ...prev, ruts: newRuts };
      });
   };

   const handleClearContact = (index) => {
      setFormData((prev) => {
         const newRuts = [...prev.ruts];
         newRuts[index] = {
            rut: '',
            name: '',
            displayValue: '',
            fromDirectory: false,
         };
         return { ...prev, ruts: newRuts };
      });
   };

   const handleContactSelectMultiple = (currentIndex, items) => {
      if (!items || items.length === 0) return;

      const existingCleanRuts = new Set(
         formData.ruts
            .map((r, i) => i !== currentIndex ? cleanRut(r.rut) : null)
            .filter(Boolean)
      );

      const filteredItems = items.filter(it => !existingCleanRuts.has(cleanRut(it.rut)));

      if (filteredItems.length === 0) {
         toast.warning('Los contactos seleccionados ya están agregados a esta regla');
         return;
      }

      setFormData((prev) => {
         const newRuts = [...prev.ruts];
         const usedCleanRuts = new Set(
            newRuts
               .map((r, i) => i !== currentIndex ? cleanRut(r.rut) : null)
               .filter(Boolean)
         );

         const first = filteredItems[0];
         const fRut = formatRut(first.rut);
         const firstName = first.name || '';
         newRuts[currentIndex] = {
            rut: fRut,
            name: firstName,
            displayValue: firstName ? `${fRut} - ${firstName}` : fRut,
            fromDirectory: Boolean(firstName),
         };
         usedCleanRuts.add(cleanRut(first.rut));

         for (let i = 1; i < filteredItems.length; i++) {
            const it = filteredItems[i];
            const cleanIt = cleanRut(it.rut);
            if (!usedCleanRuts.has(cleanIt)) {
               const rutF = formatRut(it.rut);
               const itName = it.name || '';
               newRuts.push({
                  rut: rutF,
                  name: itName,
                  displayValue: itName ? `${rutF} - ${itName}` : rutF,
                  fromDirectory: Boolean(itName),
               });
               usedCleanRuts.add(cleanIt);
            }
         }

         return { ...prev, ruts: newRuts };
      });

      const skipped = items.length - filteredItems.length;
      if (skipped > 0) {
         toast.success(`Se agregaron ${filteredItems.length} contactos (${skipped} omitidos por estar repetidos)`);
      } else {
         toast.success(`Se agregaron ${filteredItems.length} contactos a la regla`);
      }
   };

   const handleEditGroup = (group) => {
      setEditingGroup(group);
      const ruts = group.rules.map(r => {
         const fRut = formatRut(r.counterparty_rut || '');
         const name = r.counterparty_name || '';
         return {
            rut: fRut,
            name,
            displayValue: name ? `${fRut} - ${name}` : fRut,
            fromDirectory: Boolean(name),
         };
      });
      setFormData({
         account_id: group.account ? group.account.id : '',
         glosa: group.rules[0]?.glosa || '',
         cost_center: group.rules[0]?.cost_center || '',
         ruts: ruts.length ? ruts : [{ rut: '', name: '', displayValue: '' }],
      });
      setModalOpen(true);
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.account_id) {
         toast.error('Debe seleccionar una cuenta contable');
         return;
      }
      
      const ruts = formData.ruts
         .map(r => {
            let rut = r.rut || '';
            let name = r.name || '';
            const raw = r.displayValue || rut;

            if (!name && raw) {
               const parsed = parseRutAndName(raw);
               if (parsed.rut) rut = parsed.rut;
               if (parsed.name) name = parsed.name;
            }

            const cleanRut = String(rut).replace(/[^0-9kK-]/g, '').trim().toUpperCase();
            return {
               rut: cleanRut,
               name: String(name || '').trim()
            };
         })
         .filter(r => r.rut && r.rut.length >= 8);

      // Deduplicar ruts para no enviar repetidos al backend
      const seenRuts = new Set();
      const uniqueRuts = [];
      for (const r of ruts) {
         const cleanKey = cleanRut(r.rut);
         if (!seenRuts.has(cleanKey)) {
            seenRuts.add(cleanKey);
            uniqueRuts.push(r);
         }
      }

      if (uniqueRuts.length === 0) {
         toast.error('Debe ingresar al menos un RUT válido');
         return;
      }

      setSubmitting(true);
      setErr(null);
      try {
         await upsertBulkRules({
            entityId,
            account_id: Number(formData.account_id),
            glosa: formData.glosa,
            cost_center: formData.cost_center,
            ruts: uniqueRuts,
            replace_account: true
         });
         toast.success(`Se guardaron ${uniqueRuts.length} reglas correctamente`);
         setModalOpen(false);
         setEditingGroup(null);
         loadRules();
      } catch (e) {
         setErr(e.message || 'Error al guardar las reglas');
      } finally {
         setSubmitting(false);
      }
   };

   const handleDeleteGroup = async (group) => {
      const accountLabel = group.account ? `${group.account.code} - ${group.account.name}` : 'esta cuenta';
      const count = group.rules?.length || 0;
      const confirmMsg = count === 1
         ? `¿Seguro que deseas eliminar el registro para ${group.rules[0]?.counterparty_rut || 'este contacto'} (${accountLabel})?`
         : `¿Seguro que deseas eliminar el registro de ${accountLabel} con sus ${count} RUTs asociados?`;

      if (!window.confirm(confirmMsg)) return;

      setLoading(true);
      try {
         await Promise.all(group.rules.map((r) => deleteRule(r.id, entityId)));
         toast.success(count === 1 ? 'Registro eliminado correctamente' : `${count} reglas eliminadas correctamente`);
         await loadRules();
      } catch (e) {
         toast.error(e.message || 'Error al eliminar el registro');
      } finally {
         setLoading(false);
      }
   };

   const handleDeleteSingleRule = async (rule) => {
      const label = rule.counterparty_name ? `${rule.counterparty_rut} - ${rule.counterparty_name}` : rule.counterparty_rut;
      if (!window.confirm(`¿Seguro que deseas eliminar la regla para ${label}?`)) return;

      setLoading(true);
      try {
         await deleteRule(rule.id, entityId);
         toast.success('RUT eliminado de la regla correctamente');
         await loadRules();
      } catch (e) {
         toast.error(e.message || 'Error al eliminar la regla');
      } finally {
         setLoading(false);
      }
   };

   const filteredRules = useMemo(() => {
      let result = rules;
      
      if (accountFilter) {
         result = result.filter(r => r.account_id && String(r.account_id) === accountFilter);
      }
      
      if (roleFilter) {
         result = result.filter(r => getRoleFromAccount(r.account) === roleFilter);
      }

      if (search.trim()) {
         const q = search.toLowerCase().trim();
         result = result.filter(
            (r) =>
               (r.counterparty_rut && r.counterparty_rut.toLowerCase().includes(q)) ||
               (r.counterparty_name && r.counterparty_name.toLowerCase().includes(q)) ||
               (r.account && r.account.name && r.account.name.toLowerCase().includes(q)) ||
               (r.account && r.account.code && r.account.code.toLowerCase().includes(q))
         );
      }
      return result;
   }, [rules, search, accountFilter, roleFilter]);

   const groupedRules = useMemo(() => {
      const groups = {};
      for (const rule of filteredRules) {
         const accId = rule.account_id || 'unassigned';
         if (!groups[accId]) {
            groups[accId] = {
               account: rule.account,
               rules: []
            };
         }
         groups[accId].rules.push(rule);
      }
      return Object.values(groups).sort((a, b) => {
         if (!a.account) return 1;
         if (!b.account) return -1;
         const codeA = a.account.code || '';
         const codeB = b.account.code || '';
         return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
   }, [filteredRules]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Reglas de Asignación por RUT</h2>
                  <p className="text-sm text-text-soft mt-1">Automatice la imputación contable de documentos asociando RUTs a cuentas específicas.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={() => setContactsModalOpen(true)}
                     className={`${btnCtrl} text-text-main border-border-subtle bg-surface-1 hover:bg-surface-2`}
                     title="Consultar y gestionar el directorio centralizado de contactos"
                  >
                     <UserGroupIcon className="w-5 h-5 text-brand" />
                     <span>Directorio / Contactos</span>
                  </button>
                  <button
                     onClick={() => {
                        setEditingGroup(null);
                        setFormData({ account_id: '', glosa: '', cost_center: '', ruts: [{ rut: '', name: '', displayValue: '' }] });
                        setModalOpen(true);
                     }}
                     className={`${btnCtrl} text-brand border-brand/20 bg-brand/5`}
                     title="Crear nueva regla de asignación"
                  >
                     <PlusIcon className="w-5 h-5 stroke-2" />
                     <span>Nueva Regla</span>
                  </button>
               </div>
            </div>

            {/* Filter Section */}
            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                     <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
                  </div>
                  <button
                     onClick={clearFilters}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-4 h-4" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-4 relative">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Buscar por RUT o Nombre</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-text-soft/70" />
                        <input
                           type="text"
                           placeholder="Buscar RUT, nombre, cuenta..."
                           className={`${ctrl} pl-10`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Filtrar por Cuenta Contable</label>
                     <AccountSelect
                        accounts={accounts}
                        value={accountFilter}
                        onChange={(val) => setAccountFilter(val)}
                        placeholder="Todas las cuentas"
                        allowClear={true}
                     />
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Rol (Tipo de Entidad)</label>
                     <select 
                        className={selectCtrl}
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                     >
                        <option value="">Todos los roles</option>
                        <option value="Cliente">Cliente</option>
                        <option value="Proveedor">Proveedor</option>
                        <option value="Prestador de Servicios (BH)">Prestador de Servicios (BH)</option>
                        <option value="Colaborador (Liq)">Colaborador (Liq)</option>
                        <option value="Otro">Otro</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Resumen Tarjetas */}
         <ResumenReglas rules={rules} />

         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Rules Table Grouped */}
         <div className={`transition-all ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-1 border-b border-border-subtle text-text-soft font-semibold text-xs uppercase tracking-wider">
                        <tr>
                           <th className="p-4 pl-6 w-1/3">Proveedores</th>
                           <th className="p-4 w-1/4">Glosa</th>
                           <th className="p-4">Cuentas</th>
                           <th className="p-4 text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {groupedRules.length === 0 ? (
                           <tr>
                              <td colSpan="4" className="p-10 text-center text-text-soft italic">
                                 Sin resultados. Ajusta filtros o crea nuevas reglas.
                              </td>
                           </tr>
                        ) : (
                           groupedRules.map((group, index) => (
                              <tr key={index} className="hover:bg-brand/5 transition-colors group/row align-top">
                                 <td className="p-4 pl-6">
                                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-2">
                                       {group.rules.map((rule) => (
                                          <div
                                             key={rule.id}
                                             className="text-xs text-text-main flex items-center justify-between group/item hover:bg-surface-2/70 px-2 py-1 rounded-lg transition"
                                          >
                                             <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="font-mono font-bold whitespace-nowrap">{rule.counterparty_rut}</span> 
                                                {rule.counterparty_name ? <span className="text-text-soft truncate">- {rule.counterparty_name}</span> : ''}
                                             </div>
                                             {group.rules.length > 1 && (
                                                <button
                                                   type="button"
                                                   onClick={() => handleDeleteSingleRule(rule)}
                                                   className="text-text-soft hover:text-danger p-1 rounded-md hover:bg-danger/10 opacity-0 group-hover/item:opacity-100 transition shrink-0 ml-1 cursor-pointer"
                                                   title={`Eliminar asignación de ${rule.counterparty_rut}`}
                                                >
                                                   <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                             )}
                                          </div>
                                       ))}
                                    </div>
                                 </td>
                                 <td className="p-4 text-text-main font-medium">
                                    {group.rules[0]?.glosa || <span className="italic text-xs text-text-soft/70">Sin glosa específica</span>}
                                    {group.rules[0]?.cost_center && (
                                       <div className="mt-1 text-[10px] text-text-soft border border-border-subtle rounded-md px-1.5 py-0.5 inline-block bg-surface-2 font-normal">
                                          CC: {group.rules[0].cost_center}
                                       </div>
                                    )}
                                 </td>
                                 <td className="p-4 text-text-main">
                                    {group.account ? (
                                       <span>{group.account.code} - {group.account.name}</span>
                                    ) : (
                                       <span className="italic text-xs text-text-soft/70">--</span>
                                    )}
                                 </td>
                                 <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                       <button
                                          onClick={() => handleEditGroup(group)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-brand border border-brand/20 bg-brand/5 hover:bg-brand/10 transition text-xs font-semibold shadow-sm cursor-pointer"
                                          title="Editar este registro"
                                       >
                                          <PencilIcon className="w-4 h-4" /> Editar
                                       </button>
                                       <button
                                          onClick={() => handleDeleteGroup(group)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-danger border border-danger/20 bg-danger/5 hover:bg-danger/10 transition text-xs font-semibold shadow-sm cursor-pointer"
                                          title="Eliminar este registro"
                                       >
                                          <TrashIcon className="w-4 h-4" /> Eliminar
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Create Rule Modal */}
         <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingGroup(null); }} title={editingGroup ? "Editar Registro de Asignación" : "Asignación Masiva de RUTs a Cuenta"} maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">1. Cuenta Contable Destino</label>
                  <AccountSelect
                     accounts={accounts}
                     value={formData.account_id}
                     onChange={(newAccId) => {
                        setFormData({ ...formData, account_id: newAccId });
                     }}
                  />
               </div>

               <div>
                  <div className="mb-2 flex items-center justify-between">
                     <label className="block text-xs font-semibold uppercase text-text-soft">2. RUTs y Razones Sociales</label>
                     <span className="text-[11px] text-text-soft">
                        Escribe el RUT y la Razón Social en un solo campo, o selecciona desde Contactos Registrados.
                     </span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto p-1 pr-2">
                     {formData.ruts.map((r, i) => (
                        <div key={i} className="flex gap-2 items-center">
                           <div className="flex-1">
                              <ContactSelect
                                 entityId={entityId}
                                 placeholder="Escribe RUT y Razón Social (ej: 76.123.456-7 - Empresa SpA)..."
                                 required
                                 className={ctrl}
                                 rut={r.rut}
                                 name={r.name}
                                 isLocked={Boolean(r.rut && r.name)}
                                 alreadySelectedRuts={formData.ruts.map((x, idx) => idx !== i ? x.rut : null).filter(Boolean)}
                                 value={r.displayValue !== undefined ? r.displayValue : (r.rut ? `${formatRut(r.rut)}${r.name ? ' - ' + r.name : ''}` : '')}
                                 onChange={(val) => handleUnifiedInputChange(i, val)}
                                 onSelect={(item) => handleContactSelect(i, item)}
                                 onSelectMultiple={(items) => handleContactSelectMultiple(i, items)}
                                 onClear={() => handleClearContact(i)}
                              />
                           </div>
                           {formData.ruts.length > 1 && (
                              <button 
                                 type="button" 
                                 onClick={() => removeRutRow(i)} 
                                 className="p-2 text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition shrink-0"
                                 title="Eliminar fila"
                              >
                                 <TrashIcon className="w-5 h-5" />
                              </button>
                           )}
                        </div>
                     ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                     <button 
                        type="button" 
                        onClick={addRutRow} 
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-hover bg-brand/10 hover:bg-brand/20 px-3 py-1.5 rounded-lg transition"
                     >
                        <PlusIcon className="w-4 h-4" /> Agregar otro RUT
                     </button>
                     <button 
                        type="button" 
                        onClick={() => setBatchPickerOpen(true)} 
                        className="flex items-center gap-1.5 text-xs font-semibold text-text-soft hover:text-text-main bg-surface-2 hover:bg-surface-3 px-3 py-1.5 rounded-lg transition"
                     >
                        <UserGroupIcon className="w-4 h-4 text-brand" /> Selección múltiple de Contactos Registrados
                     </button>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Glosa (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Insumos Médicos"
                     className={ctrl}
                     value={formData.glosa || ''}
                     onChange={(e) => setFormData({ ...formData, glosa: e.target.value })}
                  />
               </div>
               
               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Centro de Costo (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Proyecto Alpha"
                     className={ctrl}
                     value={formData.cost_center || ''}
                     onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                  />
               </div>

               <div className="flex items-center justify-between gap-3 pt-4 border-t border-border-subtle">
                  {editingGroup ? (
                     <button
                        type="button"
                        onClick={() => {
                           handleDeleteGroup(editingGroup);
                           setModalOpen(false);
                           setEditingGroup(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 rounded-xl transition cursor-pointer"
                        title="Eliminar este registro completo"
                     >
                        <TrashIcon className="w-4 h-4" /> Eliminar Registro
                     </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        onClick={() => {
                           setModalOpen(false);
                           setEditingGroup(null);
                        }}
                        className="px-4 py-2 text-text-soft text-xs font-semibold hover:text-text-main hover:bg-surface-2 rounded-xl transition cursor-pointer"
                     >
                        Cancelar
                     </button>
                     <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover shadow-sm transition disabled:opacity-50 cursor-pointer"
                     >
                        {submitting ? 'Guardando...' : 'Guardar Regla'}
                     </button>
                  </div>
               </div>
            </form>
         </Modal>

         {/* Directorio Centralizado de Contactos */}
         <ContactsDirectoryModal
            isOpen={contactsModalOpen}
            onClose={() => setContactsModalOpen(false)}
            entityId={entityId}
            onContactCreated={() => loadRules()}
         />

         {/* Selector Múltiple Rápido de Contactos */}
         <ContactsBatchPickerModal
            isOpen={batchPickerOpen}
            onClose={() => setBatchPickerOpen(false)}
            entityId={entityId}
            onAddContacts={handleAddBatchContacts}
            alreadySelectedRuts={formData.ruts.map((r) => r.rut)}
         />
      </div>
   );
}

