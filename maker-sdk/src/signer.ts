import nacl from 'tweetnacl';
import { hashQuote } from './serializer';
import { Quote } from './types';

export class QuoteSigner {
  private keypair: nacl.SignKeyPair;

  constructor(privateKeyHex: string) {
    // Accept 32-byte seed or 64-byte full keypair
    const keyBytes = Buffer.from(privateKeyHex, 'hex');
    if (keyBytes.length === 32) {
      this.keypair = nacl.sign.keyPair.fromSeed(keyBytes);
    } else if (keyBytes.length === 64) {
      this.keypair = nacl.sign.keyPair.fromSecretKey(keyBytes);
    } else {
      throw new Error('Private key must be 32 or 64 bytes (hex encoded)');
    }
  }

  getPublicKey(): string {
    return Buffer.from(this.keypair.publicKey).toString('hex');
  }

  signQuote(quote: Quote): string {
    const msgHash = hashQuote(quote);
    const sig = nacl.sign.detached(msgHash, this.keypair.secretKey);
    const signatureHex = Buffer.from(sig).toString('hex');

    if (signatureHex.length !== 128) {
      throw new Error(
        `Invalid signature length: expected 128 hex chars, got ${signatureHex.length}`
      )
    }
    if (!/^[0-9a-f]{128}$/.test(signatureHex)) {
      throw new Error('Signature contains non-hex characters')
    }
    const pubKeyHex = this.getPublicKey()
    if (pubKeyHex.length !== 64) {
      throw new Error(
        `Invalid public key length: expected 64 hex chars, got ${pubKeyHex.length}`
      )
    }

    return signatureHex;
  }
}
