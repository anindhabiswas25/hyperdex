import { H1, P, Ul, Li, Callout, Mono } from '@/components/docs/DocsPrimitives';

export default function NonCustodialPage() {
  return (
    <>
      <H1 tag="Concepts">Non-Custodial Settlement</H1>
      <P>HyperDex is non-custodial: the protocol never holds taker funds at any point. The sequence is atomic:</P>
      <Ul>
        <Li>Before the transaction: taker holds <Mono>token_in</Mono> in their own wallet</Li>
        <Li>During the transaction: Soroban atomically moves <Mono>token_in</Mono> from taker → maker_pool, and <Mono>token_out</Mono> from the pool → taker</Li>
        <Li>After the transaction: taker holds <Mono>token_out</Mono>; the pool holds <Mono>token_in</Mono> (minus fees)</Li>
      </Ul>
      <P>If any step fails (bad signature, expired quote, insufficient pool balance), the entire transaction reverts. The taker&apos;s original tokens are never at risk.</P>
      <Callout type="info" title="Maker funds in the pool">Maker inventory held in the maker_pool is at the maker&apos;s own risk. Makers should monitor their pool balance and manage exposure accordingly.</Callout>
    </>
  );
}
