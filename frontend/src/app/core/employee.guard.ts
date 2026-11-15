import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session-store';

/** Кабинет диспетчера: только после входа с ролью «Диспетчер». */
export const dispatcherGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.isAuthenticated()) return router.createUrlTree(['/login']);
  return session.isDispatcher() ? true : router.createUrlTree(['/app/shift']);
};

/** Мобильные разделы доступны только после входа сотрудника. */
export const employeeGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.isAuthenticated()) return router.createUrlTree(['/login']);
  return session.role() === 'employee' ? true : router.createUrlTree(['/dashboard']);
};

/** Вошедшему пользователю страница входа не нужна: отправляем в его кабинет. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!session.isAuthenticated()) return true;
  return router.createUrlTree([session.isDispatcher() ? '/dashboard' : '/app/shift']);
};
