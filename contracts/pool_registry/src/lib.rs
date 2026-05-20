#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, BytesN, Env, Vec,
};

const LEDGER_THRESHOLD: u32 = 100_000;
const LEDGER_BUMP: u32 = 120_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Error {
    NotFound = 1,
    Unauthorized = 2,
    AlreadyRegistered = 3,
}

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
enum DataKey {
    Admin,
    Factory,
    Maker(Address),
}

#[contract]
pub struct PoolRegistry;

#[contractimpl]
impl PoolRegistry {
    pub fn initialize(env: Env, admin: Address, factory: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Factory, &factory);
    }

    pub fn register_maker(
        env: Env,
        maker: Address,
        signer_key: BytesN<32>,
        pool_address: Address,
        pairs: Vec<(Address, Address)>,
    ) {
        // Called by factory on behalf of maker during deploy_pool
        // Factory requires auth from maker before calling this
        let factory: Address = env
            .storage()
            .instance()
            .get(&DataKey::Factory)
            .unwrap_or(maker.clone());

        // Accept auth from either maker directly or factory
        factory.require_auth();

        let key = DataKey::Maker(maker.clone());
        let info = MakerInfo {
            maker: maker.clone(),
            signer_key,
            pool_address,
            supported_pairs: pairs,
            active: true,
        };
        env.storage().persistent().set(&key, &info);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.events().publish(("maker_registered",), maker);
    }

    pub fn update_signer(env: Env, maker: Address, new_signer_key: BytesN<32>) {
        maker.require_auth();
        let key = DataKey::Maker(maker.clone());
        let mut info: MakerInfo = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotFound));
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        info.signer_key = new_signer_key;
        env.storage().persistent().set(&key, &info);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn set_maker_active(env: Env, maker: Address, active: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let key = DataKey::Maker(maker.clone());
        let mut info: MakerInfo = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotFound));
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        info.active = active;
        env.storage().persistent().set(&key, &info);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn get_maker(env: Env, maker: Address) -> MakerInfo {
        let key = DataKey::Maker(maker.clone());
        let info: MakerInfo = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotFound));
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        info
    }

    pub fn get_pool_address(env: Env, maker: Address) -> Address {
        let key = DataKey::Maker(maker.clone());
        let info: MakerInfo = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotFound));
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        info.pool_address
    }

    pub fn get_signer_key(env: Env, maker: Address) -> BytesN<32> {
        let key = DataKey::Maker(maker.clone());
        let info: MakerInfo = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotFound));
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        info.signer_key
    }

    pub fn is_active(env: Env, maker: Address) -> bool {
        let key = DataKey::Maker(maker.clone());
        match env.storage().persistent().get::<_, MakerInfo>(&key) {
            Some(info) => {
                env.storage()
                    .persistent()
                    .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
                info.active
            }
            None => false,
        }
    }

    pub fn is_valid_signer(env: Env, maker: Address, signer_key: BytesN<32>) -> bool {
        let key = DataKey::Maker(maker.clone());
        let info: Option<MakerInfo> = env.storage().persistent().get(&key);
        match info {
            Some(i) => {
                env.storage()
                    .persistent()
                    .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
                i.active && i.signer_key == signer_key
            }
            None => false,
        }
    }
}
