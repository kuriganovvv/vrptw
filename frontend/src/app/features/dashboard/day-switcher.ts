import { Component, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { UiDay } from '../../core/models';
import { fmtDateLong, fmtDateShort } from '../../core/time';
import { Icon } from '../../shared/icon';

/** Переключение рабочего дня диспетчером: только чтение, план не пересчитывается. */
@Component({
  selector: 'app-day-switcher',
  imports: [Icon],
  template: `
    <label
      class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm"
      title="Переключение рабочего дня"
    >
      <app-icon name="calendar" class="size-3.5 text-brand" />
      <span class="hidden sm:inline">День</span>
      <select
        class="cursor-pointer bg-transparent text-xs font-semibold text-slate-800 outline-none"
        (change)="onChange($event)"
      >
        @for (day of options(); track day.date) {
          <option [value]="day.date" [selected]="day.date === store.currentDate()">
            {{ label(day.date) }}
          </option>
        }
      </select>
    </label>
  `,
})
export class DaySwitcher {
  protected readonly store = inject(DispatchStore);

  protected readonly options = (): UiDay[] => {
    const days = this.store.days();
    if (days.length) {
      return [...days].sort((a, b) => b.date.localeCompare(a.date));
    }
    return [{ date: this.store.plan().date, now: this.store.plan().as_of }];
  };

  protected readonly label = (date: string): string =>
    `${fmtDateShort(date)} · ${fmtDateLong(date).split(',')[0]}`;

  protected onChange(event: Event): void {
    this.store.selectDay((event.target as HTMLSelectElement).value);
  }
}
