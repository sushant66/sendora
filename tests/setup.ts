import "@testing-library/jest-dom/vitest";
import { validEnv } from "./helpers/env";

// Provide a valid environment so modules that construct the DB client at import time
// (e.g. lib/db/client) don't fail env validation. No real connection is opened until a
// query runs, and the pure logic under test never queries. env.test.ts passes explicit
// sources + resetEnvCache, so it is unaffected by this.
Object.assign(process.env, validEnv);
