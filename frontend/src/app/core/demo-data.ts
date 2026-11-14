import {
  AccessNode,
  Alert,
  Building,
  Equipment,
  Order,
  Plan,
  Profile,
  ReferenceData,
  Route,
  ServiceCenter,
  Staff,
  StaffMeta,
  Stop,
  Technology,
  WorkType,
  WorkTypeCode,
} from './models';
import { addMinutes, minutesOfDay, modelDate, roundUp, toModelIso } from './time';

export const DEMO_DATE = '2026-11-13';
export const DEMO_NOW = `${DEMO_DATE}T13:40:00+05:00`;

const PROFILE_LABEL: Record<Profile, string> = { INSTALL: 'Инсталляция', LTP3: 'Техподдержка' };
export const PROFILE_SHORT = PROFILE_LABEL;

const sc = (
  id: string,
  name: string,
  address: string,
  lat: number,
  lon: number,
  restock: number,
): ServiceCenter => ({
  service_center_id: id,
  name,
  address,
  lat,
  lon,
  opening_hours: { from: '08:00', to: '20:00' },
  restock_duration_min: restock,
});

const SERVICE_CENTERS: ServiceCenter[] = [
  sc('SC-01', 'СЦ «Центр»', 'г. Екатеринбург, ул. Московская, 11', 56.8305, 60.5985, 20),
  sc('SC-02', 'СЦ «Север»', 'г. Екатеринбург, ул. Победы, 30', 56.8941, 60.6105, 15),
  sc('SC-03', 'СЦ «Юг»', 'г. Екатеринбург, ул. Белинского, 222', 56.807, 60.615, 25),
  sc('SC-04', 'СЦ «Восток»', 'г. Екатеринбург, ул. Восточная, 15', 56.845, 60.65, 20),
];

const SHIFT = {
  start: '09:00',
  end: '18:00',
  break_duration_min: 60,
  break_window: { from: '12:00', to: '15:00' },
};

const equipment = (ONT: number, ROUTER: number, STB: number): Equipment => ({ ONT, ROUTER, STB });

interface StaffSeed {
  id: string;
  name: string;
  scId: string;
  profiles: Profile[];
  technologies: Technology[];
  height: boolean;
  color: string;
  district: string;
  visits: WorkTypeCode[];
  restock?: boolean;
  risk?: { index: number; shiftMin: number }[];
}

