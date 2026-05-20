export interface ConnectedMessage {
  type: 'connected';
  message: {
    makerId: string;
    makerName: string;
    serverTime: number;
    supportedPairs: Array<{ tokenIn: string; tokenOut: string }>;
  };
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface RfqMessage {
  type: 'rfq';
  message: {
    rfqId: string;
    takerAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    feesBps: number;
    requestedAt: number;
  };
}

export interface TradeNotificationMessage {
  type: 'trade';
  message: {
    tradeEventId: string;
    quoteId: string;
    rfqId: string | null;
    makerAddress: string;
    takerAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    feeAmount: string;
    txHash: string | null;
    confirmedAt: string | null;
  };
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type OutgoingMessage = ConnectedMessage | PingMessage | RfqMessage | TradeNotificationMessage | ErrorMessage;
