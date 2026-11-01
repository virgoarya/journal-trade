import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../middleware/auth', () => ({ requireAuth: (req: any, res: any, next: any) => { req.user = { id: 'u1', email: 'a@b.c' }; next(); } }));
vi.mock('../../services/macro-ai.service', () => ({ macroAiService: { chatStream: vi.fn(), analyzeRegime: vi.fn(), analyzeMacroFeed: vi.fn(), analyzeNexus: vi.fn() } }));
vi.mock('../../services/market-data.service', () => ({ marketDataService: { updateNewsAnalysis: vi.fn() } }));
vi.mock('../../services/user-memory.service', () => ({ userMemoryService: { ensureName: vi.fn(), getPromptContext: vi.fn(), getOrCreate: vi.fn() } }));
vi.mock('../../models/ChatSession', () => ({ ChatSession: { find: vi.fn(), create: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock('../../models/ReflectionLog', () => ({ ReflectionLog: { find: vi.fn(), create: vi.fn() } }));
import macroAiRoutes from '../macro-ai.routes';
import { macroAiService } from '../../services/macro-ai.service';
import { userMemoryService } from '../../services/user-memory.service';
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
describe('probe6', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('exact getHandler pattern', async () => {
    vi.mocked(macroAiService.chatStream).mockResolvedValue({ text: 'hi', toolsUsed: [] } as any);
    vi.mocked(userMemoryService.getPromptContext).mockResolvedValue('');
    vi.mocked(userMemoryService.getOrCreate).mockResolvedValue({ name: 'T', interactionCount: 1 } as any);
    const { req, res } = createMockReqRes({ messages: [{ role: 'user', content: 'x' }] });
    await getHandler('/', 'post')(req, res);
    console.log('RESULT6', JSON.stringify(res.body));
    expect(1).toBe(1);
  });
});
