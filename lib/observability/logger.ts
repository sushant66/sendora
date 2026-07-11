type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

/**
 * Minimal structured logger. Emits single-line JSON so logs are machine-parseable
 * in a serverless environment. Never logs secrets — callers pass only safe fields.
 */
function emit(level: Level, message: string, fields?: Fields): void {
  const entry = { level, message, ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
