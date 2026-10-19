/**
 * Regression test: the agentConsensus feature flag must be REACHABLE.
 *
 * Why this test exists: agentConsensus.enabled defaults to false, and the
 * settings API schema did not accept the field at all — so nothing could ever
 * turn Agent Consensus on. The whole backend path (and Nova's AgentBreakdown
 * UI) was dead in production while every unit test stayed green.
 *
 * These tests import the REAL schema from the route module (not a copy), so a
 * future refactor that drops the field fails here.
 */
import { describe, it, expect } from "vitest";
import { aiTradingSettingsSchema } from "../routes/settings.routes";

describe("settings schema: agentConsensus is settable", () => {
  it("accepts a full agentConsensus payload", () => {
    const parsed = aiTradingSettingsSchema.safeParse({
      agentConsensus: {
        enabled: true,
        debateMode: "parallel",
        memoryEnabled: true,
        toolEnabled: true,
        threshold: 0.65,
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.agentConsensus?.enabled).toBe(true);
      expect(parsed.data.agentConsensus?.threshold).toBe(0.65);
    }
  });

  it("accepts the minimal payload needed to enable the flag", () => {
    const parsed = aiTradingSettingsSchema.safeParse({
      agentConsensus: { enabled: true },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.agentConsensus?.enabled).toBe(true);
    }
  });

  it("accepts disabling the flag (rollback path)", () => {
    const parsed = aiTradingSettingsSchema.safeParse({
      agentConsensus: { enabled: false },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.agentConsensus?.enabled).toBe(false);
    }
  });

  it("rejects an out-of-range threshold", () => {
    expect(
      aiTradingSettingsSchema.safeParse({ agentConsensus: { threshold: 1.5 } }).success
    ).toBe(false);
    expect(
      aiTradingSettingsSchema.safeParse({ agentConsensus: { threshold: 0.05 } }).success
    ).toBe(false);
  });

  it("rejects an unknown debateMode", () => {
    expect(
      aiTradingSettingsSchema.safeParse({ agentConsensus: { debateMode: "turbo" } }).success
    ).toBe(false);
  });

  it("still accepts llmConsensus (no regression on the existing path)", () => {
    const parsed = aiTradingSettingsSchema.safeParse({
      llmConsensus: { enabled: true, threshold: 0.7 },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmConsensus?.enabled).toBe(true);
    }
  });

  it("accepts both flags together (migration window)", () => {
    const parsed = aiTradingSettingsSchema.safeParse({
      llmConsensus: { enabled: true },
      agentConsensus: { enabled: true },
    });

    expect(parsed.success).toBe(true);
  });
});
