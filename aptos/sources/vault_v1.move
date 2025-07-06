module tradingflow_vault::vault {
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, Metadata, FungibleAsset};
    use aptos_framework::object::{Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::table::{Self, Table};
    use aptos_framework::timestamp;
    use aptos_std::simple_map::{Self, SimpleMap};
    
    use hyperion::router_v3;
    
    /// Error code: Admin only operation
    const ENOT_ADMIN: u64 = 1003;
    
    /// Error code: Vault-owner only operation
    const ENOT_VAULT_OWNER: u64 = 1004;
    
    /// Error code: Insufficient balance
    const EINSUFFICIENT_BALANCE: u64 = 1005;

    /// Error code: Below minimum amount
    const EBELOW_MIN_AMOUNT: u64 = 1006;

    /// Balance manager creation event
    #[event]
    struct BalanceManagerCreatedEvent has drop, store {
        user: address,
        timestamp_microseconds: u64,
    }

    /// User deposit event
    #[event]
    struct UserDepositEvent has drop, store {
        user: address,
        asset_metadata: Object<Metadata>,
        amount: u64,
        timestamp_microseconds: u64,
    }
    
    /// User withdrawal event
    #[event]
    struct UserWithdrawEvent has drop, store {
        user: address,
        asset_metadata: Object<Metadata>,
        amount: u64,
        timestamp_microseconds: u64,
    }
    
    /// Trade signal event
    #[event]
    struct TradeSignalEvent has drop, store {
        user: address,
        from_asset_metadata: Object<Metadata>,
        to_asset_metadata: Object<Metadata>,
        amount_in: u64,
        amount_out_min: u64,
        amount_out: u64,
        fee_recipient: address,
        fee_amount: u64,
        timestamp_microseconds: u64,
    }

    
    /// Balance manager
    struct BalanceManager has key {
        owner: address,
        balances: SimpleMap<Object<Metadata>, u64>,
    }
    
    /// Record table
    struct Record has key {
        record: Table<address, address>,
    }
    
    /// Admin capability
    struct AdminCap has key {
        owner: address,
    }
    
    /// Resource account signer capability
    struct ResourceSignerCapability has key {
        signer_cap: account::SignerCapability
    }

    /// Initialize module
    fun init_module(account: &signer) {
        let admin_addr = signer::address_of(account);
        
        // Create admin capability
        move_to(account, AdminCap {
            owner: admin_addr,
        });
        
        // Create record table
        move_to(account, Record {
            record: table::new(),
        });
        
        // Create resource account with a seed
        let (_, signer_cap) = account::create_resource_account(account, b"tradingflow_vault_seed");
        
        // Save the signer capability
        move_to(account, ResourceSignerCapability { 
            signer_cap
        });
    }


    /// Create balance manager
    public entry fun create_balance_manager(
        user: &signer
    ) acquires Record {
        let user_addr = signer::address_of(user);
        
        // Create balance manager
        let balance_manager = BalanceManager {
            owner: user_addr,
            balances: simple_map::create(),
        };
        
        // Record user's balance manager
        let record = borrow_global_mut<Record>(@tradingflow_vault);
        record.record.add(user_addr, user_addr);
        
        // Move balance manager to user account
        move_to(user, balance_manager);
        
        // Emit balance manager creation event
        0x1::event::emit(BalanceManagerCreatedEvent {
            user: user_addr,
            timestamp_microseconds: timestamp::now_microseconds(),
        });
    }

    /// User deposit function
    public entry fun user_deposit(
        user: &signer,
        metadata: Object<Metadata>,
        amount: u64
    ) acquires BalanceManager, ResourceSignerCapability {
        let user_addr = signer::address_of(user);

        // Get user's balance manager
        let bm = borrow_global_mut<BalanceManager>(user_addr);
        assert!(bm.owner == user_addr, ENOT_VAULT_OWNER);

        // Withdraw assets from user's store
        let fa = primary_fungible_store::withdraw(user, metadata, amount);
        
        // Deposit to balance manager
        deposit_internal(bm, fa);
        
        // Emit deposit event
        0x1::event::emit(UserDepositEvent {
            user: user_addr,
            asset_metadata: metadata,
            amount,
            timestamp_microseconds: timestamp::now_microseconds(),
        });
    }
    
    /// User withdrawal function
    public entry fun user_withdraw(
        user: &signer,
        metadata: Object<Metadata>,
        amount: u64
    ) acquires BalanceManager, ResourceSignerCapability {
        let user_addr = signer::address_of(user);
        
        // Get user's balance manager
        let bm = borrow_global_mut<BalanceManager>(user_addr);
        assert!(bm.owner == user_addr, ENOT_VAULT_OWNER);
        
        // Withdraw tokens from balance manager
        let fa = withdraw_internal(bm, metadata, amount);

        // Withdraw to user
        primary_fungible_store::deposit(user_addr, fa);

        // Emit withdrawal event
        0x1::event::emit(UserWithdrawEvent {
            user: user_addr,
            asset_metadata: metadata,
            amount,
            timestamp_microseconds: timestamp::now_microseconds(),
        });
    }
    
    /// Send trade signal and execute Hyperion DEX transaction
    /// This function is called by admin to execute trades on behalf of users
    public entry fun send_trade_signal(
        admin: &signer,
        user_addr: address,
        from_token_metadata: Object<Metadata>,
        to_token_metadata: Object<Metadata>,
        fee_tier: u8,
        amount_in: u64,
        amount_out_min: u64,
        sqrt_price_limit: u128,
        deadline: u64,
        fee_recipient: address,
        fee_rate: u64  // fee rate in parts per million (1 = 0.0001%)
    ) acquires BalanceManager, ResourceSignerCapability, AdminCap {

        // Verify admin
        let admin_addr = signer::address_of(admin);
        let admin_cap = borrow_global<AdminCap>(@tradingflow_vault);
        assert!(admin_cap.owner == admin_addr, ENOT_ADMIN);
        
        // Get user's balance manager
        let bm = borrow_global_mut<BalanceManager>(user_addr);
        
        // Check if balance is sufficient
        assert!(bm.balances.contains_key(&from_token_metadata), EINSUFFICIENT_BALANCE);
        let balance = bm.balances.borrow_mut(&from_token_metadata);
        assert!(*balance >= amount_in, EINSUFFICIENT_BALANCE);

        // Update withdraw balance from balance manager
        *balance -= amount_in;
        
        // Get resource signer
        let resource_signer = get_resource_signer();
        
        // Get resource account address
        let resource_addr = signer::address_of(&resource_signer);

        //  Get to-token balance from resource account before dex-swap
        let to_token_balance_before_swap = primary_fungible_store::balance(resource_addr, to_token_metadata);

        // Execute swap on Hyperion DEX
        router_v3::exact_input_swap_entry(
            &resource_signer,
            fee_tier,
            amount_in,
            amount_out_min,
            sqrt_price_limit,
            from_token_metadata,
            to_token_metadata,
            resource_addr,
            deadline
        );

        //  Get to-token balance from resource account after dex-swap and delta
        let to_token_balance_after_swap = primary_fungible_store::balance(resource_addr, to_token_metadata);
        
        // Check for potential underflow before calculating delta
        assert!(to_token_balance_after_swap >= to_token_balance_before_swap, EINSUFFICIENT_BALANCE);
        let to_token_delta = to_token_balance_after_swap - to_token_balance_before_swap;
        
        // Ensure we received some tokens from the swap
        assert!(to_token_delta > 0, EBELOW_MIN_AMOUNT);

        // Calculate fee amount (fee_rate is in parts per million)
        let fee_amount = (to_token_delta * fee_rate) / 1_000_000;
        let user_amount = to_token_delta - fee_amount;

        // Transfer fee to fee recipient if fee_amount > 0
        if (fee_amount > 0) {
            let fee_fa = primary_fungible_store::withdraw(&resource_signer, to_token_metadata, fee_amount);
            primary_fungible_store::deposit(fee_recipient, fee_fa);
        };

        // Update to-token balance to balance manager (user gets the remaining amount)
        if (bm.balances.contains_key(&to_token_metadata)) {
            let balance = bm.balances.borrow_mut(&to_token_metadata);
            *balance += user_amount;
        } else {
            bm.balances.add(to_token_metadata, user_amount);
        };

        // Emit trade signal event
        0x1::event::emit(TradeSignalEvent {
            user: user_addr,
            from_asset_metadata: from_token_metadata,
            to_asset_metadata: to_token_metadata,
            amount_in,
            amount_out_min,
            amount_out: to_token_delta,
            fee_recipient,
            fee_amount,
            timestamp_microseconds: timestamp::now_microseconds(),
        });
    }

    // Get Resource Address
    fun get_resource_addr():address acquires ResourceSignerCapability {
        account::get_signer_capability_address(&ResourceSignerCapability[@tradingflow_vault].signer_cap)
    }

    /// Get resource signer for the vault
    fun get_resource_signer(): signer acquires ResourceSignerCapability {
        let cap = &borrow_global<ResourceSignerCapability>(@tradingflow_vault).signer_cap;
        account::create_signer_with_capability(cap)
    }

    /// Deposit to balance manager
    fun deposit_internal(bm: &mut BalanceManager, fa: FungibleAsset) acquires ResourceSignerCapability {
        let metadata = fungible_asset::asset_metadata(&fa);
        let amount = fungible_asset::amount(&fa);

        // Deposit assets to resource account
        primary_fungible_store::deposit(get_resource_addr(), fa);
        
        // Update balance
        if (bm.balances.contains_key(&metadata)) {
            let balance = bm.balances.borrow_mut(&metadata);
            *balance += amount;
        } else {
            bm.balances.add(metadata, amount);
        };
    }
    
    /// Withdraw from balance manager
    fun withdraw_internal(bm: &mut BalanceManager, metadata: Object<Metadata>, amount: u64): FungibleAsset acquires ResourceSignerCapability {
        // Check if balance is sufficient
        assert!(bm.balances.contains_key(&metadata), EINSUFFICIENT_BALANCE);
        let balance = bm.balances.borrow_mut(&metadata);
        assert!(*balance >= amount, EINSUFFICIENT_BALANCE);
        
        // Update balance
        *balance -= amount;

        // Use withdraw_with_resource_signer to withdraw assets
        let resource_signer = get_resource_signer();
        primary_fungible_store::withdraw(&resource_signer, metadata, amount)
    }

}
