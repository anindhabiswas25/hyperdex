#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    token, Address, Env,
};

const LEDGER_THRESHOLD: u32 = 1_000_000;
const LEDGER_BUMP: u32 = 1_500_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NoFeesToWithdraw = 3,
}

#[contracttype]
enum DataKey {
    Admin,
    Treasury,
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
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
    }

    /// Fee tokens arrive here via a direct token::transfer from maker_pool
    /// during execute_swap — this contract just holds them. Sweeps the
    /// contract's actual token balance to treasury (no separate internal
    /// ledger to keep in sync with real balances).
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

        let contract_address = env.current_contract_address();
        let amount = token::Client::new(&env, &token).balance(&contract_address);
        if amount == 0 {
            panic_with_error!(env, Error::NoFeesToWithdraw);
        }
        token::Client::new(&env, &token).transfer(&contract_address, &treasury, &amount);

        env.events().publish(("fees_withdrawn",), (token, amount));
    }

    pub fn get_fees(env: Env, token: Address) -> i128 {
        token::Client::new(&env, &token).balance(&env.current_contract_address())
    }
}

#[cfg(test)]
mod test;
