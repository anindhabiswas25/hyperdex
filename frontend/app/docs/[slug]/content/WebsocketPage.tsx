import { H1, H2, P, Code, Table, Mono } from '@/components/docs/DocsPrimitives';

export default function WebsocketPage() {
  return (
    <>
      <H1 tag="API Reference">WebSocket Events</H1>
      <P>Makers connect to <Mono>ws://localhost:4000</Mono> for real-time RFQ event delivery. The connection must be authenticated before receiving auction events.</P>

      <H2 id="connection-auth">Connection &amp; Auth</H2>
      <Code>{`const ws = new WebSocket("ws://localhost:4000");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type:         "auth",
    apiKey:       "sk_live_xxx",
    makerAddress: "GALNCM…",
  }));
};

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  switch (msg.type) {
    case "auth_success": console.log("Connected as", msg.makerName); break;
    case "rfq_request":  handleRfq(msg); break;
    case "ping":         ws.send(JSON.stringify({ type: "pong" })); break;
  }
};`}</Code>

      <H2 id="handling-rfq">Handling an RFQ</H2>
      <Code>{`async function handleRfq(msg) {
  // msg fields: auctionId, tokenIn, tokenOut, amountIn, taker, expiresAt

  const amountOut = priceSwap(msg.tokenIn, msg.tokenOut, msg.amountIn);
  const quote     = buildQuote({ ...msg, amountOut });
  const signature = signQuote(quote);  // SHA256(XDR(quote)) + ed25519

  await fetch(\`http://localhost:4000/api/auctions/\${msg.auctionId}/bid\`, {
    method:  "POST",
    headers: { Authorization: \`Bearer \${API_KEY}\` },
    body:    JSON.stringify({ quote, signature }),
  });
}`}</Code>

      <H2 id="message-types">Message Types</H2>
      <Table
        headers={['Type', 'Direction', 'Description']}
        rows={[
          ['auth', 'Client → Server', 'Authenticate with maker API key and address'],
          ['auth_success', 'Server → Client', 'Auth accepted; includes makerName and connected maker count'],
          ['auth_error', 'Server → Client', 'Auth failed; includes error message'],
          ['rfq_request', 'Server → Client', 'New auction — tokenIn, tokenOut, amountIn, taker, auctionId, expiresAt'],
          ['auction_closed', 'Server → Client', 'Auction window closed — no more bids accepted for this auctionId'],
          ['bid_accepted', 'Server → Client', 'Your bid was received and recorded (not necessarily winning)'],
          ['ping', 'Server → Client', 'Keepalive every 30s — must respond with pong or connection drops'],
          ['pong', 'Client → Server', 'Keepalive response'],
        ]}
      />
    </>
  );
}
