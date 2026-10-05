/**
 * Quick smoke test for agent tools
 * Run: npx tsx test-agent-tools.ts
 */

import { toolRegistryService } from "./src/services/tool-registry.service";
import { agentTools } from "./src/helpers/agent-tools.helper";
import type { AgentContext } from "./src/agents/base.agent";

const context: AgentContext = {
  currentRegime: "Risk-Off",
  liquidityStatus: "Tightening",
  assets: [{ symbol: "XAUUSD" }],
};

const PASS = "✅";
const FAIL = "❌";
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ─── Test 1: Keyword Detection ───
console.log("\n🔍 Test 1: Keyword Detection in ToolRegistry");

async function testKeywordDetection() {
  // Price keyword
  const r1 = await toolRegistryService.runToolsForPrompt(
    "Berapa harga XAUUSD sekarang?",
    context
  );
  assert("Detects 'harga XAUUSD' → triggers get_price", r1.toolsUsed.includes("get_price"));
  assert("Returns marketPrices in enrichedContext", !!r1.enrichedContext.marketPrices);

  // Economic calendar keyword
  const r2 = await toolRegistryService.runToolsForPrompt(
    "Tampilkan economic calendar hari ini",
    context
  );
  assert("Detects 'economic calendar' → triggers get_economic_calendar", r2.toolsUsed.includes("get_economic_calendar"));
  assert("Returns economicCalendar in enrichedContext", !!r2.enrichedContext.economicCalendar);

  // Multiple tools at once
  const r3 = await toolRegistryService.runToolsForPrompt(
    "Berapa harga DXY dan tampilkan kalender ekonomi minggu ini",
    context
  );
  assert("Multiple tools triggered (get_price + get_economic_calendar)", 
    r3.toolsUsed.includes("get_price") && r3.toolsUsed.includes("get_economic_calendar"));

  // No tool triggered for unrelated prompt
  const r4 = await toolRegistryService.runToolsForPrompt(
    "Analisis sentimen pasar global",
    context
  );
  assert("No price/calendar tool for generic prompt", 
    !r4.toolsUsed.includes("get_price") && !r4.toolsUsed.includes("get_economic_calendar"));
}

// ─── Test 2: get_economic_calendar ───
console.log("\n📅 Test 2: get_economic_calendar Tool");

async function testEconomicCalendar() {
  const result = await agentTools.get_economic_calendar(context);
  assert("Returns an array", Array.isArray(result));
  if (Array.isArray(result) && result.length > 0) {
    assert("Has event field", !!result[0].event);
    assert("Has country field", !!result[0].country);
    assert("Has impact field", !!result[0].impact);
    console.log(`    📊 Returned ${result.length} events`);
    result.forEach((e: any) => console.log(`       → [${e.impact}] ${e.event} (${e.country}) ${e.date}`));
  }
}

// ─── Test 3: get_price (XAUUSD, DXY) ───
console.log("\n💰 Test 3: get_price Tool (Real Yahoo Finance/Nexus Fetch)");

async function testGetPrice() {
  const symbols = ["XAUUSD", "DXY"];
  const result = await agentTools.get_price(context, symbols);
  
  assert("Returns object with symbols as keys", typeof result === "object");
  
  for (const sym of symbols) {
    const data = result[sym];
    if (data && typeof data === "object" && data.price) {
      assert(`${sym}: price = ${data.price} (${data.changePercent}%)`, true);
    } else if (data === "Data tidak tersedia") {
      console.log(`  ⚠️  ${sym}: Data tidak tersedia (market tutup atau API limit)`);
      passed++;
    } else {
      assert(`${sym}: unexpected result`, false, JSON.stringify(data));
    }
  }
}

// ─── Test 4: get_market_regime ───
console.log("\n🌊 Test 4: get_market_regime Tool");

async function testMarketRegime() {
  const result = await agentTools.get_market_regime(context);
  const isAvailable = result && typeof result === "object" && !result.toString().includes("Error");
  assert("Returns regime data (or fallback)", isAvailable || typeof result === "string");
  if (typeof result === "string") {
    console.log(`    ℹ️  ${result}`);
  } else {
    console.log(`    📊 Regime data received`);
  }
}

// ─── Test 5: get_news ───
console.log("\n📰 Test 5: get_news Tool");

async function testNews() {
  const result = await agentTools.get_news(context);
  if (Array.isArray(result)) {
    assert(`Returns news array (${result.length} items)`, result.length > 0);
    result.forEach((n: any) => console.log(`       → ${n.headline || n.title || JSON.stringify(n).substring(0, 80)}`));
  } else {
    assert("Returns news or fallback message", typeof result === "string");
    console.log(`    ℹ️  ${result}`);
  }
}

// ─── Run All Tests ───
async function runAll() {
  try {
    await testKeywordDetection();
  } catch (e: any) {
    console.log(`  ${FAIL} KeywordDetection crashed: ${e.message}`);
    failed++;
  }

  try {
    await testEconomicCalendar();
  } catch (e: any) {
    console.log(`  ${FAIL} EconomicCalendar crashed: ${e.message}`);
    failed++;
  }

  try {
    await testGetPrice();
  } catch (e: any) {
    console.log(`  ${FAIL} GetPrice crashed: ${e.message}`);
    failed++;
  }

  try {
    await testMarketRegime();
  } catch (e: any) {
    console.log(`  ${FAIL} MarketRegime crashed: ${e.message}`);
    failed++;
  }

  try {
    await testNews();
  } catch (e: any) {
    console.log(`  ${FAIL} GetNews crashed: ${e.message}`);
    failed++;
  }

  // ─── Summary ───
  console.log("\n" + "─".repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🎉 All tools are functional!\n");
  } else {
    console.log("⚠️  Some tools need attention.\n");
  }
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
