package dev.hearth.traffic;

/** One square of the floor. Rows grow south, columns east, in grid steps. */
public record Cell(int row, int col) {

    public int manhattan(Cell other) {
        return Math.abs(row - other.row) + Math.abs(col - other.col);
    }

    public String key() {
        return row + "," + col;
    }
}
