import { Component, computed, inject, input, signal } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { OrderRow, OrderUiStatus } from '../../core/models';
import { fmtNumber, fmtTime } from '../../core/time';
import { Icon } from '../../shared/icon';
import {
  ORDER_STATUS_META,
  RISK_META,
  shortOrder,
  WORK_SHORT,
} from '../../shared/ui';

type StatusFilter = 'ALL' | OrderUiStatus;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Все' },
  { key: 'PLANNED', label: 'Запланированы' },
  { key: 'IN_PROGRESS', label: 'В работе' },
  { key: 'DONE', label: 'Выполнены' },
  { key: 'UNASSIGNED', label: 'Не назначены' },
  { key: 'PGP', label: 'ПГП' },
  { key: 'CANCELLED', label: 'Отменены' },
];

@Component({
  selector: 'app-orders-table',
  imports: [Icon],
  template: `
    <div class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div class="flex min-w-0 items-center gap-2">
          <app-icon name="clipboard-list" class="size-4 text-brand" />
          <h2 class="truncate text-sm font-semibold">{{ title() }}</h2>
          <span class="whitespace-nowrap text-xs text-slate-400">
            {{ rows().length }} из {{ store.orderRows().length }}
          </span>
        </div>
        <label class="relative">
          <span class="sr-only">Поиск по нарядам</span>
          <app-icon
            name="search"
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="№, адрес, тип работ"
            [value]="query()"
            (input)="onSearch($event)"
            class="w-40 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-56"
          />
        </label>
      </div>

      @if (showFilters()) {
        <div class="scroll-thin flex gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/40 px-4 py-2">
          @for (filter of filters; track filter.key) {
            <button
              type="button"
              (click)="status.set(filter.key)"
              class="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
              [class.bg-brand]="status() === filter.key"
              [class.text-white]="status() === filter.key"
              [class.bg-white]="status() !== filter.key"
              [class.text-slate-600]="status() !== filter.key"
              [class.border]="status() !== filter.key"
              [class.border-slate-200]="status() !== filter.key"
            >
              {{ filter.label }}
              @if (filter.key !== 'ALL') {
                <span class="ml-1 tabular-nums opacity-70">{{ countFor(filter.key) }}</span>
              }
            </button>
          }
        </div>
      }

      <div class="scroll-thin overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" class="px-4 py-2 text-left font-medium">№</th>
              <th scope="col" class="px-2 py-2 text-left font-medium">Тип работ</th>
              <th scope="col" class="px-2 py-2 text-left font-medium">Адрес</th>
              <th scope="col" class="px-2 py-2 text-left font-medium">Слот</th>
              <th scope="col" class="px-2 py-2 text-left font-medium">Статус</th>
              <th scope="col" class="px-2 py-2 text-left font-medium">Плановое время</th>
              @if (showStaff()) {
                <th scope="col" class="px-2 py-2 text-left font-medium">Бригада</th>
              }
              <th scope="col" class="px-4 py-2 text-left font-medium">Риск</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (row of rows(); track row.order.order_id) {
              <tr
                class="cursor-pointer transition-colors hover:bg-slate-50"
                [class.bg-red-50/40]="row.riskLevel === 'high'"
                (click)="select(row)"
              >
                <td class="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-medium text-brand">
                  № {{ short(row.order.order_id) }}
                </td>
                <td class="whitespace-nowrap px-2 py-2.5">
                  <span [title]="row.workType?.name">{{ workLabel(row) }}</span>
                  @if (row.order.is_repeat) {
                    <span
                      class="ml-1.5 rounded bg-violet-50 px-1 py-0.5 font-mono text-[9px] font-semibold text-violet-700"
                      title="Повторное обращение"
                      >ПОВТ</span
                    >
                  }
                </td>
                <td
                  class="max-w-[190px] truncate px-2 py-2.5 text-slate-600"
                  [title]="row.order.address"
                >
                  {{ row.order.address }}
                </td>
                <td class="whitespace-nowrap px-2 py-2.5 font-mono text-xs text-slate-600">
                  {{ row.slotLabel }}
                </td>
                <td class="px-2 py-2.5">
                  <span
                    class="inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] font-medium"
                    [class]="statusMeta(row).cls"
                    [title]="row.reason ?? statusMeta(row).label"
                    >{{ statusMeta(row).label }}</span
                  >
                </td>
                <td
                  class="whitespace-nowrap px-2 py-2.5 font-mono text-xs"
                  [class.text-red-600]="row.riskLevel === 'high'"
                  [class.text-slate-600]="row.riskLevel !== 'high'"
                >
                  {{ row.plannedLabel }}
                </td>
                @if (showStaff()) {
                  <td class="whitespace-nowrap px-2 py-2.5 text-xs">
                    @if (row.staff) {
                      <span class="inline-flex items-center gap-1.5">
                        <span
                          class="size-2 rounded-full"
                          [style.background]="row.routeColor"
                        ></span>
                        {{ row.staff.display_name }}
                      </span>
                    } @else {
                      <span class="text-slate-400">—</span>
                    }
                  </td>
                }
                <td class="whitespace-nowrap px-4 py-2.5 text-xs font-medium" [class]="riskMeta(row).cls">
                  @if (row.riskLevel === 'high') {
                    <app-icon name="alarm-clock" class="mr-1 -mt-0.5 inline size-3.5" />
                  }
                  {{ riskMeta(row).label }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="showStaff() ? 8 : 7" class="px-4 py-12 text-center">
                  <div class="flex flex-col items-center gap-2">
                    <app-icon name="search" class="size-6 text-slate-300" />
                    <p class="text-sm font-medium text-slate-600">Наряды не найдены</p>
                    <p class="text-xs text-slate-500">Измените запрос или сбросьте фильтр статуса.</p>
                    <button
                      type="button"
                      (click)="reset()"
                      class="mt-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
                    >
                      Сбросить фильтры
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span>
          Показано {{ rows().length }} из {{ store.orderRows().length }} нарядов ·
          в риске {{ store.riskAlerts().length }}
        </span>
        <span>Обновлено в {{ nowLabel() }}</span>
      </div>
    </div>
  `,
})
export class OrdersTable {
  protected readonly store = inject(DispatchStore);

