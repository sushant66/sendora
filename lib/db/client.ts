import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { getEnv } from "@/lib/validation/env";
import * as schema from "./schema";

const url = getEnv().DATABASE_URL;

// Neon's serverless (HTTP) driver only talks to Neon's cloud endpoint. For local
// development against a plain Postgres (e.g. `postgres://localhost/sendora_dev`), fall
// back to the standard node-postgres driver so the same DATABASE_URL contract works
// in both environments.
const isNeon = /\.neon\.tech$/.test(new URL(url).hostname);

// Pin `db` to a single type rather than a `NeonHttpDatabase | NodePgDatabase` union. Both
// drivers expose the same Drizzle query-builder surface for our schema, but a union collapses
// overloaded builder methods (e.g. `.returning(fields)`) to their no-arg form, which breaks
// typechecking at call sites. The node-postgres branch is structurally compatible at runtime.
export const db: NeonHttpDatabase<typeof schema> = isNeon
  ? drizzleNeon(neon(url), { schema })
  : (drizzlePg(new Pool({ connectionString: url }), { schema }) as unknown as NeonHttpDatabase<typeof schema>);

export type Db = typeof db;

/**
 * Run several write statements atomically across both drivers this project targets. The
 * two drivers have inverse capabilities: Neon's HTTP driver has no `db.transaction()` but
 * exposes `db.batch(...)`; node-postgres (local dev) has no `.batch()` but supports real
 * transactions. `build(x)` MUST construct its statements from the passed executor `x` so
 * they run on the right connection (a statement built from the top-level `db` would not
 * join the node-postgres transaction). Statements run in array order.
 */
export async function runAtomic(
  database: Db,
  build: (x: Db) => Array<PromiseLike<unknown>>,
): Promise<void> {
  const driver = database as unknown as {
    batch?: (stmts: Array<PromiseLike<unknown>>) => Promise<unknown>;
    transaction: (fn: (tx: Db) => Promise<void>) => Promise<void>;
  };
  if (typeof driver.batch === "function") {
    await driver.batch(build(database));
  } else {
    await driver.transaction(async (tx) => {
      for (const stmt of build(tx)) await stmt;
    });
  }
}
