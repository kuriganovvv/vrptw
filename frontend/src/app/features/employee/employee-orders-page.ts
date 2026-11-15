import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DispatchStore } from '../../core/dispatch-store';
import { FieldMark, FieldVisitState, Order, Stop } from '../../core/models';
import { SessionStore } from '../../core/session-store';
import { fmtDuration, fmtKm, fmtTime, fmtTimeRange } from '../../core/time';
import { Icon } from '../../shared/icon';
import { WORK_SHORT, plural, shortOrder } from '../../shared/ui';
import { subscriberPhone, telHref } from '../field/field-page';
import {
  VISIT_STATE_META,
  buildDayChips,
  visitStateOf,
} from './employee-shared';

interface OrderCardView {
  order: Order;
  stop?: Stop;
  index: number;
  state: FieldVisitState;
  mark: FieldMark;
  phone: string;
  telHref: string;
  workType: string;
}

@Component({
  selector: 'app-employee-orders-page',
  imports: [Icon, RouterLink],
  template: `
    <div class="space-y-4">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-slate-900">Наряды</h1>
        <p class="mt-0.5 text-xs text-slate-500">
          @if (store.currentDate()) {
            {{ dateLabel() }} · {{ orders().length }}
            {{ plural(orders().length, 'наряд', 'наряда', 'нарядов') }}
          } @else {
            Данные из сервиса планирования
          }
        </p>
      </div>

      @if (store.employeeLoading()) {
        <section class="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <app-icon name="refresh-cw" class="mx-auto size-7 text-brand spin" />
          <p class="mt-3 text-sm font-medium text-slate-700">Загружаем наряды…</p>
        </section>
      } @else if (store.employeeError(); as message) {
        <section class="rounded-2xl border border-red-200 bg-white px-5 py-8 text-center">
          <app-icon name="triangle-alert" class="mx-auto size-7 text-red-500" />
          <p class="mt-3 text-sm font-medium text-slate-800">Наряды недоступны</p>
          <p class="mt-1 text-xs leading-5 text-slate-500">{{ message }}</p>
          <button
            type="button"
            (click)="store.loadFromBackend()"
            class="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <app-icon name="refresh-cw" class="size-4" />
            Повторить
          </button>
        </section>
      } @else {
        @if (!route()) {
          <section class="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <app-icon name="clipboard-list" class="mx-auto size-8 text-slate-300" />
            <p class="mt-3 text-sm font-semibold text-slate-800">Нарядов на смену нет</p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              В плане сервиса для сотрудника {{ staffId() }} нет маршрута на
              {{ store.currentDate() }}.
            </p>
          </section>
        } @else {
          <div
            class="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-200 bg-white py-3 text-center"
          >
            <div>
              <div class="text-lg font-semibold tabular-nums text-slate-900">
                {{ orders().length }}
              </div>
              <div class="text-[10px] uppercase tracking-wide text-slate-400">нарядов</div>
            </div>
            <div>
              <div class="text-lg font-semibold tabular-nums text-emerald-600">
                {{ doneCount() }}
              </div>
              <div class="text-[10px] uppercase tracking-wide text-slate-400">выполнено</div>
            </div>
            <div>
              <div class="text-lg font-semibold tabular-nums text-slate-900">
                {{ routeKm() }}
              </div>
              <div class="text-[10px] uppercase tracking-wide text-slate-400">пробег</div>
            </div>
          </div>

          <ol class="space-y-3">
            @for (item of orders(); track item.order.order_id) {
              <li class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="flex items-start gap-3">
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
                    [class.bg-brand]="item.state !== 'DONE'"
                    [class.text-white]="item.state !== 'DONE'"
                    [class.bg-slate-100]="item.state === 'DONE'"
                    [class.text-slate-400]="item.state === 'DONE'"
                  >
                    @if (item.state === 'DONE') {
                      <app-icon name="check-circle-2" class="size-4" />
                    } @else {
                      {{ item.index }}
                    }
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start gap-2">
                      <h2 class="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900">
                        {{ item.workType }}
                      </h2>
                      <span
                        [class]="stateMeta(item.state).chip"
                        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      >
                        {{ stateMeta(item.state).label }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs leading-4 text-slate-500">{{ item.order.address }}</p>
                    @if (item.stop?.explanation?.includes('Совместный')) {
                      <p class="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
                        <app-icon name="users" class="size-3.5" />
                        Совместный визит — нужен второй сотрудник
                      </p>
                    }
                    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span class="inline-flex items-center gap-1">
                        <app-icon name="clock" class="size-3 text-brand" />
                        <span class="tabular-nums">
                          {{ fmtTimeRange(item.order.slot.start, item.order.slot.end) }}
                        </span>
                      </span>
                      @if (item.stop) {
                        <span class="inline-flex items-center gap-1">
                          <app-icon name="truck" class="size-3 text-brand" />
                          {{ travel(item.stop) }}
                        </span>
                      }
                      <span class="font-mono">№ {{ short(item.order.order_id) }}</span>
                    </div>

                    <div class="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                      <a
                        [href]="item.telHref"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-medium text-sky-700"
                        title="В API нет телефона абонента: номер демонстрационный"
                      >
                        <app-icon name="phone" class="size-3.5" />
                        {{ item.phone }}
                        <span class="text-[9px] font-normal text-sky-500">демо</span>
                      </a>
                      @if (item.stop) {
                        <span class="ml-auto text-[11px] tabular-nums text-slate-400">
                          по плану {{ fmtTime(item.stop.start) }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
              </li>
            } @empty {
              <li class="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
                <app-icon name="check-circle-2" class="mx-auto size-8 text-emerald-500" />
                <p class="mt-2 text-sm font-medium text-slate-700">Нарядов нет</p>
                <p class="mt-1 text-xs text-slate-500">
                  Для этого дня в плане нет визитов сотрудника.
                </p>
              </li>
            }
          </ol>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center">
            <a
              routerLink="/app/shift"
              class="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-700"
            >
              <app-icon name="map-pin" class="size-3.5" />
              Вернуться к смене
            </a>
          </div>
        }
      }
    </div>
  `,
})
export class EmployeeOrdersPage {
  protected readonly store = inject(DispatchStore);
  private readonly session = inject(SessionStore);

