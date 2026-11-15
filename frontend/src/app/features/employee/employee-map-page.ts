import { Component, computed, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { StopView } from '../../core/models';
import { SessionStore } from '../../core/session-store';
import { fmtTime, fmtTimeRange } from '../../core/time';
import { Icon } from '../../shared/icon';
import { RoutesMap } from '../dashboard/routes-map';
import { buildDayChips, visitStateOf, VISIT_STATE_META } from './employee-shared';

@Component({
  selector: 'app-employee-map-page',
  imports: [Icon, RoutesMap],
  template: `
    <div class="space-y-4">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-slate-900">Карта</h1>
        <p class="mt-0.5 text-xs text-slate-500">
          @if (store.currentDate()) {
            Мой маршрут · {{ dateLabel() }}
          } @else {
            Данные из сервиса планирования
          }
        </p>
      </div>

      @if (store.employeeLoading()) {
        <section class="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <app-icon name="refresh-cw" class="mx-auto size-7 text-brand spin" />
          <p class="mt-3 text-sm font-medium text-slate-700">Загружаем маршрут…</p>
        </section>
      } @else if (store.employeeError(); as message) {
        <section class="rounded-2xl border border-red-200 bg-white px-5 py-8 text-center">
          <app-icon name="triangle-alert" class="mx-auto size-7 text-red-500" />
          <p class="mt-3 text-sm font-medium text-slate-800">Карта недоступна</p>
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
      } @else if (!route()) {
        <section class="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
          <app-icon name="map" class="mx-auto size-8 text-slate-300" />
          <p class="mt-3 text-sm font-semibold text-slate-800">Маршрута на день нет</p>
          <p class="mt-1 text-xs leading-5 text-slate-500">
            В плане сервиса для сотрудника {{ staffId() }} нет маршрута.
          </p>
        </section>
      } @else {
        <div class="h-[58vh] min-h-[320px]">
          <app-routes-map [onlyStaffId]="staffId()" [compact]="true" />
        </div>

        <section class="rounded-2xl border border-slate-200 bg-white">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span class="text-xs font-semibold text-slate-700">Точки маршрута</span>
            <span class="text-[11px] text-slate-400">{{ stops().length }}</span>
          </div>
          <ol class="divide-y divide-slate-100">
            @for (stop of stops(); track stop.stop.seq + '|' + stop.stop.type) {
              <li class="flex items-center gap-3 px-4 py-3">
                <span
                  class="grid size-7 shrink-0 place-items-center rounded-full"
                  [class.bg-brand]="stop.stop.type === 'VISIT'"
                  [class.text-white]="stop.stop.type === 'VISIT'"
                  [class.bg-slate-100]="stop.stop.type !== 'VISIT'"
                  [class.text-slate-500]="stop.stop.type !== 'VISIT'"
                >
                  @if (stop.stop.type === 'VISIT') {
                    <span class="text-[11px] font-semibold">{{ stop.stop.seq }}</span>
                  } @else {
                    <app-icon
                      [name]="stop.stop.type === 'BREAK' ? 'clock' : stop.stop.type === 'RESTOCK' ? 'package' : 'building-2'"
                      class="size-3.5"
                    />
                  }
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-slate-800">
                    {{ stop.order?.address ?? stop.label }}
                  </div>
                  <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span class="tabular-nums">
                      {{ stop.stop.type === 'VISIT' ? fmtTimeRange(stop.stop.start, stop.stop.end) : fmtTime(stop.stop.start) }}
                    </span>
                    @if (stop.stop.type === 'VISIT') {
                      <span>·</span>
                      <span
                        [class]="stateMeta(stop).chip"
                        class="rounded px-1 py-0.5"
                      >
                        {{ stateMeta(stop).label }}
                      </span>
                    }
                  </div>
                </div>
              </li>
            } @empty {
              <li class="px-4 py-8 text-center text-sm text-slate-500">
                В маршруте нет точек.
              </li>
            }
          </ol>
        </section>
      }
    </div>
  `,
})
export class EmployeeMapPage {
  protected readonly store = inject(DispatchStore);
  private readonly session = inject(SessionStore);

  protected readonly staffId = this.session.staffId;
  protected readonly route = computed(() =>
    this.store.employeeLoading() || this.store.employeeError()
      ? null
      : this.store.routeFor(this.staffId()),
  );

  protected readonly stops = computed<StopView[]>(() => this.route()?.stops ?? []);

  protected readonly dateLabel = computed(() => {
    const chip = buildDayChips(this.store.days(), this.store.currentDate()).find(
      (day) => day.current,
    );
    return chip ? `${chip.label}, ${chip.short}` : this.store.currentDate();
  });

  protected stateMeta(stop: StopView) {
    const mark = this.store.marksFor(this.staffId())[stop.order?.order_id ?? ''];
    return VISIT_STATE_META[visitStateOf(stop.stop.status, mark ?? {})];
  }

  protected readonly fmtTime = fmtTime;
  protected readonly fmtTimeRange = fmtTimeRange;
}
