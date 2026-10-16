import { describe, it, expect, vi, beforeEach } from 'vitest';
import macroRegimeRoutes from '../macro-regime.routes';
import { macroRegimeService } from '../../services/macro-regime.service';

vi.mock('../../services/macro-regime.service', () => ({
  macroRegimeService: {
    getSnapshot: vi.fn(),
  },
}));

function createMockReqRes(query: Record<string, any> = {}) {
  const req: any = { query };
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

function getHandler(path: string) {
  const layer = (macroRegimeRoutes.stack as any[]).find(
    (l) => l.route?.path === path
  );
  if (!layer) throw new Error(`Route layer not found for path ${path}`);
  return layer.route.stack[0].handle;
}

describe('MacroRegime API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /snapshot', () => {
    it('should return macro regime snapshot with 200 OK', async () => {
      const mockSnapshot = {
        quadrant: 'Goldilocks',
        source: 'YAHOO',
        fetchedAt: '2026-03-20T10:00:00.000Z',
      };
      vi.mocked(macroRegimeService.getSnapshot).mockResolvedValue(mockSnapshot as any);

      const { req, res } = createMockReqRes();
      const handler = getHandler('/snapshot');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.quadrant).toBe('Goldilocks');
      expect(res.body.data.source).toBe('YAHOO');
    });

    it('should return 503 if macroRegimeService.getSnapshot fails', async () => {
      vi.mocked(macroRegimeService.getSnapshot).mockRejectedValue(new Error('Service unavailable'));

      const { req, res } = createMockReqRes();
      const handler = getHandler('/snapshot');

      await handler(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Service unavailable');
    });
  });

  describe('GET /historical', () => {
    it('should filter historical data based on days query param', async () => {
      const mockSnapshot = {
        history: [
          { date: '2020-01-01', quadrant: 'Stagflation' },
          { date: new Date().toISOString(), quadrant: 'Goldilocks' },
        ],
      };
      vi.mocked(macroRegimeService.getSnapshot).mockResolvedValue(mockSnapshot as any);

      const { req, res } = createMockReqRes({ days: '1' });
      const handler = getHandler('/historical');

      await handler(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].quadrant).toBe('Goldilocks');
    });

    it('should handle service failure gracefully', async () => {
      vi.mocked(macroRegimeService.getSnapshot).mockRejectedValue(new Error('Historical fetch failed'));

      const { req, res } = createMockReqRes();
      const handler = getHandler('/historical');

      await handler(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Historical fetch failed');
    });
  });
});
