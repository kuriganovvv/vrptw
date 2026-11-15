import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DispatchStore } from '../../core/dispatch-store';
import { SessionStore } from '../../core/session-store';
import { fmtTime } from '../../core/time';
import { Icon } from '../../shared/icon';
import { PROFILE_TITLE } from '../../shared/ui';
import { initialsOf } from './employee-shared';

@Component({
  selector: 'app-employee-profile-page',
  imports: [Icon],
  template: `
    <div class="space-y-4">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-slate-900">Профиль</h1>
        <p class="mt-0.5 text-xs text-slate-500">Данные сотрудника из справочника сервиса</p>
      </div>

      @if (store.employeeLoading()) {
        <section class="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
          <app-icon name="refresh-cw" class="mx-auto size-7 text-brand spin" />
          <p class="mt-3 text-sm font-medium text-slate-700">Загружаем профиль…</p>
        </section>
      } @else if (store.employeeError(); as message) {
        <section class="rounded-2xl border border-red-200 bg-white px-5 py-8 text-center">
          <app-icon name="triangle-alert" class="mx-auto size-7 text-red-500" />
          <p class="mt-3 text-sm font-medium text-slate-800">Профиль недоступен</p>
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
        @if (staff(); as person) {
          <section class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center gap-3">
              <span
                class="grid size-14 shrink-0 place-items-center rounded-full bg-brand-50 text-lg font-semibold text-brand"
              >
                {{ initials() }}
              </span>
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-base font-semibold text-slate-900">
                  {{ person.display_name }}
                </h2>
                <div class="mt-0.5 text-xs text-slate-500">
                  <span class="font-mono">{{ person.staff_id }}</span>
                  <span> · Сотрудник</span>
                </div>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                [class.bg-emerald-50]="!!route()"
                [class.text-emerald-700]="!!route()"
                [class.bg-slate-100]="!route()"
                [class.text-slate-500]="!route()"
              >
                {{ route() ? 'В смене' : 'Вне смены' }}
              </span>
            </div>

            @if (route(); as myRoute) {
              <div class="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-2 text-center">
                <div>
                  <div class="text-sm font-semibold tabular-nums text-slate-900">
                    {{ myRoute.done }} / {{ myRoute.visits }}
                  </div>
                  <div class="text-[10px] text-slate-500">визитов</div>
                </div>
                <div>
                  <div class="text-sm font-semibold tabular-nums text-slate-900">
                    {{ myRoute.km.toFixed(1).replace('.', ',') }} км
                  </div>
                  <div class="text-[10px] text-slate-500">пробег</div>
                </div>
                <div>
                  <div class="text-sm font-semibold tabular-nums text-slate-900">
                    {{ myRoute.presence }}
                  </div>
                  <div class="text-[10px] text-slate-500">статус</div>
                </div>
              </div>
            }
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white">
            <div class="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700">
              Смена и квалификация
            </div>
            <dl class="divide-y divide-slate-100 text-sm">
              <div class="flex items-start gap-3 px-4 py-2.5">
                <app-icon name="clock" class="mt-0.5 size-4 shrink-0 text-brand" />
                <dt class="w-28 shrink-0 text-xs text-slate-500">Рабочие часы</dt>
                <dd class="flex-1 text-right text-xs font-medium text-slate-800">
                  {{ person.shift.start }}–{{ person.shift.end }}
                </dd>
              </div>
              <div class="flex items-start gap-3 px-4 py-2.5">
                <app-icon name="clock" class="mt-0.5 size-4 shrink-0 text-brand" />
                <dt class="w-28 shrink-0 text-xs text-slate-500">Обед</dt>
                <dd class="flex-1 text-right text-xs font-medium text-slate-800">
                  {{ person.shift.break_duration_min }} мин ·
                  {{ person.shift.break_window.from }}–{{ person.shift.break_window.to }}
                </dd>
              </div>
              <div class="flex items-start gap-3 px-4 py-2.5">
                <app-icon name="hard-hat" class="mt-0.5 size-4 shrink-0 text-brand" />
                <dt class="w-28 shrink-0 text-xs text-slate-500">Профиль</dt>
                <dd class="flex-1 text-right text-xs font-medium text-slate-800">
                  {{ profileLabels() }}
                </dd>
              </div>
              <div class="flex items-start gap-3 px-4 py-2.5">
                <app-icon name="zap" class="mt-0.5 size-4 shrink-0 text-brand" />
                <dt class="w-28 shrink-0 text-xs text-slate-500">Технологии</dt>
                <dd class="flex-1 text-right text-xs font-medium text-slate-800">
                  {{ person.technologies.join(', ') }}
                </dd>
              </div>
              <div class="flex items-start gap-3 px-4 py-2.5">
                <app-icon name="building-2" class="mt-0.5 size-4 shrink-0 text-brand" />
                <dt class="w-28 shrink-0 text-xs text-slate-500">Сервисный центр</dt>
                <dd class="flex-1 text-right text-xs font-medium text-slate-800">
                  {{ serviceCenter()?.name ?? person.service_center_id }}
                </dd>
              </div>
              @if (serviceCenter()?.address; as address) {
                <div class="flex items-start gap-3 px-4 py-2.5">
                  <app-icon name="map-pin" class="mt-0.5 size-4 shrink-0 text-brand" />
                  <dt class="w-28 shrink-0 text-xs text-slate-500">Адрес СЦ</dt>
                  <dd class="flex-1 text-right text-xs font-medium text-slate-800">
                    {{ address }}
                  </dd>
                </div>
              }
            </dl>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
            <div class="flex items-center justify-between">
              <span>Рабочий день</span>
              <span class="font-medium text-slate-800">{{ store.currentDate() || '—' }}</span>
            </div>
            <div class="mt-1.5 flex items-center justify-between">
              <span>Версия плана</span>
              <span class="font-medium text-slate-800">v{{ store.plan().plan_version }}</span>
            </div>
            <div class="mt-1.5 flex items-center justify-between">
              <span>Данные актуальны на</span>
              <span class="font-medium tabular-nums text-slate-800">{{ fmtTime(store.now()) }}</span>
            </div>
            <p class="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              <app-icon name="info" class="mt-0.5 size-3 shrink-0" />
              Профиль, смена и маршрут получены из сервиса планирования. Телефон абонента в API
              отсутствует и в интерфейсе помечен как демонстрационный.
            </p>
          </section>

          <button
            type="button"
            (click)="logout()"
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <app-icon name="log-out" class="size-4" />
            Выйти из аккаунта
          </button>
        } @else {
          <section class="rounded-2xl border border-amber-200 bg-white px-5 py-8 text-center">
            <app-icon name="triangle-alert" class="mx-auto size-7 text-amber-500" />
            <p class="mt-3 text-sm font-semibold text-slate-800">Сотрудник не найден</p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              В справочнике сервиса нет сотрудника {{ staffId() }}. Войдите с другим staff_id.
            </p>
            <button
              type="button"
              (click)="logout()"
              class="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white"
            >
              Выйти и сменить логин
            </button>
          </section>
        }
      }
    </div>
  `,
})
export class EmployeeProfilePage {
  protected readonly store = inject(DispatchStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly staffId = this.session.staffId;
  protected readonly staff = computed(() => {
    const id = this.staffId();
    return id ? (this.store.staffById().get(id) ?? null) : null;
  });
  protected readonly route = computed(() =>
    this.store.employeeLoading() || this.store.employeeError()
      ? null
      : this.store.routeFor(this.staffId()),
  );
  protected readonly initials = computed(() => initialsOf(this.staff()?.display_name ?? ''));
  protected readonly serviceCenter = computed(() => {
    const person = this.staff();
    return person ? this.store.scById().get(person.service_center_id) : undefined;
  });
  protected readonly profileLabels = computed(() =>
    (this.staff()?.profiles ?? [])
      .map((profile) => PROFILE_TITLE[profile] ?? profile)
      .join(', '),
  );

  protected logout(): void {
    this.session.logout();
    void this.router.navigate(['/login']);
  }

  protected readonly fmtTime = fmtTime;
}
