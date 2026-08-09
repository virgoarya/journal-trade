// Hunter Trades — AI Trading Pipeline Integration Test
// Usage: node scripts/integration-test.mjs [baseUrl]
// Requires: backend running on :5000 with dev bypass header (x-integration-test: 1)
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const BASE = process.argv[2] || "http://127.0.0.1:5000";

let passed = 0, failed = 0;
const results = [];

function check(name, cond, detail = "") {
  if (cond) { passed++; results.push(`  OK ${name}`); }
  else { failed++; results.push(`  FAIL ${name} ${detail}`); }
}

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const fn = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = fn(url, {
      method,
      headers: body
        ? { "x-integration-test": "1", "content-type": "application/json" }
        : { "x-integration-test": "1" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log(`\n=== INTEGRATION TEST - ${BASE} ===\n`);

  const st = await api("GET", "/api/v1/ai-trading/status");
  check("GET /status -> 200", st.status === 200, `(${st.status})`);
  check("status.connected", st.data?.data?.connected === true);
  check("accountInfo.balance > 0", st.data?.data?.accountInfo?.balance > 0);

  const ac = await api("GET", "/api/v1/ai-trading/account");
  check("GET /account", ac.data?.data?.balance > 0 && ac.data?.data?.equity > 0);

  const sym = await api("GET", "/api/v1/ai-trading/symbols");
  const syms = sym.data?.data?.symbols ?? [];
  check("GET /symbols count>=5", syms.length >= 5, `count=${syms.length}`);
  check("XAUUSD contractSize==100", syms.find((s) => s.name === "XAUUSD")?.tradeContractSize === 100);
  check("BTCUSD contractSize==1", syms.find((s) => s.name === "BTCUSD")?.tradeContractSize === 1);

  const pos = await api("GET", "/api/v1/ai-trading/positions");
  const d = pos.data?.data;
  check("GET /positions", pos.status === 200);
  check("positions is array", Array.isArray(d?.positions));
  check("orders is array", Array.isArray(d?.orders));
  if (d?.positions?.length) {
    const p0 = d.positions[0];
    check("position fields", p0.ticket > 0 && p0.symbol && typeof p0.profit === "number");
    check("position source", p0.source === "AI" || p0.source === "MANUAL", `source=${p0.source}`);
  }

  const cfg = { symbols: ["BTCUSD"], timeframe: "M5", llmConsensus: { enabled: false }, trailingStop: { enabled: false }, maxOpenPositions: 1 };
  const ps = await api("POST", "/api/v1/ai-trading/pipeline/start", cfg);
  check("pipeline start", ps.data?.data?.running === true);
  await api("POST", "/api/v1/ai-trading/pipeline/pause", {});
  const st2 = await api("GET", "/api/v1/ai-trading/pipeline/status");
  check("pipeline pause", st2.data?.data?.paused === true);
  await api("POST", "/api/v1/ai-trading/pipeline/resume", {});
  const st3 = await api("GET", "/api/v1/ai-trading/pipeline/status");
  check("pipeline resume", st3.data?.data?.running === true);
  await api("POST", "/api/v1/ai-trading/pipeline/stop", {});
  const st4 = await api("GET", "/api/v1/ai-trading/pipeline/status");
  check("pipeline stop", st4.data?.data?.running === false);

  const an = await api("POST", "/api/v1/ai-trading/analyze-multi", { symbol: "BTCUSD", timeframe: "M15", methodologies: ["smc", "ict", "msnr"] });
  check("analyze-multi", !!an.data?.data?.marketStructure);

  const llm = await api("GET", "/api/v1/ai-trading/llm-status");
  check("llm-status array", Array.isArray(llm.data?.data));

  const perf = await api("GET", "/api/v1/ai-trading/performance");
  check("performance", perf.status === 200);

  const skill = await api("GET", "/api/v1/ai-trading/skill");
  check("skill", typeof skill.data?.data?.totalBacktests === "number");

  console.log("\n" + results.join("\n"));
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });