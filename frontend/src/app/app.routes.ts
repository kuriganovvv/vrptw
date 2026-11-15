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
  {
    path: 'scenarios',
    title: 'Сценарии смены — Ростелеком',
    loadComponent: () =>
      import('./features/scenarios/scenarios-page').then((m) => m.ScenariosPage),
  },
  {
    path: 'field',
    title: 'Выезд бригады — Ростелеком',
    loadComponent: () => import('./features/field/field-page').then((m) => m.FieldPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
