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
          ['pool_registry',      'CA6HM3OXPWVKJ2GOJV7JXXPYG2GXYHL3DI6QRTUZ5FN4KJGP4MSOFWCP'],
          ['quote_verifier',     'CA5VBADGOYSM4RXZPNA57GQYISA5DF3RDOHNYDXYYYGQDJJVW47TXIVN'],
          ['maker_pool_factory', 'CBDOO3W2VUUN3FEGSHL4PRWQATXFN25NHR555YLPNZ4ZPAQQ4PIQPFV6'],
          ['fee_distributor',    'CCQIZPZD7T2ZFYFTISMJ7GSPLK32L43EXJLHZM7JJX6ERXWO7DURJSYF'],
          ['USDC (SAC)',         'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'],
          ['EURC (SAC)',         'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ'],
        ]}
      />
      <Callout type="info" title="Per-maker pools">Each maker has their <strong>own</strong> maker_pool contract, deployed on demand by <strong>maker_pool_factory</strong> when they register. There is no single shared vault — a pool address is unique per maker and shown on the /maker dashboard.</Callout>

      <H2 id="service-urls">Service URLs</H2>
      <Table
        headers={['Service', 'Local Dev', 'Live (Testnet)']}
        rows={[
          ['Frontend',         'http://localhost:3000',   'https://hyperdex-psi.vercel.app'],
          ['Backend REST',     'http://localhost:4000',   'https://hyperdex.onrender.com'],
          ['Backend WS',       'ws://localhost:4000/ws/maker', 'wss://hyperdex.onrender.com/ws/maker'],
          ['Maker SDK health', 'http://localhost:3001/health', '—'],
          ['Stellar Explorer', 'https://stellar.expert/explorer/testnet', ''],
        ]}
      />
    </>
  );
}
