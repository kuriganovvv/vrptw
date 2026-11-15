"""Генератор тестовых данных по ТЗ кейса №5 (умная диспетчеризация).

Создаёт:
  data/reference.json      — 5 СЦ, 40 сотрудников, узлы доступа с домами, 8 типов работ
  data/travel_matrix.json  — матрица времени в пути и расстояний по всем точкам
  data/day_2026-10-26.json — 100 нарядов дня и модельное время now

Данные детерминированы (seed) и проверяются встроенными assert'ами:
типы работ, технологии, АО, latest_start, deadline, слоты, ПГП.
"""

import json
import math
import os
import random
import re
from datetime import date, datetime, time, timedelta, timezone

random.seed(20261026)

TZ = timezone(timedelta(hours=5))
DAY = date(2026, 10, 26)
NOW = datetime(2026, 10, 26, 8, 30, tzinfo=TZ)
REFERENCE_FILE = "data/reference.json"

os.makedirs("data", exist_ok=True)


def at(day, hour, minute=0):
    return datetime.combine(day, time(hour, minute), tzinfo=TZ)


def iso(value):
    return value.isoformat()


# Праздники РФ, попадающие в горизонт генерации (для WORKING_DAYS).
HOLIDAYS = {date(2026, 11, 4)}


def add_working_days(moment, days):
    current = moment
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5 and current.date() not in HOLIDAYS:
            added += 1
    return current


def haversine_m(lat1, lon1, lat2, lon2):
    radius = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


# ---------------------------------------------------------------- справочники

DISTRICTS = [
    {
        "sc": "SC-01",
        "name": "СЦ «Север»",
        "address": "г. Екатеринбург, ул. Победы, 30",
        "lat": 56.8941,
        "lon": 60.6105,
        "streets": ["ул. Победы", "ул. Уральская", "ул. Учителей", "ул. Пионерская", "ул. Мира"],
    },
    {
        "sc": "SC-02",
        "name": "СЦ «Центр»",
        "address": "г. Екатеринбург, ул. Малышева, 51",
        "lat": 56.8389,
        "lon": 60.5970,
        "streets": ["ул. Малышева", "ул. Ленина", "ул. Карла Либкнехта", "ул. Свердлова", "ул. Пушкина"],
    },
    {
        "sc": "SC-03",
        "name": "СЦ «Юг»",
        "address": "г. Екатеринбург, ул. Белинского, 222",
        "lat": 56.8030,
        "lon": 60.6100,
        "streets": ["ул. Белинского", "ул. Щербакова", "ул. Авиационная", "ул. Чкалова", "ул. Громова"],
    },
    {
        "sc": "SC-04",
        "name": "СЦ «Запад»",
        "address": "г. Екатеринбург, ул. Академика Сахарова, 10",
        "lat": 56.8450,
        "lon": 60.5530,
        "streets": ["ул. Академика Сахарова", "ул. Металлургов", "ул. Заводская", "ул. Викулова", "ул. Татищева"],
    },
    {
        "sc": "SC-05",
        "name": "СЦ «Восток»",
        "address": "г. Екатеринбург, ул. Сибирский тракт, 15",
        "lat": 56.8450,
        "lon": 60.6750,
        "streets": ["ул. Сибирский тракт", "ул. Восточная", "ул. Луначарского", "ул. Первомайская", "ул. Сулимова"],
    },
]

service_centers = [
    {
        "service_center_id": d["sc"],
        "name": d["name"],
        "address": d["address"],
        "lat": round(d["lat"], 6),
        "lon": round(d["lon"], 6),
        "opening_hours": {"open": "08:00", "close": "21:00"},
        "restock_duration_min": 15,
    }
    for d in DISTRICTS
]

# 28 сотрудников 3ЛТП и 12 инсталляторов, по 8 на каждый СЦ.
PROFILE_PLAN = [("LTP3", 6), ("LTP3", 6), ("LTP3", 6), ("LTP3", 5), ("LTP3", 5)]
INSTALL_PLAN = [("INSTALL", 2), ("INSTALL", 2), ("INSTALL", 2), ("INSTALL", 3), ("INSTALL", 3)]

# Условные ФИО сотрудников для интерфейса (данные синтетические).
NAMES = [
    "Пётр Ковалёв",
    "Алексей Смирнов",
    "Дмитрий Кузнецов",
    "Сергей Попов",
    "Андрей Васильев",
    "Николай Петров",
    "Михаил Соколов",
    "Игорь Михайлов",
    "Артём Новиков",
    "Владимир Фёдоров",
    "Денис Морозов",
    "Антон Волков",
    "Роман Алексеев",
    "Егор Лебедев",
    "Виктор Семёнов",
    "Павел Егоров",
    "Максим Павлов",
    "Кирилл Козлов",
    "Олег Степанов",
    "Илья Николаев",
    "Григорий Орлов",
    "Степан Андреев",
    "Юрий Макаров",
    "Вадим Никитин",
    "Тимур Захаров",
    "Борис Зайцев",
    "Глеб Соловьёв",
    "Лев Борисов",
    "Руслан Яковлев",
    "Эдуард Григорьев",
    "Аркадий Романов",
    "Валерий Воробьёв",
    "Игнат Фролов",
    "Савелий Александров",
    "Матвей Медведев",
    "Данила Ершов",
    "Арсений Тарасов",
    "Вячеслав Белов",
    "Родион Комаров",
    "Семён Гусев",
]

