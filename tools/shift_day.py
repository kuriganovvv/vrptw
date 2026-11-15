"""Делает копии дня 2026-10-26 на следующие даты, сдвигая все отметки времени.

Нужно для демо переключения дней: справочники и матрица общие, меняется только день.
Использование: py -3 tools/shift_day.py 2026-10-27 1
"""

import json
import random
import sys
from datetime import date, datetime, timedelta

ISO_FIELDS = ("start", "end", "latest_start", "deadline", "registered_at")


def shift_iso(value: str, delta: timedelta, new_date: date) -> str:
    moment = datetime.fromisoformat(value) + delta
    # Дата в пути и в теле наряда должна совпадать с днём файла.
    if moment.date() != new_date and value.endswith("+05:00"):
        pass
    return moment.isoformat()


def main() -> None:
    target = date.fromisoformat(sys.argv[1])
    days = int(sys.argv[2])
    source = date.fromisoformat("2026-10-26")
    delta = timedelta(days=days)

    with open(f"data/day_{source.isoformat()}.json", encoding="utf-8") as handle:
        payload = json.load(handle)

    payload["date"] = target.isoformat()
    payload["now"] = shift_iso(payload["now"], delta, target)

    for order in payload["orders"]:
        order["order_id"] = order["order_id"].replace(
            source.strftime("%Y%m%d"), target.strftime("%Y%m%d")
        )
        if order.get("previous_order_id"):
            order["previous_order_id"] = order["previous_order_id"].replace(
                source.strftime("%Y%m%d"), target.strftime("%Y%m%d")
            )
        for field in ISO_FIELDS:
            if order.get(field):
                order[field] = shift_iso(order[field], delta, target)
        slot = order.get("slot") or {}
        for field in ("start", "end"):
            if slot.get(field):
                slot[field] = shift_iso(slot[field], delta, target)

    if days:
        # Одинаковые адреса во все дни выглядят как копия дня: переставляем точки
        # между нарядами одного типа работы и технологии. Сроки и слоты не трогаем.
        groups: dict[tuple[str, str], list[dict]] = {}
        for order in payload["orders"]:
            key = (order["work_type_code"], order["technology"])
            groups.setdefault(key, []).append(order)
        rng = random.Random(20261026 + days)
        for members in groups.values():
            if len(members) < 2:
                continue
            spots = [
                {
                    field: member[field]
                    for field in (
                        "building_id",
                        "address",
                        "lat",
                        "lon",
                        "building_type",
                        "requires_height",
                        "access_node_id",
                    )
                }
                for member in members
            ]
            shift_by = 1 + rng.randrange(len(spots) - 1)
            rotated = spots[shift_by:] + spots[:shift_by]
            for member, spot in zip(members, rotated):
                member.update(spot)

    path = f"data/day_{target.isoformat()}.json"
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    print(f"{path}: {len(payload['orders'])} нарядов, now={payload['now']}")


if __name__ == "__main__":
    main()
