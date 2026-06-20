type TokenBucket = {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
};

const buckets: Record<string, TokenBucket> = {};

export class RateLimiter {
  static create(config: {
    key: string;
    capacity: number;
    refillRate: number;
  }): RateLimiter {
    return new RateLimiter(config);
  }

  private constructor(private config: {
    key: string;
    capacity: number;
    refillRate: number;
  }) {
    buckets[config.key] = {
      tokens: config.capacity,
      lastRefill: Date.now(),
      capacity: config.capacity,
      refillRate: config.refillRate,
    };
  }

  async consume(tokens: number = 1): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    const bucket = buckets[this.config.key];
    if (!bucket) return { allowed: false, retryAfter: 0 };

    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + timePassed * bucket.refillRate
    );
    bucket.lastRefill = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return { allowed: true };
    }

    const waitTime = Math.ceil((tokens - bucket.tokens) / bucket.refillRate);
    return { allowed: false, retryAfter: waitTime };
  }
}

export const API_LIMITS = {
  FINNHUB: RateLimiter.create({
    key: "finnhub",
    capacity: 60,
    refillRate: 1,
  }),
  ALPHA_VANTAGE: RateLimiter.create({
    key: "alpha_vantage",
    capacity: 5,
    refillRate: 1,
  }),
  TWELVE_DATA: RateLimiter.create({
    key: "twelve_data",
    capacity: 8,
    refillRate: 1,
  }),
  TRADING_VIEW: RateLimiter.create({
    key: "trading_view",
    capacity: 10,
    refillRate: 1,
  }),
  FRED: RateLimiter.create({
    key: "fred",
    capacity: 30,
    refillRate: 1,
  }),
  TRADING_ECONOMICS: RateLimiter.create({
    key: "trading_economics",
    capacity: 10,
    refillRate: 1,
  }),
  RSS_BRIDGE: RateLimiter.create({
    key: "rss_bridge",
    capacity: 4,
    refillRate: 1,
  }),
};