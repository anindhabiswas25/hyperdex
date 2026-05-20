#[cfg(test)]
mod serialization_tests {
    extern crate std;
    use std::{format, vec::Vec};

    use soroban_sdk::{Address, BytesN, Env, xdr::ToXdr};
    use crate::Quote;

    fn make_bytes32(b: u8) -> [u8; 32] {
        [b; 32]
    }

    fn test_quote(env: &Env) -> Quote {
        Quote {
            quote_id: BytesN::from_array(env, &make_bytes32(0x01)),
            maker:    Address::from_str(env, "GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726"),
            taker:    Address::from_str(env, "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"),
            token_in:  Address::from_str(env, "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"),
            token_out: Address::from_str(env, "CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X"),
            amount_in:  10_000_000,
            amount_out:  9_240_000,
            expiry: 1_800_000_000,
            salt: BytesN::from_array(env, &make_bytes32(0x02)),
        }
    }

    #[test]
    fn test_quote_xdr_order_and_length() {
        let env = Env::default();
        let xdr_bytes = test_quote(&env).to_xdr(&env);
        let len = xdr_bytes.len();

        let raw: Vec<u8> = xdr_bytes.iter().collect();
        let hex: std::string::String = raw.iter().map(|b| format!("{:02x}", b)).collect();

        let hash = env.crypto().sha256(&xdr_bytes);
        let hash_hex: std::string::String = hash.to_array().iter().map(|b| format!("{:02x}", b)).collect();

        std::eprintln!("XDR length: {}", len);
        std::eprintln!("XDR hex: {}", hex);
        std::eprintln!("SHA256: {}", hash_hex);

        assert_eq!(len, 464, "XDR length should be 464 bytes");
    }

    #[test]
    fn test_quote_hash_matches_typescript() {
        let env = Env::default();
        let xdr_bytes = test_quote(&env).to_xdr(&env);
        let hash = env.crypto().sha256(&xdr_bytes);
        let hash_arr = hash.to_array();
        let hash_hex: std::string::String = hash_arr.iter().map(|b| format!("{:02x}", b)).collect();

        // This hash was verified to match the TypeScript serializer output in
        // maker-sdk/src/serializer.ts (alphabetical field order, ScvMap XDR encoding).
        let expected = "ff65f4b0ee5af00d0c3faa902e50be2d1db3ecc4ce5ae963a1d3c0d229822584";
        assert_eq!(hash_hex, expected, "Rust and TypeScript must produce the same SHA256 hash");
    }
}
