// Off-chain ed25519 verification of maker quotes.
//
// This MUST reproduce exactly what quote_verifier/src/lib.rs verifies on-chain
// and what maker-sdk/src/serializer.ts produces when signing:
//
//   message  = XDR(ScMap of the Quote struct, keys in alphabetical order)
//   digest   = sha256(message)
//   valid    = ed25519_verify(signer_key, digest, signature)
//
// Field order (Soroban #[contracttype] emits struct fields sorted by symbol):
//   amount_in | amount_out | expiry | maker | quote_id | salt | taker | token_in | token_out
//
// Any divergence from the SDK serializer would reject every honest bid, so keep
// these two files identical field-for-field.

import { xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { createHash } from 'crypto';
import nacl from 'tweetnacl';

export interface VerifiableQuote {
  quoteId: string;
  makerAddress: string;
  takerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expiryTimestamp: number;
  salt: string;
}

function buildQuoteScVal(q: VerifiableQuote): xdr.ScVal {
  const entry = (key: string, val: xdr.ScVal): xdr.ScMapEntry =>
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });

  return xdr.ScVal.scvMap([
    entry('amount_in', nativeToScVal(BigInt(q.amountIn), { type: 'i128' })),
    entry('amount_out', nativeToScVal(BigInt(q.amountOut), { type: 'i128' })),
    entry('expiry', nativeToScVal(BigInt(q.expiryTimestamp), { type: 'u64' })),
    entry('maker', nativeToScVal(q.makerAddress, { type: 'address' })),
    entry('quote_id', xdr.ScVal.scvBytes(Buffer.from(q.quoteId, 'hex'))),
    entry('salt', xdr.ScVal.scvBytes(Buffer.from(q.salt, 'hex'))),
    entry('taker', nativeToScVal(q.takerAddress, { type: 'address' })),
    entry('token_in', nativeToScVal(q.tokenIn, { type: 'address' })),
    entry('token_out', nativeToScVal(q.tokenOut, { type: 'address' })),
  ]);
}

export function hashQuote(q: VerifiableQuote): Buffer {
  const xdrBytes = buildQuoteScVal(q).toXDR();
  return createHash('sha256').update(xdrBytes).digest();
}

/**
 * Returns true only if `signatureHex` is a valid ed25519 signature by
 * `signerKeyHex` over sha256(XDR(quote)). Never throws — malformed inputs
 * (wrong lengths, bad hex, unencodable addresses) return false.
 */
export function verifyQuoteSignature(
  quote: VerifiableQuote,
  signatureHex: string,
  signerKeyHex: string,
): boolean {
  try {
    const signature = Buffer.from(signatureHex, 'hex');
    const signerKey = Buffer.from(signerKeyHex, 'hex');
    if (signature.length !== 64 || signerKey.length !== 32) return false;

    const digest = hashQuote(quote);
    return nacl.sign.detached.verify(
      new Uint8Array(digest),
      new Uint8Array(signature),
      new Uint8Array(signerKey),
    );
  } catch {
    return false;
  }
}
