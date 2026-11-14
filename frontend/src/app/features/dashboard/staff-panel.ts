import { Component, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { StaffCardView } from '../../core/models';
import { Icon } from '../../shared/icon';
import {
  PRESENCE_CLASS,
  PRESENCE_DOT,
  PROFILE_BADGE,
  PROFILE_TITLE,
} from '../../shared/ui';

@Component({
  selector: 'app-staff-panel',
  imports: [Icon],
  template: `
    <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div class="flex min-w-0 items-center gap-2">
          <app-icon name="hard-hat" class="size-4 text-brand" />
          <h2 class="truncate text-sm font-semibold">Сотрудники на смене</h2>
          <span class="text-xs text-slate-400">{{ store.staffCards().length }}</span>
        </div>
        <label class="relative">
          <span class="sr-only">Поиск сотрудника</span>
          <app-icon
            name="search"
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Поиск"
            [value]="store.search()"
            (input)="onSearch($event)"
            class="w-28 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-40"
          />
        </label>
      </div>

      <ul class="scroll-thin max-h-[352px] divide-y divide-slate-100 overflow-y-auto">
        @for (card of store.filteredStaff(); track card.staff.staff_id) {
          <li>
            <button
              type="button"
              (click)="store.toggleStaff(card.staff.staff_id)"
              class="block w-full px-4 py-3 text-left transition-colors hover:bg-slate-50"
              [class.bg-brand-50]="isSelected(card)"
              [attr.aria-pressed]="isSelected(card)"
            >
              <div class="flex items-center gap-3">
                <div
                  class="relative grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  {{ card.initials }}
                  <span
                    class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"
                    [style.background]="card.meta.color"
                  ></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-medium">{{ card.staff.display_name }}</span>
                    @for (profile of card.staff.profiles; track profile) {
                      <span
                        class="hidden rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:inline"
                        [class]="profileBadge(profile)"
                        [title]="profileTitle(profile)"
                        >{{ profile }}</span
                      >
                    }
                  </div>
                  <div class="truncate text-xs text-slate-500">
                    {{ card.meta.district }} ·
                    <span [class]="presenceClass(card)">{{ card.presence }}</span>
                  </div>
                </div>
                <div class="shrink-0 text-right">
                  <div class="text-sm font-semibold tabular-nums">
                    {{ card.done }}/{{ card.visits }}
                  </div>
                  <div class="text-[11px] tabular-nums text-slate-500">
                    {{ card.km.toFixed(1).replace('.', ',') }} км
                  </div>
                </div>
              </div>
              <div
                class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                [attr.aria-label]="'Выполнено нарядов: ' + card.staff.display_name"
                aria-valuemin="0"
                [attr.aria-valuemax]="card.visits"
                [attr.aria-valuenow]="card.done"
              >
                <div
                  class="h-full rounded-full transition-[width] duration-500"
                  [class.bg-red-500]="card.risk"
                  [class.bg-brand]="!card.risk"
                  [style.width.%]="card.visits ? (card.done / card.visits) * 100 : 0"
                ></div>
              </div>
            </button>
          </li>
        } @empty {
          <li class="px-4 py-10 text-center text-sm text-slate-500">
            Сотрудники не найдены. Измените запрос.
          </li>
        }
      </ul>

      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full bg-emerald-500"></span> на заявке
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full bg-sky-500"></span> в пути
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-2 rounded-full bg-red-500"></span> опаздывает
        </span>
      </div>
    </div>
  `,
})
export class StaffPanel {
  protected readonly store = inject(DispatchStore);

  protected onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  protected isSelected(card: StaffCardView): boolean {
    return this.store.selectedStaffId() === card.staff.staff_id;
  }

  protected presenceClass(card: StaffCardView): string {
    return PRESENCE_CLASS[card.presence];
  }

  protected presenceDot(card: StaffCardView): string {
    return PRESENCE_DOT[card.presence];
  }

  protected profileBadge(profile: StaffCardView['staff']['profiles'][number]): string {
    return PROFILE_BADGE[profile];
  }

  protected profileTitle(profile: StaffCardView['staff']['profiles'][number]): string {
    return PROFILE_TITLE[profile];
  }
}
