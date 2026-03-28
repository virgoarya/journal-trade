export const ASSET_PAIRS = [
  "XAUUSD", "BTCUSD", "ETHUSD", 
  "EURUSD", "GBPUSD", "USDJPY", 
  "GBPJPY", "AUDUSD", "NAS100", 
  "US30"
] as const;

export const SESSIONS = [
  "London", "New York", "Asian", "All"
] as const;

export const TRADE_RESULTS = [
  "WIN", "LOSS", "BREAKEVEN"
] as const;

export const TRADE_DIRECTIONS = [
  "LONG", "SHORT"
] as const;

export const EMOTIONAL_STATES = [
  { value: 1, label: "Tilted" },
  { value: 2, label: "Anxious" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Confident" },
  { value: 5, label: "Euphoric" },
];
