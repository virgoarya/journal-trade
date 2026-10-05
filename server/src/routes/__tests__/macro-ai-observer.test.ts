import { describe, it, expect, vi, beforeEach } from 'vitest';
import macroAiObserverRoutes from '../macro-ai-observer.routes';
import { macroAiService } from '../../services/macro-ai.service';

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
}));

vi.mock('../../services/macro-ai.service', () => ({
  macroAiService: {
    observePlaybook: vi.fn(),
    clearPlaybookCache: vi.fn(),
  },
}));

function createMockReqRes(body = {}) {
  const req: any = { body, user: { id: 'test-user-123' } };
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
  const layer = (macroAiObserverRoutes.stack as any[]).find((l) => {
    return l.route?.path === path && l.route?.methods[method];
  });
  if (!layer) throw new Error(`Route layer not found for ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

describe('Macro AI Observer API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /observe-playbook', () => {
    it('should return playbook from observePlaybook service', async () => {
      const mockPlaybook = {
        regime: 'Goldilocks',
        entries: [{ action: 'BUY', symbol: 'XAUUSD', rationale: 'Strong momentum' }],
      };
      vi.mocked(macroAiService.observePlaybook).mockResolvedValue(mockPlaybook as any);

      const { req, res } = createMockReqRes({
        regime: 'Goldilocks',
        assets: [{ ticker: 'XAUUSD', name: 'Gold', change: 1.2 }],
        liquidityStatus: 'NEUTRAL',
        regimeDescription: 'Growth above trend',
      });
      const handler = getHandler('/observe-playbook', 'post');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.regime).toBe('Goldilocks');
      expect(res.body.data.entries).toHaveLength(1);
    });

    it('should return 400 for invalid regime', async () => {
      const { req, res } = createMockReqRes({
        regime: 'InvalidRegime',
        assets: [],
        liquidityStatus: 'NEUTRAL',
        regimeDescription: 'Test',
      });
      const handler = getHandler('/observe-playbook', 'post');

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid regime');
    });

    it('should handle service error', async () => {
      vi.mocked(macroAiService.observePlaybook).mockRejectedValue(new Error('Service error'));

      const { req, res } = createMockReqRes({
        regime: 'Goldilocks',
        assets: [],
        liquidityStatus: 'NEUTRAL',
        regimeDescription: 'Test',
      });
      const handler = getHandler('/observe-playbook', 'post');

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /clear-cache', () => {
    it('should clear cache and return success', async () => {
      const { req, res } = createMockReqRes({});
      const handler = getHandler('/clear-cache', 'post');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Cache cleared');
      expect(macroAiService.clearPlaybookCache).toHaveBeenCalled();
    });
  });
});