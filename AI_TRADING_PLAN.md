# AI Trading dengan MT5 MCP Integration - Implementation Plan

## Overview
Fitur AI Trading memungkinkan user untuk:
1. Menghubungkan akun MT5 via MCP Server
2. Melihat account metrics real-time (balance, equity, margin, margin level, PnL)
3. AI memilih pair yang bisa ditradingkan
4. AI melakukan open position dengan TP/SL otomatis
5. AI menerapkan trailing stop
6. Pipeline trading plan berbasis metode baku

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  AI Trading Page                                                 │
│  ├── Connection Panel (MT5 credentials form)                    │
│  ├── Account Overview (Balance, Equity, Margin, PnL chart)      │
│  ├── Trading Panel (Pair selection, AI controls)                │
│  ├── Positions Table (Open positions with TP/SL)                │
│  └── AI Trading Pipeline (Strategy config, logs)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                        │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                         │
│  ├── /api/ai-trading/connect      - Connect to MT5 via MCP      │
│  ├── /api/ai-trading/disconnect   - Disconnect from MT5         │
│  ├── /api/ai-trading/account      - Get account info            │
│  ├── /api/ai-trading/positions    - Get open positions          │
│  ├── /api/ai-trading/symbols      - Get tradable symbols        │
│  ├── /api/ai-trading/open         - AI open position            │
│  ├── /api/ai-trading/close        - AI close position           │
│  ├── /api/ai-trading/modify       - Modify TP/SL                │
│  ├── /api/ai-trading/trailing     - Set trailing stop           │
│  └── /api/ai-trading/pipeline     - Trading pipeline control    │
│                                                                  │
│  Services:                                                       │
│  ├── mt5-mcp.service.ts           - MCP MT5 integration         │
│  ├── ai-trading-engine.service.ts - AI decision engine          │
│  ├── trading-pipeline.service.ts  - Pipeline orchestration      │
│  └── risk-manager.service.ts      - Risk management             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MT5 MCP Server (Python)                     │
├─────────────────────────────────────────────────────────────────┤
│  Tools exposed via MCP:                                          │
│  ├── mt5_connect          - Initialize MT5 connection           │
│  ├── mt5_disconnect       - Close MT5 connection                │
│  ├── mt5_account_info     - Get account details                 │
│  ├── mt5_positions_get    - Get all open positions              │
│  ├── mt5_symbols_get      - Get tradable symbols                │
│  ├── mt5_order_send       - Send trading order                  │
│  ├── mt5_position_close   - Close position                      │
│  ├── mt5_position_modify  - Modify TP/SL                        │
│  └── mt5_history_get      - Get trade history                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MT5 MCP Server Setup

### 1.1 Install MT5 MCP Server
Ada beberapa opsi MCP server untuk MT5:
- **Opsi A**: `@anthropic-ai/mcp-server-mt5` (jika ada)
- **Opsi B**: Buat custom MCP server dengan MetaTrader5 Python library

**Rekomendasi**: Buat custom MCP server untuk kontrol penuh.

### 1.2 Struktur MT5 MCP Server

```python
# mcp-mt5-server/server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
import MetaTrader5 as mt5

app = Server("mt5-trading-server")

@app.list_tools()
async def list_tools():
    return [
        # Connection
        Tool(name="mt5_connect", ...),
        Tool(name="mt5_disconnect", ...),
        
        # Account
        Tool(name="mt5_account_info", ...),
        
        # Market Data
        Tool(name="mt5_symbols_get", ...),
        Tool(name="mt5_symbol_info", ...),
        Tool(name="mt5_copy_rates", ...),
        
        # Trading
        Tool(name="mt5_order_send", ...),
        Tool(name="mt5_position_close", ...),
        Tool(name="mt5_position_modify", ...),
        
        # History
        Tool(name="mt5_positions_get", ...),
        Tool(name="mt5_history_deals_get", ...),
    ]
```

### 1.3 MT5 MCP Tools Specification

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `mt5_connect` | server, login, password | success, account_info | Initialize connection |
| `mt5_disconnect` | - | success | Close connection |
| `mt5_account_info` | - | balance, equity, margin, margin_level, free_margin | Account metrics |
| `mt5_symbols_get` | group (optional) | symbols[] | Get tradable pairs |
| `mt5_symbol_info` | symbol | tick_size, contract_size, min_lot, max_lot | Symbol details |
| `mt5_positions_get` | - | positions[] | Open positions |
| `mt5_order_send` | symbol, type, volume, price, sl, tp, comment | order_result | Open position |
| `mt5_position_close` | ticket | result | Close position |
| `mt5_position_modify` | ticket, sl, tp | result | Modify TP/SL |
| `mt5_copy_rates` | symbol, timeframe, from, to | rates[] | Historical data |

---

## Phase 2: Backend Services

### 2.1 MT5 MCP Service (`server/src/services/mt5-mcp.service.ts`)

```typescript
// Extends existing mcp.service.ts untuk MT5-specific operations

interface MT5AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}

interface MT5Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  comment: string;
}

interface MT5OrderResult {
  success: boolean;
  ticket?: number;
  error?: string;
}

class MT5MCPService {
  private sessionId: string | null = null;
  
  async connect(config: MT5Config): Promise<MT5AccountInfo>;
  async disconnect(): Promise<void>;
  async getAccountInfo(): Promise<MT5AccountInfo>;
  async getSymbols(filter?: string): Promise<MT5Symbol[]>;
  async getPositions(): Promise<MT5Position[]>;
  async openPosition(order: MT5Order): Promise<MT5OrderResult>;
  async closePosition(ticket: number): Promise<MT5OrderResult>;
  async modifyPosition(ticket: number, sl: number, tp: number): Promise<MT5OrderResult>;
  async getHistory(from: Date, to: Date): Promise<MT5Deal[]>;
}
```

### 2.2 AI Trading Engine Service (`server/src/services/ai-trading-engine.service.ts`)

```typescript
interface TradingSignal {
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number; // 0-100
  entry: number;
  sl: number;
  tp: number;
  reason: string;
  riskPercent: number;
}

interface MarketAnalysis {
  symbol: string;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  volatility: number;
  support: number[];
  resistance: number[];
  recommendation: TradingSignal | null;
}

class AITradingEngine {
  // Analyze market conditions
  async analyzeSymbol(symbol: string): Promise<MarketAnalysis>;
  
  // Generate trading signal
  async generateSignal(
    symbol: string, 
    accountInfo: MT5AccountInfo,
    strategy: TradingStrategy
  ): Promise<TradingSignal | null>;
  
  // Calculate position size
  calculatePositionSize(
    accountBalance: number,
    riskPercent: number,
    entryPrice: number,
    stopLoss: number,
    symbolInfo: MT5SymbolInfo
  ): number;
  
  // Calculate TP/SL levels
  calculateTPSL(
    entry: number,
    direction: 'BUY' | 'SELL',
    riskRewardRatio: number,
    atrValue: number
  ): { sl: number; tp: number };
  
  // Trailing stop logic
  calculateTrailingStop(
    position: MT5Position,
    trailPercent: number,
    currentPrice: number
  ): number;
}
```

### 2.3 Trading Pipeline Service (`server/src/services/trading-pipeline.service.ts`)

```typescript
interface PipelineConfig {
  enabled: boolean;
  symbols: string[]; // Pair yang akan dimonitor
  strategy: TradingStrategy;
  maxOpenPositions: number;
  maxRiskPerTrade: number;
  maxDailyRisk: number;
  tradingHours: {
    start: string; // "09:00"
    end: string;   // "17:00"
  };
  trailingStop: {
    enabled: boolean;
    activationPoints: number; // Profit pips untuk activate
    trailDistance: number;    // Distance in pips
  };
}

interface TradingStrategy {
  name: string;
  type: 'TREND_FOLLOWING' | 'MEAN_REVERSION' | 'BREAKOUT' | 'SCALPING';
  timeframes: string[];
  indicators: IndicatorConfig[];
  entryRules: EntryRule[];
  exitRules: ExitRule[];
  riskRewardRatio: number;
}

interface PipelineStatus {
  running: boolean;
  lastCheck: Date;
  openPositions: number;
  dailyPnL: number;
  signals: TradingSignal[];
  logs: PipelineLog[];
}

class TradingPipelineService {
  private pipelines: Map<string, PipelineConfig> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  async startPipeline(userId: string, config: PipelineConfig): Promise<void>;
  async stopPipeline(userId: string): Promise<void>;
  async getPipelineStatus(userId: string): Promise<PipelineStatus>;
  async executeSignal(userId: string, signal: TradingSignal): Promise<MT5OrderResult>;
  async managePositions(userId: string): Promise<void>; // Trailing stop, BE, etc.
}
```

### 2.4 Risk Manager Service (`server/src/services/risk-manager.service.ts`)

```typescript
interface RiskCheck {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
}

interface RiskMetrics {
  dailyPnL: number;
  dailyDrawdown: number;
  maxDrawdown: number;
  openRisk: number; // Total risk dalam open positions
  marginUsed: number;
  marginLevel: number;
}

class RiskManagerService {
  // Pre-trade risk check
  async checkTradeAllowed(
    userId: string,
    signal: TradingSignal,
    accountInfo: MT5AccountInfo
  ): Promise<RiskCheck>;
  
  // Calculate current risk metrics
  async calculateRiskMetrics(userId: string): Promise<RiskMetrics>;
  
  // Check if trailing stop should be updated
  shouldUpdateTrailingStop(
    position: MT5Position,
    config: PipelineConfig
  ): { update: boolean; newSL: number };
  
  // Emergency close all positions
  async emergencyCloseAll(userId: string): Promise<void>;
}
```

