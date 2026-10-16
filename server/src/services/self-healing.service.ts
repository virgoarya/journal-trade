import { silentLogger } from "../utils/silent-logger";

export class SelfHealingService {
  /**
   * Menjalankan operasi async dengan mekanisme self-healing (retry dengan fallback strategy)
   */
  static async executeWithHealing<T>(
    operationName: string,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (err: any) {
      silentLogger.warn(`[SelfHealing] Primary operation '${operationName}' failed: ${err.message}. Attempting self-healing...`);

      if (fallbackFn) {
        try {
          const fallbackResult = await fallbackFn();
          silentLogger.info(`[SelfHealing] Self-healing succeeded for '${operationName}' using fallback strategy.`);
          return fallbackResult;
        } catch (fallbackErr: any) {
          silentLogger.error(`[SelfHealing] Fallback failed for '${operationName}': ${fallbackErr.message}`);
          throw err; // Throw original error if fallback also fails
        }
      }

      throw err;
    }
  }
}