staff = []
staff_counter = 0
for district_index, district in enumerate(DISTRICTS):
    for profile, count in (PROFILE_PLAN[district_index], INSTALL_PLAN[district_index]):
        for _ in range(count):
            staff_counter += 1
            evening = staff_counter % 2 == 0
            if evening:
                shift = {"start": "12:00", "end": "21:00", "break_duration_min": 60,
                         "break_window": {"from": "15:00", "to": "18:00"}}
            else:
                shift = {"start": "09:00", "end": "18:00", "break_duration_min": 60,
                         "break_window": {"from": "12:00", "to": "15:00"}}

            if profile == "INSTALL":
                technologies = ["PON", "FTTB"]
                if staff_counter % 4 == 0:
                    technologies.append("XDSL")
                height_permit = staff_counter % 5 != 0
                equipment_start = {"ONT": 4, "ROUTER": 5, "STB": 3}
                equipment_capacity = {"ONT": 8, "ROUTER": 8, "STB": 6}
            else:
                technologies = ["PON", "FTTB", "XDSL"]
                if staff_counter % 3 == 0:
                    technologies.append("DOCSIS")
                height_permit = staff_counter % 2 == 0
                equipment_start = {"ONT": 2, "ROUTER": 3, "STB": 2}
                equipment_capacity = {"ONT": 6, "ROUTER": 6, "STB": 4}

            staff.append({
                "staff_id": f"ST-{staff_counter:03d}",
                "display_name": NAMES[staff_counter - 1],
                "service_center_id": district["sc"],
                "profiles": [profile],
                "technologies": technologies,
                "height_permit": height_permit,
                "shift": shift,
                "equipment_start": equipment_start,
                "equipment_capacity": equipment_capacity,
                "experience_years": round(random.uniform(1.0, 18.0), 1),
            })

# 100 домов: по 20 на район, 75% МКД и 25% частный сектор.
buildings = []
building_by_id = {}
building_district = {}
for district_index, district in enumerate(DISTRICTS):
    for j in range(20):
        building_id = f"B-{district_index * 20 + j + 1:05d}"
        is_private = j >= 15
        if is_private:
            lat = district["lat"] + random.uniform(-0.030, 0.030)
            lon = district["lon"] + random.uniform(-0.040, 0.040)
        else:
            lat = district["lat"] + random.uniform(-0.018, 0.018)
            lon = district["lon"] + random.uniform(-0.024, 0.024)

        street = district["streets"][j % len(district["streets"])]
        building = {
            "building_id": building_id,
            "address": f"г. Екатеринбург, {street}, {2 + j * 2 + district_index}",
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "building_type": "PRIVATE" if is_private else "MKD",
            "overhead_line": bool(is_private and random.random() < 0.8),
            "zone_service_center_id": district["sc"],
        }
        buildings.append(building)
        building_by_id[building_id] = building
        building_district[building_id] = district_index

# Узлы доступа: PON + FTTB + xDSL в каждом районе, DOCSIS в двух районах.
NODE_TYPES = {
    "PON": ("OLT", "OLT"),
    "FTTB": ("SWITCH", "SWITCH"),
    "XDSL": ("DSLAM", "DSLAM"),
    "DOCSIS": ("CMTS", "CMTS"),
}

access_nodes = []
node_by_id = {}
node_key_by_id = {}
building_technology = {b["building_id"]: set() for b in buildings}


def building_has_tech(building, technology):
    if building["building_type"] == "MKD":
        return True
    return technology in ("PON", "FTTB")


