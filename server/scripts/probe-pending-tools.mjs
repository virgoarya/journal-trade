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

  console.log("=== get_trading_history_orders ===");
  const res = await client.callTool({ name: "get_trading_history_orders", arguments: {} });
  const txt = res.content?.find((c) => c.type === "text")?.text;
  const obj = JSON.parse(txt);
  const arr = Array.isArray(obj) ? obj : (obj.orders ?? []);
  console.log("count:", arr.length);
  console.log("sample:", JSON.stringify(arr[0] ?? arr, null, 2).slice(0, 1500));

  console.log("\n=== get_trading_open_positions ===");
  const posRes = await client.callTool({ name: "get_trading_open_positions", arguments: {} });
  const posTxt = posRes.content?.find((c) => c.type === "text")?.text;
  const posObj = JSON.parse(posTxt);
  const posArr = Array.isArray(posObj) ? posObj : (posObj.positions ?? []);
  console.log("count:", posArr.length);
  if (posArr.length > 0) {
    console.log("sample:", JSON.stringify(posArr[0], null, 2).slice(0, 1500));
  }

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));
