import { Playbook } from "../models/Playbook";
import { Trade } from "../models/Trade";
import { z } from "zod";
import { createPlaybookSchema, updatePlaybookSchema } from "../validators/playbook.validator";

export const playbookService = {

  async getAll(userId: string) {
    const playbooks = await Playbook.find({ userId, isArchived: false }).sort({ createdAt: -1 });
    // Compute avgRr for each playbook
    await Promise.all(playbooks.map(async (pb) => {
      const trades = await Trade.find({ userId, playbookId: pb._id, result: "WIN" });
      if (trades.length > 0) {
        const totalRr = trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0);
        pb.avgRr = totalRr / trades.length;
      } else {
        pb.avgRr = 0;
      }
    }));
    return playbooks;
  },

  async getById(id: string, userId: string) {
    const pb = await Playbook.findOne({ _id: id, userId, isArchived: false });
    if (pb) {
      const trades = await Trade.find({ userId, playbookId: id, result: "WIN" });
      if (trades.length > 0) {
        const totalRr = trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0);
        pb.avgRr = totalRr / trades.length;
      } else {
        pb.avgRr = 0;
      }
    }
    return pb;
  },

  async create(userId: string, data: z.infer<typeof createPlaybookSchema>) {
    const newPb = await Playbook.create({
      userId,
      name: data.name,
      description: data.description,
      markets: data.markets,
      timeframe: data.timeframe,
      category: data.category,
      tags: data.tags,
      rules: data.rules || [],
    });

    return newPb;
  },

  async update(id: string, userId: string, data: z.infer<typeof updatePlaybookSchema>) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.markets) updateData.markets = data.markets;
    if (data.timeframe !== undefined) updateData.timeframe = data.timeframe;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags) updateData.tags = data.tags;
    if (data.rules) updateData.rules = data.rules;

    const updatedPb = await Playbook.findOneAndUpdate(
      { _id: id, userId, isArchived: false },
      { $set: updateData },
      { new: true }
    );

    return updatedPb;
  },

  async archive(id: string, userId: string) {
    const archived = await Playbook.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isArchived: true } },
      { new: true }
    );
    return archived;
  },

  async duplicate(id: string, userId: string) {
    const original = await Playbook.findOne({ _id: id, userId, isArchived: false });
    if (!original) return null;

    const duplicated = await Playbook.create({
      userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      markets: original.markets,
      timeframe: original.timeframe,
      category: original.category,
      tags: original.tags,
      rules: original.rules,
      isArchived: false,
    });

    return duplicated;
  }
};