node_counter = 0
for district_index, district in enumerate(DISTRICTS):
    technologies = ["PON", "FTTB", "XDSL"]
    if district_index in (0, 1):
        technologies.append("DOCSIS")

    for technology in technologies:
        node_counter += 1
        node_type, label = NODE_TYPES[technology]
        node_buildings = []
        for building in buildings:
            if building_district[building["building_id"]] != district_index:
                continue
            if not building_has_tech(building, technology):
                continue
            if technology == "PON" and building["building_type"] == "PRIVATE" and random.random() < 0.4:
                continue
            if technology == "XDSL" and random.random() > (0.55 if building["building_type"] == "MKD" else 0.25):
                continue
            if technology == "DOCSIS" and random.random() > (0.5 if building["building_type"] == "MKD" else 0.15):
                continue
            node_buildings.append(building)
            building_technology[building["building_id"]].add(technology)

        # У каждого узла должен быть хотя бы один дом.
        if not node_buildings:
            fallback = next(b for b in buildings
                            if building_district[b["building_id"]] == district_index
                            and b["building_type"] == "MKD")
            node_buildings.append(fallback)
            building_technology[fallback["building_id"]].add(technology)

        node_id = f"AN-{node_counter:04d}"
        node = {
            "access_node_id": node_id,
            "node_type": node_type,
            "technology": technology,
            "name": f"{label} {district['name'].split('«')[1].rstrip('»')}-{node_counter}",
            "address": f"г. Екатеринбург, {district['streets'][0]}, {1 + node_counter}",
            "lat": round(district["lat"] + random.uniform(-0.012, 0.012), 6),
            "lon": round(district["lon"] + random.uniform(-0.018, 0.018), 6),
            "buildings": [
                {
                    "building_id": b["building_id"],
                    "address": b["address"],
                    "lat": b["lat"],
                    "lon": b["lon"],
                    "building_type": b["building_type"],
                    "overhead_line": b["overhead_line"],
                    "zone_service_center_id": b["zone_service_center_id"],
                }
                for b in node_buildings
            ],
        }
        access_nodes.append(node)
        node_by_id[node_id] = node
        node_key_by_id[node_id] = (district_index, technology)

# Дом может встречаться в нескольких узлах, но всегда с одинаковыми атрибутами.
for building in buildings:
    if not building_technology[building["building_id"]]:
        district_index = building_district[building["building_id"]]
        node = next(n for n in access_nodes
                    if node_key_by_id[n["access_node_id"]][0] == district_index
                    and node_key_by_id[n["access_node_id"]][1] == "FTTB")
        node["buildings"].append({
            "building_id": building["building_id"],
            "address": building["address"],
            "lat": building["lat"],
            "lon": building["lon"],
            "building_type": building["building_type"],
            "overhead_line": building["overhead_line"],
            "zone_service_center_id": building["zone_service_center_id"],
        })
        building_technology[building["building_id"]].add("FTTB")

nodes_by_technology = {}
for node in access_nodes:
    nodes_by_technology.setdefault(node["technology"], []).append(node)

node_ids_by_building_tech = {}
for node in access_nodes:
    district_index, technology = node_key_by_id[node["access_node_id"]]
    for b in node["buildings"]:
        node_ids_by_building_tech.setdefault((b["building_id"], technology), node["access_node_id"])

work_types = [
    {"code": "INST_PON_MKD", "name": "Инсталляция ШПД/IPTV, МКД, PON", "profiles": ["INSTALL"],
     "duration_min": 90, "max_start_delay_min": 10, "deadline_kind": "WORKING_DAYS",
     "deadline_value": 3, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "INST_FTTB_MKD", "name": "Инсталляция ШПД/IPTV, МКД, FTTB", "profiles": ["INSTALL"],
     "duration_min": 60, "max_start_delay_min": 10, "deadline_kind": "WORKING_DAYS",
     "deadline_value": 3, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "INST_PRIVATE_VLS", "name": "Инсталляция, частный сектор, с ВЛС", "profiles": ["INSTALL"],
     "duration_min": 180, "max_start_delay_min": 10, "deadline_kind": "WORKING_DAYS",
     "deadline_value": 5, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "ADD_SERVICE", "name": "Доподключение услуги (IPTV, Wi-Fi-роутер)", "profiles": ["INSTALL"],
     "duration_min": 40, "max_start_delay_min": 10, "deadline_kind": "SLOT",
     "deadline_value": None, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "SURVEY_PRIVATE", "name": "Обследование (частный сектор)", "profiles": ["INSTALL", "LTP3"],
     "duration_min": 45, "max_start_delay_min": None, "deadline_kind": "WORKING_DAYS",
     "deadline_value": 2, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "REPAIR", "name": "Устранение неисправности (обращение абонента)", "profiles": ["LTP3"],
     "duration_min": 60, "max_start_delay_min": None, "deadline_kind": "HOURS",
     "deadline_value": 24, "repeat_deadline_value": 12, "pgp_relevant": True},
    {"code": "DEGRADATION", "name": "Устранение деградации, выявленной системой мониторинга качества",
     "profiles": ["LTP3"], "duration_min": 45, "max_start_delay_min": None,
     "deadline_kind": "HOURS", "deadline_value": 48, "repeat_deadline_value": None,
     "pgp_relevant": True},
    {"code": "DISMANTLE", "name": "Демонтаж АО", "profiles": ["LTP3"], "duration_min": 30,
     "max_start_delay_min": None, "deadline_kind": "WORKING_DAYS", "deadline_value": 5,
     "repeat_deadline_value": None, "pgp_relevant": False},
]
work_type_by_code = {w["code"]: w for w in work_types}

