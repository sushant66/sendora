import "@testing-library/jest-dom/vitest";
import { validEnv } from "./helpers/env";

// jsdom doesn't implement scrollIntoView; components that call it (e.g. the merge-field
// slash menu, scrolling its active option into view) need a no-op stand-in in tests.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Provide a valid environment so modules that construct the DB client at import time
// (e.g. lib/db/client) don't fail env validation. No real connection is opened until a
// query runs, and the pure logic under test never queries. env.test.ts passes explicit
// sources + resetEnvCache, so it is unaffected by this.
Object.assign(process.env, validEnv);
