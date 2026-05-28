import { TradingAccount } from "../models/TradingAccount";
import { mt5Service } from "./mt5.service";

const scheduledTasks: Map<string, NodeJS.Timeout> = new Map();

export async function startMt5AutoSync(): Promise<void> {
  console.log("[MT5 Scheduler] Starting MT5 auto sync service...");
  
  const accounts = await TradingAccount.find({
    mt5AutoSyncEnabled: true,
    mt5Config: { $exists: true, $ne: null },
  });

  for (const account of accounts) {
    await startSyncForAccount(account._id.toString(), account.userId, account.mt5SyncIntervalMinutes || 5);
  }

  console.log(`[MT5 Scheduler] Started auto sync for ${accounts.length} accounts`);
}

export async function stopMt5AutoSync(): Promise<void> {
  console.log("[MT5 Scheduler] Stopping all MT5 auto sync tasks...");
  
  for (const [accountId, timer] of scheduledTasks) {
    clearInterval(timer);
    scheduledTasks.delete(accountId);
  }
}

export async function startSyncForAccount(accountId: string, userId: string, intervalMinutes: number): Promise<void> {
  if (scheduledTasks.has(accountId)) {
    clearInterval(scheduledTasks.get(accountId));
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  
  const syncTask = async () => {
    try {
      console.log(`[MT5 Scheduler] Syncing account ${accountId}...`);
      const result = await mt5Service.syncPositions(userId, accountId);
      console.log(`[MT5 Scheduler] Synced account ${accountId}: ${result.synced} positions (${result.created} created, ${result.updated} updated)`);
    } catch (error: any) {
      console.error(`[MT5 Scheduler] Error syncing account ${accountId}:`, error.message);
    }
  };

  await syncTask();

  const timer = setInterval(syncTask, intervalMs);
  scheduledTasks.set(accountId, timer);
}

export async function stopSyncForAccount(accountId: string): Promise<void> {
  const timer = scheduledTasks.get(accountId);
  if (timer) {
    clearInterval(timer);
    scheduledTasks.delete(accountId);
    console.log(`[MT5 Scheduler] Stopped sync for account ${accountId}`);
  }
}

export async function updateSyncInterval(accountId: string, userId: string, intervalMinutes: number): Promise<void> {
  const account = await TradingAccount.findById(accountId);
  if (account && account.mt5AutoSyncEnabled && account.mt5Config) {
    await startSyncForAccount(accountId, userId, intervalMinutes);
  }
}

export function getScheduledTasks(): string[] {
  return Array.from(scheduledTasks.keys());
}