const STAFF_SEEDS: StaffSeed[] = [
  {
    id: 'ST-001',
    name: 'Иван Смирнов',
    scId: 'SC-01',
    profiles: ['INSTALL'],
    technologies: ['PON', 'FTTB'],
    height: true,
    color: '#7C3AED',
    district: 'Центр — ВИЗ',
    visits: ['ADD_SERVICE', 'INST_PON_MKD', 'INST_FTTB_MKD', 'ADD_SERVICE', 'INST_PON_MKD'],
  },
  {
    id: 'ST-002',
    name: 'Анна Кузнецова',
    scId: 'SC-02',
    profiles: ['LTP3'],
    technologies: ['PON', 'XDSL'],
    height: false,
    color: '#0EA5E9',
    district: 'Пионерский',
    visits: ['REPAIR', 'DEGRADATION', 'REPAIR', 'ADD_SERVICE', 'DEGRADATION'],
    restock: true,
  },
  {
    id: 'ST-003',
    name: 'Дмитрий Попов',
    scId: 'SC-03',
    profiles: ['INSTALL', 'LTP3'],
    technologies: ['PON', 'FTTB'],
    height: true,
    color: '#F97316',
    district: 'Ботанический',
    visits: ['INST_PON_MKD', 'REPAIR', 'DEGRADATION', 'INST_PON_MKD', 'REPAIR'],
    risk: [{ index: 2, shiftMin: 50 }],
  },
  {
    id: 'ST-004',
    name: 'Елена Волкова',
    scId: 'SC-01',
    profiles: ['LTP3'],
    technologies: ['PON', 'DOCSIS'],
    height: false,
    color: '#10B981',
    district: 'Юго-Западный',
    visits: ['REPAIR', 'DEGRADATION', 'REPAIR', 'DISMANTLE', 'REPAIR'],
    restock: true,
  },
  {
    id: 'ST-005',
    name: 'Сергей Морозов',
    scId: 'SC-04',
    profiles: ['INSTALL'],
    technologies: ['PON', 'FTTB'],
    height: true,
    color: '#64748B',
    district: 'Уралмаш',
    visits: ['INST_FTTB_MKD', 'INST_PON_MKD', 'ADD_SERVICE', 'INST_FTTB_MKD', 'SURVEY_PRIVATE'],
  },
  {
    id: 'ST-006',
    name: 'Ольга Новикова',
    scId: 'SC-02',
    profiles: ['LTP3'],
    technologies: ['PON', 'FTTB'],
    height: false,
    color: '#64748B',
    district: 'Академический',
    visits: ['REPAIR', 'DEGRADATION', 'REPAIR', 'REPAIR', 'DEGRADATION'],
  },
  {
    id: 'ST-007',
    name: 'Алексей Фёдоров',
    scId: 'SC-04',
    profiles: ['INSTALL'],
    technologies: ['PON', 'XDSL'],
    height: true,
    color: '#64748B',
    district: 'Эльмаш',
    visits: ['INST_PRIVATE_VLS', 'INST_PON_MKD', 'ADD_SERVICE', 'INST_PON_MKD'],
    risk: [
      { index: 1, shiftMin: 35 },
      { index: 3, shiftMin: 25 },
    ],
  },
  {
    id: 'ST-008',
    name: 'Наталья Соколова',
    scId: 'SC-03',
    profiles: ['INSTALL', 'LTP3'],
    technologies: ['PON', 'FTTB'],
    height: true,
    color: '#64748B',
    district: 'Химмаш',
    visits: ['INST_PON_MKD', 'REPAIR', 'INST_FTTB_MKD', 'ADD_SERVICE', 'REPAIR'],
  },
  {
    id: 'ST-009',
    name: 'Павел Орлов',
    scId: 'SC-01',
    profiles: ['INSTALL'],
    technologies: ['PON'],
    height: false,
    color: '#64748B',
    district: 'Центр',
    visits: [],
  },
  {
    id: 'ST-010',
    name: 'Мария Лебедева',
    scId: 'SC-02',
    profiles: ['LTP3'],
    technologies: ['XDSL', 'DOCSIS'],
    height: false,
    color: '#64748B',
    district: 'Север',
    visits: [],
  },
];

const STAFF_META: Record<string, StaffMeta> = Object.fromEntries(
  STAFF_SEEDS.map((s) => [s.id, { color: s.color, district: s.district }]),
);

const WORK_TYPES: WorkType[] = [
  {
    code: 'INST_PON_MKD',
    name: 'Инсталляция ШПД/IPTV, МКД, PON',
    profiles: ['INSTALL'],
    duration_min: 90,
    max_start_delay_min: 10,
    deadline_kind: 'SLOT',
    deadline_value: null,
    repeat_deadline_value: null,
    pgp_relevant: false,
  },
  {
    code: 'INST_FTTB_MKD',
    name: 'Инсталляция ШПД/IPTV, МКД, FTTB',
    profiles: ['INSTALL'],
    duration_min: 90,
    max_start_delay_min: 10,
    deadline_kind: 'SLOT',
    deadline_value: null,
    repeat_deadline_value: null,
    pgp_relevant: false,
  },
  {
    code: 'INST_PRIVATE_VLS',
    name: 'Инсталляция, частный дом, ВЛС',
    profiles: ['INSTALL'],
    duration_min: 120,
    max_start_delay_min: 10,
    deadline_kind: 'SLOT',
    deadline_value: null,
    repeat_deadline_value: null,
    pgp_relevant: false,
  },
  {
    code: 'ADD_SERVICE',
    name: 'Подключение дополнительной услуги',
    profiles: ['INSTALL', 'LTP3'],
    duration_min: 45,
    max_start_delay_min: 10,
    deadline_kind: 'SLOT',
    deadline_value: null,
    repeat_deadline_value: null,
    pgp_relevant: false,
  },
  {
    code: 'SURVEY_PRIVATE',
    name: 'Обследование частного сектора',
    profiles: ['INSTALL'],
    duration_min: 60,
    max_start_delay_min: null,
    deadline_kind: 'HOURS',
    deadline_value: 24,
    repeat_deadline_value: null,
    pgp_relevant: false,
  },
  {
    code: 'REPAIR',
    name: 'Устранение неисправности',
    profiles: ['LTP3'],
    duration_min: 60,
    max_start_delay_min: null,
    deadline_kind: 'HOURS',
    deadline_value: 24,
    repeat_deadline_value: 12,
    pgp_relevant: true,
  },
  {
    code: 'DEGRADATION',
    name: 'Устранение деградации сервиса',
    profiles: ['LTP3'],
    duration_min: 75,
    max_start_delay_min: null,
    deadline_kind: 'HOURS',
    deadline_value: 36,
    repeat_deadline_value: 24,
    pgp_relevant: true,
  },
  {
    code: 'DISMANTLE',
    name: 'Демонтаж абонентского оборудования',
    profiles: ['INSTALL', 'LTP3'],
    duration_min: 45,
    max_start_delay_min: null,
    deadline_kind: 'WORKING_DAYS',
    deadline_value: 3,
    repeat_deadline_value: null,
    pgp_relevant: false,
  },
];

