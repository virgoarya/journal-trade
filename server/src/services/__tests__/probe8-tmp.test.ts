import { describe, it, expect, vi } from 'vitest';
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { create: vi.fn().mockResolvedValue({}), findOne: vi.fn().mockResolvedValue({ wasCorrected: true }) } }));
vi.mock('../user-memory.service', () => ({ userMemoryService: { learnPersonaFact: vi.fn().mockResolvedValue(undefined), getOrCreate: vi.fn().mockResolvedValue({ agentMemories: [] }) } }));
import { selfImprovementService } from '../self-improvement.service';
import * as um from '../user-memory.service';
describe('probe8', () => {
  it('identity', async () => {
    console.log('EXPORTS', Object.keys(um).join(','));
    console.log('IS_MOCK', vi.isMockFunction((um as any).userMemoryService?.learnPersonaFact));
    await selfImprovementService.enqueueJob({ personaId: 'hawk', userId: 'u1', prompt: 'q', finalReply: 'a', wasCorrected: true, dataPoint: 'CPI', expected: '2.5', actual: '5' });
    console.log('CALLS', (um as any).userMemoryService.learnPersonaFact.mock.calls.length);
    expect(1).toBe(1);
  });
});
