import { describe, it, expect, vi, beforeEach } from 'vitest';
import paymentRoutes from '../payment.routes';
import { getPricingCatalog } from '../../config/payment-pricing';
import { getPaymentStatus } from '../../services/payment.service';

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'u1', email: 'a@b.c' };
    next();
  },
}));

vi.mock('../../services/midtrans.service', () => ({
  createSnapToken: vi.fn().mockResolvedValue('mock-snap-token'),
  getTransactionStatus: vi.fn().mockResolvedValue({
    transaction_status: 'settlement',
    transaction_id: 'txn_123',
    gross_amount: '3500000',
    status_code: '200',
    order_id: 'pkg_test-user_premium_1690000000',
  }),
}));

vi.mock('../../services/payment.service', () => ({
  verifyMidtransSignature: vi.fn().mockReturnValue(true),
  parseOrderId: vi.fn().mockImplementation((orderId: string) => {
    if (orderId.startsWith('pkg_')) {
      const parts = orderId.split('_');
      return {
        orderType: 'package',
        userId: parts[1],
        packageType: parts[2] || 'premium',
      };
    }
    return {
      orderType: 'registration',
      userId: 'test-user',
    };
  }),
  handlePaymentSuccess: vi.fn().mockResolvedValue('Package premium activated'),
  getPaymentStatus: vi.fn(),
}));

vi.mock('../../models/Transaction', () => ({
  Transaction: {
    findOne: vi.fn().mockImplementation(() => Promise.resolve(null)),
    create: vi.fn().mockImplementation(() => Promise.resolve({})),
  },
}));

vi.mock('../../models/Registration', () => ({
  Registration: {
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
    findOne: vi.fn().mockReturnValue({
      lean: () => Promise.resolve(null),
    }),
  },
}));

vi.mock('../../models/Subscription', () => ({
  Subscription: { findOneAndUpdate: vi.fn().mockResolvedValue({}) },
}));

