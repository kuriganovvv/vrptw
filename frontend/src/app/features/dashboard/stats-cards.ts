import { Component, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { StatCard } from '../../core/models';
import { Icon, IconName } from '../../shared/icon';

const TONE: Record<StatCard['tone'], { icon: string; value: string }> = {
  brand: { icon: 'bg-brand-50 text-brand', value: 'text-slate-900' },
  green: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-slate-900' },
  amber: { icon: 'bg-amber-50 text-amber-700', value: 'text-slate-900' },
  red: { icon: 'bg-red-50 text-red-600', value: 'text-red-600' },
  slate: { icon: 'bg-slate-100 text-slate-700', value: 'text-slate-900' },
};

@Component({
  selector: 'app-stats-cards',
  imports: [Icon],
  template: `
    <section aria-label="Статистика смены" class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
      @for (card of store.stats(); track card.key) {
        <article
          class="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
          [class.col-span-2]="card.key === 'total'"
          [class.lg:col-span-1]="card.key === 'total'"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-slate-500">{{ card.label }}</span>
            <span class="grid size-8 place-items-center rounded-lg" [class]="tone(card).icon">
              <app-icon [name]="icon(card)" class="size-4" />
            </span>
          </div>
          <div
            class="mt-2 text-2xl font-semibold tracking-tight tabular-nums md:text-[28px]"
            [class]="tone(card).value"
          >
            {{ card.value }}
          </div>
          <div class="mt-1 truncate text-xs text-slate-500" [title]="card.note">{{ card.note }}</div>
        </article>
      }
    </section>
  `,
})
export class StatsCards {
  protected readonly store = inject(DispatchStore);

  protected tone(card: StatCard): { icon: string; value: string } {
    return TONE[card.tone];
  }

  protected icon(card: StatCard): IconName {
    return card.icon as IconName;
  }
}
