import sys
import json
import time
from datetime import datetime

try:
    import MetaTrader5 as mt5
except Exception as e:
    print(json.dumps({"error": f"MetaTrader5 import failed: {e}"}))
    sys.exit(1)

TF_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
}


def _rates_to_json(rates):
    return [
        {
            "time": int(r["time"]),
            "open": round(float(r["open"]), 6),
            "high": round(float(r["high"]), 6),
            "low": round(float(r["low"]), 6),
            "close": round(float(r["close"]), 6),
            "volume": int(r["tick_volume"]),
        }
        for r in rates
    ]


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Invalid args"}))
        sys.exit(1)

    symbol = sys.argv[1]
    timeframe = TF_MAP.get(sys.argv[2], mt5.TIMEFRAME_M15)
    mode = sys.argv[3]

    if not mt5.initialize():
        print(json.dumps({"error": f"MT5 initialize failed: {mt5.last_error()}"}))
        sys.exit(1)

    try:
        if not mt5.symbol_select(symbol, True):
            print(json.dumps({"error": f"Failed to select symbol {symbol}: {mt5.last_error()}"}))
            sys.exit(1)

        if mode == "count":
            count = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
            count = max(1, min(count, 5000))
            rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
        else:
            if len(sys.argv) < 6:
                print(json.dumps({"error": "Invalid range args"}))
                sys.exit(1)
            from_ts = int(sys.argv[4])
            to_ts = int(sys.argv[5])
            rates = mt5.copy_rates_range(symbol, timeframe, from_ts, to_ts)

        if rates is None or len(rates) == 0:
            print(json.dumps({"error": f"No rates for {symbol}", "last_error": str(mt5.last_error())}))
            sys.exit(1)

        print(json.dumps({"rates": _rates_to_json(rates)}))
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