const WORK_TYPE_BY_CODE = new Map(WORK_TYPES.map((w) => [w.code, w]));

const STREETS = [
  { name: 'ул. Ленина', lat: 56.8389, lon: 60.6057 },
  { name: 'ул. Малышева', lat: 56.835, lon: 60.612 },
  { name: 'ул. Куйбышева', lat: 56.831, lon: 60.597 },
  { name: 'ул. Шейнкмана', lat: 56.828, lon: 60.6 },
  { name: 'ул. Белинского', lat: 56.82, lon: 60.61 },
  { name: 'ул. 8 Марта', lat: 56.825, lon: 60.605 },
  { name: 'ул. Радищева', lat: 56.833, lon: 60.596 },
  { name: 'ул. Московская', lat: 56.83, lon: 60.59 },
  { name: 'ул. Гоголя', lat: 56.837, lon: 60.59 },
  { name: 'ул. Тургенева', lat: 56.842, lon: 60.59 },
  { name: 'ул. Первомайская', lat: 56.84, lon: 60.6 },
  { name: 'ул. Мира', lat: 56.845, lon: 60.615 },
  { name: 'ул. Свердлова', lat: 56.842, lon: 60.605 },
  { name: 'ул. Восточная', lat: 56.845, lon: 60.65 },
  { name: 'ул. Луначарского', lat: 56.85, lon: 60.62 },
  { name: 'ул. Декабристов', lat: 56.83, lon: 60.62 },
  { name: 'ул. Чапаева', lat: 56.837, lon: 60.625 },
  { name: 'ул. Фрунзе', lat: 56.827, lon: 60.625 },
  { name: 'ул. Щорса', lat: 56.815, lon: 60.63 },
  { name: 'ул. Амундсена', lat: 56.805, lon: 60.615 },
  { name: 'ул. Академика Шварца', lat: 56.795, lon: 60.625 },
  { name: 'ул. Родонитовая', lat: 56.81, lon: 60.645 },
  { name: 'ул. Ясная', lat: 56.825, lon: 60.65 },
  { name: 'ул. Блюхера', lat: 56.855, lon: 60.63 },
  { name: 'ул. Шефская', lat: 56.865, lon: 60.635 },
  { name: 'ул. Уральская', lat: 56.86, lon: 60.6 },
  { name: 'ул. Победы', lat: 56.89, lon: 60.61 },
  { name: 'ул. Бебеля', lat: 56.87, lon: 60.59 },
  { name: 'ул. Татищева', lat: 56.845, lon: 60.575 },
  { name: 'ул. Викулова', lat: 56.835, lon: 60.565 },
  { name: 'ул. Металлургов', lat: 56.832, lon: 60.545 },
  { name: 'ул. Посадская', lat: 56.838, lon: 60.58 },
];

const UNASSIGNED_REASONS = [
  {
    reason_code: 'NO_QUALIFIED_STAFF' as const,
    reason_text: 'На смене нет свободного сотрудника с допуском к работам на высоте и технологией PON',
    suggested_action: 'ESCALATE' as const,
  },
  {
    reason_code: 'NO_EQUIPMENT' as const,
    reason_text: 'Нет требуемого абонентского оборудования, заезд в СЦ не помещается в маршрут',
    suggested_action: 'RESCHEDULE' as const,
  },
  {
    reason_code: 'NO_SHIFT_TIME' as const,
    reason_text: 'У подходящих сотрудников не хватает времени смены для визита в слот',
    suggested_action: 'RESCHEDULE' as const,
  },
  {
    reason_code: 'SLOT_UNREACHABLE' as const,
    reason_text: 'Ни один подходящий сотрудник не успевает начать визит в согласованный слот',
    suggested_action: 'RESCHEDULE' as const,
  },
];

