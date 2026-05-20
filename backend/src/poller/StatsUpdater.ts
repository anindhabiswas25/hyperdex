import { Maker } from '../db/models/Maker';
import { Trade } from '../db/models/Trade';
import { ITrade } from '../db/models/Trade';
import { config } from '../config';
import { logger } from '../utils/logger';

export class StatsUpdater {
  async updateAfterConfirmedTrade(trade: ITrade): Promise<void> {
    try {
      const amountInRaw = BigInt(trade.amountIn);

      // Stellar uses 7 decimal places (stroops for XLM, but USDC/EURC use same scale)
      let usdValue: number;
      if (trade.tokenIn === config.USDC_CONTRACT_ADDRESS) {
        usdValue = Number(amountInRaw) / 1e7;
      } else {
        // EURC: TODO replace with price oracle in production
        usdValue = (Number(amountInRaw) / 1e7) * 1.08;
      }

      const feeAmountUsd = Number(BigInt(trade.feeAmount)) / 1e7;

      await Maker.findOneAndUpdate(
        { stellarAddress: trade.makerAddress },
        {
          $inc: {
            totalTrades: 1,
            totalVolume: usdValue,
            totalFeesEarned: feeAmountUsd,
          },
          $set: { updatedAt: new Date() },
        }
      );

      logger.info('Maker stats updated after confirmed trade', {
        makerAddress: trade.makerAddress,
        quoteId: trade.quoteId,
        usdValue,
      });
    } catch (err) {
      // Stats update failure must not block trade confirmation
      logger.error('Failed to update maker stats', {
        makerAddress: trade.makerAddress,
        quoteId: trade.quoteId,
        error: (err as Error).message,
      });
    }
  }

  async recalculateMakerStats(makerAddress: string): Promise<void> {
    const trades = await Trade.find({
      makerAddress,
      status: 'confirmed',
    }).lean();

    let totalTrades = 0;
    let totalVolume = 0;
    let totalFeesEarned = 0;

    for (const trade of trades) {
      totalTrades += 1;
      const amountInRaw = BigInt(trade.amountIn);
      const isUsdc = trade.tokenIn === config.USDC_CONTRACT_ADDRESS;
      const usdValue = isUsdc
        ? Number(amountInRaw) / 1e7
        : (Number(amountInRaw) / 1e7) * 1.08;
      totalVolume += usdValue;
      totalFeesEarned += Number(BigInt(trade.feeAmount)) / 1e7;
    }

    await Maker.findOneAndUpdate(
      { stellarAddress: makerAddress },
      { $set: { totalTrades, totalVolume, totalFeesEarned, updatedAt: new Date() } }
    );

    logger.info('Maker stats recalculated', { makerAddress, totalTrades, totalVolume });
  }
}
