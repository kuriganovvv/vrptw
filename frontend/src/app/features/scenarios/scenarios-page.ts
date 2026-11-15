import { Component, computed, inject, signal } from '@angular/core';
import { DispatchApiService } from '../../core/dispatch-api.service';
import { DispatchStore } from '../../core/dispatch-store';
import {
  Equipment,
  EquipmentAdvice,
  ScenarioRequest,
  ScenarioResult,
} from '../../core/models';
import { fmtDuration, fmtKm, fmtNumber, fmtTimeRange, pct } from '../../core/time';
import { Icon } from '../../shared/icon';

type EquipmentMode = 'current' | 'recommended' | 'manual';
type Tone = 'good' | 'bad' | 'neutral';

interface ComparisonRow {
  key: string;
  label: string;
  base: string;
  scenario: string;
  delta: string;
  tone: Tone;
  note: string;
}

const REASON_LABEL: Record<string, string> = {
  NO_QUALIFIED_STAFF: 'Нет сотрудника с нужным допуском',
  NO_SHIFT_TIME: 'Не хватает времени смены',
  SLOT_UNREACHABLE: 'Слот недостижим',
  NO_EQUIPMENT: 'Нет оборудования',
  STAFF_UNAVAILABLE: 'Исполнитель выбыл',
  OTHER: 'Комбинация ограничений',
};

