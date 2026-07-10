#!/usr/bin/env python3
"""
MCP Server for MetaTrader 5 Trading
====================================
Provides tools for MT5 connection, market data, and trading operations
via the Model Context Protocol (MCP).
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta
from typing import Any

import MetaTrader5 as mt5
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# ---------------------------------------------------------------------------
# Server instance
# ---------------------------------------------------------------------------

app = Server("mt5-trading-server")
mt5_connected = False
mt5_config: dict[str, Any] = {}

# ---------------------------------------------------------------------------
# Timeframe mapping
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MT5_FILLING_MAP = {
    "FOK": 1,
    "IOC": 2,
    "RETURN": 4,
}


def _get_supported_filling_modes(symbol: str) -> list[str]:
    """
    Return list of supported filling modes for a symbol.
    Prioritas: RETURN > IOC > FOK.
    """
    info = mt5.symbol_info(symbol)
    if info is None:
        return ["RETURN"]  # fallback ke RETURN (paling aman)

    mask = info.filling_mode
    supported = []

    if mask & mt5.ORDER_FILLING_RETURN:
        supported.append("RETURN")
    if mask & mt5.ORDER_FILLING_IOC:
        supported.append("IOC")
    if mask & mt5.ORDER_FILLING_FOK:
        supported.append("FOK")

    return supported if supported else ["RETURN"]

def _get_filling_mode(symbol: str) -> int:
    """
    Get the best supported filling mode for a symbol.
    Prioritas: RETURN > IOC > FOK.
    """
    supported = _get_supported_filling_modes(symbol)

    if "RETURN" in supported:
        return mt5.ORDER_FILLING_RETURN
    if "IOC" in supported:
        return mt5.ORDER_FILLING_IOC
    if "FOK" in supported:
        return mt5.ORDER_FILLING_FOK

    return mt5.ORDER_FILLING_RETURN

def _ok(data: Any) -> list[TextContent]:
    """Wrap a JSON-serialisable object as a success response."""
    return [TextContent(type="text", text=json.dumps(data))]


def _err(msg: str) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps({"error": msg}))]


def _require_connected():
    if not mt5_connected:
        return _err("MT5 not connected. Call mt5_connect first.")


def _pos_dict(p) -> dict:
    try:
        return {
            "ticket": p.ticket,
            "symbol": p.symbol,
            "type": "BUY" if p.type == 0 else "SELL",
            "volume": p.volume,
            "priceOpen": p.price_open,
            "priceCurrent": p.price_current,
            "sl": getattr(p, "sl", 0) or 0,
            "tp": getattr(p, "tp", 0) or 0,
            "profit": p.profit,
            "swap": getattr(p, "swap", 0) or 0,
            "commission": getattr(p, "commission", 0) or 0,
            "comment": getattr(p, "comment", "") or "",
            "time": p.time,
            "magic": getattr(p, "magic", 0) or 0,
        }
    except AttributeError as e:
        # Log and return a minimal dict so one bad position doesn't kill the batch
        print(f"[MT5-ERROR] _pos_dict failed for ticket={getattr(p, 'ticket', '?')}: {e}", file=sys.stderr)
        return {
            "ticket": getattr(p, "ticket", 0),
            "symbol": getattr(p, "symbol", "?"),
            "type": "BUY" if getattr(p, "type", 0) == 0 else "SELL",
            "volume": getattr(p, "volume", 0),
            "priceOpen": getattr(p, "price_open", 0),
            "priceCurrent": getattr(p, "price_current", 0),
            "sl": getattr(p, "sl", 0) or 0,
            "tp": getattr(p, "tp", 0) or 0,
            "profit": getattr(p, "profit", 0),
            "swap": getattr(p, "swap", 0) or 0,
            "commission": getattr(p, "commission", 0) or 0,
            "comment": getattr(p, "comment", "") or "",
            "time": getattr(p, "time", 0),
            "magic": getattr(p, "magic", 0) or 0,
        }


def _account_dict(a) -> dict:
    return {
        "login": a.login,
        "server": a.server or "",
        "currency": a.currency or "",
        "balance": a.balance,
        "equity": a.equity,
        "margin": a.margin,
        "freeMargin": a.margin_free,
        "marginLevel": a.margin_level if a.margin > 0 else 0,
        "leverage": a.leverage,
        "profit": a.profit,
        "name": a.name or "",
    }


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

@app.list_tools()
async def list_tools():
    # ── Connection ────────────────────────────────────────────────────
    tools = [
        Tool(
            name="mt5_connect",
            description="Connect to MT5 terminal using broker server, login, and password",
            inputSchema={
                "type": "object",
                "properties": {
                    "server": {"type": "string", "description": "Broker server name, e.g. ICMarkets-Demo"},
                    "login": {"type": "string", "description": "Account number"},
                    "password": {"type": "string", "description": "Account password"},
                },
                "required": ["server", "login", "password"],
            },
        ),
        Tool(
            name="mt5_disconnect",
            description="Disconnect from MT5 terminal",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="mt5_debug_info",
            description="Get raw MT5 debug info (positions total and last error)",
            inputSchema={"type": "object", "properties": {}},
        ),
        # ── Account ───────────────────────────────────────────────────
        Tool(
            name="mt5_account_info",
            description="Get account information (balance, equity, margin, currency, leverage)",
            inputSchema={"type": "object", "properties": {}},
        ),
        # ── Market data ───────────────────────────────────────────────
        Tool(
            name="mt5_symbols_get",
            description="Get list of tradable symbols, optionally filtered by group (e.g. *EUR*, *USD*)",
            inputSchema={
                "type": "object",
                "properties": {
                    "group": {
                        "type": "string",
                        "description": "Wildcard filter, e.g. *EUR*, *USD*, *XAU*",
                    }
                },
            },
        ),
        Tool(
            name="mt5_symbol_info",
            description="Get detailed information for a single symbol (spread, contract size, min/max lot, etc.)",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol name, e.g. EURUSD"}
                },
                "required": ["symbol"],
            },
        ),
        Tool(
            name="mt5_copy_rates",
            description="Fetch historical OHLCV price data for a symbol",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol name"},
                    "timeframe": {
                        "type": "string",
                        "enum": ["M1", "M5", "M15", "M30", "H1", "H4", "D1"],
                        "description": "Timeframe of each candle",
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of candles to fetch (max 2000)",
                    },
                },
                "required": ["symbol", "timeframe", "count"],
            },
        ),
        Tool(
            name="mt5_copy_rates_range",
            description="Fetch historical OHLCV data within a date range (for backtesting)",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol name"},
                    "timeframe": {
                        "type": "string",
                        "enum": ["M1", "M5", "M15", "M30", "H1", "H4", "D1"],
                        "description": "Timeframe of each candle",
                    },
                    "from": {
                        "type": "integer",
                        "description": "Start unix timestamp",
                    },
                    "to": {
                        "type": "integer",
                        "description": "End unix timestamp",
                    },
                },
                "required": ["symbol", "timeframe", "from", "to"],
            },
        ),
        Tool(
            name="mt5_symbol_tick",
            description="Get current bid/ask tick for a symbol",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol name"}
                },
                "required": ["symbol"],
            },
        ),
        # ── Positions ─────────────────────────────────────────────────
        Tool(
            name="mt5_positions_get",
            description="Get all currently open positions",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="mt5_position_get",
            description="Get a single open position by ticket number",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer", "description": "Position ticket number"}
                },
                "required": ["ticket"],
            },
        ),
        # ── Trading ───────────────────────────────────────────────────
        Tool(
            name="mt5_debug_order",
            description="Debug order parameters: return all computed values WITHOUT executing the order (dry-run)",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol to test"},
                    "action": {
                        "type": "string",
                        "enum": ["BUY", "SELL"],
                        "description": "Trade direction",
                    },
                    "volume": {"type": "number", "description": "Lot size"},
                    "sl": {"type": "number", "description": "Stop Loss price (optional)"},
                    "tp": {"type": "number", "description": "Take Profit price (optional)"},
                },
                "required": ["symbol", "action", "volume"],
            },
        ),
        Tool(
            name="mt5_order_send",
            description="Open a new market order (BUY or SELL)",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol to trade"},
                    "action": {
                        "type": "string",
                        "enum": ["BUY", "SELL"],
                        "description": "Trade direction",
                    },
                    "volume": {"type": "number", "description": "Lot size"},
                    "sl": {"type": "number", "description": "Stop Loss price (optional)"},
                    "tp": {"type": "number", "description": "Take Profit price (optional)"},
                    "comment": {
                        "type": "string",
                        "description": "Optional comment (max 32 chars)",
                    },
                },
                "required": ["symbol", "action", "volume"],
            },
        ),
        Tool(
            name="mt5_position_close",
            description="Close an open position by ticket number",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer", "description": "Position ticket number to close"}
                },
                "required": ["ticket"],
            },
        ),
        Tool(
            name="mt5_position_modify",
            description="Modify SL and/or TP of an open position",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer", "description": "Position ticket number"},
                    "sl": {"type": "number", "description": "New Stop Loss price (omit to keep current)"},
                    "tp": {"type": "number", "description": "New Take Profit price (omit to keep current)"},
                },
                "required": ["ticket"],
            },
        ),
        # ── History ───────────────────────────────────────────────────
        Tool(
            name="mt5_history_deals_get",
            description="Get historical deals (closed trades) within a date range",
            inputSchema={
                "type": "object",
                "properties": {
                    "from": {
                        "type": "integer",
                        "description": "Start unix timestamp (default: 7 days ago)",
                    },
                    "to": {
                        "type": "integer",
                        "description": "End unix timestamp (default: now)",
                    },
                },
            },
        ),
    ]
    return tools


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    global mt5_connected, mt5_config

    # ── Connection ────────────────────────────────────────────────────
    if name == "mt5_connect":
        server = arguments["server"]
        login = int(arguments["login"])
        password = arguments["password"]

        if mt5_connected:
            mt5.shutdown()
            mt5_connected = False

        # Initialize MT5 terminal
        if not mt5.initialize(login=login, password=password, server=server):
            return _err(f"MT5 initialize failed: {mt5.last_error()}")

        mt5_connected = True
        mt5_config = {"server": server, "login": login}

        account = mt5.account_info()
        if account:
            return _ok({"success": True, "accountInfo": _account_dict(account)})
        return _ok({"success": True})


    if name == "mt5_disconnect":
        mt5.shutdown()
        mt5_connected = False
        mt5_config = {}
        return _ok({"disconnected": True})

    # ── Debug ────────────────────────────────────────────────────────────
    if name == "mt5_debug_info":
        err = _require_connected()
        if err:
            return err
        total = mt5.positions_total()
        err_info = mt5.last_error()
        pos_list = mt5.positions_get()
        if pos_list is None:
            pos_count = 0
            pos_list_info = f"None (last_error: {err_info})"
        elif isinstance(pos_list, tuple):
            pos_count = len(pos_list)
            pos_list_info = f"tuple({pos_count})"
        else:
            pos_count = len(pos_list)
            pos_list_info = f"list({pos_count})"
        return _ok({
            "positions_total": total,
            "positions_get_count": pos_count,
            "positions_get_type": pos_list_info,
            "last_error": err_info,
            "symbols_total": mt5.symbols_total(),
            "account": _account_dict(mt5.account_info()) if mt5.account_info() else None,
        })

    # ── Guard ─────────────────────────────────────────────────────────
    err = _require_connected()
    if err:
        return err

    # ── Account ───────────────────────────────────────────────────────
    if name == "mt5_account_info":
        a = mt5.account_info()
        return _ok(_account_dict(a)) if a else _err(str(mt5.last_error()))

    # ── Market data ───────────────────────────────────────────────────
    if name == "mt5_symbols_get":
        group = arguments.get("group")
        symbols = mt5.symbols_get(group) if group else mt5.symbols_get()
        if symbols is None:
            err = mt5.last_error()
            print(f"[MT5-ERROR] mt5.symbols_get() returned None: {err}", file=sys.stderr)
            return _ok({"symbols": []})
        result = [
            {
                "name": s.name,
                "description": s.description or "",
                "bid": s.bid,
                "ask": s.ask,
                "spread": s.spread,
                "point": s.point,
                "digits": s.digits,
                "tradeContractSize": s.trade_contract_size,
                "volumeMin": s.volume_min,
                "volumeMax": s.volume_max,
                "volumeStep": s.volume_step,
                "visible": s.visible,
            }
            for s in symbols
        ]
        return _ok({"symbols": result})

    if name == "mt5_symbol_info":
        info = mt5.symbol_info(arguments["symbol"])
        if info is None:
            return _err(f"Symbol '{arguments['symbol']}' not found")
        return _ok({
            "name": info.name,
            "description": info.description or "",
            "bid": info.bid,
            "ask": info.ask,
            "spread": info.spread,
            "point": info.point,
            "digits": info.digits,
            "tradeContractSize": info.trade_contract_size,
            "volumeMin": info.volume_min,
            "volumeMax": info.volume_max,
            "volumeStep": info.volume_step,
            "visible": info.visible,
        })

    if name == "mt5_copy_rates":
        symbol = arguments["symbol"]
        timeframe = TF_MAP.get(arguments["timeframe"], mt5.TIMEFRAME_M15)
        count = min(arguments.get("count", 100), 2000)
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
        if rates is None:
            err = mt5.last_error()
            print(f"[MT5-ERROR] mt5.copy_rates_from_pos({symbol}) returned None: {err}", file=sys.stderr)
            return _err(f"No rates for {symbol} {arguments['timeframe']}")
        result = [
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
        return _ok({"rates": result, "symbol": symbol, "timeframe": arguments["timeframe"]})

    if name == "mt5_copy_rates_range":
        symbol = arguments["symbol"]
        timeframe = TF_MAP.get(arguments["timeframe"], mt5.TIMEFRAME_M15)
        from_ts = arguments["from"]
        to_ts = arguments["to"]

        if not mt5.symbol_select(symbol, True):
            return _err(f"Failed to select symbol {symbol}")

        rates = mt5.copy_rates_range(symbol, timeframe, from_ts, to_ts)
        if rates is None or len(rates) == 0:
            err = mt5.last_error()
            print(f"[MT5-ERROR] mt5.copy_rates_range({symbol}) returned None: {err}", file=sys.stderr)
            return _err(f"No rates for {symbol} between given dates")
        result = [
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
        return _ok({
            "rates": result,
            "symbol": symbol,
            "timeframe": arguments["timeframe"],
            "from": from_ts,
            "to": to_ts,
            "total": len(result),
        })

    if name == "mt5_symbol_tick":
        tick = mt5.symbol_info_tick(arguments["symbol"])
        if tick is None:
            return _err(f"Symbol '{arguments['symbol']}' not found")
        return _ok({
            "bid": tick.bid,
            "ask": tick.ask,
            "spread": round(tick.ask - tick.bid, 1),
            "time": tick.time,
        })

    # ── Positions ─────────────────────────────────────────────────────
    if name == "mt5_positions_get":
        total = mt5.positions_total()
        err_info = mt5.last_error()
        print(f"[MT5-DEBUG] positions_total()={total}, last_error()={err_info}", file=sys.stderr)
        positions = mt5.positions_get()
        if positions is None:
            err = mt5.last_error()
            print(f"[MT5-ERROR] mt5.positions_get() returned None: {err}", file=sys.stderr)
            return _ok({"positions": [], "total": 0})
        if isinstance(positions, tuple):
            # positions_get returns a tuple; we check it
            print(f"[MT5-DEBUG] mt5.positions_get() type=tuple len={len(positions)}", file=sys.stderr)
        result = [_pos_dict(p) for p in positions]
        return _ok({"positions": result, "total": len(result)})

    if name == "mt5_position_get":
        ticket = arguments["ticket"]
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return _err(f"Position {ticket} not found")
        return _ok(_pos_dict(positions[0]))

    # ── Trading ───────────────────────────────────────────────────────
    if name == "mt5_order_send":
        symbol = arguments["symbol"]
        action = arguments["action"]
        volume = arguments["volume"]
        sl = arguments.get("sl", 0.0)
        tp = arguments.get("tp", 0.0)
        comment = (arguments.get("comment") or "AI-Trade")[:32]

        # Select symbol di MT5 — penting untuk beberapa broker
        if not mt5.symbol_select(symbol, True):
            print(f"[MT5-WARN] symbol_select({symbol}) returned False, proceeding anyway", file=sys.stderr)

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return _err(f"Symbol '{symbol}' not found")

        order_type = mt5.ORDER_TYPE_BUY if action == "BUY" else mt5.ORDER_TYPE_SELL
        price = tick.ask if action == "BUY" else tick.bid

        filling_mode = _get_filling_mode(symbol)

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
            "type_filling": filling_mode,
        }

        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            # Debug: print full request details
            print(f"DEBUG: Order request: {request}", file=sys.stderr)
            print(f"DEBUG: Symbol info: {mt5.symbol_info(symbol)}", file=sys.stderr)
            print(f"DEBUG: Account info: {mt5.account_info()}", file=sys.stderr)

            # Handle retcode=10030 (Unsupported filling mode) — try ALL other modes
            if result.retcode == 10030:
                for try_mode in sorted([mt5.ORDER_FILLING_RETURN, mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK]):
                    if try_mode == filling_mode:
                        continue  # skip the one that already failed
                    print(f"[MT5-WARN] Filling mode {filling_mode} failed for {symbol}, retrying with {try_mode}...", file=sys.stderr)
                    request["type_filling"] = try_mode
                    result = mt5.order_send(request)
                    if result.retcode == mt5.TRADE_RETCODE_DONE:
                        break  # success!
                else:
                    # All modes exhausted — report last error with comprehensive details
                    sym_info = mt5.symbol_info(symbol)
                    filling_mask = sym_info.filling_mode if sym_info else "N/A"
                    return _err(
                        f"Order failed: retcode={result.retcode} "
                        f"filling_mode_attempted={request['type_filling']} "
                        f"symbol_filling_mask={filling_mask} "
                        f"comment={result.comment}"
                    )
            else:
                # Map common retcodes to human-readable messages
                retcode_msgs = {
                    10004: "Trade disabled / not allowed (check AutoTrading button in MT5)",
                    10006: "No connection to trade server (check internet/MT5 terminal)",
                    10007: "Too many requests (reduce order frequency)",
                    10014: "Invalid price (slippage too high — try again)",
                    10015: "Invalid SL/TP values",
                    10016: "Invalid volume (check min/max lot)",
                    10017: "Market is closed",
                    10018: "Not enough money (check margin/free margin)",
                    10019: "Orders cancelled by dealer",
                    10020: "Order is locked (already being processed)",
                    10021: "Modification denied (position too close to market)",
                    10022: "Too many orders",
                    10023: "Hedging not allowed",
                    10024: "Prohibited by FIFO rule",
                }
                user_msg = retcode_msgs.get(result.retcode, f"Unknown trade error (retcode={result.retcode})")
                sym_info = mt5.symbol_info(symbol)
                filling_mask = sym_info.filling_mode if sym_info else "N/A"
                return _err(
                    f"Order failed: retcode={result.retcode} ({user_msg}) "
                    f"filling_mode={filling_mode} symbol_filling_mask={filling_mask} "
                    f"comment={result.comment}"
                )

        return _ok({
            "success": True,
            "ticket": result.order,
            "price": result.price,
            "volume": result.volume,
            "comment": result.comment,
        })

    if name == "mt5_position_close":
        ticket = arguments["ticket"]
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return _err(f"Position {ticket} not found")

        pos = positions[0]
        is_buy = pos.type == 0
        tick = mt5.symbol_info_tick(pos.symbol)
        if tick is None:
            return _err(f"Cannot get tick for {pos.symbol}")

        order_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY
        price = tick.bid if is_buy else tick.ask
        filling_mode = _get_filling_mode(pos.symbol)

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": ticket,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": order_type,
            "price": price,
            "comment": "Close by MCP",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling_mode,
        }

        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return _err(f"Close failed: retcode={result.retcode} filling_mode={filling_mode} comment={result.comment}")
        return _ok({"success": True, "ticket": result.order, "price": result.price})

    if name == "mt5_position_modify":
        ticket = arguments["ticket"]
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return _err(f"Position {ticket} not found")

        pos = positions[0]
        sl = arguments.get("sl", pos.sl or 0)
        tp = arguments.get("tp", pos.tp or 0)
        if sl == 0:
            sl = pos.sl or 0
        if tp == 0:
            tp = pos.tp or 0

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": ticket,
            "symbol": pos.symbol,
            "sl": sl,
            "tp": tp,
        }

        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return _err(f"Modify failed: retcode={result.retcode} comment={result.comment}")
        return _ok({"success": True, "sl": sl, "tp": tp})

    # ── History ───────────────────────────────────────────────────────
    if name == "mt5_history_deals_get":
        now = datetime.now()
        from_ts = arguments.get("from", int((now - timedelta(days=7)).timestamp()))
        to_ts = arguments.get("to", int(now.timestamp()))
        deals = mt5.history_deals_get(from_ts, to_ts)
        if deals is None:
            return _ok({"deals": []})
        result = [
            {
                "ticket": d.ticket,
                "order": d.order or 0,
                "symbol": d.symbol,
                "type": "BUY" if d.type == 0 else "SELL",
                "volume": d.volume,
                "price": d.price,
                "profit": d.profit,
                "commission": d.commission or 0,
                "swap": d.swap or 0,
                "time": d.time,
                "comment": d.comment or "",
            }
            for d in deals
        ]
        return _ok({"deals": result})

    # ── Debug Order (dry-run, no execution) ──────────────────────────
    if name == "mt5_debug_order":
        symbol = arguments["symbol"]
        action = arguments["action"]
        volume = arguments["volume"]
        sl = arguments.get("sl", 0.0)
        tp = arguments.get("tp", 0.0)

        info = mt5.symbol_info(symbol)
        if info is None:
            return _err(f"Symbol '{symbol}' not found in Market Watch")

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return _err(f"Cannot get tick for '{symbol}'")

        account = mt5.account_info()
        filling_mask = info.filling_mode
        supported_modes = _get_supported_filling_modes(symbol)
        chosen_mode_name = "RETURN" if mt5.ORDER_FILLING_RETURN & filling_mask else (
            "IOC" if mt5.ORDER_FILLING_IOC & filling_mask else (
                "FOK" if mt5.ORDER_FILLING_FOK & filling_mask else "RETURN (fallback)"
            )
        )
        chosen_mode_int = _get_filling_mode(symbol)

        # Validasi volume
        vol_ok = info.volume_min <= volume <= info.volume_max
        vol_msg = "OK" if vol_ok else f"OUT OF RANGE (min={info.volume_min}, max={info.volume_max}, step={info.volume_step})"

        # Validasi SL/TP
        sltp_issues = []
        price = tick.ask if action == "BUY" else tick.bid
        if sl:
            sl_dist = abs(price - sl)
            stops_level = getattr(info, "trade_stops_level", 0) * info.point
            if sl_dist < stops_level:
                sltp_issues.append(f"SL too close (dist={sl_dist}, min stops_level={stops_level})")
        if tp:
            tp_dist = abs(tp - price)
            stops_level = getattr(info, "trade_stops_level", 0) * info.point
            if tp_dist < stops_level:
                sltp_issues.append(f"TP too close (dist={tp_dist}, min stops_level={stops_level})")

        return _ok({
            "symbol": symbol,
            "action": action,
            "volume": volume,
            "price": price,
            "sl": sl,
            "tp": tp,
            "tick": {"bid": tick.bid, "ask": tick.ask, "spread": tick.ask - tick.bid},
            "symbol": {
                "name": info.name,
                "digits": info.digits,
                "point": info.point,
                "tradeContractSize": info.trade_contract_size,
                "volumeMin": info.volume_min,
                "volumeMax": info.volume_max,
                "volumeStep": info.volume_step,
                "tradeStopsLevel": getattr(info, "trade_stops_level", 0),
            },
            "filling": {
                "mask": filling_mask,
                "supportedModes": supported_modes,
                "chosenModeName": chosen_mode_name,
                "chosenModeInt": chosen_mode_int,
            },
            "account": _account_dict(account) if account else None,
            "validation": {
                "volume": vol_msg,
                "sltp": sltp_issues if sltp_issues else ["OK"],
            },
        })

    return _err(f"Unknown tool: {name}")


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
