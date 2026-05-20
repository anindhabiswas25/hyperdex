import { TradeAckMessage } from '../messages/incoming';
import { tradePushService } from '../TradePushService';

export function onTradeAck(_conn: unknown, msg: TradeAckMessage): void {
  tradePushService.handleAck(msg.message.tradeEventId);
}
