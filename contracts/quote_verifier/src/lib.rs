#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, Bytes, BytesN, Env,
    xdr::ToXdr,
};

const LEDGER_THRESHOLD: u32 = 100_000;
const LEDGER_BUMP: u32 = 120_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidTokens = 4,
    QuoteExpired = 5,
    QuoteAlreadyUsed = 6,
    InvalidSigner = 7,
    InvalidSignature = 8,
}

/// Quote submitted by taker. The maker signs SHA256(XDR(quote)) off-chain.
/// Field serialization is canonical XDR (ScVal) of this exact struct.
/// Off-chain SDK must reproduce: sha256(quote.to_xdr(env)) and sign with ed25519.
#[contracttype]
#[derive(Clone)]
pub struct Quote {
    pub quote_id: BytesN<32>,
    pub maker: Address,
    pub taker: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: i128,
    pub amount_out: i128,
    pub expiry: u64,
    pub salt: BytesN<32>,
}

#[contracttype]
enum DataKey {
    Admin,
    Registry,
    FeeDistributor,
    FeeBps,
    Usdc,
    Eurc,
    UsedQuote(BytesN<32>),
    Initialized,
}

// ── Cross-contract client traits ──────────────────────────────────────────────

use soroban_sdk::contractclient;

#[contractclient(name = "RegistryClient")]
pub trait PoolRegistryTrait {
    fn get_signer_key(env: Env, maker: Address) -> BytesN<32>;
    fn is_active(env: Env, maker: Address) -> bool;
    fn get_pool_address(env: Env, maker: Address) -> Address;
}

#[contractclient(name = "MakerPoolClient")]
pub trait MakerPoolTrait {
    fn execute_swap(
        env: Env,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
        amount_out: i128,
        taker: Address,
        fee_amount: i128,
        fee_distributor: Address,
    );
}

// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct QuoteVerifier;

#[contractimpl]
impl QuoteVerifier {
    pub fn initialize(
        env: Env,
        admin: Address,
        registry: Address,
        fee_distributor: Address,
        usdc: Address,
        eurc: Address,
        fee_bps: u32,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage()
            .instance()
            .set(&DataKey::FeeDistributor, &fee_distributor);
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage().instance().set(&DataKey::Eurc, &eurc);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn execute_quote(env: Env, quote: Quote, signature: BytesN<64>) {
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(env, Error::NotInitialized);
        }
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        let eurc: Address = env.storage().instance().get(&DataKey::Eurc).unwrap();

        // Step 1 — tokens must be USDC/EURC and different
        let in_ok = quote.token_in == usdc || quote.token_in == eurc;
        let out_ok = quote.token_out == usdc || quote.token_out == eurc;
        if !in_ok || !out_ok || quote.token_in == quote.token_out {
            panic_with_error!(env, Error::InvalidTokens);
        }

        // Step 2 — not expired
        if env.ledger().timestamp() >= quote.expiry {
            panic_with_error!(env, Error::QuoteExpired);
        }

        // Step 3 — replay protection
        let used_key = DataKey::UsedQuote(quote.quote_id.clone());
        if env.storage().persistent().has(&used_key) {
            panic_with_error!(env, Error::QuoteAlreadyUsed);
        }

        // Step 4 — taker auth
        quote.taker.require_auth();

        // Step 5 — fetch maker info
        let registry: Address = env.storage().instance().get(&DataKey::Registry).unwrap();
        let registry_client = RegistryClient::new(&env, &registry);
        if !registry_client.is_active(&quote.maker) {
            panic_with_error!(env, Error::InvalidSigner);
        }
        let signer_key = registry_client.get_signer_key(&quote.maker);

        // Step 6 — canonical message hash: SHA256 of XDR-encoded Quote struct.
        let msg_bytes: Bytes = quote.clone().to_xdr(&env);
        let msg_hash = env.crypto().sha256(&msg_bytes);

        // Step 7 — ed25519 verify
        let hash_as_bytes: Bytes = msg_hash.to_bytes().into();
        env.crypto()
            .ed25519_verify(&signer_key, &hash_as_bytes, &signature);

        // Step 8 — mark quote_id as used
        env.storage().persistent().set(&used_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&used_key, LEDGER_THRESHOLD, LEDGER_BUMP);

        // Step 9 — protocol fee
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap();
        let fee_amount = (quote.amount_out * fee_bps as i128) / 10_000;
        let taker_gets = quote.amount_out - fee_amount;

        // Step 10 — get maker's specific pool address
        let pool_address = registry_client.get_pool_address(&quote.maker);

        // Step 11 — atomic swap through maker's own pool
        let fee_dist: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeDistributor)
            .unwrap();

        MakerPoolClient::new(&env, &pool_address).execute_swap(
            &quote.token_in,
            &quote.token_out,
            &quote.amount_in,
            &taker_gets,
            &quote.taker,
            &fee_amount,
            &fee_dist,
        );

        // Step 12 — emit event
        env.events().publish(
            ("quote_executed",),
            (quote.quote_id, quote.maker, quote.taker),
        );
    }

    pub fn set_fee_bps(env: Env, new_fee_bps: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::FeeBps, &new_fee_bps);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn get_protocol_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::FeeBps)
            .unwrap_or(0)
    }
}

mod tests;
