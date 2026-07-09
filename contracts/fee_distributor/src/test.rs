#![cfg(test)]

use crate::{Error, FeeDistributor, FeeDistributorClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

struct Ctx {
    env: Env,
    fd: Address,
    treasury: Address,
    token: Address,
}

fn setup() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let fd = env.register(FeeDistributor, ());
    FeeDistributorClient::new(&env, &fd).initialize(&admin, &treasury);

    Ctx { env, fd, treasury, token }
}

fn fd<'a>(c: &'a Ctx) -> FeeDistributorClient<'a> {
    FeeDistributorClient::new(&c.env, &c.fd)
}

/// Fees arrive as a direct token transfer into the distributor; withdraw_fees
/// sweeps the whole real balance to the treasury and leaves nothing behind.
#[test]
fn sweep_to_treasury() {
    let c = setup();
    token::StellarAssetClient::new(&c.env, &c.token).mint(&c.fd, &5_000);
    assert_eq!(fd(&c).get_fees(&c.token), 5_000);

    fd(&c).withdraw_fees(&c.token);

    let tok = token::Client::new(&c.env, &c.token);
    assert_eq!(tok.balance(&c.treasury), 5_000);
    assert_eq!(tok.balance(&c.fd), 0);
    assert_eq!(fd(&c).get_fees(&c.token), 0);
}

/// A non-whitelisted token that happens to sit in the contract can still be
/// swept — nothing gets stuck.
#[test]
fn sweeps_arbitrary_token() {
    let c = setup();
    let other = env_token(&c.env);
    token::StellarAssetClient::new(&c.env, &other).mint(&c.fd, &777);
    fd(&c).withdraw_fees(&other);
    assert_eq!(token::Client::new(&c.env, &other).balance(&c.treasury), 777);
}

#[test]
fn no_fees_to_withdraw() {
    let c = setup();
    let res = fd(&c).try_withdraw_fees(&c.token);
    assert_eq!(res, Err(Ok(Error::NoFeesToWithdraw.into())));
}

/// withdraw_fees must not run without the admin's authorization. With real auth
/// enforced and nothing authorized, the call is rejected (funds don't move).
#[test]
fn withdraw_requires_authorization() {
    let c = setup();
    token::StellarAssetClient::new(&c.env, &c.token).mint(&c.fd, &1_000);
    c.env.mock_auths(&[]);
    let res = fd(&c).try_withdraw_fees(&c.token);
    assert!(res.is_err(), "withdraw_fees must require the admin's authorization");
    // Balance untouched.
    c.env.mock_all_auths();
    assert_eq!(fd(&c).get_fees(&c.token), 1_000);
}

fn env_token(env: &Env) -> Address {
    let a = Address::generate(env);
    env.register_stellar_asset_contract_v2(a).address()
}
