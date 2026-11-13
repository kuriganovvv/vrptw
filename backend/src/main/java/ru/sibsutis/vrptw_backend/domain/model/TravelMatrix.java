package ru.sibsutis.vrptw_backend.domain.model;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TravelMatrix {

    private final String matrixId;
    private final List<String> points;
    private final int[][] durationsSec;
    private final int[][] distancesM;
    private final Map<String, Integer> indexByPoint;

    public TravelMatrix(String matrixId, List<String> points, int[][] durationsSec, int[][] distancesM) {
        this.matrixId = matrixId;
        this.points = List.copyOf(points);
        this.durationsSec = durationsSec;
        this.distancesM = distancesM;
        this.indexByPoint = new HashMap<>();
        for (int i = 0; i < points.size(); i++) {
            indexByPoint.put(points.get(i), i);
        }
    }

    public String getMatrixId() {
        return matrixId;
    }

    public List<String> getPoints() {
        return points;
    }

    public int[][] getDurationsSec() {
        return durationsSec;
    }

    public int[][] getDistancesM() {
        return distancesM;
    }

    public int travelSec(String from, String to) {
        return cell(durationsSec, from, to);
    }

    public int distanceM(String from, String to) {
        return cell(distancesM, from, to);
    }

    private int cell(int[][] matrix, String from, String to) {
        if (from == null || to == null || from.equals(to)) {
            return 0;
        }
        Integer i = indexByPoint.get(from);
        Integer j = indexByPoint.get(to);
        if (i == null || j == null) {
            throw new IllegalArgumentException("Точка отсутствует в матрице: " + (i == null ? from : to));
        }
        return matrix[i][j];
    }
}
