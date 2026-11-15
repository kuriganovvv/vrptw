import { Injectable, computed, signal } from '@angular/core';

export type UserRole = 'dispatcher' | 'employee';

export interface Session {
  role: UserRole;
  /** Фамилия (или ФИО), которую ввёл пользователь на входе. */
  name: string;
  /** Табельный номер: есть только у сотрудника, нужен мобильному кабинету. */
  staffId: string | null;
}

const STORAGE_KEY = 'vrptw.session.v2';
/** Сессия прошлой версии (только табельный номер): больше не используется, её убираем. */
const LEGACY_KEY = 'vrptw.employee.staff_id';

function readStored(): Session | null {
  try {
    // Сессию старого формата игнорируем и удаляем: иначе после обновления стенда
    // человек попадает в кабинет сотрудника без экрана входа.
    window.localStorage.removeItem(LEGACY_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.role === 'dispatcher' || parsed?.role === 'employee' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Сессия демо-стенда. Вход выполняется только на фронтенде: роль, фамилия
 * и общий пароль `1234`; сервис планирования пароль не проверяет.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly state = signal<Session | null>(readStored());

  readonly session = this.state.asReadonly();
  readonly role = computed(() => this.state()?.role ?? null);
  readonly name = computed(() => this.state()?.name ?? '');
  readonly staffId = computed(() => this.state()?.staffId ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly isDispatcher = computed(() => this.state()?.role === 'dispatcher');

  loginDispatcher(name: string): void {
    this.persist({ role: 'dispatcher', name: name.trim() || 'Диспетчер', staffId: null });
  }

  loginEmployee(staffId: string, name: string): void {
    this.persist({
      role: 'employee',
      name: name.trim() || staffId,
      staffId: staffId.trim().toUpperCase(),
    });
  }

  logout(): void {
    this.state.set(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // приватный режим браузера: сессия останется только в памяти
    }
  }

  private persist(session: Session): void {
    this.state.set(session);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // приватный режим браузера: сессия останется только в памяти
    }
  }
}
