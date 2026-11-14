/** Типы соответствуют OpenAPI-контракту кейса «Умная диспетчеризация выездных бригад». */

export type Profile = 'INSTALL' | 'LTP3';
export type Technology = 'PON' | 'FTTB' | 'XDSL' | 'DOCSIS';
export type BuildingType = 'MKD' | 'PRIVATE';
export type RouteStatus = 'ACTIVE' | 'UNAVAILABLE';
export type StopType = 'DEPOT_START' | 'VISIT' | 'BREAK' | 'RESTOCK' | 'DEPOT_END';
export type StopStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';

export type WorkTypeCode =
  | 'INST_PON_MKD'
  | 'INST_FTTB_MKD'
  | 'INST_PRIVATE_VLS'
  | 'ADD_SERVICE'
  | 'SURVEY_PRIVATE'
  | 'REPAIR'
  | 'DEGRADATION'
  | 'DISMANTLE';

export type UnassignedReason =
  | 'NO_QUALIFIED_STAFF'
  | 'NO_SHIFT_TIME'
  | 'SLOT_UNREACHABLE'
  | 'NO_EQUIPMENT'
  | 'STAFF_UNAVAILABLE'
  | 'OTHER';

export interface Equipment {
  ONT: number;
  ROUTER: number;
  STB: number;
}

export interface LocalTimeWindow {
  from: string;
  to: string;
}

export interface Shift {
  start: string;
  end: string;
  break_duration_min: number;
  break_window: LocalTimeWindow;
}

export interface ServiceCenter {
  service_center_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  opening_hours: LocalTimeWindow;
  restock_duration_min: number;
}

export interface Staff {
  staff_id: string;
  display_name: string;
  service_center_id: string;
  profiles: Profile[];
  technologies: Technology[];
  height_permit: boolean;
  shift: Shift;
  equipment_start: Equipment;
  equipment_capacity: Equipment;
  experience_years?: number;
}

export interface Building {
  building_id: string;
  address: string;
  lat: number;
  lon: number;
  building_type: BuildingType;
  overhead_line: boolean;
  zone_service_center_id?: string;
}

export interface AccessNode {
  access_node_id: string;
  node_type: 'OLT' | 'SWITCH' | 'DSLAM' | 'CMTS';
  technology: Technology;
  name: string;
  address?: string;
  lat: number;
  lon: number;
  buildings: Building[];
}

export interface WorkType {
  code: WorkTypeCode;
  name: string;
  profiles: Profile[];
  duration_min: number;
  max_start_delay_min: number | null;
  deadline_kind: 'SLOT' | 'HOURS' | 'WORKING_DAYS';
  deadline_value: number | null;
  repeat_deadline_value: number | null;
  pgp_relevant: boolean;
}

