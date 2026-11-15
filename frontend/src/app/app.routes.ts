import { Routes } from '@angular/router';
import { employeeGuard, guestGuard } from './core/employee.guard';
import { DispatcherLayout } from './layout/dispatcher-layout';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Вход — Ростелеком',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/employee/login-page').then((m) => m.LoginPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '',
    component: DispatcherLayout,
    children: [
      {
        path: 'dashboard',
        title: 'Диспетчеризация — Ростелеком',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'orders',
        title: 'Наряды дня — Ростелеком',
        loadComponent: () =>
          import('./features/orders/orders-page').then((m) => m.OrdersPage),
      },
      {
        path: 'staff',
        title: 'Сотрудники — Ростелеком',
        loadComponent: () =>
          import('./features/staff/staff-page').then((m) => m.StaffPage),
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
    ],
  },
  {
    path: 'app',
    canActivate: [employeeGuard],
    loadComponent: () =>
      import('./features/employee/employee-layout').then((m) => m.EmployeeLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'shift' },
      {
        path: 'shift',
        title: 'Моя смена — Ростелеком',
        loadComponent: () =>
          import('./features/employee/employee-shift-page').then(
            (m) => m.EmployeeShiftPage,
          ),
      },
      {
        path: 'orders',
        title: 'Мои наряды — Ростелеком',
        loadComponent: () =>
          import('./features/employee/employee-orders-page').then(
            (m) => m.EmployeeOrdersPage,
          ),
      },
      {
        path: 'map',
        title: 'Моя карта — Ростелеком',
        loadComponent: () =>
          import('./features/employee/employee-map-page').then(
            (m) => m.EmployeeMapPage,
          ),
      },
      {
        path: 'profile',
        title: 'Профиль — Ростелеком',
        loadComponent: () =>
          import('./features/employee/employee-profile-page').then(
            (m) => m.EmployeeProfilePage,
          ),
      },
    ],
  },
  { path: 'field', redirectTo: 'app/shift' },
  { path: '**', redirectTo: 'dashboard' },
];
