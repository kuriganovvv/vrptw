import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DispatchStore } from '../../core/dispatch-store';
import { StaffCardView, StopView, RouteView } from '../../core/models';
import { fmtDateLong, fmtTime } from '../../core/time';
import { Icon } from '../../shared/icon';
import {
  PRESENCE_CLASS,
  PRESENCE_DOT,
  PROFILE_BADGE,
  shortOrder,
} from '../../shared/ui';

type StaffFilter = 'all' | 'active' | 'risk' | 'free';

@Component({
  selector: 'app-staff-page',
  imports: [RouterLink, Icon],
  template: `
    <div class="space-y-4 md:space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Сотрудники на смене</h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ dateLabel() }} · {{ store.staffCards().length }} сотрудников, из них
            {{ activeCount() }} с маршрутом
          </p>
        </div>
        <label class="relative w-full sm:w-72">
          <span class="sr-only">Поиск сотрудника</span>
          <app-icon
            name="search"
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Имя, профиль или район"
            [value]="store.search()"
            (input)="onSearch($event)"
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
      </header>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Сводка по сотрудникам">
        <article class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">Всего на смене</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums">{{ store.staffCards().length }}</div>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">С маршрутом</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums text-brand">{{ activeCount() }}</div>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">В риске</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums text-red-600">{{ riskCount() }}</div>
        </article>
        <article class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-medium text-slate-500">Свободны</div>
          <div class="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{{ freeCount() }}</div>
        </article>
      </section>

      <div class="flex flex-wrap items-center gap-1.5">
        @for (item of filters; track item.key) {
          <button
            type="button"
            (click)="filter.set(item.key)"
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            [class.bg-brand]="filter() === item.key"
            [class.text-white]="filter() === item.key"
            [class.bg-white]="filter() !== item.key"
            [class.text-slate-600]="filter() !== item.key"
            [class.border]="filter() !== item.key"
            [class.border-slate-200]="filter() !== item.key"
          >
            {{ item.label }}
          </button>
        }
      </div>

      <section class="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (card of cards(); track card.staff.staff_id) {
            <article
              class="cursor-pointer rounded-2xl border bg-white p-4 transition-all hover:shadow-sm"
              [class.border-brand]="isSelected(card)"
              [class.ring-1]="isSelected(card)"
              [class.ring-brand]="isSelected(card)"
              [class.border-slate-200]="!isSelected(card)"
              (click)="store.selectStaff(card.staff.staff_id)"
            >
              <div class="flex items-start gap-3">
                <div
                  class="relative grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                >
                  {{ card.initials }}
                  <span
                    class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"
                    [style.background]="card.meta.color"
                  ></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="truncate text-sm font-semibold">{{ card.staff.display_name }}</span>
                    @for (profile of card.staff.profiles; track profile) {
                      <span
                        class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                        [class]="profileBadge(profile)"
                        >{{ profile }}</span
                      >
                    }
                  </div>
                  <div class="mt-0.5 truncate text-xs text-slate-500">
                    {{ card.meta.district }} ·
                    <span [class]="presenceClass(card)">{{ card.presence }}</span>
                  </div>
                </div>
                <span class="rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  {{ card.staff.staff_id }}
                </span>
              </div>

              <div class="mt-3 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div class="text-sm font-semibold tabular-nums">{{ card.done }}/{{ card.visits }}</div>
                  <div class="text-[10px] text-slate-500">визитов</div>
                </div>
                <div class="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div class="text-sm font-semibold tabular-nums">
                    {{ card.km.toFixed(1).replace('.', ',') }}
                  </div>
                  <div class="text-[10px] text-slate-500">км</div>
                </div>
                <div class="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div class="text-sm font-semibold tabular-nums">{{ card.eta ?? '—' }}</div>
                  <div class="text-[10px] text-slate-500">прибытие</div>
                </div>
              </div>

              <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full"
                  [class.bg-red-500]="card.risk"
                  [class.bg-brand]="!card.risk"
                  [style.width.%]="card.visits ? (card.done / card.visits) * 100 : 0"
                ></div>
              </div>

              @if (card.nextStop?.order; as order) {
                <div class="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <app-icon name="navigation" class="size-3.5 shrink-0 text-brand" />
                  <span class="truncate" [title]="order.address">{{ order.address }}</span>
                  <span class="ml-auto shrink-0 font-mono text-[11px] text-slate-500">
                    {{ card.eta }}
                  </span>
                </div>
              }
            </article>
          } @empty {
            <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <app-icon name="users" class="mx-auto size-7 text-slate-300" />
              <p class="mt-2 text-sm font-medium text-slate-700">Сотрудники не найдены</p>
              <p class="text-xs text-slate-500">Попробуйте изменить запрос или фильтр.</p>
            </div>
          }
        </div>

        <aside class="min-w-0">
          <div class="sticky top-20">
            @if (store.selectedRoute(); as route) {
              <div class="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div class="border-b border-slate-100 p-4">
                  <div class="flex items-start gap-3">
                    <div
                      class="relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                      [style.background]="route.meta.color"
                    >
                      {{ initials(route) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="truncate text-base font-semibold">{{ route.staff.display_name }}</h3>
                      <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span class="font-mono">{{ route.staff.staff_id }}</span>
                        <span>·</span>
                        <span>{{ route.meta.district }}</span>
                        <span
                          class="inline-flex items-center gap-1 font-medium"
                          [class]="presenceClass(route)"
                        >
                          <span class="size-1.5 rounded-full" [class]="presenceDot(route)"></span>
                          {{ route.presence }}
                        </span>
                      </div>
                    </div>
                    <a
                      routerLink="/dashboard"
                      class="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-brand hover:text-brand"
                      title="Показать на карте"
                    >
                      <app-icon name="map-pin" class="size-4" />
                    </a>
                  </div>

                  <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt class="text-slate-500">Сервисный центр</dt>
                    <dd class="text-right font-medium">
                      {{ store.scById().get(route.staff.service_center_id)?.name ?? route.staff.service_center_id }}
                    </dd>
                    <dt class="text-slate-500">Смена</dt>
                    <dd class="text-right font-medium">
                      {{ route.staff.shift.start }}–{{ route.staff.shift.end }}
                    </dd>
                    <dt class="text-slate-500">Технологии</dt>
                    <dd class="text-right font-medium">{{ route.staff.technologies.join(' · ') }}</dd>
                    <dt class="text-slate-500">Допуск на высоту</dt>
                    <dd class="text-right font-medium">
                      {{ route.staff.height_permit ? 'есть' : 'нет' }}
                    </dd>
                    <dt class="text-slate-500">Выполнено</dt>
                    <dd class="text-right font-medium">{{ route.done }} из {{ route.visits }}</dd>
                    <dt class="text-slate-500">Пробег</dt>
                    <dd class="text-right font-medium">
                      {{ route.km.toFixed(1).replace('.', ',') }} км
                    </dd>
                  </dl>

                  <div class="mt-3 grid grid-cols-3 gap-1.5">
                    @for (item of equipment(route); track item.code) {
                      <div class="rounded-lg bg-slate-50 px-2 py-1 text-center">
                        <div class="font-mono text-[10px] text-slate-500">{{ item.code }}</div>
                        <div class="text-sm font-semibold tabular-nums">{{ item.count }}</div>
                      </div>
                    }
                  </div>
                </div>

                <div class="flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-600">
                  <span>Маршрут</span>
                  <span class="text-slate-400">{{ route.stops.length }} точек</span>
                </div>

                <ol class="scroll-thin flex-1 overflow-y-auto px-4 pb-4">
                  @for (stop of route.stops; track stop.stop.seq; let last = $last) {
                    <li class="relative flex gap-3 pb-3">
                      @if (!last) {
                        <span class="absolute left-[13px] top-7 bottom-0 w-px bg-slate-200"></span>
                      }
                      <span
                        class="relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm"
                        [class]="stopCircle(stop)"
                        [style.background]="stop.stop.type === 'VISIT' ? route.meta.color : null"
                      >
                        @switch (stop.stop.type) {
                          @case ('VISIT') {
                            {{ stop.stop.seq }}
                          }
                          @case ('BREAK') {
                            <app-icon name="clock" class="size-3.5" />
                          }
                          @case ('RESTOCK') {
                            <app-icon name="package" class="size-3.5" />
                          }
                          @default {
                            <app-icon name="building-2" class="size-3.5" />
                          }
                        }
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 text-xs">
                          <span class="font-mono tabular-nums text-slate-600">{{ stop.timeLabel }}</span>
                          @if (stop.stop.type === 'VISIT' && stop.order) {
                            <span class="truncate font-medium text-slate-800">
                              № {{ short(stop.order.order_id) }}
                            </span>
                          } @else {
                            <span class="font-medium text-slate-700">{{ stopTypeLabel(stop.stop.type) }}</span>
                          }
                          <span class="ml-auto shrink-0" [class]="stopStatusClass(stop)">{{
                            stopStatusLabel(stop)
                          }}</span>
                        </div>
                        <div class="mt-0.5 truncate text-xs text-slate-500" [title]="stop.order?.address ?? stop.label">
                          {{ stop.order?.address ?? stop.label }}
                        </div>
                        @if (stop.late) {
                          <div class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                            <app-icon name="alarm-clock" class="size-3" />
                            риск нарушения слота {{ fmtTime(stop.order?.latest_start) }}
                          </div>
                        }
                      </div>
                    </li>
                  }
                </ol>

                <div class="border-t border-slate-100 p-3">
                  <a
                    routerLink="/orders"
                    class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand-100"
                  >
                    Все наряды сотрудника
                    <app-icon name="arrow-right" class="size-3.5" />
                  </a>
                </div>
              </div>
            } @else {
              <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <app-icon name="hard-hat" class="mx-auto size-8 text-slate-300" />
                <p class="mt-2 text-sm font-medium text-slate-700">Выберите сотрудника</p>
                <p class="mt-1 text-xs text-slate-500">
                  Здесь появится маршрут бригады, оборудование и статусы визитов.
                </p>
              </div>
            }
          </div>
        </aside>
      </section>
    </div>
  `,
})
export class StaffPage {
  protected readonly store = inject(DispatchStore);

