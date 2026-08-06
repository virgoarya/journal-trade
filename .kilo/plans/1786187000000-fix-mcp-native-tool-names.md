# Fix Remaining MCP Tool Names in AI Trading Services

## Problem
While `mt5-streamer.ts` has been updated to use native MT5 MCP tool names, the `MT5MCPService` class in `mt5-mcp.service.ts` and `trading-pipeline.service.ts` still uses the old MCP tool names (Python bridge style). This creates inconsistency and potential issues if the Python bridge is not available.

## Affected Components
1. `server/src/services/mt5-mcp.service.ts` - Uses old MCP tool names throughout
2. `server/src/services/trading-pipeline.service.ts` - One remaining usage of `mt5_symbol_tick`

## Native MCP Tool Mapping (from probe results)

### Account & Connection Tools
- `get_trading_account_info` (instead of `mt5_account_info`)
- `get_trading_open_positions` (instead of `mt5_positions_get`)

### Symbol & Market Data Tools
- `get_marketwatch_symbols` (instead of `mt5_symbols_get` and `mt5_symbol_info`)
- `trade_send_market_order` (instead of `mt5_order_send` for market orders)
- `trade_send_pending_order` (instead of `mt5_order_send` for pending orders)

### Position Management Tools
- `trade_close_single_position` (instead of `mt5_position_close`)
- `trade_modify_sl_tp` (instead of `mt5_position_modify`)

### Historical Data Tools
- `get_trading_history_deals` (instead of `mt5_history_deals_get`)
- `get_trading_history_orders` (instead of `mt5_history_orders_get` - verify if exists)
- `get_chart_history` (instead of `mt5_copy_rates` and `mt5_copy_rates_range`)

### Debug & Utility Tools
- `get_workspace_info` (for debug info)
- `get_time_information` (for timing)
- `find_files_by_glob` / `find_files_by_name_keyword` (for file operations)

## Plan

### Phase 1: Update mt5-mcp.service.ts

#### Update Account Info Methods
1. Replace `callWithCircuit("mt5_account_info", {})` with `callWithCircuit("get_trading_account_info", {})`
2. Map response fields: Native MCP returns `{ account: { ... } }` structure

#### Update Positions Methods
1. Replace `callWithCircuit("mt5_positions_get", {})` with `callWithCircuit("get_trading_open_positions", {})`
2. Map response: Native MCP returns positions array directly (not wrapped in `.positions`)

#### Update Symbol Methods
1. Replace `callWithCircuit("mt5_symbols_get", { group })` with `callWithCircuit("get_marketwatch_symbols", {})` (no group parameter needed)
2. Replace `callWithCircuit("mt5_symbol_info", { symbol })` with `callWithCircuit("get_marketwatch_symbols", {})` then filter by symbol.name or symbol.symbol
3. Replace `callWithCircuit("mt5_symbol_tick", { symbol })` with `callWithCircuit("get_marketwatch_symbols", {})` then filter and extract bid/ask

#### Update Order Methods
1. Replace `callWithCircuit("mt5_order_send", params)` with:
   - For market orders (BUY/SELL): `callWithCircuit("trade_send_market_order", mappedParams)`
   - For pending orders (*_LIMIT/_STOP): `callWithCircuit("trade_send_pending_order", mappedParams)`
2. Map parameters according to native MCP schemas:
   - `action` → `type` (lowercase: "buy"/"sell" for market, "buy_limit"/etc for pending)
   - Add required `price` for pending orders
   - Handle `expiration_type` and `expiration_time` for pending orders
   - Map `sl` → `stop_loss`, `tp` → `take_profit`
   - Comment remains as `comment` (max 31 chars)

#### Update Position Management Methods
1. Replace `callWithCircuit("mt5_position_close", { ticket })` with `callWithCircuit("trade_close_single_position", { position_ticket: ticket, symbol: symbol })`
2. Replace `callWithCircuit("mt5_position_modify", { ticket, sl, tp })` with `callWithCircuit("trade_modify_sl_tp", { position_ticket: ticket, symbol: symbol, sl, tp })`

#### Update Historical Data Methods
1. Replace `callWithCircuit("mt5_history_deals_get", args)` with `callWithCircuit("get_trading_history_deals", mappedArgs)`
2. Replace `callWithCircuit("mt5_copy_rates", { symbol, timeframe, count })` with `callWithCircuit("get_chart_history", { symbol, timeframe, limit: count })`
3. Replace `callWithCircuit("mt5_copy_rates_range", { symbol, timeframe, from, to })` with `callWithCircuit("get_chart_history", { symbol, timeframe, from, to })` (verify parameters)
4. Replace `callWithCircuit("mt5_debug_info", {})` with appropriate native debug tools
5. Replace `callWithCircuit("mt5_debug_order", params)` with appropriate validation (may not need native equivalent)

#### Update Response Handling
All methods need to update their response parsing to match native MCP response formats:
- Check if response has `.content[0].text` that needs JSON parsing
- Map field names appropriately (e.g., `position_id` → `ticket`, `price_last` → `priceCurrent`, etc.)
- Handle nested structures (account info under `.account`, etc.)

### Phase 2: Update trading-pipeline.service.ts

#### Fix mt5_symbol_tick Usage
1. Replace `mt5McpService.call("mt5_symbol_tick", { symbol: signal.symbol })` with:
   - Call `get_marketwatch_symbols` 
   - Filter for the symbol
   - Extract bid/ask from response

### Phase 3: Testing and Validation

#### Create Test Scripts
1. Create test scripts to verify each MCP tool call works correctly
2. Test order placement, position querying, account info retrieval
3. Verify error handling and edge cases

#### Run Backtest and Live Trading Tests
1. Execute a small backtest to verify signal generation and order placement works
2. Test live connection with small volumes to verify all functionality
3. Monitor logs for any MCP errors or fallback behaviors

## Risks and Mitigations

### Risk: Breaking Changes During Transition
- Mitigation: Implement feature flag or dual-support during transition period
- Mitigation: Keep backup of original service for quick rollback

### Risk: Incorrect Parameter Mapping
- Mitigation: Create detailed mapping documentation for each tool
- Mitigation: Test each tool individually with known good parameters

### Risk: Response Format Changes
- Mitigation: Log raw responses during development to understand structure
- Mitigation: Use try/catch with fallback parsing strategies

## Validation Plan

### Unit Tests
- Create mock tests for each MCP service method
- Verify correct tool names are called
- Verify parameter mapping is correct
- Verify response parsing returns expected MT5* types

### Integration Tests
- Test against actual MT5 terminal via native MCP
- Verify account info retrieval works
- Verify position querying returns correct data
- Test order placement and cancellation
- Test historical data retrieval

### Performance Tests
- Verify no significant latency increase from tool mapping
- Verify connection stability over extended periods
- Verify error recovery works correctly

## Files to Modify
1. `server/src/services/mt5-mcp.service.ts` - Primary service class
2. `server/src/services/trading-pipeline.service.ts` - One usage fix
3. Create/update test scripts in `server/scripts/` for validation

## Estimated Effort
- 4-6 hours for implementation and mapping
- 2-3 hours for testing and validation
- 1 hour for documentation and cleanup