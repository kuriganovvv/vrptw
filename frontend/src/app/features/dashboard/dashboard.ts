import { Component, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { fmtDateLong, fmtTime } from '../../core/time';
import { Icon } from '../../shared/icon';
import { DaySwitcher } from './day-switcher';
import { GanttChart } from './gantt-chart';
import { OrdersTable } from './orders-table';
import { ProblemsPanel } from './problems-panel';
import { RoutesMap } from './routes-map';
import { StaffPanel } from './staff-panel';
import { StatsCards } from './stats-cards';

@Component({
  selector: 'app-dashboard',
  imports: [
    StatsCards,
    RoutesMap,
    StaffPanel,
    ProblemsPanel,
    GanttChart,
    OrdersTable,
    DaySwitcher,
    Icon,
  ],
  template: `
    <div class="space-y-4 md:space-y-5">
      <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <span class="grid size-9 place-items-center rounded-xl bg-white text-brand shadow-sm">
            <app-icon name="sparkles" class="size-4" />
          </span>
          <div class="leading-tight">
            <div class="text-sm font-semibold text-brand">
              План смены v{{ store.plan().plan_version }} · {{ dateLabel() }}
            </div>
            <div class="text-xs text-slate-600">
              Актуален на {{ nowLabel() }} · расчёт {{ computation() }} ·
              {{ store.activeRoutes().length }} бригад в работе
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <app-day-switcher />
          <span class="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
            <span class="font-semibold text-brand">{{ store.stats()[1].value }}</span> назначено
          </span>
          <span class="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
            <span class="font-semibold text-red-600">{{ store.riskAlerts().length }}</span> в риске
          </span>
          <span class="hidden rounded-lg bg-white px-2.5 py-1.5 shadow-sm sm:inline">
            <span class="font-semibold text-amber-600">{{ store.unassigned().length }}</span> без бригады
          </span>
        </div>
      </div>

      <app-stats-cards />

      <section
        class="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
        aria-label="Карта и состояние бригад"
      >
        <app-routes-map />
        <div class="flex min-w-0 flex-col gap-4 md:gap-5">
          <app-staff-panel />
          <app-problems-panel />
        </div>
      </section>

      <section
        class="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
        aria-label="Загрузка и наряды"
      >
        <app-gantt-chart />
        <app-orders-table
          title="Наряды"
          [limit]="6"
          [showFilters]="false"
          [showStaff]="false"
        />
      </section>
    </div>
  `,
})
export class DashboardPage {
  protected readonly store = inject(DispatchStore);

  protected readonly dateLabel = () => fmtDateLong(this.store.plan().date);
  protected readonly nowLabel = () => fmtTime(this.store.now());
  protected readonly computation = () => {
    const ms = this.store.plan().computation_ms;
    if (!ms) return '—';
    if (ms < 1000) return `${ms} мс`;
    return `${(ms / 1000).toFixed(1).replace('.', ',')} с`;
  };
}
