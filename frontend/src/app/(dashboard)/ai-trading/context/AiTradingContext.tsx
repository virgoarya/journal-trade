"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  type AIBacktestSkill,
  type PipelineConfig,
  type LlmModelNode,
  type LlmModelStatus,
  type PipelineStatus,
  type MultiStrategyAnalysis,
  type LLMConsensusResult,
  type PipelineLog,
  MethodologyName,
  MethodologyWeights,
} from "../types";
import { useMT5Connection } from "../hooks/useMT5Connection";
import { useAccountInfo } from "../hooks/useAccountInfo";
import { usePositions } from "../hooks/usePositions";
import { usePipeline } from "../hooks/usePipeline";
import { useLlmStatus } from "../hooks/useLlmStatus";
import { DEFAULT_METHODOLOGY_WEIGHTS } from "../types";
import { aiTradingService } from "@/services/ai-trading.service";

interface AiTradingContextType {
  // MT5 Connection
  isConnected: boolean;
  isConnecting: boolean;
  connectError: string | null;
  connectMT5: (payload: any) => Promise<boolean>;
  disconnectMT5: () => Promise<void>;

  // Account Info
  accountInfo: any | null;
  accountLoading: boolean;
  refetchAccountInfo: () => void;

  // Positions
  positions: any[];
  orders: any[];
  positionsLoading: boolean;
  positionsError: string | null;
  closePosition: (ticket: number) => Promise<void>;
  modifyPosition: (ticket: number, sl?: number, tp?: number) => Promise<void>;
  refetchPositions: () => Promise<void>;

  // Pipeline State
  pipelineStatus: PipelineStatus | null;
  pipelineLogs: PipelineLog[];
  isPipelineStarting: boolean;
  isPipelineStopping: boolean;
  lastAnalysis: MultiStrategyAnalysis | null;
  lastLlmVotes: LLMConsensusResult | null;
  startPipeline: (config: PipelineConfig) => Promise<boolean>;
  stopPipeline: () => Promise<void>;
  pausePipeline: () => Promise<void>;
  resumePipeline: () => Promise<void>;
  refreshPipelineData: () => Promise<void>;

  // LLM Status
  llmModels: LlmModelNode[];
  llmLoading: boolean;
  llmActiveCount: number;
  refreshLlmStatus: () => void;

  // AI Skill (from Backtest)
  skillConfig: AIBacktestSkill | null;
  setSkillConfig: (skill: AIBacktestSkill | null) => void;
  skillVersion: number;
  setSkillVersion: (version: number) => void;

  // Methodology Config (synced with backend)
  activeMethodologies: MethodologyName[];
  setActiveMethodologies: React.Dispatch<React.SetStateAction<MethodologyName[]>>;
  methodologyWeights: MethodologyWeights;
  setMethodologyWeights: React.Dispatch<React.SetStateAction<MethodologyWeights>>;
  showMethodologyConfig: boolean;
  setShowMethodologyConfig: React.Dispatch<React.SetStateAction<boolean>>;

  // LLM Consensus Config (synced with backend)
  llmEnabled: boolean;
  setLlmEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  llmThreshold: number;
  setLlmThreshold: React.Dispatch<React.SetStateAction<number>>;
  llmMinProviders: number;
  setLlmMinProviders: React.Dispatch<React.SetStateAction<number>>;
  llmProviderTimeoutMs: number;
  setLlmProviderTimeoutMs: React.Dispatch<React.SetStateAction<number>>;
  isSavingSettings: boolean;
}

const AiTradingContext = createContext<AiTradingContextType | undefined>(undefined);

