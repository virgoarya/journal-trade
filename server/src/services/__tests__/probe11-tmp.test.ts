import { describe, it, expect, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ learn: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../user-memory.service', () => ({ userMemoryService: { learnPersonaFact: mocked.learn, getOrCreate: vi.fn().mockResolvedValue({ agentMemories: [] }) } }));
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { create: vi.fn().mockResolvedValue({}), findOne: vi.fn().mockResolvedValue({}) } }));
import { selfImprovementService } from '../self-improvement.service';
describe('probe11', () => {
  it('shared fn ref', async () => {
    await selfImprovementService.enqueueJob({ personaId: 'hawk', userId: 'u1', prompt: 'q', finalReply: 'a', wasCorrected: true, dataPoint: 'CPI', expected: '2.5', actual: '5' });
    console.log('SHARED_CALLS', mocked.learn.mock.calls.length);
    expect(1).toBe(1);
  });
});
