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

  console.log("=== get_trading_history_deals (7 hari) ===");
  const from = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const res = await client.callTool({ name: "get_trading_history_deals", arguments: { from, to: Math.floor(Date.now() / 1000) } });
  const txt = res.content?.find((c) => c.type === "text")?.text;
  const obj = JSON.parse(txt);
  const arr = Array.isArray(obj) ? obj : (obj.deals ?? []);
  console.log("count:", arr.length);
  console.log("keys:", arr[0] ? Object.keys(arr[0]) : "EMPTY");
  if (arr.length > 0) {
    const out = arr.find((d) => d.entry === 1) ?? arr[0];
    console.log("sample OUT deal:", JSON.stringify(out, null, 2).slice(0, 1200));
  }

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));
