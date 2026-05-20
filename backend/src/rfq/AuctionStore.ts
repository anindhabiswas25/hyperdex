import { Trade } from '../db/models/Trade'
import { logger } from '../utils/logger'

export interface AuctionQuote {
  quoteId:         string
  makerAddress:    string
  tokenIn:         string
  tokenOut:        string
  amountIn:        string
  amountOut:       string
  expiryTimestamp: number
  salt:            string
  signature:       string
}

interface Auction {
  auctionId:    string
  tokenIn:      string
  tokenOut:     string
  amountIn:     string
  takerAddress: string
  startedAt:    number
  windowMs:     number
  quotes:       AuctionQuote[]
  makerCount:   number
  status:       'collecting' | 'completed' | 'no_quotes'
  bestQuote:    AuctionQuote | null
}

class AuctionStore {
  private auctions: Map<string, Auction> = new Map()

  create(params: {
    auctionId:    string
    tokenIn:      string
    tokenOut:     string
    amountIn:     string
    takerAddress: string
    makerCount:   number
    windowMs:     number
  }): void {
    this.auctions.set(params.auctionId, {
      ...params,
      startedAt: Date.now(),
      quotes:    [],
      status:    'collecting',
      bestQuote: null
    })
  }

  addQuote(auctionId: string, quote: AuctionQuote): void {
    const auction = this.auctions.get(auctionId)
    if (!auction || auction.status !== 'collecting') return

    const alreadyBid = auction.quotes.some(
      q => q.makerAddress === quote.makerAddress
    )
    if (alreadyBid) return

    if (!quote.signature || quote.signature.length !== 128) return
    if (Number(quote.amountOut) <= 0) return
    if (quote.expiryTimestamp < Math.floor(Date.now() / 1000) + 10) return

    auction.quotes.push(quote)
    logger.info('Auction bid received', {
      auctionId:    auctionId.slice(0, 8),
      makerAddress: quote.makerAddress.slice(0, 8),
      amountOut:    quote.amountOut,
      totalBids:    auction.quotes.length,
      makerCount:   auction.makerCount
    })
  }

  complete(auctionId: string): void {
    const auction = this.auctions.get(auctionId)
    if (!auction || auction.status !== 'collecting') return

    if (auction.quotes.length === 0) {
      auction.status = 'no_quotes'
      logger.warn('Auction completed with no bids', {
        auctionId: auctionId.slice(0, 8)
      })
      return
    }

    const sorted = [...auction.quotes].sort((a, b) => {
      const diff = BigInt(b.amountOut) - BigInt(a.amountOut)
      return diff > 0n ? 1 : diff < 0n ? -1 : 0
    })

    auction.bestQuote = sorted[0]
    auction.status = 'completed'

    logger.info('Auction completed', {
      auctionId:  auctionId.slice(0, 8),
      winner:     auction.bestQuote.makerAddress.slice(0, 8),
      amountOut:  auction.bestQuote.amountOut,
      totalBids:  auction.quotes.length,
      allBids:    auction.quotes.map(q => ({
        maker:     q.makerAddress.slice(0, 8),
        amountOut: q.amountOut
      }))
    })

    Trade.findOneAndUpdate(
      { quoteId: auction.bestQuote.quoteId },
      {
        $setOnInsert: {
          quoteId:         auction.bestQuote.quoteId,
          makerAddress:    auction.bestQuote.makerAddress,
          takerAddress:    auction.takerAddress,
          tokenIn:         auction.tokenIn,
          tokenOut:        auction.tokenOut,
          amountIn:        auction.amountIn,
          amountOut:       auction.bestQuote.amountOut,
          expiryTimestamp: auction.bestQuote.expiryTimestamp,
          status:          'quoted',
          quotedAt:        new Date()
        }
      },
      { upsert: true }
    ).catch(err =>
      logger.error('Failed to save auction trade', { err })
    )
  }

  get(auctionId: string): Auction | null {
    return this.auctions.get(auctionId) || null
  }

  cleanup(): void {
    const cutoff = Date.now() - 10 * 60_000
    for (const [id, a] of this.auctions.entries()) {
      if (a.startedAt < cutoff) this.auctions.delete(id)
    }
  }
}

export const auctionStore = new AuctionStore()
setInterval(() => auctionStore.cleanup(), 5 * 60_000)
