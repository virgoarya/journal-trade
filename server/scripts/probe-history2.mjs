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

  const from = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const to = Math.floor(Date.now() / 1000);

  console.log("=== get_trading_history_positions ===");
  const pRes = await client.callTool({ name: "get_trading_history_positions", arguments: { datetime_from: from, datetime_to: to, limit: 20 } });
  const pTxt = pRes.content?.find((c) => c.type === "text")?.text;
  const pObj = JSON.parse(pTxt);
  const pArr = Array.isArray(pObj) ? pObj : (pObj.positions ?? pObj.result ?? []);
  console.log("count:", pArr.length);
  console.log("keys:", pArr[0] ? Object.keys(pArr[0]) : "EMPTY");
  if (pArr.length > 0) console.log("sample:", JSON.stringify(pArr[0], null, 2).slice(0, 1200));

  console.log("\n=== get_trading_history_orders with include_deals ===");
  const oRes = await client.callTool({ name: "get_trading_history_orders", arguments: { datetime_from: from, datetime_to: to, include_deals: true, limit: 20 } });
  const oTxt = oRes.content?.find((c) => c.type === "text")?.text;
  const oObj = JSON.parse(oTxt);
  const oArr = Array.isArray(oObj) ? oObj : (oObj.orders ?? oObj.result ?? []);
  console.log("count:", oArr.length);
  console.log("keys:", oArr[0] ? Object.keys(oArr[0]) : "EMPTY");
  if (oArr.length > 0) console.log("sample:", JSON.stringify(oArr[0], null, 2).slice(0, 1200));

  await client.close();
}

main().catch((e) => console.error("ERR:", e.message));