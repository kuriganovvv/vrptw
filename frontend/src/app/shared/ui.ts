import { OrderUiStatus, Profile, StaffPresence, WorkTypeCode } from '../core/models';

export const PROFILE_BADGE: Record<Profile, string> = {
  INSTALL: 'bg-brand-50 text-brand',
  LTP3: 'bg-sky-50 text-sky-700',
};

export const PROFILE_TITLE: Record<Profile, string> = {
  INSTALL: 'Инсталляция',
  LTP3: 'Техподдержка',
};

export const PRESENCE_CLASS: Record<StaffPresence, string> = {
  'На заявке': 'text-emerald-700',
  'В пути': 'text-sky-700',
  'Обед': 'text-amber-700',
  'Свободен': 'text-slate-500',
  'Опаздывает': 'text-red-600',
};

export const PRESENCE_DOT: Record<StaffPresence, string> = {
  'На заявке': 'bg-emerald-500',
  'В пути': 'bg-sky-500',
  'Обед': 'bg-amber-400',
  'Свободен': 'bg-slate-300',
  'Опаздывает': 'bg-red-500',
};

export interface StatusMeta {
  label: string;
  cls: string;
  dot: string;
}

export const ORDER_STATUS_META: Record<OrderUiStatus, StatusMeta> = {
  DONE: { label: 'DONE', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  IN_PROGRESS: { label: 'IN_PROGRESS', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  PLANNED: { label: 'PLANNED', cls: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  UNASSIGNED: { label: 'UNASSIGNED', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  PGP: { label: 'PGP', cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  CANCELLED: { label: 'CANCELLED', cls: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' },
};

export const WORK_SHORT: Record<WorkTypeCode, string> = {
  INST_PON_MKD: 'Инсталляция PON',
  INST_FTTB_MKD: 'Инсталляция FTTB',
  INST_PRIVATE_VLS: 'Инсталляция ВЛС',
  ADD_SERVICE: 'Доп. услуга',
  SURVEY_PRIVATE: 'Обследование',
  REPAIR: 'Устранение неисправности',
  DEGRADATION: 'Деградация сервиса',
  DISMANTLE: 'Демонтаж',
};

export const RISK_META: Record<string, { label: string; cls: string }> = {
  none: { label: '—', cls: 'text-slate-400' },
  low: { label: 'Низкий', cls: 'text-emerald-600' },
  medium: { label: 'Средний', cls: 'text-amber-600' },
  high: { label: 'Высокий', cls: 'text-red-600' },
};

/** Короткий номер наряда для компактных карточек и диаграмм. */
export function shortOrder(orderId: string): string {
  const match = orderId.match(/(\d{3,6})$/);
  return match ? match[1] : orderId;
}

export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
