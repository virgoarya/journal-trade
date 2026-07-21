import { logger } from "./logger";

export const silentLogger = {
  debug: (_msg?: any, ..._args: any[]) => {
    // Silently discard debug logs to reduce backend noise
  },
  info: (msg?: any, ...args: any[]) => {
    if (args.length > 0) {
      logger.info({ extra: args }, msg);
    } else {
      logger.info(msg);
    }
  },
  warn: (msg?: any, ...args: any[]) => {
    if (args.length > 0) {
      logger.warn({ extra: args }, msg);
    } else {
      logger.warn(msg);
    }
  },
  error: (msg?: any, ...args: any[]) => {
    if (args.length > 0) {
      logger.error({ extra: args }, msg);
    } else {
      logger.error(msg);
    }
  },
};

