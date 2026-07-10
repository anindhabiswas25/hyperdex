import { H1, P, Table, Callout } from '@/components/docs/DocsPrimitives';

export default function TokensPage() {
  return (
    <>
      <H1 tag="Reference">Supported Tokens</H1>
      <Table
        headers={['Token', 'Type', 'Issuer', 'SAC Address (Mainnet)']}
        rows={[
          ['USDC', 'USD Stablecoin', 'Circle (GA5ZSEJY…KZVN)', 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'],
          ['EURC', 'EUR Stablecoin', 'Circle (GDHU6WRG…NPP2)', 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV'],
        ]}
      />
      <P>SAC = Stellar Asset Contract — the Soroban-compatible interface for Stellar classic assets.</P>
      <Callout type="info" title="Adding more tokens">Adding a new token pair requires deploying or verifying its SAC address and wiring it into the maker_pool + oracle. Open a GitHub issue to request new pairs.</Callout>
    </>
  );
}
