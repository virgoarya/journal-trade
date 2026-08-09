import MetaTrader5 as mt5
import sys
import json
import time
import signal
import multiprocessing
import queue
from typing import Any, Callable, Tuple

def run_with_timeout(func, args, kwargs, timeout=30):
    """Run a function in a separate process with timeout."""
    ctx = multiprocessing.get_context('spawn')
    result_queue = multiprocessing.Queue()
    
    def worker(q, func, args, kwargs):
        try:
            result = func(*args, **kwargs)
            q.put(('success', result))
        except Exception as e:
            q.put(('error', str(e)))
    
    process = multiprocessing.Process(target=worker, args=(result_queue, func, args, kwargs))
    process.start()
    process.join(timeout)
    
    if process.is_alive():
        process.terminate()
        process.join(timeout=2)
        return {'error': f'Operation timed out after {timeout} seconds'}
    
    try:
        status, result = result_queue.get_nowait()
        if status == 'success':
            return result
        else:
            return {'error': result}
    except queue.Empty:
        return {'error': 'No result returned from worker process'}

# Timeout constants
MT5_INIT_TIMEOUT = 30  # seconds
MT5_ORDER_TIMEOUT = 10  # seconds
MT5_QUERY_TIMEOUT = 15  # seconds

def with_timeout(func: Callable, timeout: int = MT5_QUERY_TIMEOUT):
    """Decorator to run MT5 calls with timeout."""
    def wrapper(*args, **kwargs):
        result = run_with_timeout(func, (), kwargs, timeout)
        if isinstance(result, dict) and 'error' in result:
            raise TimeoutError(result['error'])
        return result
    return wrapper

def with_init_timeout(func: Callable, timeout: int = MT5_INIT_TIMEOUT):
    """Decorator for MT5 initialization with longer timeout."""
    def wrapper(*args, **kwargs):
        result = run_with_timeout(func, (), {}, timeout)
        if isinstance(result, dict) and 'error' in result:
            raise TimeoutError(result['error'])
        return result
    return wrapper

def with_order_timeout(func: Callable, timeout: int = MT5_ORDER_TIMEOUT):
    """Decorator for order operations with longer timeout."""
    def wrapper(*args, **kwargs):
        result = run_with_timeout(func, (), kwargs, timeout)
        if isinstance(result, dict) and 'error' in result:
            raise TimeoutError(result['error'])
        return result
    return wrapper

def pos_to_dict(p):
    return {
        "ticket": p.ticket,
        "symbol": p.symbol,
        "type": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
        "volume": p.volume,
        "priceOpen": p.price_open,
        "priceCurrent": p.price_current,
        "sl": p.sl,
        "tp": p.tp,
        "profit": p.profit,
        "swap": p.swap,
        "commission": p.commission,
        "comment": p.comment,
        "time": p.time,
        "magic": p.magic,
    }

def order_to_dict(o):
    type_map = {
        mt5.ORDER_TYPE_BUY_LIMIT: "BUY_LIMIT",
        mt5.ORDER_TYPE_SELL_LIMIT: "SELL_LIMIT",
        mt5.ORDER_TYPE_BUY_STOP: "BUY_STOP",
        mt5.ORDER_TYPE_SELL_STOP: "SELL_STOP",
        mt5.ORDER_TYPE_BUY_STOP_LIMIT: "BUY_STOP_LIMIT",
        mt5.ORDER_TYPE_SELL_STOP_LIMIT: "SELL_STOP_LIMIT",
    }
    return {
        "ticket": o.ticket,
        "symbol": o.symbol,
        "type": type_map.get(o.type, str(o.type)),
        "volume": o.volume_initial,
        "priceOpen": o.price_open,
        "priceCurrent": o.price_current,
        "sl": o.sl,
        "tp": o.tp,
        "comment": o.comment,
        "time": o.time_setup,
        "magic": o.magic,
        "state": "placed" if o.state == mt5.ORDER_STATE_PLACED else "other",
    }

def ensure_mt5():
    """Initialize MT5 with retries. -6 usually means another process holds the
    terminal connection (only ONE python process can connect at a time), or the
    terminal needs re-authorization. Retry + shutdown helps in both cases."""
    for attempt in range(3):
        mt5.shutdown()
        if mt5.initialize():
            return True
        code = mt5.last_error()
        import time as _t
        _t.sleep(1)
    return False


@with_timeout
def mt5_symbol_info_tick(symbol):
    return mt5.symbol_info_tick(symbol)

