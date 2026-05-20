import { H1, P, StepCard, Callout } from '@/components/docs/DocsPrimitives';

export default function FirstSwapPage() {
  return (
    <>
      <H1 tag="Getting Started">Making Your First Swap</H1>
      <P>A HyperDex swap is a 30-second sealed auction followed by a single on-chain transaction. Here is the complete flow from the taker's perspective.</P>

      <StepCard n="01" title="Open the Swap page">Navigate to <strong>http://localhost:3000/swap</strong> (or the live URL). You will see the swap interface with token selectors and an amount input.</StepCard>
      <StepCard n="02" title="Connect your Freighter wallet">Click <strong>Connect Wallet</strong> in the top-right navbar. Freighter will pop up asking for permission to share your public key. Approve it. HyperDex only reads your public key — it never requests your private key.</StepCard>
      <StepCard n="03" title="Select tokens and enter amount">Choose the token you want to sell (e.g., EURC) and the token you want to receive (e.g., USDC). Enter the amount. The output field shows <strong>??.??</strong> — this is intentional. The price is not known until the auction completes.</StepCard>
      <StepCard n="04" title='Click "Get Best Price →"'>This triggers the 30-second sealed-bid auction. You will see a countdown timer, the number of active makers, and a live bid count. Each maker bids privately — you cannot see individual bids during the window.</StepCard>
      <StepCard n="05" title="Review the winning quote">After 30 seconds, the best quote is revealed. You see the exact output amount, exchange rate, market maker name, and protocol fee. You have <strong>10 seconds</strong> to decide.</StepCard>
      <StepCard n="06" title="Sign in Freighter">Click <strong>Swap Now</strong>. Freighter opens showing the Stellar transaction. Review it and click Approve. The transaction is submitted to Stellar.</StepCard>
      <StepCard n="07" title="Settlement confirmed">Stellar finalises the ledger in ~5 seconds. You will see a success screen with the exact amounts transferred and a link to the transaction on stellar.expert. Tokens are now in your wallet.</StepCard>

      <Callout type="info" title="What if I reject the quote?">Clicking Reject or letting the 10-second window expire is completely safe. No transaction is submitted and no funds move. You can start a new auction immediately.</Callout>
    </>
  );
}
