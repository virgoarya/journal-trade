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

  console.log("=== get_trading_open_positions with include_orders=true ===");
  const res = await client.callTool({ name: "get_trading_open_positions", arguments: { include_orders: true } });
  const txt = res.content?.find((c) => c.type === "text")?.text;
  const obj = JSON.parse(txt);
  console.log("keys:", Object.keys(obj));
  const positions = obj.positions ?? [];
  const orders = obj.orders ?? [];
  console.log("positions count:", positions.length);
  console.log("orders count:", orders.length);
  if (orders.length > 0) {
    console.log("sample order:", JSON.stringify(orders[0], null, 2));
  }

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));