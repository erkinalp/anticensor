export function convertTimestamp<X>(d: X): X | string {
    if (d instanceof Date) {
        return d.toISOString().replace(/Z$/gm, "000+00:00");
    } else return d;
}
