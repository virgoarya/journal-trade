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
  status: 'open' | 'closed';
}

export interface Mt5Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  status: string;
}