reference = {
    "service_centers": service_centers,
    "staff": staff,
    "access_nodes": access_nodes,
    "work_types": work_types,
}
with open(REFERENCE_FILE, "w", encoding="utf-8") as f:
    json.dump(reference, f, ensure_ascii=False, indent=2)

# ------------------------------------------------------------ матрица времени

points = [sc["service_center_id"] for sc in service_centers] + [b["building_id"] for b in buildings]
coordinates = {sc["service_center_id"]: (sc["lat"], sc["lon"]) for sc in service_centers}
coordinates.update({b["building_id"]: (b["lat"], b["lon"]) for b in buildings})

durations_sec = []
distances_m = []
for from_point in points:
    duration_row = []
    distance_row = []
    lat1, lon1 = coordinates[from_point]
    for to_point in points:
        if from_point == to_point:
            duration_row.append(0)
            distance_row.append(0)
            continue
        lat2, lon2 = coordinates[to_point]
        direct_m = haversine_m(lat1, lon1, lat2, lon2)
        road_m = int(round(direct_m * 1.35))
        distance_row.append(road_m)
        # средняя городская скорость 20 км/ч + 10 секунд на парковку и подход к подъезду
        duration_row.append(int(round(road_m / 5.56)) + 10)
    durations_sec.append(duration_row)
    distances_m.append(distance_row)

hourly_factors = [
    {"hour": 0, "factor": 0.8}, {"hour": 1, "factor": 0.8}, {"hour": 2, "factor": 0.8},
    {"hour": 3, "factor": 0.8}, {"hour": 4, "factor": 0.85}, {"hour": 5, "factor": 0.9},
    {"hour": 6, "factor": 1.0}, {"hour": 7, "factor": 1.25}, {"hour": 8, "factor": 1.5},
    {"hour": 9, "factor": 1.4}, {"hour": 10, "factor": 1.2}, {"hour": 11, "factor": 1.1},
    {"hour": 12, "factor": 1.05}, {"hour": 13, "factor": 1.05}, {"hour": 14, "factor": 1.1},
    {"hour": 15, "factor": 1.15}, {"hour": 16, "factor": 1.25}, {"hour": 17, "factor": 1.45},
    {"hour": 18, "factor": 1.55}, {"hour": 19, "factor": 1.35}, {"hour": 20, "factor": 1.2},
    {"hour": 21, "factor": 1.0}, {"hour": 22, "factor": 0.9}, {"hour": 23, "factor": 0.85},
]

matrix = {
    "matrix_id": "ekb-2026-10-v1",
    "points": points,
    "durations_sec": durations_sec,
    "distances_m": distances_m,
    "hourly_factors": hourly_factors,
}
with open("data/travel_matrix.json", "w", encoding="utf-8") as f:
    json.dump(matrix, f, ensure_ascii=False, indent=2)

# -------------------------------------------------------------------- наряды

SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
REPAIR_COUNT = 32
DEGRADATION_COUNT = 12
COUNTS = {
    "INST_PON_MKD": 14,
    "INST_FTTB_MKD": 12,
    "INST_PRIVATE_VLS": 6,
    "ADD_SERVICE": 12,
    "SURVEY_PRIVATE": 6,
    "REPAIR": REPAIR_COUNT,
    "DEGRADATION": DEGRADATION_COUNT,
    "DISMANTLE": 6,
}

private_buildings = [b for b in buildings if b["building_type"] == "PRIVATE"]
mkd_buildings = [b for b in buildings if b["building_type"] == "MKD"]
vls_buildings = [b for b in private_buildings if b["overhead_line"]]


def choose_technology(building, technologies):
    available = [t for t in technologies if t in building_technology[building["building_id"]]]
    if not available:
        raise AssertionError(f"У дома {building['building_id']} нет технологии из {technologies}")
    return random.choice(available)


def choose_node(building, technology):
    node_id = node_ids_by_building_tech.get((building["building_id"], technology))
    if node_id is None:
        raise AssertionError(f"Дом {building['building_id']} не входит в узел технологии {technology}")
    return node_id


def equipment_for(work_type_code, technology):
    if work_type_code == "INST_PON_MKD":
        return {"ONT": 1, "ROUTER": 1, "STB": 1}
    if work_type_code == "INST_FTTB_MKD":
        return {"ONT": 0, "ROUTER": 1, "STB": 1}
    if work_type_code == "INST_PRIVATE_VLS":
        return {"ONT": 1 if technology == "PON" else 0, "ROUTER": 1, "STB": 1}
    if work_type_code == "ADD_SERVICE":
        return random.choice([
            {"ONT": 0, "ROUTER": 1, "STB": 0},
            {"ONT": 0, "ROUTER": 0, "STB": 1},
            {"ONT": 0, "ROUTER": 1, "STB": 1},
        ])
    return {"ONT": 0, "ROUTER": 0, "STB": 0}


