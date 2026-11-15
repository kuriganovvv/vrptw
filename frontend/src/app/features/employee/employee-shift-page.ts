import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DispatchStore } from '../../core/dispatch-store';
import {
  FieldMark,
  FieldVisitState,
  Order,
  StopView,
} from '../../core/models';
import { SessionStore } from '../../core/session-store';
import { fmtDuration, fmtKm, fmtTime, fmtTimeRange } from '../../core/time';
import { Icon } from '../../shared/icon';
import { WORK_SHORT, plural, shortOrder } from '../../shared/ui';
import {
  gisPoint,
  subscriberPhone,
  telHref,
  yandexRoute,
} from '../field/field-page';
import { RoutesMap } from '../dashboard/routes-map';
import {
  VISIT_STATE_META,
  buildDayChips,
  callAt,
  visitStateOf,
} from './employee-shared';

interface ShiftVisit {
  stop: StopView;
  order: Order;
  index: number;
  state: FieldVisitState;
  mark: FieldMark;
  phone: string;
  telHref: string;
  navUrl: string;
  mapUrl: string;
}

interface EquipmentItem {
  label: string;
  count: number;
}

@Component({
  selector: 'app-employee-shift-page',
  imports: [Icon, RouterLink, RoutesMap],
  template: `
    <div class="space-y-4">
      <div class="flex items-end justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-bold tracking-tight text-slate-900">Моя смена</h1>
          <p class="mt-0.5 text-xs text-slate-500">
            @if (store.currentDate()) {
              {{ dateLabel() }}
            } @else {
              Данные из сервиса планирования
            }
          </p>
        </div>
        @if (progressTotal()) {
          <div class="shrink-0 text-right">
            <div class="text-sm font-semibold tabular-nums text-brand">
              {{ progressDone() }} / {{ progressTotal() }}
            </div>
            <div class="text-[10px] uppercase tracking-wide text-slate-400">визитов</div>
          </div>
        }
      </div>

      @if (store.employeeLoading()) {
        <section class="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <app-icon name="refresh-cw" class="mx-auto size-7 text-brand spin" />
          <p class="mt-3 text-sm font-medium text-slate-700">Загружаем смену…</p>
          <p class="mt-1 text-xs text-slate-500">
            Получаем дни, наряды и план из сервиса планирования.
          </p>
        </section>
      } @else if (store.employeeError(); as message) {
        <section class="rounded-2xl border border-red-200 bg-white px-5 py-8 text-center">
          <app-icon name="triangle-alert" class="mx-auto size-7 text-red-500" />
          <p class="mt-3 text-sm font-medium text-slate-800">Смена недоступна</p>
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
        <!-- Дни из GET /api/v1/ui/days -->
        @if (dayChips().length) {
          <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
            @for (day of dayChips(); track day.date) {
              <button
                type="button"
                (click)="store.selectDay(day.date)"
                [disabled]="store.dayLoading()"
                class="min-w-[92px] rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60"
                [class.border-brand]="day.current"
                [class.bg-brand]="day.current"
                [class.text-white]="day.current"
                [class.border-slate-200]="!day.current"
                [class.bg-white]="!day.current"
                [class.text-slate-700]="!day.current"
              >
                <span class="block text-xs font-medium">{{ day.label }}</span>
                <span
                  class="block text-[11px]"
                  [class.text-white/75]="day.current"
                  [class.text-slate-400]="!day.current"
                >
                  {{ day.short }}
                </span>
              </button>
            }
            @if (store.dayLoading()) {
              <span class="self-center pl-1 text-[11px] text-slate-400">Обновляем…</span>
            }
          </div>
        }

        @if (!route()) {
          <section class="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <app-icon name="route" class="mx-auto size-8 text-slate-300" />
            <p class="mt-3 text-sm font-semibold text-slate-800">Маршрут на смену не назначен</p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              В плане сервиса для сотрудника {{ staffId() }} нет маршрута на
              {{ store.currentDate() }}. Чужая бригада не подставляется.
            </p>
          </section>
        } @else {
          <app-routes-map [onlyStaffId]="staffId()" [compact]="true" />

          @if (current(); as visit) {
            <!-- Напоминание о звонке: 30 минут до начала слота -->
            <a
              [href]="visit.telHref"
              (click)="call(visit)"
              class="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors"
              [class.border-amber-200]="callDue()"
              [class.bg-amber-50]="callDue()"
              [class.border-slate-200]="!callDue()"
              [class.bg-white]="!callDue()"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-full"
                [class.bg-amber-400]="callDue()"
                [class.text-white]="callDue()"
                [class.bg-slate-100]="!callDue()"
                [class.text-slate-500]="!callDue()"
              >
                <app-icon name="phone" class="size-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-slate-800">
                  {{ callDue() ? 'Пора позвонить клиенту' : 'Позвонить клиенту' }}
                </span>
                <span class="block text-xs text-slate-500">
                  @if (callDue()) {
                    Подтвердите визит: слот начинается в {{ fmtTime(visit.order.slot.start) }}.
                  } @else {
                    По плану звонок в {{ callTimeLabel() }} — за 30 минут до слота.
                  }
                </span>
              </span>
              <app-icon name="chevron-right" class="size-4 shrink-0 text-slate-400" />
            </a>

            <section
              class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div class="border-b border-slate-100 px-4 py-3">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand"
                >
                  <span class="size-1.5 rounded-full bg-brand"></span>
                  {{ visit.state === 'ARRIVED' ? 'Вы на адресе' : 'Текущий наряд' }}
                </span>
                <h2 class="mt-2 text-base font-semibold leading-snug text-slate-900">
                  {{ workType(visit) }}
                </h2>
                <p class="mt-1 text-sm leading-5 text-slate-500">{{ visit.order.address }}</p>
                @if (visit.stop.stop.explanation?.includes('Совместный')) {
                  <p class="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
                    <app-icon name="users" class="size-3.5" />
                    Совместный визит — требуется второй сотрудник
                  </p>
                }
              </div>

              <div class="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                <div class="px-2 py-2.5 text-center">
                  <div class="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <app-icon name="clock" class="size-3" />
                    Слот
                  </div>
                  <div class="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">
                    {{ fmtTimeRange(visit.order.slot.start, visit.order.slot.end) }}
                  </div>
                </div>
                <div class="px-2 py-2.5 text-center">
                  <div class="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <app-icon name="map-pin" class="size-3" />
                    Прибытие
                  </div>
                  <div class="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">
                    {{ fmtTime(visit.stop.stop.arrival) }}
                  </div>
                </div>
                <div class="px-2 py-2.5 text-center">
                  <div class="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <app-icon name="truck" class="size-3" />
                    В пути
                  </div>
                  <div class="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">
                    {{ travel(visit) }}
                  </div>
                </div>
              </div>

              <div class="border-b border-slate-100 px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <app-icon name="user" class="size-4" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-medium text-slate-700">Клиент</span>
                      <span
                        class="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700"
                        title="В API нет телефона абонента: номер демонстрационный"
                      >
                        демо-номер
                      </span>
                    </div>
                    <a [href]="visit.telHref" class="block text-sm font-semibold text-slate-900">
                      {{ visit.phone }}
                    </a>
                  </div>
                  <span class="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                    {{ visit.order.technology }}
                  </span>
                </div>
              </div>

              <div class="px-4 py-3">
                <div class="text-[11px] font-medium text-slate-500">Что взять с собой</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  @for (item of equipment(visit.order); track item.label) {
                    <span
                      class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                    >
                      <app-icon name="package" class="size-3.5 text-brand" />
                      {{ item.label }}
                      @if (item.count > 1) {
                        <span class="text-slate-400">×{{ item.count }}</span>
                      }
                    </span>
                  } @empty {
                    <span class="text-xs text-slate-400">Оборудование не требуется</span>
                  }
                </div>
              </div>

              <div class="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3">
                @if (visit.stop.late) {
                  <div
                    class="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600"
                  >
                    <app-icon name="alarm-clock" class="size-3.5" />
                    Риск нарушения слота: начало не позже {{ fmtTime(visit.order.latest_start) }}
                  </div>
                }

                <div class="grid grid-cols-2 gap-2">
                  <a
                    [href]="visit.navUrl"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand hover:text-brand"
                  >
                    <app-icon name="navigation" class="size-3.5" />
                    Навигатор
                  </a>
                  <a
                    [href]="visit.mapUrl"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand hover:text-brand"
                  >
                    <app-icon name="map-pin" class="size-3.5" />
                    2ГИС
                  </a>
                </div>

                <button
                  type="button"
                  (click)="arrive(visit)"
                  [disabled]="visit.state === 'ARRIVED' || visit.state === 'DONE'"
                  class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
                >
                  <app-icon name="map-pin" class="size-4" />
                  @if (visit.mark.arrivedAt; as arrivedAt) {
                    На адресе с {{ fmtTime(arrivedAt) }}
                  } @else {
                    Я на месте
                  }
                </button>

                <button
                  type="button"
                  (click)="complete(visit)"
                  [disabled]="visit.state === 'DONE'"
                  class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:bg-emerald-50 disabled:text-emerald-700"
                >
                  <app-icon name="navigation" class="size-4" />
                  @if (visit.state === 'DONE') {
                    Визит завершён
                  } @else {
                    Завершить визит
                  }
                </button>
              </div>
            </section>
          } @else if (progressTotal()) {
            <section class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <app-icon name="check-circle-2" class="mx-auto size-8 text-emerald-600" />
              <p class="mt-2 text-sm font-semibold text-emerald-800">Все визиты выполнены</p>
              <p class="mt-1 text-xs text-emerald-700">
                На сегодня в маршруте не осталось незавершённых адресов.
              </p>
            </section>
          }

          <section class="rounded-2xl border border-slate-200 bg-white">
            <div
              class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5"
            >
              <span class="text-xs font-semibold text-slate-700">Наряды на смену</span>
              <span class="text-[11px] text-slate-400">{{ visits().length }}</span>
            </div>
            <ol class="divide-y divide-slate-100">
              @for (visit of visits(); track visit.order.order_id) {
                <li
                  class="flex items-center gap-3 px-4 py-3"
                  [class.bg-brand-50/60]="current()?.order?.order_id === visit.order.order_id"
                >
                  <span
                    class="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                    [class.bg-brand]="visit.state !== 'DONE'"
                    [class.text-white]="visit.state !== 'DONE'"
                    [class.bg-slate-100]="visit.state === 'DONE'"
                    [class.text-slate-400]="visit.state === 'DONE'"
                  >
                    @if (visit.state === 'DONE') {
                      <app-icon name="check-circle-2" class="size-3.5" />
                    } @else {
                      {{ visit.index }}
                    }
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-slate-800" [title]="visit.order.address">
                      {{ visit.order.address }}
                    </div>
                    <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span class="font-mono">№ {{ short(visit.order.order_id) }}</span>
                      <span>·</span>
                      <span class="tabular-nums">{{ fmtTime(visit.order.slot.start) }}</span>
                      <span>·</span>
                      <span [class]="stateMeta(visit.state).chip" class="rounded px-1 py-0.5">
                        {{ stateMeta(visit.state).label }}
                      </span>
                    </div>
                  </div>
                </li>
              } @empty {
                <li class="px-4 py-8 text-center text-sm text-slate-500">
                  В маршруте нет визитов.
                </li>
              }
            </ol>
            <div class="border-t border-slate-100 px-4 py-2.5 text-center">
              <a
                routerLink="/app/orders"
                class="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-700"
              >
                Все наряды смены
                <app-icon name="chevron-right" class="size-3" />
              </a>
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class EmployeeShiftPage {
  protected readonly store = inject(DispatchStore);
  private readonly session = inject(SessionStore);

  protected readonly staffId = this.session.staffId;
  protected readonly route = computed(() =>
    this.store.employeeLoading() || this.store.employeeError()
      ? null
      : this.store.routeFor(this.staffId()),
  );

  protected readonly visits = computed<ShiftVisit[]>(() => {
    const route = this.route();
    if (!route) return [];
    const marks = this.store.marksFor(this.staffId());
    return route.stops
      .filter((stop) => stop.stop.type === 'VISIT' && stop.order)
      .map((stop, index) => {
        const order = stop.order!;
        const mark = marks[order.order_id] ?? {};
        const phone = subscriberPhone(order.order_id);
        return {
          stop,
          order,
          index: index + 1,
          state: visitStateOf(stop.stop.status, mark),
          mark,
          phone,
          telHref: telHref(phone),
          navUrl: yandexRoute(stop.lat, stop.lon),
          mapUrl: gisPoint(stop.lat, stop.lon),
        };
      });
  });

  protected readonly current = computed(
    () => this.visits().find((visit) => visit.state !== 'DONE') ?? null,
  );

  protected readonly progressTotal = computed(() => this.visits().length);
  protected readonly progressDone = computed(
    () => this.visits().filter((visit) => visit.state === 'DONE').length,
  );

  protected readonly dayChips = computed(() =>
    buildDayChips(this.store.days(), this.store.currentDate()).reverse(),
  );

  protected readonly dateLabel = computed(() => {
    const date = this.store.currentDate();
    if (!date) return '';
    const chip = this.dayChips().find((day) => day.current);
    const long = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Yekaterinburg',
    }).format(new Date(`${date}T12:00:00+05:00`));
    return chip ? `${chip.label}, ${long}` : long;
  });

  protected readonly callDue = computed(() => {
    const visit = this.current();
    if (!visit) return false;
    return Date.parse(this.store.now()) >= Date.parse(callAt(visit.order.slot.start));
  });

  protected readonly callTimeLabel = computed(() => {
    const visit = this.current();
    return visit ? fmtTime(callAt(visit.order.slot.start)) : '';
  });

  protected workType(visit: ShiftVisit): string {
    const work = this.store.workTypeByCode().get(visit.order.work_type_code);
    return work?.name ?? WORK_SHORT[visit.order.work_type_code] ?? visit.order.work_type_code;
  }

  protected equipment(order: Order): EquipmentItem[] {
    const cups = order.required_equipment;
    return [
      { label: 'ONT', count: cups.ONT },
      { label: 'Роутер', count: cups.ROUTER },
      { label: 'ТВ-приставка', count: cups.STB },
    ].filter((item) => item.count > 0);
  }

  protected travel(visit: ShiftVisit): string {
    const minutes = (visit.stop.stop.travel_sec ?? 0) / 60;
    const distance = fmtKm(visit.stop.stop.distance_m);
    return minutes ? `${fmtDuration(minutes)} · ${distance}` : distance;
  }

  protected stateMeta(state: FieldVisitState) {
    return VISIT_STATE_META[state];
  }

  protected short(orderId: string): string {
    return shortOrder(orderId);
  }

  protected call(visit: ShiftVisit): void {
    if (!visit.mark.calledAt) this.store.markCalled(visit.order.order_id, this.staffId());
  }

  protected arrive(visit: ShiftVisit): void {
    if (visit.state === 'ARRIVED' || visit.state === 'DONE') return;
    this.store.markArrived(visit.order.order_id, this.staffId());
  }

  protected complete(visit: ShiftVisit): void {
    if (visit.state === 'DONE') return;
    this.store.markCompleted(visit.order.order_id, this.staffId());
  }

  protected readonly fmtTime = fmtTime;
  protected readonly fmtTimeRange = fmtTimeRange;
  protected readonly plural = plural;
}