@Component({
  selector: 'app-scenarios-page',
  imports: [Icon],
  template: `
    <div class="space-y-4 md:space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Сценарный анализ</h2>
          <p class="mt-1 max-w-3xl text-sm text-slate-500">
            Что будет, если на смену выйдет меньше сотрудников, и какой запас АО нужен в
            «рюкзаке», чтобы не заезжать в СЦ. Рабочий план дня не изменяется.
          </p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm"
        >
          <app-icon name="sliders-horizontal" class="size-3.5 text-brand" />
          {{ dateLabel() }}
        </span>
      </header>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] md:gap-5">
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="users" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Параметры сценария</h3>
            <span class="ml-auto text-xs text-slate-400">база и сценарий решаются заново</span>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div class="flex items-baseline justify-between gap-2">
                <label for="staff-delta" class="text-xs font-medium text-slate-600">
                  На смену выйдет меньше сотрудников
                </label>
                <span class="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  −{{ staffDelta() }}
                </span>
              </div>
              <input
                id="staff-delta"
                type="range"
                min="0"
                max="10"
                step="1"
                [value]="staffDelta()"
                (input)="setStaffDelta($event)"
                class="mt-3 w-full accent-brand"
              />
              <div class="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>полная смена</span>
                <span>−10</span>
              </div>
              <p class="mt-2 text-[11px] leading-relaxed text-slate-500">
                Без явного списка сервис убирает наименее загруженных сотрудников базового
                плана — так сценарий детерминирован.
              </p>
            </div>

            <div>
              <span class="text-xs font-medium text-slate-600">Запас АО в рюкзаке</span>
              <div class="mt-2 space-y-2">
                <label class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition-colors"
                  [class.border-brand]="equipmentMode() === 'current'"
                  [class.bg-brand-50]="equipmentMode() === 'current'"
                  [class.border-slate-200]="equipmentMode() !== 'current'">
                  <input
                    type="radio"
                    name="equipment-mode"
                    value="current"
                    [checked]="equipmentMode() === 'current'"
                    (change)="equipmentMode.set('current')"
                    class="mt-0.5 accent-brand"
                  />
                  <span>
                    <span class="font-medium text-slate-700">Текущий запас</span>
                    <span class="mt-0.5 block text-slate-500">Оставить справочные остатки как есть</span>
                  </span>
                </label>
                <label class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition-colors"
                  [class.border-brand]="equipmentMode() === 'recommended'"
                  [class.bg-brand-50]="equipmentMode() === 'recommended'"
                  [class.border-slate-200]="equipmentMode() !== 'recommended'">
                  <input
                    type="radio"
                    name="equipment-mode"
                    value="recommended"
                    [checked]="equipmentMode() === 'recommended'"
                    (change)="equipmentMode.set('recommended')"
                    class="mt-0.5 accent-brand"
                  />
                  <span>
                    <span class="font-medium text-slate-700">Подобрать запас</span>
                    <span class="mt-0.5 block text-slate-500">
                      Подставить рекомендацию по базовому плану и проверить, что заездов в СЦ не останется
                    </span>
                  </span>
                </label>
                <label class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition-colors"
                  [class.border-brand]="equipmentMode() === 'manual'"
                  [class.bg-brand-50]="equipmentMode() === 'manual'"
                  [class.border-slate-200]="equipmentMode() !== 'manual'">
                  <input
                    type="radio"
                    name="equipment-mode"
                    value="manual"
                    [checked]="equipmentMode() === 'manual'"
                    (change)="equipmentMode.set('manual')"
                    class="mt-0.5 accent-brand"
                  />
                  <span class="font-medium text-slate-700">Свой запас</span>
                </label>
              </div>

              @if (equipmentMode() === 'manual') {
                <div class="mt-2 grid grid-cols-3 gap-2">
                  @for (field of equipmentFields; track field) {
                    <label class="text-[10px] font-medium text-slate-500">
                      {{ field }}
                      <input
                        type="number"
                        min="0"
                        max="99"
                        [value]="manual()[field]"
                        (input)="setManual(field, $event)"
                        class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums focus:border-brand focus:outline-none"
                      />
                    </label>
                  }
                </div>
              }
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
            <label class="text-xs text-slate-500">
              Лимит решения, сек
              <select
                [value]="timeLimit()"
                (change)="setTimeLimit($event)"
                class="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-brand focus:outline-none"
              >
                @for (limit of timeLimits; track limit) {
                  <option [value]="limit">{{ limit }}</option>
                }
              </select>
            </label>
            <div class="flex items-center gap-2">
              @if (result()) {
                <button
                  type="button"
                  (click)="reset()"
                  class="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Сбросить
                </button>
              }
              <button
                type="button"
                (click)="run()"
                [disabled]="loading() || store.apiStatus() !== 'online'"
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                <app-icon
                  [name]="loading() ? 'refresh-cw' : 'zap'"
                  class="size-4"
                  [class.spin]="loading()"
                />
                {{ loading() ? 'Считаем два плана…' : 'Рассчитать сценарий' }}
              </button>
            </div>
          </div>

          @if (store.apiStatus() !== 'online') {
            <p class="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <app-icon name="triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
              <span>
                Сценарный анализ считает backend. Проверьте подключение к API.
                <button type="button" (click)="store.checkApi()" class="font-medium underline">
                  Проверить снова
                </button>
              </span>
            </p>
          }
          @if (error(); as message) {
            <p class="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <app-icon name="triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
              {{ message }}
            </p>
          }
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="info" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Как считается</h3>
          </div>
          <ul class="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600">
            <li class="flex gap-2">
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-brand"></span>
              Базовый план и сценарий решаются одним солвером с одинаковым лимитом времени.
            </li>
            <li class="flex gap-2">
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-brand"></span>
              Сравниваются визиты в слот и контрольный срок, пробег, время в пути,
              равномерность и заезды в СЦ.
            </li>
            <li class="flex gap-2">
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-brand"></span>
              Рекомендация по АО считается по маршрутам базового плана: стартовый запас
              должен покрыть суммарную потребность всех визитов.
            </li>
            <li class="flex gap-2">
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500"></span>
              Рабочий план, события и версия плана не меняются.
            </li>
          </ul>
          @if (result(); as result) {
            <div class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Расчёт {{ result.computation_ms }} мс · лимит {{ result.time_limit_sec }} с ·
              {{ result.scenario_plan.routes.length }} маршрутов в сценарии
            </div>
          }
        </div>
      </section>

      @if (loading()) {
        <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"></div>
          }
        </section>
      } @else if (result(); as result) {
        <section class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-slate-500">Сценарий:</span>
            <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              −{{ result.excluded_staff_ids.length }} сотрудник(ов) на смене
            </span>
            @for (name of excludedNames(); track name) {
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{{ name }}</span>
            }
            @if (!result.excluded_staff_ids.length) {
              <span class="text-xs text-slate-500">состав смены не менялся</span>
            }
          </div>

          <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Сравнение метрик">
            @for (row of comparison(); track row.key) {
              <article class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-medium text-slate-500">{{ row.label }}</span>
                  <span
                    class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                    [class.bg-emerald-50]="row.tone === 'good'"
                    [class.text-emerald-700]="row.tone === 'good'"
                    [class.bg-red-50]="row.tone === 'bad'"
                    [class.text-red-700]="row.tone === 'bad'"
                    [class.bg-slate-100]="row.tone === 'neutral'"
                    [class.text-slate-500]="row.tone === 'neutral'"
                  >
                    {{ row.delta }}
                  </span>
                </div>
                <div class="mt-1.5 flex items-baseline gap-1.5">
                  <span class="text-xs tabular-nums text-slate-400">{{ row.base }}</span>
                  <app-icon name="arrow-right" class="size-3 text-slate-300" />
                  <span class="text-lg font-semibold tabular-nums text-slate-800">{{ row.scenario }}</span>
                </div>
                <div class="mt-1 truncate text-[11px] text-slate-500">{{ row.note }}</div>
              </article>
            }
          </div>
        </section>

        <section class="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center gap-2">
              <app-icon name="user-x" class="size-4 text-amber-600" />
              <h3 class="text-sm font-semibold">Новые нераспределённые наряды</h3>
              <span class="ml-auto text-xs text-slate-400">
                {{ result.newly_unassigned.length }} из {{ result.scenario.unassigned }}
              </span>
            </div>
            <div class="mt-3 max-h-72 overflow-auto">
              @if (newlyUnassignedRows().length) {
                <table class="w-full text-left text-xs">
                  <thead class="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th class="pb-2 pr-2 font-medium">Наряд</th>
                      <th class="pb-2 pr-2 font-medium">Слот</th>
                      <th class="pb-2 font-medium">Причина</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    @for (row of newlyUnassignedRows(); track row.id) {
                      <tr>
                        <td class="py-2 pr-2 font-medium text-slate-700">{{ row.id }}</td>
                        <td class="py-2 pr-2 tabular-nums text-slate-500">{{ row.slot }}</td>
                        <td class="py-2 text-amber-700">{{ row.reason }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="py-6 text-center text-sm text-slate-500">
                  Сценарий не добавил нераспределённых нарядов.
                </p>
              }
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center gap-2">
              <app-icon name="package" class="size-4 text-brand" />
              <h3 class="text-sm font-semibold">Запас АО, чтобы не заезжать в СЦ</h3>
              <span class="ml-auto text-xs text-slate-400">
                базовый план: {{ result.equipment_recommendation.restock_stops }} заездов
              </span>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span class="text-slate-500">Суммарно добавить в рюкзаки:</span>
              @for (item of equipmentSummary(result); track item.label) {
                <span class="rounded-md bg-slate-100 px-2 py-1 font-medium tabular-nums text-slate-700">
                  {{ item.label }} +{{ item.value }}
                </span>
              }
              @if (!equipmentSummary(result).length) {
                <span class="text-emerald-700">текущего запаса достаточно</span>
              }
              <label class="ml-auto flex items-center gap-1.5 text-slate-500">
                <input
                  type="checkbox"
                  [checked]="deficitOnly()"
                  (change)="toggleDeficitOnly()"
                  class="accent-brand"
                />
                только с дефицитом
              </label>
            </div>

            <div class="mt-2 max-h-72 overflow-auto">
              <table class="w-full text-left text-xs">
                <thead class="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th class="pb-2 pr-2 font-medium">Сотрудник</th>
                    <th class="pb-2 pr-2 font-medium">Визиты</th>
                    <th class="pb-2 pr-2 font-medium">Сейчас</th>
                    <th class="pb-2 pr-2 font-medium">Нужно</th>
                    <th class="pb-2 font-medium">Добавить</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (row of equipmentRows(); track row.staff_id) {
                    <tr>
                      <td class="py-2 pr-2">
                        <div class="font-medium text-slate-700">{{ row.display_name }}</div>
                        <div class="text-[10px] text-slate-400">
                          {{ row.restock_stops }} заездов в СЦ
                        </div>
                      </td>
                      <td class="py-2 pr-2 tabular-nums text-slate-500">{{ row.visits }}</td>
                      <td class="py-2 pr-2 tabular-nums text-slate-500">{{ equipmentLabel(row.current_start) }}</td>
                      <td class="py-2 pr-2 tabular-nums text-slate-700">{{ equipmentLabel(row.required_start) }}</td>
                      <td class="py-2 tabular-nums font-medium" [class.text-amber-700]="hasDeficit(row)" [class.text-slate-400]="!hasDeficit(row)">
                        {{ equipmentLabel(row.additional_start) }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="py-6 text-center text-sm text-slate-500">
                        Нет сотрудников с визитами в базовом плане.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="mt-3 text-[11px] leading-relaxed text-slate-500">
              {{ result.equipment_recommendation.note }}
            </p>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2">
            <app-icon name="gantt-chart" class="size-4 text-brand" />
            <h3 class="text-sm font-semibold">Загрузка в сценарии</h3>
            <span class="ml-auto text-xs text-slate-400">
              {{ result.scenario.staff_count }} маршрутов · CV {{ fmtNumber(result.scenario.utilization_cv) }}
            </span>
          </div>
          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            @for (route of scenarioRoutes(); track route.staff_id) {
              <div class="rounded-xl border border-slate-100 px-3 py-2">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="truncate font-medium text-slate-700">{{ route.name }}</span>
                  <span class="tabular-nums text-slate-500">{{ route.visits }} визитов</span>
                </div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    class="block h-full rounded-full bg-brand/80"
                    [style.width.%]="route.pct"
                  ></span>
                </div>
                <div class="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>{{ route.km }}</span>
                  <span>{{ route.utilization }}</span>
                </div>
              </div>
            } @empty {
              <p class="text-sm text-slate-500">В сценарии нет маршрутов.</p>
            }
          </div>
        </section>
      } @else {
        <section class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <app-icon name="sliders-horizontal" class="mx-auto size-8 text-slate-300" />
          <h3 class="mt-3 text-sm font-semibold text-slate-700">Сценарий ещё не рассчитан</h3>
          <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Выберите, сколько сотрудников не выйдет на смену, и нажмите «Рассчитать сценарий».
            Сервис сравнит план с текущей сменой и покажет цену решения.
          </p>
        </section>
      }
    </div>
  `,
})
export class ScenariosPage {
  protected readonly store = inject(DispatchStore);
  private readonly api = inject(DispatchApiService);

