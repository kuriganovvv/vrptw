import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Диспетчеризация — Ростелеком',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'orders',
    title: 'Наряды дня — Ростелеком',
    loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
  },
  {
    path: 'staff',
    title: 'Сотрудники — Ростелеком',
    loadComponent: () => import('./features/staff/staff-page').then((m) => m.StaffPage),
  },
  {
    path: 'analytics',
    title: 'Аналитика смены — Ростелеком',
    loadComponent: () =>
      import('./features/analytics/analytics-page').then((m) => m.AnalyticsPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
