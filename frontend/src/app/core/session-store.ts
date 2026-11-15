import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'vrptw.employee.staff_id';

function readStoredStaffId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Сессия мобильного сотрудника. Вход выполняется только на фронтенде:
 * логин — это `staff_id` из справочника сервиса, пароль не проверяется.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly staffIdState = signal<string | null>(readStoredStaffId());

  readonly staffId = this.staffIdState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.staffIdState()));

  login(staffId: string): void {
    const normalized = staffId.trim().toUpperCase();
    this.staffIdState.set(normalized);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // приватный режим браузера: сессия останется только в памяти
    }
  }

  logout(): void {
    this.staffIdState.set(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ничего не хранили — и хорошо
    }
  }
}