---

## Phase 3: Database Schema

### 3.1 New Models

#### AI Trading Session
```typescript
// server/src/models/AITradingSession.ts
interface IAITradingSession {
  userId: string;
  tradingAccountId: string;
  
  // Connection status
  mt5Connected: boolean;
  mt5Config: {
    server: string;
    login: string;
    // password NOT stored in DB for security
  };
  
  // Pipeline config
  pipelineConfig: PipelineConfig;
  
  // Status
  status: 'STOPPED' | 'RUNNING' | 'PAUSED' | 'ERROR';
  startedAt?: Date;
  stoppedAt?: Date;
  
  // Metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  maxDrawdown: number;
  
  // Last state
  lastCheckAt?: Date;
  lastError?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### AI Trade Log
```typescript
// server/src/models/AITradeLog.ts
interface IAITradeLog {
  userId: string;
  sessionId: string;
  
  // Signal info
  signal: TradingSignal;
  
  // Execution
  executed: boolean;
  executionPrice?: number;
  executionTime?: Date;
  mt5Ticket?: number;
  
  // Result
  closedAt?: Date;
  closePrice?: number;
  pnl?: number;
  pnlPips?: number;
  
  // AI analysis
  analysisSnapshot: MarketAnalysis;
  
  // Trailing stop history
  trailingHistory: {
    time: Date;
    oldSL: number;
    newSL: number;
    price: number;
  }[];
  
  createdAt: Date;
}
```

---

## Phase 4: Frontend Implementation

### 4.1 Page Structure

```
frontend/src/app/(dashboard)/ai-trading/
├── page.tsx                    # Main AI Trading page
├── components/
│   ├── ConnectionPanel.tsx     # MT5 connection form
│   ├── AccountOverview.tsx     # Balance, equity, margin display
│   ├── PnLChart.tsx            # Equity curve chart
│   ├── PositionsTable.tsx      # Open positions table
│   ├── TradingPanel.tsx        # AI controls & pair selection
│   ├── PipelineConfig.tsx      # Strategy configuration
│   ├── PipelineLogs.tsx        # Activity logs
│   └── RiskMetrics.tsx         # Risk dashboard
└── hooks/
    ├── useMT5Connection.ts     # Connection management
    ├── useAccountInfo.ts       # Account data polling
    ├── usePositions.ts         # Positions data
    └── usePipeline.ts          # Pipeline control
```

### 4.2 Connection Panel Component

```typescript
// ConnectionPanel.tsx
interface MT5Credentials {
  server: string;      // e.g., "ICMarkets-Demo"
  login: string;       // Account number
  password: string;    // Account password
}

// Features:
// - Form input untuk credentials
// - Test connection button
// - Save credentials (encrypted)
// - Connection status indicator
// - Auto-reconnect option
```

### 4.3 Account Overview Component

```typescript
// AccountOverview.tsx
interface AccountMetrics {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number; // Margin level percentage
  unrealizedPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
}

// Display:
// - Large cards untuk Balance, Equity, Margin Level
// - Color-coded (green > 150%, yellow 100-150%, red < 100%)
// - Daily/Weekly PnL indicator
// - Real-time update via polling/WebSocket
```

### 4.4 Trading Panel Component

```typescript
// TradingPanel.tsx

// Features:
// - Symbol/Pair selector (dari MT5 symbols)
// - Timeframe selector (M5, M15, H1)
// - Strategy selector (RSI + Engulfing)
// - Risk settings (per trade, daily max)
// - Start/Stop pipeline button
// - Manual override controls
// - AI confidence indicator
// - Last signal display
```

### 4.5 Positions Table Component

```typescript
// PositionsTable.tsx

// Columns:
// - Ticket
// - Symbol
// - Type (BUY/SELL)
// - Volume
// - Entry Price
// - Current Price
// - SL (editable)
// - TP (editable)
// - PnL
// - Action buttons (Close, Modify)
// - Trailing stop indicator
```

### 4.6 Frontend Service

```typescript
// frontend/src/services/ai-trading.service.ts

const API_BASE = '/api/ai-trading';

export const aiTradingService = {
  // Connection
  connect: async (credentials: MT5Credentials) => 
    fetch(`${API_BASE}/connect`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    }).then(r => r.json()),
  
  disconnect: async () => 
    fetch(`${API_BASE}/disconnect`, { method: 'POST' }).then(r => r.json()),
  
  getStatus: async () => 
    fetch(`${API_BASE}/status`).then(r => r.json()),
  
  // Account
  getAccountInfo: async () => 
    fetch(`${API_BASE}/account`).then(r => r.json()),
  
  // Trading
  getSymbols: async () => 
    fetch(`${API_BASE}/symbols`).then(r => r.json()),
  
  getPositions: async () => 
    fetch(`${API_BASE}/positions`).then(r => r.json()),
  
  openPosition: async (order: OpenOrderRequest) => 
    fetch(`${API_BASE}/open`, {
      method: 'POST',
      body: JSON.stringify(order)
    }).then(r => r.json()),
  
  closePosition: async (ticket: number) => 
    fetch(`${API_BASE}/close`, {
      method: 'POST',
      body: JSON.stringify({ ticket })
    }).then(r => r.json()),
  
  modifyPosition: async (ticket: number, sl: number, tp: number) => 
    fetch(`${API_BASE}/modify`, {
      method: 'POST',
      body: JSON.stringify({ ticket, sl, tp })
    }).then(r => r.json()),
  
  // Pipeline
  startPipeline: async (config: PipelineConfig) => 
    fetch(`${API_BASE}/pipeline/start`, {
      method: 'POST',
      body: JSON.stringify({ config })
    }).then(r => r.json()),
  
  stopPipeline: async () => 
    fetch(`${API_BASE}/pipeline/stop`, { method: 'POST' }).then(r => r.json()),
  
  getPipelineStatus: async () => 
    fetch(`${API_BASE}/pipeline/status`).then(r => r.json()),
  
  getPipelineLogs: async () => 
    fetch(`${API_BASE}/pipeline/logs`).then(r => r.json()),
};
```

### 4.7 Custom Hooks

```typescript
// hooks/useMT5Connection.ts
export function useMT5Connection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const connect = async (credentials: MT5Credentials) => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await aiTradingService.connect(credentials);
      if (result.success) {
        setIsConnected(true);
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const disconnect = async () => {
    await aiTradingService.disconnect();
    setIsConnected(false);
  };
  
  return { isConnected, isConnecting, error, connect, disconnect };
}

// hooks/useAccountInfo.ts
export function useAccountInfo(pollInterval = 5000) {
  const [accountInfo, setAccountInfo] = useState<AccountMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await aiTradingService.getAccountInfo();
        setAccountInfo(data);
      } catch (e) {
        console.error('Failed to fetch account info:', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInfo();
    const interval = setInterval(fetchInfo, pollInterval);
    
    return () => clearInterval(interval);
  }, [pollInterval]);
  
  return { accountInfo, isLoading };
}

// hooks/usePositions.ts
export function usePositions(pollInterval = 3000) {
  const [positions, setPositions] = useState<MT5Position[]>([]);
  
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const data = await aiTradingService.getPositions();
        setPositions(data.positions);
      } catch (e) {
        console.error('Failed to fetch positions:', e);
      }
    };
    
    fetchPositions();
    const interval = setInterval(fetchPositions, pollInterval);
    
    return () => clearInterval(interval);
  }, [pollInterval]);
  
  return { positions, refetch: () => fetchPositions() };
}

