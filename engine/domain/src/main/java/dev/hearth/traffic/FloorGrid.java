package dev.hearth.traffic;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The walkable floor: open cells with named regions, everything else rack.
 * Regions are painted from runs (a row run or a column run) in document
 * order, and the first run that covers a cell keeps it.
 */
public record FloorGrid(int width, int height, Set<Cell> blocked, Map<Cell, String> regions) {

    public boolean open(Cell cell) {
        return cell.col() >= 0 && cell.col() < width && cell.row() >= 0 && cell.row() < height
                && !blocked.contains(cell);
    }

    public String regionOf(Cell cell) {
        return regions.getOrDefault(cell, "Floor");
    }

    public List<Cell> neighbors(Cell cell) {
        return List.of(
                new Cell(cell.row() - 1, cell.col()),
                new Cell(cell.row() + 1, cell.col()),
                new Cell(cell.row(), cell.col() - 1),
                new Cell(cell.row(), cell.col() + 1));
    }

    public static FloorGrid paint(int width, int height, List<Run> runs) {
        Set<Cell> blocked = new HashSet<>();
        Map<Cell, String> regions = new HashMap<>();
        for (int row = 0; row < height; row++) {
            for (int col = 0; col < width; col++) {
                blocked.add(new Cell(row, col));
            }
        }
        for (Run run : runs) {
            if (run.row() != null) {
                for (int col = run.from(); col <= run.to(); col++) {
                    paint(blocked, regions, new Cell(run.row(), col), run.region());
                }
            } else {
                for (int row = run.from(); row <= run.to(); row++) {
                    paint(blocked, regions, new Cell(row, run.col()), run.region());
                }
            }
        }
        return new FloorGrid(width, height, blocked, regions);
    }

    private static void paint(Set<Cell> blocked, Map<Cell, String> regions, Cell cell, String region) {
        blocked.remove(cell);
        regions.putIfAbsent(cell, region);
    }

    /** A straight strip of floor: a corridor row or an aisle column. */
    public record Run(String region, Integer row, Integer col, int from, int to) {

        public static Run row(String region, int row, int from, int to) {
            return new Run(region, row, null, from, to);
        }

        public static Run col(String region, int col, int from, int to) {
            return new Run(region, null, col, from, to);
        }
    }
}
