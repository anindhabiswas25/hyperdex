import { H1, H2, P, Table, Mono } from '@/components/docs/DocsPrimitives';

export default function VaultContractPage() {
  return (
    <>
      <H1 tag="Programs">vault</H1>
      <P>The <Mono>vault</Mono> is the custody layer. It holds all maker token inventory and is the only contract that moves tokens between parties during a swap. It has no pricing logic — it simply executes what <Mono>quote_verifier</Mono> tells it to.</P>

      <H2 id="why-prefund">Why makers pre-fund the vault</H2>
      <P>Atomic settlement requires the vault to already have the output tokens at the moment of execution. There is no credit, no flash loan, no JIT — the vault is a real pre-funded balance sheet. This design means every accepted quote is <strong>guaranteed settleable</strong>.</P>

      <H2 id="access-control">Access control</H2>
      <P><Mono>execute_swap</Mono> is the most sensitive function — it moves real tokens. It is protected by an <Mono>assert!(caller == quote_verifier_address)</Mono> check. No other contract or user can call it directly.</P>

      <H2 id="functions">Functions</H2>
      <Table
        headers={['Function', 'Caller', 'Description']}
        rows={[
          ['deposit(maker, token, amount)', 'Maker', 'Transfers amount from maker wallet into their vault balance'],
          ['withdraw(maker, token, amount)', 'Maker', 'Transfers amount from vault balance back to maker wallet'],
          ['execute_swap(quote)', 'quote_verifier only', 'Moves amount_in from taker→vault, amount_out from vault→taker. Atomic — reverts if either transfer fails.'],
          ['get_balance(maker, token)', 'Anyone', 'Returns maker current inventory for a specific token'],
          ['get_all_balances(maker)', 'Anyone', 'Returns all token balances for a maker'],
        ]}
      />
      <P><strong>Address:</strong> <Mono>CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB</Mono></P>
    </>
  );
}
