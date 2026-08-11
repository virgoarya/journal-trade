import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL = "http://127.0.0.1:22346/mcp";
const API_KEY = "1oBaWtEsZuqVsfzLoHlALKBtNcTQuFHt5AHGrRS9Zw";

async function main() {
  const transport = new StreamableHTTPClientTransport(URL, {
    requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
  });
  const client = new Client({ name: "probe", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  console.log("=== 1. List active pending orders ===");
  const res = await client.callTool({ name: "get_trading_open_positions", arguments: { include_orders: true } });
  const txt = res.content?.find((c) => c.type === "text")?.text;
  const obj = JSON.parse(txt);
  console.log("orders:", JSON.stringify(obj.orders ?? [], null, 2));

  console.log("\n=== 2. trade_delete_order with FAKE ticket 999999 (no delete happens) ===");
  try {
    const del = await client.callTool({
      name: "trade_delete_order",
      arguments: { symbol: "BTCUSD", order_ticket: 999999 },
    });
    console.log("content:", JSON.stringify(del.content, null, 2));
    console.log("raw text:", del.content?.map((c) => c.text).join("\n"));
    console.log("structuredContent:", JSON.stringify(del.structuredContent ?? null, null, 2));
    console.log("isError:", del.isError);
  } catch (e) {
    console.log("callTool threw:", e.message);
  }

  console.log("\n=== 3. trade_send_market_order dry? just check error content ===");
  try {
    const mk = await client.callTool({
      name: "trade_send_market_order",
      arguments: { symbol: "BTCUSD", type: "buy", volume: 0.01, sl: 1, tp: 2, comment: "probe-dry" },
    });
    console.log("content:", JSON.stringify(mk.content, null, 2));
  } catch (e) {
    console.log("callTool threw:", e.message);
  }

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));