import { create } from "zustand";
import type {
  ACCOUNTInfo,
  Position,
  PipelineLog,
  MultiStrategyAnalysis,
  LLMConsensusResult,
  AgentConsensusResult,
} from "../types";

type ConsensusLike = LLMConsensusResult | AgentConsensusResult;

export interface MarketDataState {
  // High-frequency account & position data
  accountInfo: ACCOUNTInfo | null;
  accountLoading: boolean;
  positions: Position[];
  orders: Position[];
  positionsLoading: boolean;
  positionsError: string | null;

  // High-frequency pipeline logs & analyses
  pipelineLogs: PipelineLog[];
  lastAnalysis: MultiStrategyAnalysis | null;
  allAnalyses: MultiStrategyAnalysis[];
  lastLlmVotes: ConsensusLike | null;
  agentConsensus: AgentConsensusResult | null;

  // Actions
  setAccountInfo: (info: ACCOUNTInfo | null) => void;
  setAccountLoading: (loading: boolean) => void;
  setPositions: (positions: Position[], orders?: Position[]) => void;
  setPositionsLoading: (loading: boolean) => void;
  setPositionsError: (error: string | null) => void;
  setPipelineLogs: (logs: PipelineLog[]) => void;
  appendPipelineLogs: (logs: PipelineLog[]) => void;
  clearPipelineLogs: () => void;
  setAnalyses: (last: MultiStrategyAnalysis | null, all?: MultiStrategyAnalysis[]) => void;
  setLastLlmVotes: (votes: ConsensusLike | null) => void;
  setAgentConsensus: (consensus: AgentConsensusResult | null) => void;
  resetMarketData: () => void;
}

export const useMarketDataStore = create<MarketDataState>((set) => ({
  accountInfo: null,
  accountLoading: false,
  positions: [],
  orders: [],
  positionsLoading: false,
  positionsError: null,
  pipelineLogs: [],
  lastAnalysis: null,
  allAnalyses: [],
  lastLlmVotes: null,
  agentConsensus: null,

  setAccountInfo: (accountInfo) => set({ accountInfo }),
  setAccountLoading: (accountLoading) => set({ accountLoading }),
  setPositions: (positions, orders) =>
    set((state) => ({
      positions,
      orders: orders ?? state.orders,
    })),
  setPositionsLoading: (positionsLoading) => set({ positionsLoading }),
  setPositionsError: (positionsError) => set({ positionsError }),
  setPipelineLogs: (pipelineLogs) => set({ pipelineLogs }),
  appendPipelineLogs: (newLogs) =>
    set((state) => {
      if (newLogs.length === 0) return state;
      const combined = [...state.pipelineLogs, ...newLogs].slice(-200);
      return { pipelineLogs: combined };
    }),
  clearPipelineLogs: () => set({ pipelineLogs: [] }),
  setAnalyses: (lastAnalysis, allAnalyses) =>
    set((state) => ({
      lastAnalysis,
      allAnalyses: allAnalyses ?? state.allAnalyses,
    })),
  setLastLlmVotes: (lastLlmVotes) => set({ lastLlmVotes }),
  setAgentConsensus: (agentConsensus) => set({ agentConsensus }),
  resetMarketData: () =>
    set({
      accountInfo: null,
      accountLoading: false,
      positions: [],
      orders: [],
      positionsLoading: false,
      positionsError: null,
      pipelineLogs: [],
      lastAnalysis: null,
      allAnalyses: [],
      lastLlmVotes: null,
      agentConsensus: null,
    }),
}));
