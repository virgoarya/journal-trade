import axios, { AxiosInstance } from "axios";
import { TradingAccount } from "../models/TradingAccount";
import { Trade } from "../models/Trade";
import mongoose from "mongoose";

export interface MT5Position {
  ticket: number;
  orderId: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  sl: number;
  tp: number;
  profit: number;
  time: number;
  timeUpdate: number;
  comment: string;
  externalId: string;
}

export interface MT5Config {
  server: string;
  login: string;
  password: string;
}

interface MT5LoginResponse {
  retcode: number;
  session: string;
  account: {
    login: string;
    currency: string;
    balance: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number;
  };
}

interface MT5PositionsResponse {
  retcode: number;
  total: number;
  positions: MT5Position[];
}

class MT5Service {
  private getClient(config: MT5Config): AxiosInstance {
    return axios.create({
      baseURL: `https://${config.server}`,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async connect(config: MT5Config): Promise<{ success: boolean; message: string; accountInfo?: any }> {
    try {
      const client = this.getClient(config);
      
      const loginResponse = await client.post("/api/login", {
        user: config.login,
        password: config.password,
      });

      const data = loginResponse.data as MT5LoginResponse;

      if (data.retcode !== 0) {
        return { success: false, message: `MT5 Error: ${data.retcode}` };
      }

      return {
        success: true,
        message: "Connected successfully",
        accountInfo: data.account,
      };
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || "Failed to connect to MT5";
      return { success: false, message };
    }
  }

  async getOpenPositions(config: MT5Config): Promise<MT5Position[]> {
    try {
      const client = this.getClient(config);

      const loginResponse = await client.post("/api/login", {
        user: config.login,
        password: config.password,
      });

      const loginData = loginResponse.data as MT5LoginResponse;
      if (loginData.retcode !== 0) {
        throw new Error(`Login failed: ${loginData.retcode}`);
      }

      const session = loginData.session;

      const positionsResponse = await client.post("/api/position/get", {
        session,
      });

      const positionsData = positionsResponse.data as MT5PositionsResponse;
      return positionsData.positions || [];
    } catch (error: any) {
      console.error("MT5 getOpenPositions error:", error.message);
      return [];
    }
  }

  async getClosedPositions(
    config: MT5Config,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<MT5Position[]> {
    try {
      const client = this.getClient(config);

      const loginResponse = await client.post("/api/login", {
        user: config.login,
        password: config.password,
      });

      const loginData = loginResponse.data as MT5LoginResponse;
      if (loginData.retcode !== 0) {
        throw new Error(`Login failed: ${loginData.retcode}`);
      }

      const session = loginData.session;

      const dealsResponse = await client.post("/api/deal/get", {
        session,
        from: fromTimestamp,
        to: toTimestamp,
      });

      return dealsResponse.data.deals || [];
    } catch (error: any) {
      console.error("MT5 getClosedPositions error:", error.message);
      return [];
    }
  }

  async syncPositions(userId: string, accountId: string): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: string[];
  }> {
    const result = { synced: 0, created: 0, updated: 0, errors: [] as string[] };

    try {
      const account = await TradingAccount.findOne({
        _id: new mongoose.Types.ObjectId(accountId),
        userId,
      });

      if (!account || !account.mt5Config) {
        result.errors.push("Account or MT5 config not found");
        return result;
      }

      const openPositions = await this.getOpenPositions(account.mt5Config);

      for (const pos of openPositions) {
        const existingTrade = await Trade.findOne({
          userId,
          tradingAccountId: new mongoose.Types.ObjectId(accountId),
          mt5TicketId: pos.ticket.toString(),
        });

        const tradeData = {
          userId,
          tradingAccountId: new mongoose.Types.ObjectId(accountId),
          tradeDate: new Date(pos.time * 1000),
          pair: pos.symbol,
          direction: pos.type === "BUY" ? "LONG" : "SHORT",
          entryPrice: pos.priceOpen,
          stopLoss: pos.sl || 0,
          takeProfit: pos.tp || undefined,
          lotSize: pos.volume,
          actualPnl: pos.profit,
          result: pos.profit > 0 ? "WIN" : pos.profit < 0 ? "LOSS" : "BREAKEVEN",
          source: "mt5" as const,
          mt5TicketId: pos.ticket.toString(),
          mt5OrderId: pos.orderId,
        };

        if (existingTrade) {
          await Trade.findByIdAndUpdate(existingTrade._id, {
            ...tradeData,
            actualPnl: pos.profit,
            exitDate: pos.timeUpdate ? new Date(pos.timeUpdate * 1000) : undefined,
          });
          result.updated++;
        } else {
          await Trade.create(tradeData);
          result.created++;
        }
        result.synced++;
      }

      account.lastMt5SyncAt = new Date();
      await account.save();
    } catch (error: any) {
      result.errors.push(error.message);
    }

    return result;
  }
}

export const mt5Service = new MT5Service();
