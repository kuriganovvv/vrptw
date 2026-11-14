import { Component, computed, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { OrderUiStatus } from '../../core/models';
import { fmtDateLong, fmtNumber, fmtTime, minutesOfDay } from '../../core/time';
import { Icon } from '../../shared/icon';
import { ORDER_STATUS_META, WORK_SHORT } from '../../shared/ui';

const DONUT_COLORS: Record<OrderUiStatus, string> = {
  DONE: '#10B981',
  IN_PROGRESS: '#0EA5E9',
  PLANNED: '#7C3AED',
  UNASSIGNED: '#F59E0B',
  PGP: '#F97316',
  CANCELLED: '#94A3B8',
};

const CHART_COLORS = ['#5A2D82', '#7C3AED', '#0EA5E9', '#10B981', '#F97316', '#EC4899', '#14B8A6', '#64748B'];

@Component({
  selector: 'app-analytics-page',
  imports: [Icon],
  template: `
    <div class="space-y-4 md:space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Аналитика смены</h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ dateLabel() }} · срез на {{ nowLabel() }} · план v{{ store.plan().plan_version }}
          </p>
        </div>
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
          <app-icon name="sparkles" class="size-3.5 text-brand" />
          Расчёт {{ computation() }} · {{ store.plan().based_on_event_id ?? 'демо-событие' }}
        </span>
      </header>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Ключевые метрики">
        @for (kpi of kpis(); track kpi.label) {
          <article class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500">{{ kpi.label }}</span>
              <span class="grid size-7 place-items-center rounded-lg" [class]="kpi.iconCls">
                <app-icon [name]="kpi.icon" class="size-3.5" />
              </span>
            </div>
            <div class="mt-1.5 text-2xl font-semibold tabular-nums" [class]="kpi.valueCls">
              {{ kpi.value }}
            </div>
            <div class="mt-1 truncate text-[11px] text-slate-500">{{ kpi.note }}</div>
          </article>
        }
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-3 md:gap-5">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <div class="flex items-center gap-2">
            <app-icon name="gauge" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Загрузка бригад</h3>
            <span class="ml-auto text-xs text-slate-400">работа + перемещения к смене</span>
          </div>
          <ul class="mt-3 space-y-2.5">
            @for (row of utilization(); track row.id) {
              <li>
                <div class="flex items-center gap-2 text-xs">
                  <span class="size-2 rounded-full" [style.background]="row.color"></span>
                  <span class="w-32 shrink-0 truncate font-medium text-slate-700" [title]="row.name">
                    {{ row.name }}
                  </span>
                  <span class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      class="block h-full rounded-full"
                      [style.width.%]="row.pct"
                      [style.background]="row.color"
                    ></span>
                  </span>
                  <span class="w-12 text-right font-semibold tabular-nums text-slate-700">
                    {{ row.pct }}%
                  </span>
                </div>
                <div class="ml-4 mt-0.5 flex gap-3 text-[10px] text-slate-500">
                  <span>{{ row.done }}/{{ row.visits }} визитов</span>
                  <span>{{ row.km.toFixed(1).replace('.', ',') }} км</span>
                  @if (row.risk) {
                    <span class="font-medium text-red-600">риск SLA</span>
                  }
                </div>
              </li>
            }
          </ul>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="clipboard-list" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Статусы нарядов</h3>
          </div>
          <div class="mt-3 flex items-center gap-4">
            <div class="relative size-36 shrink-0">
              <div class="absolute inset-0 rounded-full" [style.background]="donut()"></div>
              <div class="absolute inset-7 grid place-items-center rounded-full bg-white">
                <div class="text-center leading-tight">
                  <div class="text-xl font-semibold tabular-nums">{{ store.orderRows().length }}</div>
                  <div class="text-[10px] text-slate-500">нарядов</div>
                </div>
              </div>
            </div>
            <ul class="min-w-0 flex-1 space-y-1.5">
              @for (item of statusDonut(); track item.status) {
                <li class="flex items-center gap-2 text-xs">
                  <span class="size-2 rounded-full" [style.background]="item.color"></span>
                  <span class="truncate text-slate-600">{{ item.label }}</span>
                  <span class="ml-auto font-semibold tabular-nums text-slate-800">{{ item.count }}</span>
                  <span class="w-8 text-right tabular-nums text-slate-400">{{ item.pct }}%</span>
                </li>
              }
            </ul>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="clock" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Визиты по часам</h3>
            <span class="ml-auto text-xs text-slate-400">начало планового визита</span>
          </div>
          <div class="mt-3 flex h-36 items-end gap-1.5">
            @for (hour of hourly(); track hour.hour) {
              <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span class="text-[10px] tabular-nums text-slate-500">{{ hour.count || '' }}</span>
                <div
                  class="w-full rounded-t-md bg-brand/80 transition-colors hover:bg-brand"
                  [style.height.%]="hour.height"
                  [title]="hour.label + ': ' + hour.count + ' визитов'"
                ></div>
                <span class="text-[9px] tabular-nums text-slate-400">{{ hour.hour }}</span>
              </div>
            }
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="layers" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Структура работ</h3>
            <span class="ml-auto text-xs text-slate-400">доля от всех нарядов</span>
          </div>
          <ul class="mt-3 space-y-2">
            @for (item of workTypes(); track item.code) {
              <li>
                <div class="flex items-center gap-2 text-xs">
                  <span class="size-2 rounded-full" [style.background]="item.color"></span>
                  <span class="min-w-0 flex-1 truncate text-slate-600" [title]="item.name">
                    {{ item.name }}
                  </span>
                  <span class="font-semibold tabular-nums text-slate-800">{{ item.count }}</span>
                  <span class="w-9 text-right tabular-nums text-slate-400">{{ item.pct }}%</span>
                </div>
                <div class="ml-4 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    class="block h-full rounded-full"
                    [style.width.%]="item.barPct"
                    [style.background]="item.color"
                  ></span>
                </div>
              </li>
            }
          </ul>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="user-x" class="size-4 text-amber-600" />
            <h3 class="text-sm font-semibold">Причины неназначения</h3>
            <span class="ml-auto text-xs text-slate-400">{{ store.unassigned().length }} нарядов</span>
          </div>
          <ul class="mt-3 space-y-2">
            @for (item of reasons(); track item.code) {
              <li>
                <div class="flex items-center gap-2 text-xs">
                  <span class="min-w-0 flex-1 truncate text-slate-600" [title]="item.label">
                    {{ item.label }}
                  </span>
                  <span class="font-semibold tabular-nums text-slate-800">{{ item.count }}</span>
                  <span class="w-9 text-right tabular-nums text-slate-400">{{ item.pct }}%</span>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span class="block h-full rounded-full bg-amber-500" [style.width.%]="item.barPct"></span>
                </div>
              </li>
            } @empty {
              <li class="py-6 text-center text-sm text-slate-500">Все наряды распределены.</li>
            }
          </ul>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="zap" class="size-4 text-orange-600" />
            <h3 class="text-sm font-semibold">Групповые проблемы</h3>
            <span class="ml-auto text-xs text-slate-400">{{ store.pgpGroups().length }} групп</span>
          </div>
          @for (group of store.pgpGroups(); track group.group.group_id) {
            <div class="mt-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3">
              <div class="flex items-center gap-2 text-sm">
                <span class="font-mono text-xs font-semibold text-orange-800">
                  {{ group.group.access_node_id }}
                </span>
                <span class="truncate text-xs text-slate-600">{{ group.node?.name }}</span>
                <span class="ml-auto rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-orange-700">
                  {{ group.orders.length }} заявки
                </span>
              </div>
              <p class="mt-1 text-xs text-slate-600">{{ group.group.comment }}</p>
              <div class="mt-2 flex flex-wrap gap-1">
                @for (order of group.orders; track order.order_id) {
                  <span class="rounded border border-orange-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                    {{ order.technology }}
                  </span>
                }
              </div>
            </div>
          } @empty {
            <div class="flex flex-col items-center gap-2 py-10 text-center">
              <app-icon name="shield-check" class="size-7 text-emerald-500" />
              <p class="text-sm font-medium text-slate-700">ПГП не выявлены</p>
              <p class="text-xs text-slate-500">Скоплений обращений на узлах доступа нет.</p>
            </div>
          }
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div class="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <app-icon name="users" class="size-4 text-brand" />
          <h3 class="text-sm font-semibold">Сводка по бригадам</h3>
          <span class="ml-auto text-xs text-slate-400">{{ store.activeRoutes().length }} активных</span>
        </div>
        <div class="scroll-thin overflow-x-auto">
          <table class="w-full min-w-[680px] text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th scope="col" class="px-4 py-2 text-left font-medium">Сотрудник</th>
                <th scope="col" class="px-3 py-2 text-right font-medium">Визиты</th>
                <th scope="col" class="px-3 py-2 text-right font-medium">Выполнено</th>
                <th scope="col" class="px-3 py-2 text-right font-medium">Пробег</th>
                <th scope="col" class="px-3 py-2 text-right font-medium">Утилизация</th>
                <th scope="col" class="px-4 py-2 text-left font-medium">Статус</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (route of store.routes(); track route.staff.staff_id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="size-2 rounded-full" [style.background]="route.meta.color"></span>
                      <span class="truncate font-medium">{{ route.staff.display_name }}</span>
                      <span class="font-mono text-[10px] text-slate-400">{{ route.staff.staff_id }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums">{{ route.visits }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums">{{ route.done }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums">
                    {{ route.km.toFixed(1).replace('.', ',') }} км
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums">
                    {{ utilizationOf(route.route.totals?.utilization) }}%
                  </td>
                  <td class="px-4 py-2.5">
                    @if (route.visits === 0) {
                      <span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">свободен</span>
                    } @else if (route.risk) {
                      <span class="rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">риск SLA</span>
                    } @else {
                      <span class="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {{ route.presence }}
                      </span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class AnalyticsPage {
  protected readonly store = inject(DispatchStore);

  protected readonly dateLabel = () => fmtDateLong(this.store.plan().date);
  protected readonly nowLabel = () => fmtTime(this.store.now());

  protected readonly kpis = computed(() => {
    const rows = this.store.orderRows();
    const total = rows.length;
    const assigned = rows.filter(
      (row) => row.status !== 'UNASSIGNED' && row.status !== 'PGP' && row.status !== 'CANCELLED',
    ).length;
    const done = rows.filter((row) => row.status === 'DONE').length;
    const routes = this.store.activeRoutes();
    const distance = routes.reduce((sum, route) => sum + (route.route.totals?.distance_m ?? 0), 0);
    const avgUtilization = routes.length
      ? Math.round(
          (routes.reduce((sum, route) => sum + (route.route.totals?.utilization ?? 0), 0) / routes.length) * 100,
        )
      : 0;
    const pctOf = (value: number, base: number) => (base ? Math.round((value / base) * 100) : 0);

    return [
      {
        label: 'Всего заявок',
        value: fmtNumber(total),
        note: `план v${this.store.plan().plan_version}`,
        icon: 'clipboard-list',
        iconCls: 'bg-brand-50 text-brand',
        valueCls: 'text-slate-900',
      },
      {
        label: 'Назначено',
        value: fmtNumber(assigned),
        note: `${pctOf(assigned, total)}% от плана`,
        icon: 'user-check',
        iconCls: 'bg-emerald-50 text-emerald-700',
        valueCls: 'text-slate-900',
      },
      {
        label: 'Выполнено',
        value: fmtNumber(done),
        note: `${pctOf(done, assigned)}% назначенных`,
        icon: 'check-circle-2',
        iconCls: 'bg-teal-50 text-teal-700',
        valueCls: 'text-emerald-700',
      },
      {
        label: 'Загрузка',
        value: `${avgUtilization}%`,
        note: 'средняя по бригадам',
        icon: 'gauge',
        iconCls: 'bg-slate-100 text-slate-700',
        valueCls: 'text-slate-900',
      },
      {
        label: 'Пробег',
        value: `${(distance / 1000).toFixed(0)} км`,
        note: `≈ ${(distance / 1000 / Math.max(1, routes.length)).toFixed(1).replace('.', ',')} км на бригаду`,
        icon: 'truck',
        iconCls: 'bg-sky-50 text-sky-700',
        valueCls: 'text-slate-900',
      },
      {
        label: 'В риске',
        value: fmtNumber(this.store.riskAlerts().length),
        note: 'нарушение SLA',
        icon: 'alarm-clock',
        iconCls: 'bg-red-50 text-red-600',
        valueCls: 'text-red-600',
      },
    ] as { label: string; value: string; note: string; icon: 'clipboard-list' | 'user-check' | 'check-circle-2' | 'gauge' | 'truck' | 'alarm-clock'; iconCls: string; valueCls: string }[];
  });

  protected readonly utilization = computed(() =>
    this.store
      .activeRoutes()
      .map((route) => ({
        id: route.staff.staff_id,
        name: route.staff.display_name,
        color: route.meta.color,
        visits: route.visits,
        done: route.done,
        km: route.km,
        risk: route.risk,
        pct: this.utilizationOf(route.route.totals?.utilization),
      }))
      .sort((a, b) => b.pct - a.pct),
  );

  protected readonly statusDonut = computed(() => {
    const rows = this.store.orderRows();
    const total = Math.max(1, rows.length);
    return (Object.keys(DONUT_COLORS) as OrderUiStatus[]).map((status) => {
      const count = rows.filter((row) => row.status === status).length;
      return {
        status,
        label: ORDER_STATUS_META[status].label,
        color: DONUT_COLORS[status],
        count,
        pct: Math.round((count / total) * 100),
      };
    }).filter((item) => item.count > 0);
  });

  protected readonly donut = computed(() => {
    const items = this.statusDonut();
    const total = items.reduce((sum, item) => sum + item.count, 0);
    if (!total) return 'conic-gradient(#e2e8f0 0 100%)';
    let acc = 0;
    const parts = items.map((item) => {
      const from = (acc / total) * 100;
      acc += item.count;
      const to = (acc / total) * 100;
      return `${item.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  });

  protected readonly hourly = computed(() => {
    const counts = new Map<number, number>();
    for (const row of this.store.orderRows()) {
      if (!row.visit) continue;
      const hour = Math.floor(minutesOfDay(row.visit.start) / 60);
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
    const hours = Array.from({ length: 12 }, (_, index) => 8 + index);
    const max = Math.max(1, ...hours.map((hour) => counts.get(hour) ?? 0));
    return hours.map((hour) => {
      const count = counts.get(hour) ?? 0;
      return {
        hour: `${String(hour).padStart(2, '0')}`,
        label: `${String(hour).padStart(2, '0')}:00`,
        count,
        height: count ? Math.max(6, (count / max) * 100) : 2,
      };
    });
  });

  protected readonly workTypes = computed(() => {
    const rows = this.store.orderRows();
    const total = Math.max(1, rows.length);
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const row of rows) {
      const code = row.order.work_type_code;
      const name = WORK_SHORT[code] ?? row.workType?.name ?? code;
      const current = map.get(code) ?? { code, name, count: 0 };
      current.count += 1;
      map.set(code, current);
    }
    const entries = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    const max = Math.max(1, ...entries.map((entry) => entry.count));
    return entries.map((entry, index) => ({
      ...entry,
      color: CHART_COLORS[index % CHART_COLORS.length],
      pct: Math.round((entry.count / total) * 100),
      barPct: (entry.count / max) * 100,
    }));
  });

  protected readonly reasons = computed(() => {
    const items = this.store.unassigned();
    const total = Math.max(1, items.length);
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const view of items) {
      const code = view.item.reason_code;
      const current = map.get(code) ?? { code, label: view.reasonLabel, count: 0 };
      current.count += 1;
      map.set(code, current);
    }
    const entries = [...map.values()].sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...entries.map((entry) => entry.count));
    return entries.map((entry) => ({
      ...entry,
      pct: Math.round((entry.count / total) * 100),
      barPct: (entry.count / max) * 100,
    }));
  });

  protected readonly computation = () => {
    const ms = this.store.plan().computation_ms;
    if (!ms) return '—';
    return ms < 1000 ? `${ms} мс` : `${(ms / 1000).toFixed(1).replace('.', ',')} с`;
  };

  protected utilizationOf(value: number | undefined): number {
    if (!value) return 0;
    return Math.min(100, Math.round(value * 100));
  }
}
