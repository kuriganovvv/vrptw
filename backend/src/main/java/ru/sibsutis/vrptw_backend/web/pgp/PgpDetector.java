package ru.sibsutis.vrptw_backend.web.pgp;

import java.time.Duration;
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

    @Value("${dispatch.pgp.window-minutes:120}")
    private long windowMinutes;

    public record Result(List<PgpGroup> groups, List<Order> plannedOrders) {
    }

    public Result detect(DayInput day, ReferenceData reference) {
        Set<String> pgpCodes = reference.workTypes() == null ? Set.of()
                : reference.workTypes().stream().filter(WorkType::pgpRelevant)
                        .map(WorkType::code).collect(Collectors.toSet());
        List<Order> orders = day.orders() == null ? List.of() : day.orders();

        Map<String, List<Order>> byNode = new LinkedHashMap<>();
        for (Order order : orders) {
            if (order.accessNodeId() != null && order.registeredAt() != null
                    && pgpCodes.contains(order.workTypeCode())) {
                byNode.computeIfAbsent(order.accessNodeId(), key -> new ArrayList<>()).add(order);
            }
        }

        List<PgpGroup> groups = new ArrayList<>();
        Set<String> groupedIds = new LinkedHashSet<>();
        for (var entry : byNode.entrySet()) {
            List<Order> sorted = entry.getValue();
            sorted.sort(Comparator.comparing(Order::registeredAt));
            List<Order> cluster = new ArrayList<>();
            for (Order order : sorted) {
                if (!cluster.isEmpty() && Duration.between(cluster.get(0).registeredAt(),
                        order.registeredAt()).toMinutes() > windowMinutes) {
                    flush(entry.getKey(), cluster, day, groups, groupedIds);
                    cluster = new ArrayList<>();
                }
                cluster.add(order);
            }
            flush(entry.getKey(), cluster, day, groups, groupedIds);
        }

        List<Order> planned = orders.stream().filter(o -> !groupedIds.contains(o.orderId())).toList();
        return new Result(groups, planned);
    }

    private void flush(String nodeId, List<Order> cluster, DayInput day,
                       List<PgpGroup> groups, Set<String> groupedIds) {
        if (cluster.size() < minOrders) {
            return;
        }
        List<String> ids = cluster.stream().map(Order::orderId).toList();
        groups.add(new PgpGroup("PGP-" + day.date() + "-" + nodeId, nodeId, ids, day.now(),
                "TRANSFER_TO_STATION", 
                "Подозрение на ПГП: " + cluster.size() + " наряд(ов) с узла за " + windowMinutes + " мин"));
        groupedIds.addAll(ids);
    }
}