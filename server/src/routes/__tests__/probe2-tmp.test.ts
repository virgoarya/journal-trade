import { describe, it, expect, vi } from 'vitest';
vi.mock('../../middleware/auth', () => ({ requireAuth: (req: any, res: any, next: any) => { req.user = { id: 'u1', email: 'a@b.c' }; next(); } }));
vi.mock('../../services/macro-ai.service', () => ({ macroAiService: { chatStream: vi.fn().mockResolvedValue({ text: 'hi', toolsUsed: [] }), analyzeRegime: vi.fn(), analyzeMacroFeed: vi.fn(), analyzeNexus: vi.fn() } }));
vi.mock('../../services/market-data.service', () => ({ marketDataService: { updateNewsAnalysis: vi.fn() } }));
vi.mock('../../services/user-memory.service', () => ({ userMemoryService: { ensureName: vi.fn(), getPromptContext: vi.fn().mockResolvedValue(''), getOrCreate: vi.fn().mockResolvedValue({ name: 'T', interactionCount: 1 }) } }));
vi.mock('../../models/ChatSession', () => ({ ChatSession: { find: vi.fn(), create: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { find: vi.fn(), create: vi.fn() } }));
vi.mock('../../lib/agent/profile-repo', () => ({ resolveProfileForUser: vi.fn().mockResolvedValue(null) }));
import routes from '../macro-ai.routes';
describe('probe2', () => { it('root', async () => {
  const r: any = { body: { messages: [{ role: 'user', content: 'x' }] }, user: { id: 'u1' } };
  const s: any = { statusCode: 200, status: vi.fn(function(c:number){this.statusCode=c;return this;}), json: vi.fn(function(d:any){this.body=d;return this;}) };
  await routes.stack[0].route.stack[1].handle(r, s);
  console.log('RESULT', JSON.stringify(s.body));
  expect(1).toBe(1);
}); });
