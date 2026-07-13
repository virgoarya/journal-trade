# Next Steps Enhancements Plan

**Project:** Hunter Trades Journal - AI Trading System  
**Created:** 2026-07-12  
**Status:** Planning Phase  
**Priority:** Medium (Post-MVP Enhancements)

---

## Overview

This plan covers 6 optional enhancements to improve the AI Trading System's observability, deployment safety, user experience, and operational autonomy. Each enhancement is independent but some have dependencies.

---

## 1. WebSocket untuk Real-time Updates

### Objective
Replace HTTP polling (30s account, 10s positions, 10s pipeline) with WebSocket push for real-time UI updates.

### Scope
- **Backend:** Add WebSocket server (reuse existing `ws-server.ts`), define` in `index.ts`)
- **Frontend:** Replace `useAccountInfo`, `usePositions`, `usePipeline` polling with WebSocket subscriptions
- **Events:** `account.update`, `positions.update`, `pipeline.status`, `pipeline.log`, `trade.executed`

### Technical Design
```typescript
// Backend: ws-server.ts
interface WSMessage {
  type: 'account' | 'positions' | 'pipeline_status' | 'pipeline_log' | 'trade';
  payload: any;
  timestamp: string;
}

// Frontend: hooks/useWS.ts
function usePipelineWS() {
  const [status, setStatus] = useState<PipelineStatus>();
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch(msg.type) {
        case 'pipeline_status': setStatus(msg.payload); break;
        case 'pipeline_log': setLogs(prev => [...prev, msg.payload]); break;
      }
    };
    return () => ws.close();
  }, []);
}
```

### Dependencies
- Existing `ws` server in `index.ts` (line 171-177)
- Authentication via cookie/token handshake

### Validation
- [ ] Latency < 100ms from backend event to frontend update
- [ ] Reconnection with exponential backoff on disconnect
- [ ] Auth validation on WS connect
- [ ] Fallback to polling if WS fails

---

## 2. Distributed Tracing dengan OpenTelemetry

### Objective
End-to-end visibility of request flow: Frontend → API → Services → MT5/LLM.

### Scope
- **Instrumentation:** HTTP server, service-to-service calls, MT5 MCP, LLM providers
- **Exporter:** OTLP to Jaeger/Grafana Tempo (configurable)
- **Context Propagation:** Trace ID via HTTP headers (`traceparent`)

### Technical Design
```typescript
// server/src/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
  serviceName: 'hunter-trades-api',
});