// hooks/usePipeline.ts
export function usePipeline() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  
  const start = async (config: PipelineConfig) => {
    const result = await aiTradingService.startPipeline(config);
    setStatus(result);
    return result;
  };
  
  const stop = async () => {
    await aiTradingService.stopPipeline();
    setStatus(prev => prev ? { ...prev, running: false } : null);
  };
  
  useEffect(() => {
    if (status?.running) {
      const interval = setInterval(async () => {
        const [statusData, logsData] = await Promise.all([
          aiTradingService.getPipelineStatus(),
          aiTradingService.getPipelineLogs()
        ]);
        setStatus(statusData);
        setLogs(logsData.logs);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [status?.running]);
  
  return { status, logs, start, stop };
}
```

### 4.8 Main Page Layout

```typescript
// page.tsx
'use client';

import { ConnectionPanel } from './components/ConnectionPanel';
import { AccountOverview } from './components/AccountOverview';
import { PositionsTable } from './components/PositionsTable';
import { TradingPanel } from './components/TradingPanel';
import { PipelineLogs } from './components/PipelineLogs';
import { useMT5Connection } from './hooks/useMT5Connection';
import { useAccountInfo } from './hooks/useAccountInfo';
import { usePositions } from './hooks/usePositions';
import { usePipeline } from './hooks/usePipeline';

export default function AITradingPage() {
  const { isConnected, connect, disconnect } = useMT5Connection();
  const { accountInfo } = useAccountInfo();
  const { positions } = usePositions();
  const { status: pipelineStatus, logs, start: startPipeline, stop: stopPipeline } = usePipeline();
  
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ConnectionPanel onConnect={connect} />
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      {/* Left Column - Account & Positions */}
      <div className="col-span-8 space-y-4">
        <AccountOverview accountInfo={accountInfo} />
        <PositionsTable 
          positions={positions} 
          onClose={handleClosePosition}
          onModify={handleModifyPosition}
        />
        <PipelineLogs logs={logs} />
      </div>
      
      {/* Right Column - Trading Panel */}
      <div className="col-span-4 space-y-4">
        <TradingPanel 
          isConnected={isConnected}
          pipelineStatus={pipelineStatus}
          onStartPipeline={startPipeline}
          onStopPipeline={stopPipeline}
          onDisconnect={disconnect}
        />
      </div>
    </div>
  );
}
```

---

## Phase 5: AI Trading Pipeline

### 5.1 Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADING PIPELINE FLOW                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  START   │───▶│  SCAN    │───▶│ ANALYZE  │───▶│  CHECK   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               │
                     │                               │
                     │                               ▼
                     │                         ┌──────────┐
                     │                         │  RISK    │
                     │                         │  CHECK   │
                     │                         └──────────┘
                     │                               │
                     │                               │
                     ▼                               ▼
                ┌──────────┐                   ┌──────────┐
                │  NO      │                   │ SIGNAL   │
                │  SIGNAL  │                   │ FOUND    │
                └──────────┘                   └──────────┘
                                                   │
                                                   │
                                                   ▼
                                             ┌──────────┐
                                             │ EXECUTE  │
                                             │  TRADE   │
                                             └──────────┘
                                                   │
                                                   │
                                                   ▼
                                             ┌──────────┐
                                             │ MANAGE   │
                                             │ POSITION │
                                             └──────────┘
                                                   │
                                                   │
                                                   ▼
                                             ┌──────────┐
                                             │  LOOP    │
                                             └──────────┘
```

### 5.2 Trading Strategies

#### Strategy 1: RSI + Engulfing Scalping (Default - Intraday/Scalping)
```typescript
const rsiEngulfingStrategy: TradingStrategy = {
  name: "RSI Engulfing Scalping",
  type: "MEAN_REVERSION",
  timeframes: ["M5", "M15"], // M5 scalping, M15 intraday
  indicators: [
    { type: "RSI", period: 14 },
    { type: "ATR", period: 14 }
  ],
  entryRules: [
    // BUY Signal
    {
      condition: "RSI < 30",
      direction: "BUY",
      name: "RSI Oversold"
    },
    {
      condition: "BULLISH_ENGULFING",
      direction: "BUY",
      name: "Bullish Engulfing Pattern",
      confirmation: true
    },
    // SELL Signal
    {
      condition: "RSI > 70",
      direction: "SELL",
      name: "RSI Overbought"
    },
    {
      condition: "BEARISH_ENGULFING",
      direction: "SELL",
      name: "Bearish Engulfing Pattern",
      confirmation: true
    }
  ],
  exitRules: [
    { type: "ATR_SL", multiplier: 1.5 },
    { type: "ATR_TP", multiplier: 1.5 }, // R:R 1:1 untuk scalping
    { type: "TRAILING_STOP", activationATR: 1, trailATR: 0.5 }
  ],
  riskRewardRatio: 1.0, // Scalping: 1:1, bisa diubah 1:2 untuk intraday
  maxHoldTime: 60 // Max 60 menit untuk scalping
};
```

#### Engulfing Pattern Detection
```typescript
interface CandlePattern {
  type: 'BULLISH_ENGULFING' | 'BEARISH_ENGULFING' | 'NONE';
  candle1: Candle; // Previous candle
  candle2: Candle; // Current candle
}

function detectEngulfingPattern(rates: Rate[]): CandlePattern {
  const len = rates.length;
  const prev = rates[len - 2]; // Candle sebelumnya
  const curr = rates[len - 1]; // Candle saat ini
  
  // Bullish Engulfing:
  // - Prev candle bearish (close < open)
  // - Curr candle bullish (close > open)
  // - Curr body engulf prev body (curr.open < prev.close AND curr.close > prev.open)
  if (
    prev.close < prev.open &&           // Prev bearish
    curr.close > curr.open &&           // Curr bullish
    curr.open <= prev.close &&          // Curr open below prev close
    curr.close >= prev.open             // Curr close above prev open
  ) {
    return { type: 'BULLISH_ENGULFING', candle1: prev, candle2: curr };
  }
  
  // Bearish Engulfing:
  // - Prev candle bullish (close > open)
  // - Curr candle bearish (close < open)
  // - Curr body engulf prev body
  if (
    prev.close > prev.open &&           // Prev bullish
    curr.close < curr.open &&           // Curr bearish
    curr.open >= prev.close &&          // Curr open above prev close
    curr.close <= prev.open             // Curr close below prev open
  ) {
    return { type: 'BEARISH_ENGULFING', candle1: prev, candle2: curr };
  }
  
  return { type: 'NONE', candle1: prev, candle2: curr };
}
```

#### RSI Calculation
```typescript
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate smoothed RSI
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
```

#### Strategy 2: RSI + Engulfing Intraday (Higher Timeframe)
```typescript
const rsiEngulfingIntradayStrategy: TradingStrategy = {
  name: "RSI Engulfing Intraday",
  type: "MEAN_REVERSION",
  timeframes: ["M15", "H1"],
  indicators: [
    { type: "RSI", period: 14 },
    { type: "ATR", period: 14 }
  ],
  entryRules: [
    // Same as scalping but with RSI divergence option
    { condition: "RSI < 30", direction: "BUY" },
    { condition: "BULLISH_ENGULFING", direction: "BUY", confirmation: true },
    { condition: "RSI > 70", direction: "SELL" },
    { condition: "BEARISH_ENGULFING", direction: "SELL", confirmation: true }
  ],
  exitRules: [
    { type: "ATR_SL", multiplier: 1.5 },
    { type: "ATR_TP", multiplier: 2.0 }, // R:R 1:1.33 untuk intraday
    { type: "TRAILING_STOP", activationATR: 1.5, trailATR: 0.75 }
  ],
  riskRewardRatio: 1.33,
  maxHoldTime: 240 // Max 4 jam untuk intraday
};
```

#### Strategy 3: Trend Filter + RSI Engulfing (Optional)
```typescript
const trendFilteredStrategy: TradingStrategy = {
  name: "Trend Filtered RSI Engulfing",
  type: "TREND_FOLLOWING",
  timeframes: ["M5", "M15", "H1"],
  indicators: [
    { type: "EMA", period: 50 },  // Trend direction
    { type: "EMA", period: 200 }, // Major trend
    { type: "RSI", period: 14 },
    { type: "ATR", period: 14 }
  ],
  entryRules: [
    // Only trade in trend direction
    { condition: "EMA50 > EMA200", trend: "BULLISH" },
    { condition: "RSI < 40", direction: "BUY" }, // Less extreme in trend direction
    { condition: "BULLISH_ENGULFING", direction: "BUY", confirmation: true },
    
    { condition: "EMA50 < EMA200", trend: "BEARISH" },
    { condition: "RSI > 60", direction: "SELL" },
    { condition: "BEARISH_ENGULFING", direction: "SELL", confirmation: true }
  ],
  exitRules: [
    { type: "ATR_SL", multiplier: 2 },
    { type: "ATR_TP", multiplier: 3 },
    { type: "TRAILING_STOP", activationATR: 2, trailATR: 1 }
  ],
  riskRewardRatio: 1.5
};
```

### 5.3 Signal Generation Process (RSI + Engulfing)

```typescript
interface SignalAnalysis {
  rsi: number;
  atr: number;
  pattern: 'BULLISH_ENGULFING' | 'BEARISH_ENGULFING' | 'NONE';
  currentPrice: number;
  signal: TradingSignal | null;
}

async function generateSignal(
  symbol: string,
  timeframe: 'M5' | 'M15' | 'H1',
  accountInfo: MT5AccountInfo,
  config: PipelineConfig
): Promise<SignalAnalysis> {
  
  // 1. Fetch market data (minimum 50 candles untuk RSI calculation)
  const rates = await mt5CopyRates(symbol, timeframe, 50);
  const closes = rates.map(r => r.close);
  const currentPrice = rates[rates.length - 1].close;
  
  // 2. Calculate indicators
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(rates, 14);
  
  // 3. Detect Engulfing Pattern
  const pattern = detectEngulfingPattern(rates);
  
  // 4. Generate Signal berdasarkan kondisi
  let signal: TradingSignal | null = null;
  
  // BUY Signal: RSI Oversold + Bullish Engulfing
  if (rsi < 30 && pattern.type === 'BULLISH_ENGULFING') {
    const sl = currentPrice - (atr * 1.5);
    const tp = currentPrice + (atr * 1.5); // R:R 1:1
    
    signal = {
      symbol,
      direction: 'BUY',
      confidence: calculateConfidence(rsi, pattern),
      entry: currentPrice,
      sl,
      tp,
      reason: `RSI Oversold (${rsi.toFixed(2)}) + Bullish Engulfing. ATR: ${atr.toFixed(5)}`,
      riskPercent: config.maxRiskPerTrade,
      timeframe,
      indicators: { rsi, atr },
      pattern: pattern.type
    };
  }
  
  // SELL Signal: RSI Overbought + Bearish Engulfing
  else if (rsi > 70 && pattern.type === 'BEARISH_ENGULFING') {
    const sl = currentPrice + (atr * 1.5);
    const tp = currentPrice - (atr * 1.5); // R:R 1:1
    
    signal = {
      symbol,
      direction: 'SELL',
      confidence: calculateConfidence(rsi, pattern),
      entry: currentPrice,
      sl,
      tp,
      reason: `RSI Overbought (${rsi.toFixed(2)}) + Bearish Engulfing. ATR: ${atr.toFixed(5)}`,
      riskPercent: config.maxRiskPerTrade,
      timeframe,
      indicators: { rsi, atr },
      pattern: pattern.type
    };
  }
  
  return { rsi, atr, pattern: pattern.type, currentPrice, signal };
}

// Confidence calculation
function calculateConfidence(rsi: number, pattern: CandlePattern): number {
  let confidence = 50; // Base confidence
  
  // RSI extremity bonus
  if (pattern.type === 'BULLISH_ENGULFING') {
    // More oversold = higher confidence
    confidence += Math.min(25, (30 - rsi) * 2);
  } else if (pattern.type === 'BEARISH_ENGULFING') {
    // More overbought = higher confidence  
    confidence += Math.min(25, (rsi - 70) * 2);
  }
  
  // Engulfing pattern quality
  const prevCandle = pattern.candle1;
  const currCandle = pattern.candle2;
  
  // Larger engulfing = higher confidence
  const engulfRatio = Math.abs(currCandle.close - currCandle.open) / 
                      Math.abs(prevCandle.close - prevCandle.open);
  confidence += Math.min(25, engulfRatio * 10);
  
  return Math.min(100, Math.max(0, confidence));
}

// ATR Calculation
function calculateATR(rates: Rate[], period: number = 14): number {
  if (rates.length < period + 1) return 0;
  
  let atrSum = 0;
  
  for (let i = rates.length - period; i < rates.length; i++) {
    const high = rates[i].high;
    const low = rates[i].low;
    const prevClose = rates[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    atrSum += tr;
  }
  
  return atrSum / period;
}
```

### 5.4 Trailing Stop Logic (ATR-Based)

```typescript
interface TrailingStopConfig {
  enabled: boolean;
  activationATR: number;   // Profit dalam ATR multiplier untuk activate
  trailATR: number;        // Distance dalam ATR multiplier dari current price
  breakEven: boolean;      // Move SL to break even after activation
}

function manageTrailingStop(
  position: MT5Position,
  config: TrailingStopConfig,
  currentPrice: number,
  atr: number
): { shouldUpdate: boolean; newSL: number; reason: string } {
  
  if (!config.enabled) {
    return { shouldUpdate: false, newSL: 0, reason: 'Trailing stop disabled' };
  }
  
  // Calculate current profit in price terms
  const profitPrice = position.type === 'BUY'
    ? currentPrice - position.priceOpen
    : position.priceOpen - currentPrice;
  
  // Calculate profit dalam ATR
  const profitATR = profitPrice / atr;
  
  // Check if trailing should activate
  if (profitATR < config.activationATR) {
    return { 
      shouldUpdate: false, 
      newSL: 0, 
      reason: `Profit ${profitATR.toFixed(2)} ATR < Activation ${config.activationATR} ATR` 
    };
  }
  
  // Calculate new SL
  const trailDistance = atr * config.trailATR;
  const newSL = position.type === 'BUY'
    ? currentPrice - trailDistance
    : currentPrice + trailDistance;
  
  // Check if SL should move (only in profit direction)
  let shouldUpdate = false;
  let reason = '';
  
  if (position.type === 'BUY') {
    // For BUY, new SL must be higher than current SL
    if (newSL > position.sl) {
      shouldUpdate = true;
      reason = `Moving SL up from ${position.sl.toFixed(5)} to ${newSL.toFixed(5)}`;
    }
  } else {
    // For SELL, new SL must be lower than current SL
    if (newSL < position.sl || position.sl === 0) {
      shouldUpdate = true;
      reason = `Moving SL down from ${position.sl.toFixed(5)} to ${newSL.toFixed(5)}`;
    }
  }
  
  return { shouldUpdate, newSL, reason };
}

// Break Even Logic
function checkBreakEven(
  position: MT5Position,
  config: TrailingStopConfig,
  currentPrice: number,
  atr: number
): { shouldUpdate: boolean; newSL: number } {
  
  if (!config.breakEven) return { shouldUpdate: false, newSL: 0 };
  
  const profitATR = position.type === 'BUY'
    ? (currentPrice - position.priceOpen) / atr
    : (position.priceOpen - currentPrice) / atr;
  
  // Move to break even when profit >= activation ATR
  if (profitATR >= config.activationATR) {
    // Set SL to entry price (break even)
    const newSL = position.priceOpen;
    
    // Only update if it improves the position
    const shouldUpdate = position.type === 'BUY'
      ? newSL > position.sl
      : newSL < position.sl || position.sl === 0;
    
    return { shouldUpdate, newSL };
  }
  
  return { shouldUpdate: false, newSL: 0 };
}
```

### 5.5 Complete Trading Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              RSI + ENGULFING SCALPING PIPELINE                   │
└─────────────────────────────────────────────────────────────────┘

START LOOP (every 5 seconds for M5, 15 seconds for M15)
│
├──▶ 1. FETCH DATA
│    ├── Get last 50 candles untuk symbol yang dipilih
│    ├── Calculate RSI(14)
│    ├── Calculate ATR(14)
│    └── Detect Engulfing Pattern
│
├──▶ 2. CHECK OPEN POSITIONS
│    ├── Count current open positions
│    ├── Check if max positions reached
│    └── Manage trailing stops for existing positions
│
├──▶ 3. SIGNAL GENERATION
│    ├── Check RSI condition (Oversold < 30 / Overbought > 70)
│    ├── Check Engulfing Pattern (Bullish/Bearish)
│    └── If BOTH conditions met → Generate Signal
│
├──▶ 4. RISK CHECK (if signal exists)
│    ├── Check daily loss limit
│    ├── Check max open positions
│    ├── Check margin level (must be > 150%)
│    └── Calculate position size
│
├──▶ 5. EXECUTE TRADE (if risk check passed)
│    ├── Send order to MT5
│    ├── Set SL (Entry - 1.5x ATR)
│    ├── Set TP (Entry + 1.5x ATR)
│    └── Log trade to database
│
└──▶ 6. POSITION MANAGEMENT
     ├── Check if profit >= 1x ATR → Activate trailing stop
     ├── Move SL to trail by 0.5x ATR
     ├── Optional: Move SL to break even
     └── Check if TP hit or SL hit → Close position

LOOP BACK TO STEP 1
```

### 5.6 Position Size Calculation

```typescript
function calculatePositionSize(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  symbolInfo: MT5SymbolInfo
): number {
  // Risk amount in account currency
  const riskAmount = accountBalance * (riskPercent / 100);
  
  // Stop loss distance in points
  const slDistance = Math.abs(entryPrice - stopLoss);
  const slPoints = slDistance / symbolInfo.point;
  
  // Position size formula:
  // Risk = Lot Size × SL Points × Point Value
  // Lot Size = Risk / (SL Points × Point Value)
  
  const lotSize = riskAmount / (slPoints * symbolInfo.tradeContractSize * symbolInfo.point);
  
  // Round to min lot and step
  const minLot = symbolInfo.volumeMin;
  const maxLot = symbolInfo.volumeMax;
  const step = symbolInfo.volumeStep;
  
  const roundedLot = Math.floor(lotSize / step) * step;
  
  return Math.max(minLot, Math.min(maxLot, roundedLot));
}
```

### 5.7 Example Signal Output

```typescript
// Example Signal untuk EURUSD M15
{
  symbol: "EURUSD",
  direction: "BUY",
  confidence: 78,
  entry: 1.08520,
  sl: 1.08410,        // Entry - 1.5 × ATR (ATR = 0.00073)
  tp: 1.08630,        // Entry + 1.5 × ATR
  reason: "RSI Oversold (24.50) + Bullish Engulfing. ATR: 0.00073",
  riskPercent: 1.0,
  timeframe: "M15",
  indicators: {
    rsi: 24.50,
    atr: 0.00073
  },
  pattern: "BULLISH_ENGULFING",
  positionSize: 0.14,  // Calculated based on $10,000 balance, 1% risk
  potentialProfit: 110, // USD
  potentialLoss: 110   // USD (1:1 R:R)
}
```

---

## Phase 6: API Endpoints

### 6.1 Connection Endpoints

```typescript
// POST /api/ai-trading/connect
{
  server: "ICMarkets-Demo",
  login: "12345678",
  password: "password123"
}
// Response:
{
  success: true,
  accountInfo: {
    balance: 10000,
    equity: 10250,
    margin: 500,
    marginLevel: 205,
    currency: "USD"
  }
}

// POST /api/ai-trading/disconnect
// GET /api/ai-trading/status
```

### 6.2 Account Endpoints

```typescript
// GET /api/ai-trading/account
{
  balance: 10000,
  equity: 10250,
  margin: 500,
  freeMargin: 9750,
  marginLevel: 205,
  dailyPnL: 250,
  weeklyPnL: 750,
  openPositions: 2
}

// GET /api/ai-trading/metrics
{
  dailyDrawdown: 1.2,
  maxDrawdown: 3.5,
  openRisk: 200,
  sharpeRatio: 1.8,
  winRate: 65
}
```

### 6.3 Trading Endpoints

```typescript
// GET /api/ai-trading/symbols
{
  symbols: [
    {
      name: "EURUSD",
      bid: 1.0850,
      ask: 1.0852,
      spread: 2,
      minLot: 0.01,
      maxLot: 100
    }
  ]
}

// GET /api/ai-trading/positions
{
  positions: [
    {
      ticket: 12345,
      symbol: "EURUSD",
      type: "BUY",
      volume: 0.1,
      priceOpen: 1.0820,
      priceCurrent: 1.0850,
      sl: 1.0800,
      tp: 1.0900,
      profit: 30,
      swap: -0.50,
      comment: "AI-Trend"
    }
  ]
}

// POST /api/ai-trading/open
{
  symbol: "EURUSD",
  type: "BUY",
  volume: 0.1,
  sl: 1.0800,
  tp: 1.0900,
  comment: "AI-Trade"
}

// POST /api/ai-trading/close
{
  ticket: 12345
}

// POST /api/ai-trading/modify
{
  ticket: 12345,
  sl: 1.0810,
  tp: 1.0920
}
```

### 6.4 Pipeline Endpoints

```typescript
// POST /api/ai-trading/pipeline/start
{
  config: {
    symbols: ["EURUSD", "GBPUSD", "XAUUSD"],
    strategy: "trend_following",
    maxOpenPositions: 3,
    maxRiskPerTrade: 1.0,
    tradingHours: { start: "08:00", end: "20:00" },
    trailingStop: {
      enabled: true,
      activationProfit: 20,
      trailDistance: 10
    }
  }
}

// POST /api/ai-trading/pipeline/stop
// GET /api/ai-trading/pipeline/status
// GET /api/ai-trading/pipeline/logs

// POST /api/ai-trading/pipeline/pause
// POST /api/ai-trading/pipeline/resume
```

---

## Phase 7: Implementation Timeline

### Week 1: MT5 MCP Server & Connection
- [ ] Setup MT5 MCP Server (Python)
  - [ ] Install MetaTrader5 Python library
  - [ ] Create MCP server with basic tools
  - [ ] Implement connect/disconnect
  - [ ] Implement account_info
  - [ ] Implement symbols_get
  - [ ] Implement positions_get
  - [ ] Test with MT5 terminal
- [ ] Backend: Create mt5-mcp.service.ts
- [ ] Backend: Create ai-trading.routes.ts (connection endpoints)
- [ ] Frontend: Create AI Trading page structure
- [ ] Frontend: Implement ConnectionPanel component
- [ ] Test: Connection flow end-to-end

### Week 2: Trading Operations & RSI/Engulfing Logic
- [ ] MCP Server: Implement order_send, position_close, position_modify
- [ ] Backend: Create ai-trading-engine.service.ts
  - [ ] Implement RSI calculation
  - [ ] Implement ATR calculation
  - [ ] Implement Engulfing pattern detection
  - [ ] Implement signal generation
- [ ] Backend: Create risk-manager.service.ts
- [ ] Backend: Add trading endpoints (open, close, modify)
- [ ] Frontend: Implement AccountOverview component
- [ ] Frontend: Implement PositionsTable component
- [ ] Test: Manual trading operations

### Week 3: Trading Pipeline & Real-time Updates
- [ ] Backend: Create trading-pipeline.service.ts
  - [ ] Implement pipeline loop
  - [ ] Implement trailing stop logic (ATR-based)
  - [ ] Implement break-even logic
  - [ ] Implement position size calculation
- [ ] Backend: Add WebSocket for real-time updates
- [ ] Backend: Create AITradingSession & AITradeLog models
- [ ] Frontend: Implement TradingPanel component
- [ ] Frontend: Implement PnLChart component
- [ ] Test: Pipeline execution with demo account

### Week 4: Pipeline Config & UI Polish
- [ ] Frontend: Implement PipelineConfig component
  - [ ] Symbol selector
  - [ ] Timeframe selector (M5, M15, H1)
  - [ ] Risk settings
  - [ ] Trailing stop config
- [ ] Frontend: Implement PipelineLogs component
- [ ] Frontend: Implement RiskMetrics component
- [ ] Frontend: Add real-time updates (WebSocket)
- [ ] Backend: Add pipeline control endpoints (start/stop/pause)
- [ ] Test: Full pipeline flow

### Week 5: Testing & Optimization
- [ ] Paper trading testing (demo account)
- [ ] Backtest strategy on historical data
- [ ] Optimize parameters (RSI levels, ATR multipliers)
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deploy to production

---

## Security Considerations

### 7.1 Credential Storage
- MT5 password TIDAK disimpan di database
- Gunakan encryption untuk credentials di memory
- Session-based authentication dengan MT5

### 7.2 API Security
- Rate limiting untuk trading endpoints
- Request signing untuk sensitive operations
- IP whitelist option

### 7.3 Risk Controls
- Maximum daily loss limit
- Maximum open positions
- Maximum risk per trade
- Emergency stop button

---

## Dependencies to Add

### Backend
```json
{
  "dependencies": {
    // Already have these:
    "@modelcontextprotocol/sdk": "^1.29.0",
    "axios": "^1.14.0",
    "zod": "^4.3.6"
  }
}
```

### MT5 MCP Server (new directory)
```json
{
  "dependencies": {
    "MetaTrader5": "^5.0.45",
    "@modelcontextprotocol/sdk": "^1.29.0"
  }
}
```

### Frontend
```json
{
  "dependencies": {
    // Already have:
    "recharts": "^3.8.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.7.0"
  }
}
```

---

## File Structure Summary

```
server/
├── src/
│   ├── models/
│   │   ├── AITradingSession.ts (NEW)
│   │   └── AITradeLog.ts (NEW)
│   ├── routes/
│   │   └── ai-trading.routes.ts (NEW)
│   ├── services/
│   │   ├── mt5-mcp.service.ts (NEW)
│   │   ├── ai-trading-engine.service.ts (NEW)
│   │   ├── trading-pipeline.service.ts (NEW)
│   │   └── risk-manager.service.ts (NEW)
│   └── validators/
│       └── ai-trading.validator.ts (NEW)

frontend/
├── src/
│   ├── app/(dashboard)/ai-trading/
│   │   ├── page.tsx (NEW)
│   │   ├── components/ (NEW)
│   │   └── hooks/ (NEW)
│   └── services/
│       └── ai-trading.service.ts (NEW)

mcp-mt5-server/ (NEW)
├── server.py
├── requirements.txt
└── README.md
```

---

## Phase 8: Backend Routes & Validators

### 8.1 API Routes Structure

```typescript
// server/src/routes/ai-trading.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { mt5McpService } from "../services/mt5-mcp.service";
import { aiTradingEngine } from "../services/ai-trading-engine.service";
import { tradingPipelineService } from "../services/trading-pipeline.service";
import { riskManagerService } from "../services/risk-manager.service";
import { apiResponse } from "../utils/api-response";
import {
  mt5ConnectSchema,
  openPositionSchema,
  modifyPositionSchema,
  pipelineConfigSchema
} from "../validators/ai-trading.validator";

const router = Router();
router.use(requireAuth);

// ==================== CONNECTION ====================

router.post("/connect", validate({ body: mt5ConnectSchema }), async (req, res, next) => {
  try {
    const { server, login, password } = req.body;
    
    // Connect to MT5 via MCP
    const result = await mt5McpService.connect({ server, login, password });
    
    if (!result.success) {
      return apiResponse.error(res, result.message, "MT5_CONNECTION_FAILED", 400);
    }
    
    // Store connection info in session (NOT password)
    req.session.mt5Config = { server, login };
    
    return apiResponse.success(res, {
      connected: true,
      accountInfo: result.accountInfo
    });
  } catch (error) { next(error); }
});

router.post("/disconnect", async (req, res, next) => {
  try {
    await mt5McpService.disconnect();
    req.session.mt5Config = null;
    
    // Stop any running pipeline
    await tradingPipelineService.stopPipeline(req.user.id);
    
    return apiResponse.success(res, { connected: false });
  } catch (error) { next(error); }
});

router.get("/status", async (req, res, next) => {
  try {
    const isConnected = mt5McpService.isConnected();
    const pipelineStatus = await tradingPipelineService.getPipelineStatus(req.user.id);
    
    return apiResponse.success(res, {
      connected: isConnected,
      mt5Config: req.session.mt5Config,
      pipeline: pipelineStatus
    });
  } catch (error) { next(error); }
});

// ==================== ACCOUNT ====================

router.get("/account", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const accountInfo = await mt5McpService.getAccountInfo();
    const riskMetrics = await riskManagerService.calculateRiskMetrics(req.user.id);
    
    return apiResponse.success(res, {
      ...accountInfo,
      ...riskMetrics
    });
  } catch (error) { next(error); }
});

