import { H1, P, Table, Callout } from '@/components/docs/DocsPrimitives';

export default function TokensPage() {
  return (
    <>
      <H1 tag="Reference">Supported Tokens</H1>
      <Table
        headers={['Token', 'Type', 'Issuer', 'SAC Address (Testnet)']}
        rows={[
          ['USDC', 'USD Stablecoin', 'Circle (GBBD47IF6LWK7…)', 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'],
          ['EURC', 'EUR Stablecoin', 'Circle (GBBD47IF6LWK7…)', 'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ'],
        ]}
      />
      <P>SAC = Stellar Asset Contract — the Soroban-compatible interface for Stellar classic assets.</P>
      <Callout type="info" title="Adding more tokens">Adding a new token pair requires deploying or verifying its SAC address and wiring it into the maker_pool + oracle. Open a GitHub issue to request new pairs.</Callout>
    </>
  );
}
