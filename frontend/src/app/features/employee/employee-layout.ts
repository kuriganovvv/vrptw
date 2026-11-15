import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DispatchStore } from '../../core/dispatch-store';
import { SessionStore } from '../../core/session-store';
import { Icon, IconName } from '../../shared/icon';

interface EmployeeNavItem {
  path: string;
  label: string;
  icon: IconName;
}

const NAV: EmployeeNavItem[] = [
  { path: '/app/shift', label: 'Смена', icon: 'map-pin' },
  { path: '/app/orders', label: 'Наряды', icon: 'clipboard-list' },
  { path: '/app/map', label: 'Карта', icon: 'map' },
  { path: '/app/profile', label: 'Профиль', icon: 'user' },
];

@Component({
  selector: 'app-employee-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col bg-canvas">
      <header
        class="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur"
      >
        <svg viewBox="0 0 44 44" class="size-7 shrink-0" aria-hidden="true">
          <path fill="#5A2D82" d="M5 5h25.5L25 14.5H14.5V39H5z" />
          <path fill="#8B5CF6" d="M35.5 5H39v15.5L20.5 39 24 26l11.5-6.5z" />
        </svg>
        <div class="leading-tight">
          <div class="text-[13px] font-semibold text-brand">Ростелеком</div>
          <div class="text-[10px] text-slate-500">Мобильный сотрудник</div>
        </div>

        <span
          class="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
          [class]="shiftStatus().cls"
        >
          <span class="size-1.5 rounded-full" [class]="shiftStatus().dot"></span>
          {{ shiftStatus().label }}
        </span>
      </header>

      <main class="flex-1 px-4 pb-24 pt-4">
        <router-outlet />
      </main>

      <nav
        class="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md border-t border-slate-200 bg-white/95 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur"
        aria-label="Разделы сотрудника"
      >
        @for (item of nav; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-brand"
            #link="routerLinkActive"
            class="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] text-slate-500 transition-colors"
          >
            <span
              class="grid size-8 place-items-center rounded-full transition-colors"
              [class.bg-brand-50]="link.isActive"
            >
              <app-icon [name]="item.icon" class="size-[19px]" />
            </span>
            {{ item.label }}
          </a>
        }
      </nav>
    </div>
  `,
})
export class EmployeeLayout {
  protected readonly store = inject(DispatchStore);
  private readonly session = inject(SessionStore);

  protected readonly nav = NAV;

  constructor() {
    // Мобильный кабинет показывает только данные сервиса: демо-фолбэка здесь нет.
    if (this.store.apiStatus() !== 'online') this.store.loadFromBackend();
  }

  protected readonly shiftStatus = computed(() => {
    if (this.store.employeeError()) {
      return { label: 'Нет связи', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' };
    }
    if (this.store.employeeLoading()) {
      return { label: 'Синхронизация', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
    }
    const route = this.store.routeFor(this.session.staffId());
    return route
      ? { label: 'В смене', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
      : { label: 'Вне смены', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
  });
}
