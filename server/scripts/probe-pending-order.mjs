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

  // Probe pending order response format (use tiny volume, invalid price to avoid real order)
  console.log("=== trade_send_pending_order (invalid price, expect rejection) ===");
  try {
    const res = await client.callTool({
      name: "trade_send_pending_order",
      arguments: {
        symbol: "BTCUSD",
        type: "buy_limit",
        volume: 0.01,
        price: 1.0,
        sl: 0,
        tp: 0,
        comment: "probe",
        expiration_type: "day",
        expiration_time: "2026-08-07T00:00:00",
      },
    });
    console.log("content:", JSON.stringify(res.content, null, 2));
  } catch (e) {
    console.log("callTool threw:", e.message);
  }

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));
