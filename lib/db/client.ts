import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { getEnv } from "@/lib/validation/env";
import * as schema from "./schema";

const sql = neon(getEnv().DATABASE_URL);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
