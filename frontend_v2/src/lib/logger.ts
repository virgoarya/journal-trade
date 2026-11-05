/**
 * Level-based frontend logger.
 *
 * Problem this solves: `console.*` calls scattered through the client bundle
 * leak session/API detail into the browser console and slow down hot paths in
 * production. Everything now goes through here instead.
 *
 * Behaviour:
 *   - development: every level is printed (debug → error)
 *   - production:  only `error` survives, so genuine failures stay debuggable
 *                  in the field without dumping debug noise to end users
 *   - override with NEXT_PUBLIC_LOG_LEVEL ("debug" | "info" | "warn" | "error" | "silent")
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.debug("[DataFetch] quotes response", res.status);
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

function resolveLevel(): LogLevel {
  const override = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined;
  if (override && override in LEVEL_RANK) return override;
  return process.env.NODE_ENV === "production" ? "error" : "debug";
}

const activeRank = LEVEL_RANK[resolveLevel()];

function enabled(level: Exclude<LogLevel, "silent">): boolean {
  return LEVEL_RANK[level] >= activeRank;
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (enabled("debug")) console.log(...args);
  },
  info: (...args: unknown[]): void => {
    if (enabled("info")) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    if (enabled("warn")) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    if (enabled("error")) console.error(...args);
  },
};

export default logger;
