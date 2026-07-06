import { H1, H2, H3, P, Code, Mono, Callout, Table, PageDescription } from '@/components/docs/DocsPrimitives';

export default function PricingEnginesPage() {
  return (
    <>
      <H1 tag="Getting Started">Pricing Engines</H1>
      <PageDescription>The Maker SDK handles all the plumbing — WebSocket, API-key auth, ed25519 quote signing in the exact XDR the contract verifies, inventory reads, and trade confirmations. You only decide how to price, and that lives in a pluggable <Mono>MakerEngine</Mono>.</PageDescription>

      <H2 id="the-interface">The engine interface</H2>
      <P>An engine is an object that answers two questions. The SDK calls it; you never touch the network or the signer.</P>
      <Table
        headers={['Method', 'Called', 'Returns']}
        rows={[
          ['getLevels()', 'every ~3s', 'your resting book { sellLevels, buyLevels } (empty arrays → go offline gracefully)'],
          ['getQuote(ctx)', 'on each RFQ', 'amountOut in stroops as a string, or null to skip this trade (no penalty)'],
          ['onTradeConfirmed(trade)', 'when a fill settles (optional)', 'nothing — refresh inventory, hedge on a CEX, log'],
        ]}
      />

      <H2 id="tier-1">Tier 1 — Built-in ghost-price engine (default, no code)</H2>
      <Code>{`npm run dev <yourname>`}</Code>
      <P>Set one ghost price (EURC per USDC); the SDK auto-bids it, fee-adjusted, on every RFQ. It is gated by an <strong>inventory check</strong> (never quotes more than ~80% of your pool balance) and a <strong>drift guard</strong> — warns at &gt;1% drift from the live oracle mid, <strong>pauses quoting at &gt;3%</strong>. Press <Mono>Ctrl+R</Mono> to re-price, <Mono>Ctrl+C</Mono> to disconnect.</P>

      <H2 id="tier-2">Tier 2 / 3 — Custom engine</H2>
      <P>Point the SDK at any engine file with <Mono>--engine</Mono>. <strong>Note the <Mono>--</Mono> separator</strong> — without it, npm swallows the flag:</P>
      <Code>{`npm run dev <yourname> -- --engine=./examples/fixed-rate-engine.ts
npm run dev <yourname> -- --engine=./examples/binance-engine.ts
npm run dev <yourname> -- --engine=./path/to/your-engine.ts`}</Code>
      <P>A custom engine owns its full pricing logic, so the SDK skips the ghost-price prompt and <Mono>Ctrl+R</Mono>. If the file is missing or doesn&apos;t implement <Mono>getLevels</Mono>/<Mono>getQuote</Mono>, the SDK logs the error and <strong>falls back to the built-in engine</strong> — it won&apos;t crash. Confirm which one loaded from the <Mono>Engine:</Mono> line in the startup banner.</P>

      <H3 id="writing-one">Writing your own</H3>
      <Code>{`// my-engine.ts
import { MakerEngine, RfqContext, PriceLevels } from '../src/types/MakerEngine'

const engine: MakerEngine = {
  async getLevels(): Promise<PriceLevels> {
    return {
      sellLevels: [{ quantity: '1000000000', price: '0.87800000' }], // USDC→EURC
      buyLevels:  [{ quantity: '1000000000', price: '1.13800000' }], // EURC→USDC
    }
  },
  async getQuote(ctx: RfqContext): Promise<string | null> {
    const rate   = ctx.tokenInSymbol === 'USDC' ? 0.8780 : 1 / 0.8780
    const feeAdj = 1 - ctx.feesBps * 0.0001            // protocol fee
    const out    = Math.floor(ctx.amountInHuman * rate * feeAdj * 1e7)
    return out > 0 ? out.toString() : null             // null = skip
  },
}
export default engine`}</Code>

      <Callout type="warn" title="Two things to get right">
        <strong>1. Direction.</strong> A USDC→EURC rate (~0.88) is the inverse of an EURC→USDC rate (~1.14). If you pull a feed like Binance <Mono>EURUSDT</Mono> (~1.14 = USDT per EUR), the USDC→EURC rate is <Mono>1 / price</Mono>, not <Mono>price</Mono>.{' '}
        <strong>2. Inventory.</strong> The SDK does <strong>not</strong> stop a custom engine from quoting more than your pool holds — quoting size you can&apos;t fill makes the on-chain swap revert. Read your balance and cap your quote (the default engine does this automatically).
      </Callout>

      <P>Working templates live in <Mono>maker-sdk/examples/</Mono>. Full guides: <Mono>maker-sdk/CUSTOM_ENGINE.md</Mono> (building engines) and <Mono>maker-sdk/TESTING_ENGINES.md</Mono> (E2E-testing + pitfalls).</P>
    </>
  );
}
