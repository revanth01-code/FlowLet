// Working on: typed env loader — fails fast if a required var is missing,
// instead of silently using `undefined` somewhere deep in the app.

function required(name: string): string {
    const value = Bun.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const env = {
    port: Number(Bun.env.PORT ?? 4000),
    nodeEnv: Bun.env.NODE_ENV ?? "development",

    mongoUri: required("MONGO_URI"),
    mongoDbName: required("MONGO_DB_NAME"),

    pg: {
        host: required("PGHOST"),
        port: Number(Bun.env.PGPORT ?? 5432),
        user: required("PGUSER"),
        password: required("PGPASSWORD"),
        database: required("PGDATABASE"),
    },

    publicBackendUrl: Bun.env.PUBLIC_BACKEND_URL ?? "http://localhost:4000",
} as const;