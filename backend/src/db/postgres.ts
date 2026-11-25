// Working on: Postgres connection pool used by the running app (separate
// from migrate.ts's own one-shot pool).

import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
    host: env.pg.host,
    port: env.pg.port,
    user: env.pg.user,
    password: env.pg.password,
    database: env.pg.database,
});