import pino from "pino";
import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const isDevelopment = nodeEnv !== "production";

export const logger = pino({
  level: nodeEnv === "production" ? "info" : "debug",
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
