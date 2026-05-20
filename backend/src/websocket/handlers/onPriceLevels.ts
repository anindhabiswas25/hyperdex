import { PriceLevelsMessage } from '../messages/incoming';
import { MakerConnection } from '../MakerConnection';
import { PriceBook } from '../../pricebook/PriceBook';
import { logger } from '../../utils/logger';

export function onPriceLevels(conn: MakerConnection, msg: PriceLevelsMessage): void {
  const { tokenIn, tokenOut, buyLevels, sellLevels } = msg.message;

  // Graceful disconnect: empty levels on both sides = remove maker from routing
  if (buyLevels.length === 0 && sellLevels.length === 0) {
    PriceBook.getInstance().removeMaker(conn.makerId);
    logger.info('Maker gracefully disconnected via empty levels', { makerId: conn.makerId });
    return;
  }

  const parsedBuy: { quantity: number; price: number }[] = [];
  for (const level of buyLevels) {
    const qty = parseFloat(level.quantity);
    const price = parseFloat(level.price);
    if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
      logger.warn('Buy level validation failed', { makerId: conn.makerId, level });
      return;
    }
    parsedBuy.push({ quantity: qty, price });
  }

  const parsedSell: { quantity: number; price: number }[] = [];
  for (const level of sellLevels) {
    const qty = parseFloat(level.quantity);
    const price = parseFloat(level.price);
    if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
      logger.warn('Sell level validation failed', { makerId: conn.makerId, level });
      return;
    }
    parsedSell.push({ quantity: qty, price });
  }

  PriceBook.getInstance().update(
    conn.makerId,
    conn.makerAddress,
    tokenIn,
    tokenOut,
    parsedBuy,
    parsedSell
  );

  logger.debug('Price level update', {
    makerId: conn.makerId,
    pair: `${tokenIn.slice(0, 6)}:${tokenOut.slice(0, 6)}`,
    buyLevels: parsedBuy.length,
    sellLevels: parsedSell.length,
  });
}
