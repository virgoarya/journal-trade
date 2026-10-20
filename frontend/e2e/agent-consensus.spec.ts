/**
 * Task 3.4 — E2E: Agent Consensus UI
 *
 * Selectors are taken from source, not guessed:
 *   AgentBreakdown.tsx:155  aria-label="Vote distribution by agent"
 *   AgentBreakdown.tsx:190  aria-label="Consensus score: <n>%"
 *   AgentBreakdown.tsx:222  aria-label="<Persona> agent: <BIAS>"
 *   AgentBreakdown.tsx:288  aria-label="Verdict: <GOOD|BAD|SKIP>"
 *   AgentBreakdown.tsx:300  "Agent Bias Radar"
 *   AgentBreakdown.tsx:311  role="list" aria-label="Agent breakdown"
 *
 * Every API mock returns the apiClient envelope { success, data } — the service
 * bails out early on !res.success, which silently produced empty screens before.
 */
import { test, expect, type Page } from '@playwright/test';

const AGENT_CONSENSUS = {
  verdict: 'GOOD',
  consensus: 'CONSENSUS: BULLISH with HIGH conviction',
  goodVotes: 2,
  totalVotes: 3,
  votes: [
    { persona: 'hawk', bias: 'BEARISH', reasoning: 'High risk in current setup' },
    { persona: 'dove', bias: 'BULLISH', reasoning: 'Good momentum and breakout' },
    { persona: 'contrarian', bias: 'NEUTRAL', reasoning: 'Wait for confirmation' },
  ],
};

const PIPELINE_STATUS = {
  running: true,
  paused: false,
  startedAt: '2026-01-01T00:00:00.000Z',
  config: { agentConsensus: { enabled: true, threshold: 0.6, memoryEnabled: true } },
  lastSignal: null,
  lastAnalysis: null,
  allAnalyses: [],
  lastError: null,
  metrics: { openPositions: 0 },
  agentConsensus: AGENT_CONSENSUS,
};

const PERFORMANCE = {
  totalTrades: 100,
  winningTrades: 65,
  losingTrades: 35,
  totalPnL: 1500,
  winRate: 65,
  methodologyStats: [
    { methodology: 'trend-following', totalTrades: 40, winningTrades: 26, losingTrades: 14, totalPnL: 900, winRate: 65, avgConfidence: 0.8 },
    { methodology: 'breakout', totalTrades: 60, winningTrades: 39, losingTrades: 21, totalPnL: 600, winRate: 65, avgConfidence: 0.7 },
  ],
  symbolStats: [
    { symbol: 'XAUUSD', totalTrades: 100, winningTrades: 65, losingTrades: 35, totalPnL: 1500, winRate: 65 },
  ],
  equityCurve: [{ time: '2026-01-01T00:00:00.000Z', equity: 10000 }],
  recentTrades: [],
};

const ok = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
});

/**
 * Registers every route the /ai-trading page needs.
 *
 * Playwright matches routes in reverse registration order, so the broad
 * catch-all is registered FIRST (lowest priority) and specific routes after.
 */
async function mockPage(page: Page) {
  await page.route('**/api/v1/**', (route) => route.fulfill(ok({})));

  // Dashboard shell — wrong types here crash the whole layout.
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) })
  );
  await page.route('**/api/v1/trading-accounts**', (route) => route.fulfill(ok([])));
  await page.route('**/api/v1/notifications**', (route) => route.fulfill(ok([])));
  await page.route('**/api/v1/settings**', (route) =>
    route.fulfill(ok({ appearance: { theme: 'dark', accentColor: '#d4af37' } }))
  );

  // MT5 session — `isConnected` gates the entire page body (page.tsx:241).
  await page.route('**/api/v1/ai-trading/status**', (route) =>
    route.fulfill(ok({ connected: true, reconnecting: false, accountInfo: null, pipeline: PIPELINE_STATUS }))
  );

  // usePipeline() polls status-with-logs, NOT status.
  // Playwright matches routes in REVERSE registration order, so the more
  // specific pattern must be registered LAST or it never wins.
  await page.route('**/api/v1/ai-trading/pipeline/status**', (route) =>
    route.fulfill(ok({ ...PIPELINE_STATUS, agentConsensus: AGENT_CONSENSUS }))
  );
  await page.route('**/api/v1/ai-trading/pipeline/status-with-logs**', (route) =>
    route.fulfill(ok({ status: { ...PIPELINE_STATUS, agentConsensus: AGENT_CONSENSUS }, logs: [] }))
  );

  await page.route('**/api/v1/ai-trading/performance**', (route) => route.fulfill(ok(PERFORMANCE)));
  await page.route('**/api/v1/ai-trading/symbols**', (route) =>
    route.fulfill(ok({ symbols: [{ symbol: 'XAUUSD', name: 'Gold' }] }))
  );
  await page.route('**/api/v1/agent-consensus/**', (route) => route.fulfill(ok(AGENT_CONSENSUS)));
}

