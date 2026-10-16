// Shared MT5 payload types — MUST stay in sync with frontend/src/types/ws-types.ts
// Any change here requires updating the frontend counterpart + contract test.

export interface Mt5Tick {
  symbol: string;
  bid: number;
  ask: number;
  time: Date;
}

export interface Mt5Position {
  id: string;
  symbol: string;
  entryPrice: number;
  pnl: number;
  status: "open" | "closed";
}

export interface Mt5Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  status: string;
}

export interface Mt5AccountInfo {
  login: number;
  server: string;
  broker: string;
  name: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  profit: number;
  type: string;
  read_only: boolean;
}

// The full payload broadcast on the "mt5_tick" channel.
export interface Mt5TickPayload {
  positions: Mt5Position[];
  orders: Mt5Order[];
  accountInfo: Mt5AccountInfo | null;
}