def order_deadline(work_type_code, registered_at, is_repeat=False, slot_start=None):
    work_type = work_type_by_code[work_type_code]
    if work_type["deadline_kind"] == "SLOT":
        if slot_start is None:
            raise AssertionError(f"{work_type_code}: для срока SLOT нужен slot_start")
        slot_end = slot_start + timedelta(hours=2)
        latest_start = (min(slot_end, slot_start + timedelta(minutes=work_type["max_start_delay_min"]))
                        if work_type["max_start_delay_min"] is not None else slot_end)
        return latest_start + timedelta(minutes=work_type["duration_min"])
    if work_type["deadline_kind"] == "HOURS":
        hours = work_type["deadline_value"]
        if is_repeat and work_type["repeat_deadline_value"] is not None:
            hours = work_type["repeat_deadline_value"]
        return registered_at + timedelta(hours=hours)
    return add_working_days(registered_at, work_type["deadline_value"])


def choose_slot(work_type_code, registered_at, is_repeat=False, hours=None):
    work_type = work_type_by_code[work_type_code]
    candidates = list(hours if hours is not None else SLOT_HOURS)
    random.shuffle(candidates)
    for hour in candidates:
        slot_start = at(DAY, hour, 0)
        if slot_start < registered_at:
            continue
        slot_end = slot_start + timedelta(hours=2)
        latest_start = (min(slot_end, slot_start + timedelta(minutes=work_type["max_start_delay_min"]))
                        if work_type["max_start_delay_min"] is not None else slot_end)
        deadline = order_deadline(work_type_code, registered_at, is_repeat, slot_start)
        if latest_start + timedelta(minutes=work_type["duration_min"]) <= deadline:
            return slot_start
    raise AssertionError(f"{work_type_code}: нет слота, укладывающегося в срок для {iso(registered_at)}")


def make_order(work_type_code, building, technology, registered_at, slot_start, is_repeat=False,
               previous_order_id=None):
    work_type = work_type_by_code[work_type_code]
    slot_end = slot_start + timedelta(hours=2)
    if work_type["max_start_delay_min"] is not None:
        latest_start = min(slot_end, slot_start + timedelta(minutes=work_type["max_start_delay_min"]))
    else:
        latest_start = slot_end

    deadline = order_deadline(work_type_code, registered_at, is_repeat, slot_start)

    if latest_start + timedelta(minutes=work_type["duration_min"]) > deadline:
        raise AssertionError(
            f"{work_type_code}: latest_start + duration > deadline "
            f"({iso(latest_start)} + {work_type['duration_min']} > {iso(deadline)})"
        )

    return {
        "order_id": None,
        "work_type_code": work_type_code,
        "technology": technology,
        "building_id": building["building_id"],
        "address": building["address"],
        "lat": building["lat"],
        "lon": building["lon"],
        "building_type": building["building_type"],
        "requires_height": building["overhead_line"],
        "access_node_id": choose_node(building, technology),
        "registered_at": iso(registered_at),
        "slot": {"start": iso(slot_start), "end": iso(slot_end)},
        "latest_start": iso(latest_start),
        "deadline": iso(deadline),
        "required_equipment": equipment_for(work_type_code, technology),
        "is_repeat": is_repeat,
        "previous_order_id": previous_order_id,
    }


orders = []

