import {
   HomeIcon,
   BuildingOffice2Icon,
   ArrowTrendingDownIcon,
   ArrowTrendingUpIcon,
   BanknotesIcon,
   XMarkIcon,
   UserIcon,
   UserGroupIcon,
   LockClosedIcon, // importamos icono de candado cerrado para fijar
   LockOpenIcon,   // importamos icono de candado abierto para desfijar
} from '@heroicons/react/24/outline';
import { NavLink, useLocation } from 'react-router-dom';
import { useEntityRequired } from '../hooks/useEntityRequired';
import { withEntityId } from '../utils/withEntityId';
import { entityScopedPaths } from '../app/routes.config';
import { useAuth } from '../context/AuthContext';
import { useMemo, useState, useEffect, useRef } from 'react';

export default function Sidebar({ onLogout, onClose, collapsed, setCollapsed }) {

   const { pathname } = useLocation();
   const { entityId, ready: hasActiveEntity } = useEntityRequired();
   const { isClient } = useAuth();
   const hoverTimer = useRef(null);

   // estado para controlar si la barra esta fijada
   const [isPinned, setIsPinned] = useState(() => {
      try {
         return localStorage.getItem('sidebar_pinned') === 'true';
      } catch {
         return false;
      }
   });

   // efecto para guardar la preferencia y forzar la apertura si esta fijado
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
      // si esta fijado ignoramos la accion
      if (!canHover || isPinned) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setCollapsed?.(false), 80);
   };

   const handleMouseLeave = () => {
      // si esta fijado impedimos que se cierre al quitar el mouse
      if (!canHover || isPinned) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setCollapsed?.(true), 260);
   };

   useEffect(() => {
      return () => clearTimeout(hoverTimer.current);
   }, []);

   const menu = useMemo(
      () => {
         const baseMenu = [
            { label: 'Dashboard', to: '/dashboard', icon: HomeIcon },
            // clientes solo autogestionan su(s) entidad(es) asignada(s), no la administracion global
            ...(isClient ? [] : [
               { label: 'Super administradores', to: '/super-admin', icon: UserGroupIcon },
               { label: 'Entidades', to: '/entities', icon: BuildingOffice2Icon },
            ]),
         ];

         if (!hasActiveEntity) return baseMenu;

         return [
            ...baseMenu,
         // grupo ingresos
         {
            label: 'Ingresos',
            icon: ArrowTrendingUpIcon,
            children: [
               { label: 'Ventas (Boletas y Facturas)', to: '/income/sales-boletas' },
               { label: 'Cuentas por cobrar', to: '/income/receivables' },
            ],
         },

         // grupo egresos
         {
            label: 'Egresos',
            icon: ArrowTrendingDownIcon,
            children: [
               { label: 'Compras', to: '/expenses/purchases' },
               { label: 'Boletas de honorarios', to: '/expenses/honorarium-receipts' },
            ],
         },

         {
            label: 'Banco',
            icon: BanknotesIcon,
            children: [
               { label: 'Movimientos bancarios', to: '/bank/cartolas' },
               // la gestion de cuentas bancarias queda reservada al administrador
               ...(isClient ? [] : [{ label: 'Cuentas bancarias', to: '/bank/accounts' }]),
            ],
         },
         ];
      },
      [hasActiveEntity, isClient]
   );

   const initialOpen = useMemo(() => {
      const openKeys = new Set();
      const hasActive = (items) => {
         for (const it of items) {
            if (it.to && pathname.startsWith(it.to)) return true;
            if (it.children && hasActive(it.children)) return true;
         }
         return false;
      };
      const visit = (items, prefix = '') => {
         for (const item of items) {
            const key = `${prefix}/${item.label}`;
            if (item.children) {
               if (hasActive(item.children)) openKeys.add(key);
               visit(item.children, key);
            }
         }
      };
      visit(menu);
      return Object.fromEntries([...openKeys].map((k) => [k, true]));
   }, [menu, pathname]);

   const [open, setOpen] = useState(initialOpen);
   useEffect(() => {
      setOpen(initialOpen);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [pathname]);

   const toggle = (key) => setOpen((s) => ({ ...s, [key]: !s[key] }));

   const ItemRow = ({ icon: Icon, label, right, children, onClick, isGroup = false, to, showIcon = true, end = false, ...rest }) => {
      const base = 'flex items-center gap-3 px-2 py-2 rounded transition outline-none focus-visible:ring-2 focus-visible:ring-white/80';
      const hover = 'hover:bg-white/10';
      const content = (
         <div
            {...rest}
            className={`${base} ${hover}`}
            onClick={onClick}
            role={isGroup ? 'button' : undefined}
            aria-haspopup={isGroup ? 'true' : undefined}
            tabIndex={0}
            onKeyDown={(e) => isGroup && (e.key === 'Enter' || e.key === ' ') && onClick?.(e)}
            title={collapsed ? label : undefined}
            aria-label={label}
         >
            {showIcon && (Icon ? <Icon className="h-5 w-5 text-white shrink-0" /> : <UserIcon className="h-5 w-5 text-white" />)}
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && right}
         </div>
      );

      const needsEntity = to ? entityScopedPaths.has(to) : false;
      const targetTo = to ? (needsEntity ? withEntityId(to, entityId) : to) : null;
      const targetPath = targetTo ? new URL(targetTo, window.location.origin).pathname : null;
      const isActiveExact = targetPath ? (end ? pathname === targetPath : pathname.startsWith(targetPath)) : false;

      if (to) {
         return (
            <NavLink to={targetTo} end={end} className={`${isActiveExact ? 'bg-white/15' : ''} block rounded`}>
               {content}
            </NavLink>
         );
      }
      return content;
   };

   const Group = ({ item, prefix = '', depth = 0 }) => {
      const key = `${prefix}/${item.label}`;
      const isOpen = !!open[key];
      const panelId = `panel-${key.replace(/\W+/g, '-')}`;

      return (
         <li>
            <ItemRow
               icon={item.icon}
               label={item.label}
               isGroup
               onClick={() => toggle(key)}
               showIcon={depth === 0}
               aria-expanded={isOpen && !collapsed}
               aria-controls={panelId}
               right={
                  <svg className={`h-4 w-4 ml-auto transition-transform ${isOpen ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="none">
                     <path d="M7 5l6 5-6 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
               }
            />
            <div id={panelId} className={`pl-3 overflow-hidden transition-[max-height,opacity] duration-300 ${isOpen && !collapsed ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
               <ul className="mt-2 space-y-1">
                  {item.children?.map((child) =>
                     child.children ? (
                        <Group key={`${key}/${child.label}`} item={child} prefix={key} depth={depth + 1} />
                     ) : child.action === 'logout' ? (
                        <li key={`${key}/${child.label}`}>
                           <button onClick={onLogout} className="w-full text-left hover:bg-danger/90 block rounded" title={collapsed ? child.label : undefined} aria-label={child.label}>
                              <ItemRow icon={child.icon} label={child.label} showIcon={false} />
                           </button>
                        </li>
                     ) : (
                        <li key={`${key}/${child.label}`}>
                           <ItemRow icon={child.icon} label={child.label} to={child.to} showIcon={false} end={!!child.end} />
                        </li>
                     )
                  )}
               </ul>
            </div>
         </li>
      );
   };

   return (
      <div
         role="navigation"
         data-collapsed={collapsed}
         onMouseEnter={handleMouseEnter}
         onMouseLeave={handleMouseLeave}
         onFocusCapture={() => setCollapsed?.(false)}
         onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCollapsed?.(true); }}
         className={`h-full bg-brand text-white p-4 relative flex flex-col transition-all duration-300 ${collapsed ? 'w-[70px]' : 'w-[220px]'}`}
      >
         {/* boton de cerrar para movil */}
         <button onClick={onClose} className="md:hidden absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-[0.3rem] rounded-full shadow transition duration-300" aria-label="Cerrar menú">
            <XMarkIcon className="h-5 w-5 text-white" />
         </button>
         
         {/* seccion de cabecera que incluye titulo y el boton de fijar */}
         <div className="flex items-center justify-between mb-4 h-8">
            <h2 aria-hidden={collapsed} className={`text-2xl text-white font-medium whitespace-nowrap transition-opacity duration-300 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
               Leins Ad.
            </h2>
            
            {/* mostramos el candado solo en escritorio y cuando no esta colapsado */}
            {!collapsed && (
               <button
                  onClick={() => setIsPinned(!isPinned)}
                  className="hidden md:flex items-center justify-center p-1.5 rounded hover:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  title={isPinned ? 'Desfijar menú' : 'Fijar menú'}
                  aria-label={isPinned ? 'Desfijar menú' : 'Fijar menú'}
               >
                  {isPinned ? (
                     <LockClosedIcon className="w-5 h-5 text-white" />
                  ) : (
                     <LockOpenIcon className="w-5 h-5 text-white/70" />
                  )}
               </button>
            )}
         </div>

         <nav className="flex-1 custom-scrollbar overflow-y-auto">
            <ul className="space-y-2">
               {menu.map((item) =>
                  item.children ? (
                     <Group key={item.label} item={item} />
                  ) : item.action === 'logout' ? (
                     <li key={item.label}>
                        <button onClick={onLogout} className="w-full text-left hover:bg-danger/90 block rounded" title={collapsed ? item.label : undefined} aria-label={item.label}>
                           <ItemRow icon={item.icon} label={item.label} />
                        </button>
                     </li>
                  ) : (
                     <li key={item.label}>
                        <ItemRow icon={item.icon} label={item.label} to={item.to} end={!!item.end} />
                     </li>
                  )
               )}
            </ul>
         </nav>
      </div>
   );
}