  readonly timeLimits = [3, 5, 10, 20];
  readonly equipmentFields: (keyof Equipment)[] = ['ONT', 'ROUTER', 'STB'];
  protected readonly fmtNumber = fmtNumber;

  readonly staffDelta = signal(3);
  readonly equipmentMode = signal<EquipmentMode>('recommended');
  readonly manual = signal<Equipment>({ ONT: 9, ROUTER: 12, STB: 6 });
  readonly timeLimit = signal(5);
  readonly loading = signal(false);
  readonly result = signal<ScenarioResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly deficitOnly = signal(false);

  readonly dateLabel = computed(() => this.store.plan().date);

  readonly excludedNames = computed(() => {
    const result = this.result();
    if (!result) return [];
    const staff = this.store.staffById();
    return result.excluded_staff_ids.map((id) => staff.get(id)?.display_name ?? id);
  });

  readonly comparison = computed<ComparisonRow[]>(() => {
    const result = this.result();
    if (!result) return [];
    const base = result.baseline;
    const scenario = result.scenario;
    return [
      this.row('assigned', 'Назначено', base.visits_planned, scenario.visits_planned, true,
        `${pct(scenario.visits_planned / Math.max(1, scenario.orders_total))} от всех нарядов`),
      this.row('unassigned', 'Не назначено', base.unassigned, scenario.unassigned, false,
        'меньше — лучше'),
      this.row('slot', 'Визиты в слот', base.slot_hits, scenario.slot_hits, true,
        `${pct(scenario.slot_hit_rate)} попаданий`),
      this.row('deadline', 'В контрольный срок', base.deadline_hits, scenario.deadline_hits, true,
        `${pct(scenario.deadline_hit_rate)} визитов`),
      this.row('travel', 'Время в пути', Math.round(base.travel_sec_total / 60),
        Math.round(scenario.travel_sec_total / 60), false,
        `${fmtDuration(Math.round(scenario.travel_sec_total / 60))} суммарно`),
      this.row('distance', 'Пробег', Math.round(base.distance_m_total / 100) / 10,
        Math.round(scenario.distance_m_total / 100) / 10, false,
        `${fmtKm(scenario.distance_m_total)} суммарно`),
      this.row('cv', 'Неравномерность', base.utilization_cv, scenario.utilization_cv, false,
        'коэффициент вариации загрузки'),
      this.row('restock', 'Заезды в СЦ', base.restock_stops, scenario.restock_stops, false,
        `${scenario.restock_min} мин на пополнение`),
    ];
  });

