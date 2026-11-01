import { describe, it, expect, vi } from 'vitest';
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { create: vi.fn().mockResolvedValue({}), findOne: vi.fn().mockResolvedValue({ wasCorrected: true }) } }));
vi.mock('../user-memory.service', () => ({ userMemoryService: { learnPersonaFact: vi.fn().mockResolvedValue(undefined), getOrCreate: vi.fn().mockResolvedValue({ agentMemories: [] }) } }));
import { selfImprovementService } from '../self-improvement.service';
import { userMemoryService } from '../user-memory.service';
describe('probe7', () => {
  it('calls', async () => {
    console.log('learn mock?', vi.isMockFunction((userMemoryService as any).learnPersonaFact));
    await selfImprovementService.enqueueJob({ personaId: 'hawk', userId: 'u1', prompt: 'q', finalReply: 'a', wasCorrected: true, dataPoint: 'CPI YoY', expected: '2.5', actual: '5' });
    console.log('CALLS', (userMemoryService as any).learnPersonaFact.mock.calls.length);
    const { ReflectionLog } = await import('../../models/ReflectionLog');
    console.log('CREATE_CALLS', (ReflectionLog as any).create.mock.calls.length);
    const svc = await import('../self-improvement.service');
    console.log('SVC_KEYS', Object.keys(svc.selfImprovementService).join(','));
    console.log('HAS_LEARN', typeof (svc as any).selfImprovementService.learnPersonaFact);
    expect(1).toBe(1);
  });
});