sdk.start();
```

### Service-Level Spans
```typescript
// mt5-mcp.service.ts
async call(tool, args) {
  return tracer.startActiveSpan(`mt5.${tool}`, async (span) => {
    span.setAttribute('mt5.tool', tool);
    try {
      const result = await this.client.callTool({ name: tool, arguments: args });
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### Dependencies
- `@opentelemetry/*` packages
- Jaeger/Tempo instance (dev: Docker, prod: managed)

### Validation
- [ ] Trace visible in Jaeger for: `/pipeline/start` → `analyzeSymbols` → `mt5_copy_rates` → `llmConsensus` → `mt5_order_send`
- [ ] Error spans show stack traces
- [ ] Latency percentiles (p50, p95, p99) per operation

---

## 3. Automated Canary Deployment

### Objective
Zero-downtime deployment with automatic rollback on metric degradation.

### Scope
- **Pipeline:** GitHub Actions / GitLab CI
- **Strategy:** Blue/Green with traffic shifting (10% → 50% → 100%)
- **Metrics:** Error rate, latency p99, pipeline start success rate
- **Rollback:** Automatic if error rate > 5% or p99 latency > 2x baseline

### Technical Design
```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Build & Push Image
        run: docker build -t hunter-trades:${{ github.sha }} .
      - name: Deploy to Staging (Green)
        run: kubectl set image deployment/pipeline pipeline=hunter-trades:${{ github.sha }} -n staging
      - name: Canary Analysis (10% traffic, 10min)
        uses: kayenta/kayenta-action@v1
        with:
          metrics: error_rate,latency_p99,start_success_rate
          thresholds: error_rate<0.05,latency_p99<2x,start_success_rate>0.95
      - name: Promote to Production
        if: success()
        run: kubectl set image deployment/pipeline pipeline=hunter-trades:${{ github.sha }} -n production
      - name: Rollback on Failure
        if: failure()
        run: kubectl rollout undo deployment/pipeline -n production
```

### Health Checks for Canary
```typescript
// server/src/routes/health.ts
router.get('/health/canary', async (req, res) => {
  const checks = await Promise.all([
    checkMT5Connection(),
    checkLLMProviders(),
    checkDatabase(),
    checkRedis(),
  ]);
  const healthy = checks.every(c => c.ok);
  res.status(healthy ? 200 : 503).json({ healthy, checks });
});
```

### Dependencies
- Kubernetes (or Docker Swarm) with ingress controller supporting weighted routing
- Prometheus/Grafana for metrics
- Kayenta/Flagger/Argo Rollouts for canary analysis

### Validation
- [ ] Deploy completes in < 15 min
- [ ] Automatic rollback triggers on injected failure
- [ ] Zero downtime during deployment
- [ ] Canary metrics dashboard visible

---

## 4. Advanced Backtest Visualization

### Objective
Interactive equity curves, drawdown charts, and methodology comparison per symbol.

### Scope
- **Frontend:** New `/dashboard/backtest/analysis` page
- **Charts:** Equity curve, underwater plot, monthly heatmap, rolling Sharpe
- **Filters:** Date range, methodology, symbol, risk settings
- **Export:** PNG/CSV report generation

### Technical Design
```tsx
// frontend/src/app/(dashboard)/backtest/analysis/page.tsx
import { 
  EquityCurveChart, 
  DrawdownChart, 
  MonthlyHeatmap, 
  RollingMetricsChart,
  MethodologyComparison 
} from '@/components/backtest';

export default function BacktestAnalysisPage() {
  const { data: backtests } = useBacktestData();
  const [filters, setFilters] = useState({ 
    methodology: 'all', 
    symbol: 'all',
    dateRange: { from: subMonths(new Date(), 6), to: new Date() }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
      <EquityCurveChart data={backtests} filters={filters} className="xl:col-span-2" />
      <DrawdownChart data={backtests} filters={filters} />
      <MonthlyHeatmap data={backtests} filters={filters} />
      <RollingMetricsChart data={backtests} filters={filters} className="xl:col-span-2" />
      <MethodologyComparison data={backtests} filters={filters} className="xl:col-span-2" />
    </div>
  );
}
```

### Backend API
```typescript
// GET /api/v1/backtest/equity-curve?symbol=EURUSD&methodology=smc&from=2024-01-01
router.get('/backtest/equity-curve', async (req, res) => {
  const trades = await AITradeLog.find({
    userId: req.user.id,
    symbol: req.query.symbol,
    'signal.primaryMethodology': req.query.methodology,
    closedAt: { $gte: req.query.from, $lte: req.query.to },
    closed: true,
  }).sort({ closedAt: 1 });

  const equity = trades.reduce((acc, t) => {
    acc.push({ time: t.closedAt, equity: acc[acc.length-1]?.equity + t.pnl || 0 });
    return acc;
  }, [{ time: req.query.from, equity: 0 }]);

  res.json({ equity, drawdown: calculateDrawdown(equity) });
});
```

### Chart Components (Recharts/Chart.js)
```tsx
// components/backtest/EquityCurveChart.tsx
export function EquityCurveChart({ data, filters }) {
  const series = useMemo(() => 
    data.map(d => ({ 
      time: d.closedAt, 
      value: d.equity,
      methodology: d.signal.primaryMethodology,
      symbol: d.signal.symbol 
    })), [data]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={series}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="time" tickFormatter={formatDate} />
        <YAxis tickFormatter={formatCurrency} />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip formatter={formatCurrency} />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#D4AF37" 
          fillOpacity={1} 
          fill="url(#equityGradient)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Validation
- [ ] Load time < 2s for 10k trades
- [ ] Interactive zoom/pan on charts
- [ ] Export PNG/CSV works
- [ ] Responsive on mobile/tablet

---

## 5. Multi-user Isolation - Per-user MT5 Connection Pool

### Objective
Isolate MT5 connections per user to prevent credential leakage and resource contention.

### Current State
- Single `mt5McpService` singleton shared across all users
- Credentials stored in `MT5Connection` model per user
- `tryAutoReconnect()` loops through all users on startup

### Target Architecture
```typescript
// server/src/services/mt5-connection-pool.ts
class MT5ConnectionPool {
  private pools: Map<string, MT5MCPService> = new Map();
  private maxPoolSize = 50; // Prevent resource exhaustion

  async getConnection(userId: string): Promise<MT5MCPService> {
    if (this.pools.has(userId)) {
      return this.pools.get(userId)!;
    }
    
    if (this.pools.size >= this.maxPoolSize) {
      // LRU eviction
      const oldest = this.pools.keys().next().value;
      await this.evict(oldest);
    }

    const conn = await this.createConnection(userId);
    this.pools.set(userId, conn);
    return conn;
  }

  private async createConnection(userId: string): Promise<MT5MCPService> {
    const creds = await MT5Connection.findOne({ userId, enabled: true });
    if (!creds) throw new Error('No MT5 credentials');
    
    const service = new MT5MCPService();
    await service.init();
    await service.connectToMT5({
      server: creds.server,
      login: String(creds.login),
      password: creds.getPassword(),
    });
    return service;
  }

  async evict(userId: string): Promise<void> {
    const conn = this.pools.get(userId);
    if (conn) {
      await conn.disconnect();
      this.pools.delete(userId);
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.pools.values()].map(c => c.disconnect()));
    this.pools.clear();
  }
}
```

### Integration Points
- `tradingPipelineService.startPipeline()` → `pool.getConnection(userId)`
- `mt5McpService` methods become instance methods (not singleton)
- Graceful shutdown on SIGTERM

### Validation
- [ ] 10 concurrent users with separate MT5 connections
- [ ] Memory usage stable under load (no leak)
- [ ] Credential isolation verified (user A cannot access user B's account)
- [ ] Eviction works when pool full

---

## 6. AI Agent untuk Monitoring & Reporting  ⭐ **FOKUS UTAMA**

### Objective
Autonomous AI agent yang memantau kesehatan sistem AI Trading 24/7, mendeteksi anomali, dan menghasilkan laporan perbaikan berkala dalam format `.md` ke direktori project.

### Scope & Responsibilities

| Area | Monitoring Targets | Alert Threshold | Action |
|------|-------------------|-----------------|--------|
| **MT5 Connection** | Disconnect frequency, reconnect latency, order rejection rate | > 3 disconnects/hour, reject rate > 10% | Report + auto-restart suggestion |
| **Pipeline Health** | Signal generation rate, execution latency, error rate | Signal rate < 0.1/min, latency > 5s, error rate > 5% | Report + config review |
| **LLM Consensus** | Provider availability, reliability score, consensus success rate | Provider reliability < 0.3, consensus skip rate > 50% | Report + provider rotation |
| **Risk Metrics** | Daily drawdown, margin level, correlation exposure | Drawdown > 5%, margin < 200%, correlation > 0.8 | Report + risk config review |
| **Data Quality** | MT5 rate gaps, stale symbols, corrupted candles | > 5% gaps, symbols stale > 5min | Report + data source check |
| **System Resources** | CPU, memory, disk, network | CPU > 80%, mem > 85%, disk > 90% | Report + scaling suggestion |

### Architecture

```typescript
// server/src/agents/system-monitor-agent.ts
class SystemMonitorAgent {
  private config: MonitorConfig;
  private reportDir: string;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private llm: LLMClient; // For analysis & report generation

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      checkIntervalMs: 5 * 60 * 1000, // 5 min
      reportIntervalMs: 60 * 60 * 1000, // 1 hour
      alertThresholds: DEFAULT_THRESHOLDS,
      reportDir: path.join(__dirname, '..', '..', 'monitoring-reports'),
      ...config,
    };
    this.llm = new LLMClient({ model: 'gemini-2.5-flash' });
  }

  async start(): Promise<void> {
    await fs.mkdir(this.config.reportDir, { recursive: true });
    
    // Periodic health checks
    this.timer = setInterval(() => this.runHealthChecks(), this.config.checkIntervalMs);
    
    // Periodic report generation
    setInterval(() => this.generateReport(), this.config.reportIntervalMs);
    
    // Initial run
    await this.runHealthChecks();
  }

  async runHealthChecks(): Promise<HealthCheckResult[]> {
    const results = await Promise.all([
      this.checkMT5Health(),
      this.checkPipelineHealth(),
      this.checkLLMHealth(),
      this.checkRiskMetrics(),
      this.checkDataQuality(),
      this.checkSystemResources(),
    ]);
    
    const alerts = results.filter(r => r.severity === 'critical' || r.severity === 'warning');
    if (alerts.length > 0) {
      await this.sendAlerts(alerts);
    }
    
    return results;
  }

  async checkMT5Health(): Promise<HealthCheckResult> {
    const pipelines = await this.getActivePipelines();
    const issues = [];
    
    for (const p of pipelines) {
      const conn = await this.mt5Pool.getConnection(p.userId);
      const status = await conn.getConnectionStatus();
      
      if (!status.connected) {
        issues.push({ type: 'mt5_disconnected', userId: p.userId, since: status.disconnectedAt });
      }
      
      const recentOrders = await conn.getRecentOrders(100);
      const rejectRate = recentOrders.filter(o => o.status === 'rejected').length / recentOrders.length;
      if (rejectRate > 0.1) {
        issues.push({ type: 'high_reject_rate', userId: p.userId, rate: rejectRate });
      }
    }
    
    return {
      component: 'mt5',
      timestamp: new Date(),
      severity: issues.length ? 'warning' : 'healthy',
      details: issues,
    };
  }

  async checkPipelineHealth(): Promise<HealthCheckResult> {
    const pipelines = await this.getActivePipelines();
    const issues = [];
    
    for (const p of pipelines) {
      const status = await this.pipelineService.getPipelineStatus(p.userId);
      
      // Signal generation check
      if (status.lastSignal && Date.now() - new Date(status.lastSignal.timestamp).getTime() > 30 * 60 * 1000) {
        issues.push({ type: 'no_signal', userId: p.userId, lastSignal: status.lastSignal });
      }
      
      // Error rate
      const recentErrors = status.logs.filter(l => l.type === 'ERROR' && Date.now() - new Date(l.time).getTime() < 3600000).length;
      if (recentErrors > 10) {
        issues.push({ type: 'high_error_rate', userId: p.userId, count: recentErrors });
      }
      
      // Execution latency
      const recentTrades = status.logs.filter(l => l.type === 'TRADE' && Date.now() - new Date(l.time).getTime() < 3600000);
      const avgLatency = recentTrades.reduce((sum, t) => sum + (t.data?.latencyMs || 0), 0) / recentTrades.length;
      if (avgLatency > 5000) {
        issues.push({ type: 'high_latency', userId: p.userId, avgMs: avgLatency });
      }
    }
    
    return {
      component: 'pipeline',
      timestamp: new Date(),
      severity: issues.some(i => i.type === 'high_error_rate') ? 'critical' : issues.length ? 'warning' : 'healthy',
      details: issues,
    };
  }

  async checkLLMHealth(): Promise<HealthCheckResult> {
    const providers = await this.llmConsensus.getAvailableProviders();
    const issues = [];
    
    for (const p of providers) {
      if (!p.available) {
        issues.push({ type: 'provider_unavailable', provider: p.name });
      }
      
      const reliability = this.getProviderReliability(p.name);
      if (reliability < 0.3) {
        issues.push({ type: 'low_reliability', provider: p.name, score: reliability });
      }
    }
    
    const consensusStats = await this.getConsensusStats(3600000); // last hour
    if (consensusStats.skipRate > 0.5) {
      issues.push({ type: 'high_skip_rate', rate: consensusStats.skipRate });
    }
    
    return {
      component: 'llm_consensus',
      timestamp: new Date(),
      severity: issues.some(i => i.type === 'provider_unavailable') ? 'critical' : issues.length ? 'warning' : 'healthy',
      details: issues,
    };
  }

  async generateReport(): Promise<void> {
    const checks = await this.runHealthChecks();
    const criticalAlerts = checks.flatMap(c => c.details.filter(d => d.type.includes('critical') || d.severity === 'critical'));
    const warnings = checks.flatMap(c => c.details.filter(d => d.severity === 'warning'));
    
    const prompt = `
Anda adalah System Reliability Engineer. Analisis hasil health check sistem AI Trading berikut dan buat laporan perbaikan dalam format Markdown.

## Health Check Results (${new Date().toISOString()})
${JSON.stringify(checks, null, 2)}

## Critical Alerts: ${criticalAlerts.length}
## Warnings: ${warnings.length}

Buat laporan dengan struktur:
1. **Executive Summary** (2-3 kalimat)
2. **Critical Issues** (prioritas perbaikan)
3. **Warnings** (perbaikan preventif)
4. **Recommended Actions** (langkah konkret, prioritas, estimasi effort)
5. **Metrics Dashboard** (key metrics table)

Gunakan bahasa Indonesia, teknis tapi readable. Output hanya Markdown.
`;

    const report = await this.llm.generate(prompt);
    const filename = `monitoring-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    await fs.writeFile(path.join(this.config.reportDir, filename), report);
    
    // Also update latest.md symlink
    await fs.writeFile(path.join(this.config.reportDir, 'latest.md'), report);
  }
}
```

### Report Output Format (`.md`)

```markdown
# System Monitoring Report - 2026-07-12T19:30:00+07:00

## Executive Summary
Sistem AI Trading berjalan dengan **2 critical issues** dan **5 warnings**. MT5 connection untuk user `trader_001` terputus sejak 19:15, dan LLM provider `claude-opus` reliability turun ke 0.25. Pipeline signal generation normal.

---

## Critical Issues

### 1. MT5 Disconnection - User: trader_001
- **Since:** 2026-07-12T19:15:22+07:00 (15 menit)
- **Impact:** Pipeline auto-paused, no trade execution
- **Root Cause:** MT5 MCP server process terminated (OOM kill suspected)
- **Action Required:** 
  1. Restart MT5 MCP service: `systemctl restart mt5-mcp`
  2. Verify MT5 terminal running on Windows host
  3. Check memory limits in Docker/Podman config

### 2. LLM Provider Reliability - claude-opus
- **Current Score:** 0.25 (threshold: 0.5)
- **Trend:** Menurun dari 0.85 (24h lalu)
- **Root Cause:** Rate limit / quota exhausted di FlatKey router
- **Action Required:**
  1. Switch ke provider backup (gemini, mistral)
  2. Request quota increase ke FlatKey
  3. Implement circuit breaker cooldown tuning

---

## Warnings

| Component | Issue | Severity | Since | Recommended Action |
|-----------|-------|----------|-------|-------------------|
| Pipeline | High error rate (12/hr) | Warning | 19:00 | Review MT5 order validation logic |
| Risk | Daily drawdown 4.2% (limit 5%) | Warning | 18:30 | Reduce maxRiskPerTrade ke 0.5% |
| Data | EURUSD rate gap 8% | Warning | 19:10 | Verify MT5 rate feed stability |
| Resources | Memory 82% | Warning | 19:25 | Scale pod atau optimasi cache |

---

## Recommended Actions (Prioritized)

| Priority | Action | Effort | Owner | Deadline |
|----------|--------|--------|-------|----------|
| P0 | Restart MT5 MCP service | 5 min | DevOps | Now |
| P0 | Rotate LLM provider ke gemini | 10 min | Backend | Now |
| P1 | Tune MT5 order validation | 2 hr | Backend | Tomorrow |
| P1 | Reduce maxRiskPerTrade | 5 min | User/Config | Today |
| P2 | Implement MT5 connection health endpoint | 4 hr | Backend | This Week |
| P2 | Add LLM provider auto-failover | 1 day | Backend | Next Sprint |

---

## Metrics Dashboard (Last 24h)

| Metric | Current | 24h Avg | Trend | Status |
|--------|---------|---------|-------|--------|
| MT5 Uptime | 93.7% | 99.2% | 📉 | ⚠️ |
| Pipeline Signal Rate | 2.3/min | 4.1/min | 📉 | ⚠️ |
| LLM Consensus Success | 68% | 85% | 📉 | ⚠️ |
| Trade Execution Latency | 1.2s | 0.8s | 📈 | ✅ |
| Daily PnL | +$234.50 | +$1,200 | 📉 | ✅ |
| Max Drawdown | 4.2% | 2.1% | 📈 | ⚠️ |
| MT5 Reject Rate | 8.5% | 2.1% | 📈 | ⚠️ |

---

*Generated by SystemMonitorAgent v1.0 | Next report: 2026-07-12T20:30:00+07:00*
```

### Implementation Plan for Agent #6

| Phase | Task | Deliverable | Timeline |
|-------|------|-------------|----------|
| **1. Foundation** | Create `SystemMonitorAgent` class with config | `server/src/agents/system-monitor-agent.ts` | Week 1 |
| **2. Health Checks** | Implement 6 check methods (MT5, Pipeline, LLM, Risk, Data, Resources) | All `check*()` methods | Week 1-2 |
| **3. LLM Integration** | Connect to existing `llmConsensusService` for analysis | `LLMClient` wrapper | Week 2 |
| **3. Report Generation** | Prompt engineering untuk report format | `generateReport()` method | Week 2 |
| **4. Alerting** | Webhook/Email/Slack notification untuk critical alerts | `sendAlerts()` | Week 2 |
| **5. Persistence** | Save reports ke `monitoring-reports/` + `latest.md` symlink | File I/O | Week 2 |
| **6. Scheduler** | Integrate ke `index.ts` startup, graceful shutdown | `index.ts` integration | Week 2 |
| **7. Dashboard (Optional)** | Simple HTML viewer untuk report history | `monitoring-dashboard.html` | Week 3 |

### Configuration
```typescript
// server/src/config/monitor.ts
export const monitorConfig = {
  checkIntervalMs: parseInt(process.env.MONITOR_CHECK_INTERVAL_MS || '300000'), // 5 min
  reportIntervalMs: parseInt(process.env.MONITOR_REPORT_INTERVAL_MS || '3600000'), // 1 hour
  alertThresholds: {
    mt5DisconnectThreshold: 3, // per hour
    mt5RejectRateThreshold: 0.1, // 10%
    pipelineSignalRateMin: 0.1, // per minute
    pipelineErrorRateMax: 0.05, // 5%
    llmReliabilityMin: 0.5,
    llmSkipRateMax: 0.5,
    riskDrawdownMax: 0.05, // 5%
    riskMarginMin: 200, // %
    dataGapMax: 0.05, // 5%
    cpuMax: 0.8, // 80%
    memoryMax: 0.85, // 85%
    diskMax: 0.9, // 90%
  },
  reportDir: process.env.MONITOR_REPORT_DIR || path.join(__dirname, '..', 'monitoring-reports'),
  llmModel: process.env.MONITOR_LLM_MODEL || 'gemini-2.5-flash',
  alertWebhook: process.env.MONITOR_ALERT_WEBHOOK, // Optional: Slack/Discord/Email
};
```

### Integration di `index.ts`
```typescript
import { SystemMonitorAgent } from './agents/system-monitor-agent';
import { monitorConfig } from './config/monitor';

const monitorAgent = new SystemMonitorAgent(monitorConfig);

// Start after DB connected
await monitorAgent.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await monitorAgent.stop();
  // ... existing shutdown
});
```

### Validation Criteria
- [ ] Agent starts automatically on server boot
- [ ] Reports generated hourly in `monitoring-reports/`
- [ ] `latest.md` always points to latest report
- [ ] Critical alerts trigger webhook within 1 min
- [ ] Report quality: actionable, specific, prioritized
- [ ] Zero false positives on healthy system (test dengan chaos engineering)
- [ ] Resource usage < 50MB RAM, < 2% CPU

---

## Implementation Priority & Dependencies

```
Phase 1 (Foundation - Week 1-2):
├── 1. WebSocket Real-time          (Independent)
├── 2. Distributed Tracing          (Independent, needs infra)
├── 6. AI Monitor Agent             (Independent, high value)

Phase 2 (Deployment - Week 2-3):
├── 3. Canary Deployment            (Depends on K8s/infra)
├── 5. Multi-user MT5 Pool          (Depends on Phase 1 #6 for monitoring)

Phase 3 (UX - Week 3-4):
├── 4. Backtest Visualization       (Independent, frontend only)
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WebSocket auth complexity | High | Medium | Reuse existing cookie auth, test thoroughly |
| OpenTelemetry overhead | Medium | Low | Sampling 10-20%, async export |
| Canary deployment infra | High | High | Start with staging, manual promotion first |
| MT5 pool memory leak | Medium | High | Load test 50 users, profile heap |
| AI Monitor false positives | Medium | Medium | Tuning thresholds, human-in-loop review |
| LLM report quality variance | Medium | Medium | Few-shot prompting, structured output |

---

## Success Metrics

| Enhancement | KPI | Target |
|-------------|-----|--------|
| WebSocket | Polling requests reduction | > 90% |
| Tracing | Request coverage | 100% critical paths |
| Canary | Deployment failure rate | < 1% |
| Visualization | User engagement | > 50% users/week |
| MT5 Pool | Concurrent users supported | 50+ |
| AI Monitor | MTTD (Mean Time to Detect) | < 5 min |

---

## Next Steps

1. **Review & Prioritize** - Confirm which enhancements to implement first
2. **Infrastructure Prep** - Provision Jaeger, K8s namespace, WebSocket certs
3. **Start Phase 1** - Begin with WebSocket + AI Monitor Agent (highest ROI)
4. **Iterate** - Deploy to staging, validate, promote

---

## Appendix: File Structure Changes

```
server/
├── src/
│   ├── agents/
│   │   └── system-monitor-agent.ts      # NEW: AI Monitor Agent
│   ├── config/
│   │   └── monitor.ts                   # NEW: Monitor config
│   ├── services/
│   │   ├── mt5-connection-pool.ts       # NEW: Per-user MT5 pool
│   │   └── mt5-mcp.service.ts           # MOD: Instance-based, remove singleton
│   ├── instrumentation.ts               # NEW: OpenTelemetry setup
│   ├── ws-server.ts                     # MOD: Add event types, auth
│   └── index.ts                         # MOD: Integrate monitor agent, pool
├── routes/
│   └── health.ts                        # NEW: Canary health endpoint
└── ...

frontend/
├── src/
│   ├── hooks/
│   │   ├── useWS.ts                     # NEW: WebSocket hook
│   │   ├── useAccountInfo.ts            # MOD: Replace polling
│   │   ├── usePositions.ts              # MOD: Replace polling
│   │   └── usePipeline.ts               # MOD: Replace polling
│   ├── components/
│   │   └── backtest/                    # NEW: Visualization components
│   │       ├── EquityCurveChart.tsx
│   │       ├── DrawdownChart.tsx
│   │       ├── MonthlyHeatmap.tsx
│   │       ├── RollingMetricsChart.tsx
│   │       └── MethodologyComparison.tsx
│   └── app/(dashboard)/backtest/
│       └── analysis/page.tsx            # NEW: Analysis page
```

---

*Plan ini bersifat living document - update secara berkala saat implementasi berjalan.*