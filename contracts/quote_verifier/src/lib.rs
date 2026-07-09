#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, Bytes, BytesN, Env, Vec,
    xdr::ToXdr,
};

const LEDGER_THRESHOLD: u32 = 1_000_000;
const LEDGER_BUMP: u32 = 1_500_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidTokens = 4,
    QuoteExpired = 5,
    QuoteAlreadyUsed = 6,
    InvalidSigner = 7,
    InvalidSignature = 8,
    InvalidFee = 9,
}

/// Fee is expressed in basis points; 10_000 bps = 100%. A fee above this would
/// make taker_gets negative and brick every swap, so it's rejected at the source.
const MAX_FEE_BPS: u32 = 10_000;

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

/// Mirrors pool_registry::MakerInfo. Soroban cross-contract calls match
/// contracttype values structurally, so each contract keeps its own copy —
/// there's no shared crate between workspace members.
#[contracttype]
#[derive(Clone)]
pub struct MakerInfo {
    pub maker: Address,
    pub signer_key: BytesN<32>,
    pub pool_address: Address,
    pub supported_pairs: Vec<(Address, Address)>,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
struct Config {
    admin: Address,
    registry: Address,
    fee_distributor: Address,
    usdc: Address,
    eurc: Address,
    fee_bps: u32,
}

#[contracttype]
enum DataKey {
    Config,
    UsedQuote(BytesN<32>),
    Initialized,
}

// ── Cross-contract client traits ──────────────────────────────────────────────

use soroban_sdk::contractclient;

#[contractclient(name = "RegistryClient")]
pub trait PoolRegistryTrait {
    fn get_maker(env: Env, maker: Address) -> MakerInfo;
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
        admin.require_auth();

        if fee_bps > MAX_FEE_BPS {
            panic_with_error!(env, Error::InvalidFee);
        }

        let config = Config {
            admin,
            registry,
            fee_distributor,
            usdc,
            eurc,
            fee_bps,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Initialized, &true);
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

        let config: Config = env.storage().instance().get(&DataKey::Config).unwrap();

        // Step 1 — tokens must be USDC/EURC and different
        let in_ok = quote.token_in == config.usdc || quote.token_in == config.eurc;
        let out_ok = quote.token_out == config.usdc || quote.token_out == config.eurc;
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

        // Step 5 — fetch maker info: a single cross-contract read instead of
        // three (is_active + get_signer_key + get_pool_address).
        let registry_client = RegistryClient::new(&env, &config.registry);
        let maker_info = registry_client.get_maker(&quote.maker);
        if !maker_info.active {
            panic_with_error!(env, Error::InvalidSigner);
        }

        // Step 6 — canonical message hash: SHA256 of XDR-encoded Quote struct.
        let msg_bytes: Bytes = quote.clone().to_xdr(&env);
        let msg_hash = env.crypto().sha256(&msg_bytes);

        // Step 7 — ed25519 verify
        let hash_as_bytes: Bytes = msg_hash.to_bytes().into();
        env.crypto()
            .ed25519_verify(&maker_info.signer_key, &hash_as_bytes, &signature);

        // Step 8 — mark quote_id as used
        env.storage().persistent().set(&used_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&used_key, LEDGER_THRESHOLD, LEDGER_BUMP);

        // Step 9 — protocol fee
        let fee_amount = (quote.amount_out * config.fee_bps as i128) / 10_000;
        let taker_gets = quote.amount_out - fee_amount;

        // Step 10 — atomic swap through maker's own pool
        MakerPoolClient::new(&env, &maker_info.pool_address).execute_swap(
            &quote.token_in,
            &quote.token_out,
            &quote.amount_in,
            &taker_gets,
            &quote.taker,
            &fee_amount,
            &config.fee_distributor,
        );

        // Step 11 — emit event
        env.events().publish(
            ("quote_executed",),
            (quote.quote_id, quote.maker, quote.taker),
        );
    }

    pub fn set_fee_bps(env: Env, new_fee_bps: u32) {
        let mut config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        config.admin.require_auth();
        if new_fee_bps > MAX_FEE_BPS {
            panic_with_error!(env, Error::InvalidFee);
        }
        config.fee_bps = new_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn get_protocol_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get::<_, Config>(&DataKey::Config)
            .map(|c| c.fee_bps)
            .unwrap_or(0)
    }
}

mod tests;