// ==================== TRADING ====================

router.get("/symbols", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const symbols = await mt5McpService.getSymbols();
    return apiResponse.success(res, { symbols });
  } catch (error) { next(error); }
});

router.get("/positions", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const positions = await mt5McpService.getPositions();
    return apiResponse.success(res, { positions, total: positions.length });
  } catch (error) { next(error); }
});

router.post("/open", validate({ body: openPositionSchema }), async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const { symbol, type, volume, sl, tp, comment } = req.body;
    
    // Risk check
    const riskCheck = await riskManagerService.checkTradeAllowed(req.user.id, req.body);
    if (!riskCheck.allowed) {
      return apiResponse.error(res, riskCheck.reason || "Risk limit exceeded", "RISK_LIMIT", 400);
    }
    
    // Execute order
    const result = await mt5McpService.openPosition({
      symbol,
      type,
      volume,
      sl,
      tp,
      comment: comment || "AI-Trading"
    });
    
    if (!result.success) {
      return apiResponse.error(res, result.error || "Order failed", "ORDER_FAILED", 400);
    }
    
    // Log trade
    await AITradeLog.create({
      userId: req.user.id,
      type: "MANUAL",
      symbol,
      direction: type,
      volume,
      entryPrice: result.price,
      sl,
      tp,
      mt5Ticket: result.ticket,
      executedAt: new Date()
    });
    
    return apiResponse.success(res, {
      success: true,
      ticket: result.ticket,
      price: result.price
    });
  } catch (error) { next(error); }
});