export function AiTradingProvider({ children }: { children: React.ReactNode }) {
  // MT5 Connection
  const { isConnected, isConnecting, error: connectError, connect, disconnect } = useMT5Connection();

  // Account Info
  const { accountInfo, isLoading: accountLoading, refetch: refetchAccount } = useAccountInfo(1000);

  // Positions
  const { positions, orders, isLoading: positionsLoading, fetchError: positionsError, closePosition, modifyPosition, refetch: refetchPositions } =
    usePositions(1000);

  // LLM Status
  const { models: llmModels, loading: llmLoading, activeCount: llmActiveCount, refresh: refreshLlmStatus } = useLlmStatus();

  // Pipeline Status & Data
  const {
    status: pipelineStatus,
    lastAnalysis,
    logs: pipelineLogs,
    isStarting: isPipelineStarting,
    isStopping: isPipelineStopping,
    lastLLMVotes,
    start,
    stop,
    pause,
    resume,
    refresh: refreshPipelineData,
  } = usePipeline();

  // AI Skill (from Backtest)
  const [skillConfig, setSkillConfig] = useState<AIBacktestSkill | null>(null);
  const [skillVersion, setSkillVersion] = useState(0);

  // Methodology Config (synced with backend)
  const [activeMethodologies, setActiveMethodologies] = useState<MethodologyName[]>([]);
  const [methodologyWeights, setMethodologyWeights] = useState<MethodologyWeights>({ ...DEFAULT_METHODOLOGY_WEIGHTS });
  const [showMethodologyConfig, setShowMethodologyConfig] = useState(false);

  // LLM Consensus Config (synced with backend)
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [llmThreshold, setLlmThreshold] = useState(0.7);
  const [llmMinProviders, setLlmMinProviders] = useState(3);
  const [llmProviderTimeoutMs, setLlmProviderTimeoutMs] = useState(25000);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load AI trading settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await aiTradingService.getAiTradingSettings();
        if (res.success && res.data) {
          setActiveMethodologies(res.data.activeMethodologies || []);
          setMethodologyWeights(res.data.methodologyWeights || { ...DEFAULT_METHODOLOGY_WEIGHTS });
          setLlmEnabled(res.data.llmConsensus?.enabled || false);
          setLlmThreshold(res.data.llmConsensus?.threshold || 0.7);
          setLlmMinProviders(res.data.llmConsensus?.minProviders || 3);
          setLlmProviderTimeoutMs(res.data.llmConsensus?.providerTimeoutMs || 25000);
        }
      } catch (e) {
        console.warn("Failed to load AI trading settings:", e);
      }
    };
    loadSettings();
  }, []);

  // Save settings to backend when they change
  const saveSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      await aiTradingService.updateAiTradingSettings({
        activeMethodologies,
        methodologyWeights,
        llmConsensus: {
          enabled: llmEnabled,
          threshold: llmThreshold,
          minProviders: llmMinProviders,
          providerTimeoutMs: llmProviderTimeoutMs,
        },
      });
    } catch (e) {
      console.error("Failed to save AI trading settings:", e);
    } finally {
      setIsSavingSettings(false);
    }
  }, [activeMethodologies, methodologyWeights, llmEnabled, llmThreshold, llmMinProviders, llmProviderTimeoutMs]);

  // Debounced save when settings change
  useEffect(() => {
    const timer = setTimeout(saveSettings, 1000);
    return () => clearTimeout(timer);
  }, [saveSettings]);

  // Handlers for Pipeline actions (passed from usePipeline)
  const startPipeline = start;
  const stopPipeline = stop;
  const pausePipeline = pause;
  const resumePipeline = resume;
  const connectMT5 = connect as unknown as (payload: any) => Promise<boolean>;
  const disconnectMT5 = async () => {
    await disconnect();
  };

  const contextValue = useMemo(
    () => ({
      isConnected,
      isConnecting,
      connectError,
      connectMT5,
      disconnectMT5,

      accountInfo,
      accountLoading,
      refetchAccountInfo: refetchAccount,

      positions,
      orders,
      positionsLoading,
      positionsError,
      closePosition,
      modifyPosition,
      refetchPositions,

      pipelineStatus,
      pipelineLogs,
      isPipelineStarting,
      isPipelineStopping,
      lastAnalysis,
      lastLlmVotes: lastLLMVotes,
      startPipeline,
      stopPipeline,
      pausePipeline,
      resumePipeline,
      refreshPipelineData,

      llmModels,
      llmLoading,
      llmActiveCount,
      refreshLlmStatus,

      skillConfig,
      setSkillConfig,
      skillVersion,
      setSkillVersion,

      activeMethodologies,
      setActiveMethodologies,
      methodologyWeights,
      setMethodologyWeights,
      showMethodologyConfig,
      setShowMethodologyConfig,

      llmEnabled,
      setLlmEnabled,
      llmThreshold,
      setLlmThreshold,
      llmMinProviders,
      setLlmMinProviders,
      llmProviderTimeoutMs,
      setLlmProviderTimeoutMs,
      isSavingSettings,
    }),
    [
      isConnected,
      isConnecting,
      connectError,
      connectMT5,
      disconnectMT5,
      accountInfo,
      accountLoading,
      refetchAccount,
      positions,
      positionsLoading,
      positionsError,
      closePosition,
      modifyPosition,
      refetchPositions,
      pipelineStatus,
      pipelineLogs,
      isPipelineStarting,
      isPipelineStopping,
      lastAnalysis,
      lastLLMVotes,
      startPipeline,
      stopPipeline,
      pausePipeline,
      resumePipeline,
      refreshPipelineData,
      llmModels,
      llmLoading,
      llmActiveCount,
      refreshLlmStatus,
      skillConfig,
      setSkillConfig,
      skillVersion,
      setSkillVersion,
      activeMethodologies,
      setActiveMethodologies,
      methodologyWeights,
      setMethodologyWeights,
      showMethodologyConfig,
      setShowMethodologyConfig,
      llmEnabled,
      setLlmEnabled,
      llmThreshold,
      setLlmThreshold,
      llmMinProviders,
      setLlmMinProviders,
      llmProviderTimeoutMs,
      setLlmProviderTimeoutMs,
      isSavingSettings,
    ]
  );

  return <AiTradingContext.Provider value={contextValue}>{children}</AiTradingContext.Provider>;
}

export function useAiTrading() {
  const context = useContext(AiTradingContext);
  if (context === undefined) {
    throw new Error("useAiTrading must be used within an AiTradingProvider");
  }
  return context;
}
