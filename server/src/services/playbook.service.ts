import { Playbook } from "../models/Playbook";
import { z } from "zod";
import { createPlaybookSchema, updatePlaybookSchema } from "../validators/playbook.validator";

export const playbookService = {
  
  async getAll(userId: string) {
    return await Playbook.find({ userId, isArchived: false }).sort({ createdAt: -1 });
  },

  async getById(id: string, userId: string) {
    return await Playbook.findOne({ _id: id, userId, isArchived: false });
  },

  async create(userId: string, data: z.infer<typeof createPlaybookSchema>) {
    // Instead of using transaction + 2 tables, Mongoose uses array embedding
    const newPb = await Playbook.create({
      userId,
      name: data.name,
      description: data.description,
      applicablePairs: data.applicablePairs,
      session: data.session,
      tags: data.tags,
      rules: data.rules || [],
    });

    return newPb;
  },

  async update(id: string, userId: string, data: z.infer<typeof updatePlaybookSchema>) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.applicablePairs) updateData.applicablePairs = data.applicablePairs;
    if (data.session !== undefined) updateData.session = data.session;
    if (data.tags) updateData.tags = data.tags;
    
    // Completely replace rules array if provided
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
  }
};
