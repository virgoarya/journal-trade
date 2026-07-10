"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
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

  // AI Skill (Backtest)
  skillConfig: AIBacktestSkill | null;
  setSkillConfig: (skill: AIBacktestSkill | null) => void;
  skillVersion: number;
  setSkillVersion: (version: number) => void;

  // Methodology Config (local state for TradingPanel to manage)
  activeMethodologies: MethodologyName[];
  setActiveMethodologies: React.Dispatch<React.SetStateAction<MethodologyName[]>>;
  methodologyWeights: MethodologyWeights;
  setMethodologyWeights: React.Dispatch<React.SetStateAction<MethodologyWeights>>;
  showMethodologyConfig: boolean;
  setShowMethodologyConfig: React.Dispatch<React.SetStateAction<boolean>>;

  // LLM Consensus Config (local state for TradingPanel to manage)
  llmEnabled: boolean;
  setLlmEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  llmThreshold: number;
  setLlmThreshold: React.Dispatch<React.SetStateAction<number>>;
}

const AiTradingContext = createContext<AiTradingContextType | undefined>(undefined);

export function AiTradingProvider({ children }: { children: React.ReactNode }) {
  // MT5 Connection
  const { isConnected, isConnecting, error: connectError, connect, disconnect } = useMT5Connection();

  // Account Info
  const { accountInfo, isLoading: accountLoading, refetch: refetchAccount } = useAccountInfo();

  // Positions
  const { positions, isLoading: positionsLoading, fetchError: positionsError, closePosition, modifyPosition, refetch: refetchPositions } =
    usePositions(10000);

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

  // Methodology Config (local state, managed by context but primarily for TradingPanel)
  const [activeMethodologies, setActiveMethodologies] = useState<MethodologyName[]>([
    "smc",
    "ict",
    "msnr",
    "crt",
    "quarterly",
    "lit",
    "rsiEngulf",
  ]);
  const [methodologyWeights, setMethodologyWeights] = useState<MethodologyWeights>({ ...DEFAULT_METHODOLOGY_WEIGHTS });
  const [showMethodologyConfig, setShowMethodologyConfig] = useState(false);

  // LLM Consensus Config (local state, managed by context but primarily for TradingPanel)
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [llmThreshold, setLlmThreshold] = useState(0.5);

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
