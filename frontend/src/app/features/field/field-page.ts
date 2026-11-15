import { Component, computed, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { FieldMark, FieldVisitState, FieldVisitView, StopView } from '../../core/models';
import { fmtDuration, fmtTime, fmtTimeRange } from '../../core/time';
import { Icon } from '../../shared/icon';
import { PRESENCE_CLASS, PRESENCE_DOT, WORK_SHORT, plural, shortOrder } from '../../shared/ui';

interface StateMeta {
  label: string;
  chip: string;
  dot: string;
  icon: string;
}

const STATE_META: Record<FieldVisitState, StateMeta> = {
  PLANNED: {
    label: 'Запланирован',
    chip: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    icon: 'clock',
  },
  CALLED: {
    label: 'Абонент предупреждён',
    chip: 'bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    icon: 'phone',
  },
  ARRIVED: {
    label: 'На адресе',
    chip: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    icon: 'map-pin',
  },
  DONE: {
    label: 'Выполнен',
    chip: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: 'check-circle-2',
  },
};

/** Демо-телефон абонента: в проде приходит из CRM, здесь детерминированно выводим из номера наряда. */
function subscriberPhone(orderId: string): string {
  let hash = 0;
  for (let i = 0; i < orderId.length; i += 1) hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0;
  const p1 = 900 + (hash % 100);
  const p2 = (hash >>> 8) % 1000;
  const p3 = (hash >>> 18) % 100;
  const p4 = (hash >>> 4) % 100;
  const pad = (value: number, size: number) => String(value).padStart(size, '0');
  return `+7 (${p1}) ${pad(p2, 3)}-${pad(p3, 2)}-${pad(p4, 2)}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Маршрут до точки в Яндекс.Картах: `~` — старт от текущего местоположения. */
function yandexRoute(lat: number, lon: number): string {
  return `https://yandex.ru/maps/?rtext=~${lat.toFixed(6)},${lon.toFixed(6)}&rtt=auto`;
}

function gisPoint(lat: number, lon: number): string {
  return `https://2gis.ru/geo/${lon.toFixed(6)},${lat.toFixed(6)}`;
}

@Component({
  selector: 'app-field-page',
  imports: [Icon],
  template: `
    <div class="mx-auto w-full max-w-md space-y-4">
      <!-- Выбор бригады -->
      <section class="rounded-2xl border border-slate-200 bg-white p-4">
        @if (store.fieldRoute(); as route) {
          <div class="flex items-center gap-3">
            <div
              class="relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
              [style.background]="route.meta.color"
            >
              {{ initials() }}
              <span
                class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"
                [class]="presenceDot()"
              ></span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ route.staff.display_name }}</div>
              <div class="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <span class="font-mono">{{ route.staff.staff_id }}</span>
                <span>·</span>
                <span [class]="presenceClass()">{{ route.presence }}</span>
              </div>
            </div>
            <button
              type="button"
              (click)="store.toggleFieldPicker()"
              class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand hover:text-brand"
            >
              Сменить
            </button>
          </div>

          <div class="mt-3">
            <div class="flex items-center justify-between text-xs text-slate-500">
              <span>
                Выполнено {{ store.fieldDone() }} из {{ store.fieldTotal() }}
                {{ plural(store.fieldTotal(), 'визит', 'визита', 'визитов') }}
              </span>              <span class="tabular-nums">{{ progressPct() }}%</span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-brand transition-all"
                [style.width.%]="progressPct()"
              ></div>
            </div>
          </div>
        } @else {
          <p class="text-sm text-slate-500">Маршрут на смену не назначен.</p>
        }
      </section>

      @if (current(); as visit) {
        <section class="overflow-hidden rounded-2xl border border-brand/30 bg-white shadow-sm">
          <div class="flex items-center gap-2 bg-brand-50 px-4 py-2 text-xs font-medium text-brand">
            <app-icon
              [name]="visit.state === 'ARRIVED' ? 'map-pin' : 'navigation'"
              class="size-3.5"
            />
            {{ visit.state === 'ARRIVED' ? 'Вы на адресе' : 'Следующий адрес' }}
            <span class="ml-auto tabular-nums">
              {{ store.fieldDone() + 1 }} / {{ store.fieldTotal() }}
            </span>
          </div>

          <div class="p-4">
            <div class="flex items-start gap-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                [style.background]="visit.color"
              >
                {{ visit.index }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-mono text-xs text-slate-500">
                    № {{ short(visit.order.order_id) }}
                  </span>
                  <span [class]="stateMeta(visit.state).chip" class="rounded px-1.5 py-0.5 text-[10px] font-medium">
                    {{ stateMeta(visit.state).label }}
                  </span>
                </div>
                <p class="mt-1 text-base font-semibold leading-snug text-slate-900">
                  {{ visit.order.address }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ workType(visit) }}
                </p>
                @if (visit.stop.stop.explanation?.includes('Совместный')) {
                  <p class="mt-0.5 inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
                    <app-icon name="users" class="size-3.5" />
                    Совместный визит — требуется второй сотрудник
                  </p>
                }
              </div>
            </div>

            <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
              <div class="rounded-lg bg-slate-50 px-2 py-1.5">
                <dt class="text-[10px] text-slate-500">Слот</dt>
                <dd class="text-xs font-semibold tabular-nums">
                  {{ fmtTimeRange(visit.order.slot.start, visit.order.slot.end) }}
                </dd>
              </div>
              <div class="rounded-lg bg-slate-50 px-2 py-1.5">
                <dt class="text-[10px] text-slate-500">По плану</dt>
                <dd class="text-xs font-semibold tabular-nums">
                  {{ fmtTime(visit.stop.stop.start) }}
                </dd>
              </div>
              <div class="rounded-lg bg-slate-50 px-2 py-1.5">
                <dt class="text-[10px] text-slate-500">В пути</dt>
                <dd class="text-xs font-semibold tabular-nums">
                  {{ fmtDuration((visit.stop.stop.travel_sec ?? 0) / 60) }}
                </dd>
              </div>
            </dl>

            @if (visit.stop.late) {
              <div
                class="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600"
              >
                <app-icon name="alarm-clock" class="size-3.5" />
                Риск нарушения слота: до {{ fmtTime(visit.order.latest_start) }}
              </div>
            }

            <!-- Навигация -->
            <div class="mt-3 grid grid-cols-2 gap-2">
              <a
                [href]="visit.navUrl"
                target="_blank"
                rel="noopener"
                class="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                <app-icon name="navigation" class="size-4" />
                Навигатор
              </a>
              <a
                [href]="visit.mapUrl"
                target="_blank"
                rel="noopener"
                class="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand hover:text-brand"
              >
                <app-icon name="map-pin" class="size-4" />
                2ГИС
              </a>
            </div>
            <button
              type="button"
              (click)="copyAddress(visit.order.address)"
              class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-brand hover:text-brand"
            >
              <app-icon name="clipboard-list" class="size-3.5" />
              Скопировать адрес
            </button>

            <!-- Отметки -->
            <div class="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <a
                [href]="visit.telHref"
                (click)="call(visit)"
                class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:border-sky-400 hover:bg-sky-50"
                [class.border-sky-300]="visit.state !== 'PLANNED'"
                [class.bg-sky-50]="visit.state !== 'PLANNED'"
              >
                <span class="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
                  <app-icon name="phone" class="size-4" />
                </span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="block text-sm font-medium text-slate-800">Позвонить абоненту</span>
                  <span class="block text-xs text-slate-500">{{ visit.phone }}</span>
                </span>
                @if (visit.mark.calledAt; as calledAt) {
                  <span class="shrink-0 text-[11px] font-medium tabular-nums text-sky-700">
                    {{ fmtTime(calledAt) }}
                  </span>
                } @else {
                  <app-icon name="chevron-right" class="size-4 shrink-0 text-slate-400" />
                }
              </a>

              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  (click)="arrive(visit)"
                  [disabled]="visit.state === 'ARRIVED' || visit.state === 'DONE'"
                  class="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-default"
                  [class.border-emerald-300]="visit.state === 'ARRIVED' || visit.state === 'DONE'"
                  [class.bg-emerald-50]="visit.state === 'ARRIVED' || visit.state === 'DONE'"
                  [class.text-emerald-700]="visit.state === 'ARRIVED' || visit.state === 'DONE'"
                  [class.border-slate-200]="visit.state === 'PLANNED' || visit.state === 'CALLED'"
                  [class.text-slate-700]="visit.state === 'PLANNED' || visit.state === 'CALLED'"
                >
                  <app-icon name="map-pin" class="size-4" />
                  @if (visit.mark.arrivedAt; as arrivedAt) {
                    {{ fmtTime(arrivedAt) }}
                  } @else {
                    Я на месте
                  }
                </button>
                <button
                  type="button"
                  (click)="complete(visit)"
                  [disabled]="visit.state === 'DONE'"
                  [class]="completeClass(visit)"
                >
                  <app-icon name="check-circle-2" class="size-4" />
                  @if (visit.mark.completedAt; as completedAt) {
                    {{ fmtTime(completedAt) }}
                  } @else {
                    Завершить
                  }
                </button>
              </div>

              <p class="flex items-center gap-1 text-[11px] text-slate-400">
                <app-icon name="info" class="size-3.5" />
                Отметки сохраняются локально; после интеграции уходят в диспетчерскую.
              </p>
            </div>
          </div>
        </section>
      } @else {
        <section class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <app-icon name="check-circle-2" class="mx-auto size-8 text-emerald-600" />
          <p class="mt-2 text-sm font-semibold text-emerald-800">Все визиты выполнены</p>
          <p class="mt-1 text-xs text-emerald-700">
            Можно возвращаться в сервисный центр или ожидать новую заявку.
          </p>
        </section>
      }

      <!-- Все наряды на смену -->
      <section class="rounded-2xl border border-slate-200 bg-white">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">
          <span>Наряды на смену</span>
          <span class="text-slate-400">{{ visits().length }}</span>
        </div>
        <ol class="divide-y divide-slate-100">
          @for (visit of visits(); track visit.order.order_id) {
            <li
              class="flex items-center gap-3 px-4 py-3"
              [class.bg-brand-50]="visit.isCurrent"
            >
              <span
                class="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                [class.text-white]="visit.state !== 'DONE'"
                [class.bg-slate-200]="visit.state === 'DONE'"
                [class.text-slate-500]="visit.state === 'DONE'"
                [style.background]="visit.state !== 'DONE' ? visit.color : null"
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
                  <span class="tabular-nums">{{ fmtTime(visit.stop.stop.start) }}</span>
                  <span>·</span>
                  <span [class]="stateMeta(visit.state).chip" class="rounded px-1 py-0.5">
                    {{ stateMeta(visit.state).label }}
                  </span>
                </div>
              </div>
              <span
                class="size-2 shrink-0 rounded-full"
                [class]="stateMeta(visit.state).dot"
              ></span>
            </li>
          } @empty {
            <li class="px-4 py-8 text-center text-sm text-slate-500">Наряды не назначены.</li>
          }
        </ol>
        @if (hasMarks()) {
          <div class="border-t border-slate-100 px-4 py-2">
            <button
              type="button"
              (click)="store.resetFieldMarks()"
              class="text-[11px] font-medium text-slate-400 transition-colors hover:text-red-600"
            >
              Сбросить отметки выезда
            </button>
          </div>
        }
      </section>
    </div>

    <!-- Выбор бригады -->
    @if (store.fieldPickerOpen()) {
      <div class="fixed inset-0 z-40 flex items-end bg-slate-900/40" (click)="store.toggleFieldPicker()">
        <div
          class="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 md:mx-auto md:max-w-md md:rounded-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">Бригада на смене</h3>
            <button
              type="button"
              (click)="store.toggleFieldPicker()"
              class="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Закрыть"
            >
              <app-icon name="x" class="size-4" />
            </button>
          </div>
          <div class="space-y-1.5">
            @for (card of staffOptions(); track card.staff.staff_id) {
              <button
                type="button"
                (click)="store.selectFieldStaff(card.staff.staff_id)"
                class="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                [class.border-brand]="card.staff.staff_id === store.fieldRoute()?.staff?.staff_id"
                [class.bg-brand-50]="card.staff.staff_id === store.fieldRoute()?.staff?.staff_id"
                [class.border-slate-200]="card.staff.staff_id !== store.fieldRoute()?.staff?.staff_id"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                  [style.background]="card.meta.color"
                >
                  {{ card.initials }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ card.staff.display_name }}</span>
                  <span class="block text-xs text-slate-500">
                    {{ card.meta.district }} · {{ card.done }}/{{ card.visits }} визитов
                  </span>
                </span>
                @if (card.staff.staff_id === store.fieldRoute()?.staff?.staff_id) {
                  <app-icon name="check-circle-2" class="size-4 shrink-0 text-brand" />
                }
              </button>
            } @empty {
              <p class="py-6 text-center text-sm text-slate-500">Нет бригад с маршрутом.</p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class FieldPage {
  protected readonly store = inject(DispatchStore);

  protected readonly visits = computed<FieldVisitView[]>(() => {
    const route = this.store.fieldRoute();
    if (!route) return [];
    const marks = this.store.fieldMarksByOrder();
    const currentSeq = this.store.fieldCurrentVisit()?.stop.seq;
    return route.stops
      .filter((stop) => stop.stop.type === 'VISIT' && stop.order)
      .map((stop, index) => {
        const order = stop.order!;
        const mark = marks[order.order_id] ?? {};
        return {
          stop,
          order,
          staff: route.staff,
          color: route.meta.color,
          state: this.stateOf(stop, mark),
          mark,
          index: index + 1,
          phone: subscriberPhone(order.order_id),
          telHref: telHref(subscriberPhone(order.order_id)),
          navUrl: yandexRoute(stop.lat, stop.lon),
          mapUrl: gisPoint(stop.lat, stop.lon),
          isCurrent: stop.stop.seq === currentSeq,
        };
      });
  });

  protected readonly current = computed(() => this.visits().find((visit) => visit.isCurrent) ?? null);

  protected readonly staffOptions = computed(() =>
    this.store.staffCards().filter((card) => card.visits > 0),
  );

  protected readonly initials = computed(() => {
    const name = this.store.fieldRoute()?.staff.display_name ?? '';
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('');
  });

  protected readonly presenceClass = computed(
    () => PRESENCE_CLASS[this.store.fieldRoute()?.presence ?? 'Свободен'],
  );

  protected readonly presenceDot = computed(
    () => PRESENCE_DOT[this.store.fieldRoute()?.presence ?? 'Свободен'],
  );

  protected readonly progressPct = computed(() => {
    const total = this.store.fieldTotal();
    return total ? Math.round((this.store.fieldDone() / total) * 100) : 0;
  });

  protected readonly hasMarks = computed(() => Object.keys(this.store.fieldMarksByOrder()).length > 0);

  protected stateMeta(state: FieldVisitState): StateMeta {
    return STATE_META[state];
  }

  protected completeClass(visit: FieldVisitView): string {
    const base = 'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60';
    return visit.state === 'DONE'
      ? `${base} bg-emerald-50 text-emerald-700`
      : `${base} bg-brand text-white hover:bg-brand-700`;
  }

  protected workType(visit: FieldVisitView): string {
    const work = this.store.workTypeByCode().get(visit.order.work_type_code);
    return work?.name ?? WORK_SHORT[visit.order.work_type_code] ?? visit.order.work_type_code;
  }

  protected short(orderId: string): string {
    return shortOrder(orderId);
  }

  protected call(visit: FieldVisitView): void {
    if (!visit.mark.calledAt) this.store.markCalled(visit.order.order_id);
  }

  protected arrive(visit: FieldVisitView): void {
    if (visit.state === 'ARRIVED' || visit.state === 'DONE') return;
    this.store.markArrived(visit.order.order_id);
  }

  protected complete(visit: FieldVisitView): void {
    if (visit.state === 'DONE') return;
    this.store.markCompleted(visit.order.order_id);
  }

  protected copyAddress(address: string): void {
    navigator.clipboard?.writeText(address).then(
      () => this.store.showToast('Адрес скопирован', 'info'),
      () => this.store.showToast('Не удалось скопировать адрес', 'warning'),
    );
  }

  private stateOf(stop: StopView, mark: FieldMark): FieldVisitState {
    if (mark.completedAt || stop.stop.status === 'DONE') return 'DONE';
    if (mark.arrivedAt || stop.stop.status === 'IN_PROGRESS') return 'ARRIVED';
    if (mark.calledAt) return 'CALLED';
    return 'PLANNED';
  }

  protected readonly fmtTime = fmtTime;
  protected readonly fmtTimeRange = fmtTimeRange;
  protected readonly fmtDuration = fmtDuration;
  protected readonly plural = plural;
}