router.post("/close", async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const { ticket } = req.body;
    const result = await mt5McpService.closePosition(ticket);
    
    if (!result.success) {
      return apiResponse.error(res, result.error || "Close failed", "CLOSE_FAILED", 400);
    }
    
    return apiResponse.success(res, { success: true });
  } catch (error) { next(error); }
});

router.post("/modify", validate({ body: modifyPositionSchema }), async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const { ticket, sl, tp } = req.body;
    const result = await mt5McpService.modifyPosition(ticket, sl, tp);
    
    if (!result.success) {
      return apiResponse.error(res, result.error || "Modify failed", "MODIFY_FAILED", 400);
    }
    
    return apiResponse.success(res, { success: true });
  } catch (error) { next(error); }
});

// ==================== PIPELINE ====================

router.post("/pipeline/start", validate({ body: pipelineConfigSchema }), async (req, res, next) => {
  try {
    if (!mt5McpService.isConnected()) {
      return apiResponse.error(res, "MT5 not connected", "NOT_CONNECTED", 400);
    }
    
    const config = req.body;
    
    // Validate symbols exist
    const symbols = await mt5McpService.getSymbols();
    const validSymbols = config.symbols.filter(s => 
      symbols.some(sym => sym.name === s)
    );
    
    if (validSymbols.length === 0) {
      return apiResponse.error(res, "No valid symbols", "INVALID_SYMBOLS", 400);
    }
    
    // Start pipeline
    await tradingPipelineService.startPipeline(req.user.id, {
      ...config,
      symbols: validSymbols
    });
    
    return apiResponse.success(res, {
      running: true,
      config: { ...config, symbols: validSymbols }
    });
  } catch (error) { next(error); }
});

