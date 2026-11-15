import { Component, ElementRef, ViewChild, computed, inject } from '@angular/core';
import { DispatchStore } from '../../core/dispatch-store';
import { RouteView, StopView } from '../../core/models';
import { fmtMinutes, fmtTime, minutesOfDay } from '../../core/time';
import { Icon } from '../../shared/icon';
import { shortOrder } from '../../shared/ui';

const DAY_START = 8 * 60;
const DAY_END = 19 * 60;
const SPAN = DAY_END - DAY_START;
/** Шаг, с которым курсор двигается мышью и стрелками. */
const CURSOR_STEP_MIN = 5;

type BlockKind = 'visit' | 'break' | 'restock';

interface GanttBlock {
  left: number;
  width: number;
  label: string;
  title: string;
  kind: BlockKind;
  late: boolean;
  done: boolean;
  /** Визит начинается позже выбранного времени просмотра. */
  future: boolean;
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
            <span class="h-3 w-0.5" [class]="store.cursorActive() ? 'bg-amber-500' : 'bg-red-500'"></span>
            @if (store.cursorActive()) {
              Просмотр на {{ viewLabel() }}
            } @else {
              Сейчас {{ nowLabel() }}
            }
          </span>
          @if (store.cursorActive()) {
            <button
              type="button"
              (click)="store.resetCursor()"
              class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
            >
              <app-icon name="refresh-cw" class="size-3" />
              К текущему времени
            </button>
          }
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
            @if (cursorPct() !== null) {
              <div #track class="pointer-events-none absolute bottom-0 left-36 right-0 top-0 z-20">
                <div
                  class="pointer-events-auto absolute inset-y-0 w-5 -translate-x-1/2 cursor-ew-resize touch-none select-none rounded-sm focus:outline-none focus-visible:bg-amber-100/60"
                  [style.left.%]="cursorPct()"
                  (pointerdown)="startDrag($event)"
                  (pointermove)="moveDrag($event)"
                  (pointerup)="endDrag($event)"
                  (pointercancel)="endDrag($event)"
                  (dblclick)="store.resetCursor()"
                  (keydown)="onKeydown($event)"
                  tabindex="0"
                  role="slider"
                  aria-label="Время просмотра маршрутов"
                  [attr.aria-valuemin]="dayStart"
                  [attr.aria-valuemax]="dayEnd"
                  [attr.aria-valuenow]="store.viewMinutes()"
                  [attr.aria-valuetext]="viewLabel()"
                  title="Потяните линию, чтобы посмотреть маршруты на другое время. Двойной клик — вернуться к текущему времени."
                >
                  <div
                    class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
                    [class]="store.cursorActive() ? 'bg-amber-500' : 'bg-red-500/80'"
                  ></div>
                  <div
                    class="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-white shadow"
                    [class]="store.cursorActive() ? 'bg-amber-500' : 'bg-red-500'"
                  ></div>
                  <div
                    class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] text-white shadow"
                    [class]="store.cursorActive() ? 'bg-amber-600' : 'bg-slate-900/85'"
                  >
                    {{ viewLabel() }}
                  </div>
                </div>
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
                        [class.opacity-30]="block.future && !block.done"
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
            <span>{{ rows().length }} бригад · окно {{ dayStartLabel }}–{{ dayEndLabel }}</span>
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

  @ViewChild('track') private track?: ElementRef<HTMLDivElement>;

  protected readonly dayStart = DAY_START;
  protected readonly dayEnd = DAY_END;
  protected readonly dayStartLabel = fmtMinutes(DAY_START);
  protected readonly dayEndLabel = fmtMinutes(DAY_END);

  private dragging = false;

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

  /** Положение курсора времени просмотра; `null`, если он вне окна диаграммы. */
  protected readonly cursorPct = computed<number | null>(() => {
    const minutes = this.store.viewMinutes();
    if (minutes < DAY_START || minutes > DAY_END) return null;
    return ((minutes - DAY_START) / SPAN) * 100;
  });

  protected readonly nowLabel = computed(() => fmtTime(this.store.now()));
  protected readonly viewLabel = computed(() => this.store.viewLabel());

  protected startDrag(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture?.(event.pointerId);
    this.dragging = true;
    this.updateCursor(event);
    event.preventDefault();
  }

  protected moveDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    this.updateCursor(event);
  }

  protected endDrag(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  /** Стрелки двигают курсор на 5 минут, Home/End — к началу и концу окна. */
  protected onKeydown(event: KeyboardEvent): void {
    const current = this.store.viewMinutes();
    let next: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - CURSOR_STEP_MIN;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + CURSOR_STEP_MIN;
    else if (event.key === 'Home') next = DAY_START;
    else if (event.key === 'End') next = DAY_END;
    else if (event.key === 'Escape') {
      this.store.resetCursor();
      event.preventDefault();
      return;
    }
    if (next === null) return;
    this.store.setCursor(Math.max(DAY_START, Math.min(DAY_END, next)));
    event.preventDefault();
  }

  private updateCursor(event: PointerEvent): void {
    const rect = this.track?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const minutes = DAY_START + ratio * SPAN;
    this.store.setCursor(Math.round(minutes / CURSOR_STEP_MIN) * CURSOR_STEP_MIN);
  }

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
      // Без выбранного времени ничего не приглушаем: на «сейчас» виден весь план
      // (визиты после текущего момента — такие же части маршрута, а не архив).
      future: this.store.cursorActive() && start > this.store.viewMinutes(),
    };
  }
}
