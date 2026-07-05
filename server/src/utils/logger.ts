import pino from "pino";
import { env } from "../config/env";

const isDevelopment = env.NODE_ENV === "development";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for specific modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