  readonly newlyUnassignedRows = computed(() => {
    const result = this.result();
    if (!result) return [];
    const orders = this.store.orderById();
    return result.newly_unassigned.map((item) => {
      const order = orders.get(item.order_id);
      return {
        id: item.order_id,
        slot: order ? fmtTimeRange(order.slot.start, order.slot.end) : '—',
        reason: REASON_LABEL[item.reason_code] ?? item.reason_text,
      };
    });
  });

  readonly equipmentRows = computed(() => {
    const recommendation = this.result()?.equipment_recommendation;
    if (!recommendation) return [];
    return this.deficitOnly()
      ? recommendation.staff.filter((row) => equipmentSum(row.additional_start) > 0)
      : recommendation.staff;
  });

  readonly scenarioRoutes = computed(() => {
    const result = this.result();
    if (!result) return [];
    const staff = this.store.staffById();
    return [...result.scenario_plan.routes]
      .sort((a, b) => (b.totals?.visits ?? 0) - (a.totals?.visits ?? 0))
      .map((route) => ({
        staff_id: route.staff_id,
        name: staff.get(route.staff_id)?.display_name ?? route.staff_id,
        visits: route.totals?.visits ?? 0,
        km: fmtKm(route.totals?.distance_m),
        utilization: pct(route.totals?.utilization ?? 0),
        pct: Math.round((route.totals?.utilization ?? 0) * 100),
      }));
  });

