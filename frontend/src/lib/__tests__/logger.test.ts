import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The logger reads its level from env at module load, so each case resets the
 * module registry and re-imports it with the env it wants to test.
 */
async function loadLogger(env: { NODE_ENV?: string; NEXT_PUBLIC_LOG_LEVEL?: string }) {
  vi.resetModules();
  const original = { ...process.env };
  // NODE_ENV is typed read-only by @types/node — go through a mutable view.
  const mutableEnv = process.env as Record<string, string | undefined>;
  mutableEnv.NODE_ENV = env.NODE_ENV;
  if (env.NEXT_PUBLIC_LOG_LEVEL === undefined) {
    delete mutableEnv.NEXT_PUBLIC_LOG_LEVEL;
  } else {
    mutableEnv.NEXT_PUBLIC_LOG_LEVEL = env.NEXT_PUBLIC_LOG_LEVEL;
  }
  const mod = await import("../logger");
  process.env = original;
  return mod.logger;
}

describe("logger — production silences debug, keeps errors", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints every level in development", async () => {
    const logger = await loadLogger({ NODE_ENV: "development" });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("drops debug/info/warn but keeps error in production", async () => {
    const logger = await loadLogger({ NODE_ENV: "production" });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("honours an explicit level override", async () => {
    const logger = await loadLogger({ NODE_ENV: "production", NEXT_PUBLIC_LOG_LEVEL: "silent" });
    logger.error("e");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
