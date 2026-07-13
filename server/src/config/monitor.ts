import path from "node:path";

export interface MonitorConfig {
  checkIntervalMs: number;
  reportIntervalMs: number;
  reportDir: string;
  llmModel: string;
  alertWebhook?: string;
  // 9Router config for monitoring agent
  nineRouterUrl: string;
  nineRouterApiKey: string;
  thresholds: {
    mt5DisconnectPerHour: number;
    mt5RejectRate: number;
    pipelineSignalRateMin: number;
    pipelineErrorRateMax: number;
    llmReliabilityMin: number;
    llmSkipRateMax: number;
    riskDrawdownMax: number;
    riskMarginMin: number;
    dataGapMax: number;
    cpuMax: number;
    memoryMax: number;
    diskMax: number;
  };
}

export const monitorConfig: MonitorConfig = {
  checkIntervalMs: parseInt(process.env.MONITOR_CHECK_INTERVAL_MS || "300000", 10),
  reportIntervalMs: parseInt(process.env.MONITOR_REPORT_INTERVAL_MS || "3600000", 10),
  reportDir: process.env.MONITOR_REPORT_DIR || path.join(__dirname, "..", "..", "monitoring-reports"),
  llmModel: process.env.MONITOR_LLM_MODEL || "auto-free-model",
  nineRouterUrl: process.env.NINE_ROUTER_URL || "",
  nineRouterApiKey: process.env.NINE_ROUTER_API_KEY || "",
  alertWebhook: process.env.MONITOR_ALERT_WEBHOOK,
  thresholds: {
    mt5DisconnectPerHour: 3,
    mt5RejectRate: 0.1,
    pipelineSignalRateMin: 0.1,
    pipelineErrorRateMax: 0.05,
    llmReliabilityMin: 0.5,
    llmSkipRateMax: 0.5,
    riskDrawdownMax: 5,
    riskMarginMin: 200,
    dataGapMax: 0.05,
    cpuMax: 0.8,
    memoryMax: 0.85,
    diskMax: 0.9,
  },
};
