/**
 * Test: Verify DASHSCOPE and FlowLLM MCP are fully removed (Opsi B)
 * 
 * Approved by Bang Vir — removes dead code path where:
 * - DASHSCOPE_API_KEY existed in env but was never called at runtime
 * - FlowLLM MCP binary (finance-mcp.exe) never existed, so server silently skipped
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Opsi B: DASHSCOPE + FlowLLM MCP removal verification", () => {
  it("env.ts should NOT contain DASHSCOPE_API_KEY", () => {
    const envSource = readFileSync(join(__dirname, "../config/env.ts"), "utf-8");
    expect(envSource).not.toContain("DASHSCOPE_API_KEY");
    expect(envSource).not.toContain("dashscope");
    expect(envSource).not.toContain("DASHSCOPE_BASE_URL");
    expect(envSource).not.toContain("DASHSCOPE_MODEL");
  });

  it("index.ts should NOT contain FlowLLM MCP registration", () => {
    const indexSource = readFileSync(join(__dirname, "../index.ts"), "utf-8");
    expect(indexSource).not.toContain("FlowLLM-Finance");
    expect(indexSource).not.toContain("finance-mcp");
    expect(indexSource).not.toContain("FLOW_LLM_API_KEY");
  });

  it("index.ts should NOT reference DASHSCOPE_API_KEY", () => {
    const indexSource = readFileSync(join(__dirname, "../index.ts"), "utf-8");
    expect(indexSource).not.toContain("DASHSCOPE_API_KEY");
  });

  it("llm-models.config.ts should NOT contain deepseek/qwen entry", () => {
    const modelsSource = readFileSync(join(__dirname, "../config/llm-models.config.ts"), "utf-8");
    expect(modelsSource).not.toContain("deepseek");
    expect(modelsSource).not.toContain("qwen");
    expect(modelsSource).not.toContain("Qwen");
  });

  it("NINE_ROUTER_MODELS should have exactly 5 models (deepseek removed)", async () => {
    const { NINE_ROUTER_MODELS } = await import("../config/llm-models.config");
    expect(NINE_ROUTER_MODELS).toHaveLength(5);
    const names = NINE_ROUTER_MODELS.map((m: any) => m.name);
    expect(names).not.toContain("deepseek");
  });
});
