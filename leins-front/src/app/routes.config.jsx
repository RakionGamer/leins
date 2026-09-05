import { lazy } from 'react';

// paginas
const Login = lazy(() => import('../pages/Login'));
const ClientLogin = lazy(() => import('../pages/ClientLogin'));
const Home = lazy(() => import('../pages/Home'));
const EntitiesPage = lazy(() => import('../pages/entities/EntitiesPage'));
const BankCartolasPage = lazy(() => import('../pages/bank/BankCartolasPage'));
const BankAccountsPage = lazy(() => import('../pages/bank/BankAccountsPage'));
const PurchaseInvoices = lazy(() => import('../pages/egress/PurchaseInvoices'));
const SalesHonorariumReceipts = lazy(() => import('../pages/income/SalesHonorariumReceipts'));
const SalesBoletas = lazy(() => import('../pages/income/SalesBoletas'));
const Receivables = lazy(() => import('../pages/income/Receivables'));
const Profile = lazy(() => import('../pages/profile/Profile'));
const ProfileEdit = lazy(() => import('../pages/profile/ProfileEdit'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const SuperAdminList = lazy(() => import('../pages/superAdmin/SuperAdminList'));
const SuperAdminCreate = lazy(() => import('../pages/superAdmin/SuperAdminCreate'));
const SuperAdminEdit = lazy(() => import('../pages/superAdmin/SuperAdminEdit'));

// layout y fallback
const DashboardLayout = lazy(() => import('../layouts/DashboardLayout'));
const Stub = lazy(() => import('../components/Stub'));

export const routesConfig = [
   // publicas
   { path: '/login', element: <Login />, public: true },
   { path: '/portal/login', element: <ClientLogin />, public: true },

   // privadas (arbol con layout)
   {
      path: '/',
      private: true,
      layout: <DashboardLayout />,
      children: [
         { index: true, element: <Home /> },
         { path: 'dashboard', element: <Home /> },
         { path: 'entities', element: <EntitiesPage /> },
         { path: 'super-admin', element: <SuperAdminList /> },
         { path: 'super-admin/create', element: <SuperAdminCreate /> },
         { path: 'super-admin/edit/:id', element: <SuperAdminEdit /> },
         { path: 'bank/cartolas', element: <BankCartolasPage /> },
         { path: 'bank/accounts', element: <BankAccountsPage /> },
         { path: 'expenses/purchases', element: <PurchaseInvoices /> },
         { path: 'expenses/honorarium-receipts', element: <SalesHonorariumReceipts /> },
         { path: 'income/sales-honorarium-receipts', element: <SalesHonorariumReceipts /> },
         { path: 'income/sales-boletas', element: <SalesBoletas /> },
         { path: 'income/receivables', element: <Receivables /> },
         { path: 'profile', element: <Profile /> },
         { path: 'profile/edit', element: <ProfileEdit /> },
         { path: '*', element: <Stub title="No encontrado" /> },
      ],
   },
   {
      path: '/forgot-password',
      element: <ForgotPassword />,
      public: true,
   },
   {
      path: '/auth/reset-password',
      element: <ResetPassword />,
      public: true,
   },
];

// 👇 agrega/quita aquí las rutas que deben llevar ?entityId=
export const entityScopedPaths = new Set([
   '/dashboard',
   '/bank/cartolas',
   '/bank/accounts',
   '/expenses/purchases',
   '/expenses/honorarium-receipts',
   '/income/sales-boletas',
   '/income/receivables',
   '/income/sales-honorarium-receipts',
]);
