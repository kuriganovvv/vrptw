import { Component, computed, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { RouteView, StopView } from '../../core/models';
import { fmtTime, minutesOfDay } from '../../core/time';
import { Icon } from '../../shared/icon';
import { shortOrder } from '../../shared/ui';

const DAY_START = 8 * 60;
const DAY_END = 19 * 60;
const SPAN = DAY_END - DAY_START;

type BlockKind = 'visit' | 'break' | 'restock';

interface GanttBlock {
  left: number;
  width: number;
  label: string;
  title: string;
  kind: BlockKind;
  late: boolean;
  done: boolean;
}

interface GanttRow {
  id: string;
  name: string;
  profiles: string;
  risk: boolean;
  selected: boolean;
  blocks: GanttBlock[];
}

@Component({
  selector: 'app-gantt-chart',
  imports: [Icon],
  template: `
    <div class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div class="flex items-center gap-2">
          <app-icon name="gantt-chart" class="size-4 text-brand" />
          <h2 class="text-sm font-semibold">Загрузка по времени</h2>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2.5 w-4 rounded-sm bg-blue-500"></span>Визит
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="hatch h-2.5 w-4 rounded-sm border border-slate-300"></span>Перерыв
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2.5 w-4 rounded-sm bg-orange-500"></span>Пополнение
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-3 w-0.5 bg-red-500"></span>Сейчас {{ nowLabel() }}
          </span>
        </div>
      </div>

      <div class="scroll-thin overflow-x-auto">
        <div class="min-w-[620px] p-4">
          <div class="flex">
            <div class="w-36 shrink-0"></div>
            <div class="relative h-5 flex-1 font-mono text-[11px] text-slate-500">
              @for (tick of ticks; track tick) {
                <span class="absolute -translate-x-1/2" [style.left.%]="tick.left">{{ tick.label }}</span>
              }
            </div>
          </div>

          <div class="relative mt-1">
            @if (nowPct() !== null) {
              <div class="pointer-events-none absolute bottom-0 left-36 right-0 top-0 z-10">
                <div
                  class="absolute top-0 size-2.5 -translate-x-1/2 rounded-full bg-red-500"
                  [style.left.%]="nowPct()"
                ></div>
                <div
                  class="h-full w-0.5 -translate-x-1/2 bg-red-500/80"
                  [style.left.%]="nowPct()"
                ></div>
              </div>
            }

            <div class="flex flex-col gap-0.5">
              @for (row of rows(); track row.id; let index = $index) {
                <button
                  type="button"
                  (click)="store.toggleStaff(row.id)"
                  class="flex h-11 items-center rounded-lg text-left transition-colors hover:bg-slate-50"
                  [class.bg-slate-50]="index % 2 === 0 && !row.selected"
                  [class.bg-brand-50]="row.selected"
                  [attr.aria-pressed]="row.selected"
                >
                  <div class="w-36 shrink-0 pl-2 pr-3 leading-tight">
                    <div class="truncate text-[13px] font-medium" [class.text-red-600]="row.risk">
                      {{ row.name }}
                    </div>
                    <div class="truncate font-mono text-[10px] text-slate-500">{{ row.profiles }}</div>
                  </div>
                  <div class="relative h-full flex-1">
                    @for (tick of ticks; track tick) {
                      <span
                        class="absolute inset-y-0 w-px bg-slate-200"
                        [style.left.%]="tick.left"
                        aria-hidden="true"
                      ></span>
                    }
                    @for (block of row.blocks; track block.title) {
                      <span
                        class="absolute top-2 bottom-2 flex items-center overflow-hidden rounded-md px-1.5 text-[10px] font-medium"
                        [class.bg-blue-500]="block.kind === 'visit'"
                        [class.text-white]="block.kind !== 'break'"
                        [class.hatch]="block.kind === 'break'"
                        [class.text-slate-600]="block.kind === 'break'"
                        [class.border]="block.kind === 'break'"
                        [class.border-slate-300]="block.kind === 'break'"
                        [class.bg-orange-500]="block.kind === 'restock'"
                        [class.opacity-60]="block.done"
                        [class.ring-2]="block.late"
                        [class.ring-red-500]="block.late"
                        [class.ring-offset-1]="block.late"
                        [style.left.%]="block.left"
                        [style.width.%]="block.width"
                        [title]="block.title"
                      >
                        <span class="truncate">{{ block.label }}</span>
                      </span>
                    }
                  </div>
                </button>
              }
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>{{ rows().length }} бригад · окно 08:00–19:00</span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-1.5 rounded-full bg-red-500"></span>
              красная рамка — риск нарушения слота
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class GanttChart {
  protected readonly store = inject(DispatchStore);

  protected readonly ticks = [9, 12, 15, 18].map((hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    left: (((hour * 60 - DAY_START) / SPAN) * 100),
  }));

  protected readonly rows = computed<GanttRow[]>(() => {
    const selectedId = this.store.selectedStaffId();
    return this.store
      .activeRoutes()
      .map((route) => this.toRow(route, selectedId))
      .sort((a, b) => b.blocks.length - a.blocks.length);
  });

  protected readonly nowPct = computed<number | null>(() => {
    const now = this.store.nowMinutes();
    if (now < DAY_START || now > DAY_END) return null;
    return ((now - DAY_START) / SPAN) * 100;
  });

  protected readonly nowLabel = computed(() => fmtTime(this.store.now()));

  private toRow(route: RouteView, selectedId: string | null): GanttRow {
    const blocks: GanttBlock[] = [];
    for (const stop of route.stops) {
      if (stop.stop.type === 'DEPOT_START' || stop.stop.type === 'DEPOT_END') continue;
      const block = this.toBlock(stop);
      if (block) blocks.push(block);
    }
    return {
      id: route.staff.staff_id,
      name: route.staff.display_name,
      profiles: route.staff.profiles.join(' · '),
      risk: route.risk,
      selected: selectedId === route.staff.staff_id,
      blocks,
    };
  }

  private toBlock(stop: StopView): GanttBlock | null {
    const start = minutesOfDay(stop.stop.start);
    const end = minutesOfDay(stop.stop.end);
    const clippedStart = Math.max(DAY_START, Math.min(DAY_END, start));
    const clippedEnd = Math.max(DAY_START, Math.min(DAY_END, end));
    if (clippedEnd - clippedStart < 2) return null;

    const kind: BlockKind =
      stop.stop.type === 'VISIT' ? 'visit' : stop.stop.type === 'BREAK' ? 'break' : 'restock';
    const label =
      kind === 'visit'
        ? stop.order
          ? shortOrder(stop.order.order_id)
          : 'Визит'
        : kind === 'break'
          ? 'BREAK'
          : 'RESTOCK';
    const title =
      kind === 'visit'
        ? `Визит ${stop.order?.order_id ?? ''}, ${fmtTime(stop.stop.start)}–${fmtTime(stop.stop.end)}`
        : `${kind === 'break' ? 'Перерыв' : 'Пополнение АО'}, ${fmtTime(stop.stop.start)}–${fmtTime(stop.stop.end)}`;

    return {
      left: ((clippedStart - DAY_START) / SPAN) * 100,
      width: ((clippedEnd - clippedStart) / SPAN) * 100,
      label,
      title,
      kind,
      late: stop.risk,
      done: stop.stop.status === 'DONE',
    };
  }
}