# ---- ПГП: 4 узла, по 3–4 наряда на неисправность с интервалом внутри 60 минут.
pgp_nodes = [
    nodes_by_technology["PON"][0],
    nodes_by_technology["FTTB"][1],
    nodes_by_technology["XDSL"][2],
    nodes_by_technology["PON"][3],
]
pgp_cluster_sizes = [3, 3, 4, 3]
pgp_cluster_members = {}
cluster_work_types = ["REPAIR", "REPAIR", "DEGRADATION", "REPAIR"]
for node_index, (node, size) in enumerate(zip(pgp_nodes, pgp_cluster_sizes)):
    technology = node["technology"]
    node_buildings = node["buildings"][:size]
    base = at(DAY, 5 + node_index // 2, 10 + (node_index % 2) * 20)
    members = []
    for k, node_building in enumerate(node_buildings):
        building = building_by_id[node_building["building_id"]]
        work_type_code = cluster_work_types[(k + node_index) % len(cluster_work_types)]
        registered_at = base + timedelta(minutes=12 * k)
        if work_type_code == "REPAIR" and random.random() < 0.35:
            is_repeat = True
            previous_order_id = (f"ORD-{(DAY - timedelta(days=random.randint(3, 6))):%Y%m%d}-"
                                 f"{random.randint(1, 9999):04d}")
        else:
            is_repeat, previous_order_id = False, None
        slot_start = choose_slot(work_type_code, registered_at, is_repeat=is_repeat,
                                 hours=[10, 11, 12, 13, 14, 15])
        order = make_order(work_type_code, building, technology, registered_at, slot_start,
                           is_repeat=is_repeat, previous_order_id=previous_order_id)
        orders.append(order)
        members.append(order)
    pgp_cluster_members[node["access_node_id"]] = members

# ---- Остальные наряды 3ЛТП, кроме повторных обращений.
remaining_repair = REPAIR_COUNT - sum(
    1 for members in pgp_cluster_members.values() for o in members if o["work_type_code"] == "REPAIR")
remaining_degradation = DEGRADATION_COUNT - sum(
    1 for members in pgp_cluster_members.values() for o in members if o["work_type_code"] == "DEGRADATION")

non_pgp_nodes = [n for n in access_nodes if n["access_node_id"] not in pgp_cluster_members]
node_use_counter = {n["access_node_id"]: 0 for n in non_pgp_nodes}
pgp_times = {n["access_node_id"]: [] for n in access_nodes}
for members in pgp_cluster_members.values():
    for o in members:
        pgp_times[o["access_node_id"]].append(datetime.fromisoformat(o["registered_at"]))


def pick_non_pgp_node():
    node = min(non_pgp_nodes, key=lambda n: (node_use_counter[n["access_node_id"]],
                                             random.random()))
    node_use_counter[node["access_node_id"]] += 1
    return node


def free_registered_time(node_id, earliest, latest):
    """Подбирает время регистрации не ближе 125 минут к уже существующим на узле."""
    for _ in range(500):
        candidate = earliest + timedelta(minutes=random.randint(0, int((latest - earliest).total_seconds() // 60)))
        if all(abs((candidate - existing).total_seconds()) >= 125 * 60
               for existing in pgp_times[node_id]):
            pgp_times[node_id].append(candidate)
            return candidate
    # Детерминированный откат: ставим после последнего наряда узла.
    candidate = max([earliest] + pgp_times[node_id]) + timedelta(minutes=130)
    if candidate > latest:
        raise AssertionError(f"Не удалось разнести наряды по узлу {node_id}")
    pgp_times[node_id].append(candidate)
    return candidate


def order_for_repair(is_repeat):
    node = pick_non_pgp_node()
    building = building_by_id[random.choice(node["buildings"])["building_id"]]
    technology = node["technology"]
    if is_repeat:
        registered_at = free_registered_time(
            node["access_node_id"], at(DAY, 0, 0), at(DAY, 7, 0))
        previous_order_id = (f"ORD-{(DAY - timedelta(days=random.randint(3, 6))):%Y%m%d}-"
                             f"{random.randint(1, 9999):04d}")
    else:
        earliest = NOW - timedelta(hours=10)
        latest = NOW - timedelta(minutes=30)
        registered_at = free_registered_time(node["access_node_id"], earliest, latest)
        previous_order_id = None
    slot_start = choose_slot("REPAIR", registered_at, is_repeat=is_repeat)
    return make_order("REPAIR", building, technology, registered_at, slot_start,
                      is_repeat=is_repeat, previous_order_id=previous_order_id)


REPEAT_REPAIR_COUNT = 8
for _ in range(REPEAT_REPAIR_COUNT):
    orders.append(order_for_repair(True))
for _ in range(remaining_repair - REPEAT_REPAIR_COUNT):
    orders.append(order_for_repair(False))

for _ in range(remaining_degradation):
    node = pick_non_pgp_node()
    building = building_by_id[random.choice(node["buildings"])["building_id"]]
    technology = node["technology"]
    earliest = NOW - timedelta(hours=40)
    latest = NOW - timedelta(minutes=30)
    registered_at = free_registered_time(node["access_node_id"], earliest, latest)
    slot_start = choose_slot("DEGRADATION", registered_at)
    orders.append(make_order("DEGRADATION", building, technology, registered_at, slot_start))

# ---- Остальные типы работ.
for _ in range(COUNTS["DISMANTLE"]):
    building = random.choice(buildings)
    technology = choose_technology(building, ["PON", "FTTB", "XDSL", "DOCSIS"])
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)),
                       random.randint(9, 16), random.choice([0, 15, 30, 45]))
    slot_start = choose_slot("DISMANTLE", registered_at)
    orders.append(make_order("DISMANTLE", building, technology, registered_at, slot_start))

for _ in range(COUNTS["SURVEY_PRIVATE"]):
    building = random.choice(private_buildings)
    technology = choose_technology(building, ["PON", "FTTB", "XDSL"])
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)),
                       random.randint(9, 16), random.choice([0, 15, 30, 45]))
    slot_start = choose_slot("SURVEY_PRIVATE", registered_at)
    orders.append(make_order("SURVEY_PRIVATE", building, technology, registered_at, slot_start))

