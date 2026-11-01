import { describe, it, expect, vi } from 'vitest';
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { create: vi.fn().mockResolvedValue({}), findOne: vi.fn().mockResolvedValue({}) } }));
vi.mock('../user-memory.service', () => ({ userMemoryService: { learnPersonaFact: vi.fn().mockResolvedValue(undefined), getOrCreate: vi.fn().mockResolvedValue({ agentMemories: [] }) } }));
import { selfImprovementService } from '../self-improvement.service';
import * as um from '../user-memory.service';
describe('probe10', () => {
  it('direct call on mock', async () => {
    (um as any).userMemoryService.learnPersonaFact('u','p','f','market_insight');
    console.log('DIRECT_CALLS', (um as any).userMemoryService.learnPersonaFact.mock.calls.length);
    expect(1).toBe(1);
  });
});
