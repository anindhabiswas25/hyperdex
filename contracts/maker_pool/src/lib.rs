#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    token, Address, BytesN, Env,
};

const LEDGER_THRESHOLD: u32 = 1_000_000;
const LEDGER_BUMP: u32 = 1_500_000;

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InvalidToken = 5,
    InvalidAmount = 6,
    ZeroAmount = 7,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    SignerKey,
    QuoteVerifier,
    Usdc,
    Eurc,
    Balance(Address),
    Initialized,
}

#[contract]
pub struct MakerPool;

fn get_owner(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::Owner).unwrap()
}

fn get_quote_verifier(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::QuoteVerifier).unwrap()
}

fn get_usdc(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::Usdc).unwrap()
}

fn get_eurc(env: &Env) -> Address {
    env.storage().persistent().get(&DataKey::Eurc).unwrap()
}

fn get_balance_internal(env: &Env, token: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(token.clone()))
        .unwrap_or(0)
}

fn set_balance_internal(env: &Env, token: &Address, amount: i128) {
    let key = DataKey::Balance(token.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
}

fn check_initialized(env: &Env) {
    if !env
        .storage()
        .persistent()
        .get::<_, bool>(&DataKey::Initialized)
        .unwrap_or(false)
    {
        panic_with_error!(env, Error::NotInitialized);
    }
}

fn check_valid_token(env: &Env, token: &Address) {
    let usdc = get_usdc(env);
    let eurc = get_eurc(env);
    if token != &usdc && token != &eurc {
        panic_with_error!(env, Error::InvalidToken);
    }
}

#[contractimpl]
impl MakerPool {
    pub fn initialize(
        env: Env,
        owner: Address,
        signer_key: BytesN<32>,
        quote_verifier: Address,
        usdc: Address,
        eurc: Address,
    ) {
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Initialized)
            .unwrap_or(false)
        {
            panic_with_error!(env, Error::AlreadyInitialized);
        }

        env.storage().persistent().set(&DataKey::Owner, &owner);
        env.storage()
            .persistent()
            .set(&DataKey::SignerKey, &signer_key);
        env.storage()
            .persistent()
            .set(&DataKey::QuoteVerifier, &quote_verifier);
        env.storage().persistent().set(&DataKey::Usdc, &usdc);
        env.storage().persistent().set(&DataKey::Eurc, &eurc);
        env.storage()
            .persistent()
            .set(&DataKey::Initialized, &true);

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Initialized, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Owner, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::SignerKey, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::QuoteVerifier, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Usdc, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Eurc, LEDGER_THRESHOLD, LEDGER_BUMP);

        env.events().publish(("pool_initialized",), owner);
    }

    pub fn deposit(env: Env, maker: Address, token: Address, amount: i128) {
        maker.require_auth();

        check_initialized(&env);
        let owner = get_owner(&env);
        if maker != owner {
            panic_with_error!(env, Error::Unauthorized);
        }

        // Bump core storage so it doesn't expire between deposits
        env.storage().persistent().extend_ttl(&DataKey::Owner, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage().persistent().extend_ttl(&DataKey::Usdc, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage().persistent().extend_ttl(&DataKey::Eurc, LEDGER_THRESHOLD, LEDGER_BUMP);

        if amount <= 0 {
            panic_with_error!(env, Error::ZeroAmount);
        }
        check_valid_token(&env, &token);

        // maker signs this TX — transfer directly from maker to this pool contract
        // No prior approve needed: maker is the FROM address and they authorized this TX
        token::Client::new(&env, &token).transfer(
            &maker,
            &env.current_contract_address(),
            &amount,
        );

        let current = get_balance_internal(&env, &token);
        set_balance_internal(&env, &token, current + amount);

        env.events()
            .publish(("deposit",), (maker, token, amount));
    }

    pub fn withdraw(env: Env, maker: Address, token: Address, amount: i128) {
        maker.require_auth();

        check_initialized(&env);
        let owner = get_owner(&env);
        if maker != owner {
            panic_with_error!(env, Error::Unauthorized);
        }

        env.storage().persistent().extend_ttl(&DataKey::Owner, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage().persistent().extend_ttl(&DataKey::Usdc, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.storage().persistent().extend_ttl(&DataKey::Eurc, LEDGER_THRESHOLD, LEDGER_BUMP);

        if amount <= 0 {
            panic_with_error!(env, Error::ZeroAmount);
        }
        check_valid_token(&env, &token);

        let current = get_balance_internal(&env, &token);
        if current < amount {
            panic_with_error!(env, Error::InsufficientBalance);
        }

        set_balance_internal(&env, &token, current - amount);
        token::Client::new(&env, &token).transfer(&env.current_contract_address(), &maker, &amount);

        env.events()
            .publish(("withdraw",), (maker, token, amount));
    }

    pub fn execute_swap(
        env: Env,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
        amount_out: i128,
        taker: Address,
        fee_amount: i128,
        fee_distributor: Address,
    ) {
        // Only quote_verifier can call this
        let verifier = get_quote_verifier(&env);
        verifier.require_auth();

        check_initialized(&env);
        check_valid_token(&env, &token_in);
        check_valid_token(&env, &token_out);

        if amount_in <= 0 || amount_out <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }

        let out_balance = get_balance_internal(&env, &token_out);
        if out_balance < amount_out + fee_amount {
            panic_with_error!(env, Error::InsufficientBalance);
        }

        // Pull token_in from taker into this contract
        token::Client::new(&env, &token_in).transfer(
            &taker,
            &env.current_contract_address(),
            &amount_in,
        );
        let in_balance = get_balance_internal(&env, &token_in);
        set_balance_internal(&env, &token_in, in_balance + amount_in);

        // Send token_out to taker
        token::Client::new(&env, &token_out).transfer(
            &env.current_contract_address(),
            &taker,
            &amount_out,
        );

        // Send fee to fee_distributor
        if fee_amount > 0 {
            token::Client::new(&env, &token_out).transfer(
                &env.current_contract_address(),
                &fee_distributor,
                &fee_amount,
            );
        }

        set_balance_internal(&env, &token_out, out_balance - amount_out - fee_amount);

        env.events().publish(
            ("swap_executed",),
            (token_in, token_out, amount_in, amount_out),
        );
    }

    pub fn get_balance(env: Env, token: Address) -> i128 {
        get_balance_internal(&env, &token)
    }

    pub fn get_owner(env: Env) -> Address {
        get_owner(&env)
    }

    pub fn get_signer_key(env: Env) -> BytesN<32> {
        env.storage()
            .persistent()
            .get(&DataKey::SignerKey)
            .unwrap()
    }

    pub fn update_signer_key(env: Env, new_signer_key: BytesN<32>) {
        check_initialized(&env);
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::SignerKey, &new_signer_key);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::SignerKey, LEDGER_THRESHOLD, LEDGER_BUMP);
        env.events()
            .publish(("signer_key_updated",), (owner, new_signer_key));
    }
}

#[cfg(test)]
mod test;