for _ in range(COUNTS["INST_PON_MKD"]):
    building = random.choice(mkd_buildings)
    if "PON" not in building_technology[building["building_id"]]:
        continue
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)),
                       random.randint(9, 17), random.choice([0, 15, 30, 45]))
    slot_start = choose_slot("INST_PON_MKD", registered_at)
    orders.append(make_order("INST_PON_MKD", building, "PON", registered_at, slot_start))

for _ in range(COUNTS["INST_FTTB_MKD"]):
    building = random.choice(mkd_buildings)
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)),
                       random.randint(9, 17), random.choice([0, 15, 30, 45]))
    slot_start = choose_slot("INST_FTTB_MKD", registered_at)
    orders.append(make_order("INST_FTTB_MKD", building, "FTTB", registered_at, slot_start))

for _ in range(COUNTS["INST_PRIVATE_VLS"]):
    building = random.choice(vls_buildings)
    technology = choose_technology(building, ["PON", "FTTB"])
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)),
                       random.randint(9, 16), random.choice([0, 15, 30, 45]))
    slot_start = choose_slot("INST_PRIVATE_VLS", registered_at, hours=[9, 10, 11, 12, 13, 14, 15, 16])
    orders.append(make_order("INST_PRIVATE_VLS", building, technology, registered_at, slot_start))

for _ in range(COUNTS["ADD_SERVICE"]):
    building = random.choice(buildings)
    technology = choose_technology(building, ["PON", "FTTB", "XDSL"])
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)),
                       random.randint(9, 17), random.choice([0, 15, 30, 45]))
    slot_start = choose_slot("ADD_SERVICE", registered_at)
    orders.append(make_order("ADD_SERVICE", building, technology, registered_at, slot_start))

# ---- Добираем до 100 нарядов, если часть инсталляций PON пропущена.
while len(orders) < 100:
    building = random.choice(mkd_buildings)
    registered_at = at(DAY - timedelta(days=random.randint(1, 3)), random.randint(9, 17), 0)
    slot_start = choose_slot("INST_FTTB_MKD", registered_at)
    orders.append(make_order("INST_FTTB_MKD", building, "FTTB", registered_at, slot_start))

# Порядок нарядов и идентификаторы.
random.shuffle(orders)
for index, order in enumerate(orders, start=1):
    order["order_id"] = f"ORD-{DAY:%Y%m%d}-{index:04d}"

# ------------------------------------------------------------------ проверки

assert len(work_types) == 8, "В справочнике должно быть 8 типов работ"
used_work_types = {o["work_type_code"] for o in orders}
assert used_work_types == set(work_type_by_code), f"Использованы не все типы работ: {used_work_types}"

order_ids = [o["order_id"] for o in orders]
assert len(order_ids) == len(set(order_ids)) == 100

staff_by_profile_tech = {}
for employee in staff:
    for profile in employee["profiles"]:
        for technology in employee["technologies"]:
            staff_by_profile_tech.setdefault((profile, technology), []).append(employee)

technology_by_building = building_technology

