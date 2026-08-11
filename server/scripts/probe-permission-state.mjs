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

  console.log("=== get_workspace_info ===");
  const ws = await client.callTool({ name: "get_workspace_info", arguments: {} });
  console.log(JSON.stringify(ws.content, null, 2));

  console.log("\n=== get_trading_account_info ===");
  const acct = await client.callTool({ name: "get_trading_account_info", arguments: {} });
  console.log(JSON.stringify(acct.content, null, 2));

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));