const NODES: { id: string; type: AccessNode['node_type']; tech: Technology; name: string; lat: number; lon: number }[] = [
  { id: 'AN-0001', type: 'OLT', tech: 'PON', name: 'OLT Центр-1', lat: 56.834, lon: 60.601 },
  { id: 'AN-0002', type: 'OLT', tech: 'PON', name: 'OLT Центр-2', lat: 56.841, lon: 60.611 },
  { id: 'AN-0003', type: 'OLT', tech: 'PON', name: 'OLT Пионерский', lat: 56.82, lon: 60.62 },
  { id: 'AN-0004', type: 'OLT', tech: 'PON', name: 'OLT Ботанический', lat: 56.8, lon: 60.63 },
  { id: 'AN-0005', type: 'OLT', tech: 'PON', name: 'OLT Уралмаш', lat: 56.89, lon: 60.6 },
  { id: 'AN-0006', type: 'OLT', tech: 'PON', name: 'OLT Химмаш', lat: 56.81, lon: 60.65 },
  { id: 'AN-0007', type: 'SWITCH', tech: 'FTTB', name: 'SWITCH ВИЗ', lat: 56.835, lon: 60.58 },
  { id: 'AN-0008', type: 'SWITCH', tech: 'FTTB', name: 'SWITCH Уралмаш-2', lat: 56.87, lon: 60.615 },
  { id: 'AN-0009', type: 'SWITCH', tech: 'FTTB', name: 'SWITCH Юго-Западный', lat: 56.815, lon: 60.60 },
  { id: 'AN-0010', type: 'DSLAM', tech: 'XDSL', name: 'DSLAM Эльмаш', lat: 56.855, lon: 60.62 },
  { id: 'AN-0011', type: 'CMTS', tech: 'DOCSIS', name: 'CMTS Север', lat: 56.88, lon: 60.605 },
  { id: 'AN-0057', type: 'OLT', tech: 'PON', name: 'OLT Академический-3', lat: 56.805, lon: 60.63 },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function travel(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const roadKm = haversineKm(a, b) * 1.3;
  return {
    minutes: Math.max(4, Math.round((roadKm / 24) * 60) + 2),
    meters: Math.round(roadKm * 1000),
  };
}

interface BuiltDemo {
  reference: ReferenceData;
  orders: Order[];
  plan: Plan;
  staffMeta: Record<string, StaffMeta>;
}

function buildDemo(): BuiltDemo {
  const rng = mulberry32(20261113);
  const scById = new Map(SERVICE_CENTERS.map((s) => [s.service_center_id, s]));

  const staff: Staff[] = STAFF_SEEDS.map((seed) => ({
    staff_id: seed.id,
    display_name: seed.name,
    service_center_id: seed.scId,
    profiles: seed.profiles,
    technologies: seed.technologies,
    height_permit: seed.height,
    shift: SHIFT,
    equipment_start: equipment(3, 4, 2),
    equipment_capacity: equipment(9, 12, 6),
    experience_years: 2 + Math.round(rng() * 60) / 10,
  }));
  const staffById = new Map(staff.map((s) => [s.staff_id, s]));

  const buildings: Building[] = [];
  const orders: Order[] = [];
  const routes: Route[] = [];
  const alerts: Alert[] = [];
  let buildingSeq = 0;
  let orderSeq = 0;

  const newBuilding = (street: (typeof STREETS)[number], tech: Technology): Building => {
    buildingSeq += 1;
    const building: Building = {
      building_id: `B-${String(buildingSeq).padStart(5, '0')}`,
      address: `г. Екатеринбург, ${street.name}, ${1 + Math.floor(rng() * 160)}${
        rng() > 0.82 ? `/${1 + Math.floor(rng() * 4)}` : ''
      }`,
      lat: street.lat + (rng() - 0.5) * 0.006,
      lon: street.lon + (rng() - 0.5) * 0.01,
      building_type: 'MKD',
      overhead_line: false,
      zone_service_center_id: SERVICE_CENTERS[Math.floor(rng() * SERVICE_CENTERS.length)].service_center_id,
    };
    buildings.push(building);
    return building;
  };

  const nodeForTech = (tech: Technology): string => {
    const pool = NODES.filter((n) => n.tech === tech);
    return pool[Math.floor(rng() * pool.length)].id;
  };

  const makeOrder = (
    building: Building,
    work: WorkTypeCode,
    slotStart: Date,
    opts: { riskShiftMin?: number; nodeId?: string; repeat?: boolean } = {},
  ): Order => {
    orderSeq += 1;
    const wt = WORK_TYPE_BY_CODE.get(work)!;
    const start = new Date(slotStart.getTime() - (opts.riskShiftMin ?? 0) * 60_000);
    const latestStart = wt.max_start_delay_min
      ? addMinutes(start, wt.max_start_delay_min)
      : addMinutes(start, 120);
    const tech: Technology =
      work === 'INST_FTTB_MKD'
        ? 'FTTB'
        : work === 'SURVEY_PRIVATE'
          ? 'XDSL'
          : work === 'DISMANTLE'
            ? 'DOCSIS'
            : 'PON';
    const order: Order = {
      order_id: `ORD-20261113-${String(orderSeq).padStart(4, '0')}`,
      work_type_code: work,
      technology: tech,
      building_id: building.building_id,
      address: building.address,
      lat: building.lat,
      lon: building.lon,
      building_type: building.building_type,
      requires_height: building.overhead_line,
      access_node_id: opts.nodeId ?? nodeForTech(tech),
      registered_at: toModelIso(addMinutes(modelDate(DEMO_DATE, '08:00'), -Math.floor(rng() * 900))),
      slot: { start: toModelIso(start), end: toModelIso(addMinutes(start, 120)) },
      latest_start: toModelIso(latestStart),
      deadline: toModelIso(addMinutes(latestStart, wt.duration_min)),
      required_equipment:
        wt.code === 'DISMANTLE'
          ? equipment(0, 0, 0)
          : wt.code === 'ADD_SERVICE'
            ? equipment(0, 1, rng() > 0.5 ? 1 : 0)
            : equipment(1, 1, rng() > 0.55 ? 1 : 0),
      is_repeat: opts.repeat ?? rng() < 0.12,
    };
    orders.push(order);
    return order;
  };

  for (const seed of STAFF_SEEDS) {
    const s = staffById.get(seed.id)!;
    const center = scById.get(s.service_center_id)!;
    const stops: Stop[] = [];
    let seq = 1;
    let cursor = modelDate(DEMO_DATE, s.shift.start);
    let current: { lat: number; lon: number } = center;
    let breakDone = false;
    let restockDone = !seed.restock;
    let bag: Equipment = { ...s.equipment_start };
    let travelSec = 0;
    let distanceM = 0;
    let workMin = 0;
    let visits = 0;

    const pushStop = (stop: Stop) => {
      stops.push(stop);
      seq += 1;
    };

    const depotStart = toModelIso(cursor);
    pushStop({
      seq,
      type: 'DEPOT_START',
      location_id: center.service_center_id,
      arrival: depotStart,
      start: depotStart,
      end: depotStart,
      travel_sec: 0,
      distance_m: 0,
      status: 'DONE',
      equipment_after: { ...bag },
    });

    const visitSpecs = seed.visits;
    for (let i = 0; i < visitSpecs.length; i += 1) {
      const work = visitSpecs[i];
      const street = STREETS[Math.floor(rng() * STREETS.length)];
      const building = newBuilding(street, 'PON');
      if (work === 'INST_PRIVATE_VLS' || work === 'SURVEY_PRIVATE') {
        building.building_type = 'PRIVATE';
        building.overhead_line = true;
        building.address = `г. Екатеринбург, ${street.name}, ${1 + Math.floor(rng() * 60)}`;
      }
      const t = travel(current, building);
      cursor = addMinutes(cursor, t.minutes);
      travelSec += t.minutes * 60;
      distanceM += t.meters;

      let start = roundUp(cursor, 15);
      const wt = WORK_TYPE_BY_CODE.get(work)!;
      let end = addMinutes(start, wt.duration_min);
      workMin += wt.duration_min;

      const risk = seed.risk?.find((r) => r.index === i);
      const order = makeOrder(building, work, start, { riskShiftMin: risk?.shiftMin });

      bag = {
        ONT: bag.ONT - order.required_equipment.ONT,
        ROUTER: bag.ROUTER - order.required_equipment.ROUTER,
        STB: bag.STB - order.required_equipment.STB,
      };

      const arrival = toModelIso(cursor);
      pushStop({
        seq,
        type: 'VISIT',
        location_id: building.building_id,
        order_id: order.order_id,
        arrival,
        start: toModelIso(start),
        end: toModelIso(end),
        travel_sec: t.minutes * 60,
        distance_m: t.meters,
        equipment_after: { ...bag },
      });
      visits += 1;
      cursor = end;
      current = building;

      if (!breakDone && i < visitSpecs.length - 1) {
        const from = modelDate(DEMO_DATE, s.shift.break_window.from);
        if (cursor >= from) {
          const breakStart = roundUp(cursor, 5);
          const breakEnd = addMinutes(breakStart, s.shift.break_duration_min);
          pushStop({
            seq,
            type: 'BREAK',
            location_id: building.building_id,
            arrival: toModelIso(breakStart),
            start: toModelIso(breakStart),
            end: toModelIso(breakEnd),
            travel_sec: 0,
            distance_m: 0,
            equipment_after: { ...bag },
          });
          cursor = breakEnd;
          breakDone = true;
        }
      }

      if (!restockDone && i === 2) {
        const back = travel(current, center);
        cursor = addMinutes(cursor, back.minutes);
        travelSec += back.minutes * 60;
        distanceM += back.meters;
        const restockStart = roundUp(cursor, 15);
        const restockEnd = addMinutes(restockStart, center.restock_duration_min);
        pushStop({
          seq,
          type: 'RESTOCK',
          location_id: center.service_center_id,
          arrival: toModelIso(cursor),
          start: toModelIso(restockStart),
          end: toModelIso(restockEnd),
          travel_sec: back.minutes * 60,
          distance_m: back.meters,
          equipment_after: { ...s.equipment_capacity },
        });
        bag = { ...s.equipment_capacity };
        cursor = restockEnd;
        current = center;
        restockDone = true;
      }
    }

    const back = travel(current, center);
    cursor = addMinutes(cursor, back.minutes);
    travelSec += back.minutes * 60;
    distanceM += back.meters;
    const depotEnd = toModelIso(cursor);
    pushStop({
      seq,
      type: 'DEPOT_END',
      location_id: center.service_center_id,
      arrival: depotEnd,
      start: depotEnd,
      end: depotEnd,
      travel_sec: back.minutes * 60,
      distance_m: back.meters,
      equipment_after: { ...bag },
    });

    const withStatus = stops.map((stop) => {
      const now = new Date(DEMO_NOW).getTime();
      const start = new Date(stop.start).getTime();
      const end = new Date(stop.end).getTime();
      const status = end <= now ? 'DONE' : start <= now ? 'IN_PROGRESS' : 'PLANNED';
      return { ...stop, status } as Stop;
    });

    routes.push({
      staff_id: s.staff_id,
      service_center_id: s.service_center_id,
      status: 'ACTIVE',
      stops: withStatus,
      totals: {
        visits,
        travel_sec: travelSec,
        distance_m: distanceM,
        work_min: workMin,
        utilization: Math.round(((workMin * 60 + travelSec) / ((9 * 60 - 60) * 60)) * 100) / 100,
      },
    });

    for (const stop of withStatus) {
      if (stop.type !== 'VISIT' || !stop.order_id) continue;
      const order = orders.find((o) => o.order_id === stop.order_id)!;
      const late = (minutesOfDay(stop.start) - minutesOfDay(order.latest_start)) as number;
      if (late > 1) {
        alerts.push({
          alert_id: `ALR-20261113-${String(alerts.length + 1).padStart(4, '0')}`,
          created_at: toModelIso(addMinutes(new Date(stop.start), -70)),
          type: 'LATE_RISK',
          status: 'ACTIVE',
          order_id: order.order_id,
          staff_id: s.staff_id,
          forecast_start: stop.start,
          lateness_min: late,
          suggested_action: 'REASSIGN',
          applied: false,
          message: `${s.display_name} не успевает начать визит в слот: прогноз опоздания ${late} мин`,
        });
      }
    }
  }

  // Наряды, которые не удалось распределить.
  const unassigned = Array.from({ length: 18 }, (_, i) => {
    const street = STREETS[Math.floor(rng() * STREETS.length)];
    const building = newBuilding(street, 'PON');
    const slotStart = addMinutes(modelDate(DEMO_DATE, '09:00'), (60 + i * 25) % 480);
    const order = makeOrder(building, i % 3 === 0 ? 'DEGRADATION' : i % 3 === 1 ? 'INST_PON_MKD' : 'REPAIR', slotStart);
    const reason = UNASSIGNED_REASONS[i % UNASSIGNED_REASONS.length];
    return {
      order_id: order.order_id,
      ...reason,
      since: toModelIso(addMinutes(new Date(order.registered_at), 30)),
    };
  });

  // ПГП: три обращения с одного узла за 40 минут.
  const pgpStreet = STREETS[20];
  const pgpOrders = [0, 20, 40].map((offset, i) => {
    const building = newBuilding(pgpStreet, 'PON');
    const order = makeOrder(
      building,
      i === 1 ? 'DEGRADATION' : 'REPAIR',
      addMinutes(modelDate(DEMO_DATE, '14:00'), i * 30),
      { nodeId: 'AN-0057' },
    );
    return { ...order, registered_at: toModelIso(addMinutes(modelDate(DEMO_DATE, '12:00'), offset)),
      access_node_id: 'AN-0057' };
  });
  // сохраняем обновлённые registered_at
  for (const o of pgpOrders) {
    const idx = orders.findIndex((x) => x.order_id === o.order_id);
    if (idx >= 0) orders[idx] = o;
  }
  const pgpGroup = {
    group_id: 'PGP-20261113-01',
    access_node_id: 'AN-0057',
    order_ids: pgpOrders.map((o) => o.order_id),
    detected_at: toModelIso(modelDate(DEMO_DATE, '12:50')),
    action: 'TRANSFER_TO_STATION' as const,
    comment: 'Три обращения по деградации с одного узла за 40 минут — вероятна авария на магистрали.',
  };
  alerts.push({
    alert_id: 'ALR-20261113-0100',
    created_at: pgpGroup.detected_at,
    type: 'PGP_DETECTED',
    status: 'ACTIVE',
    group_id: pgpGroup.group_id,
    suggested_action: 'TRANSFER_TO_STATION',
    applied: true,
    message: 'Выявлена групповая проблема AN-0057: 3 наряда переданы в станционное подразделение',
  });

  // Отменённый наряд.
  const cancelStreet = STREETS[5];
  const cancelBuilding = newBuilding(cancelStreet, 'PON');
  const cancelledOrder = makeOrder(cancelBuilding, 'ADD_SERVICE', modelDate(DEMO_DATE, '15:00'));
  const cancelled = [
    { order_id: cancelledOrder.order_id, cancelled_at: toModelIso(modelDate(DEMO_DATE, '11:15')) },
  ];

  // Подкладываем некорректный статус для отменённого наряда в таблице.
  const accessNodes: AccessNode[] = NODES.map((node) => ({
    access_node_id: node.id,
    node_type: node.type,
    technology: node.tech,
    name: node.name,
    address: `г. Екатеринбург, ${STREETS[Math.floor(rng() * STREETS.length)].name}, ${
      1 + Math.floor(rng() * 40)
    }`,
    lat: node.lat,
    lon: node.lon,
    buildings: buildings.filter((b) =>
      orders.some((o) => o.building_id === b.building_id && o.access_node_id === node.id),
    ),
  }));

  const travelTotal = routes.reduce((sum, r) => sum + (r.totals?.travel_sec ?? 0), 0);
  const visitsPlanned = routes.reduce((sum, r) => sum + (r.totals?.visits ?? 0), 0);

  const plan: Plan = {
    date: DEMO_DATE,
    plan_version: 4,
    based_on_event_id: 'EVT-20261113-0018',
    as_of: DEMO_NOW,
    computation_ms: 1840,
    routes,
    unassigned,
    pgp_groups: [pgpGroup],
    cancelled,
    alerts,
    summary: {
      orders_total: orders.length,
      visits_planned: visitsPlanned,
      unassigned: unassigned.length,
      pgp_orders: pgpOrders.length,
      cancelled: cancelled.length,
      travel_sec_total: travelTotal,
      utilization_cv: 0.18,
    },
  };

  return {
    reference: {
      service_centers: SERVICE_CENTERS,
      staff,
      access_nodes: accessNodes,
      work_types: WORK_TYPES,
    },
    orders,
    plan,
    staffMeta: STAFF_META,
  };
}

const demo = buildDemo();

export const DEMO_REFERENCE: ReferenceData = demo.reference;
export const DEMO_ORDERS: Order[] = demo.orders;
export const DEMO_PLAN: Plan = demo.plan;
export const DEMO_STAFF_META: Record<string, StaffMeta> = demo.staffMeta;
