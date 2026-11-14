#!/usr/bin/env bash
BASE=http://localhost:8080/api/v1
FIX=src/test/resources/fixtures
ok=0; bad=0
expect() { if [[ "$3" == *"$2"* ]]; then echo "PASS $1"; ok=$((ok+1));
           else echo "FAIL $1 (ждал '$2', получил: ${3:0:200})"; bad=$((bad+1)); fi; }
code() { curl -s -o /tmp/vrptw-body -w '%{http_code}' "$@"; }

python3 - <<'EOF'
import json
p = ["SC-01","B-00001","B-00002","B-00003","B-00004","B-00005"]; n = len(p)
d = [[0 if i==j else (600 if i==0 or j==0 else 300) for j in range(n)] for i in range(n)]
m = [[0 if i==j else (4000 if i==0 or j==0 else 1500) for j in range(n)] for i in range(n)]
json.dump({"matrix_id":"smoke","points":p,"durations_sec":d,"distances_m":m,"hourly_factors":[]},
          open("/tmp/vrptw-matrix.json","w"))
EOF

expect "health"            '"status":"ok"'        "$(curl -s $BASE/health)"
expect "PUT reference"     '"staff":1'            "$(curl -s -X PUT $BASE/reference -H 'Content-Type: application/json' --data-binary @$FIX/reference-one-staff.json)"
expect "PUT matrix"        '"points":6'           "$(curl -s -X PUT $BASE/travel-matrix -H 'Content-Type: application/json' --data-binary @/tmp/vrptw-matrix.json)"
expect "PUT day"           '"orders":5'           "$(curl -s -X PUT $BASE/days/2026-10-26 -H 'Content-Type: application/json' --data-binary @$FIX/day-five-orders.json)"

PLAN=$(curl -s -X POST $BASE/days/2026-10-26/plan)
expect "POST plan version" '"plan_version":1'     "$PLAN"
expect "POST plan 5 visits" '"visits_planned":5'  "$PLAN"
expect "POST plan no pgp"  '"pgp_orders":0'       "$PLAN"
expect "offset +05:00"     '+05:00'               "$PLAN"
expect "GET plan"          '"plan_version":1'     "$(curl -s $BASE/days/2026-10-26/plan)"

EV='{"event_id":"EV-SMOKE-1","type":"TIME_TICK","timestamp":"2026-10-26T11:15:00+05:00"}'
expect "event accepted"    '"duplicate":false'    "$(curl -s -X POST $BASE/days/2026-10-26/events -H 'Content-Type: application/json' -d "$EV")"
expect "event duplicate"   '"duplicate":true'     "$(curl -s -X POST $BASE/days/2026-10-26/events -H 'Content-Type: application/json' -d "$EV")"
expect "event plan_ver"    '"plan_version":1'     "$(curl -s -X POST $BASE/days/2026-10-26/events -H 'Content-Type: application/json' -d "$EV")"

expect "404 unknown day"   '404' "$(code $BASE/days/2026-01-01/plan)"
expect "404 code"          '"code":"NOT_FOUND"'   "$(cat /tmp/vrptw-body)"
expect "400 bad date"      '400' "$(code -X PUT $BASE/days/not-a-date -H 'Content-Type: application/json' -d '{}')"
expect "400 date mismatch" '400' "$(code -X PUT $BASE/days/2026-10-27 -H 'Content-Type: application/json' --data-binary @$FIX/day-five-orders.json)"
expect "400 event no id"   '400' "$(code -X POST $BASE/days/2026-10-26/events -H 'Content-Type: application/json' -d '{"type":"TIME_TICK","timestamp":"2026-10-26T11:15:00+05:00"}')"
expect "404 unknown path"  '404' "$(code $BASE/nope)"
expect "404 path code"     '"code":"NOT_FOUND"'   "$(cat /tmp/vrptw-body)"

echo "----"
echo "PASS=$ok FAIL=$bad"
[ "$bad" -eq 0 ]