router.post("/pipeline/stop", async (req, res, next) => {
  try {
    await tradingPipelineService.stopPipeline(req.user.id);
    return apiResponse.success(res, { running: false });
  } catch (error) { next(error); }
});

router.post("/pipeline/pause", async (req, res, next) => {
  try {
    await tradingPipelineService.pausePipeline(req.user.id);
    return apiResponse.success(res, { paused: true });
  } catch (error) { next(error); }
});

router.post("/pipeline/resume", async (req, res, next) => {
  try {
    await tradingPipelineService.resumePipeline(req.user.id);
    return apiResponse.success(res, { paused: false });
  } catch (error) { next(error); }
});

router.get("/pipeline/status", async (req, res, next) => {
  try {
    const status = await tradingPipelineService.getPipelineStatus(req.user.id);
    return apiResponse.success(res, status);
  } catch (error) { next(error); }
});

router.get("/pipeline/logs", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await tradingPipelineService.getPipelineLogs(req.user.id, limit);
    return apiResponse.success(res, { logs });
  } catch (error) { next(error); }
});

export default router;
```

### 8.2 Validators

```typescript
// server/src/validators/ai-trading.validator.ts

import { z } from "zod";

export const mt5ConnectSchema = z.object({
  server: z.string().min(1, "Server required"),
  login: z.string().min(1, "Login required"),
  password: z.string().min(1, "Password required")
});

export const openPositionSchema = z.object({
  symbol: z.string().min(1, "Symbol required"),
  type: z.enum(["BUY", "SELL"]),
  volume: z.number().positive("Volume must be positive"),
  sl: z.number().optional(),
  tp: z.number().optional(),
  comment: z.string().max(100).optional()
});

export const modifyPositionSchema = z.object({
  ticket: z.number().int().positive(),
  sl: z.number().optional(),
  tp: z.number().optional()
});

export const pipelineConfigSchema = z.object({
  symbols: z.array(z.string()).min(1, "At least one symbol required"),
  timeframe: z.enum(["M5", "M15", "H1"]).default("M15"),
  strategy: z.enum(["RSI_ENGULFING_SCALPING", "RSI_ENGULFING_INTRADAY"]).default("RSI_ENGULFING_SCALPING"),
  
  // Risk settings
  maxOpenPositions: z.number().int().min(1).max(10).default(3),
  maxRiskPerTrade: z.number().min(0.1).max(5).default(1.0),
  maxDailyRisk: z.number().min(1).max(10).default(3.0),
  
  // Trading hours
  tradingHours: z.object({
    start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid start time"),
    end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid end time")
  }).optional(),
  
  // Trailing stop
  trailingStop: z.object({
    enabled: z.boolean().default(true),
    activationATR: z.number().positive().default(1.0),
    trailATR: z.number().positive().default(0.5),
    breakEven: z.boolean().default(false)
  }).optional(),
  
  // Exit settings
  atrMultiplierSL: z.number().positive().default(1.5),
  atrMultiplierTP: z.number().positive().default(1.5)
});
```

---

## Phase 9: Database Models

### 9.1 AI Trading Session Model

```typescript
// server/src/models/AITradingSession.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IAITradingSession extends Document {
  userId: string;
  tradingAccountId: string;
  
  // Connection
  mt5Connected: boolean;
  mt5Server: string;
  mt5Login: string;
  
  // Pipeline Config
  pipelineConfig: {
    symbols: string[];
    timeframe: string;
    strategy: string;
    maxOpenPositions: number;
    maxRiskPerTrade: number;
    maxDailyRisk: number;
    tradingHours?: { start: string; end: string };
    trailingStop?: {
      enabled: boolean;
      activationATR: number;
      trailATR: number;
      breakEven: boolean;
    };
  };
  
  // Status
  status: 'STOPPED' | 'RUNNING' | 'PAUSED' | 'ERROR';
  startedAt?: Date;
  stoppedAt?: Date;
  lastError?: string;
  
  // Metrics
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    maxDrawdown: number;
    dailyPnL: number;
    openPositions: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const AITradingSessionSchema = new Schema<IAITradingSession>({
  userId: { type: String, required: true, index: true },
  tradingAccountId: { type: String, required: true },
  
  mt5Connected: { type: Boolean, default: false },
  mt5Server: { type: String },
  mt5Login: { type: String },
  
  pipelineConfig: {
    symbols: [String],
    timeframe: { type: String, default: "M15" },
    strategy: { type: String, default: "RSI_ENGULFING_SCALPING" },
    maxOpenPositions: { type: Number, default: 3 },
    maxRiskPerTrade: { type: Number, default: 1.0 },
    maxDailyRisk: { type: Number, default: 3.0 },
    tradingHours: {
      start: String,
      end: String
    },
    trailingStop: {
      enabled: { type: Boolean, default: true },
      activationATR: { type: Number, default: 1.0 },
      trailATR: { type: Number, default: 0.5 },
      breakEven: { type: Boolean, default: false }
    }
  },
  
  status: {
    type: String,
    enum: ['STOPPED', 'RUNNING', 'PAUSED', 'ERROR'],
    default: 'STOPPED'
  },
  startedAt: Date,
  stoppedAt: Date,
  lastError: String,
  
  metrics: {
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    totalPnL: { type: Number, default: 0 },
    maxDrawdown: { type: Number, default: 0 },
    dailyPnL: { type: Number, default: 0 },
    openPositions: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: "ai_trading_sessions"
});

export const AITradingSession = mongoose.models.AITradingSession || 
  mongoose.model<IAITradingSession>("AITradingSession", AITradingSessionSchema);
```

### 9.2 AI Trade Log Model

```typescript
// server/src/models/AITradeLog.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IAITradeLog extends Document {
  userId: string;
  sessionId: string;
  
  // Signal info
  signal: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    confidence: number;
    entry: number;
    sl: number;
    tp: number;
    reason: string;
    timeframe: string;
    indicators: {
      rsi: number;
      atr: number;
    };
    pattern: string;
  };
  
  // Execution
  executed: boolean;
  executionPrice?: number;
  executionTime?: Date;
  mt5Ticket?: number;
  positionSize?: number;
  
  // Result
  closed: boolean;
  closedAt?: Date;
  closePrice?: number;
  closeReason?: 'TP_HIT' | 'SL_HIT' | 'MANUAL' | 'TIMEOUT' | 'SIGNAL';
  pnl?: number;
  pnlPips?: number;
  pnlPercent?: number;
  
  // Trailing stop history
  trailingHistory: {
    time: Date;
    oldSL: number;
    newSL: number;
    price: number;
  }[];
  
  // Analysis snapshot
  analysisSnapshot: {
    trend?: string;
    volatility?: number;
    support?: number[];
    resistance?: number[];
  };
  
  createdAt: Date;
}

const AITradeLogSchema = new Schema<IAITradeLog>({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  
  signal: {
    symbol: { type: String, required: true },
    direction: { type: String, enum: ['BUY', 'SELL'], required: true },
    confidence: { type: Number, min: 0, max: 100 },
    entry: { type: Number, required: true },
    sl: { type: Number, required: true },
    tp: { type: Number, required: true },
    reason: String,
    timeframe: String,
    indicators: {
      rsi: Number,
      atr: Number
    },
    pattern: String
  },
  
  executed: { type: Boolean, default: false },
  executionPrice: Number,
  executionTime: Date,
  mt5Ticket: Number,
  positionSize: Number,
  
  closed: { type: Boolean, default: false },
  closedAt: Date,
  closePrice: Number,
  closeReason: { type: String, enum: ['TP_HIT', 'SL_HIT', 'MANUAL', 'TIMEOUT', 'SIGNAL'] },
  pnl: Number,
  pnlPips: Number,
  pnlPercent: Number,
  
  trailingHistory: [{
    time: Date,
    oldSL: Number,
    newSL: Number,
    price: Number
  }],
  
  analysisSnapshot: {
    trend: String,
    volatility: Number,
    support: [Number],
    resistance: [Number]
  }
}, {
  timestamps: true,
  collection: "ai_trade_logs"
});

// Indexes for queries
AITradeLogSchema.index({ userId: 1, createdAt: -1 });
AITradeLogSchema.index({ sessionId: 1 });
AITradeLogSchema.index({ mt5Ticket: 1 });

export const AITradeLog = mongoose.models.AITradeLog || 
  mongoose.model<IAITradeLog>("AITradeLog", AITradeLogSchema);
