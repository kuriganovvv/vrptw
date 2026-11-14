import json
import random
from datetime import datetime, timedelta


service_centers = [
    {"service_center_id": "SC-01", "name": "СЦ «Север»", "address": "ул. Победы, 30", "lat": 56.8941, "lon": 60.6105, "opening_hours": {"open": "08:00", "close": "21:00"}, "restock_duration_min": 15}
]

staff = [
    {"staff_id": "ST-001", "display_name": "Монтажник 001", "service_center_id": "SC-01", "profiles": ["LTP3"], "technologies": ["PON", "FTTB"], "height_permit": False, "shift": {"start": "09:00", "end": "18:00", "break_duration_min": 60, "break_window": {"from": "12:00", "to": "15:00"}}, "equipment_start": {"ONT": 3, "ROUTER": 4, "STB": 2}, "equipment_capacity": {"ONT": 6, "ROUTER": 6, "STB": 4}}
]

access_nodes = [
    {"access_node_id": "AN-0031", "node_type": "OLT", "technology": "PON", "name": "OLT Пионерский", "address": "ул. Учителей, 22", "lat": 56.8698, "lon": 60.6510, "buildings": [
        {"building_id": "B-00412", "address": "ул. Учителей, 18", "lat": 56.8712, "lon": 60.6531, "building_type": "MKD", "overhead_line": False}
    ]}
]

work_types = [
    {"code": "REPAIR", "name": "Устранение неисправности", "profiles": ["LTP3"], "duration_min": 60, "max_start_delay_min": None, "deadline_kind": "HOURS", "deadline_value": 24, "repeat_deadline_value": 12, "pgp_relevant": True}
]

reference = {"service_centers": service_centers, "staff": staff, "access_nodes": access_nodes, "work_types": work_types}

with open('data/reference.json', 'w', encoding='utf-8') as f:
    json.dump(reference, f, ensure_ascii=False, indent=2)


points = ["SC-01", "B-00412"]

durations_sec = [[0 if i==j else random.randint(600, 1800) for j in range(len(points))] for i in range(len(points))]
distances_m = [[0 if i==j else random.randint(1000, 10000) for j in range(len(points))] for i in range(len(points))]

matrix = {"matrix_id": "mock-v1", "points": points, "durations_sec": durations_sec, "distances_m": distances_m, "hourly_factors": []}
with open('data/travel_matrix.json', 'w', encoding='utf-8') as f:
    json.dump(matrix, f, ensure_ascii=False, indent=2)

# 3. Заказы (DayInput)
orders = [
    {
        "order_id": "ORD-20261026-0001",
        "work_type_code": "REPAIR",
        "technology": "PON",
        "building_id": "B-00412",
        "address": "ул. Учителей, 18",
        "lat": 56.8712,
        "lon": 60.6531,
        "building_type": "MKD",
        "requires_height": False,
        "access_node_id": "AN-0031",
        "registered_at": "2026-10-26T08:00:00+05:00",
        "slot": {"start": "2026-10-26T09:00:00+05:00", "end": "2026-10-26T11:00:00+05:00"},
        "latest_start": "2026-10-26T11:00:00+05:00",
        "deadline": "2026-10-26T18:40:00+05:00",
        "required_equipment": {"ONT": 1, "ROUTER": 0, "STB": 0},
        "is_repeat": False,
        "previous_order_id": None
    }
]

day_input = {"date": "2026-10-26", "now": "2026-10-26T08:30:00+05:00", "orders": orders, "absent_staff_ids": []}
with open('data/day_2026-10-26.json', 'w', encoding='utf-8') as f:
    json.dump(day_input, f, ensure_ascii=False, indent=2)

print("Мок-данные сгенерированы в папку data/")