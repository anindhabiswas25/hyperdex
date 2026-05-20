import { H1, H2, H3, P, Code, Mono, Callout } from '@/components/docs/DocsPrimitives';

export default function MakerSetupPage() {
  return (
    <>
      <H1 tag="Getting Started">Setting Up as a Market Maker</H1>
      <P>Becoming a HyperDex market maker requires both an on-chain registration (so the smart contract recognises your signing key) and an off-chain registration (so the backend lets you into the WebSocket auction feed).</P>

      <H2 id="why-register">Why do I need to register?</H2>
      <P>HyperDex is a permissioned maker pool. Only registered makers can submit bids. This design prevents spam bids and ensures every bid comes from an entity that has deposited real inventory into the vault — guaranteeing they can actually settle if selected.</P>

      <H3 id="step-1-keypair">Step 1 — Generate an ed25519 signing keypair</H3>
      <P>Your signing keypair is a <strong>hot key</strong> used only for signing quotes. It is separate from your Stellar wallet keypair, which holds funds.</P>
      <Code>{`# Using Node.js:
const keypair = StellarSdk.Keypair.random();
console.log("Public:", keypair.publicKey());
console.log("Secret:", keypair.secret());
# Store the secret securely — this is what the Maker SDK uses to sign quotes`}</Code>

      <H3 id="step-2-onchain">Step 2 — On-chain registration via the frontend</H3>
      <P>Navigate to <strong>/maker</strong> and connect your maker wallet. The UI walks you through calling <Mono>pool_registry.register_maker()</Mono> on Soroban with your ed25519 public key. This transaction costs a small XLM fee and is permanent until you rotate or deactivate.</P>

      <H3 id="step-3-offchain">Step 3 — Submit off-chain application</H3>
      <Code>{`curl -X POST http://localhost:4000/api/makers/apply \\
  -H "Content-Type: application/json" \\
  -d '{
    "address":        "YOUR_STELLAR_ADDRESS",
    "name":           "My Maker",
    "signerPublicKey":"YOUR_ED25519_PUBLIC_KEY_HEX",
    "webhookUrl":     "http://your-maker-server/quote"
  }'`}</Code>

      <H3 id="step-4-approval">Step 4 — Admin approval</H3>
      <P>An admin reviews and approves your application at <strong>/admin</strong>. Once approved you receive an API key. This key is used to authenticate your Maker SDK WebSocket connection.</P>

      <H3 id="step-5-run-sdk">Step 5 — Configure and run the Maker SDK</H3>
      <Code>{`# .env in maker-sdk/
MAKER_API_KEY=sk_live_xxx
MAKER_ADDRESS=YOUR_STELLAR_ADDRESS
SIGNER_SECRET=YOUR_ED25519_SECRET
BACKEND_WS=ws://localhost:4000
SPREAD_BPS=20

npm run dev
# → Connected to backend WS as MAKER_NAME`}</Code>
    </>
  );
}
