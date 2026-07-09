import { randomUUID } from 'crypto';
import type { BacktestConfig, SymbolState } from './backtest.service';

export type { SymbolState };

export interface BacktestSession {
  id: string;
  config: BacktestConfig;
  symbolStates: Map<string, SymbolState>;
  status: 'prepared' | 'running' | 'completed' | 'cancelled';
  createdAt: Date;
  lastAccessed: Date;
  // Resolver to trigger simulation start in the SSE stream
  startResolver?: (value: void | PromiseLike<void>) => void;
  /** Signal that the client has disconnected — simulation should stop early */
  abortFlag?: boolean;
}

class BacktestSessionManager {
  private sessions = new Map<string, BacktestSession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup stale sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  createSession(config: BacktestConfig, symbolStates: Map<string, SymbolState>): string {
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      config,
      symbolStates,
      status: 'prepared',
      createdAt: new Date(),
      lastAccessed: new Date(),
    });
    return id;
  }

  getSession(id: string): BacktestSession | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAccessed = new Date();
    }
    return session;
  }

  updateStatus(id: string, status: BacktestSession['status']) {
    const session = this.sessions.get(id);
    if (session) {
      session.status = status;
    }
  }

  setStartResolver(id: string, resolver: (value: void | PromiseLike<void>) => void) {
    const session = this.sessions.get(id);
    if (session) {
      session.startResolver = resolver;
    }
  }

  async triggerStart(id: string) {
    const session = this.sessions.get(id);
    if (!session || session.status !== 'prepared') {
      throw new Error('Session not found or not in prepared state');
    }

    session.status = 'running';
    if (session.startResolver) {
      session.startResolver();
    }
  }

  markAborted(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.abortFlag = true;
      session.status = 'cancelled';
    }
  }

  isAborted(id: string): boolean {
    return this.sessions.get(id)?.abortFlag ?? false;
  }

  removeSession(id: string) {
    this.sessions.delete(id);
  }

  private cleanup() {
    const now = new Date();
    const TTL = 10 * 60 * 1000; // 10 minutes
    for (const [id, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastAccessed.getTime() > TTL) {
        this.sessions.delete(id);
      }
    }
  }
}

export const backtestSessionManager = new BacktestSessionManager();
