#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, BytesN, Env, Vec,
};

use soroban_sdk::contractclient;

const LEDGER_THRESHOLD: u32 = 1_000_000;
const LEDGER_BUMP: u32 = 1_500_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    PoolAlreadyDeployed = 3,
}

// Cross-contract client for MakerPool
#[contractclient(name = "MakerPoolClient")]
pub trait MakerPoolTrait {
    fn initialize(
        env: Env,
        owner: Address,
        signer_key: BytesN<32>,
        quote_verifier: Address,
        usdc: Address,
        eurc: Address,
    );
}

// Cross-contract client for PoolRegistry
#[contractclient(name = "PoolRegistryClient")]
pub trait PoolRegistryTrait {
    fn register_maker(
        env: Env,
        maker: Address,
        signer_key: BytesN<32>,
        pool_address: Address,
        pairs: Vec<(Address, Address)>,
    );
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    PoolRegistry,
    QuoteVerifier,
    FeeDistributor,
    Usdc,
    Eurc,
    PoolWasm,
    MakerPool(Address),
    Initialized,
}

#[contract]
pub struct MakerPoolFactory;

fn check_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Initialized) {
        panic_with_error!(env, Error::NotInitialized);
    }
}

#[contractimpl]
impl MakerPoolFactory {
    pub fn initialize(
        env: Env,
        admin: Address,
        pool_registry: Address,
        quote_verifier: Address,
        fee_distributor: Address,
        usdc: Address,
        eurc: Address,
        pool_wasm_hash: BytesN<32>,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PoolRegistry, &pool_registry);
        env.storage()
            .instance()
            .set(&DataKey::QuoteVerifier, &quote_verifier);
        env.storage()
            .instance()
            .set(&DataKey::FeeDistributor, &fee_distributor);
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage().instance().set(&DataKey::Eurc, &eurc);
        env.storage()
            .instance()
            .set(&DataKey::PoolWasm, &pool_wasm_hash);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn deploy_pool(
        env: Env,
        maker: Address,
        signer_key: BytesN<32>,
        supported_pairs: Vec<(Address, Address)>,
    ) -> Address {
        maker.require_auth();
        check_initialized(&env);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);

        // Ensure no duplicate pool
        let pool_key = DataKey::MakerPool(maker.clone());
        if env.storage().persistent().has(&pool_key) {
            panic_with_error!(env, Error::PoolAlreadyDeployed);
        }

        let pool_wasm: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::PoolWasm)
            .unwrap();

        // Salt is deterministic: hash of maker address XDR only.
        // Each maker deploys exactly one pool, so this uniquely identifies it.
        // Using ledger sequence would make the simulation-time address differ
        // from execution-time address, causing a footprint mismatch and a trap.
        use soroban_sdk::xdr::ToXdr;
        let maker_xdr = maker.clone().to_xdr(&env);
        let salt_bytes = env.crypto().sha256(&maker_xdr);

        // Deploy new MakerPool instance
        let pool_address = env
            .deployer()
            .with_current_contract(salt_bytes)
            .deploy_v2(pool_wasm, ());

        let quote_verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::QuoteVerifier)
            .unwrap();
        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        let eurc: Address = env.storage().instance().get(&DataKey::Eurc).unwrap();
        let pool_registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::PoolRegistry)
            .unwrap();

        // Initialize the pool (atomic within this same transaction — deploy_v2
        // and this call happen in one host invocation, so there's no window
        // for another transaction to race the pool's own initialize).
        MakerPoolClient::new(&env, &pool_address).initialize(
            &maker,
            &signer_key,
            &quote_verifier,
            &usdc,
            &eurc,
        );

        // Register in pool_registry
        PoolRegistryClient::new(&env, &pool_registry).register_maker(
            &maker,
            &signer_key,
            &pool_address,
            &supported_pairs,
        );

        // Store maker→pool mapping
        env.storage().persistent().set(&pool_key, &pool_address);
        env.storage()
            .persistent()
            .extend_ttl(&pool_key, LEDGER_THRESHOLD, LEDGER_BUMP);

        env.events()
            .publish(("pool_deployed",), (maker, pool_address.clone()));

        pool_address
    }

    pub fn get_pool(env: Env, maker: Address) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::MakerPool(maker))
    }
}
