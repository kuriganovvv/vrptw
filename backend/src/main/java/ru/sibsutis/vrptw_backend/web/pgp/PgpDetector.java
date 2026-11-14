package ru.sibsutis.vrptw_backend.web.pgp;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import ru.sibsutis.vrptw_backend.dto.day.DayInput;
import ru.sibsutis.vrptw_backend.dto.day.Order;
import ru.sibsutis.vrptw_backend.dto.plan.PgpGroup;
import ru.sibsutis.vrptw_backend.dto.reference.ReferenceData;
import ru.sibsutis.vrptw_backend.dto.reference.WorkType;

@Component
public class PgpDetector {

    @Value("${dispatch.pgp.min-orders:3}")
    private int minOrders;
    @Value("${dispatch.pgp.window-minutes:60}")
    private long windowMinutes;

    public record Result(List<PgpGroup> groups, List<Order> plannedOrders) { }

    public Result detect(DayInput day, ReferenceData ref, OffsetDateTime detectedAt, Set<String> startedOrderIds) {
        Set<String> codes = ref.workTypes() == null ? Set.of() : ref.workTypes().stream()
                .filter(WorkType::pgpRelevant).map(WorkType::code).collect(Collectors.toSet());
        List<Order> orders = day.orders() == null ? List.of() : day.orders();
        Map<String, List<Order>> byNode = new LinkedHashMap<>();
        for (Order o : orders) {
            if (o.accessNodeId() != null && o.registeredAt() != null && codes.contains(o.workTypeCode())
                    && !startedOrderIds.contains(o.orderId())) {
                byNode.computeIfAbsent(o.accessNodeId(), k -> new ArrayList<>()).add(o);
            }
        }
        List<PgpGroup> groups = new ArrayList<>();
        Set<String> grouped = new LinkedHashSet<>();
        for (var e : byNode.entrySet()) {
            List<Order> sorted = e.getValue();
            sorted.sort(Comparator.comparing(Order::registeredAt));
            List<Order> cluster = new ArrayList<>();
            for (Order o : sorted) {
                if (!cluster.isEmpty() && Duration.between(cluster.get(0).registeredAt(), o.registeredAt()).toMinutes() > windowMinutes) {
                    flush(e.getKey(), cluster, detectedAt, groups, grouped);
                    cluster = new ArrayList<>();
                }
                cluster.add(o);
            }
            flush(e.getKey(), cluster, detectedAt, groups, grouped);
        }
        List<Order> planned = orders.stream().filter(o -> !grouped.contains(o.orderId())).toList();
        return new Result(groups, planned);
    }

    private void flush(String node, List<Order> cluster, OffsetDateTime at, List<PgpGroup> groups, Set<String> grouped) {
        if (cluster.size() < minOrders) return;
        List<String> ids = cluster.stream().map(Order::orderId).toList();
        groups.add(new PgpGroup("PGP-" + at.toLocalDate() + "-" + node, node, ids, at,
                "TRANSFER_TO_STATION", "Подозрение на ПГП: " + cluster.size() + " наряд(ов) с узла за " + windowMinutes + " мин"));
        grouped.addAll(ids);
    }
}