def main():
    if not ensure_mt5():
        code = mt5.last_error()
        fail(f"initialize() failed, error code = {code}. Pastikan MT5 terminal terbuka & authorized.")

    action = sys.argv[1]
    payload = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    if action == "orders_get":
        symbol = payload.get("symbol")
        orders = run_with_timeout(mt5.orders_get, (), {"symbol": symbol}) if symbol else run_with_timeout(mt5.orders_get, (), {})
        if orders is None:
            code = mt5.last_error()
            fail(f"orders_get failed: {code}")
        respond({"orders": [order_to_dict(o) for o in orders]})

    elif action == "positions_get":
        symbol = payload.get("symbol")
        positions = run_with_timeout(mt5.positions_get, (), {"symbol": symbol}) if symbol else run_with_timeout(mt5.positions_get, (), {})
        if positions is None:
            code = mt5.last_error()
            fail(f"positions_get failed: {code}")
        respond({"positions": [pos_to_dict(p) for p in positions]})

    elif action == "order_delete":
        ticket = int(payload.get("ticket", 0))
        if ticket <= 0:
            fail("order_delete requires ticket")
        req = {
            "action": mt5.TRADE_ACTION_REMOVE,
            "order": ticket,
        }
        result = run_with_timeout(mt5.order_send, (), {"request": req}, MT5_ORDER_TIMEOUT)
        if result is None:
            fail(f"order_send(REMOVE) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment or ("done" if result.retcode == mt5.TRADE_RETCODE_DONE else f"retcode={result.retcode}"),
        })

    elif action == "position_close":
        ticket = int(payload.get("ticket", 0))
        if ticket <= 0:
            fail("position_close requires ticket")
        position_result = run_with_timeout(mt5.positions_get, (), {"ticket": ticket})
        if not position_result:
            fail(f"position not found ticket={ticket}")
        pos = position_result[0]
        close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
        symbol_tick_result = run_with_timeout(mt5_symbol_info_tick, (), {"symbol": pos.symbol})
        price = symbol_tick_result.bid if close_type == mt5.ORDER_TYPE_SELL else symbol_tick_result.ask
        req = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": float(pos.volume),
            "type": close_type,
            "position": pos.ticket,
            "price": float(price),
            "deviation": 30,
            "magic": pos.magic,
            "comment": "AI close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = run_with_timeout(mt5.order_send, (), {"request": req}, MT5_ORDER_TIMEOUT)
        if result is None:
            fail(f"order_send(CLOSE) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    elif action == "position_modify":
        position_result = run_with_timeout(mt5.positions_get, (), {"ticket": int(payload.get("ticket", 0))})
        if not position_result:
            fail("position not found")
        pos = position_result[0]
        req = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": pos.symbol,
            "position": pos.ticket,
        }
        if "sl" in payload and payload.get("sl") is not None:
            req["sl"] = float(payload["sl"])
        if "tp" in payload and payload.get("tp") is not None:
            req["tp"] = float(payload["tp"])
        result = run_with_timeout(mt5.order_send, (), {"request": req}, MT5_ORDER_TIMEOUT)
        if result is None:
            fail(f"order_send(SLTP) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    elif action == "pending_modify":
        ticket = int(payload.get("ticket", 0))
        orders_result = run_with_timeout(mt5.orders_get, (), {"ticket": ticket})
        if not orders_result:
            fail(f"order not found ticket={ticket}")
        od = orders_result[0]
        req = {
            "action": mt5.TRADE_ACTION_MODIFY,
            "order": od.ticket,
            "symbol": od.symbol,
            "price": od.price_open,  # MT5 requires the order trigger price on modify
        }
        if "price_open" in payload and payload.get("price_open") is not None:
            req["price"] = float(payload["price_open"])
        if "sl" in payload and payload.get("sl") is not None:
            req["sl"] = float(payload["sl"])
        if "tp" in payload and payload.get("tp") is not None:
            req["tp"] = float(payload["tp"])
        result = run_with_timeout(mt5.order_send, (), {"request": req}, MT5_ORDER_TIMEOUT)
        if result is None:
            fail(f"order_send(MODIFY) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    elif action == "order_send":
        symbol = payload.get("symbol", "")
        symbol_info_result = run_with_timeout(mt5.symbol_info, (), {"symbol": symbol})
        if symbol_info_result is None:
            fail(f"symbol not found: {symbol}")
        # Pick a filling mode supported by this symbol
        filling_flags = symbol_info_result.filling_mode
        # SYMBOL_FILLING_FOK=1, SYMBOL_FILLING_IOC=2
        if filling_flags & 1:  # FOK supported
            filling = mt5.ORDER_FILLING_FOK
        elif filling_flags & 2:  # IOC supported
            filling = mt5.ORDER_FILLING_IOC
        else:
            filling = mt5.ORDER_FILLING_RETURN

        req = {
            "action": mt5.TRADE_ACTION_DEAL if payload.get("type") in ("BUY", "SELL") else mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": float(payload.get("volume", 0.01)),
            "comment": payload.get("comment", "")[:31],
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        t = payload.get("type", "BUY").upper()
        if t == "BUY":
            req["type"] = mt5.ORDER_TYPE_BUY
            req["price"] = float(mt5_symbol_info_tick(req["symbol"]).ask)
        elif t == "SELL":
            req["type"] = mt5.ORDER_TYPE_SELL
            req["price"] = float(mt5_symbol_info_tick(req["symbol"]).bid)
        elif t == "BUY_LIMIT":
            req["type"] = mt5.ORDER_TYPE_BUY_LIMIT
            req["price"] = float(payload["price"])
        elif t == "SELL_LIMIT":
            req["type"] = mt5.ORDER_TYPE_SELL_LIMIT
            req["price"] = float(payload["price"])
        elif t == "BUY_STOP":
            req["type"] = mt5.ORDER_TYPE_BUY_STOP
            req["price"] = float(payload["price"])
        elif t == "SELL_STOP":
            req["type"] = mt5.ORDER_TYPE_SELL_STOP
            req["price"] = float(payload["price"])

        if "sl" in payload and payload.get("sl") is not None:
            req["sl"] = float(payload["sl"])
        if "tp" in payload and payload.get("tp") is not None:
            req["tp"] = float(payload["tp"])

        result = run_with_timeout(mt5.order_send, (), {"request": req}, MT5_ORDER_TIMEOUT)
        if result is None:
            fail(f"order_send returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "ticket": result.order,
            "price": result.price,
            "volume": result.volume,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    else:
        fail(f"unknown action: {action}")

if __name__ == "__main__":
    main()