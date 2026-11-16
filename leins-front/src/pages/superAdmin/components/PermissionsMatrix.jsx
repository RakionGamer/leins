// leins-front/src/pages/superAdmin/components/PermissionsMatrix.jsx
import React, { useMemo } from 'react';
import {
   PERMISSION_MODULES,
   PERMISSION_PRESETS,
   getPresetPermissions,
} from '../../../constants/permissions';
import {
   BanknotesIcon,
   BuildingOffice2Icon,
   ArrowTrendingUpIcon,
   ArrowTrendingDownIcon,
   BookOpenIcon,
   CheckCircleIcon,
   XCircleIcon,
   ShieldCheckIcon,
   SparklesIcon,
} from '@heroicons/react/24/outline';

const MODULE_ICONS = {
   bank_movements: BanknotesIcon,
   bank_accounts: BuildingOffice2Icon,
   income_sales: ArrowTrendingUpIcon,
   income_receivables: ArrowTrendingUpIcon,
   expenses_purchases: ArrowTrendingDownIcon,
   expenses_honorarium: ArrowTrendingDownIcon,
   expenses_payables: ArrowTrendingDownIcon,
   accounting: BookOpenIcon,
   entities: BuildingOffice2Icon,
};

export default function PermissionsMatrix({ permissions, onChange, disabled = false }) {
   // Calcular resumen de permisos activos
   const { activeCount, totalCount } = useMemo(() => {
      let active = 0;
      let total = 0;
      for (const [modKey, modVal] of Object.entries(PERMISSION_MODULES)) {
         for (const p of modVal.permissions) {
            total++;
            if (permissions?.[modKey]?.[p.key]) active++;
         }
      }
      return { activeCount: active, totalCount: total };
   }, [permissions]);

   const handleToggleSingle = (moduleKey, permKey) => {
      if (disabled) return;
      const current = Boolean(permissions?.[moduleKey]?.[permKey]);
      const nextMod = { ...(permissions?.[moduleKey] || {}), [permKey]: !current };
      onChange({ ...(permissions || {}), [moduleKey]: nextMod });
   };

   const handleToggleModuleAll = (moduleKey, value) => {
      if (disabled) return;
      const modDef = PERMISSION_MODULES[moduleKey];
      if (!modDef) return;
      const nextMod = { ...(permissions?.[moduleKey] || {}) };
      for (const p of modDef.permissions) {
         nextMod[p.key] = value;
      }
      onChange({ ...(permissions || {}), [moduleKey]: nextMod });
   };

   const handleApplyPreset = (presetKey) => {
      if (disabled) return;
      const presetValues = getPresetPermissions(presetKey);
      onChange(presetValues);
   };

   return (
      <div className="space-y-6">
         {/* BARRA SUPERIOR DE PRESETS Y CONTADOR */}
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 border border-border-subtle rounded-2xl">
            <div>
               <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-brand" />
                  <span className="text-sm font-bold text-heading dark:text-white">Matriz de Permisos</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-bold">
                     {activeCount} / {totalCount} activos
                  </span>
               </div>
               <p className="text-xs text-text-soft mt-0.5">
                  Asigna permisos directos o aplica una plantilla de acceso rápido.
               </p>
            </div>

            {/* PRESETS RÁPIDOS */}
            <div className="flex flex-wrap items-center gap-2">
               <span className="text-xs font-semibold text-text-soft flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5 text-brand" /> Plantillas:
               </span>
               {PERMISSION_PRESETS.map((preset) => (
                  <button
                     key={preset.key}
                     type="button"
                     disabled={disabled}
                     onClick={() => handleApplyPreset(preset.key)}
                     title={preset.desc}
                     className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border-subtle bg-bg-content hover:bg-brand/10 hover:border-brand/40 hover:text-brand text-text-main transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                     {preset.label}
                  </button>
               ))}
            </div>
         </div>

         {/* REJILLA MODULAR */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(PERMISSION_MODULES).map(([modKey, modDef]) => {
               const Icon = MODULE_ICONS[modKey] || ShieldCheckIcon;
               const modPerms = permissions?.[modKey] || {};
               const modTotal = modDef.permissions.length;
               const modActive = modDef.permissions.filter((p) => modPerms[p.key]).length;
               const allActive = modActive === modTotal;

               return (
                  <div
                     key={modKey}
                     className="border border-border-subtle rounded-2xl bg-bg-content p-4 shadow-2xs hover:shadow-soft transition-all duration-200"
                  >
                     {/* ENCABEZADO DE MÓDULO */}
                     <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle">
                        <div className="flex items-center gap-2.5">
                           <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4" />
                           </div>
                           <div>
                              <h3 className="text-sm font-bold text-heading dark:text-white leading-tight">
                                 {modDef.label}
                              </h3>
                              <p className="text-[11px] text-text-soft">{modDef.description}</p>
                           </div>
                        </div>

                        {/* ACCIONES DEL MÓDULO */}
                        <div className="flex items-center gap-1.5 shrink-0">
                           <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleToggleModuleAll(modKey, !allActive)}
                              className={`text-[11px] font-bold px-2 py-1 rounded-md transition ${
                                 allActive
                                    ? 'text-danger hover:bg-danger/10'
                                    : 'text-brand hover:bg-brand/10'
                              } cursor-pointer disabled:opacity-50`}
                           >
                              {allActive ? 'Desmarcar' : 'Marcar todo'}
                           </button>
                        </div>
                     </div>

                     {/* REJILLA DE PERMISOS */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {modDef.permissions.map((p) => {
                           const isChecked = Boolean(modPerms[p.key]);

                           return (
                              <div
                                 key={p.key}
                                 onClick={() => handleToggleSingle(modKey, p.key)}
                                 className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                    isChecked
                                       ? 'bg-brand/5 border-brand/30 dark:bg-brand/10 dark:border-brand/40'
                                       : 'bg-gray-50/50 dark:bg-white/5 border-border-subtle/70 opacity-80 hover:opacity-100 hover:border-border-subtle'
                                 } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                 <div className="pr-2 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                       <span
                                          className={`text-xs font-medium leading-snug truncate ${
                                             isChecked
                                                ? 'text-heading dark:text-white font-semibold'
                                                : 'text-text-soft'
                                          }`}
                                          title={p.label}
                                       >
                                          {p.label}
                                       </span>
                                       {p.badge && (
                                          <span
                                             className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                                p.badge === 'Crítico'
                                                   ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                   : p.badge === 'Peligro'
                                                   ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                                   : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                             }`}
                                          >
                                             {p.badge}
                                          </span>
                                       )}
                                    </div>
                                 </div>

                                 {/* SWITCH ESTILIZADO */}
                                 <div className="shrink-0">
                                    <div
                                       className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                          isChecked ? 'bg-brand' : 'bg-gray-300 dark:bg-neutral-700'
                                       }`}
                                    >
                                       <div
                                          className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                                             isChecked ? 'translate-x-3.5' : 'translate-x-0'
                                          }`}
                                       />
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}
