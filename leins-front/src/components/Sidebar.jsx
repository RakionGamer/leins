import React, { useMemo, useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import JeitoLogo from './JeitoLogo';
import JeitoSmile from './JeitoSmile';
import {
   InicioIcon,
   EntidadesIcon,
   AdministradoresIcon,
   IngresosIcon,
   EgresosIcon,
   BancoIcon,
   FlujoIcon,
   GraficoIcon,
   ContabilidadIcon,
   TareasIcon,
   MenuIcon,
   ChevronRightIcon,
   CerrarIcon,
} from './icons/SidebarIcons';
import { useEntityRequired } from '../hooks/useEntityRequired';
import { withEntityId } from '../utils/withEntityId';
import { entityScopedPaths } from '../app/routes.config';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

export default function Sidebar({ onLogout, onClose, collapsed, setCollapsed }) {
   const { pathname } = useLocation();
   const { entityId, ready: hasActiveEntity } = useEntityRequired();
   const { isClient } = useAuth();
   const { can } = usePermissions();
   const hoverTimer = useRef(null);

   const [isPinned, setIsPinned] = useState(() => {
      try {
         return localStorage.getItem('sidebar_pinned') === 'true';
      } catch {
         return false;
      }
   });

   useEffect(() => {
      try {
         localStorage.setItem('sidebar_pinned', isPinned);
      } catch (e) {}

      if (isPinned) {
         setCollapsed?.(false);
      }
   }, [isPinned, setCollapsed]);

   const canHover = useMemo(() => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
      return window.matchMedia('(hover: hover)').matches;
   }, []);

   const handleMouseEnter = () => {
      if (!canHover || isPinned) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setCollapsed?.(false), 80);
   };

   const handleMouseLeave = () => {
      if (!canHover || isPinned) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setCollapsed?.(true), 260);
   };

   useEffect(() => {
      return () => clearTimeout(hoverTimer.current);
   }, []);

   // Grupos de menú con la estructura exacta del diseño de referencia
   const sections = useMemo(() => {
      const generalItems = [
         { label: 'Panel de control', to: '/dashboard', icon: InicioIcon, end: true },
         ...(isClient ? [] : [
            { label: 'Entidades', to: '/entities', icon: EntidadesIcon },
            { label: 'Super administradores', to: '/super-admin', icon: AdministradoresIcon },
         ]),
      ];

      const operacionItems = [
         ...(can('income_sales', 'view') || can('income_receivables', 'view') ? [{
            label: 'Ingresos',
            icon: IngresosIcon,
            to: '/income/sales-boletas',
            hasSubmenu: true,
            children: [
               { label: 'Ventas (Boletas y Facturas)', to: '/income/sales-boletas' },
               { label: 'Cuentas por cobrar', to: '/income/receivables' },
            ],
         }] : []),
         ...(can('expenses_purchases', 'view') || can('expenses_payables', 'view') ? [{
            label: 'Egresos',
            icon: EgresosIcon,
            to: '/expenses/purchases',
            hasSubmenu: true,
            children: [
               { label: 'Compras', to: '/expenses/purchases' },
               { label: 'Boletas de honorarios', to: '/expenses/honorarium-receipts' },
               { label: 'Cuentas por pagar', to: '/expenses/payables' },
            ],
         }] : []),
         ...(can('bank_movements', 'view') || can('bank_accounts', 'view') ? [{
            label: 'Banco',
            icon: BancoIcon,
            to: '/bank/cartolas',
            hasSubmenu: true,
            children: [
               { label: 'Movimientos bancarios', to: '/bank/cartolas' },
               { label: 'Cuentas bancarias', to: '/bank/accounts' },
            ],
         }] : []),
      ];

      const reportesItems = [
         ...(can('accounting', 'reports_view') ? [
            { label: 'Flujo de caja', icon: FlujoIcon, to: '/accounting/cash-flow' },
            { label: 'Estado de resultados', icon: GraficoIcon, to: '/accounting/income-statement' },
         ] : []),
         ...(can('accounting', 'entries_view') || can('accounting', 'accounts_view') ? [{
            label: 'Contabilidad',
            icon: ContabilidadIcon,
            to: '/accounting/entries',
            hasSubmenu: true,
            children: [
               { label: 'Asientos contables', to: '/accounting/entries' },
               { label: 'Plan de cuentas', to: '/accounting/accounts' },
               { label: 'Asociación proveedores', to: '/accounting/rules' },
               { label: 'Saldos por RUT', to: '/accounting/balances' },
            ],
         }] : []),
      ];

      const equipoItems = [
         {
            label: 'Tareas y controles',
            icon: TareasIcon,
            to: '#',
            badge: 'Pronto',
            disabled: true,
         },
      ];

      return [
         { title: 'GENERAL', items: generalItems },
         ...(hasActiveEntity && operacionItems.length ? [{ title: 'OPERACIÓN', items: operacionItems }] : []),
         ...(hasActiveEntity && reportesItems.length ? [{ title: 'REPORTES', items: reportesItems }] : []),
         { title: 'EQUIPO', items: equipoItems },
      ];
   }, [hasActiveEntity, isClient, can]);

   // Control de submenús abiertos
   const [openSubmenus, setOpenSubmenus] = useState({});
   const toggleSubmenu = (label) => {
      setOpenSubmenus((prev) => ({ ...prev, [label]: !prev[label] }));
   };

   return (
      <aside
         role="navigation"
         aria-label="Menú principal"
         onMouseEnter={handleMouseEnter}
         onMouseLeave={handleMouseLeave}
         className={`h-full bg-[#0A1A3F] dark:bg-[#071128] dark:border-r dark:border-[#15254A] text-white p-4 flex flex-col justify-between transition-all duration-300 select-none overflow-x-hidden ${
            collapsed ? 'w-[70px]' : 'w-[240px]'
         }`}
      >
         {/* CABECERA: Logo Jeito + Toggle Menú */}
         <div className="flex-1 flex flex-col min-h-0 overflow-x-hidden">
            <div className="flex items-center justify-between mb-6 h-9 px-1 shrink-0">
               <NavLink to="/dashboard" className="flex items-center">
                  <JeitoLogo
                     className={`${collapsed ? 'w-8' : 'w-24'} h-auto text-white transition-all`}
                     dotColor="#1F6BFF"
                     textColor="#FFFFFF"
                  />
               </NavLink>

               {/* Botón toggle / collapse */}
               {!collapsed && (
                  <button
                     type="button"
                     onClick={() => setCollapsed?.(!collapsed)}
                     className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                     aria-label="Colapsar menú"
                     title="Colapsar menú"
                  >
                     <MenuIcon className="w-5 h-5" />
                  </button>
               )}

               {/* Botón cerrar para móviles */}
               <button
                  type="button"
                  onClick={onClose}
                  className="md:hidden p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                  aria-label="Cerrar menú"
               >
                  <CerrarIcon className="w-5 h-5" />
               </button>
            </div>

            {/* SECCIONES DE NAVEGACIÓN */}
            <nav className="space-y-6 overflow-y-auto overflow-x-hidden flex-1 pr-1 sidebar-scrollbar">
               {sections.map((section) => (
                  <div key={section.title} className="space-y-1">
                     {!collapsed && (
                        <h3 className="px-3 text-[11px] font-sans font-bold tracking-wider text-[#7081AA] uppercase mb-2">
                           {section.title}
                        </h3>
                     )}
                     <ul className="space-y-1">
                        {section.items.map((item) => {
                           const Icon = item.icon;
                           const targetTo = item.to
                              ? entityScopedPaths.has(item.to)
                                 ? withEntityId(item.to, entityId)
                                 : item.to
                              : null;
                           const isActive =
                              targetTo && targetTo !== '#'
                                 ? item.end
                                    ? pathname === targetTo || (pathname === '/dashboard' && targetTo === '/dashboard')
                                    : pathname.startsWith(targetTo)
                                 : false;

                           const isSubOpen = !!openSubmenus[item.label];

                           if (item.disabled) {
                              return (
                                 <li key={item.label}>
                                    <div
                                       className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-[#B9C6E4] ${
                                          collapsed ? 'justify-center px-2' : ''
                                       }`}
                                       title={item.label}
                                    >
                                       <div className="flex items-center gap-3.5 min-w-0 pr-1">
                                          <Icon className="w-5 h-5 shrink-0 text-[#B9C6E4]" />
                                          {!collapsed && <span className="truncate">{item.label}</span>}
                                       </div>
                                       {!collapsed && item.badge && (
                                          <span className="text-[11px] font-semibold italic px-2 py-0.5 rounded-full bg-[#13285C] text-[#B9C6E4] shrink-0">
                                             {item.badge}
                                          </span>
                                       )}
                                    </div>
                                 </li>
                              );
                           }

                           if (item.hasSubmenu && !collapsed) {
                              return (
                                 <li key={item.label}>
                                    <button
                                       type="button"
                                       onClick={() => toggleSubmenu(item.label)}
                                       className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                                          isActive
                                             ? 'bg-[#13285C] text-white font-medium'
                                             : 'text-[#B9C6E4] hover:text-white hover:bg-white/5'
                                       }`}
                                    >
                                       <div className="flex items-center gap-3.5 min-w-0 pr-1">
                                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#B9C6E4]'}`} />
                                          <span className="truncate">{item.label}</span>
                                       </div>
                                       <ChevronRightIcon
                                          className={`w-4 h-4 text-[#7081AA] shrink-0 transition-transform duration-200 ${
                                             isSubOpen ? 'rotate-90 text-white' : ''
                                          }`}
                                       />
                                    </button>

                                    {/* Submenú desplegable */}
                                    {isSubOpen && (
                                       <ul className="mt-1 ml-7 space-y-1 pl-2 border-l border-[#13285C]">
                                          {item.children.map((sub) => {
                                             const subTo = withEntityId(sub.to, entityId);
                                             const isSubActive = pathname === subTo || pathname.startsWith(subTo);
                                             return (
                                                <li key={sub.label}>
                                                   <NavLink
                                                      to={subTo}
                                                      className={`block px-2.5 py-1.5 rounded-lg text-xs font-normal transition-colors ${
                                                         isSubActive
                                                            ? 'text-[#1F6BFF] font-semibold'
                                                            : 'text-[#B9C6E4] hover:text-white'
                                                      }`}
                                                   >
                                                      {sub.label}
                                                   </NavLink>
                                                </li>
                                             );
                                          })}
                                       </ul>
                                    )}
                                 </li>
                              );
                           }

                           return (
                              <li key={item.label}>
                                 <NavLink
                                    to={targetTo || '#'}
                                    end={item.end}
                                    title={collapsed ? item.label : undefined}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                                       isActive
                                          ? 'bg-[#13285C] text-white font-medium'
                                          : 'text-[#B9C6E4] hover:text-white hover:bg-white/5'
                                    } ${collapsed ? 'justify-center px-2' : ''}`}
                                 >
                                    <div className="flex items-center gap-3.5 min-w-0 pr-1">
                                       <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#B9C6E4]'}`} />
                                       {!collapsed && <span className="truncate">{item.label}</span>}
                                    </div>
                                 </NavLink>
                              </li>
                           );
                        })}
                     </ul>
                  </div>
               ))}
            </nav>
         </div>

         {/* PIE DEL SIDEBAR: "¿Te ayudamos? Escríbenos a hola@jeito.cl" */}
         <div className="pt-4 border-t border-[#13285C]">
            {!collapsed ? (
               <div className="flex items-center gap-3 p-2 rounded-xl bg-[#07122B]/50 dark:bg-[#0C1C3E] dark:border dark:border-[#192F5E]">
                  <JeitoSmile className="w-7 h-7 shrink-0" mouthColor="#FFFFFF" eyeColor="#1F6BFF" />
                  <div className="min-w-0">
                     <p className="text-xs font-bold text-white leading-tight">¿Te ayudamos?</p>
                     <a
                        href="mailto:hola@jeito.cl"
                        className="text-[11px] text-[#8E9BB5] hover:text-[#7FAAFF] transition-colors truncate block"
                     >
                        Escríbenos a hola@jeito.cl
                     </a>
                  </div>
               </div>
            ) : (
               <div className="flex justify-center" title="hola@jeito.cl">
                  <JeitoSmile className="w-6 h-6" mouthColor="#FFFFFF" eyeColor="#1F6BFF" />
               </div>
            )}
         </div>
      </aside>
   );
}
