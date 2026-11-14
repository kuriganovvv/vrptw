import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AlertView,
  Building,
  Order,
  OrderRow,
  PgpView,
  Plan,
  Profile,
  ReferenceData,
  Route,
  RouteView,
  ServiceCenter,
  Staff,
  StaffCardView,
  StaffMeta,
  StaffPresence,
  StatCard,
  Stop,
  StopView,
  UnassignedView,
  WorkType,
} from './models';
import { forkJoin } from 'rxjs';
import { DispatchApiService } from './dispatch-api.service';
import { DEMO_NOW, DEMO_ORDERS, DEMO_PLAN, DEMO_REFERENCE, DEMO_STAFF_META } from './demo-data';
import { fmtKm, fmtTime, fmtTimeRange, minutesOfDay } from './time';

const PALETTE = ['#7C3AED', '#0EA5E9', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6'];

const DEFAULT_SHIFT = {
  start: '09:00',
  end: '18:00',
  break_duration_min: 60,
  break_window: { from: '12:00', to: '15:00' },
};

const REASON_LABEL: Record<string, string> = {
  NO_QUALIFIED_STAFF: 'Нет подходящего сотрудника',
  NO_SHIFT_TIME: 'Не хватает времени смены',
  SLOT_UNREACHABLE: 'Слот недостижим',
  NO_EQUIPMENT: 'Нет оборудования',
  STAFF_UNAVAILABLE: 'Исполнитель выбыл',
  OTHER: 'Другая причина',
};

const PROFILE_LABEL: Record<Profile, string> = {
  INSTALL: 'Инсталляция',
  LTP3: 'Техподдержка',
};

export type ProblemTab = 'risk' | 'unassigned' | 'pgp';
export type ApiStatus = 'demo' | 'checking' | 'online' | 'offline';

export interface Toast {
  text: string;
  tone: 'success' | 'info' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class DispatchStore {
  private readonly api = inject(DispatchApiService);
  private toastTimer: number | undefined;

  readonly reference = signal<ReferenceData>(DEMO_REFERENCE);
  readonly plan = signal<Plan>(DEMO_PLAN);
  readonly orders = signal<Order[]>(DEMO_ORDERS);
  readonly staffMeta = signal<Record<string, StaffMeta>>(DEMO_STAFF_META);
  readonly extraStaff = signal<Staff[]>([]);

  readonly apiStatus = signal<ApiStatus>('demo');
  readonly selectedStaffId = signal<string | null>('ST-001');
  readonly search = signal('');
  readonly problemTab = signal<ProblemTab>('risk');
  readonly replanning = signal(false);
  readonly toast = signal<Toast | null>(null);

  readonly now = computed(() => this.plan().as_of);
  readonly nowMinutes = computed(() => minutesOfDay(this.now()));

  readonly staffById = computed(() => {
    const map = new Map<string, Staff>();
    for (const staff of [...this.reference().staff, ...this.extraStaff()]) {
      map.set(staff.staff_id, staff);
    }
    return map;
  });

  readonly scById = computed(
    () => new Map<string, ServiceCenter>(this.reference().service_centers.map((s) => [s.service_center_id, s])),
  );

  readonly buildingById = computed(() => {
    const map = new Map<string, Building>();
    for (const node of this.reference().access_nodes) {
      for (const building of node.buildings) map.set(building.building_id, building);
    }
    return map;
  });

  readonly orderById = computed(() => new Map<string, Order>(this.orders().map((o) => [o.order_id, o])));

  readonly workTypeByCode = computed(
    () => new Map<string, WorkType>(this.reference().work_types.map((w) => [w.code, w])),
  );

  readonly routes = computed<RouteView[]>(() => {
    const staffById = this.staffById();
    const scById = this.scById();
    const buildingById = this.buildingById();
    const orderById = this.orderById();
    const meta = this.staffMeta();
    const alerts = this.plan().alerts;
    const nowMs = new Date(this.now()).getTime();

    return this.plan().routes.map((route, index) => {
      const staff = staffById.get(route.staff_id) ?? this.placeholderStaff(route);
      const staffMeta = meta[staff.staff_id] ?? { color: PALETTE[index % PALETTE.length], district: 'Екатеринбург' };
      const stops: StopView[] = route.stops.map((stop) => {
        const order = stop.order_id ? orderById.get(stop.order_id) : undefined;
        const building = stop.type === 'VISIT' ? buildingById.get(stop.location_id) : undefined;
        const center = stop.type === 'VISIT' ? undefined : scById.get(stop.location_id);
        const lat = building?.lat ?? center?.lat ?? order?.lat ?? 56.8389;
        const lon = building?.lon ?? center?.lon ?? order?.lon ?? 60.6057;
        const late = this.isLate(stop, order);
        return {
          stop,
          order,
          lat,
          lon,
          label: this.stopLabel(stop, order),
          timeLabel: this.stopTimeLabel(stop),
          late,
          risk: late && alerts.some((a) => a.type === 'LATE_RISK' && a.order_id === stop.order_id),
        };
      });

      const visits = stops.filter((s) => s.stop.type === 'VISIT');
      const done = visits.filter((s) => s.stop.status === 'DONE').length;
      const nextStop = visits.find((s) => s.stop.status !== 'DONE');
      const currentStop = stops.find(
        (s) => new Date(s.stop.start).getTime() <= nowMs && new Date(s.stop.end).getTime() > nowMs,
      );
      const risk = visits.some((s) => s.late);

      let presence: StaffPresence = 'Свободен';
      if (risk) presence = 'Опаздывает';
      else if (currentStop?.stop.type === 'VISIT') presence = 'На заявке';
      else if (currentStop?.stop.type === 'BREAK') presence = 'Обед';
      else if (currentStop || (nextStop && nowMs > new Date(nextStop.stop.start).getTime() - 45 * 60000))
        presence = 'В пути';

      return {
        route,
        staff,
        meta: staffMeta,
        stops,
        visits: visits.length,
        done,
        km: (route.totals?.distance_m ?? 0) / 1000,
        nextStop,
        presence,
        risk,
        eta: nextStop ? fmtTime(nextStop.stop.start) : undefined,
      };
    });
  });

  readonly staffCards = computed<StaffCardView[]>(() => {
    const meta = this.staffMeta();
    const routeByStaff = new Map(this.routes().map((r) => [r.staff.staff_id, r]));
    return [...this.reference().staff, ...this.extraStaff()].map((staff, index) => {
      const route = routeByStaff.get(staff.staff_id);
      const fallback: RouteView = {
        route: {
          staff_id: staff.staff_id,
          service_center_id: staff.service_center_id,
          status: 'ACTIVE',
          stops: [],
        },
        staff,
        meta: meta[staff.staff_id] ?? {
          color: PALETTE[index % PALETTE.length],
          district: 'Екатеринбург',
        },
        stops: [],
        visits: 0,
        done: 0,
        km: 0,
        presence: 'Свободен',
        risk: false,
      };
      const view = route ?? fallback;
      return {
        ...view,
        initials: staff.display_name
          .split(' ')
          .slice(0, 2)
          .map((part) => part[0])
          .join(''),
        shortName: staff.display_name.split(' ').slice(1).join(' ') || staff.display_name,
        progress: view.visits ? view.done / view.visits : 0,
        visitCount: view.visits,
      };
    });
  });

  readonly filteredStaff = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.staffCards();
    return this.staffCards().filter(
      (s) =>
        s.staff.display_name.toLowerCase().includes(q) ||
        s.staff.staff_id.toLowerCase().includes(q) ||
        s.staff.profiles.some((p) => PROFILE_LABEL[p].toLowerCase().includes(q)) ||
        s.meta.district.toLowerCase().includes(q),
    );
  });

  readonly selectedRoute = computed(() => {
    const id = this.selectedStaffId();
    if (!id) return null;
    return this.routes().find((r) => r.staff.staff_id === id) ?? null;
  });

  readonly activeRoutes = computed(() => this.routes().filter((r) => r.visits > 0));

  readonly stats = computed<StatCard[]>(() => {
    const plan = this.plan();
    const routes = this.routes();
    const total = plan.summary?.orders_total ?? this.orders().length;
    const assigned = plan.summary?.visits_planned ?? routes.reduce((sum, r) => sum + r.visits, 0);
    const unassignedCount = plan.unassigned.length;
    const riskCount = this.riskAlerts().length;
    const distance = routes.reduce((sum, r) => sum + (r.route.totals?.distance_m ?? 0), 0);
    const brigades = Math.max(1, this.activeRoutes().length);
    const pct = total ? Math.round((assigned / total) * 100) : 0;
    return [
      {
        key: 'total',
        label: 'Всего заявок',
        value: String(total),
        note: `обновлено в ${fmtTime(plan.as_of)}`,
        tone: 'brand',
        icon: 'clipboard-list',
      },
      {
        key: 'assigned',
        label: 'Назначено',
        value: String(assigned),
        note: `${pct}% от плана`,
        tone: 'green',
        icon: 'user-check',
      },
      {
        key: 'unassigned',
        label: 'Не назначено',
        value: String(unassignedCount + (plan.summary?.pgp_orders ?? 0)),
        note: `${100 - pct}% от плана`,
        tone: 'amber',
        icon: 'user-x',
      },
      {
        key: 'risk',
        label: 'В риске',
        value: String(riskCount),
        note: 'Нарушение SLA',
        tone: 'red',
        icon: 'alarm-clock',
      },
      {
        key: 'mileage',
        label: 'Пробег',
        value: fmtKm(distance),
        note: `≈ ${(distance / 1000 / brigades).toFixed(1).replace('.', ',')} км на бригаду`,
        tone: 'slate',
        icon: 'gauge',
      },
    ];
  });

  readonly riskAlerts = computed<AlertView[]>(() => {
    const orderById = this.orderById();
    const staffById = this.staffById();
    return this.plan()
      .alerts.filter((a) => a.type === 'LATE_RISK' && a.status === 'ACTIVE')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((alert) => {
        const order = alert.order_id ? orderById.get(alert.order_id) : undefined;
        return {
          alert,
          order,
          staff: alert.staff_id ? staffById.get(alert.staff_id) : undefined,
          windowLabel: order ? fmtTimeRange(order.slot.start, order.slot.end) : '—',
          latenessMin: alert.lateness_min ?? 0,
        };
      });
  });

  readonly unassigned = computed<UnassignedView[]>(() =>
    this.plan().unassigned.map((item) => ({
      item,
      order: this.orderById().get(item.order_id),
      reasonLabel: REASON_LABEL[item.reason_code] ?? item.reason_code,
    })),
  );

  readonly pgpGroups = computed<PgpView[]>(() =>
    this.plan().pgp_groups.map((group) => ({
      group,
      node: this.reference().access_nodes.find((n) => n.access_node_id === group.access_node_id),
      orders: group.order_ids
        .map((id) => this.orderById().get(id))
        .filter((o): o is Order => Boolean(o)),
    })),
  );

  readonly cancelledOrderIds = computed(() => new Set(this.plan().cancelled.map((c) => c.order_id)));

  readonly orderRows = computed<OrderRow[]>(() => {
    const plan = this.plan();
    const orders = this.orders();
    const workTypes = this.workTypeByCode();
    const staffById = this.staffById();
    const meta = this.staffMeta();
    const orderById = this.orderById();
    const cancelled = this.cancelledOrderIds();
    const pgp = new Set(plan.pgp_groups.flatMap((g) => g.order_ids));
    const unassigned = new Map(plan.unassigned.map((u) => [u.order_id, u]));

    const visitIndex = new Map<string, { stop: Stop; route: Route; color: string }>();
    for (const route of plan.routes) {
      const color = meta[route.staff_id]?.color ?? '#64748B';
      for (const stop of route.stops) {
        if (stop.type === 'VISIT' && stop.order_id) {
          visitIndex.set(stop.order_id, { stop, route, color });
        }
      }
    }

    const lateByOrder = new Map(
      plan.alerts
        .filter((a) => a.type === 'LATE_RISK' && a.order_id)
        .map((a) => [a.order_id as string, a]),
    );

    return orders
      .map<OrderRow>((order) => {
        const visit = visitIndex.get(order.order_id);
        const late = lateByOrder.get(order.order_id);
        let status: OrderRow['status'] = 'PLANNED';
        if (cancelled.has(order.order_id)) status = 'CANCELLED';
        else if (pgp.has(order.order_id)) status = 'PGP';
        else if (unassigned.has(order.order_id)) status = 'UNASSIGNED';
        else if (visit?.stop.status) status = visit.stop.status;

        const latenessMin = late?.lateness_min ?? 0;
        const riskLevel: OrderRow['riskLevel'] = late
          ? 'high'
          : order.is_repeat || status === 'UNASSIGNED'
            ? 'medium'
            : 'low';

        const unassignedItem = unassigned.get(order.order_id);
        return {
          order,
          workType: workTypes.get(order.work_type_code),
          staff: visit ? staffById.get(visit.route.staff_id) : undefined,
          routeColor: visit?.color,
          status,
          visit: visit?.stop,
          slotLabel: fmtTimeRange(order.slot.start, order.slot.end),
          plannedLabel: visit ? fmtTimeRange(visit.stop.start, visit.stop.end) : '—',
          latenessMin,
          riskLevel,
          reason: unassignedItem
            ? REASON_LABEL[unassignedItem.reason_code]
            : pgp.has(order.order_id)
              ? 'Групповая проблема (ПГП)'
              : cancelled.has(order.order_id)
                ? 'Отменён клиентом'
                : undefined,
        };
      })
      .sort((a, b) => new Date(a.order.slot.start).getTime() - new Date(b.order.slot.start).getTime());
  });

  readonly orderByIdForMap = computed(() => orderByIdMap(this.orders()));

  readonly planDateLabel = computed(() => this.plan().date);

  constructor() {
    window.setTimeout(() => {
      if (!this.toast()) {
        this.showToast(`План версии ${this.plan().plan_version} актуален на ${fmtTime(this.now())}`, 'info');
      }
    }, 900);
    // Демо-данные — только запасной вариант: сразу пробуем взять состояние из сервиса.
    this.loadFromBackend();
  }

  selectStaff(staffId: string | null): void {
    this.selectedStaffId.set(staffId);
  }

  toggleStaff(staffId: string): void {
    this.selectedStaffId.update((current) => (current === staffId ? null : staffId));
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  setProblemTab(tab: ProblemTab): void {
    this.problemTab.set(tab);
  }

  showToast(text: string, tone: Toast['tone'] = 'success'): void {
    this.toast.set({ text, tone });
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.set(null), 4200);
  }

  dismissToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  checkApi(): void {
    this.loadFromBackend();
  }

  /** Берёт справочники, день и план из сервиса; демо-данные остаются только фолбэком. */
  loadFromBackend(): void {
    if (this.apiStatus() === 'checking') return;
    this.apiStatus.set('checking');
    this.api.health().subscribe({
      next: (health) => {
        this.apiStatus.set('online');
        this.api.listDays().subscribe({
          next: (days) => {
            if (!days.length) {
              this.showToast(
                'Backend доступен, но день не загружен — показываю демо-данные',
                'warning',
              );
              return;
            }
            const latest = [...days].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
            forkJoin({ reference: this.api.getReference(), day: this.api.getDay(latest.date) }).subscribe({
              next: ({ reference, day }) => {
                this.reference.set(reference);
                this.orders.set(day.orders ?? []);
                this.extraStaff.set([]);
                this.showToast(
                  `Данные из backend: ${health.team ?? 'сервис'} · день ${latest.date}`,
                  'success',
                );
                this.loadLivePlan(latest.date);
              },
              error: () => this.showToast('Не удалось загрузить справочники и наряды дня', 'warning'),
            });
          },
          error: () => this.showToast('Backend не отдал список загруженных дней', 'warning'),
        });
      },
      error: () => {
        this.apiStatus.set('offline');
        this.showToast('Backend недоступен на localhost:8080 — работаем на демо-данных', 'warning');
      },
    });
  }

  loadLivePlan(date = this.plan().date): void {
    this.api.getPlan(date).subscribe({
      next: (plan) => {
        this.applyLivePlan(plan);
        this.showToast(`Получен план версии ${plan.plan_version} из API`, 'success');
      },
      error: (error: { status?: number }) => {
        if (error?.status === 404) {
          // день загружен, но план ещё не строили — строим сразу
          this.replan(date);
          return;
        }
        this.showToast('План ещё не построен в backend — показываю демо-данные', 'warning');
      },
    });
  }

  replan(date = this.plan().date): void {
    if (this.replanning()) return;
    this.replanning.set(true);
    if (this.apiStatus() === 'online') {
      this.api.buildPlan(date).subscribe({
        next: (plan) => {
          this.applyLivePlan(plan);
          this.replanning.set(false);
          this.showToast(`Маршруты пересчитаны: версия ${plan.plan_version}`, 'success');
        },
        error: (error: { status?: number }) => {
          this.replanning.set(false);
          this.showToast(
            error?.status === 409
              ? 'После событий план пересчитывается только через POST /events'
              : 'Не удалось пересчитать план через API',
            'warning',
          );
        },
      });
      return;
    }

    window.setTimeout(() => {
      const plan = this.plan();
      const nextAsOf = DEMO_NOW;
      this.plan.set({
        ...plan,
        plan_version: plan.plan_version + 1,
        as_of: nextAsOf,
        computation_ms: 900 + Math.round(Math.random() * 1200),
      });
      this.replanning.set(false);
      const assigned = plan.summary?.visits_planned ?? 0;
      this.showToast(
        `Маршруты пересчитаны: ${assigned} назначено, ${this.riskAlerts().length} в риске`,
        'success',
      );
    }, 950);
  }

  private applyLivePlan(plan: Plan): void {
    const known = new Set([...this.reference().staff, ...this.extraStaff()].map((s) => s.staff_id));
    const scById = this.scById();
    const priceholders: Staff[] = [];
    for (const route of plan.routes) {
      if (known.has(route.staff_id)) continue;
      const center = scById.get(route.service_center_id);
      priceholders.push({
        staff_id: route.staff_id,
        display_name: `Бригада ${route.staff_id.replace(/^ST-/, '')}`,
        service_center_id: route.service_center_id,
        profiles: ['INSTALL'],
        technologies: ['PON'],
        height_permit: true,
        shift: DEFAULT_SHIFT,
        equipment_start: center ? { ONT: 3, ROUTER: 4, STB: 2 } : { ONT: 0, ROUTER: 0, STB: 0 },
        equipment_capacity: { ONT: 9, ROUTER: 12, STB: 6 },
      });
    }
    if (priceholders.length) {
      this.extraStaff.update((current) => [...current, ...priceholders]);
    }
    this.plan.set(plan);
  }

  private placeholderStaff(route: Route): Staff {
    return {
      staff_id: route.staff_id,
      display_name: route.staff_id,
      service_center_id: route.service_center_id,
      profiles: ['INSTALL'],
      technologies: ['PON'],
      height_permit: false,
      shift: DEFAULT_SHIFT,
      equipment_start: { ONT: 0, ROUTER: 0, STB: 0 },
      equipment_capacity: { ONT: 0, ROUTER: 0, STB: 0 },
    };
  }

  private isLate(stop: Stop, order?: Order): boolean {
    if (!order) return false;
    return minutesOfDay(stop.start) > minutesOfDay(order.latest_start) + 1;
  }

  private stopLabel(stop: Stop, order?: Order): string {
    switch (stop.type) {
      case 'VISIT':
        return order ? `№ ${stop.seq}` : 'Визит';
      case 'BREAK':
        return 'Перерыв';
      case 'RESTOCK':
        return 'Пополнение АО';
      case 'DEPOT_START':
        return 'Выезд из СЦ';
      case 'DEPOT_END':
        return 'Возврат в СЦ';
    }
  }

  private stopTimeLabel(stop: Stop): string {
    if (stop.type === 'DEPOT_START' || stop.type === 'DEPOT_END') return fmtTime(stop.start);
    if (stop.type === 'BREAK' || stop.type === 'RESTOCK') return fmtTimeRange(stop.start, stop.end);
    return fmtTimeRange(stop.start, stop.end);
  }
}

function orderByIdMap(orders: Order[]): Map<string, Order> {
  return new Map(orders.map((o) => [o.order_id, o]));
}
