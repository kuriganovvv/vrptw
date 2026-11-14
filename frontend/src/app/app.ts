import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { DispatchStore } from './core/dispatch-store';
import { fmtDateLong, fmtTime } from './core/time';
import { Icon, IconName } from './shared/icon';

interface NavItem {
  path: string;
  label: string;
  short: string;
  icon: IconName;
  title: string;
}

const NAV: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Диспетчеризация',
    short: 'План',
    icon: 'radar',
    title: 'Диспетчеризация выездных бригад',
  },
  {
    path: '/orders',
    label: 'Наряды',
    short: 'Наряды',
    icon: 'clipboard-list',
    title: 'Наряды дня',
  },
  {
    path: '/staff',
    label: 'Сотрудники',
    short: 'Бригады',
    icon: 'users',
    title: 'Сотрудники на смене',
  },
  {
    path: '/analytics',
    label: 'Аналитика',
    short: 'Метрики',
    icon: 'bar-chart-3',
    title: 'Аналитика смены',
  },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(DispatchStore);
  private readonly router = inject(Router);

  readonly nav = NAV;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly current = computed(() => {
    const url = this.url();
    return (
      NAV.find((item) => url.startsWith(item.path)) ??
      (url.startsWith('/orders') ? NAV[1] : NAV[0])
    );
  });

  readonly dateLabel = computed(() => fmtDateLong(this.store.plan().date));
  readonly planStamp = computed(
    () => `План v${this.store.plan().plan_version} · ${fmtTime(this.store.plan().as_of)}`,
  );

  readonly totalOrders = computed(
    () => this.store.plan().summary?.orders_total ?? this.store.orders().length,
  );

  badgeFor(item: NavItem): string | null {
    if (item.path === '/orders') return String(this.totalOrders());
    return null;
  }

  replan(): void {
    this.store.replan();
  }
}
