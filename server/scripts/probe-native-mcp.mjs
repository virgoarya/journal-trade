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
  console.log("=== TOOLS ===");
  const tools = await client.listTools();
  console.log(tools.tools.map((t) => t.name).join("\n"));

  console.log("\n=== get_marketwatch_symbols (XAUUSD sample) ===");
  const symRes = await client.callTool({ name: "get_marketwatch_symbols", arguments: {} });
  const symText = symRes.content?.find((c) => c.type === "text")?.text;
  const symJson = JSON.parse(symText);
  const arr = Array.isArray(symJson) ? symJson : symJson.symbols ?? [];
  const xau = arr.find((s) => String(s.symbol ?? s.name ?? "").toUpperCase() === "XAUUSD")
    || arr.find((s) => String(s.symbol ?? s.name ?? "").toUpperCase().includes("XAU"));
  console.log("XAU sample keys:", xau ? Object.keys(xau) : "NOT FOUND");
  console.log("XAU sample:", JSON.stringify(xau, null, 2));
  console.log("first symbol sample:", JSON.stringify(arr[0], null, 2));

  console.log("\n=== get_trading_open_positions (sample 1) ===");
  const posRes = await client.callTool({ name: "get_trading_open_positions", arguments: {} });
  const posText = posRes.content?.find((c) => c.type === "text")?.text;
  const posJson = JSON.parse(posText);
  const positions = Array.isArray(posJson) ? posJson : posJson.positions ?? [];
  console.log("positions count:", positions.length);
  console.log("first position keys:", positions[0] ? Object.keys(positions[0]) : "NONE");
  console.log("first position:", JSON.stringify(positions[0], null, 2).slice(0, 1500));

  await client.close();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