  protected readonly staffId = this.session.staffId;
  protected readonly route = computed(() =>
    this.store.employeeLoading() || this.store.employeeError()
      ? null
      : this.store.routeFor(this.staffId()),
  );

  protected readonly orders = computed<OrderCardView[]>(() => {
    const route = this.route();
    if (!route) return [];
    const marks = this.store.marksFor(this.staffId());
    const stopByOrder = new Map<string, { stop: Stop; index: number }>();
    let index = 0;
    for (const stopView of route.stops) {
      if (stopView.stop.type !== 'VISIT' || !stopView.stop.order_id) continue;
      index += 1;
      stopByOrder.set(stopView.stop.order_id, { stop: stopView.stop, index });
    }

    const mine = new Set(stopByOrder.keys());
    return this.store
      .orders()
      .filter((order) => mine.has(order.order_id))
      .sort(
        (a, b) => new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime(),
      )
      .map((order) => {
        const found = stopByOrder.get(order.order_id);
        const mark = marks[order.order_id] ?? {};
        const phone = subscriberPhone(order.order_id);
        return {
          order,
          stop: found?.stop,
          index: found?.index ?? 0,
          state: visitStateOf(found?.stop.status, mark),
          mark,
          phone,
          telHref: telHref(phone),
          workType:
            this.store.workTypeByCode().get(order.work_type_code)?.name ??
            WORK_SHORT[order.work_type_code] ??
            order.work_type_code,
        };
      });
  });

  protected readonly doneCount = computed(
    () => this.orders().filter((item) => item.state === 'DONE').length,
  );

  protected readonly routeKm = computed(() => {
    const km = this.route()?.km ?? 0;
    return `${km.toFixed(1).replace('.', ',')} км`;
  });

  protected readonly dateLabel = computed(() => {
    const chip = buildDayChips(this.store.days(), this.store.currentDate()).find(
      (day) => day.current,
    );
    return chip ? `${chip.label}, ${chip.short}` : this.store.currentDate();
  });

  protected stateMeta(state: FieldVisitState) {
    return VISIT_STATE_META[state];
  }

  protected short(orderId: string): string {
    return shortOrder(orderId);
  }

  protected travel(stop: Stop): string {
    const minutes = (stop.travel_sec ?? 0) / 60;
    const distance = fmtKm(stop.distance_m);
    return minutes ? `${fmtDuration(minutes)} · ${distance}` : distance;
  }

  protected readonly fmtTime = fmtTime;
  protected readonly fmtTimeRange = fmtTimeRange;
  protected readonly plural = plural;
}
