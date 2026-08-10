import MetaTrader5 as mt5
import sys
import json
import time

def respond(data):
    print(json.dumps(data, default=str))
    mt5.shutdown()
    sys.exit(0)

def fail(msg):
    print(json.dumps({"error": msg}))
    mt5.shutdown()
    sys.exit(1)

def ensure_mt5():
    """Initialize MT5 with retries. -6 usually means another process holds the
    terminal connection (only ONE python process can connect at a time), or the
    terminal needs re-authorization. Retry + shutdown helps in both cases.
    NOTE: Timeout handled by Node.js execFileAsync (kills process)."""
    for attempt in range(3):
        mt5.shutdown()
        if mt5.initialize():
            return True
        code = mt5.last_error()
        time.sleep(1)
    return False

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

def main():
    if not ensure_mt5():
        code = mt5.last_error()
        fail(f"initialize() failed, error code = {code}. Pastikan MT5 terminal terbuka & authorized.")

    action = sys.argv[1]
    payload = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    if action == "orders_get":
        symbol = payload.get("symbol")
        orders = mt5.orders_get(symbol=symbol) if symbol else mt5.orders_get()
        if orders is None:
            code = mt5.last_error()
            fail(f"orders_get failed: {code}")
        respond({"orders": [order_to_dict(o) for o in orders]})

    elif action == "positions_get":
        symbol = payload.get("symbol")
        positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
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
        result = mt5.order_send(req)
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
        position = mt5.positions_get(ticket=ticket)
        if not position:
            fail(f"position not found ticket={ticket}")
        pos = position[0]
        close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = mt5.symbol_info_tick(pos.symbol).bid if close_type == mt5.ORDER_TYPE_SELL else mt5.symbol_info_tick(pos.symbol).ask
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
        result = mt5.order_send(req)
        if result is None:
            fail(f"order_send(CLOSE) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    elif action == "position_modify":
        p = mt5.positions_get(ticket=int(payload.get("ticket", 0)))
        if not p:
            fail("position not found")
        pos = p[0]
        req = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": pos.symbol,
            "position": pos.ticket,
        }
        if "sl" in payload and payload.get("sl") is not None:
            req["sl"] = float(payload["sl"])
        if "tp" in payload and payload.get("tp") is not None:
            req["tp"] = float(payload["tp"])
        result = mt5.order_send(req)
        if result is None:
            fail(f"order_send(SLTP) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    elif action == "pending_modify":
        ticket = int(payload.get("ticket", 0))
        orders = mt5.orders_get(ticket=ticket)
        if not orders:
            fail(f"order not found ticket={ticket}")
        od = orders[0]
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
        result = mt5.order_send(req)
        if result is None:
            fail(f"order_send(MODIFY) returned None: {mt5.last_error()}")
        respond({
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "error": result.comment if result.retcode != mt5.TRADE_RETCODE_DONE else None,
        })

    elif action == "order_send":
        symbol = payload.get("symbol", "")
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            fail(f"symbol not found: {symbol}")
        # Pick a filling mode supported by this symbol
        filling_flags = symbol_info.filling_mode
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
            req["price"] = float(mt5.symbol_info_tick(req["symbol"]).ask)
        elif t == "SELL":
            req["type"] = mt5.ORDER_TYPE_SELL
            req["price"] = float(mt5.symbol_info_tick(req["symbol"]).bid)
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

        result = mt5.order_send(req)
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
