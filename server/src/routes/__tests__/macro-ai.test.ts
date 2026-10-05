import { describe, it, expect, vi, beforeEach } from 'vitest';
import macroAiRoutes from '../macro-ai.routes';
import { macroAiService } from '../../services/macro-ai.service';
import { marketDataService } from '../../services/market-data.service';

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  },
}));

vi.mock('../../services/macro-ai.service', () => ({
  macroAiService: {
    chatStream: vi.fn(),
    analyzeRegime: vi.fn(),
    analyzeMacroFeed: vi.fn(),
    analyzeNexus: vi.fn(),
  },
}));

vi.mock('../../services/market-data.service', () => ({
  marketDataService: {
    updateNewsAnalysis: vi.fn(),
  },
}));

vi.mock('../../services/user-memory.service', () => ({
  userMemoryService: {
    ensureName: vi.fn().mockResolvedValue(undefined),
    getPromptContext: vi.fn().mockResolvedValue(''),
    getOrCreate: vi.fn().mockResolvedValue({ name: 'Test User', interactionCount: 1 }),
  },
}));

vi.mock('../../models/ChatSession', () => ({
  ChatSession: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ _id: 'session-1', title: 'Test Session' }]),
        }),
      }),
    }),
    create: vi.fn().mockResolvedValue({ _id: 'session-2' }),
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'session-1', messages: [] }),
    }),
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../models/ReflectionLog', () => ({
  ReflectionLog: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ _id: 'log-1', thought: 'reflect' }]),
        }),
      }),
    }),
  },
}));

function createMockReqRes(body = {}, query = {}, params = {}) {
  const req: any = { body, query, params, user: { id: 'test-user-123' } };
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: any) => {
    res.body = data;
    return res;
  });
  return { req, res };
}

function getHandler(path: string, method: 'get' | 'post' = 'post') {
  const layer = (macroAiRoutes.stack as any[]).find((l) => {
    return l.route?.path === path && l.route?.methods[method];
  });
  if (!layer) throw new Error(`Route layer not found for ${method.toUpperCase()} ${path}`);
  // Return the last handler in stack (after auth middleware)
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

describe('Macro AI API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /analyze-regime', () => {
    it('should analyze regime and return reasoning', async () => {
      vi.mocked(macroAiService.analyzeRegime).mockResolvedValue('Regime analysis: Reflation');

      const { req, res } = createMockReqRes({
        assets: [{ symbol: 'XAUUSD', price: 2000 }],
        regime: 'Reflation',
      });
      const handler = getHandler('/analyze-regime', 'post');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.reasoning).toBe('Regime analysis: Reflation');
    });

    it('should return 400 if assets array is missing or invalid', async () => {
      const { req, res } = createMockReqRes({ assets: 'invalid' });
      const handler = getHandler('/analyze-regime', 'post');

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Data aset tidak valid');
    });
  });

  describe('POST /analyze-macro-feed', () => {
    it('should analyze macro feed and update market data service', async () => {
      const mockAnalysis = { impact: 'BULLISH', score: 8 };
      vi.mocked(macroAiService.analyzeMacroFeed).mockResolvedValue(mockAnalysis as any);

      const { req, res } = createMockReqRes({
        headline: 'Fed Cuts Rates',
        targetAsset: 'XAUUSD',
      });
      const handler = getHandler('/analyze-macro-feed', 'post');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.analysis).toEqual(mockAnalysis);
      expect(marketDataService.updateNewsAnalysis).toHaveBeenCalledWith('Fed Cuts Rates', mockAnalysis);
    });

    it('should return 400 if headline or targetAsset missing', async () => {
      const { req, res } = createMockReqRes({ headline: 'Fed Cuts Rates' });
      const handler = getHandler('/analyze-macro-feed', 'post');

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /chat', () => {
    it('should handle chat stream and return response', async () => {
      vi.mocked(macroAiService.chatStream).mockResolvedValue({
        text: 'Market outlook is optimistic.',
        toolsUsed: ['macro-regime'],
      } as any);

      const { req, res } = createMockReqRes({
        messages: [{ role: 'user', content: 'What is current regime?' }],
      });
      const handler = getHandler('/chat', 'post');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.reply).toBe('Market outlook is optimistic.');
      expect(res.body.toolsUsed).toEqual(['macro-regime']);
    });

    it('should return 400 if messages is empty', async () => {
      const { req, res } = createMockReqRes({ messages: [] });
      const handler = getHandler('/chat', 'post');

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
