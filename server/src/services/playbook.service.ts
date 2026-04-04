import { Playbook } from "../models/Playbook";
import { Trade } from "../models/Trade";
import { z } from "zod";
import { createPlaybookSchema, updatePlaybookSchema } from "../validators/playbook.validator";

export const playbookService = {

  async getAll(userId: string, accountId: string) {
    // Auto-migrate: assign orphan playbooks (no tradingAccountId) to the active account
    await Playbook.updateMany(
      { userId, tradingAccountId: { $exists: false }, isArchived: false },
      { $set: { tradingAccountId: accountId } }
    );
    await Playbook.updateMany(
      { userId, tradingAccountId: null, isArchived: false },
      { $set: { tradingAccountId: accountId } }
    );

    const playbooks = await Playbook.find({ userId, tradingAccountId: accountId, isArchived: false }).sort({ createdAt: -1 });
    // Compute stats for each playbook
    await Promise.all(playbooks.map(pb => this.computeStats(pb)));
    return playbooks;
  },

  async getById(id: string, userId: string, accountId: string) {
    // Cari dengan accountId, atau fallback jika playbook lama belum di-migrate
    let pb = await Playbook.findOne({ _id: id, userId, tradingAccountId: accountId, isArchived: false });
    if (!pb) {
      pb = await Playbook.findOne({ _id: id, userId, tradingAccountId: { $in: [null, undefined] }, isArchived: false });
      if (pb) {
        pb.tradingAccountId = accountId;
        await pb.save();
      }
    }
    if (pb) {
      await this.computeStats(pb);
    }
    return pb;
  },

  // Helper to compute playbook stats from associated trades
  async computeStats(pb: any) {
    const trades = await Trade.find({ playbookId: pb._id, isDeleted: { $ne: true } });
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === "WIN").length;
    const losses = trades.filter(t => t.result === "LOSS").length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.actualPnl || 0), 0);

    // Calculate avg R multiple from winning trades
    const winningTrades = trades.filter(t => t.result === "WIN" && t.rMultiple);
    const avgRr = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / winningTrades.length
      : 0;

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Update the playbook stats
    pb.stats = {
      totalTrades,
      wins,
      losses,
      totalPnL,
      avgRr,
      winRate
    };

    return pb;
  },

  async create(userId: string, accountId: string, data: z.infer<typeof createPlaybookSchema>) {
    const newPb = await Playbook.create({
      userId,
      tradingAccountId: accountId,
      name: data.name,
      description: data.description,
      markets: data.markets,
      timeframe: data.timeframe,
      methodology: data.methodology,
      marketCondition: data.marketCondition,
      legacyCategory: data.legacyCategory,
      tags: data.tags,
      rules: data.rules || [],
      htfKeyLevel: data.htfKeyLevel,
      ictPoi: data.ictPoi,
      msnrLevel: data.msnrLevel,
      htfTimeframe: data.htfTimeframe,
      entryTimeframe: data.entryTimeframe,
      entryChecklist: data.entryChecklist || [],
      stats: {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        avgRr: 0,
        winRate: 0
      }
    });

    return newPb;
  },

  async update(id: string, userId: string, accountId: string, data: z.infer<typeof updatePlaybookSchema>) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.markets) updateData.markets = data.markets;
    if (data.timeframe !== undefined) updateData.timeframe = data.timeframe;
    if (data.methodology !== undefined) updateData.methodology = data.methodology;
    if (data.marketCondition !== undefined) updateData.marketCondition = data.marketCondition;
    if (data.legacyCategory !== undefined) updateData.legacyCategory = data.legacyCategory;
    if (data.tags) updateData.tags = data.tags;
    if (data.rules) updateData.rules = data.rules;
    if (data.htfKeyLevel !== undefined) updateData.htfKeyLevel = data.htfKeyLevel;
    if (data.ictPoi !== undefined) updateData.ictPoi = data.ictPoi;
    if (data.msnrLevel !== undefined) updateData.msnrLevel = data.msnrLevel;
    if (data.htfTimeframe !== undefined) updateData.htfTimeframe = data.htfTimeframe;
    if (data.entryTimeframe !== undefined) updateData.entryTimeframe = data.entryTimeframe;
    if (data.entryChecklist !== undefined) updateData.entryChecklist = data.entryChecklist;

    const updatedPb = await Playbook.findOneAndUpdate(
      { _id: id, userId, tradingAccountId: accountId, isArchived: false },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return updatedPb;
  },

  async archive(id: string, userId: string, accountId: string) {
    console.log(`[PLAYBOOK] Archiving ID: ${id} for User: ${userId}`);
    const archived = await Playbook.findOneAndUpdate(
      { _id: id, userId, $or: [{ tradingAccountId: accountId }, { tradingAccountId: { $exists: false } }, { tradingAccountId: null }] },
      { $set: { isArchived: true } },
      { returnDocument: 'after' }
    );
    console.log(`[PLAYBOOK] Archive result: ${archived ? 'SUCCESS' : 'FAILED - Not Found'}`);
    return archived;
  },

  async duplicate(id: string, userId: string, accountId: string) {
    const original = await Playbook.findOne({ _id: id, userId, tradingAccountId: accountId, isArchived: false });
    if (!original) return null;

    const duplicated = await Playbook.create({
      userId,
      tradingAccountId: accountId,
      name: `${original.name} (Copy)`,
      description: original.description,
      markets: original.markets,
      timeframe: original.timeframe,
      methodology: original.methodology,
      marketCondition: original.marketCondition,
      legacyCategory: original.legacyCategory,
      tags: original.tags,
      rules: original.rules,
      htfKeyLevel: original.htfKeyLevel,
      ictPoi: original.ictPoi,
      msnrLevel: original.msnrLevel,
      htfTimeframe: original.htfTimeframe,
      entryTimeframe: original.entryTimeframe,
      entryChecklist: original.entryChecklist,
      stats: {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        avgRr: 0,
        winRate: 0
      },
      isArchived: false,
    });

    return duplicated;
  },

  async assignTrade(playbookId: string, tradeId: string, userId: string, accountId: string) {
    // Verify ownership of both playbook and trade
    const playbook = await Playbook.findOne({ _id: playbookId, userId, tradingAccountId: accountId, isArchived: false });
    const trade = await Trade.findOne({ _id: tradeId, userId, tradingAccountId: accountId });

    if (!playbook || !trade) {
      return null;
    }

    // Assign playbook to trade
    trade.playbookId = playbookId;
    await trade.save();

    // Recompute playbook stats
    await this.computeStats(playbook);

    return playbook;
  }
};
