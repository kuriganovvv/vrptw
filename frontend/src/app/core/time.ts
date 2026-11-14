export const MODEL_TZ = 'Asia/Yekaterinburg';

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: MODEL_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Модельное время хранится с фиксированным смещением +05:00 (Екатеринбург). */
export function toModelIso(date: Date): string {
  const shifted = new Date(date.getTime() + 5 * 3600 * 1000);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+05:00`
  );
}

export function modelDate(date: string, time = '09:00'): Date {
  return new Date(`${date}T${time}:00+05:00`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function roundUp(date: Date, stepMin = 15): Date {
  const step = stepMin * 60_000;
  return new Date(Math.ceil(date.getTime() / step) * step);
}

export function minutesOfDay(iso: string): number {
  const parts = timeFmt.formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return timeFmt.format(new Date(iso));
}

export function fmtTimeRange(start: string, end: string): string {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}

export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

export function fmtDateLong(date: string): string {
  const d = new Date(`${date}T12:00:00+05:00`);
  const shifted = new Date(d.getTime() + 5 * 3600 * 1000);
  const weekday = WEEKDAYS[shifted.getUTCDay()];
  const day = shifted.getUTCDate();
  const month = MONTHS[shifted.getUTCMonth()];
  return `${weekday}, ${day} ${month} ${shifted.getUTCFullYear()}`;
}

export function fmtDateShort(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function fmtKm(meters: number | null | undefined): string {
  if (!meters) return '0 км';
  const km = meters / 1000;
  return `${km.toFixed(1).replace('.', ',')} км`;
}

export function fmtNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
