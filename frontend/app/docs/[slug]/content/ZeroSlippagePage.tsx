import { H1, P, Ul, Li, Mono } from '@/components/docs/DocsPrimitives';

export default function ZeroSlippagePage() {
  return (
    <>
      <H1 tag="Concepts">Zero Slippage</H1>
      <P>Slippage occurs when the price you receive differs from the price you expected. On AMMs, slippage is a mathematical certainty — every trade moves the bonding curve, making the next unit of the trade worse.</P>
      <P>On HyperDex, slippage is <strong>structurally impossible</strong>. Here is why:</P>
      <Ul>
        <Li>The maker quotes an exact <Mono>amount_out</Mono> for an exact <Mono>amount_in</Mono></Li>
        <Li>This quote is cryptographically signed with the maker&apos;s ed25519 key</Li>
        <Li>The <Mono>quote_verifier</Mono> contract verifies the signature and enforces the exact amounts</Li>
        <Li>If the amounts do not match the signed quote, the transaction reverts</Li>
      </Ul>
      <P>The taker receives precisely what was quoted — not a basis point less. The maker absorbs all market risk between quote time and settlement.</P>
    </>
  );
}