  setStaffDelta(event: Event): void {
    this.staffDelta.set(Number((event.target as HTMLInputElement).value));
  }

  setTimeLimit(event: Event): void {
    this.timeLimit.set(Number((event.target as HTMLSelectElement).value));
  }

  setManual(field: keyof Equipment, event: Event): void {
    const value = Math.max(0, Number((event.target as HTMLInputElement).value) || 0);
    this.manual.update((current) => ({ ...current, [field]: value }));
  }

  toggleDeficitOnly(): void {
    this.deficitOnly.update((value) => !value);
  }

  reset(): void {
    this.result.set(null);
    this.error.set(null);
  }

  run(): void {
    if (this.loading()) return;
    if (this.store.apiStatus() !== 'online') {
      this.error.set('Backend недоступен: сценарный анализ считается на сервере.');
      return;
    }
    const request: ScenarioRequest = {
      staff_delta: -Math.abs(this.staffDelta()),
      time_limit_sec: this.timeLimit(),
    };
    if (this.equipmentMode() === 'recommended') {
      request.use_recommended_equipment = true;
    } else if (this.equipmentMode() === 'manual') {
      request.equipment_start = this.manual();
    }

    this.loading.set(true);
    this.error.set(null);
    this.api.runScenario(this.store.plan().date, request).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: { status?: number; error?: { detail?: string; message?: string } }) => {
        this.loading.set(false);
        this.error.set(
          error?.status === 409
            ? 'Сценарный анализ уже выполняется или план сейчас пересчитывается.'
            : error?.error?.detail ?? error?.error?.message ?? 'Не удалось рассчитать сценарий.',
        );
      },
    });
  }

  equipmentSummary(result: ScenarioResult): { label: string; value: number }[] {
    return this.equipmentFields
      .map((field) => ({ label: field, value: result.equipment_recommendation.total_additional_start[field] }))
      .filter((item) => item.value > 0);
  }

  equipmentLabel(equipment: Equipment): string {
    const parts = this.equipmentFields
      .filter((field) => equipment[field] > 0)
      .map((field) => `${field} ${equipment[field]}`);
    return parts.length ? parts.join(' · ') : '—';
  }

  hasDeficit(row: EquipmentAdvice): boolean {
    return equipmentSum(row.additional_start) > 0;
  }

  private row(
    key: string,
    label: string,
    base: number,
    scenario: number,
    higherIsBetter: boolean,
    note: string,
  ): ComparisonRow {
    const delta = scenario - base;
    const tone: Tone = delta === 0 ? 'neutral' : (higherIsBetter ? delta > 0 : delta < 0) ? 'good' : 'bad';
    const digits = key === 'cv' ? 2 : key === 'distance' ? 1 : 0;
    const format = (value: number) =>
      digits === 0 ? fmtNumber(value) : value.toFixed(digits).replace('.', ',');
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    return {
      key,
      label,
      base: format(base),
      scenario: format(scenario),
      delta: `${sign}${format(Math.abs(delta))}`,
      tone,
      note,
    };
  }
}

function equipmentSum(equipment: Equipment): number {
  return equipment.ONT + equipment.ROUTER + equipment.STB;
}