test.describe('Agent Consensus E2E', () => {
  test.beforeEach(async ({ page }) => {
    await mockPage(page);
    await page.goto('/ai-trading', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the app to settle instead of a fixed sleep — the dev server on
    // the D: drive is slow enough that a 3s pause was flaky under parallel workers.
    await expect(
      page
        .getByRole('list', { name: 'Agent breakdown' })
        .or(page.getByText('No agent consensus data available'))
    ).toBeVisible({ timeout: 30000 });

    // The onboarding overlay's backdrop (z-[9998]) intercepts pointer events,
    // so every click-based assertion fails until it is dismissed.
    const skip = page.getByRole('button', { name: 'Skip' });
    if (await skip.count()) {
      await skip.first().click({ timeout: 5000 }).catch(() => {});
    }
  });

  test('should render the AI Trading page (not a 404)', async ({ page }) => {
    await expect(page).toHaveURL(/.*ai-trading.*/);
    // A 404 also satisfies the URL + body checks, so assert on the real page.
    await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render the Agent Breakdown section', async ({ page }) => {
    await expect(page.getByRole('list', { name: 'Agent breakdown' })).toBeVisible({ timeout: 15000 });
  });

  test('should show one agent card per persona with its bias', async ({ page }) => {
    await expect(page.locator('[aria-label="Hawk agent: BEARISH"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[aria-label="Dove agent: BULLISH"]')).toBeVisible();
    await expect(page.locator('[aria-label="Contrarian agent: NEUTRAL"]')).toBeVisible();
  });

  test('should show the verdict badge', async ({ page }) => {
    await expect(page.locator('[aria-label="Verdict: GOOD"]')).toBeVisible({ timeout: 15000 });
  });

  test('should show the consensus score', async ({ page }) => {
    await expect(page.locator('[aria-label^="Consensus score:"]')).toBeVisible({ timeout: 15000 });
  });

  test('should show vote distribution', async ({ page }) => {
    await expect(page.getByRole('list', { name: 'Vote distribution by agent' })).toBeVisible({ timeout: 15000 });
  });

  test('should show the agent bias radar chart', async ({ page }) => {
    await expect(page.locator('[aria-label="Agent bias radar chart"]')).toBeVisible({ timeout: 15000 });
  });

  test('should reveal agent reasoning when a card is expanded', async ({ page }) => {
    // AgentCard renders with aria-expanded="true" by default, so the reasoning
    // is already on screen — the overlay was the only thing blocking access.
    await expect(page.locator('[aria-label="Hawk agent: BEARISH"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('High risk in current setup')).toBeVisible({ timeout: 15000 });
  });

  test('should degrade gracefully when agent consensus is unavailable', async ({ page }) => {
    // Re-registering mockPage would invert Playwright's route priority, so
    // override just the two pipeline routes.
    await page.unroute('**/api/v1/ai-trading/pipeline/status-with-logs**');
    await page.unroute('**/api/v1/ai-trading/pipeline/status**');
    await page.route('**/api/v1/ai-trading/pipeline/status-with-logs**', (route) =>
      route.fulfill(ok({ status: { ...PIPELINE_STATUS, agentConsensus: null }, logs: [] }))
    );
    await page.route('**/api/v1/ai-trading/pipeline/status**', (route) =>
      route.fulfill(ok({ ...PIPELINE_STATUS, agentConsensus: null }))
    );

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByText('No agent consensus data available')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render pipeline performance metrics', async ({ page }) => {
    await expect(page.getByText('Total PnL', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('$1500.00').first()).toBeVisible();
  });
});
