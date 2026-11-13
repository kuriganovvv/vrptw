package ru.sibsutis.vrptw_backend.domain.model;

public record Equipment(int ont, int router, int stb) {

    public static final Equipment ZERO = new Equipment(0, 0, 0);

    public Equipment minus(Equipment other) {
        return new Equipment(ont - other.ont, router - other.router, stb - other.stb);
    }

    public Equipment plus(Equipment other) {
        return new Equipment(ont + other.ont, router + other.router, stb + other.stb);
    }

    public boolean fitsInto(Equipment capacity) {
        return ont <= capacity.ont && router <= capacity.router && stb <= capacity.stb;
    }

    public static Equipment of(int ont, int router, int stb) {
        return new Equipment(ont, router, stb);
    }
}
