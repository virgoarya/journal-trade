# Fix MT5 Profit Calculation Discrepancy

## Problem
Open positions in the frontend show incorrect profit values (e.g., 0.01 lot position yielding tens of thousands of dollars), which do not match MT5 desktop. This occurred after switching to native MT5 MCP. The issue likely stems from incorrect data normalization or scaling of profit and volume values in the data flow from MT5 Python MCP to the Node.js backend.

## Affected Components
- `server/mcp-mt5-server/server.py`: Python MT5 MCP server, responsible for fetching raw MT5 data and transforming it into JSON.
- `server/src/mt5-streamer.ts`: Node.js module, responsible for connecting to MT5 MCP, receiving data, and normalizing it before caching and broadcasting.
- `server/src/services/mt5-mcp.service.ts`: Node.js service, uses `mt5-streamer.ts` to expose MT5 data to the rest of the backend.

## Plan

### Phase 1: Diagnostics and Data Inspection

1.  **Add Debug Logging to Python MCP (`server/mcp-mt5-server/server.py`)**
    *   Modify the `_pos_dict` and `_account_dict` functions.
    *   Before returning the dictionary, add print statements to `sys.stderr` showing:
        *   The raw `mt5.positions_get()` object (`p`) for each position.
        *   The raw `mt5.account_info()` object (`a`).
        *   The dictionary (`dict`) being returned by `_pos_dict` or `_account_dict`.
    *   This will help confirm the values as they are extracted from the MT5 API and prepared for transmission to Node.js.

2.  **Add Debug Logging to Node.js Streamer (`server/src/mt5-streamer.ts`)**
    *   Modify the `normalizePosition` and `normalizeAccountInfo` functions.
    *   Add `silentLogger.debug` statements to log:
        *   The raw `p` (for position) or `raw` (for account info) object received from the Python MCP.
        *   The `normalized` object after the normalization function has processed it.
    *   This will show how the data is received and transformed on the Node.js side.

3.  **Execute Backtest and Collect Logs**
    *   Run an AI strategy backtest that generates open positions and trade history.
    *   Collect all debug output from both Python `stderr` and Node.js `silentLogger`.

### Phase 2: Analysis and Correction

1.  **Analyze Logs**
    *   Compare the `profit`, `volume`, `priceOpen`, `priceCurrent`, `sl`, `tp`, `swap`, `commission` values at each logging stage.
    *   Identify the exact point in the data flow (Python `_pos_dict` or Node.js `normalizePosition`) where the incorrect scaling or conversion of profit occurs.
    *   Pay close attention to data types (float vs. int) and any implicit conversions.

2.  **Implement Correction**
    *   Based on the analysis, apply the necessary fix:
        *   If the issue is in `server.py`, adjust how `profit` (and potentially other fields) is extracted or formatted in `_pos_dict`. Ensure it matches the expected decimal precision and scale.
        *   If the issue is in `mt5-streamer.ts`, adjust the `Number(p.profit ?? 0)` or similar lines in `normalizePosition` to correctly interpret or scale the incoming `profit` value. It might be necessary to divide by a currency-specific multiplier, or correct a misplaced decimal point.

### Phase 3: Verification

1.  **Run Backtest Again**
    *   Execute the same backtest used in Phase 1 with the implemented fix.
2.  **Verify Frontend Display**
    *   Check the "Open Positions" panel and "Trade History" to ensure profit values are now correctly displayed and match expected MT5 behavior for 0.01 lot sizes.
3.  **Remove Debug Logging**
    *   Once confirmed, remove all added debug logging to avoid unnecessary output in production.

## Assumptions
- The core MT5 Python API calls (`mt5.positions_get()`, `mt5.account_info()`) return correct raw data.
- The discrepancy is purely a transformation/scaling error between Python and Node.js.

## Risks
- Incorrect adjustment could lead to further miscalculations or introduce new bugs. Detailed logging and step-by-step verification are crucial.
- The issue might be more complex than a simple scaling error (e.g., misinterpretation of different MT5 profit fields).

## Validation Plan
- Visual inspection of the "Open Positions" panel and "Trade History" in the frontend.
- Cross-referencing profit/volume values with actual MT5 desktop terminal during a live backtest.
- Ensuring other fields (`priceOpen`, `sl`, `tp`) are also correctly reflected.
