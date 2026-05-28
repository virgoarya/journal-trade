import { Router } from "express";
import { mt5Service } from "../services/mt5.service";
import { tradingAccountService } from "../services/trading-account.service";
import { validate } from "../middleware/validate";
import { mt5ConnectSchema, mt5UpdateSettingsSchema, mt5SyncSchema } from "../validators/mt5.validator";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";
import { startSyncForAccount, stopSyncForAccount, updateSyncInterval } from "../services/mt5-scheduler.service";
import mongoose from "mongoose";

const router = Router();
router.use(requireAuth);

router.post("/connect", validate({ body: mt5ConnectSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.notFound(res, "Trading account tidak ditemukan");
    }

    const result = await mt5Service.connect(req.body);
    
    if (!result.success) {
      return apiResponse.error(res, result.message, "MT5_ERROR", 400);
    }

    account.mt5Config = {
      server: req.body.server,
      login: req.body.login,
      password: req.body.password,
    };
    await account.save();

    return apiResponse.success(res, {
      connected: true,
      accountInfo: result.accountInfo,
    });
  } catch (error) { next(error); }
});

router.post("/disconnect", async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.notFound(res, "Trading account tidak ditemukan");
    }

    account.mt5Config = undefined;
    account.mt5AutoSyncEnabled = false;
    account.sourcePreference = "manual";
    await account.save();

    return apiResponse.success(res, { connected: false });
  } catch (error) { next(error); }
});

router.get("/status", async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.success(res, {
        connected: false,
        config: null,
      });
    }

    const isConnected = !!account.mt5Config?.server && !!account.mt5Config?.login;
    
    return apiResponse.success(res, {
      connected: isConnected,
      config: isConnected ? {
        server: account.mt5Config?.server,
        login: account.mt5Config?.login,
      } : null,
      sourcePreference: account.sourcePreference || "manual",
      autoSyncEnabled: account.mt5AutoSyncEnabled || false,
      syncIntervalMinutes: account.mt5SyncIntervalMinutes || 5,
      lastSyncAt: account.lastMt5SyncAt,
    });
  } catch (error) { next(error); }
});

router.patch("/settings", validate({ body: mt5UpdateSettingsSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.notFound(res, "Trading account tidak ditemukan");
    }

    if (req.body.sourcePreference !== undefined) {
      account.sourcePreference = req.body.sourcePreference;
    }
    if (req.body.mt5AutoSyncEnabled !== undefined) {
      const wasEnabled = account.mt5AutoSyncEnabled;
      account.mt5AutoSyncEnabled = req.body.mt5AutoSyncEnabled;
      
      if (req.body.mt5AutoSyncEnabled && account.mt5Config && !wasEnabled) {
        await startSyncForAccount(
          account._id.toString(), 
          account.userId, 
          account.mt5SyncIntervalMinutes || 5
        );
      } else if (!req.body.mt5AutoSyncEnabled && wasEnabled) {
        await stopSyncForAccount(account._id.toString());
      }
    }
    if (req.body.mt5SyncIntervalMinutes !== undefined) {
      account.mt5SyncIntervalMinutes = req.body.mt5SyncIntervalMinutes;
      if (account.mt5AutoSyncEnabled && account.mt5Config) {
        await updateSyncInterval(
          account._id.toString(),
          account.userId,
          req.body.mt5SyncIntervalMinutes
        );
      }
    }
    await account.save();

    return apiResponse.success(res, {
      sourcePreference: account.sourcePreference,
      autoSyncEnabled: account.mt5AutoSyncEnabled,
      syncIntervalMinutes: account.mt5SyncIntervalMinutes,
    });
  } catch (error) { next(error); }
});

router.get("/positions", async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account || !account.mt5Config) {
      return apiResponse.success(res, { positions: [], total: 0 });
    }

    const positions = await mt5Service.getOpenPositions(account.mt5Config);
    
    return apiResponse.success(res, {
      positions,
      total: positions.length,
    });
  } catch (error) { next(error); }
});

router.post("/sync", validate({ body: mt5SyncSchema }), async (req, res, next) => {
  try {
    const account = await tradingAccountService.getActiveAccount(req.user.id);
    if (!account) {
      return apiResponse.notFound(res, "Trading account tidak ditemukan");
    }

    const accountId = req.body.accountId || account._id.toString();
    const result = await mt5Service.syncPositions(req.user.id, accountId);

    return apiResponse.success(res, result);
  } catch (error) { next(error); }
});

export default router;