export interface ReferenceData {
  service_centers: ServiceCenter[];
  staff: Staff[];
  access_nodes: AccessNode[];
  work_types: WorkType[];
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Order {
  order_id: string;
  work_type_code: WorkTypeCode;
  technology: Technology;
  building_id: string;
  address: string;
  lat: number;
  lon: number;
  building_type: BuildingType;
  requires_height: boolean;
  access_node_id: string;
  registered_at: string;
  slot: TimeWindow;
  latest_start: string;
  deadline: string;
  required_equipment: Equipment;
  is_repeat: boolean;
  previous_order_id?: string | null;
}

export interface Stop {
  seq: number;
  type: StopType;
  location_id: string;
  order_id?: string | null;
  arrival: string;
  start: string;
  end: string;
  travel_sec?: number;
  distance_m?: number;
  status?: StopStatus;
  equipment_after?: Equipment;
  explanation?: string;
}

export interface RouteTotals {
  visits?: number;
  travel_sec?: number;
  distance_m?: number;
  work_min?: number;
  utilization?: number;
}

export interface Route {
  staff_id: string;
  service_center_id: string;
  status: RouteStatus;
  unavailable_from?: string | null;
  unavailable_until?: string | null;
  stops: Stop[];
  totals?: RouteTotals;
}

export interface UnassignedOrder {
  order_id: string;
  reason_code: UnassignedReason;
  reason_text: string;
  suggested_action: 'RESCHEDULE' | 'REASSIGN' | 'ESCALATE';
  proposed_slot?: TimeWindow | null;
  since?: string | null;
}

export interface PgpGroup {
  group_id: string;
  access_node_id: string;
  order_ids: string[];
  detected_at: string;
  action: 'TRANSFER_TO_STATION';
  comment?: string;
}

export interface CancelledOrder {
  order_id: string;
  cancelled_at: string;
  event_id?: string | null;
}

export type AlertType = 'LATE_RISK' | 'PGP_DETECTED' | 'UNASSIGNED';
export type AlertStatus = 'ACTIVE' | 'RESOLVED';

export interface Alert {
  alert_id: string;
  created_at: string;
  type: AlertType;
  status: AlertStatus;
  resolved_at?: string | null;
  order_id?: string | null;
  group_id?: string | null;
  staff_id?: string | null;
  forecast_start?: string | null;
  lateness_min?: number | null;
  suggested_action: 'REASSIGN' | 'RESCHEDULE' | 'TRANSFER_TO_STATION' | 'NONE';
  suggested_staff_id?: string | null;
  proposed_slot?: TimeWindow | null;
  applied?: boolean;
  message: string;
}

export interface PlanSummary {
  orders_total?: number;
  visits_planned?: number;
  unassigned?: number;
  pgp_orders?: number;
  cancelled?: number;
  travel_sec_total?: number;
  utilization_cv?: number;
}

export interface Plan {
  date: string;
  plan_version: number;
  based_on_event_id?: string | null;
  as_of: string;
  computation_ms?: number;
  routes: Route[];
  unassigned: UnassignedOrder[];
  pgp_groups: PgpGroup[];
  cancelled: CancelledOrder[];
  alerts: Alert[];
  summary?: PlanSummary;
}

export interface Health {
  status: string;
  team?: string;
  version?: string;
}

export interface UiDay {
  date: string;
  now: string;
}

export interface DayInput {
  date: string;
  now: string;
  orders: Order[];
  absent_staff_ids?: string[];
}

export interface LoadResult {
  status: string;
  counts: Record<string, number>;
}

/** UI-модели (не входят в контракт API). */

export type StaffPresence = 'На заявке' | 'В пути' | 'Обед' | 'Свободен' | 'Опаздывает';

export interface StaffMeta {
  color: string;
  district: string;
}

export interface StopView {
  stop: Stop;
  order?: Order;
  lat: number;
  lon: number;
  label: string;
  timeLabel: string;
  late: boolean;
  risk: boolean;
}

export interface RouteView {
  route: Route;
  staff: Staff;
  meta: StaffMeta;
  stops: StopView[];
  visits: number;
  done: number;
  km: number;
  nextStop?: StopView;
  presence: StaffPresence;
  risk: boolean;
  eta?: string;
}

export interface StaffCardView extends RouteView {
  initials: string;
  shortName: string;
  progress: number;
  visitCount: number;
}

export type OrderUiStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'UNASSIGNED'
  | 'PGP'
  | 'CANCELLED';

export interface OrderRow {
  order: Order;
  workType?: WorkType;
  staff?: Staff;
  routeColor?: string;
  status: OrderUiStatus;
  visit?: Stop;
  slotLabel: string;
  plannedLabel: string;
  latenessMin: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reason?: string;
}

export interface AlertView {
  alert: Alert;
  order?: Order;
  staff?: Staff;
  windowLabel: string;
  latenessMin: number;
}

export interface UnassignedView {
  item: UnassignedOrder;
  order?: Order;
  reasonLabel: string;
}

export interface PgpView {
  group: PgpGroup;
  node?: AccessNode;
  orders: Order[];
}

export interface StatCard {
  key: string;
  label: string;
  value: string;
  note: string;
  tone: 'brand' | 'green' | 'amber' | 'red' | 'slate';
  icon: string;
}

/** Мобильный интерфейс бригады: отметки по визиту. */
export interface FieldMark {
  calledAt?: string;
  arrivedAt?: string;
  completedAt?: string;
}

export type FieldVisitState = 'PLANNED' | 'CALLED' | 'ARRIVED' | 'DONE';

export interface FieldVisitView {
  stop: StopView;
  order: Order;
  staff: Staff;
  color: string;
  state: FieldVisitState;
  mark: FieldMark;
  /** Порядковый номер визита в смене (1-based, без служебных остановок). */
  index: number;
  phone: string;
  telHref: string;
  navUrl: string;
  mapUrl: string;
  isCurrent: boolean;
}
