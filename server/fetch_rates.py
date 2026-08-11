import MetaTrader5 as mt5
import sys
import json
from datetime import datetime

def main():
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: python fetch_rates.py <symbol> <timeframe> <mode:count|range> <from_ts|count> [to_ts]"}))
        return

    symbol = sys.argv[1]
    timeframe_str = sys.argv[2]
    mode = sys.argv[3]

    tf_map = {
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

    tf = tf_map.get(timeframe_str.upper())
    if tf is None:
        print(json.dumps({"error": f"Unknown timeframe '{timeframe_str}'. Valid: {', '.join(sorted(tf_map))}"}))
        return

    if not mt5.initialize():
        err = mt5.last_error()
        mt5.shutdown()
        print(json.dumps({"error": f"initialize() failed, error code = {err}"}))
        return

    try:
        if mode == "count":
            count = int(sys.argv[4])
            rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
        else:
            from_ts = int(sys.argv[4])
            to_ts = int(sys.argv[5])
            rates = mt5.copy_rates_range(symbol, tf, from_ts, to_ts)
    except ValueError as e:
        mt5.shutdown()
        print(json.dumps({"error": f"Invalid timestamp/count argument: {e}"}))
        return
    except IndexError:
        mt5.shutdown()
        print(json.dumps({"error": f"Missing argument for mode '{mode}'"}))
        return
    mt5.shutdown()

    if rates is None:
        print(json.dumps({"error": "Failed to retrieve rates"}))
        return

    result = []
    for r in rates:
        result.append({
            "time": int(r['time']),
            "open": float(r['open']),
            "high": float(r['high']),
            "low": float(r['low']),
            "close": float(r['close']),
            "tick_volume": int(r['tick_volume']),
            "spread": int(r['spread']),
            "real_volume": int(r['real_volume'])
        })

    print(json.dumps({"rates": result}))

if __name__ == "__main__":
    main()
