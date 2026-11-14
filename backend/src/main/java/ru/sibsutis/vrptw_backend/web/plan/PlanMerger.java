package ru.sibsutis.vrptw_backend.web.plan;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

import org.springframework.stereotype.Component;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.*;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;

@Component
public class PlanMerger {

    public Plan merge(Plan fresh, Map<String, List<Stop>> prefix, ReferenceData ref, OffsetDateTime now) {
        if (prefix.isEmpty()) return fresh;
        List<Route> routes = new ArrayList<>();
        for (Route r : fresh.routes()) {
            List<Stop> pre = prefix.getOrDefault(r.staffId(), List.of());
            if (pre.isEmpty()) { routes.add(r); continue; }
            List<Stop> stops = new ArrayList<>(pre);
            for (Stop s : r.stops()) if (!"DEPOT_START".equals(s.type())) stops.add(s);
            routes.add(new Route(r.staffId(), r.serviceCenterId(), r.status(), r.unavailableFrom(), r.unavailableUntil(),
                    reseq(stops), totals(stops, ref, r.staffId(), now)));
        }
        return new Plan(fresh.date(), fresh.planVersion(), fresh.basedOnEventId(), now, fresh.computationMs(),
                routes, fresh.unassigned(), fresh.pgpGroups(), fresh.cancelled(), fresh.alerts(), fresh.summary());
    }

    public Plan withAlerts(Plan plan, List<Alert> existing, DayInput day, OffsetDateTime now) {
        Map<String, Order> orders = new HashMap<>();
        if (day.orders() != null) day.orders().forEach(o -> orders.put(o.orderId(), o));
        List<Alert> alerts = new ArrayList<>(existing);
        Set<String> lateNow = new HashSet<>();
        for (Route r : plan.routes()) for (Stop s : r.stops()) {
            if (!"VISIT".equals(s.type()) || s.orderId() == null) continue;
            Order o = orders.get(s.orderId());
            if (o == null || s.start() == null || o.latestStart() == null) continue;
            if (s.start().isAfter(o.latestStart())) {
                lateNow.add(s.orderId());
                boolean has = alerts.stream().anyMatch(a -> s.orderId().equals(a.orderId()) && "ACTIVE".equals(a.status()));
                if (!has) alerts.add(new Alert("AL-" + s.orderId(), min(now, o.slot().start().minusMinutes(30)),
                        "LATE_RISK", "ACTIVE", null, s.orderId(), null, r.staffId(), s.start(),
                        (int) Duration.between(o.latestStart(), s.start()).toMinutes(), "REASSIGN", null, null, false,
                        "Прогноз начала позже latest_start"));
            }
        }
        List<Alert> resolved = new ArrayList<>();
        for (Alert a : alerts) {
            if ("ACTIVE".equals(a.status()) && a.orderId() != null && !lateNow.contains(a.orderId()))
                resolved.add(new Alert(a.alertId(), a.createdAt(), a.type(), "RESOLVED", now, a.orderId(), a.groupId(),
                        a.staffId(), a.forecastStart(), a.latenessMin(), a.suggestedAction(), a.suggestedStaffId(), a.proposedSlot(), a.applied(), a.message()));
            else resolved.add(a);
        }
        int lateCount = (int) resolved.stream().filter(a -> "ACTIVE".equals(a.status())).count();
        PlanSummary s = plan.summary();
        PlanSummary sum = new PlanSummary(s.ordersTotal(), s.visitsPlanned(), s.unassigned(), s.pgpOrders(),
                plan.cancelled().size(), s.travelSecTotal(), s.utilizationCv());
        return new Plan(plan.date(), plan.planVersion(), plan.basedOnEventId(), plan.asOf(), plan.computationMs(),
                plan.routes(), plan.unassigned(), plan.pgpGroups(), plan.cancelled(), resolved, sum);
    }

    private static OffsetDateTime min(OffsetDateTime a, OffsetDateTime b) { return a.isBefore(b) ? a : b; }

    private static List<Stop> reseq(List<Stop> stops) {
        List<Stop> out = new ArrayList<>();
        int i = 1;
        for (Stop s : stops) out.add(new Stop(i++, s.type(), s.locationId(), s.orderId(), s.arrival(), s.start(), s.end(),
                s.travelSec(), s.distanceM(), s.status(), s.equipmentAfter(), s.explanation()));
        return out;
    }

    private static RouteTotals totals(List<Stop> stops, ReferenceData ref, String staffId, OffsetDateTime now) {
        long travel = 0, dist = 0; int work = 0, visits = 0;
        for (Stop s : stops) {
            travel += s.travelSec() == null ? 0 : s.travelSec();
            dist += s.distanceM() == null ? 0 : s.distanceM();
            if ("VISIT".equals(s.type())) { visits++; work += (int) Duration.between(s.start(), s.end()).toMinutes(); }
        }
        long shiftSec = 8 * 3600;
        for (var st : ref.staff()) if (st.staffId().equals(staffId) && st.shift() != null)
            shiftSec = Duration.between(st.shift().start(), st.shift().end()).getSeconds();
        double util = shiftSec <= 0 ? 0 : (work * 60.0 + travel) / shiftSec;
        return new RouteTotals(visits, travel, dist, work, util);
    }
}