function createMockReqRes(body = {}, query = {}, params = {}) {
  const userId = params.userId || 'test-user-123';
  const req: any = { body, query, params, user: { id: userId } };
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
  const layer = (paymentRoutes.stack as any[]).find((l) => {
    return l.route?.path === path && l.route?.methods[method];
  });
  if (!layer) throw new Error(`Route layer not found for ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

describe('Payment API Routes — package-based model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /v1/payment/prices — price catalog (public, no auth)', () => {
    it('should return catalog with basic, pro, premium packages with correct shape', async () => {
      const { req, res } = createMockReqRes({}, {}, {});

      const handler = getHandler('/prices', 'get');
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.currency).toBe('IDR');
      expect(res.body.boosterDiscountRate).toBe(0.1);
      expect(res.body.boosterAppliesTo).toEqual(['package']);

      expect(res.body.registration).toHaveProperty('amountIDR');
      expect(res.body.registration.amountIDR).toBe(150_000);
      expect(res.body.registration.label).toBe('Registration & AI Trading Access');

      for (const pkg of ['basic', 'pro', 'premium'] as const) {
        expect(res.body.packages[pkg]).toHaveProperty('type');
        expect(res.body.packages[pkg]).toHaveProperty('amountIDR');
        expect(res.body.packages[pkg]).toHaveProperty('baseAmountIDR');
        expect(res.body.packages[pkg]).toHaveProperty('durationMs');
        expect(res.body.packages[pkg]).toHaveProperty('label');
        expect(res.body.packages[pkg].amountIDR).toBeGreaterThan(0);
      }
    });

    it('should apply booster discount when isBooster=true', async () => {
      const { req, res } = createMockReqRes({}, { isBooster: 'true' }, {});

      const handler = getHandler('/prices', 'get');
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const base = getPricingCatalog(false);
      const boosted = getPricingCatalog(true);

      for (const pkg of ['basic', 'pro', 'premium'] as const) {
        const discounted = Math.round(
          base.packages[pkg].amountIDR * (1 - base.boosterDiscountRate)
        );
        expect(res.body.packages[pkg].amountIDR).toBe(discounted);
        expect(res.body.packages[pkg].amountIDR).toBe(boosted.packages[pkg].amountIDR);
      }
    });

    it('should return registration price in catalog', async () => {
      const { req, res } = createMockReqRes({}, {}, {});

      const handler = getHandler('/prices', 'get');
      await handler(req, res);

      expect(res.body.registration.amountIDR).toBe(150_000);
    });

    it('should handle service error gracefully', async () => {
      const pricingModule = await import('../../config/payment-pricing');
      vi.spyOn(pricingModule, 'getPricingCatalog').mockImplementationOnce(() => {
        throw new Error('Pricing service error');
      });

      const { req, res } = createMockReqRes({}, {}, {});
      const handler = getHandler('/prices', 'get');
      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to get pricing catalog');
    });
  });

  describe('POST /v1/payment/token — create Snap token', () => {
    it('should return token and orderId for valid package request', async () => {
      const { req, res } = createMockReqRes({
        userId: 'test-user',
        amountIDR: 3_500_000,
        isBooster: false,
        orderType: 'package',
        packageType: 'premium',
      });

      const handler = getHandler('/token', 'post');
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('orderId');
      expect(res.body.orderId).toMatch(/^pkg_test-user_premium_\d+$/);
    });

    it('should reject invalid amountIDR (does not match price table)', async () => {
      const { req, res } = createMockReqRes({
        userId: 'test-user',
        amountIDR: 1,
        isBooster: false,
        orderType: 'package',
        packageType: 'premium',
      });

      const handler = getHandler('/token', 'post');
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/does not match the price table/);
    });

    it('should reject invalid packageType', async () => {
      const { req, res } = createMockReqRes({
        userId: 'test-user',
        amountIDR: 3_500_000,
        isBooster: false,
        orderType: 'package',
        packageType: 'invalid' as any,
      });

      const handler = getHandler('/token', 'post');
      await handler(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /v1/payment/status-for-user/:userId — gate AI Trading page', () => {
    it('should return package-based status with isPaid=true for paid user', async () => {
      const { getPaymentStatus } = await import('../../services/payment.service');
      vi.mocked(getPaymentStatus).mockResolvedValue({
        isRegistered: true,
        hasAccess: true,
        isBooster: false,
        plan: 'premium',
        is_lifetime: true,
        accessEndDate: null,
      });

      const { req, res } = createMockReqRes({}, {}, { userId: 'paid-user' });

      const handler = getHandler('/status-for-user/:userId', 'get');
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.userId).toBe('paid-user');
      expect(res.body.hasAccess).toBe(true);
      expect(res.body.isBooster).toBe(false);
      expect(res.body.plan).toBe('premium');
      expect(res.body.is_lifetime).toBe(true);
      expect(res.body.accessEndDate).toBeNull();
    });

    it('should return hasAccess=false for lapsed user', async () => {
      const { getPaymentStatus } = await import('../../services/payment.service');
      vi.mocked(getPaymentStatus).mockResolvedValue({
        isRegistered: true,
        hasAccess: false,
        isBooster: false,
        plan: 'basic',
        is_lifetime: false,
        accessEndDate: new Date().toISOString(),
      });

      const { req, res } = createMockReqRes({}, {}, { userId: 'lapsed-user' });

      const handler = getHandler('/status-for-user/:userId', 'get');
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.hasAccess).toBe(false);
      expect(res.body.plan).toBe('basic');
    });

    it('should handle service error gracefully', async () => {
      const { getPaymentStatus } = await import('../../services/payment.service');
      vi.mocked(getPaymentStatus).mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({}, {}, { userId: 'error-user' });

      const handler = getHandler('/status-for-user/:userId', 'get');
      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to get payment status');
    });
  });

  describe('POST /v1/payment/confirm — fallback confirm', () => {
    it('should confirm payment for valid settlement order', async () => {
      const { getTransactionStatus } = await import('../../services/midtrans.service');
      vi.mocked(getTransactionStatus).mockResolvedValue({
        transaction_status: 'settlement',
        transaction_id: 'txn_123',
        gross_amount: '3500000',
      });
      const paymentModule = await import('../../services/payment.service');
      vi.mocked(paymentModule.parseOrderId).mockImplementation((orderId: string) => {
        if (orderId.startsWith('pkg_')) {
          const parts = orderId.split('_');
          return { orderType: 'package', userId: parts[1], packageType: parts[2] || 'premium' };
        }
        return { orderType: 'registration', userId: 'test-user' };
      });
      vi.mocked(paymentModule.handlePaymentSuccess).mockResolvedValue('Package premium activated');

      const { req, res } = createMockReqRes({
        orderId: 'pkg_test-user_premium_1690000000',
      });

      const handler = getHandler('/confirm', 'post');
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('Package premium activated');
    });

    it('should reject non-settlement status', async () => {
      const { getTransactionStatus } = await import('../../services/midtrans.service');
      vi.mocked(getTransactionStatus).mockResolvedValue({
        transaction_status: 'pending',
        transaction_id: 'txn_123',
        gross_amount: '3500000',
      });

      const { req, res } = createMockReqRes({
        orderId: 'pkg_test-user_premium_1690000000',
      });

      const handler = getHandler('/confirm', 'post');
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Payment not completed/);
    });
  });
});