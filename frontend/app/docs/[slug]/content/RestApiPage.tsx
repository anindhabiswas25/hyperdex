import { H1, P, Mono } from '@/components/docs/DocsPrimitives';

export default function RestApiPage() {
  const endpoints = [
    { method:'GET',  path:'/health',                  auth:'—',          desc:'System health. Returns active maker count and DB status.',      body:'', response:'{ "status":"ok", "activeMakers":1, "dbStatus":"connected" }' },
    { method:'POST', path:'/api/auctions/start',       auth:'—',          desc:'Opens a 30-second sealed-bid auction for a swap.',              body:'{ "tokenIn":"EURC_SAC", "tokenOut":"USDC_SAC", "amountIn":200000000, "taker":"GABIR…" }', response:'{ "auctionId":"uuid", "expiresAt":1716000030 }' },
    { method:'GET',  path:'/api/auctions/:id/result',  auth:'—',          desc:'Returns the winning quote once the auction window closes.',      body:'', response:'{ "bestQuote":{...}, "quotesReceived":2, "makerName":"Alpha MM" }' },
    { method:'POST', path:'/api/auctions/:id/bid',     auth:'Maker API key',  desc:'Submit a sealed bid for an active auction.',                 body:'{ "quote":{...}, "signature":"hex" }', response:'{ "accepted":true }' },
    { method:'POST', path:'/api/makers/apply',         auth:'—',          desc:'Submit a maker registration application.',                       body:'{ "address":"G…", "name":"My MM", "signerPublicKey":"hex", "webhookUrl":"http://…" }', response:'{ "applicationId":"uuid", "status":"pending" }' },
    { method:'GET',  path:'/api/admin/pending',        auth:'Admin wallet', desc:'Lists all pending maker applications.',                        body:'', response:'{ "applications":[...], "total":1 }' },
    { method:'POST', path:'/api/admin/approve/:id',    auth:'Admin wallet', desc:'Approves an application and returns an API key.',              body:'', response:'{ "apiKey":"sk_live_xxx" }' },
    { method:'POST', path:'/api/admin/reject/:id',     auth:'Admin wallet', desc:'Rejects a maker application.',                                body:'{ "reason":"Insufficient inventory" }', response:'{ "status":"rejected" }' },
  ];

  return (
    <>
      <H1 tag="API Reference">REST Endpoints</H1>
      <P>The backend exposes a REST API at <Mono>http://localhost:4000</Mono>. Maker endpoints require an <Mono>Authorization: Bearer sk_live_xxx</Mono> header.</P>

      {endpoints.map(ep => (
        <div key={ep.path + ep.method} className="border border-black/10 rounded-2xl overflow-hidden mb-4">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-cream-dark border-b border-black/8">
            <span className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-lg ${ep.method==='GET'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{ep.method}</span>
            <code className="font-mono text-sm text-ink font-semibold">{ep.path}</code>
            {ep.auth !== '—' && <span className="ml-auto text-[11px] text-ink-muted bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{ep.auth}</span>}
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-ink-muted mb-3">{ep.desc}</p>
            {ep.body && <><p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Request Body</p><pre className="text-xs font-mono text-ink-muted bg-cream rounded-xl px-3 py-2 mb-3 overflow-x-auto">{ep.body}</pre></>}
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Response</p>
            <pre className="text-xs font-mono text-ink-muted bg-cream rounded-xl px-3 py-2 overflow-x-auto">{ep.response}</pre>
          </div>
        </div>
      ))}
    </>
  );
}