  readonly title = input('Наряды');
  readonly limit = input<number | null>(null);
  readonly showFilters = input(false);
  readonly showStaff = input(true);

  protected readonly filters = FILTERS;
  protected readonly status = signal<StatusFilter>('ALL');
  protected readonly query = signal('');
  protected readonly nowLabel = computed(() => fmtTime(this.store.now()));

  protected readonly rows = computed<OrderRow[]>(() => {
    const query = this.query().trim().toLowerCase();
    const status = this.status();
    let rows = this.store.orderRows();

    if (query) {
      rows = rows.filter(
        (row) =>
          row.order.order_id.toLowerCase().includes(query) ||
          row.order.address.toLowerCase().includes(query) ||
          (row.workType?.name.toLowerCase().includes(query) ?? false) ||
          (row.staff?.display_name.toLowerCase().includes(query) ?? false),
      );
    }

    if (status !== 'ALL') {
      rows = rows.filter((row) => row.status === status);
    }

    const limit = this.limit();
    return limit == null ? rows : rows.slice(0, limit);
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected countFor(status: OrderUiStatus): string {
    return fmtNumber(this.store.orderRows().filter((row) => row.status === status).length);
  }

  protected statusMeta(row: OrderRow): { label: string; cls: string; dot: string } {
    return ORDER_STATUS_META[row.status];
  }

  protected riskMeta(row: OrderRow): { label: string; cls: string } {
    return RISK_META[row.riskLevel] ?? RISK_META['none'];
  }

  protected workLabel(row: OrderRow): string {
    return row.workType ? WORK_SHORT[row.workType.code] : row.order.work_type_code;
  }

  protected short(orderId: string): string {
    return shortOrder(orderId);
  }

  protected select(row: OrderRow): void {
    if (row.staff) this.store.selectStaff(row.staff.staff_id);
  }

  protected reset(): void {
    this.query.set('');
    this.status.set('ALL');
  }
}
