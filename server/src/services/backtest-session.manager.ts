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
  /** Owner user ID for session ownership validation */
  userId?: string;
}

class BacktestSessionManager {
  private sessions = new Map<string, BacktestSession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup stale sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  createSession(config: BacktestConfig, symbolStates: Map<string, SymbolState>, userId?: string): string {
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      config,
      symbolStates,
      status: 'prepared',
      createdAt: new Date(),
      lastAccessed: new Date(),
      userId,
    });
    return id;
  }

  getSession(id: string, userId?: string): BacktestSession | undefined {
    const session = this.sessions.get(id);
    if (session) {
      // Validate ownership if userId provided
      if (userId && session.userId !== userId) {
        return undefined;
      }
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

  async triggerStart(id: string, userId?: string) {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error('Session not found or not in prepared state');
    }
    if (userId && session.userId !== userId) {
      throw new Error('Unauthorized: session belongs to different user');
    }

    session.status = 'running';
    if (session.startResolver) {
      session.startResolver();
    }
  }

  markAborted(id: string, userId?: string) {
    const session = this.sessions.get(id);
    if (session) {
      if (userId && session.userId !== userId) {
        return; // Silent ignore unauthorized abort
      }
      session.abortFlag = true;
      session.status = 'cancelled';
    }
  }

  isAborted(id: string): boolean {
    return this.sessions.get(id)?.abortFlag ?? false;
  }

  removeSession(id: string, userId?: string) {
    const session = this.sessions.get(id);
    if (session) {
      if (userId && session.userId !== userId) {
        return; // Silent ignore unauthorized removal
      }
      this.sessions.delete(id);
    }
  }

  /**
   * Force cleanup a session regardless of ownership - for internal cleanup
   */
  forceRemoveSession(id: string) {
    this.sessions.delete(id);
  }

  /**
   * Get all session IDs for a user
   */
  getUserSessions(userId: string): string[] {
    const ids: string[] = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        ids.push(id);
      }
    }
    return ids;
  }

  /**
   * Force cleanup all sessions for a user - call on logout/disconnect
   */
  cleanupUserSessions(userId: string) {
    const ids = this.getUserSessions(userId);
    for (const id of ids) {
      this.forceRemoveSession(id);
    }
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
