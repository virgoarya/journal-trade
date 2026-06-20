export const silentLogger = {
  debug: (_message?: unknown, ..._args: unknown[]) => undefined,
  info: (_message?: unknown, ..._args: unknown[]) => undefined,
  warn: (_message?: unknown, ..._args: unknown[]) => undefined,
  error: (_message?: unknown, ..._args: unknown[]) => undefined,
};
