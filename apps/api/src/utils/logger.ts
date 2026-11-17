import { env } from "@/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const PREFIX = "[StylAIze]";

function write(level: LogLevel, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta === undefined ? "" : `\n${format(meta)}`;

  if (env.NODE_ENV === "production") {
    const line = JSON.stringify({
      ts: timestamp,
      level,
      msg: message,
      ...(meta !== undefined ? { meta: serialize(meta) } : {}),
    });
    if (level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
    return;
  }

  const color = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" }[level];
  const reset = "\x1b[0m";
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](`${color}${PREFIX} ${timestamp} [${level.toUpperCase()}]${reset} ${message}${metaStr}`);
}

function format(value: unknown): string {
  return JSON.stringify(serialize(value), null, 2);
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export const logger = {
  debug: (message: string, meta?: unknown) => write("debug", message, meta),
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
};

export const logDebug = logger.debug;
export const logInfo = logger.info;
export const logWarn = logger.warn;
export const logError = logger.error;
