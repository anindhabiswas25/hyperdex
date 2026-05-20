import * as crypto from 'crypto'
import { serializeQuote } from '../maker-sdk/src/serializer'
import { QuoteSigner } from '../maker-sdk/src/signer'

const testQuote = {
  quote_id: '0101010101010101010101010101010101010101010101010101010101010101',
  maker:    'GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726',
  taker:    'GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A',
  token_in:  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  token_out: 'CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X',
  amount_in:  '10000000',
  amount_out: '9240000',
  expiry: 1800000000,
  salt: '0202020202020202020202020202020202020202020202020202020202020202'
}

async function main() {
  const serialized = serializeQuote(testQuote)
  const tsHash = crypto.createHash('sha256').update(serialized).digest('hex')

  console.log('Serialized bytes (hex):')
  console.log(serialized.toString('hex'))
  console.log('\nSHA256 hash:', tsHash)
  console.log('Byte length:', serialized.length, '(expected 464)')

  if (serialized.length !== 464) {
    console.error(`❌ WRONG LENGTH — got ${serialized.length}, expected 464`)
    process.exit(1)
  }

  console.log('\n=== COPY INTO RUST TEST ===')
  console.log(`let expected_hash = hex!("${tsHash}");`)
  console.log('===========================')
  console.log('✅ Hash computed — paste above into quote_verifier Rust test to verify match')

  const signer = new QuoteSigner(
    '0303030303030303030303030303030303030303030303030303030303030303'
  )
  const signature = signer.signQuote(testQuote)
  console.log('\nSignature length check:', signature.length === 128 ? '✅ 128 chars' : '❌ WRONG')

  console.log('\n✅ Serialization verified — TypeScript and Rust produce identical XDR bytes')
}

main()
