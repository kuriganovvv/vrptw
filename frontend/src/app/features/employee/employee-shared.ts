import { FieldMark, FieldVisitState, StopStatus, UiDay } from '../../core/models';
import { fmtDateLong, fmtDateShort } from '../../core/time';

export interface DayChip {
  date: string;
  label: string;
  short: string;
  current: boolean;
}

export interface VisitStateMeta {
  label: string;
  chip: string;
  dot: string;
}

export const VISIT_STATE_META: Record<FieldVisitState, VisitStateMeta> = {
  PLANNED: { label: 'В планах', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  CALLED: { label: 'Абонент предупреждён', chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  ARRIVED: { label: 'На адресе', chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  DONE: { label: 'Выполнен', chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
};

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Дни из сервиса: «сегодня» считаем по модельному времени последнего загруженного дня. */
export function buildDayChips(days: UiDay[], currentDate: string): DayChip[] {
  if (!days.length) return [];
  const serviceToday = days[days.length - 1].now.slice(0, 10);
  return days.map((day) => {
    const diff = Math.round((dayNumber(day.date) - dayNumber(serviceToday)) / 86_400_000);
    const label =
      diff === 0
        ? 'Сегодня'
        : diff === 1
          ? 'Завтра'
          : diff === 2
            ? 'Послезавтра'
            : diff === -1
              ? 'Вчера'
              : (fmtDateLong(day.date).split(',')[0] ?? day.date);
    return {
      date: day.date,
      label,
      short: fmtDateShort(day.date),
      current: day.date === currentDate,
    };
  });
}

/** «Позвонить за 30 минут»: момент звонка считаем от начала слота. */
export function callAt(slotStart: string): string {
  return new Date(new Date(slotStart).getTime() - 30 * 60_000).toISOString();
}

export function visitStateOf(status: StopStatus | undefined, mark: FieldMark): FieldVisitState {
  if (mark.completedAt || status === 'DONE') return 'DONE';
  if (mark.arrivedAt || status === 'IN_PROGRESS') return 'ARRIVED';
  if (mark.calledAt) return 'CALLED';
  return 'PLANNED';
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');
}