```

---

---

## Phase 10: MT5 MCP Server (Python)

### 10.1 Directory Structure

```
mcp-mt5-server/
├── server.py              # Main MCP server
├── tools/
│   ├── connection.py      # Connect/disconnect tools
│   ├── account.py         # Account info tools
│   ├── market.py          # Symbols & price data tools
│   └── trading.py         # Order execution tools
├── requirements.txt
├── pyproject.toml
└── README.md
```

### 10.2 Main Server

```python
# mcp-mt5-server/server.py

import asyncio
import MetaTrader5 as mt5
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Create server instance
app = Server("mt5-trading-server")

# Global state
mt5_connected = False
mt5_config = {}

# ==================== TOOLS ====================

@app.list_tools()
async def list_tools():
    return [
        # Connection
        Tool(
            name="mt5_connect",
            description="Connect to MT5 terminal with server, login, password",
            inputSchema={
                "type": "object",
                "properties": {
                    "server": {"type": "string", "description": "Broker server name"},
                    "login": {"type": "string", "description": "Account number"},
                    "password": {"type": "string", "description": "Account password"}
                },
                "required": ["server", "login", "password"]
            }
        ),
        Tool(
            name="mt5_disconnect",
            description="Disconnect from MT5 terminal",
            inputSchema={"type": "object", "properties": {}}
        ),
        
        # Account
        Tool(
            name="mt5_account_info",
            description="Get account information (balance, equity, margin, etc.)",
            inputSchema={"type": "object", "properties": {}}
        ),
        
        # Market Data
        Tool(
            name="mt5_symbols_get",
            description="Get list of tradable symbols",
            inputSchema={
                "type": "object",
                "properties": {
                    "group": {"type": "string", "description": "Symbol group filter (e.g., '*EUR*')"}
                }
            }
        ),
        Tool(
            name="mt5_symbol_info",
            description="Get detailed symbol information",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol name"}
                },
                "required": ["symbol"]
            }
        ),
        Tool(
            name="mt5_copy_rates",
            description="Get historical price data (OHLCV)",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "timeframe": {"type": "string", "enum": ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]},
                    "count": {"type": "integer", "description": "Number of bars to fetch"}
                },
                "required": ["symbol", "timeframe", "count"]
            }
        ),
        Tool(
            name="mt5_symbol_info_tick",
            description="Get current bid/ask prices for symbol",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"}
                },
                "required": ["symbol"]
            }
        ),
        
        # Positions
        Tool(
            name="mt5_positions_get",
            description="Get all open positions",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mt5_position_get",
            description="Get specific position by ticket",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer"}
                },
                "required": ["ticket"]
            }
        ),
        
        # Trading
        Tool(
            name="mt5_order_send",
            description="Send trading order (open position)",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "action": {"type": "string", "enum": ["BUY", "SELL"]},
                    "volume": {"type": "number"},
                    "sl": {"type": "number"},
                    "tp": {"type": "number"},
                    "comment": {"type": "string"}
                },
                "required": ["symbol", "action", "volume"]
            }
        ),
        Tool(
            name="mt5_position_close",
            description="Close position by ticket",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer"}
                },
                "required": ["ticket"]
            }
        ),
        Tool(
            name="mt5_position_modify",
            description="Modify position SL/TP",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer"},
                    "sl": {"type": "number"},
                    "tp": {"type": "number"}
                },
                "required": ["ticket"]
            }
        ),
        
        # History
        Tool(
            name="mt5_history_deals_get",
            description="Get historical deals (closed trades)",
            inputSchema={
                "type": "object",
                "properties": {
                    "from": {"type": "integer", "description": "Unix timestamp"},
                    "to": {"type": "integer", "description": "Unix timestamp"}
                }
            }
        ),
    ]

# ==================== TOOL HANDLERS ====================

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    global mt5_connected, mt5_config
    
    # Connection tools
    if name == "mt5_connect":
        return await handle_connect(arguments)
    elif name == "mt5_disconnect":
        return await handle_disconnect()
    
    # Check connection for other tools
    if not mt5_connected:
        return [TextContent(type="text", text="Error: MT5 not connected")]
    
    # Account tools
    if name == "mt5_account_info":
        return await handle_account_info()
    
    # Market data tools
    elif name == "mt5_symbols_get":
        return await handle_symbols_get(arguments)
    elif name == "mt5_symbol_info":
        return await handle_symbol_info(arguments)
    elif name == "mt5_copy_rates":
        return await handle_copy_rates(arguments)
    elif name == "mt5_symbol_info_tick":
        return await handle_symbol_info_tick(arguments)
    
    # Position tools
    elif name == "mt5_positions_get":
        return await handle_positions_get()
    elif name == "mt5_position_get":
        return await handle_position_get(arguments)
    
    # Trading tools
    elif name == "mt5_order_send":
        return await handle_order_send(arguments)
    elif name == "mt5_position_close":
        return await handle_position_close(arguments)
    elif name == "mt5_position_modify":
        return await handle_position_modify(arguments)
    
    # History tools
    elif name == "mt5_history_deals_get":
        return await handle_history_deals_get(arguments)
    
    return [TextContent(type="text", text=f"Unknown tool: {name}")]

# ==================== HANDLERS ====================

async def handle_connect(args):
    global mt5_connected, mt5_config
    
    server = args["server"]
    login = int(args["login"])
    password = args["password"]
    
    # Initialize MT5
    if not mt5.initialize():
        return [TextContent(type="text", text=f"MT5 initialize failed: {mt5.last_error()}")]
    
    # Login
    if not mt5.login(login, password, server):
        mt5.shutdown()
        return [TextContent(type="text", text=f"MT5 login failed: {mt5.last_error()}")]
    
    mt5_connected = True
    mt5_config = {"server": server, "login": login}
    
    # Get account info
    account = mt5.account_info()
    if account:
        return [TextContent(type="text", text=f"""{{
    "success": true,
    "accountInfo": {{
        "login": {account.login},
        "server": "{account.server}",
        "currency": "{account.currency}",
        "balance": {account.balance},
        "equity": {account.equity},
        "margin": {account.margin},
        "freeMargin": {account.margin_free},
        "marginLevel": {account.margin_level if account.margin > 0 else 0},
        "leverage": {account.leverage}
    }}
}}""")]
    
    return [TextContent(type="text", text='{"success": true}')]

async def handle_disconnect():
    global mt5_connected, mt5_config
    
    mt5.shutdown()
    mt5_connected = False
    mt5_config = {}
    
    return [TextContent(type="text", text='{"success": true, "disconnected": true}')]

async def handle_account_info():
    account = mt5.account_info()
    if not account:
        return [TextContent(type="text", text=f'{{"error": "{mt5.last_error()}"}}')]
    
    return [TextContent(type="text", text=f"""{{
    "balance": {account.balance},
    "equity": {account.equity},
    "margin": {account.margin},
    "freeMargin": {account.margin_free},
    "marginLevel": {account.margin_level if account.margin > 0 else 0},
    "currency": "{account.currency}",
    "leverage": {account.leverage},
    "profit": {account.profit}
}}""")]

async def handle_symbols_get(args):
    group = args.get("group", None)
    symbols = mt5.symbols_get(group) if group else mt5.symbols_get()
    
    if symbols is None:
        return [TextContent(type="text", text="[]")]
    
    result = []
    for s in symbols:
        if s.visible:  # Only visible/tradable symbols
            result.append({
                "name": s.name,
                "description": s.description,
                "bid": s.bid,
                "ask": s.ask,
                "spread": s.spread,
                "point": s.point,
                "digits": s.digits,
                "tradeContractSize": s.trade_contract_size,
                "volumeMin": s.volume_min,
                "volumeMax": s.volume_max,
                "volumeStep": s.volume_step
            })
    
    import json
    return [TextContent(type="text", text=json.dumps({"symbols": result}))]

async def handle_symbol_info(args):
    symbol = args["symbol"]
    info = mt5.symbol_info(symbol)
    
    if info is None:
        return [TextContent(type="text", text=f'{{"error": "Symbol {symbol} not found"}}')]
    
    return [TextContent(type="text", text=f"""{{
    "name": "{info.name}",
    "bid": {info.bid},
    "ask": {info.ask},
    "spread": {info.spread},
    "point": {info.point},
    "digits": {info.digits},
    "tradeContractSize": {info.trade_contract_size},
    "volumeMin": {info.volume_min},
    "volumeMax": {info.volume_max},
    "volumeStep": {info.volume_step}
}}""")]

async def handle_copy_rates(args):
    import json
    from datetime import datetime
    
    symbol = args["symbol"]
    timeframe_str = args["timeframe"]
    count = args["count"]
    
    # Map timeframe string to MT5 constant
    tf_map = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30,
        "H1": mt5.TIMEFRAME_H1,
        "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1
    }
    
    timeframe = tf_map.get(timeframe_str, mt5.TIMEFRAME_M15)
    
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
    
    if rates is None:
        return [TextContent(type="text", text="[]")]
    
    result = []
    for r in rates:
        result.append({
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": int(r["tick_volume"])
        })
    
    return [TextContent(type="text", text=json.dumps({"rates": result}))]

async def handle_symbol_info_tick(args):
    symbol = args["symbol"]
    tick = mt5.symbol_info_tick(symbol)
    
    if tick is None:
        return [TextContent(type="text", text=f'{{"error": "Symbol {symbol} not found"}}')]
    
    return [TextContent(type="text", text=f"""{{
    "bid": {tick.bid},
    "ask": {tick.ask},
    "spread": {tick.ask - tick.bid},
    "time": {tick.time}
}}""")]

