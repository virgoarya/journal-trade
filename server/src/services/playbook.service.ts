import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { playbook, playbookRule, trade } from "../db/schema";
import { z } from "zod";
import { createPlaybookSchema, updatePlaybookSchema } from "../validators/playbook.validator";

export const playbookService = {
  
  async getAll(userId: string) {
    return await db.query.playbook.findMany({
      where: and(eq(playbook.userId, userId), eq(playbook.isArchived, false)),
      orderBy: (playbook, { desc }) => [desc(playbook.createdAt)],
    });
  },

  async getById(id: string, userId: string) {
    const pb = await db.query.playbook.findFirst({
      where: and(eq(playbook.id, id), eq(playbook.userId, userId), eq(playbook.isArchived, false)),
    });
    
    if (!pb) return null;
    
    const rules = await db.query.playbookRule.findMany({
      where: eq(playbookRule.playbookId, id),
      orderBy: (rule, { asc }) => [asc(rule.sortOrder)],
    });

    return { ...pb, rules };
  },

  async create(userId: string, data: z.infer<typeof createPlaybookSchema>) {
    return await db.transaction(async (tx) => {
      const [newPb] = await tx.insert(playbook).values({
        userId,
        name: data.name,
        description: data.description,
        applicablePairs: data.applicablePairs,
        session: data.session,
        tags: data.tags,
      }).returning();

      if (data.rules && data.rules.length > 0) {
        const rulesToInsert = data.rules.map((ruleText, index) => ({
          playbookId: newPb.id,
          ruleText,
          sortOrder: index,
        }));
        await tx.insert(playbookRule).values(rulesToInsert);
      }

      return newPb;
    });
  },

  async update(id: string, userId: string, data: z.infer<typeof updatePlaybookSchema>) {
    return await db.transaction(async (tx) => {
      // Basic update
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.applicablePairs) updateData.applicablePairs = data.applicablePairs;
      if (data.session !== undefined) updateData.session = data.session;
      if (data.tags) updateData.tags = data.tags;

      let updatedPb = null;
      if (Object.keys(updateData).length > 0) {
        const [res] = await tx.update(playbook)
          .set(updateData)
          .where(and(eq(playbook.id, id), eq(playbook.userId, userId)))
          .returning();
        updatedPb = res;
      }

      // Handle rules update: delete old and insert new (simplified approach)
      if (data.rules) {
        await tx.delete(playbookRule).where(eq(playbookRule.playbookId, id));
        if (data.rules.length > 0) {
          const rulesToInsert = data.rules.map((ruleText, index) => ({
            playbookId: id,
            ruleText,
            sortOrder: index,
          }));
          await tx.insert(playbookRule).values(rulesToInsert);
        }
      }

      return updatedPb;
    });
  },

  async archive(id: string, userId: string) {
    const [archived] = await db.update(playbook)
      .set({ isArchived: true })
      .where(and(eq(playbook.id, id), eq(playbook.userId, userId)))
      .returning();
    return archived;
  }
};
