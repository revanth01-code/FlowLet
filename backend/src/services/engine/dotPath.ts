// Working on: dot-path resolver — reads a nested value out of an object
// using a path like "order.customer.email". Returns null for any
// missing/invalid path per spec 3.1 ("A missing path gives null").

export function getByDotPath(data: unknown, path: string): unknown {
    const segments = path.split(".");

    let current: unknown = data;
    for (const segment of segments) {
        if (current === null || current === undefined || typeof current !== "object") {
            return null;
        }
        current = (current as Record<string, unknown>)[segment];
    }

    return current ?? null;
}