async def handle_positions_get():
    import json
    positions = mt5.positions_get()
    
    if positions is None:
        return [TextContent(type="text", text='{"positions": [], "total": 0}')]
    
    result = []
    for p in positions:
        result.append({
            "ticket": p.ticket,
            "symbol": p.symbol,
            "type": "BUY" if p.type == 0 else "SELL",
            "volume": p.volume,
            "priceOpen": p.price_open,
            "priceCurrent": p.price_current,
            "sl": p.sl,
            "tp": p.tp,
            "profit": p.profit,
            "swap": p.swap,
            "commission": p.commission,
            "comment": p.comment,
            "time": p.time
        })
    
    return [TextContent(type="text", text=json.dumps({"positions": result, "total": len(result)}))]

async def handle_position_get(args):
    ticket = args["ticket"]
    positions = mt5.positions_get(ticket=ticket)
    
    if positions is None or len(positions) == 0:
        return [TextContent(type="text", text=f'{{"error": "Position {ticket} not found"}}')]
    
    p = positions[0]
    return [TextContent(type="text", text=f"""{{
    "ticket": {p.ticket},
    "symbol": "{p.symbol}",
    "type": "{"BUY" if p.type == 0 else "SELL"}",
    "volume": {p.volume},
    "priceOpen": {p.price_open},
    "priceCurrent": {p.price_current},
    "sl": {p.sl},
    "tp": {p.tp},
    "profit": {p.profit}
}}""")]

async def handle_order_send(args):
    import json
    
    symbol = args["symbol"]
    action = args["action"]
    volume = args["volume"]
    sl = args.get("sl", 0.0)
    tp = args.get("tp", 0.0)
    comment = args.get("comment", "MCP-Trade")
    
    # Get symbol info for price
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return [TextContent(type="text", text=f'{{"success": false, "error": "Symbol not found"}}')]
    
    # Determine order type and price
    if action == "BUY":
        order_type = mt5.ORDER_TYPE_BUY
        price = tick.ask
    else:
        order_type = mt5.ORDER_TYPE_SELL
        price = tick.bid
    
    # Create request
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp,
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    # Send order
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": f"Order failed: {result.retcode} - {result.comment}"
        }))]
    
    return [TextContent(type="text", text=json.dumps({
        "success": True,
        "ticket": result.order,
        "price": result.price,
        "volume": result.volume,
        "comment": result.comment
    }))]

async def handle_position_close(args):
    import json
    
    ticket = args["ticket"]
    
    # Get position info
    positions = mt5.positions_get(ticket=ticket)
    if positions is None or len(positions) == 0:
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": f"Position {ticket} not found"
        }))]
    
    position = positions[0]
    
    # Determine close action
    if position.type == 0:  # BUY
        order_type = mt5.ORDER_TYPE_SELL
        price = mt5.symbol_info_tick(position.symbol).bid
    else:  # SELL
        order_type = mt5.ORDER_TYPE_BUY
        price = mt5.symbol_info_tick(position.symbol).ask
    
    # Create close request
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "position": ticket,
        "symbol": position.symbol,
        "volume": position.volume,
        "type": order_type,
        "price": price,
        "comment": "Close by MCP",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": f"Close failed: {result.retcode} - {result.comment}"
        }))]
    
    return [TextContent(type="text", text=json.dumps({
        "success": True,
        "ticket": result.order
    }))]

async def handle_position_modify(args):
    import json
    
    ticket = args["ticket"]
    sl = args.get("sl", None)
    tp = args.get("tp", None)
    
    # Get position info
    positions = mt5.positions_get(ticket=ticket)
    if positions is None or len(positions) == 0:
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": f"Position {ticket} not found"
        }))]
    
    position = positions[0]
    
    # Use current SL/TP if not provided
    if sl is None:
        sl = position.sl
    if tp is None:
        tp = position.tp
    
    # Create modify request
    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "position": ticket,
        "symbol": position.symbol,
        "sl": sl,
        "tp": tp,
    }
    
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": f"Modify failed: {result.retcode} - {result.comment}"
        }))]
    
    return [TextContent(type="text", text=json.dumps({
        "success": True,
        "sl": sl,
        "tp": tp
    }))]

async def handle_history_deals_get(args):
    import json
    from datetime import datetime, timedelta
    
    from_ts = args.get("from", int((datetime.now() - timedelta(days=7)).timestamp()))
    to_ts = args.get("to", int(datetime.now().timestamp()))
    
    deals = mt5.history_deals_get(from_ts, to_ts)
    
    if deals is None:
        return [TextContent(type="text", text='{"deals": []}')]
    
    result = []
    for d in deals:
        result.append({
            "ticket": d.ticket,
            "order": d.order,
            "symbol": d.symbol,
            "type": "BUY" if d.type == 0 else "SELL",
            "volume": d.volume,
            "price": d.price,
            "profit": d.profit,
            "time": d.time
        })
    
    return [TextContent(type="text", text=json.dumps({"deals": result}))]

# ==================== MAIN ====================

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
```

### 10.3 Requirements

```
# mcp-mt5-server/requirements.txt

MetaTrader5>=5.0.45
mcp>=1.0.0
```

### 10.4 PyProject

```toml
# mcp-mt5-server/pyproject.toml

[project]
name = "mt5-mcp-server"
version = "1.0.0"
description = "MCP Server for MetaTrader 5 trading"
requires-python = ">=3.10"
dependencies = [
    "MetaTrader5>=5.0.45",
    "mcp>=1.0.0"
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

### 10.5 Configuration

```json
// Add to MCP config
{
  "mcpServers": {
    "mt5": {
      "command": "python",
      "args": ["path/to/mcp-mt5-server/server.py"],
      "env": {}
    }
  }
}
```

---

## Next Steps

### Langkah Selanjutnya:

1. **Konfirmasi Plan** - Review plan ini dan berikan feedback jika ada yang perlu diubah

2. **Mulai Implementasi Phase 1** - Setup MT5 MCP Server:
   - Buat direktori `mcp-mt5-server/`
   - Install MetaTrader5 Python library
   - Buat MCP server dengan tools dasar (connect, disconnect, account_info)
   - Test koneksi dengan MT5 terminal

3. **Development Iteratif** - Setiap phase dengan testing menyeluruh

---

## Summary

### Fitur Utama AI Trading:

| Fitur | Deskripsi |
|-------|-----------|
| **MT5 Connection** | Koneksi ke MT5 via MCP Server dengan credentials (server, login, password) |
| **Account Overview** | Real-time display: Balance, Equity, Margin, Margin Level, PnL |
| **Trading Strategy** | RSI + Engulfing Pattern untuk entry signal |
| **Timeframe** | M5 (scalping), M15 (intraday), H1 (swing) |
| **Risk Management** | Position sizing otomatis, max risk per trade, daily risk limit |
| **Auto TP/SL** | ATR-based calculation (default 1.5x ATR) |
| **Trailing Stop** | ATR-based trailing dengan activation threshold |
| **Pipeline Control** | Start/Stop/Pause dengan real-time monitoring |

### Tech Stack:

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS, Recharts |
| **Backend** | Express.js, TypeScript, MongoDB/Mongoose |
| **MCP Server** | Python, MetaTrader5 library, MCP SDK |
| **Real-time** | WebSocket untuk live updates |
| **AI Engine** | RSI, ATR, Pattern Detection algorithms |

### File yang Akan Dibuat:

**Backend:**
- `server/src/models/AITradingSession.ts`
- `server/src/models/AITradeLog.ts`
- `server/src/routes/ai-trading.routes.ts`
- `server/src/services/mt5-mcp.service.ts`
- `server/src/services/ai-trading-engine.service.ts`
- `server/src/services/trading-pipeline.service.ts`
- `server/src/services/risk-manager.service.ts`
- `server/src/validators/ai-trading.validator.ts`

**Frontend:**
- `frontend/src/app/(dashboard)/ai-trading/page.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/ConnectionPanel.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/AccountOverview.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/PositionsTable.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/TradingPanel.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/PipelineConfig.tsx`
- `frontend/src/app/(dashboard)/ai-trading/components/PipelineLogs.tsx`
- `frontend/src/app/(dashboard)/ai-trading/hooks/useMT5Connection.ts`
- `frontend/src/app/(dashboard)/ai-trading/hooks/useAccountInfo.ts`
- `frontend/src/app/(dashboard)/ai-trading/hooks/usePositions.ts`
- `frontend/src/app/(dashboard)/ai-trading/hooks/usePipeline.ts`
- `frontend/src/services/ai-trading.service.ts`

**MCP Server:**
- `mcp-mt5-server/server.py`
- `mcp-mt5-server/requirements.txt`
- `mcp-mt5-server/pyproject.toml`

---

## Pertanyaan Konfirmasi

Sebelum mulai implementasi, mohon konfirmasi:

1. **MCP Server Location**: Di direktori mana MCP server harus ditempatkan?
   - Option A: Di root project (`D:\Journal Trade\mcp-mt5-server\`)
   - Option B: Di dalam server (`D:\Journal Trade\server\mcp-mt5-server\`)

2. **Default Settings**:
   - Risk per trade: 1% (OK?)
   - Max open positions: 3 (OK?)
   - Default timeframe: M15 (OK?)
   - ATR multiplier SL/TP: 1.5x (OK?)

3. **Symbols**: Pair apa saja yang ingin di-support awal?
   - Forex majors: EURUSD, GBPUSD, USDJPY, XAUUSD?
   - Atau sesuai dengan yang tersedia di broker?

4. **Prioritas Implementasi**: Mana yang lebih prioritas?
   - Option A: Connection + Manual Trading dulu
   - Option B: Full Pipeline dengan AI auto-trading

Setelah konfirmasi, saya akan mulai implementasi Phase 1.
