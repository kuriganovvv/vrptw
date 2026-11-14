import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DispatchStore } from '../../core/dispatch-store';
import { OrderUiStatus } from '../../core/models';
import { fmtDateLong, fmtTime } from '../../core/time';
import { OrdersTable } from '../dashboard/orders-table';
import { Icon } from '../../shared/icon';
import { ORDER_STATUS_META, WORK_SHORT } from '../../shared/ui';

@Component({
  selector: 'app-orders-page',
  imports: [OrdersTable, Icon, RouterLink],
  template: `
    <div class="space-y-4 md:space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Наряды дня</h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ dateLabel() }} · план v{{ store.plan().plan_version }} актуален на {{ nowLabel() }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a
            routerLink="/dashboard"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-brand hover:text-brand"
          >
            <app-icon name="map-pin" class="size-4" />
            На карту
          </a>
          <button
            type="button"
            (click)="exportCsv()"
            class="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <app-icon name="download" class="size-4" />
            Экспорт CSV
          </button>
        </div>
      </header>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Сводка по нарядам">
        <article class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">Всего</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ store.orderRows().length }}</div>
          <div class="mt-1 text-[11px] text-slate-500">нарядов в плане</div>
        </article>
        @for (card of statusCards(); track card.key) {
          <article class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500">{{ card.label }}</span>
              <span class="size-2 rounded-full" [class]="card.dot"></span>
            </div>
            <div class="mt-1 text-2xl font-semibold tabular-nums" [class]="card.valueCls">
              {{ card.count }}
            </div>
            <div class="mt-1 text-[11px] text-slate-500">{{ card.note }}</div>
          </article>
        }
      </section>

      <app-orders-table title="Все наряды" [showFilters]="true" />

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section class="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 class="text-sm font-semibold">Как читать статусы</h3>
          <dl class="mt-2 space-y-1.5 text-xs text-slate-600">
            <div class="flex gap-2">
              <dt class="w-24 shrink-0 font-mono font-semibold text-slate-700">PLANNED</dt>
              <dd>Визит запланирован, бригада ещё не выехала на точку.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-24 shrink-0 font-mono font-semibold text-slate-700">IN_PROGRESS</dt>
              <dd>Бригада выполняет работы на объекте прямо сейчас.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-24 shrink-0 font-mono font-semibold text-slate-700">DONE</dt>
              <dd>Работы завершены, наряд закрыт.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-24 shrink-0 font-mono font-semibold text-slate-700">UNASSIGNED</dt>
              <dd>Нет подходящей бригады или ресурса — требуется решение диспетчера.</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-24 shrink-0 font-mono font-semibold text-slate-700">PGP</dt>
              <dd>Наряд попал в групповую проблему на узле доступа.</dd>
            </div>
          </dl>
        </section>
        <section class="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 class="text-sm font-semibold">Топ типов работ</h3>
          <ul class="mt-2 space-y-1.5">
            @for (item of topWorkTypes(); track item.code) {
              <li class="flex items-center gap-2 text-xs">
                <span class="w-36 shrink-0 truncate text-slate-600" [title]="item.name">
                  {{ item.name }}
                </span>
                <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    class="block h-full rounded-full bg-brand"
                    [style.width.%]="item.pct"
                  ></span>
                </span>
                <span class="w-6 text-right font-semibold tabular-nums text-slate-700">
                  {{ item.count }}
                </span>
              </li>
            }
          </ul>
        </section>
      </div>
    </div>
  `,
})
export class OrdersPage {
  protected readonly store = inject(DispatchStore);

  protected readonly dateLabel = () => fmtDateLong(this.store.plan().date);
  protected readonly nowLabel = () => fmtTime(this.store.now());

  protected readonly statusCards = computed(() => {
    const rows = this.store.orderRows();
    const total = Math.max(1, rows.length);
    const spec: { key: OrderUiStatus; label: string; note: string; valueCls?: string }[] = [
      { key: 'PLANNED', label: 'Запланированы', note: 'ожидают выезда' },
      { key: 'IN_PROGRESS', label: 'В работе', note: 'бригада на точке' },
      { key: 'DONE', label: 'Выполнены', note: 'закрыты сегодня' },
      { key: 'UNASSIGNED', label: 'Не назначены', note: 'нужен диспетчер', valueCls: 'text-amber-600' },
      { key: 'PGP', label: 'ПГП', note: 'групповая проблема', valueCls: 'text-orange-600' },
    ];
    return spec.map((item) => {
      const count = rows.filter((row) => row.status === item.key).length;
      const meta = ORDER_STATUS_META[item.key];
      return {
        ...item,
        count,
        dot: meta.dot,
        valueCls: item.valueCls ?? '',
        note: `${Math.round((count / total) * 100)}% · ${item.note}`,
      };
    });
  });

  protected readonly topWorkTypes = computed(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const row of this.store.orderRows()) {
      const code = row.order.work_type_code;
      const name = row.workType?.name ?? WORK_SHORT[code] ?? code;
      const current = map.get(code) ?? { code, name, count: 0 };
      current.count += 1;
      map.set(code, current);
    }
    const entries = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    const max = Math.max(1, ...entries.map((entry) => entry.count));
    return entries.map((entry) => ({ ...entry, pct: (entry.count / max) * 100 }));
  });

  protected exportCsv(): void {
    const header = ['Номер', 'Тип работ', 'Адрес', 'Слот', 'Статус', 'Плановое время', 'Бригада', 'Риск'];
    const lines = this.store.orderRows().map((row) =>
      [
        row.order.order_id,
        row.workType?.name ?? row.order.work_type_code,
        row.order.address,
        row.slotLabel,
        row.status,
        row.plannedLabel,
        row.staff?.display_name ?? '',
        row.riskLevel,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob(['\uFEFF' + [header.join(';'), ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${this.store.plan().date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.store.showToast(`CSV сформирован: ${this.store.orderRows().length} нарядов`, 'success');
  }
}
