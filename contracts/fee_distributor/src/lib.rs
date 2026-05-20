#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    token, Address, Env,
};

const LEDGER_THRESHOLD: u32 = 100_000;
const LEDGER_BUMP: u32 = 120_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NoFeesToWithdraw = 4,
}

#[contracttype]
enum DataKey {
    Admin,
    Treasury,
    QuoteVerifier,
    Fees(Address),
    Initialized,
}

#[contract]
pub struct FeeDistributor;

#[contractimpl]
impl FeeDistributor {
    pub fn initialize(env: Env, admin: Address, treasury: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn set_quote_verifier(env: Env, quote_verifier: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::QuoteVerifier, &quote_verifier);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn collect_fee(env: Env, token: Address, amount: i128) {
        // Only the registered quote_verifier may call this.
        let qv: Address = env
            .storage()
            .instance()
            .get(&DataKey::QuoteVerifier)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
        qv.require_auth();
        let key = DataKey::Fees(token);
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&key, &(current + amount));
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    pub fn withdraw_fees(env: Env, token: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        admin.require_auth();
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
        let treasury: Address = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap();
        let key = DataKey::Fees(token.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount == 0 {
            panic_with_error!(env, Error::NoFeesToWithdraw);
        }
        env.storage().persistent().set(&key, &0i128);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &treasury,
            &amount,
        );
    }

    pub fn get_fees(env: Env, token: Address) -> i128 {
        let key = DataKey::Fees(token);
        let amt: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        amt
    }
}
