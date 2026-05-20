// Quote serialization for signature verification.
//
// The on-chain contract uses XDR ScVal encoding of the Quote struct.
// The contract calls: sha256(XDR(quote_struct_as_ScVal))
// The maker must sign: ed25519_sign(sha256(XDR(quote_struct_as_ScVal)))
//
// Since replicating the exact Soroban XDR ScVal encoding in Node.js requires
// @stellar/stellar-sdk, we use that library directly.
//
// Field order (Soroban contracttype canonical XDR map order):
//   quote_id | maker | taker | token_in | token_out | amount_in | amount_out | expiry | salt

import { xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { sha256 } from 'js-sha256';
import { Quote } from './types';

function buildQuoteScVal(quote: Quote): xdr.ScVal {
  const entry = (key: string, val: xdr.ScVal): xdr.ScMapEntry =>
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });

  // Soroban #[contracttype] serializes struct fields in alphabetical order.
  return xdr.ScVal.scvMap([
    entry('amount_in',  nativeToScVal(BigInt(quote.amount_in),  { type: 'i128' })),
    entry('amount_out', nativeToScVal(BigInt(quote.amount_out), { type: 'i128' })),
    entry('expiry',     nativeToScVal(BigInt(quote.expiry),     { type: 'u64' })),
    entry('maker',      nativeToScVal(quote.maker,              { type: 'address' })),
    entry('quote_id',   xdr.ScVal.scvBytes(Buffer.from(quote.quote_id, 'hex'))),
    entry('salt',       xdr.ScVal.scvBytes(Buffer.from(quote.salt,     'hex'))),
    entry('taker',      nativeToScVal(quote.taker,              { type: 'address' })),
    entry('token_in',   nativeToScVal(quote.token_in,           { type: 'address' })),
    entry('token_out',  nativeToScVal(quote.token_out,          { type: 'address' })),
  ]);
}

export function serializeQuote(quote: Quote): Buffer {
  const scVal = buildQuoteScVal(quote);
  return scVal.toXDR();
}

export function hashQuote(quote: Quote): Buffer {
  const xdrBytes = serializeQuote(quote);
  return Buffer.from(sha256.arrayBuffer(xdrBytes));
}
