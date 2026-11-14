import json
import random
import os

# Создаем папку data, если ее нет
os.makedirs('data', exist_ok=True)

# 1. Справочники (Reference)
print("Генерация справочников...")
service_centers = [
    {"service_center_id": f"SC-0{i}", "name": f"СЦ «Район {i}»", "address": f"ул. Ленина, {i*10}", "lat": 56.8 + i*0.01, "lon": 60.6 + i*0.01, "opening_hours": {"open": "08:00", "close": "21:00"}, "restock_duration_min": 15} 
    for i in range(1, 6)
]

staff = []
for i in range(1, 41):
    is_install = i > 28 # 12 инсталляторов, 28 ЛТП
    profile = "INSTALL" if is_install else "LTP3"
    is_evening = i % 2 == 0
    shift = {
        "start": "12:00" if is_evening else "09:00", 
        "end": "21:00" if is_evening else "18:00", 
        "break_duration_min": 60, 
        "break_window": {"from": "16:00" if is_evening else "12:00", "to": "19:00" if is_evening else "15:00"}
    }
    staff.append({
        "staff_id": f"ST-{i:03d}", 
        "display_name": f"Сотрудник {i}", 
        "service_center_id": f"SC-0{(i % 5) + 1}", 
        "profiles": [profile], 
        "technologies": ["PON", "FTTB"] if is_install else ["PON", "FTTB", "XDSL"], 
        "height_permit": i % 3 == 0, # Каждый 3-й имеет допуск к высоте
        "shift": shift, 
        "equipment_start": {"ONT": 4, "ROUTER": 4, "STB": 3}, 
        "equipment_capacity": {"ONT": 8, "ROUTER": 8, "STB": 5}
    })

access_nodes = []
buildings = []
for i in range(1, 51): # 50 домов
    b_id = f"B-{i:05d}"
    b_type = "PRIVATE" if i % 5 == 0 else "MKD"
    has_vls = b_type == "PRIVATE"
    # Случайные координаты вокруг Екатеринбурга
    lat = 56.80 + random.uniform(0, 0.15)
    lon = 60.55 + random.uniform(0, 0.15)
    
    buildings.append({
        "building_id": b_id, 
        "address": f"ул. Тестовая, {i}", 
        "lat": lat, 
        "lon": lon, 
        "building_type": b_type, 
        "overhead_line": has_vls
    })
    
    # Создаем узлы доступа (несколько домов на узел)
    if i % 10 == 1:
        access_nodes.append({
            "access_node_id": f"AN-{len(access_nodes)+1:04d}", 
            "node_type": "OLT", 
            "technology": "PON", 
            "name": f"OLT-{len(access_nodes)+1}", 
            "address": f"ул. Тестовая, {i}а", 
            "lat": lat, 
            "lon": lon, 
            "buildings": []
        })
    # Привязываем дом к последнему узлу
    access_nodes[-1]["buildings"].append(buildings[-1])

# Типы работ строго из ТЗ
work_types = [
    {"code": "REPAIR", "name": "Устранение неисправности", "profiles": ["LTP3"], "duration_min": 60, "max_start_delay_min": None, "deadline_kind": "HOURS", "deadline_value": 24, "repeat_deadline_value": 12, "pgp_relevant": True},
    {"code": "DEGRADATION", "name": "Устранение деградации", "profiles": ["LTP3"], "duration_min": 45, "max_start_delay_min": None, "deadline_kind": "HOURS", "deadline_value": 48, "repeat_deadline_value": None, "pgp_relevant": True},
    {"code": "DISMANTLE", "name": "Демонтаж АО", "profiles": ["LTP3"], "duration_min": 30, "max_start_delay_min": None, "deadline_kind": "WORKING_DAYS", "deadline_value": 5, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "INST_PON_MKD", "name": "Инсталляция PON", "profiles": ["INSTALL"], "duration_min": 90, "max_start_delay_min": 10, "deadline_kind": "WORKING_DAYS", "deadline_value": 3, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "INST_FTTB_MKD", "name": "Инсталляция FTTB", "profiles": ["INSTALL"], "duration_min": 60, "max_start_delay_min": 10, "deadline_kind": "WORKING_DAYS", "deadline_value": 3, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "INST_PRIVATE_VLS", "name": "Инсталляция ВЛС", "profiles": ["INSTALL"], "duration_min": 180, "max_start_delay_min": 10, "deadline_kind": "WORKING_DAYS", "deadline_value": 5, "repeat_deadline_value": None, "pgp_relevant": False},
    {"code": "ADD_SERVICE", "name": "Доподключение услуги", "profiles": ["INSTALL"], "duration_min": 40, "max_start_delay_min": 10, "deadline_kind": "SLOT", "deadline_value": None, "repeat_deadline_value": None, "pgp_relevant": False}
]

