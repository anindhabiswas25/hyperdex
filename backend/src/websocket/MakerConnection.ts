import WebSocket from 'ws';
import { logger } from '../utils/logger';
import type { RfqMessage, OutgoingMessage } from './messages/outgoing';

export interface PendingRfq {
  resolve: (quote: RfqQuotePayload) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  takerAddress: string;
}

export interface RfqQuotePayload {
  rfqId: string;
  quoteId: string;
  makerAddress: string;
  takerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expiryTimestamp: number;
  salt: string;
  signature: string;
  spreadBps?: number;
}

export class MakerConnection {
  readonly ws: WebSocket;
  readonly makerId: string;
  readonly makerAddress: string;
  readonly makerName: string;
  isAuthenticated: boolean = false;
  readonly connectedAt: Date = new Date();
  lastPongAt: Date = new Date();
  readonly pendingRfqs: Map<string, PendingRfq> = new Map();

  constructor(ws: WebSocket, makerId: string, makerAddress: string, makerName: string) {
    this.ws = ws;
    this.makerId = makerId;
    this.makerAddress = makerAddress;
    this.makerName = makerName;
  }

  send(message: OutgoingMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendRfq(rfq: RfqMessage, timeoutMs: number): Promise<RfqQuotePayload> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRfqs.delete(rfq.message.rfqId);
        reject(new Error(`RFQ ${rfq.message.rfqId} timed out`));
      }, timeoutMs);

      this.pendingRfqs.set(rfq.message.rfqId, { resolve, reject, timeout, takerAddress: rfq.message.takerAddress });
      this.send(rfq);
    });
  }

  close(code: number, reason: string): void {
    this.ws.close(code, reason);
  }
}

export class MakerConnectionRegistry {
  private static instance: MakerConnectionRegistry;
  private connections: Map<string, MakerConnection> = new Map();

  static getInstance(): MakerConnectionRegistry {
    if (!MakerConnectionRegistry.instance) {
      MakerConnectionRegistry.instance = new MakerConnectionRegistry();
    }
    return MakerConnectionRegistry.instance;
  }

  register(makerId: string, connection: MakerConnection): void {
    this.connections.set(makerId, connection);
    logger.info('Maker connection registered', { makerId, name: connection.makerName });
  }

  unregister(makerId: string): void {
    this.connections.delete(makerId);
    logger.info('Maker connection unregistered', { makerId });
  }

  getConnection(makerId: string): MakerConnection | null {
    return this.connections.get(makerId) ?? null;
  }

  getActiveMakers(): MakerConnection[] {
    return Array.from(this.connections.values()).filter(c => c.isAuthenticated);
  }

  isConnected(makerId: string): boolean {
    return this.connections.has(makerId);
  }

  get size(): number {
    return this.connections.size;
  }
}
