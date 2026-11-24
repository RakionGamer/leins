// leins-front/src/pages/superAdmin/components/PermissionsMatrix.jsx
import React, { useMemo } from 'react';
import {
   PERMISSION_MODULES,
   PERMISSION_PRESETS,
   getPresetPermissions,
} from '../../../constants/permissions';
import { SparklesIcon } from '@heroicons/react/24/outline';
import {
   BancoIcon,
   IngresosIcon,
   EgresosIcon,
   ContabilidadIcon,
   EntidadesIcon,
   CandadoIcon,
} from '../../../components/icons/SidebarIcons';

const MODULE_ICONS = {
   bank_movements: BancoIcon,
   bank_accounts: BancoIcon,
   income_sales: IngresosIcon,
   income_receivables: IngresosIcon,
   expenses_purchases: EgresosIcon,
   expenses_honorarium: EgresosIcon,
   expenses_payables: EgresosIcon,
   accounting: ContabilidadIcon,
   entities: EntidadesIcon,
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
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 sm:p-5 bg-[#F8FAFF] border border-[#E2EAFD] rounded-2xl">
            <div>
               <div className="flex items-center gap-2">
                  <CandadoIcon className="w-5 h-5 text-[#1F6BFF]" />
                  <span className="text-sm font-black font-nunito text-[#0A1A3F]">
                     Matriz de Permisos
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EFF3FF] text-[#1F6BFF] font-bold border border-[#DCE5FF]">
                     {activeCount} / {totalCount} activos
                  </span>
               </div>
               <p className="text-xs text-[#55607A] mt-0.5">
                  Asigna permisos directos por módulo o aplica una plantilla de acceso rápido.
               </p>
            </div>

            {/* PRESETS RÁPIDOS */}
            <div className="flex flex-wrap items-center gap-2">
               <span className="text-xs font-semibold text-[#55607A] flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5 text-[#1F6BFF]" /> Plantillas:
               </span>
               {PERMISSION_PRESETS.map((preset) => (
                  <button
                     key={preset.key}
                     type="button"
                     disabled={disabled}
                     onClick={() => handleApplyPreset(preset.key)}
                     title={preset.desc}
                     className="px-3 py-1.5 text-xs font-bold rounded-xl border border-[#E2EAFD] bg-white hover:border-[#1F6BFF] hover:text-[#1F6BFF] text-[#0A1A3F] transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                     {preset.label}
                  </button>
               ))}
            </div>
         </div>

         {/* REJILLA MODULAR */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(PERMISSION_MODULES).map(([modKey, modDef]) => {
               const Icon = MODULE_ICONS[modKey] || CandadoIcon;
               const modPerms = permissions?.[modKey] || {};
               const modTotal = modDef.permissions.length;
               const modActive = modDef.permissions.filter((p) => modPerms[p.key]).length;
               const allActive = modActive === modTotal;

               return (
                  <div
                     key={modKey}
                     className="border border-[#E2EAFD] rounded-2xl bg-white p-5 shadow-xs hover:border-[#DCE5FF] transition-all duration-200 flex flex-col justify-between"
                  >
                     {/* ENCABEZADO DE MÓDULO */}
                     <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#E2EAFD]">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-[#EFF3FF] text-[#0A1A3F] flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-[#0A1A3F]" />
                           </div>
                           <div>
                              <h3 className="text-sm font-black font-nunito text-[#0A1A3F] leading-tight">
                                 {modDef.label}
                              </h3>
                              <p className="text-[11px] text-[#55607A] mt-0.5">{modDef.description}</p>
                           </div>
                        </div>

                        {/* ACCIONES DEL MÓDULO */}
                        <div className="flex items-center gap-1.5 shrink-0">
                           <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleToggleModuleAll(modKey, !allActive)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-50 ${
                                 allActive
                                    ? 'text-[#E5484D] hover:bg-[#FDF0F0]'
                                    : 'text-[#1F6BFF] hover:bg-[#EFF3FF]'
                              }`}
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
                                 className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none min-h-[46px] ${
                                    isChecked
                                       ? 'bg-[#F0F4FD] border-[#1F6BFF]/40 shadow-xs'
                                       : 'bg-[#FAFCFF] border-[#E2EAFD] hover:border-[#D9E2EC]'
                                 } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                 <div className="pr-2 min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                                    <span
                                       className={`text-xs leading-snug ${
                                          isChecked
                                             ? 'text-[#0A1A3F] font-bold'
                                             : 'text-[#55607A] font-medium'
                                       }`}
                                    >
                                       {p.label}
                                    </span>
                                    {p.badge && (
                                       <span
                                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                                             p.badge === 'Crítico'
                                                ? 'bg-amber-100 text-amber-800'
                                                : p.badge === 'Peligro'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-[#EFF3FF] text-[#1F6BFF]'
                                          }`}
                                       >
                                          {p.badge}
                                       </span>
                                    )}
                                 </div>

                                 {/* SWITCH ESTILIZADO */}
                                 <div className="shrink-0 ml-2">
                                    <div
                                       className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                          isChecked ? 'bg-[#1F6BFF]' : 'bg-[#D1D5DB]'
                                       }`}
                                    >
                                       <div
                                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                                             isChecked ? 'translate-x-4' : 'translate-x-0'
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
