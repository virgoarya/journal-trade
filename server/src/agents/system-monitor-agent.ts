import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { silentLogger } from "../utils/silent-logger";
import { monitorConfig, type MonitorConfig } from "../config/monitor";
import { mt5McpService } from "../services/mt5-mcp.service";
import { llmConsensusService } from "../services/llm-consensus.service";
import { tradingPipelineService } from "../services/trading-pipeline.service";
import { AITradingSession } from "../models/AITradingSession";

interface HealthCheckResult {
  component: string;
  timestamp: string;
  severity: "healthy" | "warning" | "critical";
  summary: string;
  details: string[];
  metrics: Record<string, number | string>;
}

interface SystemReport {
  timestamp: string;
  summary: string;
  criticalIssues: string[];
  warnings: string[];
  metrics: Record<string, number | string>;
  recommendations: string[];
  rawChecks: HealthCheckResult[];
}

export class SystemMonitorAgent {
  private config: MonitorConfig;
  private checkTimer: NodeJS.Timeout | null = null;
  private reportTimer: NodeJS.Timeout | null = null;
  private running = false;
  private alertWebhook?: string;
  private readonly reportDir: string;
  private nineRouterUrl?: string;
  private nineRouterApiKey?: string;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = { ...monitorConfig, ...config };
    this.alertWebhook = this.config.alertWebhook;
    this.reportDir = this.config.reportDir;
    this.nineRouterUrl = this.config.nineRouterUrl;
    this.nineRouterApiKey = this.config.nineRouterApiKey;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    await fs.promises.mkdir(this.reportDir, { recursive: true });
    silentLogger.info(`[MONITOR-AGENT] Started (check=${this.config.checkIntervalMs}ms, report=${this.config.reportIntervalMs}ms, 9router=${this.config.nineRouterUrl ? "enabled" : "disabled"})`);

    // Initial check
    await this.runAllChecks();

    // Periodic checks
    this.checkTimer = setInterval(() => this.runAllChecks(), this.config.checkIntervalMs);

    // Periodic report generation
    this.reportTimer = setInterval(() => this.generateReport(), this.config.reportIntervalMs);