for order in orders:
    work_type = work_type_by_code[order["work_type_code"]]
    building = building_by_id[order["building_id"]]
    node = node_by_id[order["access_node_id"]]

    assert order["technology"] in technology_by_building[order["building_id"]]
    assert node["technology"] == order["technology"]
    assert order["building_id"] in {b["building_id"] for b in node["buildings"]}
    assert order["address"] == building["address"]
    assert order["lat"] == building["lat"] and order["lon"] == building["lon"]
    assert order["building_type"] == building["building_type"]
    assert order["requires_height"] == building["overhead_line"]
    assert order["building_type"] == "MKD" or order["technology"] in ("PON", "FTTB")

    registered_at = datetime.fromisoformat(order["registered_at"])
    slot_start = datetime.fromisoformat(order["slot"]["start"])
    slot_end = datetime.fromisoformat(order["slot"]["end"])
    latest_start = datetime.fromisoformat(order["latest_start"])
    deadline = datetime.fromisoformat(order["deadline"])

    assert registered_at <= NOW, f"{order['order_id']}: registered_at позже now"
    assert slot_end - slot_start == timedelta(hours=2)
    assert slot_start.date() == DAY

    expected_latest = (min(slot_end, slot_start + timedelta(minutes=work_type["max_start_delay_min"]))
                       if work_type["max_start_delay_min"] is not None else slot_end)
    assert latest_start == expected_latest, f"{order['order_id']}: latest_start"

    if work_type["deadline_kind"] == "SLOT":
        assert deadline == latest_start + timedelta(minutes=work_type["duration_min"])
    elif work_type["deadline_kind"] == "HOURS":
        hours = work_type["deadline_value"]
        if order["is_repeat"] and work_type["repeat_deadline_value"] is not None:
            hours = work_type["repeat_deadline_value"]
        assert deadline == registered_at + timedelta(hours=hours)
    else:
        assert deadline == add_working_days(registered_at, work_type["deadline_value"])

    assert latest_start + timedelta(minutes=work_type["duration_min"]) <= deadline

    for profile in work_type["profiles"]:
        assert staff_by_profile_tech.get((profile, order["technology"])), (
            f"{order['order_id']}: нет сотрудника {profile}/{order['technology']}")
    matching_staff = [
        e for e in staff
        if set(e["profiles"]) & set(work_type["profiles"])
        and order["technology"] in e["technologies"]
        and (not order["requires_height"] or e["height_permit"])
    ]
    assert matching_staff, f"{order['order_id']}: нет подходящего сотрудника"

    # Хотя бы одна смена должна вмещать визит при худшем допустимом старте.
    def shift_bounds(employee):
        return (
            datetime.combine(DAY, time.fromisoformat(employee["shift"]["start"]), tzinfo=TZ),
            datetime.combine(DAY, time.fromisoformat(employee["shift"]["end"]), tzinfo=TZ),
        )

    visit_duration = timedelta(minutes=work_type["duration_min"])
    assert any(
        max(slot_start, shift_bounds(e)[0]) <= latest_start
        and max(slot_start, shift_bounds(e)[0]) + visit_duration <= shift_bounds(e)[1]
        for e in matching_staff
    ), f"{order['order_id']}: визит не помещается ни в одну смену"

    if order["is_repeat"]:
        assert order["previous_order_id"] and order["previous_order_id"] != order["order_id"]
        assert re.fullmatch(r"ORD-\d{8}-\d{4}", order["previous_order_id"])
        previous_date = datetime.strptime(order["previous_order_id"][4:12], "%Y%m%d").replace(tzinfo=TZ)
        assert timedelta(0) < registered_at - previous_date <= timedelta(days=7)
        assert work_type["repeat_deadline_value"] is not None
    else:
        assert order["previous_order_id"] is None

    equipment = order["required_equipment"]
    assert all(isinstance(v, int) and v >= 0 for v in equipment.values())
    if order["work_type_code"] in ("REPAIR", "DEGRADATION", "DISMANTLE", "SURVEY_PRIVATE"):
        assert equipment == {"ONT": 0, "ROUTER": 0, "STB": 0}
    if order["work_type_code"] == "INST_FTTB_MKD":
        assert equipment["ONT"] == 0
    if order["work_type_code"] == "INST_PON_MKD":
        assert equipment["ONT"] == 1

# ПГП: 3+ наряда на неисправность с одного узла за 60 минут.
# Кроме заложенных инцидентов случайных совпадений быть не должно.
pgp_relevant = {"REPAIR", "DEGRADATION"}
by_node = {}
for order in orders:
    if order["work_type_code"] in pgp_relevant:
        by_node.setdefault(order["access_node_id"], []).append(order)

for node_id, node_orders in by_node.items():
    node_orders.sort(key=lambda o: o["registered_at"])
    times = [datetime.fromisoformat(o["registered_at"]) for o in node_orders]
    cluster_ids = {o["order_id"] for o in pgp_cluster_members.get(node_id, [])}
    for i in range(len(node_orders) - 2):
        span = times[i + 2] - times[i]
        triple = {node_orders[i]["order_id"], node_orders[i + 1]["order_id"], node_orders[i + 2]["order_id"]}
        if span <= timedelta(minutes=60):
            assert node_id in pgp_cluster_members, f"Случайный ПГП на узле {node_id}"
            assert triple <= cluster_ids, f"ПГП на узле {node_id} смешался с обычными нарядами"
        # Бэкенд группирует по окну 120 минут — там тоже не должно быть лишних групп.
        if span <= timedelta(minutes=120):
            assert node_id in pgp_cluster_members, f"Лишняя группа (120 мин) на узле {node_id}"
            assert triple <= cluster_ids, f"Лишняя группа (120 мин) на узле {node_id}"

day_input = {
    "date": DAY.isoformat(),
    "now": iso(NOW),
    "orders": orders,
    "absent_staff_ids": ["ST-017", "ST-034"],
}
with open("data/day_2026-10-26.json", "w", encoding="utf-8") as f:
    json.dump(day_input, f, ensure_ascii=False, indent=2)

print("reference.json:", len(service_centers), "СЦ,", len(staff), "сотрудников,",
      len(access_nodes), "узлов,", len(buildings), "домов,", len(work_types), "типов работ")
print("travel_matrix.json:", len(points), "точек")
print("day_2026-10-26.json:", len(orders), "нарядов;",
      "ПГП-узлов:", len(pgp_cluster_members),
      "нарядов в ПГП:", sum(len(v) for v in pgp_cluster_members.values()))