reference = {"service_centers": service_centers, "staff": staff, "access_nodes": access_nodes, "work_types": work_types}
with open('data/reference.json', 'w', encoding='utf-8') as f:
    json.dump(reference, f, ensure_ascii=False, indent=2)

# 2. Матрица
print("Генерация матрицы...")
points = [sc["service_center_id"] for sc in service_centers] + [b["building_id"] for b in buildings]
N = len(points)
durations_sec = [[0 if i==j else random.randint(300, 1800) for j in range(N)] for i in range(N)]
distances_m = [[0 if i==j else random.randint(500, 10000) for j in range(N)] for i in range(N)]

matrix = {"matrix_id": "mock-v1", "points": points, "durations_sec": durations_sec, "distances_m": distances_m, "hourly_factors": []}
with open('data/travel_matrix.json', 'w', encoding='utf-8') as f:
    json.dump(matrix, f, ensure_ascii=False, indent=2)

# 3. Заказы (DayInput) - 100 заявок
print("Генерация 100 заявок...")
orders = []
pgp_nodes = [an["access_node_id"] for an in access_nodes[:2]] # Выберем 2 узла для ПГП

for i in range(1, 101):
    b = random.choice(buildings)
    an = next((an for an in access_nodes if b in an["buildings"]), access_nodes[0])
    
    if b["building_type"] == "PRIVATE":
        wt = "INST_PRIVATE_VLS"
    else:
        wt = random.choice(["REPAIR", "INST_PON_MKD", "INST_FTTB_MKD", "ADD_SERVICE", "DEGRADATION"])
    
    # Для ПГП: если узел выбран, генерируем REPAIR с вероятностью 80%
    if an["access_node_id"] in pgp_nodes and random.random() < 0.8:
        wt = "REPAIR"

    start_hour = random.randint(9, 18)
    slot_start = f"2026-10-26T{start_hour:02d}:00:00+05:00"
    
    # Норматив из справочника
    wt_info = next(w for w in work_types if w["code"] == wt)
    
    orders.append({
        "order_id": f"ORD-20261026-{i:04d}",
        "work_type_code": wt,
        "technology": random.choice(["PON", "FTTB"]),
        "building_id": b["building_id"],
        "address": b["address"],
        "lat": b["lat"],
        "lon": b["lon"],
        "building_type": b["building_type"],
        "requires_height": b["overhead_line"],
        "access_node_id": an["access_node_id"],
        "registered_at": "2026-10-26T07:00:00+05:00",
        "slot": {"start": slot_start, "end": f"2026-10-26T{start_hour+2:02d}:00:00+05:00"},
        "latest_start": slot_start,
        "deadline": "2026-10-27T12:00:00+05:00",
        "required_equipment": {"ONT": 1 if wt.startswith("INST") else 0, "ROUTER": 1, "STB": 1},
        "is_repeat": i % 10 == 0, # Каждая 10-я - повторная
        "previous_order_id": None
    })

day_input = {"date": "2026-10-26", "now": "2026-10-26T08:30:00+05:00", "orders": orders, "absent_staff_ids": []}
with open('data/day_2026-10-26.json', 'w', encoding='utf-8') as f:
    json.dump(day_input, f, ensure_ascii=False, indent=2)

print("Готово!")