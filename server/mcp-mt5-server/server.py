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
import os
import threading
import websockets
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
    """
    info = mt5.symbol_info(symbol)
    if info is None:
        return ["RETURN"]

    mask = info.filling_mode
    supported = []

    try:
        # mt5.SYMBOL_FILLING_FOK is 1, mt5.SYMBOL_FILLING_IOC is 2
        if mask & mt5.SYMBOL_FILLING_FOK:
            supported.append("FOK")
        if mask & mt5.SYMBOL_FILLING_IOC:
            supported.append("IOC")
    except AttributeError:
        # Fallback to standard bitmask values if attributes are missing
        if mask & 1:
            supported.append("FOK")
        if mask & 2:
            supported.append("IOC")

    return supported if supported else ["RETURN"]

def _get_filling_mode(symbol: str) -> int:
    """
    Get the best supported filling mode for a symbol.
    Priority: IOC > FOK > RETURN.
    """
    supported = _get_supported_filling_modes(symbol)

    if "IOC" in supported:
        return mt5.ORDER_FILLING_IOC
    if "FOK" in supported:
        return mt5.ORDER_FILLING_FOK
    if "RETURN" in supported:
        return mt5.ORDER_FILLING_RETURN

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
        Tool(
            name="mt5_orders_get",
            description="Get all active pending orders",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="mt5_order_cancel",
            description="Cancel an active pending order by ticket number",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket": {"type": "integer", "description": "Order ticket number"}
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
            description="Open a market or pending order",
            inputSchema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Symbol name"},
                    "action": {
                        "type": "string",
                        "enum": ["BUY", "SELL", "BUY_LIMIT", "SELL_LIMIT", "BUY_STOP", "SELL_STOP"],
                        "description": "Order direction / type",
                    },
                    "volume": {"type": "number", "description": "Lot size"},
                    "price": {"type": "number", "description": "Entry price (required for pending orders)"},
                    "sl": {"type": "number", "description": "Stop Loss price"},
                    "tp": {"type": "number", "description": "Take Profit price"},
                    "comment": {"type": "string", "description": "Order comment"},
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

def sync_call_tool(name: str, arguments: dict) -> list[TextContent]:
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
        # Debugging print removed
        positions = mt5.positions_get()
        if positions is None:
            err = mt5.last_error()
            print(f"[MT5-ERROR] mt5.positions_get() returned None: {err}", file=sys.stderr)
            return _ok({"positions": [], "total": 0})
        if isinstance(positions, tuple):
            # positions_get returns a tuple; we check it
            pass
        result = [_pos_dict(p) for p in positions]
        return _ok({"positions": result, "total": len(result)})

    if name == "mt5_position_get":
        ticket = arguments["ticket"]
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return _err(f"Position {ticket} not found")
        return _ok(_pos_dict(positions[0]))

    if name == "mt5_orders_get":
        orders = mt5.orders_get()
        if orders is None:
            err = mt5.last_error()
            print(f"[MT5-ERROR] mt5.orders_get() returned None: {err}", file=sys.stderr)
            return _ok([])
        
        result = []
        for o in orders:
            result.append({
                "ticket": o.ticket,
                "symbol": o.symbol,
                "type": o.type, # 2=BuyLimit, 3=SellLimit, 4=BuyStop, 5=SellStop
                "volume_initial": o.volume_initial,
                "volume_current": o.volume_current,
                "price_open": o.price_open,
                "sl": o.sl,
                "tp": o.tp,
                "time_setup": o.time_setup
            })
        return _ok(result)

    if name == "mt5_order_cancel":
        ticket = arguments.get("ticket")
        if not ticket:
            return _err("ticket is required")
        
        request = {
            "action": mt5.TRADE_ACTION_REMOVE,
            "order": ticket,
        }
        
        result = mt5.order_send(request)
        if result is None:
            err = mt5.last_error()
            print(f"[MT5-ERROR] order_cancel order_send returned None: {err}", file=sys.stderr)
            return _err(f"order_send failed: {err}")
            
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return _err(f"Cancel failed: {result.retcode} - {result.comment}")
            
        return _ok({"ticket": ticket, "success": True})

    # ── Trading ───────────────────────────────────────────────────────
    if name == "mt5_order_send":
        symbol = arguments["symbol"]
        action = arguments["action"]
        volume = arguments["volume"]
        sl_raw = arguments.get("sl", 0.0)
        tp_raw = arguments.get("tp", 0.0)
        comment = (arguments.get("comment") or "AI-Trade")[:32]
        
        symbol_info = mt5.symbol_info(symbol)
        digits = symbol_info.digits if symbol_info else 5

        # Select symbol di MT5 — penting untuk beberapa broker
        if not mt5.symbol_select(symbol, True):
            print(f"[MT5-WARN] symbol_select({symbol}) returned False, proceeding anyway", file=sys.stderr)

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return _err(f"Symbol '{symbol}' not found")

        trade_action = mt5.TRADE_ACTION_DEAL
        if action == "BUY":
            order_type = mt5.ORDER_TYPE_BUY
            price = tick.ask
        elif action == "SELL":
            order_type = mt5.ORDER_TYPE_SELL
            price = tick.bid
        elif action == "BUY_LIMIT":
            trade_action = mt5.TRADE_ACTION_PENDING
            order_type = mt5.ORDER_TYPE_BUY_LIMIT
            price = arguments.get("price", tick.ask)
        elif action == "SELL_LIMIT":
            trade_action = mt5.TRADE_ACTION_PENDING
            order_type = mt5.ORDER_TYPE_SELL_LIMIT
            price = arguments.get("price", tick.bid)
        elif action == "BUY_STOP":
            trade_action = mt5.TRADE_ACTION_PENDING
            order_type = mt5.ORDER_TYPE_BUY_STOP
            price = arguments.get("price", tick.ask)
        elif action == "SELL_STOP":
            trade_action = mt5.TRADE_ACTION_PENDING
            order_type = mt5.ORDER_TYPE_SELL_STOP
            price = arguments.get("price", tick.bid)
        else:
            return _err(f"Invalid action '{action}'")
            
        sl = round(float(sl_raw), digits) if sl_raw != 0 else 0.0
        tp = round(float(tp_raw), digits) if tp_raw != 0 else 0.0
        price = round(float(price), digits)

        filling_mode = _get_filling_mode(symbol)

        request = {
            "action": trade_action,
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
        symbol_info = mt5.symbol_info(pos.symbol)
        digits = symbol_info.digits if symbol_info else 5
        
        sl_raw = arguments.get("sl", pos.sl or 0)
        tp_raw = arguments.get("tp", pos.tp or 0)
        
        sl = round(float(sl_raw), digits) if sl_raw != 0 else 0.0
        tp = round(float(tp_raw), digits) if tp_raw != 0 else 0.0
        
        if sl == 0:
            sl = round(float(pos.sl or 0), digits)
        if tp == 0:
            tp = round(float(pos.tp or 0), digits)

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
                "position_id": getattr(d, "position_id", 0) or 0,
                "entry": getattr(d, "entry", 0) or 0,
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

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    import asyncio
    return await asyncio.to_thread(sync_call_tool, name, arguments)


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------
import os
import argparse
import uvicorn
from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from mcp.server.sse import SseServerTransport

async def run_stdio():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

def run_sse(port: int, use_ngrok: bool):
    sse = SseServerTransport("/messages")
    api = FastAPI(title="MT5 MCP Server")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
    api.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

    # Bypassing FastAPI's route wrapping for SSE and Messages to prevent 
    # 'Unexpected ASGI message' and connection drops.
    original_app = api
    async def asgi_wrapper(scope, receive, send):
        if scope["type"] == "http":
            if scope["method"] == "GET" and scope["path"] == "/sse":
                async with sse.connect_sse(scope, receive, send) as streams:
                    await app.run(streams[0], streams[1], app.create_initialization_options())
                return
            elif scope["method"] == "POST" and scope["path"] == "/messages":
                await sse.handle_post_message(scope, receive, send)
                return
        await original_app(scope, receive, send)

    # Use the wrapper as the main ASGI app
    runnable_app = asgi_wrapper

    @api.get("/health")
    async def health():
        return {"status": "ok", "connected": mt5_connected}

    if use_ngrok:
        try:
            from pyngrok import ngrok
            
            # UX: Prompt for Ngrok token if not set
            base_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__))
            token_file = os.path.join(base_dir, ".ngrok_token")
            
            if not os.environ.get("NGROK_AUTHTOKEN"):
                if os.path.exists(token_file):
                    with open(token_file, "r") as f:
                        token = f.read().strip()
                        if token:
                            os.environ["NGROK_AUTHTOKEN"] = token
                else:
                    print("\n" + "="*55)
                    print("="*12 + " NGROK AUTHTOKEN DIBUTUHKAN " + "="*15)
                    print("="*55)
                    print("Anda belum mengatur Ngrok Authtoken.")
                    print("1. Daftar/Login ke https://dashboard.ngrok.com")
                    print("2. Ke menu 'Your Authtoken' (atau https://dashboard.ngrok.com/get-started/your-authtoken)")
                    print("3. Copy token Anda dan Paste di bawah ini.")
                    print("="*55)
                    
                    token = input("Masukkan Ngrok Authtoken Anda: ").strip()
                    if token:
                        try:
                            with open(token_file, "w") as f:
                                f.write(token)
                            os.environ["NGROK_AUTHTOKEN"] = token
                            print("\n[+] Token berhasil disimpan!")
                        except Exception as write_err:
                            print(f"\n[-] Gagal menyimpan token ke file: {write_err}")
                            os.environ["NGROK_AUTHTOKEN"] = token
                    else:
                        print("\n[!] Token kosong. Mencoba tanpa token (kemungkinan error ERR_NGROK_4018).")

            print("\nMemulai Ngrok Tunnel...")

            from pyngrok import ngrok, conf
            import threading
            import time

            ngrok_restart_lock = threading.Lock()
            ngrok_fail_count = 0

            def restart_ngrok():
                global ngrok_fail_count
                if not ngrok_restart_lock.acquire(blocking=False):
                    return
                try:
                    print("\n[!] Mendeteksi Ngrok macet karena koneksi terputus. Memulai ulang Ngrok...")
                    ngrok_fail_count = 0
                    try:
                        ngrok.kill()
                    except:
                        pass
                    
                    time.sleep(2)
                    
                    print("[+] Menyambungkan kembali Ngrok...")
                    public_url = ngrok.connect(port).public_url
                    print(f"\n" + "="*50)
                    print(f"Koneksi Ngrok Berhasil Dipulihkan!")
                    print(f"URL Koneksi Anda: {public_url}/sse")
                    print(f"="*50 + "\n")
                except Exception as e:
                    print(f"[-] Gagal memulihkan Ngrok: {e}")
                finally:
                    ngrok_restart_lock.release()

            def ngrok_log_callback(log):
                global ngrok_fail_count
                msg = log.msg.lower() if log.msg else ""
                if "failed to reconnect session" in msg or "no such host" in msg or "timeout" in msg:
                    ngrok_fail_count += 1
                    if ngrok_fail_count >= 3:
                        threading.Thread(target=restart_ngrok, daemon=True).start()
                elif "session established" in msg or "client session established" in msg:
                    ngrok_fail_count = 0

            conf.get_default().log_event_callback = ngrok_log_callback

            public_url = ngrok.connect(port).public_url
            print(f"\n" + "="*50)
            print(f"Koneksi Berhasil!")
            print(f"URL Koneksi Anda: {public_url}/sse")
            print(f"="*50 + "\n")
        except Exception as e:
            print(f"Failed to start ngrok: {e}")

    # ===== WEBSOCKET STREAMER THREAD =====
    def ws_streamer_thread():
        # URL WebSocket Railway (pastikan sesuai dengan environment production)
        WS_URL = "wss://journal-trade-production.up.railway.app/ws/mt5-stream"
        
        async def streamer():
            while True:
                try:
                    async with websockets.connect(WS_URL) as ws:
                        print(f"\n[WS-STREAM] 🟢 Berhasil terhubung ke Railway Streamer: {WS_URL}")
                        while True:
                            if not mt5_connected:
                                await asyncio.sleep(1)
                                continue
                            
                            # 1. Tarik posisi terbuka
                            positions = mt5.positions_get()
                            pos_data = []
                            if positions:
                                for p in positions:
                                    pos_data.append({
                                        "ticket": p.ticket,
                                        "orderId": p.ticket,
                                        "symbol": p.symbol,
                                        "profit": p.profit,
                                        "volume": p.volume,
                                        "priceOpen": p.price_open,
                                        "priceCurrent": p.price_current,
                                        "type": "BUY" if p.type == 0 else "SELL",
                                        "sl": p.sl,
                                        "tp": p.tp,
                                        "time": p.time,
                                        "timeUpdate": p.time_update,
                                        "comment": p.comment,
                                        "externalId": p.external_id
                                    })
                            
                            # 2. Tarik info akun
                            acc = mt5.account_info()
                            acc_data = None
                            if acc:
                                acc_data = {
                                    "login": str(acc.login),
                                    "balance": acc.balance,
                                    "equity": acc.equity,
                                    "margin": acc.margin,
                                    "freeMargin": acc.margin_free,
                                    "marginLevel": acc.margin_level,
                                    "currency": acc.currency
                                }
                                
                            payload = {
                                "type": "mt5_tick",
                                "data": {
                                    "positions": pos_data,
                                    "accountInfo": acc_data
                                }
                            }
                            
                            await ws.send(json.dumps(payload))
                            await asyncio.sleep(1) # Refresh setiap 1 detik!
                            
                except Exception as e:
                    print(f"\n[WS-STREAM] 🔴 Koneksi terputus ({e}). Mencoba lagi dalam 3 detik...")
                    await asyncio.sleep(3)
                    
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(streamer())

    threading.Thread(target=ws_streamer_thread, daemon=True).start()
    # =====================================

    uvicorn.run(runnable_app, host="0.0.0.0", port=port, log_level="info")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MT5 MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="sse", help="Transport mode")
    parser.add_argument("--port", type=int, default=8000, help="Port for SSE mode")
    parser.add_argument("--no-ngrok", action="store_true", help="Disable Ngrok tunnel")
    args = parser.parse_args()

    if args.transport == "sse":
        run_sse(args.port, not args.no_ngrok)
    else:
        asyncio.run(run_stdio())
