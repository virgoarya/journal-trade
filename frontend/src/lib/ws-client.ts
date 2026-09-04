import { Mt5Tick, Mt5Position, Mt5Order } from "../types/ws-types";

interface Mt5WebSocketClientOptions {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  maxBufferSize?: number;
}

export class Mt5WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private reconnectDelay = 1000;
  private maxReconnectAttempts = 10;
  private maxBufferSize = 5_242_880; // 5MB
  private bufferMonitorInterval: NodeJS.Timeout | null = null;
  private lastBufferCheckTime = 0;
  private bufferFullDuration = 0;
  private readonly url: string;

  constructor(options: Mt5WebSocketClientOptions) {
    this.url = options.url;
    this.reconnectDelay = options.reconnectDelay ?? this.reconnectDelay;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? this.maxReconnectAttempts;
    this.maxBufferSize = options.maxBufferSize ?? this.maxBufferSize;
    this.connect();
  }

  private connect() {
    this.socket = new WebSocket(this.url);
    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onclose = this.handleClose.bind(this);
    this.socket.onerror = this.handleError.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);

    // Start buffer monitoring
    this.bufferMonitorInterval = setInterval(() => {
      if (this.socket && this.socket.bufferedAmount > this.maxBufferSize) {
        const now = Date.now();
        if (this.lastBufferCheckTime === 0) {
          this.lastBufferCheckTime = now;
        }
        this.bufferFullDuration += now - this.lastBufferCheckTime;
        this.lastBufferCheckTime = now;

        // Disconnect if buffer remains full for 3 consecutive seconds
        if (this.bufferFullDuration >= 3000) {
          console.warn("Buffer full for 3+ seconds, disconnecting");
          this.socket.close();
        }
      } else {
        this.bufferFullDuration = 0;
        this.lastBufferCheckTime = 0;
      }
    }, 1000);
  }

  private handleOpen() {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    console.log("Connected to MT5 WebSocket");
  }

  private handleClose(event: CloseEvent) {
    if (this.bufferMonitorInterval) {
      clearInterval(this.bufferMonitorInterval);
      this.bufferMonitorInterval = null;
    }

    if (this.isReconnecting) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    this.isReconnecting = true;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleError(error: Event) {
    console.error("WebSocket error:", error);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "mt5_tick":
          this.handleTick(data.data);
          break;
        case "mt5_position":
          this.handlePosition(data.data);
          break;
        case "mt5_order":
          this.handleOrder(data.data);
          break;
        default:
          console.warn("Unknown message type:", data.type);
      }
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  }

  private handleTick(tick: Mt5Tick) {
    console.log("Tick received:", tick);
    // Implement tick handling logic
  }

  private handlePosition(position: Mt5Position) {
    console.log("Position update:", position);
    // Implement position handling logic
  }

  private handleOrder(order: Mt5Order) {
    console.log("Order update:", order);
    // Implement order handling logic
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.bufferMonitorInterval) {
      clearInterval(this.bufferMonitorInterval);
      this.bufferMonitorInterval = null;
    }
  }
}