    // Also run report on first cycle
    setTimeout(() => this.generateReport(), 30000);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.checkTimer) clearInterval(this.checkTimer);
    if (this.reportTimer) clearInterval(this.reportTimer);
    silentLogger.info("[MONITOR-AGENT] Stopped");
  }

  // ─── Main Check Orchestrator ───────────────────────────────────────

  private async runAllChecks(): Promise<HealthCheckResult[]> {
    const results = await Promise.all([
      this.checkMT5Health(),
      this.checkPipelineHealth(),
      this.checkLLMHealth(),
      this.checkSystemResources(),
      this.checkDataQuality(),
    ]);

    const critical = results.filter(r => r.severity === "critical");
    const warnings = results.filter(r => r.severity === "warning");

    if (critical.length > 0) {
      silentLogger.error(`[MONITOR-AGENT] ${critical.length} critical issue(s) detected`);
      for (const c of critical) {
        silentLogger.error(`[MONITOR-AGENT] CRITICAL [${c.component}]: ${c.summary}`);
        c.details.forEach(d => silentLogger.error(`[MONITOR-AGENT]   -> ${d}`));
      }
    }

    if (warnings.length > 0) {
      silentLogger.warn(`[MONITOR-AGENT] ${warnings.length} warning(s) detected`);
    }

    if (critical.length === 0 && warnings.length === 0) {
      silentLogger.info("[MONITOR-AGENT] All systems healthy");
    }

    return results;
  }

  // ─── Individual Health Checks ──────────────────────────────────────

  private async checkMT5Health(): Promise<HealthCheckResult> {
    const details: string[] = [];
    const metrics: Record<string, number | string> = {};

    try {
      const isConnected = mt5McpService.isConnected;
      const circuitState = mt5McpService.circuitBreakerState;

      metrics.connected = isConnected ? 1 : 0;
      metrics.circuitState = circuitState;

      if (!isConnected) {
        details.push("MT5 tidak terhubung - pipeline auto-paused");
        return {
          component: "mt5",
          timestamp: new Date().toISOString(),
          severity: "critical",
          summary: "MT5 connection lost",
          details,
          metrics,
        };
      }

      if (circuitState !== "CLOSED") {
        details.push(`Circuit breaker dalam state ${circuitState} - koneksi tidak stabil`);
        return {
          component: "mt5",
          timestamp: new Date().toISOString(),
          severity: "warning",
          summary: `MT5 circuit state: ${circuitState}`,
          details,
          metrics,
        };
      }

      // Coba fetch account info untuk verifikasi koneksi
      try {
        const accountInfo = await mt5McpService.getAccountInfo();
        metrics.balance = accountInfo?.balance || 0;
        metrics.equity = accountInfo?.equity || 0;
        metrics.marginLevel = accountInfo?.marginLevel || 0;
        details.push(`Balance: $${(accountInfo?.balance || 0).toFixed(2)}, Equity: $${(accountInfo?.equity || 0).toFixed(2)}`);
      } catch (e: any) {
        details.push(`Gagal fetch account info: ${e.message}`);
      }

      return {
        component: "mt5",
        timestamp: new Date().toISOString(),
        severity: "healthy",
        summary: "MT5 connected and operational",
        details,
        metrics,
      };
    } catch (e: any) {
      return {
        component: "mt5",
        timestamp: new Date().toISOString(),
        severity: "warning",
        summary: `MT5 health check error: ${e.message}`,
        details: [e.message],
        metrics,
      };
    }
  }

  private async checkPipelineHealth(): Promise<HealthCheckResult> {
    const details: string[] = [];
    const metrics: Record<string, number | string> = {};

    try {
      const activeSessions = await AITradingSession.find({ status: "RUNNING" }).lean();
      metrics.activePipelines = activeSessions.length;

      if (activeSessions.length === 0) {
        return {
          component: "pipeline",
          timestamp: new Date().toISOString(),
          severity: "healthy",
          summary: "No active pipelines",
          details: ["Tidak ada pipeline yang aktif saat ini"],
          metrics,
        };
      }

      details.push(`Found ${activeSessions.length} active pipeline(s)`);

      for (const session of activeSessions) {
        const userId = session.userId;
        const status = await tradingPipelineService.getPipelineStatus(userId);

        metrics[`${userId}.running`] = status.running ? 1 : 0;
        metrics[`${userId}.paused`] = status.paused ? 1 : 0;
        metrics[`${userId}.error`] = status.lastError ? 1 : 0;
        metrics[`${userId}.totalTrades`] = status.metrics.totalTrades;
        metrics[`${userId}.pnl`] = status.metrics.totalPnL;

        if (status.lastError) {
          details.push(`[${userId}] Last error: ${status.lastError}`);
        }

        if (status.metrics.totalPnL < -500) {
          details.push(`[${userId}] PnL negatif signifikan: $${status.metrics.totalPnL}`);
        }

        // Check if there's a recent error (using lastError as proxy)
        const hasRecentError = status.lastError && 
          Date.now() - new Date(status.lastError).getTime() < 3600000;
        if (hasRecentError) {
          details.push(`[${userId}] Recent error detected: ${status.lastError}`);
          metrics[`${userId}.errors1h`] = 1;
        } else {
          metrics[`${userId}.errors1h`] = 0;
        }

        // Check MT5 circuit state for this pipeline
        if (status.mt5CircuitState === "OPEN") {
          details.push(`[${userId}] MT5 circuit breaker OPEN`);
        }
      }

      const hasCritical = details.some(d => d.includes("High error rate") || d.includes("circuit breaker OPEN"));
      const hasWarning = details.some(d => d.includes("negatif signifikan") || d.includes("Last error"));

      return {
        component: "pipeline",
        timestamp: new Date().toISOString(),
        severity: hasCritical ? "critical" : hasWarning ? "warning" : "healthy",
        summary: `${activeSessions.length} pipeline(s) running${hasCritical ? " with issues" : ""}`,
        details,
        metrics,
      };
    } catch (e: any) {
      return {
        component: "pipeline",
        timestamp: new Date().toISOString(),
        severity: "warning",
        summary: `Pipeline health check error: ${e.message}`,
        details: [e.message],
        metrics,
      };
    }
  }

  private async checkLLMHealth(): Promise<HealthCheckResult> {
    const details: string[] = [];
    const metrics: Record<string, number | string> = {};

    try {
      const modelStatus = llmConsensusService.getModelStatus();
      metrics.totalProviders = modelStatus.length;

      const activeModels = modelStatus.filter(m => m.status === "active");
      const hibernasiModels = modelStatus.filter(m => m.status === "hibernasi");
      const circuitModels = modelStatus.filter(m => m.status === "circuit_open");

      metrics.activeProviders = activeModels.length;
      metrics.hibernasiProviders = hibernasiModels.length;
      metrics.circuitOpenProviders = circuitModels.length;

      if (modelStatus.length === 0) {
        return {
          component: "llm_consensus",
          timestamp: new Date().toISOString(),
          severity: "healthy",
          summary: "LLM providers not configured",
          details: [],
          metrics,
        };
      }

      // Provider details
      for (const m of modelStatus) {
        const icon = m.status === "active" ? "✅" : m.status === "hibernasi" ? "💤" : "🔴";
        details.push(`${icon} ${m.label} (${m.name}): ${m.status}`);
        metrics[`provider.${m.name}`] = m.status;
      }

      if (activeModels.length === 0) {
        details.push("Semua LLM provider tidak tersedia - consensus akan fallback ke rule-based");
        return {
          component: "llm_consensus",
          timestamp: new Date().toISOString(),
          severity: "critical",
          summary: "All LLM providers unavailable",
          details,
          metrics,
        };
      }

      // Cek apakah provider aktif cukup untuk consensus
      if (activeModels.length < 2) {
        details.push(`Hanya ${activeModels.length} provider aktif - konsensus mungkin tidak akurat`);
        return {
          component: "llm_consensus",
          timestamp: new Date().toISOString(),
          severity: "warning",
          summary: `Insufficient LLM providers (${activeModels.length}/2)`,
          details,
          metrics,
        };
      }

      const availableList = llmConsensusService.getAvailableProviders();
      const availableCount = availableList.filter(p => p.available).length;
      metrics.availableForConsensus = availableCount;

      return {
        component: "llm_consensus",
        timestamp: new Date().toISOString(),
        severity: availableCount < 2 ? "warning" : "healthy",
        summary: `${availableCount} provider(s) available for consensus`,
        details,
        metrics,
      };
    } catch (e: any) {
      return {
        component: "llm_consensus",
        timestamp: new Date().toISOString(),
        severity: "warning",
        summary: `LLM health check error: ${e.message}`,
        details: [e.message],
        metrics,
      };
    }
  }

  private async checkSystemResources(): Promise<HealthCheckResult> {
    const details: string[] = [];
    const metrics: Record<string, number | string> = {};

    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

      metrics.cpuCount = cpus.length;
      metrics.memoryTotalGB = parseFloat((totalMem / 1024 / 1024 / 1024).toFixed(2));
      metrics.memoryUsagePercent = parseFloat(memUsagePercent.toFixed(1));
      metrics.uptimeHours = parseFloat((os.uptime() / 3600).toFixed(1));

      details.push(`CPU: ${cpus.length} cores`);
      details.push(`Memory: ${metrics.memoryUsagePercent}% used (${metrics.memoryTotalGB}GB total)`);
      details.push(`Uptime: ${metrics.uptimeHours}h`);
      details.push(`Platform: ${os.platform()} ${os.release()}`);

      if (memUsagePercent > this.config.thresholds.memoryMax * 100) {
        details.push(`⚠️ Memory usage tinggi: ${memUsagePercent.toFixed(1)}% (threshold: ${(this.config.thresholds.memoryMax * 100).toFixed(0)}%)`);
        return {
          component: "system_resources",
          timestamp: new Date().toISOString(),
          severity: "warning",
          summary: "High memory usage",
          details,
          metrics,
        };
      }

      return {
        component: "system_resources",
        timestamp: new Date().toISOString(),
        severity: "healthy",
        summary: "System resources normal",
        details,
        metrics,
      };
    } catch (e: any) {
      return {
        component: "system_resources",
        timestamp: new Date().toISOString(),
        severity: "warning",
        summary: `System health check error: ${e.message}`,
        details: [e.message],
        metrics,
      };
    }
  }

  private async checkDataQuality(): Promise<HealthCheckResult> {
    const details: string[] = [];
    const metrics: Record<string, number | string> = {};

    try {
      const activeSessions = await AITradingSession.find({ status: "RUNNING" }).lean();
      metrics.checkedPipelines = activeSessions.length;

      if (activeSessions.length === 0) {
        return {
          component: "data_quality",
          timestamp: new Date().toISOString(),
          severity: "healthy",
          summary: "No active pipelines to check",
          details: [],
          metrics,
        };
      }

      let totalIssues = 0;
      for (const session of activeSessions) {
        try {
          const config = session.pipelineConfig || {};
          const symbols = config.symbols || [];

          for (const sym of symbols) {
            // Only check if MT5 connected
            if (!mt5McpService.isConnected) {
              details.push(`[${sym}] MT5 not connected - cannot query rates`);
              totalIssues++;
              continue;
            }

            try {
              const rates = await mt5McpService.getRates(sym, config.timeframe || "M15", 2);
              if (!rates || rates.length === 0) {
                details.push(`[${sym}] No rate data from MT5`);
                totalIssues++;
              }
            } catch (e: any) {
              details.push(`[${sym}] Rate fetch error: ${e.message}`);
              totalIssues++;
            }
          }
        } catch {
          // skip individual session errors
        }
      }

      metrics.dataIssues = totalIssues;

      if (totalIssues > 0) {
        return {
          component: "data_quality",
          timestamp: new Date().toISOString(),
          severity: "warning",
          summary: `Data quality issues detected (${totalIssues})`,
          details,
          metrics,
        };
      }

      return {
        component: "data_quality",
        timestamp: new Date().toISOString(),
        severity: "healthy",
        summary: "All data feeds operational",
        details,
        metrics,
      };
    } catch (e: any) {
      return {
        component: "data_quality",
        timestamp: new Date().toISOString(),
        severity: "warning",
        summary: `Data quality check error: ${e.message}`,
        details: [e.message],
        metrics,
      };
    }
  }

  // ─── Report Generation ─────────────────────────────────────────────

  private async generateReport(): Promise<void> {
    try {
      silentLogger.info("[MONITOR-AGENT] Generating periodic report...");

      const checks = await this.runAllChecks();

      const report = this.buildReportFromChecks(checks);

      // Generate AI insights if 9Router configured
      let aiInsights = "";
      if (this.nineRouterUrl && this.nineRouterApiKey) {
        aiInsights = await this.generateAIInsights(report);
      }

      const markdown = this.renderReportToMarkdown(report, aiInsights);
      const filename = `monitoring-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
      const filepath = path.join(this.config.reportDir, filename);

      await fs.promises.writeFile(filepath, markdown, "utf-8");

      // Update latest.md
      const latestPath = path.join(this.config.reportDir, "latest.md");
      await fs.promises.writeFile(latestPath, markdown, "utf-8");

      silentLogger.info(`[MONITOR-AGENT] Report saved: ${filename}`);

      // Cleanup old reports (keep last 48)
      await this.cleanupOldReports();

      // Send alert webhook automatically
      if (this.config.alertWebhook) {
        await this.sendAlert(report);
      }
    } catch (e: any) {
      silentLogger.error(`[MONITOR-AGENT] Report generation failed: ${e.message}`);
    }
  }

  // ─── AI-Enhanced Analysis via 9Router ────────────────────────────────
  private async generateAIInsights(report: SystemReport): Promise<string> {
    if (!this.nineRouterUrl || !this.nineRouterApiKey) {
      return "";
    }

    try {
      const prompt = this.buildAIPrompt(report);
      
      const response = await fetch(`${this.nineRouterUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.nineRouterApiKey}`,
        },
        body: JSON.stringify({
          model: this.config.llmModel || "auto-free-model",
          messages: [
            {
              role: "system",
              content: "Kamu adalah AI System Reliability Engineer. Analisis health check sistem trading dan berikan insight teknis actionable dalam Bahasa Indonesia. Format: bullet points, singkat, teknis."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        silentLogger.warn(`[MONITOR-AGENT] 9Router AI insight failed: ${response.status} ${errText}`);
        return "";
      }

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        // Robust fallback: try to extract valid JSON block if there's trailing garbage
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[0]);
          } catch (e) {
            throw new Error(`Regex extracted JSON also failed to parse: ${rawText.substring(0, 100)}...`);
          }
        } else {
          throw parseErr;
        }
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      return content || "";
    } catch (e: any) {
      silentLogger.warn(`[MONITOR-AGENT] AI insight generation error: ${e.message}`);
      return "";
    }
  }

  private buildAIPrompt(report: SystemReport): string {
    const criticalCount = report.criticalIssues.length;
    const warningCount = report.warnings.length;
    const metricsSummary = Object.entries(report.metrics)
      .filter(([k]) => !k.includes(".")) // skip user-specific metrics
      .slice(0, 15)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    return `
Sistem AI Trading Health Check Report:
- Status: ${report.criticalIssues.length > 0 ? "CRITICAL" : report.warnings.length > 0 ? "WARNING" : "HEALTHY"}
- Critical Issues: ${criticalCount}
- Warnings: ${warningCount}
- Key Metrics: ${metricsSummary}
- Critical Issues: ${report.criticalIssues.slice(0, 5).join("; ")}
- Warnings: ${report.warnings.slice(0, 5).join("; ")}

Berikan 3-5 actionable insights dalam Bahasa Indonesia untuk perbaikan sistem. Fokus pada root cause dan immediate action.
`;
  }

  private buildReportFromChecks(checks: HealthCheckResult[]): SystemReport {
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const metrics: Record<string, number | string> = {};
    const recommendations: string[] = [];

    for (const check of checks) {
      Object.assign(metrics, check.metrics);

      if (check.severity === "critical") {
        criticalIssues.push(`[${check.component}] ${check.summary}`);
        check.details.forEach(d => criticalIssues.push(`  -> ${d}`));
        recommendations.push(...this.getRecommendations(check.component, check.details));
      } else if (check.severity === "warning") {
        warnings.push(`[${check.component}] ${check.summary}`);
        check.details.forEach(d => warnings.push(`  -> ${d}`));
      }
    }

    const summary = criticalIssues.length > 0
      ? `${criticalIssues.length} critical issue(s), ${warnings.length} warning(s)`
      : warnings.length > 0
        ? `${warnings.length} warning(s), no critical issues`
        : "All systems healthy";

    return {
      timestamp: new Date().toISOString(),
      summary,
      criticalIssues,
      warnings,
      metrics,
      recommendations,
      rawChecks: checks,
    };
  }

  private renderReportToMarkdown(report: SystemReport, aiInsights: string = ""): string {
    const now = new Date(report.timestamp);
    const timeStr = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    let md = `# System Monitoring Report\n\n`;
    md += `**Generated:** ${timeStr} WIB\n`;
    md += `**Status:** ${report.criticalIssues.length > 0 ? "🔴 CRITICAL" : report.warnings.length > 0 ? "🟡 WARNING" : "🟢 HEALTHY"}\n\n`;

    // AI Insights Section
    if (aiInsights) {
      md += `---\n\n## 🤖 AI Insights (9Router)\n\n`;
      md += `${aiInsights}\n\n`;
    }

    md += `---\n\n## Executive Summary\n\n`;
    md += `${report.summary}\n\n`;

    // Critical Issues
    if (report.criticalIssues.length > 0) {
      md += `## 🔴 Critical Issues\n\n`;
      for (const issue of report.criticalIssues) {
        md += `- ${issue}\n`;
      }
      md += `\n`;
    }

    // Warnings
    if (report.warnings.length > 0) {
      md += `## 🟡 Warnings\n\n`;
      for (const warn of report.warnings) {
        md += `- ${warn}\n`;
      }
      md += `\n`;
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      md += `## Recommended Actions\n\n`;
      md += `| # | Action | Component |\n`;
      md += `|---|--------|-----------|\n`;
      report.recommendations.forEach((r, i) => {
        md += `| ${i + 1} | ${r} | - |\n`;
      });
      md += `\n`;
    }

    // Metrics Dashboard
    md += `## Metrics Dashboard\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    for (const [key, val] of Object.entries(report.metrics)) {
      md += `| ${key} | ${val} |\n`;
    }
    md += `\n`;

    // Detailed Checks
    md += `## Detailed Health Checks\n\n`;
    for (const check of report.rawChecks) {
      const icon = check.severity === "critical" ? "🔴" : check.severity === "warning" ? "🟡" : "🟢";
      md += `### ${icon} ${check.component.toUpperCase()}\n\n`;
      md += `- **Severity:** ${check.severity}\n`;
      md += `- **Summary:** ${check.summary}\n`;
      md += `- **Time:** ${check.timestamp}\n\n`;
      if (check.details.length > 0) {
        for (const d of check.details) {
          md += `- ${d}\n`;
        }
        md += `\n`;
      }
    }

    md += `---\n\n*Report generated by SystemMonitorAgent v1.0 | Next report: ${new Date(Date.now() + this.config.reportIntervalMs).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB*\n`;

    return md;
  }

  private getRecommendations(component: string, details: string[]): string[] {
    const recs: string[] = [];

    if (component === "mt5") {
      recs.push("Restart MT5 MCP service");
      recs.push("Verify MT5 terminal is running on broker VPS");
      recs.push("Check MT5 MCP server logs in logs/mt5-errors.log");
    }

    if (component === "llm_consensus") {
      recs.push("Rotate LLM providers via 9Router configuration");
      recs.push("Request quota increase for rate-limited providers");
      recs.push("Consider adding backup provider (e.g. Groq)");
    }

    if (component === "pipeline") {
      recs.push("Review pipeline configuration (timeframe, symbols, risk)");
      recs.push("Reduce maxRiskPerTrade if drawdown is high");
      recs.push("Restart pipeline if stuck");
    }

    if (component === "system_resources") {
      recs.push("Scale up server resources or reduce polling frequency");
      recs.push("Restart server if memory leak suspected");
      recs.push("Consider enabling swap space");
    }

    if (component === "data_quality") {
      recs.push("Verify MT5 rate feed stability");
      recs.push("Check internet connection to broker");
      recs.push("Restart MT5 MCP server");
    }

    return recs;
  }

  private async cleanupOldReports(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.reportDir);
      const reports = files.filter(f => f.startsWith("monitoring-report-") && f.endsWith(".md"));

      if (reports.length > 48) {
        // Sort oldest first
        reports.sort();
        const toDelete = reports.slice(0, reports.length - 48);
        for (const f of toDelete) {
          await fs.promises.unlink(path.join(this.config.reportDir, f));
        }
        silentLogger.info(`[MONITOR-AGENT] Cleaned up ${toDelete.length} old reports`);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  private async sendAlert(report: SystemReport): Promise<void> {
    if (!this.config.alertWebhook) return;
    try {
      const isCritical = report.criticalIssues.length > 0;
      const statusIcon = isCritical ? "🚨" : report.warnings.length > 0 ? "⚠️" : "✅";
      const payload = {
        content: `${statusIcon} *AI Monitoring Report*\n**Critical Issues:** ${report.criticalIssues.length}\n**Warnings:** ${report.warnings.length}\n\n*Check the server's \`monitoring-reports\` directory for full details.*`,
      };
      await fetch(this.config.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      silentLogger.info("[MONITOR-AGENT] Alert sent to webhook");
    } catch (e: any) {
      silentLogger.warn(`[MONITOR-AGENT] Alert webhook failed: ${e.message}`);
    }
  }
}

export const systemMonitorAgent = new SystemMonitorAgent();
