// Working on: migration runner — applies every .sql file in this folder, in
// filename order, inside a transaction, and records what's already been run
// in a schema_migrations table so re-running `bun run migrate` is a no-op.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { env } from "../config/env";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
    const pool = new Pool({
        host: env.pg.host,
        port: env.pg.port,
        user: env.pg.user,
        password: env.pg.password,
        database: env.pg.database,
    });

    const client = await pool.connect();

    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

        // gen_random_uuid() needs this extension in a fresh Postgres image.
        await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

        const files = (await readdir(__dirname))
            .filter((f) => f.endsWith(".sql"))
            .sort(); // 001_..., 002_..., so on — filename order = apply order

        const { rows: applied } = await client.query<{ name: string }>(
            "SELECT name FROM schema_migrations",
        );
        const appliedNames = new Set(applied.map((r) => r.name));

        for (const file of files) {
            if (appliedNames.has(file)) {
                console.log(`skip (already applied): ${file}`);
                continue;
            }

            const sql = await readFile(join(__dirname, file), "utf-8");

            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query(
                    "INSERT INTO schema_migrations (name) VALUES ($1)",
                    [file],
                );
                await client.query("COMMIT");
                console.log(`applied: ${file}`);
            } catch (err) {
                await client.query("ROLLBACK");
                throw new Error(`Migration failed at ${file}: ${err}`);
            }
        }

        console.log("All migrations applied.");
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});