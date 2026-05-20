import { H1, H2, P, Code, Callout, Mono } from '@/components/docs/DocsPrimitives';

export default function VaultDepositPage() {
  return (
    <>
      <H1 tag="Getting Started">Deposit Vault Inventory</H1>
      <P>Before the Maker SDK can fill swaps, it needs token inventory in the <Mono>vault</Mono> contract. The vault is the counterparty in every swap — it sends <Mono>token_out</Mono> to the taker and receives <Mono>token_in</Mono> from the taker.</P>

      <H2 id="why-vault">Why does the vault hold inventory?</H2>
      <P>Atomic on-chain settlement requires the vault to already have the output tokens at the time the transaction executes. There is no flash-loan or JIT liquidity — the vault holds a real pre-funded balance. This guarantees that any accepted quote can always be settled.</P>

      <H2 id="how-to-deposit">How to deposit</H2>
      <Code>{`# Using the deposit script:
MAKER_SECRET_KEY=YOUR_MAKER_SECRET \\
USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \\
EURC_CONTRACT=CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X \\
VAULT_CONTRACT=CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB \\
npx ts-node scripts/deposit-vault-inventory.ts`}</Code>

      <H2 id="check-balance">Check your balance</H2>
      <Code>{`curl http://localhost:4000/api/makers/YOUR_ADDRESS/balance
# → { "USDC": "1000.0000000", "EURC": "500.0000000" }`}</Code>
      <Callout type="tip" title="EURC Inventory">EURC inventory is required for USDC → EURC swaps. Get testnet EURC from faucet.circle.com and deposit before going live.</Callout>
    </>
  );
}
