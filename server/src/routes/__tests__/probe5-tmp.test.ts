import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../middleware/auth', () => ({ requireAuth: (req: any, res: any, next: any) => { req.user = { id: 'u1', email: 'a@b.c' }; next(); } }));
vi.mock('../../services/macro-ai.service', () => ({ macroAiService: { chatStream: vi.fn(), analyzeRegime: vi.fn(), analyzeMacroFeed: vi.fn(), analyzeNexus: vi.fn() } }));
vi.mock('../../services/market-data.service', () => ({ marketDataService: { updateNewsAnalysis: vi.fn() } }));
vi.mock('../../services/user-memory.service', () => ({ userMemoryService: { ensureName: vi.fn().mockResolvedValue(undefined), getPromptContext: vi.fn().mockResolvedValue(''), getOrCreate: vi.fn().mockResolvedValue({ name: 'Test User', interactionCount: 1 }) } }));
vi.mock('../../models/ChatSession', () => ({ ChatSession: { find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: 's1', title: 'T' }]) }) }) }), create: vi.fn().mockResolvedValue({ _id: 's2' }), findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 's1', messages: [] }) }), updateOne: vi.fn().mockResolvedValue({}) } }));
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: 'l1', thought: 'r' }]) }) }) }) } }));
import macroAiRoutes from '../macro-ai.routes';
import { macroAiService } from '../../services/macro-ai.service';
function createMockReqRes(body = {}) {
  const req: any = { body, query: {}, params: {}, user: { id: 'u1' } };
  const res: any = {}; res.statusCode = 200;
  res.status = vi.fn().mockImplementation((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn().mockImplementation((d: any) => { res.body = d; return res; });
  return { req, res };
}
function getHandler(path: string, method: 'get' | 'post' = 'post') {
  const layer = (macroAiRoutes.stack as any[]).find((l) => l.route?.path === path && l.route?.methods[method]);
  if (!layer) throw new Error('no layer');
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}
describe('probe5', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('mirrors exact mocks + beforeEach', async () => {
    vi.mocked(macroAiService.chatStream).mockResolvedValue({ text: 'hi', toolsUsed: [] } as any);
    const { req, res } = createMockReqRes({ messages: [{ role: 'user', content: 'x' }] });
    await getHandler('/', 'post')(req, res);
    console.log('RESULT5', JSON.stringify(res.body));
    expect(1).toBe(1);
  });
});
