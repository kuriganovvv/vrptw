import { Component, computed, inject } from '@angular/core';
import { DispatchStore, ProblemTab } from '../../core/dispatch-store';
import { AlertView, PgpView, UnassignedView } from '../../core/models';
import { fmtTime } from '../../core/time';
import { Icon } from '../../shared/icon';
import { shortOrder } from '../../shared/ui';

const REASON_BADGE: Record<string, string> = {
  NO_QUALIFIED_STAFF: 'bg-brand-50 text-brand',
  NO_EQUIPMENT: 'bg-amber-50 text-amber-700',
  NO_SHIFT_TIME: 'bg-sky-50 text-sky-700',
  SLOT_UNREACHABLE: 'bg-violet-50 text-violet-700',
  STAFF_UNAVAILABLE: 'bg-rose-50 text-rose-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

@Component({
  selector: 'app-problems-panel',
  imports: [Icon],
  template: `
    <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div class="flex items-center gap-2 px-4 pt-3">
        <app-icon name="triangle-alert" class="size-4 text-brand" />
        <h2 class="text-sm font-semibold">Проблемы</h2>
        <span class="ml-auto text-xs text-slate-400">{{ total() }}</span>
      </div>

      <div role="tablist" aria-label="Проблемы" class="mt-2 flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
        @for (tab of tabs(); track tab.key) {
          <button
            type="button"
            role="tab"
            (click)="store.setProblemTab(tab.key)"
            [attr.aria-selected]="store.problemTab() === tab.key"
            [attr.tabindex]="store.problemTab() === tab.key ? 0 : -1"
            class="-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
            [class.border-brand]="store.problemTab() === tab.key"
            [class.text-brand]="store.problemTab() === tab.key"
            [class.border-transparent]="store.problemTab() !== tab.key"
            [class.text-slate-500]="store.problemTab() !== tab.key"
          >
            {{ tab.label }} ({{ tab.count }})
          </button>
        }
      </div>

      @switch (store.problemTab()) {
        @case ('risk') {
          <div class="scroll-thin max-h-[330px] space-y-2 overflow-y-auto p-3" role="tabpanel">
            @for (view of store.riskAlerts(); track view.alert.alert_id) {
              <article class="rounded-xl border border-red-200 bg-red-50/50 p-3">
                <div class="flex items-center gap-2 text-sm">
                  <app-icon name="alarm-clock" class="size-4 shrink-0 text-red-600" />
                  <span class="font-semibold text-red-700">№ {{ orderNo(view) }}</span>
                  <span
                    class="rounded border border-red-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700"
                    >{{ view.order?.technology ?? 'PON' }}</span
                  >
                  <span class="ml-auto whitespace-nowrap text-xs text-slate-500">
                    Окно {{ view.windowLabel }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-red-600">
                  {{ view.staff?.display_name ?? 'Бригада' }} не успевает: опоздание ≈
                  {{ view.latenessMin }} мин
                </p>
                <p class="mt-0.5 truncate text-xs text-slate-600" [title]="view.order?.address">
                  {{ view.order?.address }}
                </p>
                <div class="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    (click)="reassign(view)"
                    class="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                  >
                    <app-icon name="refresh-cw" class="size-3" />
                    Переназначить
                  </button>
                  <button
                    type="button"
                    (click)="postpone(view)"
                    class="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                  >
                    <app-icon name="clock" class="size-3" />
                    Сдвинуть слот
                  </button>
                  <span class="ml-auto font-mono text-[10px] text-slate-400">
                    прогноз {{ fmtTime(view.alert.forecast_start) }}
                  </span>
                </div>
              </article>
            } @empty {
              <div class="flex flex-col items-center gap-2 py-10 text-center">
                <app-icon name="shield-check" class="size-7 text-emerald-500" />
                <p class="text-sm font-medium text-slate-700">Рисков нет</p>
                <p class="text-xs text-slate-500">Все бригады успевают в согласованные окна.</p>
              </div>
            }
          </div>
        }

        @case ('unassigned') {
          <div class="scroll-thin max-h-[330px] overflow-y-auto" role="tabpanel">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" class="w-16 px-4 py-2 text-left font-medium">№</th>
                  <th scope="col" class="px-2 py-2 text-left font-medium">Адрес</th>
                  <th scope="col" class="px-3 py-2 text-left font-medium">Причина</th>
                  <th scope="col" class="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (view of store.unassigned(); track view.item.order_id) {
                  <tr class="hover:bg-slate-50">
                    <td class="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-slate-600">
                      {{ orderNo(view) }}
                    </td>
                    <td class="max-w-[130px] truncate px-2 py-2" [title]="view.order?.address">
                      {{ view.order?.address }}
                    </td>
                    <td class="px-3 py-2">
                      <span
                        class="whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                        [class]="reasonBadge(view.item.reason_code)"
                        [title]="view.item.reason_text"
                        >{{ view.item.reason_code }}</span
                      >
                    </td>
                    <td class="px-3 py-2 text-right">
                      <button
                        type="button"
                        (click)="reschedule(view)"
                        class="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:border-brand hover:text-brand"
                      >
                        В план
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="px-4 py-10 text-center text-sm text-slate-500">
                      Все наряды распределены.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @case ('pgp') {
          <div class="scroll-thin max-h-[330px] space-y-2 overflow-y-auto p-3" role="tabpanel">
            @for (view of store.pgpGroups(); track view.group.group_id) {
              <article class="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                <div class="flex items-center gap-2 text-sm">
                  <app-icon name="zap" class="size-4 shrink-0 text-orange-600" />
                  <span class="font-semibold text-orange-800">Групповая проблема</span>
                  <span class="ml-auto font-mono text-[11px] text-orange-700">
                    {{ view.group.access_node_id }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-700">
                  {{ view.node?.name ?? view.group.access_node_id }} ·
                  {{ view.orders.length }} обращений с одного узла
                </p>
                <p class="mt-0.5 text-xs text-slate-500">{{ view.group.comment }}</p>
                <ul class="mt-2 flex flex-wrap gap-1.5">
                  @for (order of view.orders; track order.order_id) {
                    <li
                      class="rounded-md border border-orange-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600"
                    >
                      № {{ orderNo2(order.order_id) }}
                    </li>
                  }
                </ul>
                <button
                  type="button"
                  (click)="transfer(view)"
                  class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-700"
                >
                  <app-icon name="arrow-right" class="size-3" />
                  Передать в станцию
                </button>
              </article>
            } @empty {
              <div class="flex flex-col items-center gap-2 py-10 text-center">
                <app-icon name="shield-check" class="size-7 text-emerald-500" />
                <p class="text-sm font-medium text-slate-700">Групповых проблем нет</p>
                <p class="text-xs text-slate-500">Аварийных скоплений обращений не выявлено.</p>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ProblemsPanel {
  protected readonly store = inject(DispatchStore);

  protected readonly tabs = computed<
    { key: ProblemTab; label: string; count: number }[]
  >(() => [
    { key: 'risk', label: 'Риски', count: this.store.riskAlerts().length },
    { key: 'unassigned', label: 'Не назначено', count: this.store.unassigned().length },
    { key: 'pgp', label: 'ПГП', count: this.store.pgpGroups().length },
  ]);

  protected readonly total = computed(
    () => this.store.riskAlerts().length + this.store.unassigned().length + this.store.pgpGroups().length,
  );

  protected readonly fmtTime = fmtTime;

  protected orderNo(view: AlertView | UnassignedView): string {
    const id = 'alert' in view ? view.alert.order_id : view.item.order_id;
    return id ? shortOrder(id) : '—';
  }

  protected orderNo2(orderId: string): string {
    return shortOrder(orderId);
  }

  protected reasonBadge(code: string): string {
    return REASON_BADGE[code] ?? REASON_BADGE['OTHER'];
  }

  protected reassign(view: AlertView): void {
    if (view.staff) {
      this.store.selectStaff(view.staff.staff_id);
    }
    this.store.showToast(
      `Наряд № ${this.orderNo(view)} отправлен на переназначение: подбираем свободную бригаду`,
      'info',
    );
    this.store.replan();
  }

  protected postpone(view: AlertView): void {
    this.store.showToast(
      `Для наряда № ${this.orderNo(view)} предложен более поздний слот — клиенту уйдёт уведомление`,
      'warning',
    );
  }

  protected reschedule(view: UnassignedView): void {
    this.store.showToast(
      `Наряд № ${this.orderNo(view)} добавлен в очередь планирования${view.item.proposed_slot ? ' на резервный слот' : ''}`,
      'success',
    );
    this.store.replan();
  }

  protected transfer(view: PgpView): void {
    this.store.showToast(
      `ПГП ${view.group.group_id} передана в станционное подразделение (${view.group.access_node_id})`,
      'success',
    );
  }
}