  protected readonly filter = signal<StaffFilter>('all');
  protected readonly filters: { key: StaffFilter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'active', label: 'С маршрутом' },
    { key: 'risk', label: 'В риске' },
    { key: 'free', label: 'Свободны' },
  ];

  protected readonly dateLabel = () => fmtDateLong(this.store.plan().date);
  protected readonly activeCount = computed(() => this.store.activeRoutes().length);
  protected readonly riskCount = computed(() => this.store.routes().filter((route) => route.risk).length);
  protected readonly freeCount = computed(
    () => this.store.staffCards().filter((card) => card.visits === 0).length,
  );

  protected readonly cards = computed<StaffCardView[]>(() => {
    const cards = this.store.filteredStaff();
    switch (this.filter()) {
      case 'active':
        return cards.filter((card) => card.visits > 0);
      case 'risk':
        return cards.filter((card) => card.risk);
      case 'free':
        return cards.filter((card) => card.visits === 0);
      default:
        return cards;
    }
  });

  protected onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  protected isSelected(card: StaffCardView): boolean {
    return this.store.selectedStaffId() === card.staff.staff_id;
  }

  protected initials(route: { staff: { display_name: string } }): string {
    return route.staff.display_name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('');
  }

  protected presenceClass(card: { presence: StaffCardView['presence'] }): string {
    return PRESENCE_CLASS[card.presence];
  }

  protected presenceDot(card: { presence: StaffCardView['presence'] }): string {
    return PRESENCE_DOT[card.presence];
  }

  protected profileBadge(profile: StaffCardView['staff']['profiles'][number]): string {
    return PROFILE_BADGE[profile];
  }

  protected equipment(route: RouteView): { code: string; count: number }[] {
    return [
      { code: 'ONT', count: route.staff.equipment_start.ONT },
      { code: 'ROUTER', count: route.staff.equipment_start.ROUTER },
      { code: 'STB', count: route.staff.equipment_start.STB },
    ];
  }

  protected stopTypeLabel(type: string): string {
    switch (type) {
      case 'DEPOT_START':
        return 'Выезд из СЦ';
      case 'DEPOT_END':
        return 'Возврат в СЦ';
      case 'BREAK':
        return 'Перерыв';
      case 'RESTOCK':
        return 'Пополнение АО';
      default:
        return 'Визит';
    }
  }

  protected stopCircle(stop: StopView): string {
    if (stop.stop.type === 'VISIT') return 'border-white';
    return stop.stop.type === 'BREAK'
      ? 'bg-slate-400'
      : stop.stop.type === 'RESTOCK'
        ? 'bg-orange-500'
        : 'bg-brand';
  }

  protected stopStatusLabel(stop: StopView): string {
    if (stop.stop.type !== 'VISIT') return '';
    switch (stop.stop.status) {
      case 'DONE':
        return 'выполнено';
      case 'IN_PROGRESS':
        return 'в работе';
      default:
        return 'запланировано';
    }
  }

  protected stopStatusClass(stop: StopView): string {
    switch (stop.stop.status) {
      case 'DONE':
        return 'text-[10px] text-emerald-600';
      case 'IN_PROGRESS':
        return 'text-[10px] text-blue-600';
      default:
        return 'text-[10px] text-slate-400';
    }
  }

  protected short(orderId: string): string {
    return shortOrder(orderId);
  }

  protected readonly fmtTime = fmtTime;
}
