import { H1, H2, P, Ul, Li, Table, Mono } from '@/components/docs/DocsPrimitives';

export default function QuoteVerifierPage() {
  return (
    <>
      <H1 tag="Programs">quote_verifier</H1>
      <P>The <Mono>quote_verifier</Mono> is the taker-facing entry point and the brain of the settlement layer. It is the only contract takers interact with. It coordinates all other contracts.</P>

      <H2 id="why-entry-point">Why it is the entry point</H2>
      <P>Separating verification logic from custody (vault) means the vault can be kept simple and auditable — it only does token movements. The quote_verifier can be upgraded or extended without changing the vault&apos;s token custody logic.</P>

      <H2 id="invariants">Invariants it enforces</H2>
      <Ul>
        <Li><strong>Valid signature:</strong> SHA256(XDR(quote)) must verify against the maker&apos;s registered signing key</Li>
        <Li><strong>Active maker:</strong> maker must be registered and not deactivated</Li>
        <Li><strong>Not expired:</strong> quote.expiry must be in the future</Li>
        <Li><strong>Correct taker:</strong> transaction must be signed by quote.taker</Li>
        <Li><strong>Not replayed:</strong> quote_id must not exist in the spent-quote set</Li>
      </Ul>

      <H2 id="functions">Functions</H2>
      <Table
        headers={['Function', 'Caller', 'Description']}
        rows={[
          ['execute_quote(quote, signature)', 'Taker', 'The main function — verifies and settles a swap'],
          ['get_fee_bps()', 'Anyone', 'Returns current protocol fee in basis points'],
          ['set_fee_bps(bps)', 'Admin', 'Updates protocol fee (max 100 bps = 1%)'],
          ['set_vault(address)', 'Admin', 'Updates vault contract address (for upgrades)'],
          ['set_registry(address)', 'Admin', 'Updates pool_registry address (for upgrades)'],
        ]}
      />
      <P><strong>Address:</strong> <Mono>CDBLP52CBG4D6IG26DGTO7G3APVU3UZAZXTXC52V6LK4H4WXFYOBDZSC</Mono></P>
    </>
  );
}
