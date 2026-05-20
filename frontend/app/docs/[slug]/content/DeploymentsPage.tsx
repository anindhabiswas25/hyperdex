import { H1, H2, P, Table, Callout } from '@/components/docs/DocsPrimitives';

export default function DeploymentsPage() {
  return (
    <>
      <H1 tag="Reference">Deployments</H1>
      <Callout type="warn" title="Testnet Only">All addresses below are on Stellar Testnet. Mainnet is not yet live.</Callout>

      <H2 id="smart-contracts">Smart Contracts (Stellar Testnet)</H2>
      <Table
        headers={['Contract', 'Address']}
        rows={[
          ['pool_registry',   'CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7'],
          ['vault',           'CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB'],
          ['quote_verifier',  'CDBLP52CBG4D6IG26DGTO7G3APVU3UZAZXTXC52V6LK4H4WXFYOBDZSC'],
          ['fee_distributor', 'CBOQ5X23YTHT5NKB3EPW3Q3A77TRR4CQUYWEU4TA2XCNUKX57JTDYYJA'],
        ]}
      />

      <H2 id="service-urls">Service URLs (Local Dev)</H2>
      <Table
        headers={['Service', 'URL']}
        rows={[
          ['Frontend',         'http://localhost:3000'],
          ['Backend REST',     'http://localhost:4000'],
          ['Backend WS',       'ws://localhost:4000'],
          ['Maker SDK',        'http://localhost:3001'],
          ['Stellar Explorer', 'https://stellar.expert/explorer/testnet'],
        ]}
      />
    </>
  );
}
