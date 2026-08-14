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

  const tools = await client.listTools();
  console.log("=== ALL TOOLS ===");
  for (const t of tools.tools) {
    console.log(`- ${t.name}`);
    if (t.inputSchema?.properties) {
      console.log("  params:", Object.keys(t.inputSchema.properties).join(", "));
    }
  }

  console.log("\n=== try get_trading_history_orders with placed state ===");
  try {
    const res = await client.callTool({ name: "get_trading_history_orders", arguments: { state: "placed" } });
    const txt = res.content?.find((c) => c.type === "text")?.text;
    console.log("raw:", txt?.slice(0, 1000));
  } catch (e) {
    console.log("error:", e.message);
  }

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));